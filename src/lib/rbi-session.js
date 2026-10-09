// Pixel-streaming remote browser session over CDP.
//
// The page runs in a remote Chromium (Browserless or self-hosted). We stream
// JPEG frames with Page.startScreencast and forward mouse/keyboard input with
// Input.dispatch*. No remote HTML, CSS or JavaScript ever executes locally —
// only images arrive — which is the core property of remote browser isolation.

import { CdpConnection } from "./cdp-client.js";

// Windows virtual-key codes for keys that do not produce text.
const SPECIAL_KEYS = {
  Backspace: 8, Tab: 9, Enter: 13, Shift: 16, Control: 17, Alt: 18, Pause: 19, CapsLock: 20, Escape: 27,
  " ": 32, PageUp: 33, PageDown: 34, End: 35, Home: 36, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40,
  Insert: 45, Delete: 46, Meta: 91, ContextMenu: 93, F1: 112, F2: 113, F3: 114, F4: 115, F5: 116, F6: 117,
  F7: 118, F8: 119, F9: 120, F10: 121, F11: 122, F12: 123,
};

export const REGION_LOCALE = {
  sfo: { timezoneId: "America/Los_Angeles", locale: "en-US" },
  lon: { timezoneId: "Europe/London", locale: "en-GB" },
  ams: { timezoneId: "Europe/Amsterdam", locale: "en-NL" },
};

/** CDP modifier bitmask from a DOM event. */
export function modifiersOf(e) {
  return (e.altKey ? 1 : 0) | (e.ctrlKey ? 2 : 0) | (e.metaKey ? 4 : 0) | (e.shiftKey ? 8 : 0);
}

export function normalizeUrl(input) {
  const s = String(input || "").trim();
  if (!s) return "about:blank";
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) {
    // Only web schemes may be opened remotely.
    if (!/^(https?|about):/i.test(s)) throw new Error("Only http(s) URLs can be opened in the remote browser");
    return s;
  }
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(s) && !/\s/.test(s)) return `https://${s}`;
  return `https://duckduckgo.com/?q=${encodeURIComponent(s)}`;
}

export class RemoteBrowserSession {
  constructor(conn) {
    this.conn = conn;
    this.targetId = null;
    this.sessionId = null;
    this.handlers = new Map();
    this.screencast = { width: 1280, height: 800, quality: 70, running: false };
    this.stats = { frames: 0, bytes: 0, startedAt: Date.now() };
    this.closed = false;
    this.url = "about:blank";
    this.title = "";
  }

