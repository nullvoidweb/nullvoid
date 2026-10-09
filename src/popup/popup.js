import { api, isWebUrl, isRestrictedUrl, extensionUrl } from "../lib/browser.js";
import { updateSettings } from "../lib/settings.js";
import { call } from "../lib/messaging.js";
import { $, h, icon, hydrateIcons, toast, copyText, initTheme, effectiveTheme, levelBadge, activeTab, openPage } from "../lib/ui.js";
import { analyzeUrl } from "../lib/url-analysis.js";
import { registrableDomain, toUnicodeHost } from "../lib/domain.js";
import { secretStatus } from "../lib/vault.js";
import { BROWSERLESS_REGIONS } from "../lib/cdp-client.js";

const PENDING_AI_KEY = "nv.pendingAiPrompt";
let settings, tab;

const METER_COLOR = { safe: "var(--ok)", low: "var(--accent)", suspicious: "var(--warn)", dangerous: "var(--danger)" };

async function init() {
  settings = await initTheme();
  hydrateIcons();
  $("#version").textContent = `v${api.runtime.getManifest().version}`;
  tab = await activeTab();

  renderProtection();
  bindHeader();
  checkPermissions();
  renderSite();
  renderRbi();
  renderEmail();
  renderStats();
  bindTools();
}

function renderProtection() {
  const on = settings.protection.enabled;
  $("#masterToggle").checked = on;
  const status = $("#protectionStatus");
  status.replaceChildren(h("span", { class: `dot ${on ? "ok" : "warn"}` }), h("span", {}, on ? "Protected" : "Protection paused"));
  $("#themeBtn").replaceChildren(icon(effectiveTheme() === "dark" ? "sun" : "moon"));
}

function bindHeader() {
  $("#masterToggle").addEventListener("change", async (e) => {
    settings = await updateSettings({ protection: { enabled: e.target.checked } });
    renderProtection();
    toast(e.target.checked ? "Smart Protection enabled" : "Smart Protection paused", e.target.checked ? "success" : "warn");
  });
  $("#themeBtn").addEventListener("click", async () => {
    const next = effectiveTheme() === "dark" ? "light" : "dark";
    settings = await updateSettings({ ui: { theme: next } });
    renderProtection();
  });
  $("#settingsBtn").addEventListener("click", () => {
    api.runtime.openOptionsPage();
    window.close();
  });
  $("#activityBtn").addEventListener("click", () => {
    api.tabs.create({ url: `${extensionUrl("options/options.html")}#activity` });
    window.close();
  });
  $("#accountBtn").addEventListener("click", toggleAccountMenu);
}

async function checkPermissions() {
  try {
    const ok = await api.permissions.contains({ origins: ["<all_urls>"] });
    $("#permBanner").hidden = ok;
    $("#grantBtn").onclick = async () => {
      const granted = await api.permissions.request({ origins: ["<all_urls>"] });
      $("#permBanner").hidden = granted;
    };
  } catch { /* not applicable */ }
}

// --- Current site -----------------------------------------------------------------

