// NULL VOID page guard (content script, classic script — no imports).
// 1. Cosmetic filtering: hides empty ad containers left behind after the
//    network ruleset blocked the ad itself.
// 2. Credential-phishing checks: when a page shows a password field, report
//    form targets and brand claims to the service worker, which combines them
//    with URL heuristics and decides whether to warn.
(() => {
  if (window.top !== window || window.__nullvoidGuard) return;
  window.__nullvoidGuard = true;
  const api = globalThis.browser ?? globalThis.chrome;

  const COSMETIC_SELECTORS = [
    "ins.adsbygoogle", ".adsbygoogle", "[id^='google_ads_iframe']", "[id^='div-gpt-ad']", "[data-google-query-id]",
    "[data-ad-slot]", "[data-ad-unit]", "[data-adunit]", "amp-ad", "amp-embed[type='taboola']",
    "iframe[src*='doubleclick.net']", "iframe[src*='googlesyndication.com']", "iframe[id^='google_ads']",
    "[id^='taboola-']", ".trc_related_container", ".OUTBRAIN", "[data-widget-id^='outbrain']",
    "div[aria-label='Advertisement']", "div[aria-label='advertisement']", "[id^='ezoic-pub-ad']", ".ezoic-ad",
  ];

  const BRAND_PATTERNS = [
    ["paypal", /\bpaypal\b/i], ["microsoft", /\b(microsoft|office ?365|outlook|onedrive|sharepoint)\b/i],
    ["apple", /\b(apple ?id|icloud)\b/i], ["google", /\b(google|gmail)\b/i], ["amazon", /\bamazon\b/i],
    ["netflix", /\bnetflix\b/i], ["facebook", /\b(facebook|meta)\b/i], ["instagram", /\binstagram\b/i],
    ["chase", /\bchase\b/i], ["bankofamerica", /\bbank of america\b/i], ["wellsfargo", /\bwells ?fargo\b/i],
    ["coinbase", /\bcoinbase\b/i], ["binance", /\bbinance\b/i], ["metamask", /\bmetamask\b/i],
    ["dhl", /\bdhl\b/i], ["docusign", /\bdocusign\b/i], ["adobe", /\badobe\b/i], ["dropbox", /\bdropbox\b/i],
    ["linkedin", /\blinkedin\b/i], ["steam", /\bsteam\b/i], ["whatsapp", /\bwhatsapp\b/i],
  ];

  let settings = null;
  let trusted = false;
  let warned = false;
  let scans = 0;

  function hostTrusted(list) {
    const h = location.hostname.toLowerCase();
    return (list || []).some((d) => h === d || h.endsWith(`.${d}`));
  }

  function applyCosmetic() {
    if (document.getElementById("nullvoid-cosmetic")) return;
    const style = document.createElement("style");
    style.id = "nullvoid-cosmetic";
    style.textContent = `${COSMETIC_SELECTORS.join(",\n")} { display: none !important; }`;
    (document.head || document.documentElement).appendChild(style);
  }

  function detectBrand() {
    const sample = [
      document.title,
      ...[...document.querySelectorAll("img[alt], [aria-label]")].slice(0, 30).map((e) => e.getAttribute("alt") || e.getAttribute("aria-label")),
      ...[...document.querySelectorAll("h1, h2, form label, form button")].slice(0, 20).map((e) => e.textContent),
    ].join(" ").slice(0, 4000);
    for (const [key, re] of BRAND_PATTERNS) if (re.test(sample)) return key;
    return null;
  }

  function collect() {
    const pw = [...document.querySelectorAll("input[type='password']")].filter((i) => i.offsetParent !== null || i.getClientRects().length);
    if (!pw.length) return null;
    const forms = new Set(pw.map((i) => i.form).filter(Boolean));
    const formTargets = [];
    let dataUriForm = false;
    for (const f of forms) {
      const action = f.getAttribute("action");
      if (!action) continue;
      if (/^\s*(data|javascript):/i.test(action)) dataUriForm = true;
      else formTargets.push(new URL(action, location.href).href);
    }
    return { hasPassword: true, formTargets, dataUriForm, brand: detectBrand() };
  }

  async function scan() {
    if (warned || trusted || scans > 6) return;
    scans++;
    const report = collect();
    if (!report) return;
    try {
      const res = await api.runtime.sendMessage({ action: "page:report", payload: report });
      if (res?.ok && res.data?.warn) showWarning(res.data);
    } catch { /* extension reloaded */ }
  }

  function showWarning({ reasons = [], score }) {
    if (warned) return;
    warned = true;
    const host = document.createElement("nullvoid-guard");
    host.style.cssText = "all: initial; position: fixed; inset: 0 0 auto 0; z-index: 2147483647;";
    const root = host.attachShadow({ mode: "closed" });
    const danger = score >= 70;
    const el = (tag, cls, text) => {
      const node = document.createElement(tag);
      if (cls) node.className = cls;
      if (text) node.textContent = text;
      return node;
    };
    const style = el("style");
    style.textContent = `
        :host { all: initial; }
        .bar { font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #fff;
          background: ${danger ? "linear-gradient(90deg,#b4232c,#d9363e)" : "linear-gradient(90deg,#9a5b00,#c47a07)"};
          padding: 12px 16px; display: flex; gap: 14px; align-items: flex-start; box-shadow: 0 4px 18px rgba(0,0,0,.35); }
        .icon { font-size: 22px; line-height: 1; }
        .body { flex: 1; min-width: 0; }
        strong { font-size: 15px; display: block; margin-bottom: 2px; }
        ul { margin: 4px 0 0; padding-left: 18px; }
        li { margin: 1px 0; }
        .actions { display: flex; gap: 8px; flex-shrink: 0; }
        button { font: inherit; font-weight: 600; border-radius: 8px; padding: 7px 12px; cursor: pointer; border: 1px solid rgba(255,255,255,.6); }
        .leave { background: #fff; color: #8f1d24; border-color: #fff; }
        .dismiss { background: transparent; color: #fff; }
        @media (max-width: 640px) { .bar { flex-direction: column; } }`;
    const bar = el("div", "bar");
    bar.setAttribute("role", "alert");
    const body = el("div", "body");
    const ul = el("ul");
    for (const r of reasons) ul.appendChild(el("li", null, r));
    body.append(
      el("strong", null, "NULL VOID: this page may be trying to steal your password"),
      el("span", null, "Don't enter credentials unless you are sure this is the real site."),
      ul,
    );
    const leave = el("button", "leave", "Leave site");
    const dismiss = el("button", "dismiss", "Dismiss");
    const actions = el("div", "actions");
    actions.append(leave, dismiss);
    bar.append(el("div", "icon", "⚠"), body, actions);
    root.append(style, bar);
    leave.addEventListener("click", () => {
      if (history.length > 1) history.back();
      else location.replace("about:blank");
    });
    dismiss.addEventListener("click", () => host.remove());
    document.documentElement.appendChild(host);
  }

  async function init() {
    const stored = await api.storage.local.get("nv.settings");
    settings = stored["nv.settings"];
    const p = settings?.protection ?? { enabled: true, cosmetic: true, contentScan: true, trustedSites: [] };
    trusted = hostTrusted(p.trustedSites);
    if (!p.enabled || trusted) return;
    if (p.cosmetic && p.ads !== false) applyCosmetic();
    if (p.contentScan === false) return;
    scan();
    let timer = null;
    const mo = new MutationObserver(() => {
      if (warned || scans > 6) return mo.disconnect();
      clearTimeout(timer);
      timer = setTimeout(scan, 800);
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 60000);
  }

  init().catch(() => {});
})();
