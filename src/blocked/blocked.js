// Interstitial / link checker / download review.
import { api, extensionUrl, isWebUrl } from "../lib/browser.js";
import { call } from "../lib/messaging.js";
import { $, h, icon, hydrateIcons, toast, copyText, initTheme, formatBytes, levelBadge } from "../lib/ui.js";
import { analyzeUrl } from "../lib/url-analysis.js";

const params = new URLSearchParams(location.search);
const mode = params.get("mode") || "list";

const LIST_NAMES = { malware: "malware & phishing blocklist", custom: "your personal blocklist", ads: "ad & tracker list" };

function setState(state) {
  document.body.className = `state-${state}`;
  const name = { danger: "shield-alert", warn: "shield-alert", safe: "shield-check", neutral: "shield" }[state];
  $("#shield").replaceChildren(icon(name, "icon icon-xl"));
}

function setTarget(url) {
  if (!url) return;
  $("#target").hidden = false;
  $("#targetUrl").textContent = url;
}

function reasons(list) {
  $("#details").replaceChildren(...list.map((r) => h("div", { class: "reason" }, h("span", { class: `badge badge-${r.level || "high"}` }, r.tag || "Risk"), h("span", {}, r.message))));
}

function button(label, cls, onclick, iconName) {
  return h("button", { class: `btn ${cls}`, onclick }, iconName ? icon(iconName, "icon icon-sm") : null, label);
}

async function goBack() {
  if (history.length > 1) {
    history.back();
    setTimeout(async () => {
      const t = await api.tabs.getCurrent();
      if (t) api.tabs.remove(t.id);
    }, 400);
  } else {
    const t = await api.tabs.getCurrent();
    if (t) api.tabs.remove(t.id);
    else window.close();
  }
}

function openIsolated(url) {
  location.href = `${extensionUrl("rbi/rbi.html")}?url=${encodeURIComponent(url)}`;
}

async function proceed(url) {
  if (!confirm(`Open ${new URL(url).hostname} anyway?\n\nNULL VOID will allow this site until you restart the browser.`)) return;
  await call("protection:proceed", { url });
}

function intelLines(intel) {
  if (!intel?.length) return null;
  return h("div", { class: "intel-grid" }, ...intel.map((r) => {
    if (r.service === "error") return h("div", { class: "intel-line" }, h("span", {}, "Lookup failed"), h("span", { class: "muted small" }, r.error));
    const right = r.malicious ? h("span", { class: "badge badge-dangerous" }, "Malicious")
      : r.known === false ? h("span", { class: "badge badge-info" }, "No record") : h("span", { class: "badge badge-safe" }, "No threats");
    const extra = r.stats ? `${r.stats.malicious || 0} of ${r.engines} engines flag it` : r.threats?.length ? r.threats.join(", ") : r.urlCount ? `${r.urlCount} malware URLs on this host` : "";
    return h("div", { class: "intel-line" }, h("div", {}, h("strong", {}, r.service), extra ? h("div", { class: "muted small" }, extra) : null,
      r.link ? h("a", { href: r.link, target: "_blank", rel: "noopener noreferrer", class: "small" }, "View report") : null), right);
  }));
}

function analysisReasons(analysis) {
  return analysis.signals.filter((s) => s.weight > 0).map((s) => ({
    level: s.weight >= 40 ? "dangerous" : s.weight >= 15 ? "suspicious" : "low",
    tag: s.weight >= 40 ? "High" : s.weight >= 15 ? "Medium" : "Low",
    message: s.message,
  }));
}

async function renderBlock() {
  let url = params.get("url");
  if (!url) {
    try {
      url = await call("nav:blockedUrl");
    } catch { /* unknown */ }
  }
  setTarget(url);
  const analysis = url && isWebUrl(url) ? analyzeUrl(url) : null;

  if (mode === "list") {
    setState("danger");
    const list = LIST_NAMES[params.get("list")] || LIST_NAMES.malware;
    $("#title").textContent = "Dangerous site blocked";
    $("#lead").textContent = `${url ? new URL(url).hostname : "This site"} is on NULL VOID's ${list}. It is known to host malware, phishing or scams, so NULL VOID stopped the page before it loaded.`;
    if (analysis) reasons(analysisReasons(analysis));
  } else if (mode === "heuristic") {
    setState("danger");
    $("#title").textContent = analysis?.brand && !analysis.brand.legit ? `Possible fake ${analysis.brand.key} site` : "Deceptive site ahead";
    $("#lead").textContent = "This address looks designed to trick you — for example by imitating a well-known brand. Sites like this commonly steal passwords or payment details.";
    if (analysis) reasons(analysisReasons(analysis));
    if (analysis?.brand && !analysis.brand.legit) {
      $("#details").prepend(h("div", { class: "reason" }, h("span", { class: "badge badge-safe" }, "Real site"),
        h("span", {}, `The official ${analysis.brand.key} website is `, h("strong", {}, analysis.brand.official), ".")));
    }
  } else if (mode === "intel") {
    setState("danger");
    $("#title").textContent = "Threat intelligence flagged this site";
    $("#lead").textContent = "One or more security services you enabled report this address as malicious.";
    try {
      const res = await call("intel:checkUrl", { url });
      $("#details").replaceChildren(intelLines(res.intel) || h("p", { class: "muted" }, "No details available."));
    } catch (err) {
      $("#details").replaceChildren(h("p", { class: "muted" }, err.message));
    }
  }

  const actions = [button("Go back to safety", "btn-primary btn-lg", goBack, "arrow-left"), h("span", { class: "spacer" })];
  if (url && isWebUrl(url)) {
    actions.push(button("Open in Disposable Browser", "", () => openIsolated(url), "monitor"));
    actions.push(button("Proceed anyway", "btn-ghost", () => proceed(url).catch((e) => toast(e.message, "error"))));
  }
  $("#actions").replaceChildren(...actions);
  if (analysis) showTech({ analysis });
}