async function renderSite() {
  const card = $("#siteCard");
  if (!tab || !isWebUrl(tab.url) || isRestrictedUrl(tab.url)) {
    $("#siteHost").textContent = tab?.url ? "Browser page" : "No active page";
    $("#siteBadge").replaceChildren(h("span", { class: "badge badge-info" }, "Not applicable"));
    $("#siteSignals").replaceChildren(h("li", {}, "NULL VOID protects regular websites (http/https)."));
    card.querySelector(".site-actions").hidden = true;
    $("#siteStats").hidden = true;
    return;
  }
  const url = new URL(tab.url);
  $("#siteHost").textContent = toUnicodeHost(url.hostname);
  $("#siteHost").title = tab.url;

  let info = null;
  try {
    info = await call("nav:tabInfo", { tabId: tab.id });
  } catch { /* worker asleep */ }
  const analysis = info?.url === tab.url && info.analysis ? info.analysis : analyzeUrl(tab.url);
  const verdictLevel = info?.verdict?.level || analysis.level;
  $("#siteBadge").replaceChildren(levelBadge(verdictLevel, analysis.score ? `· ${analysis.score}` : ""));
  const meter = $("#riskMeter");
  meter.style.width = `${Math.max(4, analysis.score)}%`;
  meter.style.background = METER_COLOR[verdictLevel];

  const list = $("#siteSignals");
  const signals = analysis.signals.filter((s) => s.weight > 0).slice(0, 3);
  list.replaceChildren(...(signals.length
    ? signals.map((s) => h("li", {}, s.message))
    : [h("li", {}, analysis.brand?.legit ? `Official ${analysis.brand.key} domain.` : "No risky patterns in this address.")]));
  if (info?.intel?.length) renderIntel(info.intel);

  const domain = registrableDomain(url.hostname);
  const trusted = settings.protection.trustedSites.some((d) => url.hostname === d || url.hostname.endsWith(`.${d}`));
  $("#trustToggle").checked = trusted;
  $("#trustToggle").onchange = async (e) => {
    await call("protection:setTrusted", { host: url.hostname, trusted: e.target.checked });
    toast(e.target.checked ? `${domain} is trusted — protection off on this site` : `Protection re-enabled on ${domain}`, "success");
    api.tabs.reload(tab.id);
  };

  try {
    const status = await call("protection:status", { tabId: tab.id });
    const m = status.matched || {};
    $("#siteStats").replaceChildren(
      h("span", {}, h("strong", {}, String(m.ads ?? 0)), " ads & trackers blocked"),
      h("span", {}, h("strong", {}, String((m.malware ?? 0) + (m.custom ?? 0))), " threats"),
    );
  } catch {
    $("#siteStats").hidden = true;
  }

  $("#scanBtn").onclick = scanSite;
}

function renderIntel(results) {
  const box = $("#intelResults");
  box.hidden = false;
  box.replaceChildren(...results.map((r) => {
    if (r.service === "error") return h("div", { class: "intel-row" }, h("span", { class: "muted" }, "Lookup failed"), h("span", { class: "tiny truncate" }, r.error));
    const status = r.malicious ? h("span", { class: "badge badge-dangerous" }, "Malicious")
      : r.known === false ? h("span", { class: "badge badge-info" }, "Not seen")
        : h("span", { class: "badge badge-safe" }, "Clean");
    const detail = r.stats ? ` ${r.stats.malicious || 0}/${r.engines} engines` : r.threats?.length ? ` ${r.threats.join(", ")}` : "";
    return h("div", { class: "intel-row" }, h("span", {}, r.service, h("span", { class: "muted" }, detail)), status);
  }));
}

async function scanSite() {
  const btn = $("#scanBtn");
  btn.disabled = true;
  btn.replaceChildren(h("span", { class: "spinner" }), "Scanning");
  try {
    const res = await call("intel:checkUrl", { url: tab.url });
    if (!res.intel.length) {
      const box = $("#intelResults");
      box.hidden = false;
      box.replaceChildren(h("div", { class: "muted" }, "No threat-intel services are set up. ",
        h("a", { href: "#", onclick: (e) => { e.preventDefault(); api.tabs.create({ url: `${extensionUrl("options/options.html")}#intel` }); } }, "Add free API keys"),
        " for Google Safe Browsing, VirusTotal or URLhaus."));
    } else {
      renderIntel(res.intel);
      $("#siteBadge").replaceChildren(levelBadge(res.verdict.level));
    }
  } catch (err) {
    toast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.replaceChildren(icon("shield-check", "icon icon-sm"), "Scan");
  }
}

// --- Disposable browser --------------------------------------------------------------

