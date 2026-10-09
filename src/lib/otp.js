// Extracts one-time codes and verification links from e-mail content so the
// user can copy a code or open a confirmation link with one click.

const CODE_KEYWORDS = /(code|otp|passcode|pass code|pin|verification|verify|confirm|security|one[- ]time|2fa|two[- ]factor|login|sign[- ]in|token|kod|código|codice|code de|bestätigung)/i;
const LINK_KEYWORDS = /(verify|verification|confirm|activate|activation|validate|magic|login|signin|sign-in|reset|password|unsubscribe|token|auth|onboard|welcome|complete|approve)/i;

/** Pull candidate one-time codes out of plain text, best match first. */
export function extractCodes(text, subject = "") {
  const haystack = `${subject}\n${text || ""}`;
  const results = new Map();
  const consider = (code, index, base) => {
    const clean = code.replace(/[\s-]/g, "");
    if (clean.length < 4 || clean.length > 10) return;
    if (/^(19|20)\d{2}$/.test(clean)) return; // years
    if (/^0+$/.test(clean) || /^(\d)\1+$/.test(clean)) return;
    const window = haystack.slice(Math.max(0, index - 80), index + code.length + 40);
    let score = base;
    if (CODE_KEYWORDS.test(window)) score += 50;
    if (/^\d{6}$/.test(clean)) score += 20;
    else if (/^\d{4,8}$/.test(clean)) score += 10;
    if (/[A-Z]/.test(clean) && /\d/.test(clean)) score += 5;
    // Penalise things that look like prices, phone numbers, times or dates —
    // only when the separator touches the number ("10:30", "12/05"), so the
    // common "code: 123456" format is not affected.
    const around = haystack.slice(Math.max(0, index - 3), index + code.length + 3);
    if (/[$€£₹]\s?$/.test(haystack.slice(Math.max(0, index - 2), index)) || /[.,]\d/.test(around.slice(-3))) score -= 40;
    const before = haystack[index - 1] || "", after = haystack[index + code.length] || "";
    if (/[/:]/.test(before) || /[/:]/.test(after)) score -= 20;
    const prev = results.get(clean);
    if (!prev || prev.score < score) results.set(clean, { code: clean, score });
  };

  for (const m of haystack.matchAll(/(?<![\w$€£₹.,/-])(\d{3}[ -]\d{3}|\d{4,8})(?![\w.,/-]?\d)/g)) consider(m[1], m.index, 10);
  for (const m of haystack.matchAll(/(?<![\w-])([A-Z0-9]{5,8})(?![\w-])/g)) {
    if (/\d/.test(m[1]) && /[A-Z]/.test(m[1])) consider(m[1], m.index, 0);
  }
  return [...results.values()].filter((r) => r.score >= 40).sort((a, b) => b.score - a.score).map((r) => r.code);
}

/** Return verification-style links from HTML or text, best match first. */
export function extractLinks(html = "", text = "") {
  const urls = new Map();
  const add = (href, label = "") => {
    let url;
    try {
      url = new URL(href);
    } catch {
      return;
    }
    if (!/^https?:$/.test(url.protocol)) return;
    const key = url.href;
    const hay = `${label} ${url.pathname} ${url.search}`;
    let score = 0;
    if (LINK_KEYWORDS.test(hay)) score += 50;
    if (/unsubscribe/i.test(hay)) score -= 60;
    if (/\.(png|jpe?g|gif|svg|css|ico|woff2?)(\?|$)/i.test(url.pathname)) score -= 100;
    if (!urls.has(key) || urls.get(key).score < score) urls.set(key, { url: key, label: label.trim().slice(0, 80), score });
  };
  for (const m of String(html).matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    add(decodeEntities(m[1]), m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
  }
  for (const m of String(text).matchAll(/https?:\/\/[^\s<>"')\]]+/g)) add(m[0]);
  return [...urls.values()].filter((l) => l.score > 0).sort((a, b) => b.score - a.score);
}

function decodeEntities(s) {
  return s.replace(/&amp;/g, "&").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