  on(event, fn) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(fn);
    return () => this.handlers.get(event)?.delete(fn);
  }

  emit(event, data) {
    for (const fn of this.handlers.get(event) ?? []) {
      try {
        fn(data);
      } catch (err) {
        console.error("[rbi] handler failed", err);
      }
    }
  }

  /**
   * @param {object} opts
   * @param {string} opts.wsUrl browser-level CDP WebSocket URL
   */
  static async start({ wsUrl, width = 1280, height = 800, quality = 70, startUrl = "about:blank", blockDownloads = true, region, WebSocketImpl }) {
    const conn = await CdpConnection.connect(wsUrl, { WebSocketImpl });
    const session = new RemoteBrowserSession(conn);
    try {
      await session.#init({ width, height, quality, startUrl, blockDownloads, region });
    } catch (err) {
      conn.close();
      throw err;
    }
    return session;
  }

  async #init({ width, height, quality, startUrl, blockDownloads, region }) {
    const c = this.conn;
    c.on("__closed", (info) => {
      this.closed = true;
      this.emit("closed", info);
    });

    await c.send("Target.setDiscoverTargets", { discover: true });
    const { targetId } = await c.send("Target.createTarget", { url: "about:blank" });
    this.targetId = targetId;
    const { sessionId } = await c.send("Target.attachToTarget", { targetId, flatten: true });
    this.sessionId = sessionId;
    const s = (method, params) => c.send(method, params, sessionId);

    c.on("Page.screencastFrame", (p, sid) => {
      if (sid !== this.sessionId) return;
      s("Page.screencastFrameAck", { sessionId: p.sessionId }).catch(() => {});
      this.stats.frames++;
      this.stats.bytes += p.data.length * 0.75;
      this.emit("frame", { data: p.data, metadata: p.metadata });
    });
    c.on("Page.frameNavigated", (p, sid) => {
      if (sid !== this.sessionId || p.frame.parentId) return;
      this.url = p.frame.url;
      this.emit("navigated", { url: p.frame.url });
      this.#refreshHistory();
    });
    c.on("Page.navigatedWithinDocument", (p, sid) => {
      if (sid !== this.sessionId) return;
      this.url = p.url;
      this.emit("navigated", { url: p.url });
      this.#refreshHistory();
    });
    c.on("Page.frameStartedLoading", (_p, sid) => sid === this.sessionId && this.emit("loading", { loading: true }));
    c.on("Page.loadEventFired", (_p, sid) => {
      if (sid !== this.sessionId) return;
      this.emit("loading", { loading: false });
      // targetInfoChanged does not always fire for late <title> updates.
      this.send("Runtime.evaluate", { expression: "document.title", returnByValue: true })
        .then((r) => {
          const title = r?.result?.value;
          if (typeof title === "string" && title !== this.title) {
            this.title = title;
            this.emit("title", { title, url: this.url });
          }
        })
        .catch(() => {});
    });
    c.on("Page.frameStoppedLoading", (_p, sid) => sid === this.sessionId && this.emit("loading", { loading: false }));
    c.on("Page.javascriptDialogOpening", (p, sid) => {
      if (sid !== this.sessionId) return;
      this.emit("dialog", { type: p.type, message: p.message, defaultPrompt: p.defaultPrompt, url: p.url });
    });
    c.on("Page.downloadWillBegin", (p) => this.emit("download-blocked", { url: p.url, filename: p.suggestedFilename }));
    c.on("Browser.downloadWillBegin", (p) => this.emit("download-blocked", { url: p.url, filename: p.suggestedFilename }));
    c.on("Target.targetInfoChanged", ({ targetInfo }) => {
      if (targetInfo.targetId === this.targetId) {
        this.title = targetInfo.title;
        this.emit("title", { title: targetInfo.title, url: targetInfo.url });
      } else if (targetInfo.openerId === this.targetId && targetInfo.type === "page" && /^https?:/.test(targetInfo.url)) {
        // Keep the user in one isolated tab: fold popups back into it.
        this.navigate(targetInfo.url).catch(() => {});
        c.send("Target.closeTarget", { targetId: targetInfo.targetId }).catch(() => {});
        this.emit("popup", { url: targetInfo.url });
      }
    });
    c.on("Target.targetCrashed", ({ targetId }) => targetId === this.targetId && this.emit("crashed", {}));
    c.on("Inspector.targetCrashed", (_p, sid) => sid === this.sessionId && this.emit("crashed", {}));

    await s("Page.enable");
    await s("Page.setLifecycleEventsEnabled", { enabled: false }).catch(() => {});
    if (blockDownloads) {
      await c.send("Browser.setDownloadBehavior", { behavior: "deny", eventsEnabled: true }).catch(() =>
        s("Page.setDownloadBehavior", { behavior: "deny" }).catch(() => {}));
    }
    await s("Emulation.setFocusEmulationEnabled", { enabled: true }).catch(() => {});
    const loc = REGION_LOCALE[region];
    if (loc) {
      await s("Emulation.setTimezoneOverride", { timezoneId: loc.timezoneId }).catch(() => {});
      await s("Emulation.setLocaleOverride", { locale: loc.locale }).catch(() => {});
    }
    await this.resize(width, height, quality);
    if (startUrl && startUrl !== "about:blank") await this.navigate(startUrl);
  }

  async #refreshHistory() {
    try {
      const h = await this.conn.send("Page.getNavigationHistory", {}, this.sessionId);
      this.history = h;
      this.emit("history", { canGoBack: h.currentIndex > 0, canGoForward: h.currentIndex < h.entries.length - 1 });
    } catch { /* session gone */ }
  }

  send(method, params = {}) {
    return this.conn.send(method, params, this.sessionId);
  }

  async resize(width, height, quality = this.screencast.quality) {
    width = Math.max(320, Math.min(3840, Math.round(width)));
    height = Math.max(240, Math.min(2160, Math.round(height)));
    this.screencast = { ...this.screencast, width, height, quality };
    await this.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    if (this.screencast.running) await this.send("Page.stopScreencast").catch(() => {});
    await this.send("Page.startScreencast", { format: "jpeg", quality, maxWidth: width, maxHeight: height, everyNthFrame: 1 });
    this.screencast.running = true;
  }

  setQuality(quality) {
    return this.resize(this.screencast.width, this.screencast.height, quality);
  }

  async navigate(input) {
    const url = normalizeUrl(input);
    const res = await this.send("Page.navigate", { url });
    if (res.errorText && res.errorText !== "net::ERR_ABORTED") {
      this.emit("nav-error", { url, error: res.errorText });
    }
    return url;
  }

  async back() {
    const h = await this.send("Page.getNavigationHistory");
    if (h.currentIndex > 0) await this.send("Page.navigateToHistoryEntry", { entryId: h.entries[h.currentIndex - 1].id });
  }

  async forward() {
    const h = await this.send("Page.getNavigationHistory");
    if (h.currentIndex < h.entries.length - 1) await this.send("Page.navigateToHistoryEntry", { entryId: h.entries[h.currentIndex + 1].id });
  }

  reload() {
    return this.send("Page.reload", { ignoreCache: false });
  }

  stop() {
    return this.send("Page.stopLoading");
  }

  mouse(type, x, y, { button = "none", clickCount = 0, modifiers = 0, deltaX = 0, deltaY = 0, buttons = 0 } = {}) {
    const params = { type, x: Math.round(x), y: Math.round(y), modifiers, button, buttons, clickCount };
    if (type === "mouseWheel") Object.assign(params, { deltaX, deltaY });
    return this.send("Input.dispatchMouseEvent", params).catch(() => {});
  }

  /** Forward a DOM KeyboardEvent ("keydown" / "keyup"). */
  key(domType, e) {
    const modifiers = modifiersOf(e);
    const vk = SPECIAL_KEYS[e.key] ?? (e.key.length === 1 ? e.key.toUpperCase().charCodeAt(0) : 0);
    const printable = e.key.length === 1 && !(e.ctrlKey || e.metaKey);
    const base = { key: e.key, code: e.code, modifiers, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, location: e.location || 0, autoRepeat: Boolean(e.repeat) };
    if (domType === "keyup") return this.send("Input.dispatchKeyEvent", { type: "keyUp", ...base }).catch(() => {});
    if (printable) return this.send("Input.dispatchKeyEvent", { type: "keyDown", text: e.key, unmodifiedText: e.key, ...base }).catch(() => {});
    if (e.key === "Enter") return this.send("Input.dispatchKeyEvent", { type: "keyDown", text: "\r", unmodifiedText: "\r", ...base }).catch(() => {});
    return this.send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...base }).catch(() => {});
  }

  insertText(text) {
    return this.send("Input.insertText", { text: String(text).slice(0, 100000) });
  }

  async selectedText() {
    const r = await this.send("Runtime.evaluate", { expression: "String(window.getSelection ? window.getSelection() : '')", returnByValue: true });
    return r?.result?.value || "";
  }

  handleDialog(accept, promptText) {
    return this.send("Page.handleJavaScriptDialog", { accept, promptText });
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    try {
      await this.send("Page.stopScreencast");
    } catch { /* ignore */ }
    try {
      await this.conn.send("Target.closeTarget", { targetId: this.targetId });
    } catch { /* ignore */ }
    this.conn.close();
  }
}