async function renderRbi() {
  const select = $("#rbiRegion");
  const status = await secretStatus(["rbiToken"]);
  const r = settings.rbi;
  const cloudReady = r.provider === "custom" ? Boolean(r.customEndpoint) : status.rbiToken;
  const opts = [];
  if (r.provider === "browserless") {
    for (const [id, reg] of Object.entries(BROWSERLESS_REGIONS)) opts.push(h("option", { value: id }, `${reg.label}`));
  } else {
    opts.push(h("option", { value: "custom" }, "Custom remote browser"));
  }
  opts.push(h("option", { value: "local", title: "Opens a private window on this device (no remote isolation)" }, "Local private window"));
  select.replaceChildren(...opts);
  select.value = r.mode === "local" || !cloudReady ? "local" : (r.provider === "custom" ? "custom" : r.region);
  $("#rbiHint").textContent = cloudReady
    ? "Pages render in a remote browser — only pixels reach your device."
    : "Remote isolation needs a Browserless token or your own endpoint (Settings). Local private mode works now.";
}

async function launchRbi() {
  const choice = $("#rbiRegion").value;
  if (choice === "local") {
    try {
      const res = await call("rbi:openLocal", { url: settings.rbi.startUrl });
      if (res.mode === "temporary" && !res.incognitoAllowed) toast("Tip: allow NULL VOID in incognito for true private windows.", "info", 5000);
      window.close();
    } catch (err) {
      toast(err.message, "error");
    }
    return;
  }
  if (choice !== "custom") await updateSettings({ rbi: { region: choice, mode: "cloud" } });
  await openPage("rbi/rbi.html", choice !== "custom" ? { region: choice } : undefined);
  window.close();
}

// --- Disposable email ------------------------------------------------------------------

async function renderEmail() {
  let state;
  try {
    state = await call("email:state");
  } catch {
    return;
  }
  const active = state.boxes.find((b) => b.id === state.active);
  $("#emailAddr").value = active?.address || "";
  $("#emailAddr").placeholder = "Click “New” to create an inbox";
  const unread = state.boxes.reduce((n, b) => n + (b.unread || 0), 0);
  $("#unreadBadge").hidden = !unread;
  $("#unreadBadge").textContent = `${unread} unread`;
  const latest = state.latest;
  if (latest?.code && Date.now() - latest.ts < 20 * 60 * 1000) {
    $("#latestCode").hidden = false;
    $("#latestCodeBtn").textContent = latest.code;
    $("#latestCodeBtn").onclick = () => copyText(latest.code, "Code copied");
    $("#latestFrom").textContent = latest.from ? `from ${latest.from}` : "";
  }
}

async function ensureAddress() {
  if ($("#emailAddr").value) return $("#emailAddr").value;
  const box = await call("email:ensure");
  $("#emailAddr").value = box.address;
  return box.address;
}

async function fillEmail() {
  if (!tab || isRestrictedUrl(tab.url)) return toast("Open a regular web page first", "warn");
  try {
    const address = await ensureAddress();
    const [{ result }] = await api.scripting.executeScript({
      target: { tabId: tab.id },
      args: [address],
      func: (addr) => {
        let el = document.activeElement;
        if (!el || el === document.body || !("value" in el || el.isContentEditable)) {
          el = document.querySelector("input[type=email], input[autocomplete~=email], input[name*=mail i], input[id*=mail i]");
        }
        if (!el) return false;
        el.focus();
        if (el.isContentEditable) return document.execCommand("insertText", false, addr);
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, "value").set.call(el, addr);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      },
    });
    if (result) {
      toast("Disposable address inserted", "success");
      setTimeout(() => window.close(), 600);
    } else {
      toast("Click an e-mail field on the page first", "warn");
    }
  } catch (err) {
    toast(err.message, "error");
  }
}

// --- Assistant -----------------------------------------------------------------------

