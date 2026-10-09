// DOMPurify-based sanitisation for untrusted HTML (e-mail bodies, AI output,
// HTML file previews). Browser-only (needs a DOM).
import DOMPurify from "../vendor/purify.es.mjs";
import { extensionUrl } from "./browser.js";

const RICH_CONFIG = {
  ALLOWED_TAGS: ["p", "br", "strong", "em", "del", "code", "pre", "a", "ul", "ol", "li", "blockquote", "h3", "h4", "h5", "h6", "hr", "table", "thead", "tbody", "tr", "th", "td"],
  ALLOWED_ATTR: ["href", "target", "rel", "data-lang"],
  ALLOWED_URI_REGEXP: /^https?:/i,
};

/** Sanitise AI/markdown output for direct insertion into an extension page. */
export function sanitizeRich(html) {
  return DOMPurify.sanitize(html, RICH_CONFIG);
}

/** Same allow-list, returned as a DocumentFragment (no innerHTML round-trip). */
export function sanitizeRichFragment(html) {
  return DOMPurify.sanitize(html, { ...RICH_CONFIG, RETURN_DOM_FRAGMENT: true });
}

/**
 * Sanitise an e-mail body for rendering inside a sandboxed iframe.
 * - strips scripts, forms, objects, meta refresh, base tags
 * - counts and (optionally) blocks remote images / tracking pixels
 * - rewrites every link through the NULL VOID link checker
 */
export function sanitizeEmail(html, { allowRemote = false } = {}) {
  let remoteCount = 0;
  let trackers = 0;
  const purify = DOMPurify();
  purify.addHook("uponSanitizeAttribute", (node, data) => {
    const name = data.attrName;
    if (["src", "srcset", "background", "poster"].includes(name)) {
      if (/^\s*(https?:)?\/\//i.test(data.attrValue)) {
        remoteCount++;
        const w = node.getAttribute?.("width"), h = node.getAttribute?.("height");
        if ((w === "1" || w === "0") && (h === "1" || h === "0")) trackers++;
        if (!allowRemote) {
          data.keepAttr = false;
          node.setAttribute?.("data-nv-blocked", "remote");
        }
      }
    }
    if (name === "style" && /url\s*\(/i.test(data.attrValue)) {
      if (/url\s*\(\s*['"]?\s*(https?:)?\/\//i.test(data.attrValue)) remoteCount++;
      if (!allowRemote) data.attrValue = data.attrValue.replace(/url\s*\([^)]*\)/gi, "none");
    }
  });
  purify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A" && node.hasAttribute("href")) {
      const href = node.getAttribute("href");
      if (/^https?:/i.test(href)) {
        node.setAttribute("href", `${extensionUrl("blocked/blocked.html")}?mode=link&url=${encodeURIComponent(href)}`);
        node.setAttribute("title", href);
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      } else if (/^mailto:/i.test(href)) {
        node.setAttribute("target", "_blank");
      } else {
        node.removeAttribute("href");
      }
    }
  });
  const clean = purify.sanitize(html, {
    WHOLE_DOCUMENT: false,
    FORBID_TAGS: ["script", "style", "form", "input", "button", "textarea", "select", "object", "embed", "iframe", "frame", "frameset", "base", "meta", "link", "svg", "math"],
    FORBID_ATTR: ["action", "formaction", "ping"],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ["target"],
  });
  return { html: clean, remoteCount, trackers };
}

/** Build the srcdoc for a scriptless sandboxed iframe with a strict CSP. */
export function emailFrameDoc(bodyHtml, { allowRemote = false, dark = false } = {}) {
  const img = allowRemote ? "data: blob: https: http:" : "data: blob:";
  const csp = `default-src 'none'; img-src ${img}; style-src 'unsafe-inline'; font-src data:; media-src 'none'; form-action 'none'; base-uri 'none'`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="referrer" content="no-referrer">
<style>
  html,body{margin:0;padding:16px;font:14px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:${dark ? "#e6e8ee" : "#1b1f2a"};background:${dark ? "#12151d" : "#fff"};word-wrap:break-word}
  img{max-width:100%;height:auto} a{color:${dark ? "#7fb2ff" : "#1a56db"}} table{max-width:100%!important}
  [data-nv-blocked]{outline:1px dashed #9aa3b5;min-width:16px;min-height:16px;display:inline-block}
  pre{white-space:pre-wrap}
</style></head><body>${bodyHtml}</body></html>`;
}

/** Render plain text e-mail safely (escaped, links linkified via checker). */
export function textToSafeHtml(text) {
  const esc = String(text || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const linked = esc.replace(/https?:\/\/[^\s<]+/g, (m) => {
    const raw = m.replace(/&amp;/g, "&");
    return `<a href="${extensionUrl("blocked/blocked.html")}?mode=link&url=${encodeURIComponent(raw)}" target="_blank" rel="noopener noreferrer" title="${m}">${m}</a>`;
  });
  return `<pre style="font:inherit;white-space:pre-wrap;margin:0">${linked}</pre>`;
}

export { DOMPurify };
