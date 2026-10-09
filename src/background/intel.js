// URL and file-hash reputation: offline heuristics plus the threat-intel
// services the user enabled. Results are cached in storage.session.
import { api, isWebUrl } from "../lib/browser.js";
import { getSettings } from "../lib/settings.js";
import { getSecrets } from "../lib/vault.js";
import { analyzeUrl } from "../lib/url-analysis.js";
import { safeBrowsingLookup, virusTotalUrl, virusTotalSubmitUrl, virusTotalFile, urlhausHost, malwareBazaarHash } from "../lib/threat-intel.js";
import { handle } from "./router.js";

const CACHE_KEY = "nv.intelCache";
const MAX_CACHE = 400;

async function cacheGet(key) {
  const { [CACHE_KEY]: cache = {} } = await api.storage.session.get(CACHE_KEY);
  const hit = cache[key];
  return hit && hit.expires > Date.now() ? hit.value : null;
}

async function cachePut(key, value, ttlSeconds) {
  const { [CACHE_KEY]: cache = {} } = await api.storage.session.get(CACHE_KEY);
  cache[key] = { value, expires: Date.now() + ttlSeconds * 1000 };
  const keys = Object.keys(cache);
  if (keys.length > MAX_CACHE) {
    keys.sort((a, b) => cache[a].expires - cache[b].expires).slice(0, keys.length - MAX_CACHE).forEach((k) => delete cache[k]);
  }
  await api.storage.session.set({ [CACHE_KEY]: cache });
}

async function cached(key, ttl, fn) {
  const hit = await cacheGet(key);
  if (hit) return { ...hit, cached: true };
  const value = await fn();
  await cachePut(key, value, value?.cacheSeconds ?? ttl);
  return value;
}

/** Which services are enabled *and* have a key. */
export async function activeServices() {
  const [settings, secrets] = await Promise.all([getSettings(), getSecrets(["safeBrowsingKey", "virusTotalKey", "abuseChKey"])]);
  return {
    safeBrowsing: settings.intel.safeBrowsing && secrets.safeBrowsingKey ? secrets.safeBrowsingKey : null,
    virusTotal: settings.intel.virusTotal && secrets.virusTotalKey ? secrets.virusTotalKey : null,
    urlhaus: settings.intel.urlhaus && secrets.abuseChKey ? secrets.abuseChKey : null,
    settings,
  };
}

export async function checkUrlReputation(url) {
  if (!isWebUrl(url)) return [];
  const svc = await activeServices();
  const host = new URL(url).hostname;
  const jobs = [];
  if (svc.safeBrowsing) jobs.push(cached(`sb:${url}`, 300, () => safeBrowsingLookup(url, svc.safeBrowsing)));
  if (svc.virusTotal) jobs.push(cached(`vt:${url}`, 3600, () => virusTotalUrl(url, svc.virusTotal)));
  if (svc.urlhaus) jobs.push(cached(`uh:${host}`, 1800, () => urlhausHost(host, svc.urlhaus)));
  const settled = await Promise.allSettled(jobs);
  return settled.map((r) => (r.status === "fulfilled" ? r.value : { service: "error", error: r.reason?.message || String(r.reason) }));
}

export function combineVerdict(analysis, intel = []) {
  const malicious = intel.filter((r) => r.malicious);
  if (malicious.length) {
    return { level: "dangerous", reason: `Flagged by ${malicious.map((m) => m.service).join(", ")}` };
  }
  return { level: analysis.level, reason: analysis.signals[0]?.message || "No risk signals found" };
}

handle("intel:checkUrl", async ({ url, online = true }) => {
  const analysis = analyzeUrl(url);
  const intel = online ? await checkUrlReputation(url) : [];
  return { url, analysis, intel, verdict: combineVerdict(analysis, intel) };
}, { contentScripts: false });

handle("intel:submitUrl", async ({ url }) => {
  const svc = await activeServices();
  if (!svc.virusTotal) throw new Error("Enable VirusTotal and add an API key first.");
  return virusTotalSubmitUrl(url, svc.virusTotal);
});

handle("intel:checkHash", async ({ sha256 }) => {
  if (!/^[a-f0-9]{64}$/i.test(sha256)) throw new Error("Invalid SHA-256");
  const svc = await activeServices();
  const jobs = [];
  if (svc.virusTotal) jobs.push(cached(`vtf:${sha256}`, 3600, () => virusTotalFile(sha256, svc.virusTotal)));
  if (svc.urlhaus) jobs.push(cached(`mb:${sha256}`, 3600, () => malwareBazaarHash(sha256, svc.urlhaus)));
  if (!jobs.length) return { results: [], configured: false };
  const settled = await Promise.allSettled(jobs);
  return {
    configured: true,
    results: settled.map((r) => (r.status === "fulfilled" ? r.value : { service: "error", error: r.reason?.message || String(r.reason) })),
  };
});

handle("intel:testKey", async ({ service }) => {
  const secrets = await getSecrets(["safeBrowsingKey", "virusTotalKey", "abuseChKey"]);
  const probe = "http://testsafebrowsing.appspot.com/s/malware.html";
  if (service === "safeBrowsing") {
    if (!secrets.safeBrowsingKey) throw new Error("No key saved");
    const r = await safeBrowsingLookup(probe, secrets.safeBrowsingKey);
    return { ok: true, detail: r.malicious ? "Key works — Google's test page is flagged as expected." : "Key accepted." };
  }
  if (service === "virusTotal") {
    if (!secrets.virusTotalKey) throw new Error("No key saved");
    await virusTotalUrl("https://www.google.com/", secrets.virusTotalKey);
    return { ok: true, detail: "Key works." };
  }
  if (service === "urlhaus") {
    if (!secrets.abuseChKey) throw new Error("No key saved");
    await urlhausHost("example.com", secrets.abuseChKey);
    return { ok: true, detail: "Key works." };
  }
  throw new Error("Unknown service");
});
