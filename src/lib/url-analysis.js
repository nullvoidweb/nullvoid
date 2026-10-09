// Offline URL risk scoring. Combines lexical signals that phishing research
// (and production systems like Safe Browsing's client-side models) rely on:
// homograph / IDN abuse, typo- and combo-squatting of well-known brands,
// credential-harvesting keywords, abused TLDs and hosting, raw IP hosts, etc.
// Pure and synchronous so it can run on every navigation without network I/O.

import {
  normalizeHost, isIP, isPrivateHost, registrableDomain, domainLabel, subdomainPart,
  publicSuffix, toUnicodeHost, FREE_HOSTING_SUFFIXES,
} from "./domain.js";
import { BRANDS, URL_SHORTENERS, HIGH_ABUSE_TLDS } from "./brands.js";

export const LEVELS = Object.freeze({
  SAFE: "safe",
  LOW: "low",
  SUSPICIOUS: "suspicious",
  DANGEROUS: "dangerous",
});

export function levelForScore(score) {
  if (score >= 70) return LEVELS.DANGEROUS;
  if (score >= 40) return LEVELS.SUSPICIOUS;
  if (score >= 15) return LEVELS.LOW;
  return LEVELS.SAFE;
}

// Cyrillic / Greek / other look-alikes of Latin letters (subset of Unicode
// confusables.txt that covers real-world IDN homograph attacks).
const HOMOGLYPHS = {
  "а": "a", "ɑ": "a", "α": "a", "à": "a", "á": "a", "â": "a", "ã": "a", "ä": "a", "å": "a", "ą": "a",
  "Ь": "b", "Ƅ": "b", "ḃ": "b",
  "с": "c", "ϲ": "c", "ç": "c", "ć": "c", "ⅽ": "c",
  "ԁ": "d", "ď": "d", "ⅾ": "d",
  "е": "e", "ё": "e", "ε": "e", "è": "e", "é": "e", "ê": "e", "ë": "e", "ė": "e", "ę": "e", "ҽ": "e",
  "ɡ": "g", "ġ": "g", "ğ": "g",
  "һ": "h", "ḥ": "h",
  "і": "i", "ı": "i", "ι": "i", "í": "i", "ì": "i", "ï": "i", "î": "i", "ⅰ": "i", "ӏ": "l",
  "ј": "j", "ϳ": "j",
  "κ": "k", "к": "k",
  "ⅼ": "l", "ł": "l", "ŀ": "l",
  "ⅿ": "m", "м": "m",
  "ո": "n", "ñ": "n", "ń": "n", "η": "n", "п": "n",
  "о": "o", "ο": "o", "ө": "o", "ò": "o", "ó": "o", "ô": "o", "õ": "o", "ö": "o", "ø": "o", "০": "o", "੦": "o",
  "р": "p", "ρ": "p",
  "ԛ": "q",
  "г": "r",
  "ѕ": "s", "ś": "s", "š": "s", "ș": "s",
  "т": "t", "τ": "t",
  "υ": "u", "ս": "u", "ü": "u", "ú": "u", "ù": "u", "û": "u",
  "ν": "v", "ѵ": "v", "ⅴ": "v",
  "ԝ": "w", "ѡ": "w", "ω": "w",
  "х": "x", "χ": "x", "ⅹ": "x",
  "у": "y", "ү": "y", "ý": "y", "ÿ": "y",
  "ᴢ": "z", "ż": "z", "ž": "z",
};

// ASCII tricks used in typosquats.
const ASCII_SKELETON = [
  [/rn/g, "m"], [/vv/g, "w"], [/cl/g, "d"], [/0/g, "o"], [/1/g, "l"], [/3/g, "e"],
  [/4/g, "a"], [/5/g, "s"], [/7/g, "t"], [/8/g, "b"], [/\$/g, "s"], [/@/g, "a"], [/!/g, "i"], [/\|/g, "l"],
];

export function foldHomoglyphs(text) {
  let out = "";
  for (const ch of String(text).normalize("NFKC").toLowerCase()) out += HOMOGLYPHS[ch] ?? ch;
  return out;
}

