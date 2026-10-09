// Reputation lookups against public threat-intelligence services. Every
// service is opt-in and uses the user's own API key. Google Safe Browsing is
// queried with 4-byte SHA-256 hash prefixes (v5 hashes:search), so the URL
// itself never leaves the device.

import { registrableDomain, isIP, normalizeHost } from "./domain.js";

const b64 = (bytes) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
const b64url = (str) => btoa(unescape(encodeURIComponent(str))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function fetchJson(fetchImpl, url, init = {}, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch { /* not JSON */ }
    return { status: res.status, ok: res.ok, json };
  } finally {
    clearTimeout(timer);
  }
}

// --- Safe Browsing v5 ----------------------------------------------------------

function fullyUnescape(s) {
  let prev;
  let cur = s;
  for (let i = 0; i < 10 && cur !== prev; i++) {
    prev = cur;
    try {
      cur = decodeURIComponent(cur.replace(/%(?![0-9a-f]{2})/gi, "%25"));
    } catch {
      break;
    }
  }
  return cur;
}

function escapeSB(s) {
  let out = "";
  for (const ch of new TextEncoder().encode(s)) {
    out += ch <= 32 || ch >= 127 || ch === 0x23 || ch === 0x25 ? `%${ch.toString(16).toUpperCase().padStart(2, "0")}` : String.fromCharCode(ch);
  }
  return out;
}

/** Canonicalise a URL per the Safe Browsing "URLs and Hashing" spec. */
export function sbCanonicalize(rawUrl) {
  const u = new URL(String(rawUrl).replace(/[\t\r\n]/g, ""));
  let host = fullyUnescape(u.hostname).replace(/^\.+|\.+$/g, "").replace(/\.{2,}/g, ".").toLowerCase();
  host = host.replace(/^\[|\]$/g, "");
  let path = fullyUnescape(u.pathname || "/");
  const segs = [];
  for (const seg of path.split("/")) {
    if (seg === "..") segs.pop();
    else if (seg !== "." && seg !== "") segs.push(seg);
  }
  path = "/" + segs.join("/") + (path.endsWith("/") && segs.length ? "/" : "");
  const query = u.search ? fullyUnescape(u.search) : "";
  return { host: escapeSB(host), path: escapeSB(path), query: escapeSB(query) };
}

/** Host-suffix / path-prefix expressions (max 5 hosts × 6 paths). */
export function sbExpressions(rawUrl) {
  const { host, path, query } = sbCanonicalize(rawUrl);
  const hosts = [host];
  if (!isIP(host)) {
    const reg = registrableDomain(host);
    const labels = host.split(".");
    const regLen = reg.split(".").length;
    for (let n = regLen; n < labels.length && hosts.length < 5; n++) {
      const h = labels.slice(labels.length - n).join(".");
      if (!hosts.includes(h)) hosts.push(h);
    }
    // Keep the exact host plus at most four suffixes.
    if (hosts.length > 5) hosts.length = 5;
  }
  const paths = [];
  if (query) paths.push(path + query);
  paths.push(path);
  const parts = path.split("/").filter(Boolean);
  let prefix = "/";
  if (!paths.includes(prefix)) paths.push(prefix);
  for (let i = 0; i < parts.length - (path.endsWith("/") ? 0 : 1) && paths.length < 6; i++) {
    prefix += `${parts[i]}/`;
    if (!paths.includes(prefix)) paths.push(prefix);
  }
  const out = [];
  for (const h of hosts) for (const p of paths.slice(0, 6)) out.push(h + p);
  return [...new Set(out)];
}

export async function safeBrowsingLookup(url, apiKey, fetchImpl = globalThis.fetch) {
  const exprs = sbExpressions(url);
  const hashes = await Promise.all(exprs.map(async (e) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(e)))));
  const params = new URLSearchParams({ key: apiKey });
  const prefixes = new Set(hashes.map((h) => b64(h.subarray(0, 4))));
  for (const p of prefixes) params.append("hashPrefixes", p);
  const res = await fetchJson(fetchImpl, `https://safebrowsing.googleapis.com/v5/hashes:search?${params}`);
  if (!res.ok) throw new Error(`Safe Browsing HTTP ${res.status}${res.json?.error?.message ? `: ${res.json.error.message}` : ""}`);
  const full = new Set(hashes.map((h) => b64(h)));
  const threats = new Set();
  for (const fh of res.json?.fullHashes ?? []) {
    if (!full.has(fh.fullHash)) continue;
    for (const d of fh.fullHashDetails ?? []) {
      const attrs = d.attributes ?? [];
      if (attrs.includes("CANARY") || attrs.includes("THREAT_ATTRIBUTE_UNSPECIFIED")) continue;
      if (d.threatType) threats.add(d.threatType);
    }
  }
  return {
    service: "Google Safe Browsing",
    malicious: threats.size > 0,
    threats: [...threats],
    cacheSeconds: parseFloat(res.json?.cacheDuration) || 300,
  };
}

