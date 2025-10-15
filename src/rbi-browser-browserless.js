// NULL VOID Remote Browser Isolation - Minimal Browserless.io integration
// Provides secure remote rendering with a stripped-down brand-forward UI.

console.log("NULL VOID Browserless.io RBI (minimal) loading...");

const browserAPI = typeof browser !== "undefined" ? browser : chrome;

const DEFAULT_BROWSERLESS_SETTINGS = {
  apiKey: "",
  baseUrl: "https://production-sfo.browserless.io",
  wsUrl: "wss://production-sfo.browserless.io",
  endpoints: {
    screenshot: "/screenshot",
    version: "/json/version",
  },
  gotoOptions: {
    waitUntil: "networkidle2",
    timeout: 30000,
  },
  screenshotOptions: {
    type: "png",
    quality: 90,
    fullPage: false,
  },
};

let BROWSERLESS_API_KEY = DEFAULT_BROWSERLESS_SETTINGS.apiKey;
let BROWSERLESS_BASE_URL = DEFAULT_BROWSERLESS_SETTINGS.baseUrl;
let BROWSERLESS_WS_URL = DEFAULT_BROWSERLESS_SETTINGS.wsUrl;

let browserlessConfigResolved = null;
let browserlessConfigCache = null;

let isApiConnected = false;
let isAuthFailure = false;
let isServicePaused = false;

let currentUrl = "";
let navigationHistory = [];
let historyIndex = -1;
let suppressHistoryUpdate = false;
let lastScreenshotObjectUrl = null;
let sessionStartTime = null;
let uptimeInterval = null;

const remoteState = {
  socket: null,
  sessionId: null,
  commandId: 0,
  pending: new Map(),
  canvas: null,
  ctx: null,
  overlay: null,
  statusNode: null,
  lastMetadata: null,
  isStreaming: false,
  currentUrl: "",
  targetId: null,
  hasRenderedFrame: false,
  expectingClose: false,
};

const MINIMAL_STYLE_ID = "null-void-rbi-minimal";

document.addEventListener("DOMContentLoaded", () => {
  injectMinimalStyles();
  initializeNullVoidBrowser().catch((error) => {
    console.error("[NULL VOID RBI] Initialization error", error);
    showNotification("Initialization failed: " + error.message, "error");
    showBrowserReady(false);
  });
});

async function initializeNullVoidBrowser() {
  console.log("[NULL VOID RBI] Initializing minimal Browserless experience");

  setupEventListeners();
  startUptimeCounter();

  await ensureBrowserlessConfig();

  const params = new URLSearchParams(window.location.search);
  const location = params.get("location") || "singapore";
  const sessionId = params.get("sessionId") || `nv_${Date.now()}`;

  updateLocationDisplay(location);
  updateSessionDisplay(sessionId);

  sessionStartTime = Date.now();

  hideLoadingScreen();
  showBrowserReady(false);

  const connected = await verifyBrowserlessConnection();
  if (connected) {
    showNotification("Connected to Browserless.io", "success");
    showBrowserReady(true);

    setTimeout(() => {
      if (!currentUrl) {
        navigateTo("https://www.google.com").catch((error) => {
          console.warn("[NULL VOID RBI] Auto navigation failed", error);
        });
      }
    }, 1200);
  } else {
    showNotification("Browserless API unavailable - fallback mode", "warning");
    showBrowserReady(false);
  }

  console.log("[NULL VOID RBI] Initialization complete");
}

async function ensureBrowserlessConfig() {
  if (!browserlessConfigResolved) {
    browserlessConfigResolved = resolveBrowserlessConfigSource()
      .catch((error) => {
        console.warn("[NULL VOID RBI] Failed to resolve config", error.message);
        return null;
      })
      .then((config) => {
        browserlessConfigCache = {
          ...DEFAULT_BROWSERLESS_SETTINGS,
          ...(config || {}),
        };

        if (browserlessConfigCache.apiKey) {
          BROWSERLESS_API_KEY = browserlessConfigCache.apiKey;
        } else {
          console.warn(
            "[NULL VOID RBI] Browserless API key missing from configuration"
          );
        }
        if (browserlessConfigCache.baseUrl) {
          BROWSERLESS_BASE_URL = stripTrailingSlash(
            browserlessConfigCache.baseUrl
          );
        }
        if (browserlessConfigCache.wsUrl) {
          BROWSERLESS_WS_URL = browserlessConfigCache.wsUrl;
        }

        return browserlessConfigCache;
      });
  }

  return browserlessConfigResolved;
}

function resolveBrowserlessConfigSource() {
  if (typeof window !== "undefined") {
    if (window.BROWSERLESS_CONFIG_PROMISE) {
      return window.BROWSERLESS_CONFIG_PROMISE;
    }
    if (window.BROWSERLESS_CONFIG) {
      return Promise.resolve(window.BROWSERLESS_CONFIG);
    }
  }
  return Promise.resolve(null);
}

