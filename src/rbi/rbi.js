import { api, extensionUrl } from "../lib/browser.js";
import { updateSettings } from "../lib/settings.js";
import { getSecret } from "../lib/vault.js";
import { call } from "../lib/messaging.js";
import { $, h, icon, hydrateIcons, toast, initTheme, levelBadge, formatBytes, debounce } from "../lib/ui.js";
import { RemoteBrowserSession, normalizeUrl } from "../lib/rbi-session.js";
import { resolveBrowserEndpoint, browserlessEndpoint, BROWSERLESS_REGIONS } from "../lib/cdp-client.js";
import { analyzeUrl } from "../lib/url-analysis.js";
import { logEvent } from "../lib/events.js";

const params = new URLSearchParams(location.search);
let settings, session = null;
let lastMeta = { deviceWidth: 1, deviceHeight: 1 };
let startedAt = 0, lastInput = Date.now();
let timers = [];
let pendingFrame = null, drawing = false;
let pressedButtons = 0;
let ending = false;

const canvas = $("#screen");
const ctx = canvas.getContext("2d", { alpha: false });

// --- Overlay states ---------------------------------------------------------------------

function overlay(...children) {
  $("#overlay").hidden = false;
  $("#overlayCard").replaceChildren(...children);
}

function hideOverlay() {
  $("#overlay").hidden = true;
  canvas.focus();
}

function setupNeeded() {
  overlay(
    icon("monitor", "icon big"),
    h("h2", {}, "Set up remote isolation"),
    h("p", { class: "muted" }, "The Disposable Browser runs websites in a remote Chromium and streams only pixels to you. Connect a provider to start:"),
    h("ol", {},
      h("li", {}, "Create a free account at ", h("a", { href: "https://www.browserless.io/", target: "_blank", rel: "noopener" }, "browserless.io"), " and copy your API token, or run your own CDP browser."),
      h("li", {}, "Paste it in Settings → Disposable Browser."),
      h("li", {}, "Come back and press Launch.")),
    h("div", { class: "row" },
      h("button", { class: "btn btn-primary", onclick: () => api.tabs.create({ url: `${extensionUrl("options/options.html")}#rbi` }) }, icon("settings", "icon icon-sm"), "Open settings"),
      h("button", { class: "btn", onclick: openLocal }, "Use a local private window instead")),
  );
}

function connecting(steps) {
  overlay(
    h("span", { class: "spinner", style: { width: "34px", height: "34px", borderWidth: "3px" } }),
    h("h2", {}, "Starting an isolated browser…"),
    h("div", { class: "steps" }, ...steps.map((s) => h("div", { class: s.done ? "done" : "" }, s.done ? "✓ " : "• ", s.label))),
  );
}

function ended(reason) {
  const secs = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
  overlay(
    icon("shield-check", "icon big"),
    h("h2", {}, "Session ended"),
    h("p", { class: "muted" }, reason || "The remote browser and everything in it (cookies, storage, downloads) has been destroyed."),
    startedAt ? h("div", { class: "summary" },
      h("div", {}, h("strong", {}, `${Math.floor(secs / 60)}m ${secs % 60}s`), h("span", { class: "tiny muted" }, "duration")),
      h("div", {}, h("strong", {}, String(session?.stats.frames ?? 0)), h("span", { class: "tiny muted" }, "frames")),
      h("div", {}, h("strong", {}, formatBytes(session?.stats.bytes ?? 0)), h("span", { class: "tiny muted" }, "streamed"))) : null,
    h("div", { class: "row" },
      h("button", { class: "btn btn-primary", onclick: () => location.reload() }, icon("refresh", "icon icon-sm"), "New session"),
      h("button", { class: "btn", onclick: () => window.close() }, "Close tab")),
  );
}

function failed(message) {
  overlay(
    icon("shield-alert", "icon big"),
    h("h2", {}, "Could not start the remote browser"),
    h("p", { class: "muted" }, message),
    h("div", { class: "row" },
      h("button", { class: "btn btn-primary", onclick: () => location.reload() }, icon("refresh", "icon icon-sm"), "Retry"),
      h("button", { class: "btn", onclick: () => api.tabs.create({ url: `${extensionUrl("options/options.html")}#rbi` }) }, "Check settings"),
      h("button", { class: "btn btn-ghost", onclick: openLocal }, "Local private window")),
  );
}

