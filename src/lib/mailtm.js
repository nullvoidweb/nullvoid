// mail.tm disposable e-mail client (Hydra/JSON-LD REST API + Mercure SSE).
// API reference: https://docs.mail.tm — 8 requests/second per IP, bearer JWTs
// from POST /token (they carry no expiry claim; we still re-auth on 401).
// Terms of use require a visible link back to mail.tm, which the UI provides.

import { parseSSE } from "./sse.js";
import { randomPassword, randomLocalPart } from "./crypto.js";

export class MailTmError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "MailTmError";
    this.status = status;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class MailTmClient {
  /**
   * @param {{ baseUrl?: string, mercureUrl?: string, fetch?: typeof fetch, minIntervalMs?: number }} opts
   */
  constructor({ baseUrl = "https://api.mail.tm", mercureUrl = "https://mercure.mail.tm/.well-known/mercure", fetch: fetchImpl, minIntervalMs = 130 } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.mercureUrl = mercureUrl;
    this.fetch = fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.minIntervalMs = minIntervalMs; // stay under the 8 QPS limit
    this.nextSlot = 0;
  }

  async throttle() {
    const now = Date.now();
    const wait = Math.max(0, this.nextSlot - now);
    this.nextSlot = Math.max(now, this.nextSlot) + this.minIntervalMs;
    if (wait) await sleep(wait);
  }

  async request(path, { method = "GET", token, body, contentType = "application/json", raw = false, retries = 3, timeoutMs = 15000 } = {}) {
    for (let attempt = 0; ; attempt++) {
      await this.throttle();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      let res;
      try {
        res = await this.fetch(path.startsWith("http") ? path : this.baseUrl + path, {
          method,
          headers: {
            Accept: raw ? "*/*" : "application/ld+json, application/json",
            ...(body !== undefined ? { "Content-Type": contentType } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: ctrl.signal,
        });
      } catch (err) {
        clearTimeout(timer);
        if (attempt < retries) {
          await sleep(500 * 2 ** attempt);
          continue;
        }
        throw new MailTmError(err?.name === "AbortError" ? "mail.tm request timed out" : `Network error: ${err?.message || err}`, 0);
      }
      clearTimeout(timer);
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        const retryAfter = Number(res.headers.get?.("retry-after")) || 0;
        await sleep(Math.max(retryAfter * 1000, 700 * 2 ** attempt));
        continue;
      }
      if (!res.ok) {
        let detail = "";
        try {
          const j = await res.json();
          detail = j["hydra:description"] || j.detail || j.message || "";
        } catch { /* body not JSON */ }
        throw new MailTmError(detail || `mail.tm returned HTTP ${res.status}`, res.status);
      }
      if (raw) return res;
      if (res.status === 204) return null;
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    }
  }

  async domains() {
    const data = await this.request("/domains?page=1");
    return (data["hydra:member"] || []).filter((d) => d.isActive && !d.isPrivate).map((d) => d.domain);
  }

  /** Create a fresh mailbox and log in. Returns a credential record. */
  async createMailbox({ domain, localPart } = {}) {
    const domains = domain ? [domain] : await this.domains();
    if (!domains.length) throw new MailTmError("mail.tm has no public domains available right now", 503);
    let lastErr;
    for (let attempt = 0; attempt < 4; attempt++) {
      const chosen = domains[Math.floor(Math.random() * domains.length)];
      const address = `${localPart && attempt === 0 ? localPart : randomLocalPart()}@${chosen}`;
      const password = randomPassword(24);
      let account;
      try {
        account = await this.request("/accounts", { method: "POST", body: { address, password }, retries: 4 });
      } catch (err) {
        lastErr = err;
        if (err.status === 429) throw new MailTmError("mail.tm is rate-limiting new inboxes right now. Wait a minute and try again.", 429);
        if (err.status !== 422) throw err; // 422 = address taken / invalid, retry
        continue;
      }
      // A freshly created account can take a moment to become loginable.
      const token = await this.#initialLogin(account.address, password);
      return { id: account.id, address: account.address, password, token, createdAt: Date.now(), quota: account.quota };
    }
    throw lastErr;
  }

  async #initialLogin(address, password) {
    let lastErr;
    for (const wait of [300, 700, 1500, 3000]) {
      await sleep(wait);
      try {
        return (await this.request("/token", { method: "POST", body: { address, password } })).token;
      } catch (err) {
        lastErr = err;
        if (err.status !== 401) throw err;
      }
    }
    throw lastErr;
  }

  async login(address, password) {
    const { token, id } = await this.request("/token", { method: "POST", body: { address, password } });
    return { token, id };
  }

  /** Run `fn(token)`, transparently re-authenticating once on 401. */
  async withAuth(mailbox, fn) {
    try {
      return await fn(mailbox.token);
    } catch (err) {
      if (err.status !== 401 || !mailbox.password) throw err;
      const { token } = await this.login(mailbox.address, mailbox.password);
      mailbox.token = token;
      return fn(token);
    }
  }

  async me(mailbox) {
    return this.withAuth(mailbox, (t) => this.request("/me", { token: t }));
  }

  async listMessages(mailbox, page = 1) {
    const data = await this.withAuth(mailbox, (t) => this.request(`/messages?page=${page}`, { token: t }));
    return { items: data["hydra:member"] || [], total: data["hydra:totalItems"] ?? 0 };
  }

  async getMessage(mailbox, id) {
    return this.withAuth(mailbox, (t) => this.request(`/messages/${encodeURIComponent(id)}`, { token: t }));
  }

  async markSeen(mailbox, id, seen = true) {
    return this.withAuth(mailbox, (t) => this.request(`/messages/${encodeURIComponent(id)}`, {
      method: "PATCH", token: t, body: { seen }, contentType: "application/merge-patch+json",
    }));
  }

  async deleteMessage(mailbox, id) {
    return this.withAuth(mailbox, (t) => this.request(`/messages/${encodeURIComponent(id)}`, { method: "DELETE", token: t }));
  }

  async getSource(mailbox, id) {
    return this.withAuth(mailbox, (t) => this.request(`/sources/${encodeURIComponent(id)}`, { token: t }));
  }

  /** Download an attachment (downloadUrl is relative to the API base). */
  async downloadAttachment(mailbox, downloadUrl) {
    const res = await this.withAuth(mailbox, (t) => this.request(downloadUrl, { token: t, raw: true, timeoutMs: 60000 }));
    return res.blob();
  }

  async deleteMailbox(mailbox) {
    return this.withAuth(mailbox, (t) => this.request(`/accounts/${encodeURIComponent(mailbox.id)}`, { method: "DELETE", token: t }));
  }

  /**
   * Live updates through mail.tm's Mercure hub. Calls `onUpdate(data)` for
   * every pushed resource (messages and account quota changes). Resolves when
   * `signal` aborts; reconnects with exponential backoff on errors.
   */
  async subscribe(mailbox, onUpdate, signal) {
    let backoff = 1000;
    while (!signal?.aborted) {
      try {
        const url = `${this.mercureUrl}?topic=${encodeURIComponent(`/accounts/${mailbox.id}`)}`;
        const res = await this.fetch(url, {
          headers: { Accept: "text/event-stream", Authorization: `Bearer ${mailbox.token}` },
          signal,
        });
        if (res.status === 401 && mailbox.password) {
          mailbox.token = (await this.login(mailbox.address, mailbox.password)).token;
          continue;
        }
        if (!res.ok || !res.body) throw new MailTmError(`Mercure HTTP ${res.status}`, res.status);
        backoff = 1000;
        for await (const evt of parseSSE(res.body)) {
          try {
            onUpdate(JSON.parse(evt.data));
          } catch { /* ignore malformed payloads */ }
        }
      } catch (err) {
        if (signal?.aborted || err?.name === "AbortError") return;
      }
      await sleep(backoff);
      backoff = Math.min(backoff * 2, 60000);
    }
  }
}

/** Normalise mail.tm message HTML (array of parts) into one string. */
export function messageHtml(message) {
  const html = Array.isArray(message?.html) ? message.html.join("\n") : message?.html || "";
  return html;
}