async function verifyBrowserlessConnection() {
  try {
    await ensureBrowserlessConfig();

    if (!BROWSERLESS_API_KEY) {
      console.warn("[NULL VOID RBI] Browserless API key missing");
      handleApiAuthFailure(
        0,
        "Missing API Key",
        "Set BROWSERLESS_API_KEY in .env"
      );
      return false;
    }

    const endpoint = buildEndpoint(
      BROWSERLESS_BASE_URL,
      browserlessConfigCache?.endpoints?.version ||
        DEFAULT_BROWSERLESS_SETTINGS.endpoints.version
    );
    const testUrl = `${endpoint}?token=${encodeURIComponent(
      BROWSERLESS_API_KEY
    )}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(testUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      console.log("[NULL VOID RBI] Browserless API connected", data);
      isApiConnected = true;
      isAuthFailure = false;
      isServicePaused = false;
      return true;
    }

    const errorText = await safeReadResponseText(response);

    if (response.status === 401 || response.status === 403) {
      handleApiAuthFailure(response.status, response.statusText, errorText);
      return false;
    }

    if (
      response.status === 402 ||
      /temporarily paused|deployment paused/i.test(errorText)
    ) {
      showBrowserlessServicePaused(errorText.trim());
      return false;
    }

    console.warn(
      "[NULL VOID RBI] Browserless version endpoint failed",
      response.status,
      errorText
    );
    return false;
  } catch (error) {
    console.warn(
      "[NULL VOID RBI] Browserless verification failed",
      error.message
    );
    return false;
  }
}

async function navigateTo(url) {
  await ensureBrowserlessConfig();

  if (isAuthFailure) {
    showNotification(
      "Browserless authentication failed. Using fallback renderer.",
      "warning"
    );
    showBrowserReady(false);
  }

  if (!url || !url.trim()) {
    showNotification("Please enter a valid URL", "warning");
    return;
  }

  let normalizedUrl = url.trim();
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    normalizedUrl = "https://" + normalizedUrl;
  }

  currentUrl = normalizedUrl;

  const urlInput = document.getElementById("urlInput");
  if (urlInput) {
    urlInput.value = normalizedUrl;
  }

  if (!suppressHistoryUpdate) {
    addToHistory(normalizedUrl);
  } else {
    suppressHistoryUpdate = false;
  }

  teardownRemoteStream();
  showLoadingState(normalizedUrl);

  try {
    if (isApiConnected && !isServicePaused && !isAuthFailure) {
      const streamReady = await loadViaRemoteStream(normalizedUrl);
      if (streamReady) {
        return;
      }

      const success = await loadViaScreenshotAPI(normalizedUrl);
      if (success) {
        return;
      }
    }

    console.log("[NULL VOID RBI] Falling back to iframe rendering");
    loadViaIframe(normalizedUrl);
  } catch (error) {
    console.error("[NULL VOID RBI] Navigation error", error.message);
    showErrorState(normalizedUrl, error.message);
  }
}

async function loadViaRemoteStream(url) {
  if (!BROWSERLESS_API_KEY || !BROWSERLESS_WS_URL) {
    console.warn("[NULL VOID RBI] Missing Browserless websocket configuration");
    return false;
  }

  renderRemoteStreamStage(url);

  const wsEndpoint = buildWebsocketEndpoint(BROWSERLESS_WS_URL, {
    token: BROWSERLESS_API_KEY,
    headless: "true",
    stealth: "true",
    "--window-size": "1280,720",
    "--hide-scrollbars": "true",
    "--mute-audio": "true",
  });

  let resolved = false;
  let connectionTimeout = null;

  return new Promise((resolve) => {
    let socket;
    try {
      socket = new WebSocket(wsEndpoint);
    } catch (error) {
      console.warn(
        "[NULL VOID RBI] Failed to open Browserless websocket",
        error.message
      );
      updateStreamStatus(
        true,
        "Unable to reach Browserless websocket endpoint"
      );
      resolve(false);
      return;
    }

    remoteState.socket = socket;
    remoteState.commandId = 0;
    remoteState.pending = new Map();
    remoteState.sessionId = null;
    remoteState.lastMetadata = null;
    remoteState.isStreaming = false;
    remoteState.currentUrl = url;
    remoteState.targetId = null;
    remoteState.hasRenderedFrame = false;
    remoteState.expectingClose = false;

    const finalize = (success, message) => {
      if (resolved) {
        return;
      }
      resolved = true;
      clearTimeout(connectionTimeout);
      if (!success) {
        teardownRemoteStream(message);
      } else {
        remoteState.isStreaming = true;
        updateStreamStatus(true, "Waiting for remote frames…");
      }
      resolve(success);
    };

    connectionTimeout = setTimeout(() => {
      finalize(false, "Timed out connecting to Browserless");
    }, 15000);

    socket.addEventListener("open", async () => {
      try {
        const { targetId } = await sendRootCommand("Target.createTarget", {
          url: "about:blank",
          newWindow: false,
        });

        remoteState.targetId = targetId;

        const attachResult = await sendRootCommand("Target.attachToTarget", {
          targetId,
          flatten: true,
        });

        remoteState.sessionId = attachResult.sessionId;

        await Promise.all([
          sendSessionCommand("Runtime.enable"),
          sendSessionCommand("Page.enable"),
          sendSessionCommand("Network.enable"),
        ]);

        await sendSessionCommand("Emulation.setDeviceMetricsOverride", {
          width: 1280,
          height: 720,
          deviceScaleFactor: 1,
          mobile: false,
          screenOrientation: {
            type: "landscapePrimary",
            angle: 0,
          },
        });

        await sendSessionCommand("Page.navigate", { url });
        await sendSessionCommand("Page.startScreencast", {
          format: "jpeg",
          quality: 80,
          everyNthFrame: 1,
          maxWidth: 1280,
          maxHeight: 720,
        });

        finalize(true);
      } catch (error) {
        console.warn("[NULL VOID RBI] Remote streaming failed", error.message);
        showNotification(
          "Remote streaming unavailable. Trying alternate renderer.",
          "warning"
        );
        finalize(false, error.message);
      }
    });

    socket.addEventListener("message", (event) => {
      handleCdpMessage(event.data);
    });

    socket.addEventListener("error", (event) => {
      const errorMessage = event?.message || "Browserless websocket error";
      console.warn("[NULL VOID RBI] Websocket error", errorMessage);
      finalize(false, errorMessage);
    });

    socket.addEventListener("close", (event) => {
      console.warn(
        "[NULL VOID RBI] Websocket closed",
        event.code,
        event.reason
      );
      const expected = remoteState.expectingClose;
      remoteState.expectingClose = false;

      if (!resolved && !expected) {
        finalize(false, event.reason || "Connection closed");
        return;
      }

      if (expected) {
        return;
      }

      updateStreamStatus(true, "Remote session ended");
      showNotification(
        "Remote session ended. Switching to snapshot mode.",
        "warning"
      );

      const fallbackUrl = remoteState.currentUrl || url;
      teardownRemoteStream("Remote connection closed");

      if (fallbackUrl) {
        showLoadingState(fallbackUrl);
        loadViaScreenshotAPI(fallbackUrl).catch((error) => {
          console.warn(
            "[NULL VOID RBI] Failed to fallback after remote close",
            error.message
          );
          loadViaIframe(fallbackUrl);
        });
      }
    });
  });
}

function renderRemoteStreamStage(url) {
  setBrowserFrame(
    `
      <div class="nv-stage" data-mode="stream">
        <header class="nv-stage__bar">
          <span class="nv-stage__brand">NULL VOID</span>
          <span class="nv-stage__status" title="${escapeHtml(
            url
          )}">${escapeHtml(extractDomain(url))}</span>
          <span class="nv-stage__tag">REMOTE</span>
        </header>
        <div class="nv-stage__content nv-stage__content--stream">
          <canvas class="nv-stream__canvas" id="nvStreamCanvas"></canvas>
          <div
            class="nv-stream__overlay"
            id="nvStreamOverlay"
            tabindex="0"
            role="application"
            aria-label="Remote browser surface"
          ></div>
          <div class="nv-stream__status" id="nvStreamStatus">
            <div class="nv-spinner"></div>
            <div class="nv-stream__label">Connecting to remote browser…</div>
          </div>
        </div>
      </div>
    `,
    (container) => {
      remoteState.canvas = container.querySelector("#nvStreamCanvas");
      remoteState.ctx = remoteState.canvas
        ? remoteState.canvas.getContext("2d", { alpha: false })
        : null;
      remoteState.overlay = container.querySelector("#nvStreamOverlay");
      remoteState.statusNode = container.querySelector("#nvStreamStatus");
      remoteState.hasRenderedFrame = false;

      if (remoteState.overlay) {
        bindRemoteOverlayEvents(remoteState.overlay);
        setTimeout(() => {
          try {
            remoteState.overlay.focus({ preventScroll: true });
          } catch (error) {
            /* ignore focus errors */
          }
        }, 20);
      }

      updateStreamStatus(true, "Connecting to remote browser…");
    }
  );
}

function bindRemoteOverlayEvents(overlay) {
  overlay.addEventListener("pointerdown", handleRemotePointerDown);
  overlay.addEventListener("pointermove", handleRemotePointerMove);
  overlay.addEventListener("pointerup", handleRemotePointerUp);
  overlay.addEventListener("pointercancel", handleRemotePointerUp);
  overlay.addEventListener("pointerleave", handleRemotePointerUp);
  overlay.addEventListener("wheel", handleRemoteWheel, { passive: false });
  overlay.addEventListener("keydown", handleRemoteKeyDown);
  overlay.addEventListener("keyup", handleRemoteKeyUp);
  overlay.addEventListener("contextmenu", (event) => event.preventDefault());
  overlay.addEventListener("pointerdown", () => {
    try {
      overlay.focus({ preventScroll: true });
    } catch (error) {
      /* ignore focus errors */
    }
  });
}

function updateStreamStatus(visible, message) {
  if (!remoteState.statusNode) {
    return;
  }

  if (visible) {
    remoteState.statusNode.classList.remove("is-hidden");
    if (message) {
      const label = remoteState.statusNode.querySelector(".nv-stream__label");
      if (label) {
        label.textContent = message;
      }
    }
  } else {
    remoteState.statusNode.classList.add("is-hidden");
  }
}

function sendRootCommand(method, params = {}) {
  return sendCdpCommand(method, params, null);
}

function sendSessionCommand(method, params = {}) {
  if (!remoteState.sessionId) {
    return Promise.reject(new Error("No active Browserless session"));
  }
  return sendCdpCommand(method, params, remoteState.sessionId);
}

function sendCdpCommand(method, params = {}, sessionId = null) {
  const { socket } = remoteState;
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error("Browserless websocket not open"));
  }

  const id = ++remoteState.commandId;

  return new Promise((resolve, reject) => {
    remoteState.pending.set(id, { resolve, reject, method });
    const payload = { id, method, params };
    if (sessionId) {
      payload.sessionId = sessionId;
    }

    try {
      socket.send(JSON.stringify(payload));
    } catch (error) {
      remoteState.pending.delete(id);
      reject(error);
    }
  });
}

function handleCdpMessage(rawMessage) {
  if (!rawMessage) {
    return;
  }

  let message;
  try {
    message = JSON.parse(rawMessage);
  } catch (error) {
    console.warn("[NULL VOID RBI] Failed to parse CDP message", error.message);
    return;
  }

  if (typeof message.id === "number") {
    const pending = remoteState.pending.get(message.id);
    if (pending) {
      remoteState.pending.delete(message.id);
      if (message.error) {
        pending.reject(
          new Error(message.error.message || "CDP command failed")
        );
      } else {
        pending.resolve(message.result || {});
      }
    }
    return;
  }

  if (!message.method) {
    return;
  }

  if (
    remoteState.sessionId &&
    message.sessionId &&
    message.sessionId !== remoteState.sessionId
  ) {
    return;
  }

  switch (message.method) {
    case "Page.screencastFrame":
      processScreencastFrame(message.params);
      break;
    case "Runtime.consoleAPICalled": {
      const args = message.params?.args || [];
      const text = args.map((arg) => arg.value || arg.description).join(" ");
      if (text) {
        console.log(`[Remote Console] ${text}`);
      }
      break;
    }
    case "Runtime.exceptionThrown":
      console.warn(
        "[NULL VOID RBI] Remote script exception",
        message.params?.exceptionDetails?.text || ""
      );
      break;
    case "Page.loadEventFired":
      updateStreamStatus(true, "Remote page loaded");
      setTimeout(() => updateStreamStatus(false), 1200);
      break;
    case "Target.detachedFromTarget":
      if (message.params?.targetId === remoteState.targetId) {
        showNotification("Remote session closed", "warning");
        teardownRemoteStream("Target detached");
      }
      break;
    default:
      break;
  }
}

function processScreencastFrame(params) {
  if (!params) {
    return;
  }

  const { data, metadata, sessionId } = params;
  remoteState.lastMetadata = metadata || null;

  const canvas = remoteState.canvas;
  const ctx = remoteState.ctx;

  if (!canvas || !ctx || !data) {
    sendSessionCommand("Page.screencastFrameAck", { sessionId }).catch(
      () => {}
    );
    return;
  }

  const deviceWidth = metadata?.deviceWidth || metadata?.width || 1280;
  const deviceHeight = metadata?.deviceHeight || metadata?.height || 720;

  if (canvas.width !== deviceWidth || canvas.height !== deviceHeight) {
    canvas.width = deviceWidth;
    canvas.height = deviceHeight;
  }

  const blob = base64ToBlob(data, "image/jpeg");

  createImageBitmap(blob)
    .then((bitmap) => {
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      if (!remoteState.hasRenderedFrame) {
        remoteState.hasRenderedFrame = true;
        updateStreamStatus(false);
        showNotification(
          `Remote isolation active: ${extractDomain(remoteState.currentUrl)}`,
          "success"
        );
      }
    })
    .catch((error) => {
      console.warn(
        "[NULL VOID RBI] Failed to render remote frame",
        error.message
      );
    })
    .finally(() => {
      sendSessionCommand("Page.screencastFrameAck", { sessionId }).catch(
        (ackError) => {
          console.warn(
            "[NULL VOID RBI] Screencast ack failed",
            ackError.message
          );
        }
      );
    });
}

function teardownRemoteStream(reason) {
  if (reason) {
    console.log("[NULL VOID RBI] Closing remote stream:", reason);
  }

  if (remoteState.socket) {
    remoteState.expectingClose = true;
    try {
      remoteState.socket.close();
    } catch (error) {
      console.warn("[NULL VOID RBI] Error closing websocket", error.message);
    }
  }

  remoteState.socket = null;
  remoteState.sessionId = null;
  remoteState.targetId = null;
  remoteState.isStreaming = false;
  remoteState.currentUrl = "";
  remoteState.lastMetadata = null;
  remoteState.hasRenderedFrame = false;

  remoteState.pending.forEach(({ reject }) => {
    try {
      reject(new Error(reason || "Remote stream closed"));
    } catch (error) {
      /* ignore rejection errors */
    }
  });
  remoteState.pending = new Map();

  remoteState.canvas = null;
  remoteState.ctx = null;
  remoteState.overlay = null;
  remoteState.statusNode = null;
}

function base64ToBlob(base64, mimeType) {
  const byteCharacters = atob(base64);
  const byteArrays = [];
  const chunkSize = 1024;

  for (let offset = 0; offset < byteCharacters.length; offset += chunkSize) {
    const slice = byteCharacters.slice(offset, offset + chunkSize);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i += 1) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    byteArrays.push(new Uint8Array(byteNumbers));
  }

  return new Blob(byteArrays, { type: mimeType });
}

function translatePointer(event) {
  const canvas = remoteState.canvas;
  const metadata = remoteState.lastMetadata;

  if (!canvas || !metadata) {
    return null;
  }

  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return null;
  }

  const deviceWidth = metadata.deviceWidth || metadata.width || rect.width;
  const deviceHeight = metadata.deviceHeight || metadata.height || rect.height;

  const scaleX = deviceWidth / rect.width;
  const scaleY = deviceHeight / rect.height;

  const x =
    (event.clientX - rect.left) * scaleX + (metadata.scrollOffsetX || 0);
  const y = (event.clientY - rect.top) * scaleY + (metadata.scrollOffsetY || 0);

  return { x, y };
}

function sendMouseEvent(type, event) {
  if (!remoteState.sessionId) {
    return;
  }
  const position = translatePointer(event);
  if (!position) {
    return;
  }

  const params = {
    type,
    x: position.x,
    y: position.y,
    modifiers: calculateModifiers(event),
    pointerType: "mouse",
    buttons: mapButtonsMask(event.buttons),
  };

  if (type === "mousePressed" || type === "mouseReleased") {
    params.button = mapMouseButton(event.button);
    params.clickCount = Math.max(event.detail, 1);
  }

  sendSessionCommand("Input.dispatchMouseEvent", params).catch((error) => {
    console.warn(`[NULL VOID RBI] ${type} dispatch failed`, error.message);
  });
}

function handleRemotePointerDown(event) {
  if (event.pointerType !== "mouse") {
    return;
  }
  if (!remoteState.sessionId) {
    return;
  }
  try {
    event.target.setPointerCapture(event.pointerId);
  } catch (error) {
    /* ignore pointer capture errors */
  }
  sendMouseEvent("mousePressed", event);
  event.preventDefault();
}

function handleRemotePointerMove(event) {
  if (event.pointerType !== "mouse") {
    return;
  }
  if (!remoteState.sessionId) {
    return;
  }
  sendMouseEvent("mouseMoved", event);
}

function handleRemotePointerUp(event) {
  if (event.pointerType !== "mouse") {
    return;
  }
  if (!remoteState.sessionId) {
    return;
  }
  sendMouseEvent("mouseReleased", event);
  try {
    event.target.releasePointerCapture(event.pointerId);
  } catch (error) {
    /* ignore pointer capture errors */
  }
  event.preventDefault();
}

function handleRemoteWheel(event) {
  if (!remoteState.sessionId) {
    return;
  }
  const position = translatePointer(event);
  if (!position) {
    return;
  }

  sendSessionCommand("Input.dispatchMouseEvent", {
    type: "mouseWheel",
    x: position.x,
    y: position.y,
    deltaX: event.deltaX,
    deltaY: event.deltaY,
    modifiers: calculateModifiers(event),
    pointerType: "mouse",
    buttons: mapButtonsMask(event.buttons),
  }).catch((error) => {
    console.warn("[NULL VOID RBI] Wheel dispatch failed", error.message);
  });

  event.preventDefault();
}

function handleRemoteKeyDown(event) {
  if (!remoteState.sessionId) {
    return;
  }
  const params = buildKeyEventParams("keyDown", event);
  sendSessionCommand("Input.dispatchKeyEvent", params).catch((error) => {
    console.warn("[NULL VOID RBI] Key down dispatch failed", error.message);
  });

  if (shouldInsertText(event)) {
    sendSessionCommand("Input.insertText", { text: event.key }).catch(
      (error) => {
        console.warn("[NULL VOID RBI] Text insert failed", error.message);
      }
    );
  }

  event.preventDefault();
}

function handleRemoteKeyUp(event) {
  if (!remoteState.sessionId) {
    return;
  }
  const params = buildKeyEventParams("keyUp", event);
  sendSessionCommand("Input.dispatchKeyEvent", params).catch((error) => {
    console.warn("[NULL VOID RBI] Key up dispatch failed", error.message);
  });
  event.preventDefault();
}

function buildKeyEventParams(type, event) {
  const params = {
    type,
    key: event.key,
    code: event.code,
    autoRepeat: event.repeat,
    modifiers: calculateModifiers(event),
    windowsVirtualKeyCode: event.keyCode,
    nativeVirtualKeyCode: event.keyCode,
  };

  if (event.location) {
    params.location = event.location;
  }

  if (event.key && event.key.length === 1) {
    params.text = event.key;
    params.unmodifiedText = event.key;
  }

  return params;
}

function shouldInsertText(event) {
  return (
    event.key &&
    event.key.length === 1 &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  );
}

function calculateModifiers(event) {
  let modifiers = 0;
  if (event.altKey) modifiers |= 1;
  if (event.ctrlKey) modifiers |= 2;
  if (event.metaKey) modifiers |= 4;
  if (event.shiftKey) modifiers |= 8;
  return modifiers;
}

function mapMouseButton(button) {
  switch (button) {
    case 1:
      return "middle";
    case 2:
      return "right";
    case 3:
      return "back";
    case 4:
      return "forward";
    default:
      return "left";
  }
}

function mapButtonsMask(buttons) {
  if (typeof buttons === "number") {
    return buttons;
  }
  return 0;
}

function buildWebsocketEndpoint(base, params) {
  try {
    const endpoint = new URL(base);
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      endpoint.searchParams.set(key, value);
    });
    return endpoint.toString();
  } catch (error) {
    console.warn("[NULL VOID RBI] Invalid websocket base URL", error.message);
    const tokenParam = params?.token
      ? `token=${encodeURIComponent(params.token)}`
      : "";
    return `${base}?${tokenParam}`;
  }
}

async function loadViaScreenshotAPI(url) {
  try {
    const screenshotEndpoint = buildEndpoint(
      BROWSERLESS_BASE_URL,
      browserlessConfigCache?.endpoints?.screenshot ||
        DEFAULT_BROWSERLESS_SETTINGS.endpoints.screenshot
    );

    const requestBody = {
      url,
      options:
        browserlessConfigCache?.screenshotOptions ||
        DEFAULT_BROWSERLESS_SETTINGS.screenshotOptions,
      gotoOptions:
        browserlessConfigCache?.gotoOptions ||
        DEFAULT_BROWSERLESS_SETTINGS.gotoOptions,
      viewport: {
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    const response = await fetch(
      `${screenshotEndpoint}?token=${encodeURIComponent(BROWSERLESS_API_KEY)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await safeReadResponseText(response);

      if (response.status === 401 || response.status === 403) {
        handleApiAuthFailure(response.status, response.statusText, errorText);
        return false;
      }

      if (
        response.status === 402 ||
        /temporarily paused|deployment paused/i.test(errorText)
      ) {
        showBrowserlessServicePaused(errorText.trim(), url);
        return true;
      }

      throw new Error(`Browserless error ${response.status}: ${errorText}`);
    }

    const blob = await response.blob();

    if (lastScreenshotObjectUrl) {
      URL.revokeObjectURL(lastScreenshotObjectUrl);
    }

    const imageUrl = URL.createObjectURL(blob);
    lastScreenshotObjectUrl = imageUrl;
    isServicePaused = false;

    displayScreenshot(imageUrl, url);

    showNotification(
      `Rendered via Browserless.io: ${extractDomain(url)}`,
      "success"
    );
    return true;
  } catch (error) {
    console.warn("[NULL VOID RBI] Screenshot API failed", error.message);
    showNotification(
      "Browserless rendering failed: " + error.message,
      "warning"
    );
    return false;
  }
}