async function openLocal() {
  try {
    await call("rbi:openLocal", { url: params.get("url") || settings.rbi.startUrl });
    window.close();
  } catch (err) {
    toast(err.message, "error");
  }
}

// --- Session ---------------------------------------------------------------------------

async function endpoint() {
  const r = settings.rbi;
  if (r.provider === "custom") {
    if (!r.customEndpoint) return null;
    return resolveBrowserEndpoint(r.customEndpoint);
  }
  const token = await getSecret("rbiToken");
  if (!token) return null;
  return browserlessEndpoint({ region: params.get("region") || r.region, token, timeoutMs: r.maxSessionMinutes * 60000 + 30000, blockAds: r.blockAds, stealth: r.stealth });
}

function viewportSize() {
  const rect = $("#stage").getBoundingClientRect();
  return { width: Math.max(320, Math.floor(rect.width)), height: Math.max(240, Math.floor(rect.height)) };
}

function sizeCanvas() {
  const { width, height } = viewportSize();
  canvas.width = width;
  canvas.height = height;
}

async function start() {
  const region = params.get("region") || settings.rbi.region;
  const regionInfo = settings.rbi.provider === "custom" ? { label: "Custom endpoint", code: "CDP" } : BROWSERLESS_REGIONS[region] || BROWSERLESS_REGIONS.sfo;
  $("#regionLabel").textContent = regionInfo.label;
  $("#regionPill").title = `Remote browser region: ${regionInfo.code}`;
  $("#quality").value = String([40, 60, 75, 90].reduce((a, b) => (Math.abs(b - settings.rbi.quality) < Math.abs(a - settings.rbi.quality) ? b : a)));

  const steps = [{ label: "Resolving endpoint" }, { label: "Connecting to the remote browser" }, { label: "Creating an isolated tab" }];
  connecting(steps);
  let ws;
  try {
    ws = await endpoint();
  } catch (err) {
    return failed(err.message);
  }
  if (!ws) return setupNeeded();
  steps[0].done = true;
  connecting(steps);

  sizeCanvas();
  const { width, height } = viewportSize();
  const startUrl = params.get("url") || settings.rbi.startUrl;
  try {
    session = await RemoteBrowserSession.start({
      wsUrl: ws, width, height, quality: Number($("#quality").value), startUrl,
      blockDownloads: settings.rbi.blockDownloads, region: settings.rbi.provider === "browserless" ? region : undefined,
    });
  } catch (err) {
    return failed(err.message);
  }
  startedAt = Date.now();
  wireSession();
  hideOverlay();
  $("#connDot").className = "dot ok";
  logEvent({ type: "rbi-session", severity: "info", title: `Started an isolated browser session (${regionInfo.label})`, url: startUrl });
  startTimers();
}

function wireSession() {
  session.on("frame", ({ data, metadata }) => {
    lastMeta = metadata;
    pendingFrame = data;
    if (!drawing) drawLoop();
  });
  session.on("navigated", ({ url }) => setUrl(url));
  session.on("title", ({ title }) => { document.title = `${title || "New tab"} — NULL VOID Disposable Browser`; });
  session.on("loading", ({ loading }) => {
    const p = $("#progress");
    p.className = `progress ${loading ? "loading" : "done"}`;
  });
  session.on("history", ({ canGoBack, canGoForward }) => {
    $("#back").disabled = !canGoBack;
    $("#forward").disabled = !canGoForward;
  });
  session.on("dialog", showJsDialog);
  session.on("download-blocked", ({ filename }) => toast(`Blocked a download${filename ? ` (${filename})` : ""} inside the remote browser`, "warn"));
  session.on("popup", () => toast("A pop-up window was opened in this tab", "info", 2500));
  session.on("nav-error", ({ error }) => toast(`Could not load page: ${error}`, "error"));
  session.on("crashed", () => toast("The remote page crashed. Reload to continue.", "error"));
  session.on("closed", () => {
    if (ending) return;
    stopTimers();
    $("#connDot").className = "dot danger";
    ended("The remote browser closed the connection. Everything in the session was destroyed.");
  });
}

async function drawLoop() {
  drawing = true;
  while (pendingFrame) {
    const data = pendingFrame;
    pendingFrame = null;
    try {
      const bin = atob(data);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const bmp = await createImageBitmap(new Blob([bytes], { type: "image/jpeg" }));
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      bmp.close?.();
    } catch { /* skip corrupt frame */ }
  }
  drawing = false;
}