function openAssistant(prompt) {
  if (prompt) api.storage.session.set({ [PENDING_AI_KEY]: { ...prompt, ts: Date.now() } });
  // Must run inside the click gesture, before any await.
  if (api.sidePanel?.open && tab?.windowId != null) {
    api.sidePanel.open({ windowId: tab.windowId }).then(() => window.close(), () => openPage("assistant/assistant.html").then(() => window.close()));
  } else if (api.sidebarAction?.open) {
    api.sidebarAction.open().then(() => window.close(), () => openPage("assistant/assistant.html"));
  } else {
    openPage("assistant/assistant.html").then(() => window.close());
  }
}

function bindTools() {
  $("#rbiLaunch").addEventListener("click", launchRbi);
  $("#emailCopy").addEventListener("click", async () => {
    const addr = $("#emailAddr").value;
    if (addr) copyText(addr, "Address copied");
    else toast("Create an inbox first", "warn");
  });
  $("#emailFill").addEventListener("click", fillEmail);
  $("#emailInbox").addEventListener("click", async () => {
    await openPage("inbox/inbox.html");
    window.close();
  });
  $("#emailNew").addEventListener("click", async () => {
    const btn = $("#emailNew");
    btn.disabled = true;
    try {
      const box = await call("email:create");
      $("#emailAddr").value = box.address;
      toast("New disposable address ready", "success");
      copyText(box.address, "Address copied");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      btn.disabled = false;
    }
  });
  $("#viewerBtn").addEventListener("click", async () => {
    await openPage("viewer/viewer.html");
    window.close();
  });
  $("#assistantBtn").addEventListener("click", () => openAssistant(null));
  $("#askAiSiteBtn").addEventListener("click", () => openAssistant({ kind: "page", tabId: tab?.id, pageUrl: tab?.url }));
}

async function renderStats() {
  try {
    const s = await call("stats:get");
    const threats = (s.heuristicBlocks || 0) + (s.listBlocks || 0) + (s.intelBlocks || 0) + (s.customBlocks || 0);
    const parts = [`${threats} threat${threats === 1 ? "" : "s"} blocked`];
    if (s.downloadsFlagged) parts.push(`${s.downloadsFlagged} risky downloads`);
    if (s.pageWarnings) parts.push(`${s.pageWarnings} phishing warnings`);
    $("#statsLine").textContent = parts.join(" · ");
  } catch { /* ignore */ }
}

// --- Account -------------------------------------------------------------------------

async function toggleAccountMenu() {
  const existing = document.querySelector(".menu");
  if (existing) return existing.remove();
  let state = { signedIn: false };
  try {
    state = await call("auth:state");
  } catch { /* ignore */ }
  const menu = h("div", { class: "card menu", role: "menu" });
  if (state.signedIn) {
    menu.append(
      h("div", { class: "who" }, state.profile?.avatar ? h("img", { src: state.profile.avatar, alt: "" }) : icon("user"),
        h("div", { class: "grow" }, h("div", { class: "truncate" }, state.profile?.name || "Signed in"), h("div", { class: "tiny muted truncate" }, state.profile?.email || ""))),
      h("button", { onclick: () => api.tabs.create({ url: `${state.domain}/profile` }) }, icon("external", "icon icon-sm"), "Manage account"),
      h("button", { onclick: async () => { await call("auth:logout"); menu.remove(); toast("Signed out", "success"); } }, icon("x", "icon icon-sm"), "Sign out"),
    );
  } else {
    menu.append(
      h("div", { class: "who" }, icon("user"), h("div", { class: "small muted" }, "Sign-in is optional. Every feature works without an account.")),
      h("button", {
        onclick: () => {
          const cb = encodeURIComponent(extensionUrl("auth/callback.html"));
          api.tabs.create({ url: `${state.domain || "https://nullvoid.zone.id"}/login?extension=true&callback=${cb}` });
          window.close();
        },
      }, icon("external", "icon icon-sm"), "Sign in to NULL VOID"),
    );
  }
  document.body.appendChild(menu);
  setTimeout(() => document.addEventListener("click", function close(e) {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener("click", close);
    }
  }), 0);
}

init().catch((err) => {
  console.error(err);
  toast(`Failed to load: ${err.message}`, "error");
});