function displayScreenshot(imageUrl, url) {
  teardownRemoteStream("Displaying static screenshot");
  setBrowserFrame(
    `
      <div class="nv-stage" data-mode="remote">
        <header class="nv-stage__bar">
          <span class="nv-stage__brand">NULL VOID</span>
          <span class="nv-stage__status" title="${escapeHtml(
            url
          )}">${escapeHtml(extractDomain(url))}</span>
          <span class="nv-stage__tag">REMOTE</span>
        </header>
        <div class="nv-stage__content">
          <img class="nv-stage__screenshot" src="${imageUrl}" alt="Rendered via Browserless.io" />
        </div>
      </div>
    `
  );
}

function loadViaIframe(url) {
  teardownRemoteStream("Switching to iframe fallback");
  setBrowserFrame(
    `
      <div class="nv-stage" data-mode="fallback">
        <header class="nv-stage__bar nv-stage__bar--warning">
          <span class="nv-stage__brand">NULL VOID</span>
          <span class="nv-stage__status" title="${escapeHtml(
            url
          )}">${escapeHtml(extractDomain(url))}</span>
          <span class="nv-stage__tag">FALLBACK</span>
        </header>
        <div class="nv-stage__content nv-stage__content--iframe">
          <iframe
            class="nv-frame"
            id="rbiIframe"
            src="${escapeAttribute(url)}"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation allow-downloads"
          ></iframe>
        </div>
      </div>
    `,
    () => {
      const iframe = document.getElementById("rbiIframe");
      if (iframe) {
        iframe.addEventListener("load", () => {
          console.log("[NULL VOID RBI] Iframe loaded");
        });
        iframe.addEventListener("error", () => {
          console.warn("[NULL VOID RBI] Iframe error");
        });
      }
    }
  );

  showNotification(`Loaded in fallback mode: ${extractDomain(url)}`, "warning");
}