function setUrl(url) {
  if (document.activeElement !== $("#url")) $("#url").value = url === "about:blank" ? "" : url;
  const iconEl = $("#urlIcon");
  const secure = url.startsWith("https:");
  iconEl.className = `url-icon ${secure ? "secure" : url.startsWith("http:") ? "insecure" : ""}`;
  iconEl.replaceChildren(icon(secure ? "lock" : "unlock", "icon icon-sm"));
  iconEl.title = secure ? "Encrypted connection (inside the remote browser)" : "Not encrypted";
  const risk = /^https?:/.test(url) ? analyzeUrl(url) : null;
  $("#urlRisk").replaceChildren(risk && risk.level !== "safe" ? levelBadge(risk.level) : "");
}

// --- Input -----------------------------------------------------------------------------

function toRemote(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * lastMeta.deviceWidth,
    y: ((e.clientY - rect.top) / rect.height) * lastMeta.deviceHeight,
  };
}

const BUTTONS = ["left", "middle", "right"];
const MODS = (e) => (e.altKey ? 1 : 0) | (e.ctrlKey ? 2 : 0) | (e.metaKey ? 4 : 0) | (e.shiftKey ? 8 : 0);
let lastMove = 0;

function bindInput() {
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("mousedown", (e) => {
    if (!session) return;
    canvas.focus();
    lastInput = Date.now();
    pressedButtons = e.buttons;
    const { x, y } = toRemote(e);
    session.mouse("mousePressed", x, y, { button: BUTTONS[e.button] || "left", clickCount: e.detail || 1, modifiers: MODS(e), buttons: e.buttons });
    e.preventDefault();
  });
  window.addEventListener("mouseup", (e) => {
    if (!session || !pressedButtons) return;
    pressedButtons = e.buttons;
    const { x, y } = toRemote(e);
    session.mouse("mouseReleased", x, y, { button: BUTTONS[e.button] || "left", clickCount: e.detail || 1, modifiers: MODS(e), buttons: e.buttons });
  });
  canvas.addEventListener("mousemove", (e) => {
    if (!session) return;
    const now = performance.now();
    if (now - lastMove < 16 && !e.buttons) return; // ~60 Hz cap for hover moves
    lastMove = now;
    const { x, y } = toRemote(e);
    session.mouse("mouseMoved", x, y, { button: e.buttons ? BUTTONS[[1, 4, 2].indexOf(e.buttons & 7)] || "left" : "none", modifiers: MODS(e), buttons: e.buttons });
  });
  canvas.addEventListener("wheel", (e) => {
    if (!session) return;
    e.preventDefault();
    lastInput = Date.now();
    const { x, y } = toRemote(e);
    const k = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 400 : 1;
    session.mouse("mouseWheel", x, y, { deltaX: e.deltaX * k, deltaY: e.deltaY * k, modifiers: MODS(e) });
  }, { passive: false });

  canvas.addEventListener("keydown", async (e) => {
    if (!session) return;
    lastInput = Date.now();
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "v") return; // handled by the paste event
    if (mod && e.key.toLowerCase() === "c") {
      e.preventDefault();
      const text = await session.selectedText().catch(() => "");
      if (text) {
        await navigator.clipboard.writeText(text).catch(() => {});
        toast("Copied from the remote page", "success", 1500);
      }
      return;
    }
    if (mod && e.key.toLowerCase() === "l") {
      e.preventDefault();
      $("#url").focus();
      $("#url").select();
      return;
    }
    if (e.key === "F5" || (mod && e.key.toLowerCase() === "r")) {
      e.preventDefault();
      session.reload();
      return;
    }
    if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); session.back(); return; }
    if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); session.forward(); return; }
    if (e.key === "F11" || e.key === "F12") return; // let the browser handle these
    e.preventDefault();
    session.key("keydown", e);
  });
  canvas.addEventListener("keyup", (e) => {
    if (!session) return;
    e.preventDefault();
    session.key("keyup", e);
  });
  window.addEventListener("paste", (e) => {
    if (!session || document.activeElement !== canvas) return;
    const text = e.clipboardData?.getData("text/plain");
    if (text) {
      e.preventDefault();
      session.insertText(text);
      lastInput = Date.now();
    }
  });
}

