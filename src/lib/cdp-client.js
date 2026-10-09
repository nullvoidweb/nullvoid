// Minimal Chrome DevTools Protocol client over a WebSocket. Supports the
// "flattened" session model (Target.attachToTarget { flatten: true }) so one
// socket can drive the browser and its pages. Works in extension pages and in
// Node 22+ (global WebSocket), which is how the integration tests exercise it.

export class CdpError extends Error {
  constructor(method, error) {
    super(`${method}: ${error?.message || error}`);
    this.name = "CdpError";
    this.code = error?.code;
  }
}

export class CdpConnection {
  /**
   * @param {string} url WebSocket debugger URL (ws:// or wss://)
   * @param {{ WebSocketImpl?: typeof WebSocket, timeoutMs?: number }} [opts]
   */
  static connect(url, { WebSocketImpl = globalThis.WebSocket, timeoutMs = 20000 } = {}) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const ws = new WebSocketImpl(url);
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { ws.close(); } catch { /* ignore */ }
        reject(new Error("Timed out connecting to the remote browser"));
      }, timeoutMs);
      ws.onopen = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(new CdpConnection(ws));
      };
      ws.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error("Could not connect to the remote browser (check the endpoint and token)"));
      };
      ws.onclose = (ev) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error(`Remote browser closed the connection (${ev.code}${ev.reason ? `: ${ev.reason}` : ""})`));
      };
    });
  }

  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.closed = false;
    this.bytesIn = 0;
    ws.onmessage = (ev) => this.#onMessage(ev.data);
    ws.onclose = (ev) => this.#onClose(ev);
    ws.onerror = () => {};
  }

  #onMessage(raw) {
    const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
    this.bytesIn += text.length;
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    if (msg.id !== undefined) {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.error) p.reject(new CdpError(p.method, msg.error));
      else p.resolve(msg.result ?? {});
      return;
    }
    if (msg.method) this.#emit(msg.method, msg.params ?? {}, msg.sessionId);
  }

  #onClose(ev) {
    this.closed = true;
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error("Connection closed"));
    }
    this.pending.clear();
    this.#emit("__closed", { code: ev?.code, reason: ev?.reason });
  }

  #emit(method, params, sessionId) {
    for (const key of [method, "*"]) {
      const set = this.listeners.get(key);
      if (set) for (const fn of [...set]) {
        try {
          fn(params, sessionId, method);
        } catch (err) {
          console.error("[cdp] listener error", err);
        }
      }
    }
  }

  /** Send a CDP command; `sessionId` targets an attached page session. */
  send(method, params = {}, sessionId, { timeoutMs = 30000 } = {}) {
    if (this.closed) return Promise.reject(new Error("Connection closed"));
    const id = this.nextId++;
    const msg = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new CdpError(method, "timed out"));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, method, timer });
      try {
        this.ws.send(JSON.stringify(msg));
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err);
      }
    });
  }

  /** Subscribe to an event ("*" for all, "__closed" for disconnects). */
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, new Set());
    this.listeners.get(method).add(fn);
    return () => this.listeners.get(method)?.delete(fn);
  }

  once(method, predicate = () => true, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
      const off = this.on(method, (params, sessionId) => {
        if (!predicate(params, sessionId)) return;
        clearTimeout(timer);
        off();
        resolve({ params, sessionId });
      });
    });
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    try {
      this.ws.close();
    } catch { /* ignore */ }
  }
}

/**
 * Resolve a user-supplied endpoint to a browser-level WebSocket URL.
 * Accepts ws(s):// URLs directly, or http(s):// DevTools endpoints that expose
 * /json/version (local Chrome with --remote-debugging-port, self-hosted pools).
 */
export async function resolveBrowserEndpoint(endpoint, fetchImpl = globalThis.fetch) {
  const trimmed = String(endpoint || "").trim();
  if (/^wss?:\/\//i.test(trimmed)) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    const base = new URL(trimmed);
    const versionUrl = new URL("/json/version", base);
    for (const [k, v] of base.searchParams) versionUrl.searchParams.set(k, v);
    const res = await fetchImpl(versionUrl.href);
    if (!res.ok) throw new Error(`DevTools discovery failed: HTTP ${res.status}`);
    const info = await res.json();
    if (!info.webSocketDebuggerUrl) throw new Error("DevTools endpoint did not report a webSocketDebuggerUrl");
    const ws = new URL(info.webSocketDebuggerUrl);
    // Some servers report 0.0.0.0 or an internal host; keep the host the user gave.
    ws.host = base.host;
    ws.protocol = base.protocol === "https:" ? "wss:" : "ws:";
    for (const [k, v] of base.searchParams) ws.searchParams.set(k, v);
    return ws.href;
  }
  throw new Error("Endpoint must start with ws://, wss://, http:// or https://");
}

export const BROWSERLESS_REGIONS = Object.freeze({
  sfo: { host: "production-sfo.browserless.io", label: "US West (San Francisco)", code: "SFO" },
  lon: { host: "production-lon.browserless.io", label: "UK (London)", code: "LON" },
  ams: { host: "production-ams.browserless.io", label: "EU (Amsterdam)", code: "AMS" },
});

/** Build a Browserless v2 CDP WebSocket URL. */
export function browserlessEndpoint({ region = "sfo", token, timeoutMs, blockAds = false, stealth = false }) {
  const r = BROWSERLESS_REGIONS[region] ?? BROWSERLESS_REGIONS.sfo;
  const url = new URL(`wss://${r.host}${stealth ? "/chromium/stealth" : "/chromium"}`);
  url.searchParams.set("token", token);
  if (timeoutMs) url.searchParams.set("timeout", String(Math.round(timeoutMs)));
  if (blockAds) url.searchParams.set("blockAds", "true");
  return url.href;
}