async function renderLink() {
  const url = params.get("url");
  setTarget(url);
  if (!url || !isWebUrl(url)) {
    setState("warn");
    $("#title").textContent = "Unsupported link";
    $("#lead").textContent = "Only http(s) links can be checked.";
    return;
  }
  $("#eyebrow").textContent = "NULL VOID Link Check";
  setState("neutral");
  $("#title").textContent = "Checking link…";
  $("#lead").replaceChildren(h("span", { class: "spinner" }), " Analysing the address and querying your enabled threat-intel services.");
  let res;
  try {
    res = await call("intel:checkUrl", { url });
  } catch {
    res = { analysis: analyzeUrl(url), intel: [], verdict: { level: analyzeUrl(url).level } };
  }
  const level = res.verdict.level;
  const host = new URL(url).hostname;
  const titles = { safe: "No problems found", low: "Probably safe", suspicious: "This link looks suspicious", dangerous: "Dangerous link" };
  setState(level === "dangerous" ? "danger" : level === "suspicious" ? "warn" : "safe");
  $("#title").replaceChildren(titles[level], " ", levelBadge(level));
  $("#lead").textContent = level === "safe" || level === "low"
    ? `${host} shows no known risk signals${res.intel.length ? " and no enabled service flags it" : ""}.`
    : `NULL VOID found warning signs for ${host}. Opening it in the Disposable Browser keeps your device and accounts out of reach.`;
  const det = analysisReasons(res.analysis);
  $("#details").replaceChildren(...det.map((r) => h("div", { class: "reason" }, h("span", { class: `badge badge-${r.level}` }, r.tag), h("span", {}, r.message))));
  const intel = intelLines(res.intel);
  if (intel) $("#details").append(intel);
  else $("#details").append(h("p", { class: "muted small" }, "Tip: add free Google Safe Browsing / VirusTotal / URLhaus keys in Settings for online reputation checks."));

  const risky = level === "dangerous" || level === "suspicious";
  $("#actions").replaceChildren(
    button("Open in Disposable Browser", risky ? "btn-primary" : "", () => openIsolated(url), "monitor"),
    button(risky ? "Open anyway" : "Open link", risky ? "btn-ghost" : "btn-primary", () => {
      if (risky && !confirm("This link looks risky. Open it in a normal tab anyway?")) return;
      location.replace(url);
    }, "external"),
    h("span", { class: "spacer" }),
    button("Copy link", "btn-ghost", () => copyText(url, "Link copied"), "copy"),
  );
  showTech(res);
}

async function renderDownload() {
  const id = params.get("id");
  $("#eyebrow").textContent = "NULL VOID Download Guard";
  let v;
  try {
    v = await call("downloads:review", { id });
  } catch (err) {
    v = null;
    toast(err.message, "error");
  }
  if (!v) {
    setState("neutral");
    $("#title").textContent = "Nothing to review";
    $("#lead").textContent = "This download was already handled.";
    $("#actions").replaceChildren(button("Close", "btn-primary", () => window.close()));
    return;
  }
  setState(v.score >= 70 ? "danger" : "warn");
  $("#title").textContent = "Risky download paused";
  $("#lead").textContent = "NULL VOID paused this download because it could harm your computer. Keep it only if you trust where it came from.";
  setTarget(v.source);
  $("#details").replaceChildren(
    h("dl", { class: "kv" },
      h("dt", {}, "File"), h("dd", {}, h("strong", {}, v.name)),
      h("dt", {}, "Size"), h("dd", {}, v.size ? formatBytes(v.size) : "unknown"),
      h("dt", {}, "Type"), h("dd", {}, v.mime || "unknown"),
      h("dt", {}, "Risk score"), h("dd", {}, `${v.score}/100`)),
    ...v.reasons.map((r) => h("div", { class: "reason" }, h("span", { class: `badge badge-${r.severity}` }, r.severity), h("span", {}, r.message))),
  );
  const decide = async (keep) => {
    if (keep && !confirm(`Keep "${v.name}"? Only open it if you are certain it is safe.`)) return;
    await call("downloads:decide", { id, keep });
    toast(keep ? "Download resumed" : "Download deleted", keep ? "warn" : "success");
    setTimeout(() => window.close(), 700);
  };
  $("#actions").replaceChildren(
    button("Delete file", "btn-primary btn-lg", () => decide(false), "trash"),
    h("span", { class: "spacer" }),
    button("Keep anyway", "btn-ghost", () => decide(true)),
  );
}

function showTech(data) {
  $("#more").hidden = false;
  $("#moreBody").replaceChildren(h("pre", {}, JSON.stringify(data, null, 2)));
}

async function init() {
  // Refuse to run inside a frame (clickjacking protection for "proceed").
  if (window.top !== window) {
    document.body.textContent = "";
    return;
  }
  await initTheme();
  hydrateIcons();
  if (mode === "link") await renderLink();
  else if (mode === "download") await renderDownload();
  else await renderBlock();
}

init().catch((err) => {
  console.error(err);
  toast(err.message, "error");
});
