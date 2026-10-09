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

const LEVEL_SUMMARY = {
  safe: "No risk signals in this address",
  low: "Minor risk signals, likely fine",
  suspicious: "Be careful on this site",
  dangerous: "Likely phishing or malicious",
};

function setVerdict(level, score) {
  $("#siteIcon").dataset.level = level;
  $("#siteIcon").replaceChildren(icon(level === "suspicious" || level === "dangerous" ? "shield-alert" : "shield-check"));
  $("#siteBadge").replaceChildren(levelBadge(level, score ? `· ${score}` : ""));
  const meter = $("#riskMeter");
  meter.style.width = `${Math.max(4, score)}%`;
  meter.style.background = METER_COLOR[level];
  $("#riskMeterWrap").setAttribute("aria-valuenow", String(score));
  $("#riskMeterWrap").setAttribute("aria-valuetext", `${score} out of 100, ${level}`);
}

function doneLoading() {
  $("#siteCard").classList.remove("loading");
  $("#siteCard").removeAttribute("aria-busy");
}

async function renderSite() {
  const card = $("#siteCard");
  if (!tab || !isWebUrl(tab.url) || isRestrictedUrl(tab.url)) {
    $("#siteHost").textContent = tab?.url ? "Browser page" : "No active page";
    $("#siteSummary").textContent = "NULL VOID protects regular websites (http/https).";
    $("#siteIcon").replaceChildren(icon("globe"));
    $("#siteBadge").replaceChildren(h("span", { class: "badge badge-info" }, "Not applicable"));
    card.querySelector(".meter").hidden = true;
    card.querySelector(".site-foot").hidden = true;
    doneLoading();
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
  setVerdict(verdictLevel, analysis.score);
  $("#siteSummary").textContent = analysis.brand?.legit ? `Official ${analysis.brand.key} domain` : LEVEL_SUMMARY[verdictLevel];

  const signals = analysis.signals.filter((s) => s.weight >= 10).slice(0, 2);
  $("#siteSignals").replaceChildren(...signals.map((s) => h("li", {}, icon("alert-triangle", "icon icon-sm"), h("span", {}, s.message))));
  if (info?.intel?.length) renderIntel(info.intel);

  const domain = registrableDomain(url.hostname);
  const trusted = settings.protection.trustedSites.some((d) => url.hostname === d || url.hostname.endsWith(`.${d}`));
  const trustToggle = $("#trustToggle");
  trustToggle.checked = trusted;
  trustToggle.onchange = async (e) => {
    const on = e.target.checked;
    if (on && (verdictLevel === "suspicious" || verdictLevel === "dangerous") &&
        !confirm(`${domain} looks ${verdictLevel}. Trusting it turns off every NULL VOID protection on this site. Continue?`)) {
      e.target.checked = false;
      return;
    }
    await call("protection:setTrusted", { host: url.hostname, trusted: on });
    toast(on ? `${domain} is trusted. Protection is off on this site.` : `Protection re-enabled on ${domain}`, on ? "warn" : "success");
    api.tabs.reload(tab.id);
  };

  doneLoading();
  try {
    const status = await call("protection:status", { tabId: tab.id });
    const m = status.matched || {};
    const threats = (m.malware ?? 0) + (m.custom ?? 0);
    const parts = [h("strong", {}, String(m.ads ?? 0)), ` ad & tracker request${m.ads === 1 ? "" : "s"} blocked on this page`];
    if (threats) parts.push(" · ", h("strong", {}, String(threats)), ` threat${threats === 1 ? "" : "s"}`);
    $("#siteStats").replaceChildren(...parts);
  } catch {
    $("#siteStats").replaceChildren();
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
      setVerdict(res.verdict.level, res.analysis.score);
      $("#siteSummary").textContent = res.verdict.reason;
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
  const pill = $("#rbiStatus");
  if (cloudReady) {
    pill.className = "badge badge-ok";
    pill.textContent = "Isolated";
    pill.title = "Pages render in a remote browser; only pixels reach your device.";
  } else {
    pill.className = "badge badge-info";
    pill.textContent = "Local only";
    pill.title = "Add a Browserless token or your own endpoint in Settings for remote isolation.";
  }
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
    const threats = (s.heuristicBlocks || 0) + (s.listBlocks || 0) + (s.intelBlocks || 0) + (s.customBlocks || 0) + (s.pageWarnings || 0) + (s.downloadsFlagged || 0);
    $("#statsLine").textContent = `${threats.toLocaleString()} threat${threats === 1 ? "" : "s"} stopped · Activity`;
    $("#activityBtn").title = [
      `${(s.heuristicBlocks || 0) + (s.listBlocks || 0) + (s.intelBlocks || 0) + (s.customBlocks || 0)} dangerous sites blocked`,
      `${s.pageWarnings || 0} phishing warnings`,
      `${s.downloadsFlagged || 0} risky downloads`,
    ].join("\n");
  } catch { /* ignore */ }
}

// --- Account -------------------------------------------------------------------------

async function toggleAccountMenu() {
  const existing = document.querySelector(".menu");
  if (existing) {
    existing.remove();
    $("#accountBtn").setAttribute("aria-expanded", "false");
    return;
  }
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
  const trigger = $("#accountBtn");
  const items = [...menu.querySelectorAll("button")];
  items.forEach((b) => b.setAttribute("role", "menuitem"));
  const close = (restoreFocus = true) => {
    menu.remove();
    trigger.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", onDocClick);
    if (restoreFocus) trigger.focus();
  };
  const onDocClick = (e) => {
    if (!menu.contains(e.target) && e.target !== trigger && !trigger.contains(e.target)) close(false);
  };
  menu.addEventListener("keydown", (e) => {
    const i = items.indexOf(document.activeElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    }
  });
  document.body.appendChild(menu);
  trigger.setAttribute("aria-expanded", "true");
  items[0]?.focus();
  setTimeout(() => document.addEventListener("click", onDocClick), 0);
}

init().catch((err) => {
  console.error(err);
  toast(`Failed to load: ${err.message}`, "error");
});