function showBrowserlessServicePaused(details = "", pendingUrl) {
  teardownRemoteStream("Browserless deployment paused");
  console.warn("[NULL VOID RBI] Browserless deployment paused", details);
  isServicePaused = true;
  isApiConnected = false;

  const trimmedDetails =
    details.trim() ||
    "Browserless deployment is paused. Resume the deployment to restore remote isolation.";

  setBrowserFrame(
    `
      <div class="nv-shell" data-tone="warning">
        <div class="nv-brand">NULL VOID</div>
        <div class="nv-subline">REMOTE SERVICE PAUSED</div>
        <div class="nv-note">${escapeHtml(trimmedDetails)}</div>
        <div class="nv-actions">
          <button class="nv-button" data-action="fallback">Use fallback mode</button>
          <a class="nv-button nv-button--ghost" href="https://docs.browserless.io/docs/deployments" target="_blank" rel="noreferrer">Manage deployment</a>
        </div>
      </div>
    `,
    (container) => {
      const action = container.querySelector('[data-action="fallback"]');
      if (action && pendingUrl) {
        action.addEventListener("click", () => {
          loadViaIframe(pendingUrl);
        });
      }
    }
  );

  showNotification("Browserless deployment paused", "warning");
}

function showLoadingState(url) {
  teardownRemoteStream("Switching to loading state");
  setBrowserFrame(
    `
      <div class="nv-shell" data-tone="info">
        <div class="nv-brand">NULL VOID</div>
        <div class="nv-spinner"></div>
        <div class="nv-subline">REMOTE RENDERING</div>
        <div class="nv-note">${escapeHtml(extractDomain(url))}</div>
      </div>
    `
  );
}

