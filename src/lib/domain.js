// Hostname helpers: registrable-domain approximation, IP detection and
// punycode decoding. Pure functions — safe in the service worker and Node.

// Multi-label public suffixes that matter for phishing analysis. This is a
// pragmatic subset of the Public Suffix List (ccTLD second levels plus the
// shared hosting platforms where every subdomain belongs to a different owner).
const MULTI_SUFFIXES = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "me.uk", "net.uk", "ltd.uk", "plc.uk",
  "com.au", "net.au", "org.au", "edu.au", "gov.au", "co.nz", "org.nz", "net.nz", "govt.nz",
  "co.jp", "ne.jp", "or.jp", "ac.jp", "go.jp", "co.kr", "or.kr", "go.kr",
  "com.br", "net.br", "org.br", "gov.br", "com.mx", "org.mx", "gob.mx", "com.ar", "gob.ar",
  "co.in", "net.in", "org.in", "gov.in", "ac.in", "edu.in", "firm.in", "gen.in", "ind.in",
  "com.cn", "net.cn", "org.cn", "gov.cn", "edu.cn", "com.hk", "org.hk", "com.tw", "org.tw",
  "com.sg", "edu.sg", "gov.sg", "com.my", "com.ph", "com.vn", "co.th", "in.th", "co.id", "or.id",
  "com.tr", "org.tr", "gov.tr", "co.za", "org.za", "gov.za", "com.ng", "co.ke", "com.eg",
  "com.sa", "com.pk", "com.bd", "com.ua", "co.il", "org.il", "ac.il", "com.pl", "com.ru",
  "com.co", "com.pe", "com.ve", "com.ec", "co.ve", "com.uy",
  // Shared hosting / dynamic DNS: each subdomain is an independent site.
  "github.io", "gitlab.io", "pages.dev", "workers.dev", "netlify.app", "vercel.app", "web.app",
  "firebaseapp.com", "herokuapp.com", "glitch.me", "repl.co", "replit.dev", "onrender.com",
  "azurewebsites.net", "cloudfront.net", "appspot.com", "blogspot.com", "wordpress.com",
  "wixsite.com", "weebly.com", "000webhostapp.com", "duckdns.org", "ngrok.io", "ngrok-free.app",
  "ngrok.app", "trycloudflare.com", "surge.sh", "fly.dev", "s3.amazonaws.com", "r2.dev",
  "framer.website", "webflow.io", "myshopify.com", "square.site", "carrd.co", "notion.site",
]);

/** Hosting platforms frequently abused for throwaway phishing pages. */
export const FREE_HOSTING_SUFFIXES = new Set([
  "pages.dev", "workers.dev", "netlify.app", "vercel.app", "web.app", "firebaseapp.com",
  "herokuapp.com", "glitch.me", "repl.co", "replit.dev", "onrender.com", "azurewebsites.net",
  "blogspot.com", "wixsite.com", "weebly.com", "000webhostapp.com", "duckdns.org", "ngrok.io",
  "ngrok-free.app", "ngrok.app", "trycloudflare.com", "surge.sh", "r2.dev", "webflow.io",
  "framer.website", "square.site", "carrd.co", "github.io", "gitlab.io", "fly.dev", "notion.site",
]);

export function normalizeHost(host) {
  return String(host || "").trim().toLowerCase().replace(/\.+$/, "").replace(/^\[|\]$/g, "");
}

export function isIPv4(host) {
  const parts = String(host).split(".");
  return parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

export function isIPv6(host) {
  return String(host).includes(":") && /^[0-9a-f:.]+$/i.test(host);
}

export function isIP(host) {
  return isIPv4(host) || isIPv6(host);
}

export function isPrivateHost(host) {
  const h = normalizeHost(host);
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".lan")) return true;
  if (isIPv4(h)) {
    const [a, b] = h.split(".").map(Number);
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a === 0;
  }
  if (isIPv6(h)) return h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80");
  return false;
}