function bindChrome() {
  $("#urlForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!session) return;
    const raw = $("#url").value;
    try {
      const url = normalizeUrl(raw);
      const risk = /^https?:/.test(url) ? analyzeUrl(url) : null;
      if (risk?.level === "dangerous") toast(`Heads-up: ${risk.host} looks dangerous. It's isolated here, but don't enter real credentials.`, "warn", 6000);
      await session.navigate(url);
      canvas.focus();
    } catch (err) {
      toast(err.message, "error");
    }
  });
  $("#url").addEventListener("focus", () => $("#url").select());
  $("#back").addEventListener("click", () => session?.back());
  $("#forward").addEventListener("click", () => session?.forward());
  $("#reload").addEventListener("click", () => session?.reload());
  $("#quality").addEventListener("change", async (e) => {
    const q = Number(e.target.value);
    await session?.setQuality(q);
    updateSettings({ rbi: { quality: q } });
  });
  $("#fullscreen").addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else $("#stage").requestFullscreen().catch(() => {});
  });
  $("#end").addEventListener("click", endSession);

  const onResize = debounce(async () => {
    sizeCanvas();
    if (session && !session.closed) {
      const { width, height } = viewportSize();
      await session.resize(width, height).catch(() => {});
    }
  }, 250);
  new ResizeObserver(onResize).observe($("#stage"));

  document.addEventListener("visibilitychange", async () => {
    if (!session || session.closed) return;
    // Pause streaming while the tab is hidden to save bandwidth.
    if (document.hidden) await session.send("Page.stopScreencast").catch(() => {});
    else await session.resize(canvas.width, canvas.height).catch(() => {});
  });
  window.addEventListener("beforeunload", () => session?.close());
}

async function endSession(reason) {
  ending = true;
  stopTimers();
  if (session) await session.close();
  $("#connDot").className = "dot";
  ended(typeof reason === "string" ? reason : undefined);
}

function showJsDialog({ type, message, defaultPrompt }) {
  const dlg = $("#jsDialog");
  $("#jsDialogTitle").textContent = type === "beforeunload" ? "Leave this page?" : "The remote page says";
  $("#jsDialogMsg").textContent = message;
  const input = $("#jsDialogInput");
  input.hidden = type !== "prompt";
  input.value = defaultPrompt || "";
  $("#jsCancel").hidden = type === "alert";
  const finish = (accept) => {
    dlg.close();
    session?.handleDialog(accept, input.value).catch(() => {});
    canvas.focus();
  };
  $("#jsOk").onclick = () => finish(true);
  $("#jsCancel").onclick = () => finish(false);
  dlg.oncancel = (e) => { e.preventDefault(); finish(false); };
  dlg.showModal();
  if (type === "prompt") input.focus();
}

// --- Timers & stats -----------------------------------------------------------------------

function startTimers() {
  let lastFrames = 0, lastBytes = 0;
  const maxMs = settings.rbi.maxSessionMinutes * 60000;
  const idleMs = settings.rbi.idleMinutes * 60000;
  timers.push(setInterval(() => {
    if (!session) return;
    const fps = session.stats.frames - lastFrames;
    const kbs = (session.conn.bytesIn - lastBytes) / 1024;
    lastFrames = session.stats.frames;
    lastBytes = session.conn.bytesIn;
    $("#stats").textContent = `${fps} fps · ${kbs < 1024 ? `${kbs.toFixed(0)} KB/s` : `${(kbs / 1024).toFixed(1)} MB/s`}`;
    const left = Math.max(0, maxMs - (Date.now() - startedAt));
    $("#timer span").textContent = `${String(Math.floor(left / 60000)).padStart(2, "0")}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`;
    if (left <= 0) endSession("The maximum session length was reached, so the remote browser was destroyed.");
    else if (Date.now() - lastInput > idleMs && !document.hidden) endSession(`No activity for ${settings.rbi.idleMinutes} minutes, so the remote browser was destroyed.`);
  }, 1000));
}

function stopTimers() {
  timers.forEach(clearInterval);
  timers = [];
}

async function init() {
  settings = await initTheme();
  hydrateIcons();
  bindInput();
  bindChrome();
  if (params.get("url")) setUrl(params.get("url"));
  await start();
}

init().catch((err) => {
  console.error(err);
  failed(err.message);
});