function showErrorState(url, error) {
  teardownRemoteStream("Showing error state");
  setBrowserFrame(
    `
      <div class="nv-shell" data-tone="error">
        <div class="nv-brand">NULL VOID</div>
        <div class="nv-subline">UNABLE TO LOAD</div>
        <div class="nv-note">${escapeHtml(error)}</div>
        <div class="nv-actions">
          <button class="nv-button" data-action="retry">Retry</button>
        </div>
      </div>
    `,
    (container) => {
      const retry = container.querySelector('[data-action="retry"]');
      if (retry) {
        retry.addEventListener("click", () => navigateTo(url));
      }
    }
  );
}

function showBrowserReady(apiConnected) {
  teardownRemoteStream("Ready screen");
  setBrowserFrame(
    `
      <div class="nv-shell" data-tone="default">
        <div class="nv-brand">NULL VOID</div>
        <div class="nv-subline">${
          apiConnected ? "REMOTE ISOLATION READY" : "FALLBACK MODE AVAILABLE"
        }</div>
        <div class="nv-note">
          ${
            apiConnected
              ? "Remote pages render via Browserless infrastructure. Enter a URL above to start."
              : "Browserless is unavailable. You can still browse using the fallback iframe renderer."
          }
        </div>
      </div>
    `
  );
}