export function skeleton(label) {
  let s = foldHomoglyphs(label).replace(/[-_.]/g, "");
  for (const [re, rep] of ASCII_SKELETON) s = s.replace(re, rep);
  return s.replace(/i/g, "l");
}

/** Damerau–Levenshtein (optimal string alignment) distance. */
export function editDistance(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

export function shannonEntropy(str) {
  if (!str) return 0;
  const freq = new Map();
  for (const ch of str) freq.set(ch, (freq.get(ch) || 0) + 1);
  let h = 0;
  for (const c of freq.values()) {
    const p = c / str.length;
    h -= p * Math.log2(p);
  }
  return h;
}

function scriptOf(ch) {
  const cp = ch.codePointAt(0);
  if (cp < 0x80) return /[a-z]/i.test(ch) ? "latin" : "common";
  if (cp >= 0x0400 && cp <= 0x052f) return "cyrillic";
  if (cp >= 0x0370 && cp <= 0x03ff) return "greek";
  if (cp >= 0x0530 && cp <= 0x058f) return "armenian";
  if (cp >= 0x00c0 && cp <= 0x024f) return "latin";
  if (cp >= 0x0600 && cp <= 0x06ff) return "arabic";
  if (cp >= 0x4e00 && cp <= 0x9fff) return "han";
  return "other";
}

export function scriptsIn(label) {
  const set = new Set();
  for (const ch of label) {
    const s = scriptOf(ch);
    if (s !== "common") set.add(s);
  }
  return set;
}

export function isLegitBrandDomain(brand, host) {
  const reg = registrableDomain(host);
  if (brand.domains.some((d) => reg === d || host === d || host.endsWith(`.${d}`))) return true;
  return Boolean(brand.anyTld && domainLabel(host) === brand.key);
}

const CREDENTIAL_WORDS = [
  "login", "log-in", "signin", "sign-in", "verify", "verification", "account", "secure", "security",
  "update", "confirm", "unlock", "suspend", "suspended", "wallet", "banking", "password", "recover",
  "restore", "billing", "invoice", "payment", "support", "authenticate", "auth", "webscr", "session",
  "validate", "reactivate", "limited", "seed", "airdrop", "claim", "giveaway", "refund",
];

function tokenize(text) {
  return String(text).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

// Words attackers glue onto a brand ("paypal-secure", "applesupport").
const COMBO_WORDS = new Set([
  ...CREDENTIAL_WORDS, "help", "service", "services", "online", "id", "app", "pay", "center",
  "centre", "team", "desk", "care", "official", "online", "web", "my", "get", "free", "gift", "bank", "alerts",
  "reward", "rewards", "prize", "bonus", "alert", "alerts", "notice", "mail", "drive", "docs",
  "cloud", "connect", "access", "portal", "check", "safe", "now", "us", "usa", "uk", "online",
]);
const COMBO_SKELETONS = new Set([...COMBO_WORDS].map((w) => skeleton(w)));

/**
 * How strongly `label` combines `brand` with other words:
 *   2 = only with phishing filler ("paypal-secure", "applesupport", "paypa1-login")
 *   1 = as a whole token next to ordinary words ("my-apple-tree")
 *   0 = no combination (substrings like "purchase" never match "chase")
 * Checks the literal label and its look-alike skeleton, so digit and
 * homoglyph swaps inside a combo are caught too.
 */
function comboSquatStrength(label, brand) {
  let strength = 0;
  const check = (parts, b, fillers) => {
    if (parts.length > 1 && parts.includes(b)) {
      strength = Math.max(strength, parts.every((p) => p === b || fillers.has(p)) ? 2 : 1);
    }
    for (const part of parts) {
      if (part === b) continue;
      if ((part.startsWith(b) && fillers.has(part.slice(b.length))) || (part.endsWith(b) && fillers.has(part.slice(0, -b.length)))) strength = 2;
    }
  };
  check(label.split(/[-_0-9]+/).filter(Boolean), brand, COMBO_WORDS);
  check(label.split(/[-_.]+/).filter(Boolean).map(skeleton), skeleton(brand), COMBO_SKELETONS);
  return strength;
}

/**
 * Analyse a URL and return `{ score, level, signals[], host, registrable }`.
 * Each signal: `{ id, weight, message }`.
 */
export function analyzeUrl(rawUrl, opts = {}) {
  const signals = [];
  const add = (id, weight, message) => signals.push({ id, weight, message });

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return { score: 0, level: LEVELS.SAFE, signals: [], host: "", registrable: "", error: "invalid-url" };
  }

  if (url.protocol === "data:" || url.protocol === "javascript:") {
    add("script-scheme", 80, `Top-level ${url.protocol} URLs are a common phishing delivery trick.`);
  }
  if (!/^https?:$/.test(url.protocol)) {
    const score = Math.min(100, signals.reduce((s, x) => s + x.weight, 0));
    return { score, level: levelForScore(score), signals, host: "", registrable: "" };
  }

  const host = normalizeHost(url.hostname);
  const reg = registrableDomain(host);
  const label = domainLabel(host);
  const sub = subdomainPart(host);
  const tld = publicSuffix(host).split(".").pop();
  const unicodeHost = toUnicodeHost(host);
  const isLocal = isPrivateHost(host);

  if (isLocal) {
    return { score: 0, level: LEVELS.SAFE, signals: [{ id: "local", weight: 0, message: "Local or private network address." }], host, registrable: reg };
  }

  // Userinfo trick: https://paypal.com@evil.example/
  if (url.username || url.password || /^[^/]*@/.test(rawUrl.replace(/^[a-z]+:\/\//i, ""))) {
    add("userinfo", 35, "The URL hides its real destination behind an '@' (user-info) segment.");
    if (/\.[a-z]{2,}$/i.test(decodeSafe(url.username))) {
      add("fake-host-userinfo", 30, `"${decodeSafe(url.username)}" is shown before '@' to impersonate a host; the real host is "${host}".`);
    }
  }

  if (isIP(host)) add("ip-host", 25, "The site is addressed by a raw IP address instead of a domain name.");

  // IDN homograph analysis.
  if (host.split(".").some((l) => l.startsWith("xn--"))) {
    add("punycode", 15, `Internationalised domain: displays as "${unicodeHost}".`);
    for (const ulabel of unicodeHost.split(".")) {
      const scripts = scriptsIn(ulabel);
      if (scripts.size > 1 && scripts.has("latin")) {
        add("mixed-script", 35, `Label "${ulabel}" mixes ${[...scripts].join(" + ")} characters (homograph risk).`);
        break;
      }
    }
  }

  // Brand impersonation.
  const uLabel = toUnicodeHost(label);
  const labelSkeleton = skeleton(uLabel);
  const hostTokens = tokenize(foldHomoglyphs(unicodeHost));
  const pathTokens = tokenize(decodeSafe(url.pathname + " " + url.search));
  let brandHit = null;
  for (const brand of BRANDS) {
    if (isLegitBrandDomain(brand, host)) {
      brandHit = { brand, legit: true };
      break;
    }
    const exactLabel = label === brand.key;
    if (!exactLabel && labelSkeleton === skeleton(brand.key) && brand.key.length >= 4) {
      add("homograph-brand", 70, `"${unicodeHost}" visually imitates ${brand.key} but is not an official ${brand.key} domain.`);
      brandHit = { brand, legit: false };
      break;
    }
    // Six-letter minimum keeps ordinary words ("steak" vs "steam") out.
    if (!exactLabel && brand.key.length >= 6 && editDistance(label, brand.key) === 1) {
      add("typosquat", 55, `"${label}" is one character away from "${brand.key}" (typosquatting).`);
      brandHit = { brand, legit: false };
      break;
    }
    if (exactLabel) {
      // e.g. paypal.support — brand label on an unexpected public suffix.
      add("brand-wrong-tld", 35, `Uses the ${brand.key} name on ".${publicSuffix(host)}", which ${brand.key} does not operate.`);
      brandHit = { brand, legit: false };
      break;
    }
    const combo = brand.key.length >= 4 ? comboSquatStrength(foldHomoglyphs(uLabel), brand.key) : 0;
    if (combo) {
      add("combosquat", combo === 2 ? 45 : 25, `The domain "${reg}" embeds the brand "${brand.key}" (combo-squatting).`);
      brandHit = { brand, legit: false };
      break;
    }
    if (brand.key.length >= 4 && sub && tokenize(foldHomoglyphs(sub)).includes(brand.key)) {
      add("brand-subdomain", 40, `"${brand.key}" appears only in the subdomain; the real site is "${reg}".`);
      brandHit = { brand, legit: false };
      break;
    }
  }
  if (!brandHit) {
    const pathBrand = BRANDS.find((b) => b.key.length >= 5 && pathTokens.includes(b.key));
    if (pathBrand) {
      add("brand-path", 15, `Mentions "${pathBrand.key}" in the path of an unrelated domain.`);
      brandHit = { brand: pathBrand, legit: false };
    }
  }

  const legitBrand = brandHit?.legit === true;
  if (!legitBrand) {
    const credHits = new Set([...hostTokens, ...pathTokens].filter((t) => CREDENTIAL_WORDS.includes(t)));
    if (credHits.size) {
      const weight = Math.min(20, credHits.size * 7) + (brandHit ? 10 : 0);
      add("credential-words", weight, `Credential-harvesting keywords: ${[...credHits].slice(0, 5).join(", ")}.`);
    }

    if (HIGH_ABUSE_TLDS.has(tld)) add("abused-tld", 10, `".${tld}" is a top-level domain with a high abuse rate.`);

    const suffix = publicSuffix(host);
    if (FREE_HOSTING_SUFFIXES.has(suffix)) {
      add("free-hosting", brandHit ? 20 : 8, `Hosted on a free/shared platform (${suffix}) often used for throwaway pages.`);
    }

    const depth = sub ? sub.split(".").length : 0;
    if (depth >= 4) add("deep-subdomains", 12, `Unusually deep subdomain chain (${depth} levels).`);
    if (host.length > 50) add("long-host", 8, "Very long hostname.");
    if ((host.match(/-/g) || []).length >= 4) add("hyphenated", 8, "Many hyphens in the hostname.");

    const longest = host.split(".").reduce((a, b) => (b.length > a.length ? b : a), "");
    if (longest.length >= 14 && shannonEntropy(longest) > 3.7 && /\d/.test(longest)) {
      add("random-label", 12, `"${longest}" looks machine-generated (high entropy).`);
    }
  }

  if (url.port && !["80", "443", ""].includes(url.port)) add("odd-port", 6, `Non-standard port ${url.port}.`);
  if (url.protocol === "http:" && !legitBrand) add("no-tls", opts.hasPasswordField ? 25 : 5, "Connection is not encrypted (HTTP).");
  if (rawUrl.length > 200) add("long-url", 5, "Extremely long URL.");
  if ((url.pathname.match(/%[0-9a-f]{2}/gi) || []).length > 15) add("encoded-path", 6, "Heavily percent-encoded path.");
  if (/\.(exe|scr|msi|bat|cmd|ps1|vbs|js|jar|apk|hta|lnk|iso|img)$/i.test(url.pathname)) {
    add("executable-link", 15, "Links directly to an executable or script file.");
  }
  if (URL_SHORTENERS.has(reg) || URL_SHORTENERS.has(host)) add("shortener", 4, "URL shortener — the final destination is hidden.");

  let score = signals.reduce((s, x) => s + x.weight, 0);
  if (legitBrand) score = Math.min(score, 10);
  score = Math.max(0, Math.min(100, score));
  return {
    score,
    level: levelForScore(score),
    signals: signals.sort((a, b) => b.weight - a.weight),
    host,
    unicodeHost,
    registrable: reg,
    brand: brandHit ? { key: brandHit.brand.key, legit: brandHit.legit, official: brandHit.brand.domains[0] } : null,
  };
}

function decodeSafe(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Score threshold that triggers the interstitial for a heuristics mode. */
export function blockThreshold(mode) {
  if (mode === "strict") return 45;
  if (mode === "balanced") return 70;
  return Infinity;
}