/** Public suffix for `host` (best effort, see MULTI_SUFFIXES). */
export function publicSuffix(host) {
  const labels = normalizeHost(host).split(".");
  for (let i = 0; i < labels.length - 1; i++) {
    const candidate = labels.slice(i).join(".");
    if (MULTI_SUFFIXES.has(candidate)) return candidate;
  }
  return labels[labels.length - 1] || "";
}

/** eTLD+1, e.g. "login.secure.paypal.co.uk" → "paypal.co.uk". */
export function registrableDomain(host) {
  const h = normalizeHost(host);
  if (!h || isIP(h)) return h;
  const suffix = publicSuffix(h);
  if (h === suffix) return h;
  const rest = h.slice(0, h.length - suffix.length - 1);
  const label = rest.split(".").pop();
  return `${label}.${suffix}`;
}

/** The label directly left of the public suffix ("paypal" in paypal.co.uk). */
export function domainLabel(host) {
  const reg = registrableDomain(host);
  const suffix = publicSuffix(host);
  return reg.endsWith(`.${suffix}`) ? reg.slice(0, -(suffix.length + 1)) : reg;
}

export function subdomainPart(host) {
  const h = normalizeHost(host);
  const reg = registrableDomain(h);
  return h === reg ? "" : h.slice(0, h.length - reg.length - 1);
}

export function hostMatchesDomain(host, domain) {
  const h = normalizeHost(host);
  const d = normalizeHost(domain);
  return h === d || h.endsWith(`.${d}`);
}

// --- Punycode (RFC 3492) decoder -------------------------------------------
const BASE = 36, TMIN = 1, TMAX = 26, SKEW = 38, DAMP = 700, INITIAL_BIAS = 72, INITIAL_N = 128;

function adapt(delta, numPoints, firstTime) {
  let k = 0;
  delta = firstTime ? Math.floor(delta / DAMP) : delta >> 1;
  delta += Math.floor(delta / numPoints);
  for (; delta > ((BASE - TMIN) * TMAX) >> 1; k += BASE) delta = Math.floor(delta / (BASE - TMIN));
  return Math.floor(k + ((BASE - TMIN + 1) * delta) / (delta + SKEW));
}

function basicToDigit(cp) {
  if (cp >= 0x30 && cp < 0x3a) return 26 + (cp - 0x30);
  if (cp >= 0x41 && cp < 0x5b) return cp - 0x41;
  if (cp >= 0x61 && cp < 0x7b) return cp - 0x61;
  return BASE;
}

export function punycodeDecode(input) {
  const output = [];
  let i = 0, n = INITIAL_N, bias = INITIAL_BIAS;
  let basic = input.lastIndexOf("-");
  if (basic < 0) basic = 0;
  for (let j = 0; j < basic; j++) {
    if (input.charCodeAt(j) >= 0x80) throw new Error("not-basic");
    output.push(input.charCodeAt(j));
  }
  for (let index = basic > 0 ? basic + 1 : 0; index < input.length;) {
    const oldi = i;
    for (let w = 1, k = BASE; ; k += BASE) {
      if (index >= input.length) throw new Error("invalid-input");
      const digit = basicToDigit(input.charCodeAt(index++));
      if (digit >= BASE) throw new Error("invalid-input");
      i += digit * w;
      const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
      if (digit < t) break;
      w *= BASE - t;
    }
    const out = output.length + 1;
    bias = adapt(i - oldi, out, oldi === 0);
    n += Math.floor(i / out);
    i %= out;
    output.splice(i++, 0, n);
  }
  return String.fromCodePoint(...output);
}

/** Convert an ASCII (xn--) hostname to Unicode; invalid labels are kept. */
export function toUnicodeHost(host) {
  return normalizeHost(host).split(".").map((label) => {
    if (!label.startsWith("xn--")) return label;
    try {
      return punycodeDecode(label.slice(4));
    } catch {
      return label;
    }
  }).join(".");
}