function handleApiAuthFailure(status, statusText, errorText = "") {
  isAuthFailure = true;
  isApiConnected = false;

  const trimmedError = errorText.trim();
  const message = `Browserless rejected the request (${status} ${statusText}).`;

  showNotification(message, "error");

  teardownRemoteStream("Authentication failure");
  setBrowserFrame(
    `
      <div class="nv-shell" data-tone="error">
        <div class="nv-brand">NULL VOID</div>
        <div class="nv-subline">AUTHENTICATION FAILED</div>
        <div class="nv-note">${escapeHtml(trimmedError || message)}</div>
      </div>
    `
  );
}

function addToHistory(url) {
  if (!url) {
    return;
  }

  if (historyIndex >= 0 && navigationHistory[historyIndex] === url) {
    updateNavigationButtons();
    return;
  }

  if (historyIndex < navigationHistory.length - 1) {
    navigationHistory = navigationHistory.slice(0, historyIndex + 1);
  }

  navigationHistory.push(url);
  historyIndex = navigationHistory.length - 1;
  updateNavigationButtons();
}

function updateNavigationButtons() {
  const backBtn = document.getElementById("backBtn");
  const forwardBtn = document.getElementById("forwardBtn");

  if (backBtn) {
    backBtn.disabled = historyIndex <= 0;
  }

  if (forwardBtn) {
    forwardBtn.disabled =
      historyIndex === -1 || historyIndex >= navigationHistory.length - 1;
  }
}

