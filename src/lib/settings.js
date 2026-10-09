// User settings: non-secret preferences live in storage.local so every
// context (including content scripts) can read them. Secrets never go here —
// see vault.js.
import { api } from "./browser.js";

export const SETTINGS_KEY = "nv.settings";
export const SETTINGS_VERSION = 2;

export const DEFAULT_SETTINGS = Object.freeze({
  version: SETTINGS_VERSION,
  ui: {
    theme: "system", // system | dark | light
  },
  protection: {
    enabled: true,
    ads: true, // ad & tracker network blocking (static DNR ruleset)
    malware: true, // known malware / phishing hosts (static DNR ruleset)
    heuristics: "balanced", // off | balanced | strict — URL risk scoring
    contentScan: true, // in-page credential-phishing checks
    cosmetic: true, // hide leftover ad containers
    httpsUpgrade: false, // upgrade http:// navigations to https://
    downloads: "warn", // off | warn | block — dangerous download guard
    trustedSites: [], // registrable domains with protection disabled
    blockedSites: [], // domains the user blocked manually
  },
  intel: {
    safeBrowsing: false, // Google Safe Browsing v5 lookups (needs key)
    virusTotal: false, // VirusTotal URL/hash lookups (needs key)
    urlhaus: false, // abuse.ch URLhaus / MalwareBazaar lookups (needs key)
    checkOnNavigate: false, // send every top-level URL to enabled services
  },
  rbi: {
    mode: "cloud", // cloud (CDP remote browser) | local (ephemeral window)
    provider: "browserless", // browserless | custom
    region: "sfo", // browserless region: sfo | lon | ams
    customEndpoint: "", // ws(s):// CDP URL or http(s):// DevTools discovery URL
    quality: 70, // JPEG quality for the screencast
    maxSessionMinutes: 30,
    idleMinutes: 10,
    blockDownloads: true,
    blockAds: true,
    stealth: false,
    startUrl: "https://duckduckgo.com/",
  },
  email: {
    baseUrl: "https://api.mail.tm",
    mercureUrl: "https://mercure.mail.tm/.well-known/mercure",
    notifications: true,
    pollSeconds: 30,
    loadRemoteContent: false,
  },
  ai: {
    provider: "anthropic", // anthropic | openai | gemini
    anthropicModel: "claude-opus-5-5",
    effort: "medium",
    openaiBaseUrl: "https://api.openai.com/v1",
    openaiModel: "",
    geminiModel: "",
    sendPageContext: true,
  },
  notifications: {
    threats: true,
    downloads: true,
  },
});

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Deep-merge `patch` onto `base`, keeping only keys known to `base`. */
export function mergeKnown(base, patch) {
  if (!isPlainObject(patch)) return structuredClone(base);
  const out = {};
  for (const [key, def] of Object.entries(base)) {
    const val = patch[key];
    if (val === undefined) out[key] = structuredClone(def);
    else if (isPlainObject(def)) out[key] = mergeKnown(def, val);
    else if (Array.isArray(def)) out[key] = Array.isArray(val) ? [...val] : [...def];
    else if (typeof def === typeof val) out[key] = val;
    else out[key] = def;
  }
  return out;
}

/** Upgrade settings written by older releases. */
export function migrate(raw) {
  const merged = mergeKnown(DEFAULT_SETTINGS, raw ?? {});
  merged.version = SETTINGS_VERSION;
  return merged;
}

export async function getSettings() {
  const stored = await api.storage.local.get(SETTINGS_KEY);
  return migrate(stored[SETTINGS_KEY]);
}

export async function saveSettings(settings) {
  const clean = migrate(settings);
  await api.storage.local.set({ [SETTINGS_KEY]: clean });
  return clean;
}

/** Apply a partial update such as `{ protection: { ads: false } }`. */
export async function updateSettings(patch) {
  const current = await getSettings();
  const next = mergeKnown(DEFAULT_SETTINGS, deepAssign(current, patch));
  return saveSettings(next);
}

function deepAssign(target, patch) {
  const out = structuredClone(target);
  for (const [k, v] of Object.entries(patch ?? {})) {
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepAssign(out[k], v) : v;
  }
  return out;
}

export function onSettingsChanged(callback) {
  const listener = (changes, area) => {
    if (area === "local" && changes[SETTINGS_KEY]) {
      callback(migrate(changes[SETTINGS_KEY].newValue), migrate(changes[SETTINGS_KEY].oldValue));
    }
  };
  api.storage.onChanged.addListener(listener);
  return () => api.storage.onChanged.removeListener(listener);
}