// --- VirusTotal v3 -----------------------------------------------------------------

export async function virusTotalUrl(url, apiKey, fetchImpl = globalThis.fetch) {
  const res = await fetchJson(fetchImpl, `https://www.virustotal.com/api/v3/urls/${b64url(url)}`, { headers: { "x-apikey": apiKey } });
  if (res.status === 404) return { service: "VirusTotal", known: false, malicious: false };
  if (!res.ok) throw new Error(`VirusTotal HTTP ${res.status}${res.json?.error?.message ? `: ${res.json.error.message}` : ""}`);
  return vtSummary(res.json?.data?.attributes, `https://www.virustotal.com/gui/url/${res.json?.data?.id}`);
}

export async function virusTotalSubmitUrl(url, apiKey, fetchImpl = globalThis.fetch) {
  const res = await fetchJson(fetchImpl, "https://www.virustotal.com/api/v3/urls", {
    method: "POST",
    headers: { "x-apikey": apiKey, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ url }).toString(),
  });
  if (!res.ok) throw new Error(`VirusTotal HTTP ${res.status}`);
  return { analysisId: res.json?.data?.id };
}

export async function virusTotalFile(sha256, apiKey, fetchImpl = globalThis.fetch) {
  const res = await fetchJson(fetchImpl, `https://www.virustotal.com/api/v3/files/${sha256}`, { headers: { "x-apikey": apiKey } });
  if (res.status === 404) return { service: "VirusTotal", known: false, malicious: false };
  if (!res.ok) throw new Error(`VirusTotal HTTP ${res.status}${res.json?.error?.message ? `: ${res.json.error.message}` : ""}`);
  const attrs = res.json?.data?.attributes;
  const out = vtSummary(attrs, `https://www.virustotal.com/gui/file/${sha256}`);
  out.label = attrs?.popular_threat_classification?.suggested_threat_label || null;
  out.typeDescription = attrs?.type_description || null;
  return out;
}

function vtSummary(attrs, link) {
  const s = attrs?.last_analysis_stats ?? {};
  const engines = (s.malicious || 0) + (s.suspicious || 0) + (s.harmless || 0) + (s.undetected || 0);
  return {
    service: "VirusTotal",
    known: true,
    malicious: (s.malicious || 0) >= 2,
    suspicious: (s.malicious || 0) + (s.suspicious || 0) > 0,
    stats: s,
    engines,
    reputation: attrs?.reputation ?? null,
    lastAnalysis: attrs?.last_analysis_date ? new Date(attrs.last_analysis_date * 1000).toISOString() : null,
    link,
  };
}

// --- abuse.ch (URLhaus / MalwareBazaar) ---------------------------------------------

async function abusePost(fetchImpl, url, form, apiKey) {
  const res = await fetchJson(fetchImpl, url, {
    method: "POST",
    headers: { "Auth-Key": apiKey, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
  });
  if (!res.ok) throw new Error(`abuse.ch HTTP ${res.status}`);
  return res.json;
}

export async function urlhausHost(host, apiKey, fetchImpl = globalThis.fetch) {
  const json = await abusePost(fetchImpl, "https://urlhaus-api.abuse.ch/v1/host/", { host: normalizeHost(host) }, apiKey);
  if (json?.query_status !== "ok") return { service: "URLhaus", known: false, malicious: false };
  const online = (json.urls ?? []).filter((u) => u.url_status === "online").length;
  return {
    service: "URLhaus",
    known: true,
    malicious: online > 0 || Number(json.url_count) > 0,
    urlCount: Number(json.url_count) || 0,
    online,
    tags: [...new Set((json.urls ?? []).flatMap((u) => u.tags ?? []))].slice(0, 10),
    link: json.urlhaus_reference,
  };
}

export async function malwareBazaarHash(sha256, apiKey, fetchImpl = globalThis.fetch) {
  const json = await abusePost(fetchImpl, "https://mb-api.abuse.ch/api/v1/", { query: "get_info", hash: sha256 }, apiKey);
  if (json?.query_status !== "ok" || !json.data?.length) return { service: "MalwareBazaar", known: false, malicious: false };
  const d = json.data[0];
  return {
    service: "MalwareBazaar",
    known: true,
    malicious: true,
    signature: d.signature || null,
    fileType: d.file_type || null,
    tags: d.tags || [],
    firstSeen: d.first_seen || null,
    link: `https://bazaar.abuse.ch/sample/${sha256}/`,
  };
}