function setupEventListeners() {
  const goBtn = document.getElementById("goBtn");
  const urlInput = document.getElementById("urlInput");
  const refreshBtn = document.getElementById("refreshBtn");
  const backBtn = document.getElementById("backBtn");
  const forwardBtn = document.getElementById("forwardBtn");
  const terminateBtn = document.getElementById("terminateSession");

  if (goBtn) {
    goBtn.addEventListener("click", () => handleGoClick());
  }

  if (urlInput) {
    urlInput.addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        handleGoClick();
      }
    });
    urlInput.addEventListener("focus", () => urlInput.select());
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => handleRefresh());
  }

  if (backBtn) {
    backBtn.addEventListener("click", () => handleBack());
  }

  if (forwardBtn) {
    forwardBtn.addEventListener("click", () => handleForward());
  }

  if (terminateBtn) {
    terminateBtn.addEventListener("click", () => handleTermination());
  }

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey && event.key === "r") || event.key === "F5") {
      event.preventDefault();
      handleRefresh();
    }
    if (event.altKey && event.key === "ArrowLeft") {
      event.preventDefault();
      handleBack();
    }
    if (event.altKey && event.key === "ArrowRight") {
      event.preventDefault();
      handleForward();
    }
    if (event.ctrlKey && event.key.toLowerCase() === "l") {
      event.preventDefault();
      const input = document.getElementById("urlInput");
      if (input) {
        input.focus();
        input.select();
      }
    }
  });

  updateNavigationButtons();
}

async function handleGoClick() {
  const urlInput = document.getElementById("urlInput");
  if (!urlInput) {
    return;
  }

  await navigateTo(urlInput.value);
}

async function handleRefresh() {
  if (currentUrl) {
    showNotification("Refreshing...", "info");
    await navigateTo(currentUrl);
  } else {
    showNotification("Nothing to refresh", "warning");
  }
}

async function handleBack() {
  if (historyIndex > 0) {
    historyIndex -= 1;
    suppressHistoryUpdate = true;
    const targetUrl = navigationHistory[historyIndex];
    const urlInput = document.getElementById("urlInput");
    if (urlInput) {
      urlInput.value = targetUrl;
    }
    await navigateTo(targetUrl);
    updateNavigationButtons();
  }
}

async function handleForward() {
  if (historyIndex >= 0 && historyIndex < navigationHistory.length - 1) {
    historyIndex += 1;
    suppressHistoryUpdate = true;
    const targetUrl = navigationHistory[historyIndex];
    const urlInput = document.getElementById("urlInput");
    if (urlInput) {
      urlInput.value = targetUrl;
    }
    await navigateTo(targetUrl);
    updateNavigationButtons();
  }
}

function handleTermination() {
  if (confirm("End this secure browsing session?")) {
    showNotification("Session terminated", "success");
    setTimeout(() => window.close(), 800);
  }
}

function showNotification(message, type = "info") {
  const existing = document.querySelectorAll(".notification");
  existing.forEach((node) => node.remove());

  const notification = document.createElement("div");
  notification.className = "notification";
  notification.textContent = message;

  const colors = {
    success: "#22c55e",
    error: "#ef4444",
    warning: "#facc15",
    info: "#38bdf8",
  };

  notification.style.cssText = `
    position: fixed;
    top: 84px;
    right: 24px;
    background: ${colors[type] || colors.info};
    color: #020617;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.04em;
    z-index: 9999;
    box-shadow: 0 18px 40px rgba(2, 6, 23, 0.3);
    min-width: 220px;
    text-align: left;
    animation: nv-slide-in 0.25s ease-out;
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = "nv-slide-out 0.25s ease-in forwards";
    setTimeout(() => notification.remove(), 260);
  }, 3600);
}

function startUptimeCounter() {
  const uptimeDisplay = document.getElementById("uptime");
  if (!uptimeDisplay) {
    return;
  }

  if (uptimeInterval) {
    clearInterval(uptimeInterval);
  }

  uptimeInterval = setInterval(() => {
    if (!sessionStartTime) {
      return;
    }

    const elapsed = Date.now() - sessionStartTime;
    const minutes = Math.floor(elapsed / 60000)
      .toString()
      .padStart(2, "0");
    const seconds = Math.floor((elapsed % 60000) / 1000)
      .toString()
      .padStart(2, "0");

    uptimeDisplay.textContent = `${minutes}:${seconds}`;
  }, 1000);
}

function hideLoadingScreen() {
  const loadingScreen = document.getElementById("loadingScreen");
  const browserFrame = document.getElementById("browserFrame");

  if (loadingScreen) {
    loadingScreen.style.display = "none";
  }
  if (browserFrame) {
    browserFrame.style.display = "block";
  }
}

function updateLocationDisplay(location) {
  const mapping = {
    singapore: "Singapore",
    usa: "United States",
    uk: "United Kingdom",
    canada: "Canada",
    europe: "Europe",
    japan: "Japan",
  };

  const locationDisplay = document.getElementById("locationDisplay");
  if (locationDisplay) {
    locationDisplay.textContent = mapping[location] || location;
  }
}

function updateSessionDisplay(sessionId) {
  const sessionDisplay = document.getElementById("sessionId");
  if (sessionDisplay) {
    sessionDisplay.textContent =
      sessionId.length > 16 ? `${sessionId.slice(0, 16)}…` : sessionId;
  }
}

function setBrowserFrame(content, afterRender) {
  const browserFrame = document.getElementById("browserFrame");
  if (!browserFrame) {
    return;
  }

  browserFrame.style.display = "block";
  browserFrame.innerHTML = content;

  if (typeof afterRender === "function") {
    afterRender(browserFrame);
  }
}

async function safeReadResponseText(response) {
  try {
    return await response.text();
  } catch (error) {
    console.warn("[NULL VOID RBI] Failed to read response text", error.message);
    return "";
  }
}

function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch (error) {
    return url;
  }
}

function buildEndpoint(base, path) {
  const cleanBase = stripTrailingSlash(base || "");
  if (!path) {
    return cleanBase;
  }
  if (path.startsWith("http")) {
    return path;
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanBase}${normalizedPath}`;
}

function stripTrailingSlash(value) {
  return value ? value.replace(/\/+$/, "") : value;
}

function escapeHtml(value) {
  return (value || "").replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[char] || char;
  });
}

function escapeAttribute(value) {
  return (value || "").replace(/["<>`']/g, (char) => {
    const map = {
      '"': "&quot;",
      "<": "&lt;",
      ">": "&gt;",
      "`": "&#96;",
      "'": "&#39;",
    };
    return map[char] || char;
  });
}

function injectMinimalStyles() {
  if (document.getElementById(MINIMAL_STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = MINIMAL_STYLE_ID;
  style.textContent = `
    .nv-shell {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 18px;
      background: #020617;
      color: #94a3b8;
      text-align: center;
      padding: 32px 24px;
      letter-spacing: 0.08em;
    }

    .nv-shell[data-tone="warning"] { color: #facc15; }
    .nv-shell[data-tone="error"] { color: #fca5a5; }

    .nv-brand {
      font-size: 48px;
      font-weight: 700;
      letter-spacing: 0.5em;
      color: #f8fafc;
      text-transform: uppercase;
    }

    .nv-subline {
      font-size: 12px;
      letter-spacing: 0.24em;
      text-transform: uppercase;
      color: rgba(148, 163, 184, 0.8);
    }

    .nv-shell[data-tone="warning"] .nv-subline { color: #facc15; }
    .nv-shell[data-tone="error"] .nv-subline { color: #fca5a5; }

    .nv-spinner {
      width: 44px;
      height: 44px;
      border: 3px solid rgba(148, 163, 184, 0.2);
      border-top-color: #f8fafc;
      border-radius: 50%;
      animation: nv-spin 0.9s linear infinite;
    }

    .nv-note {
      max-width: 360px;
      font-size: 13px;
      line-height: 1.6;
      letter-spacing: 0.04em;
      color: rgba(148, 163, 184, 0.9);
    }

    .nv-shell[data-tone="warning"] .nv-note { color: rgba(250, 204, 21, 0.9); }
    .nv-shell[data-tone="error"] .nv-note { color: rgba(252, 165, 165, 0.9); }

    .nv-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .nv-button {
      background: #0f172a;
      color: #f8fafc;
      border: 1px solid #1f2937;
      padding: 10px 18px;
      border-radius: 9999px;
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 0.2s ease, color 0.2s ease;
    }

    .nv-button:hover {
      background: #1e293b;
    }

    .nv-button--ghost {
      background: transparent;
      color: inherit;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
    }

    .nv-stage {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: #020617;
    }

    .nv-stage__bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 18px;
      background: #030a1a;
      border-bottom: 1px solid #0f172a;
      gap: 16px;
    }

    .nv-stage__bar--warning {
      border-bottom: 1px solid rgba(250, 204, 21, 0.35);
      color: #facc15;
    }

    .nv-stage__brand {
      font-size: 14px;
      letter-spacing: 0.4em;
      color: #f8fafc;
    }

    .nv-stage__status {
      flex: 1;
      margin: 0 16px;
      font-size: 12px;
      letter-spacing: 0.08em;
      color: #64748b;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-transform: uppercase;
    }

    .nv-stage__tag {
      font-size: 10px;
      letter-spacing: 0.18em;
      color: #94a3b8;
      border: 1px solid #1f2937;
      border-radius: 9999px;
      padding: 4px 10px;
      text-transform: uppercase;
    }

    .nv-stage__content {
      flex: 1;
      width: 100%;
      min-height: 0;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: stretch;
      background: #020617;
    }

    .nv-stage__content--iframe {
      padding: 0;
      align-items: stretch;
      justify-content: stretch;
    }

    .nv-stage__content--stream {
      position: relative;
      padding: 0;
      align-items: stretch;
      justify-content: stretch;
      overflow: hidden;
    }

    .nv-stage[data-mode="remote"] .nv-stage__content {
      align-items: center;
      justify-content: center;
    }

    .nv-stage__screenshot {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #020617;
    }

    .nv-frame {
      flex: 1;
      width: 100%;
      height: 100%;
      border: none;
      background: #020617;
      display: block;
    }

    .nv-stage__content--iframe .nv-frame {
      flex: 1;
    }

    .nv-stream__canvas {
      width: 100%;
      height: 100%;
      display: block;
      background: #020617;
    }

    .nv-stream__overlay {
      position: absolute;
      inset: 0;
      cursor: crosshair;
      outline: none;
      background: transparent;
      pointer-events: auto;
    }

    .nv-stream__status {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      background: rgba(2, 6, 23, 0.86);
      color: #f8fafc;
      font-size: 12px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      text-align: center;
      transition: opacity 0.25s ease;
      pointer-events: none;
    }

    .nv-stream__status.is-hidden {
      opacity: 0;
    }

    .nv-stream__label {
      font-size: 11px;
      letter-spacing: 0.12em;
      color: rgba(148, 163, 184, 0.9);
    }

    @keyframes nv-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @keyframes nv-slide-in {
      from { opacity: 0; transform: translateX(120px); }
      to { opacity: 1; transform: translateX(0); }
    }

    @keyframes nv-slide-out {
      from { opacity: 1; transform: translateX(0); }
      to { opacity: 0; transform: translateX(120px); }
    }
  `;

  document.head.appendChild(style);
}

window.addEventListener("beforeunload", () => {
  if (uptimeInterval) {
    clearInterval(uptimeInterval);
  }
  if (lastScreenshotObjectUrl) {
    URL.revokeObjectURL(lastScreenshotObjectUrl);
  }
  teardownRemoteStream("Window unloading");
});

window.navigateTo = navigateTo;
window.loadViaIframe = loadViaIframe;

console.log("[NULL VOID RBI] Minimal script ready");
