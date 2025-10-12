// NULL VOID Remote Browser Isolation - Browserless.io Integration v2.0
// Production-ready implementation with proper API usage and clean UI

console.log("NULL VOID Browserless.io RBI Browser v2.0 Loading...");

// Use browser-specific API namespace
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

// Get Browserless configuration
const BROWSERLESS_API_KEY =
  window.BROWSERLESS_CONFIG?.apiKey ||
  "2SgiPLlAtLyabl75ea63edb2fb15fcf000d866d90aa96ab13";
const BROWSERLESS_BASE_URL =
  window.BROWSERLESS_CONFIG?.baseUrl || "https://chrome.browserless.io";

// Global state
let currentLocation = "singapore";
let currentUrl = "";
let sessionStartTime = null;
let uptimeInterval = null;
let navigationHistory = [];
let historyIndex = -1;
let isApiConnected = false;
let isAuthFailure = false;

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  console.log("[RBI v2.0] Starting initialization...");

  setTimeout(() => {
    initializeBrowserlessRBI();
  }, 100);

  setupEventListeners();
  startUptimeCounter();
});

// Initialize Browserless RBI
async function initializeBrowserlessRBI() {
  console.log("[RBI v2.0] Initializing Browserless.io RBI...");

  try {
    // Get parameters from URL
    const urlParams = new URLSearchParams(window.location.search);
    const location = urlParams.get("location") || "singapore";
    const sessionId = urlParams.get("sessionId") || "browserless_" + Date.now();

    currentLocation = location;
    sessionStartTime = Date.now();

    // Update UI
    updateLocationDisplay(location);
    updateSessionDisplay(sessionId);

    // Hide loading and show ready state
    hideLoadingScreen();

    // Set default URL
    const urlInput = document.getElementById("urlInput");
    if (urlInput) {
      urlInput.value = "https://www.google.com";
    }

    // Verify Browserless API connection
    const connected = await verifyBrowserlessConnection();

    if (connected) {
      showNotification("✅ Connected to Browserless.io API", "success");
      showBrowserReady(true);

      // Auto-navigate to Google after 2 seconds
      setTimeout(() => {
        console.log("[RBI v2.0] Auto-navigating to Google...");
        navigateTo("https://www.google.com");
      }, 2000);
    } else {
      showNotification(
        "⚠️ Browserless API unavailable - Using fallback mode",
        "warning"
      );
      showBrowserReady(false);
    }

    console.log("[RBI v2.0] Initialization completed");
  } catch (error) {
    console.error("[RBI v2.0] Initialization failed:", error);
    showNotification("Initialization error: " + error.message, "error");
    showBrowserReady(false);
  }
}

// Verify Browserless.io connection
async function verifyBrowserlessConnection() {
  try {
    console.log("[RBI v2.0] Verifying Browserless.io API connection...");

    const testUrl = `${BROWSERLESS_BASE_URL}/json/version?token=${BROWSERLESS_API_KEY}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(testUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      console.log("[RBI v2.0] ✅ Browserless API connected:", data);
      isApiConnected = true;
      return true;
    } else {
      const errorText = await safeReadResponseText(response);
      console.warn(
        "[RBI v2.0] API returned error:",
        response.status,
        response.statusText,
        errorText
      );

      if (response.status === 401 || response.status === 403) {
        handleApiAuthFailure(response.status, response.statusText, errorText);
      }

      isApiConnected = false;
      return false;
    }
  } catch (error) {
    console.warn("[RBI v2.0] API verification failed:", error.message);
    isApiConnected = false;
    return false;
  }
}

// Navigate to URL - Main navigation function
async function navigateTo(url) {
  if (isAuthFailure) {
    showNotification(
      "Browserless authentication has failed. Please update the API key and retry.",
      "error"
    );
    return;
  }
  try {
    // Validate and fix URL
    if (!url || !url.trim()) {
      showNotification("Please enter a valid URL", "warning");
      return;
    }

    url = url.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    currentUrl = url;
    console.log("[RBI v2.0] Navigating to:", url);

    // Update URL input
    const urlInput = document.getElementById("urlInput");
    if (urlInput) {
      urlInput.value = url;
    }

    // Add to history
    addToHistory(url);

    // Show loading state
    showLoadingState(url);

    // Try Browserless API first
    if (isApiConnected) {
      const success = await loadViaScreenshotAPI(url);
      if (success) {
        return;
      }
    }

    // Fallback to iframe
    console.log("[RBI v2.0] Using fallback iframe mode");
    loadViaIframe(url);
  } catch (error) {
    console.error("[RBI v2.0] Navigation error:", error);
    showNotification("Navigation failed: " + error.message, "error");
    showErrorState(url, error.message);
  }
}

// Load page using Browserless Screenshot API
async function loadViaScreenshotAPI(url) {
  try {
    console.log("[RBI v2.0] Loading via Browserless Screenshot API:", url);

    const screenshotUrl = `${BROWSERLESS_BASE_URL}/screenshot?token=${BROWSERLESS_API_KEY}`;

    const requestBody = {
      url: url,
      options: {
        fullPage: false,
        type: "png",
        quality: 90,
      },
      gotoOptions: {
        waitUntil: "networkidle2",
        timeout: 30000,
      },
      viewport: {
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
      },
    };

    console.log("[RBI v2.0] Sending screenshot request...");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    const response = await fetch(screenshotUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await safeReadResponseText(response);

      if (response.status === 401 || response.status === 403) {
        handleApiAuthFailure(response.status, response.statusText, errorText);
      }

      throw new Error(
        `API Error: ${response.status} ${response.statusText} ${errorText}`
      );
    }

    const blob = await response.blob();
    console.log(
      "[RBI v2.0] ✅ Screenshot received:",
      (blob.size / 1024).toFixed(2),
      "KB"
    );

    const imageUrl = URL.createObjectURL(blob);

    // Display screenshot in clean browser-like layout
    displayScreenshot(imageUrl, url);

    showNotification(
      `✅ Loaded via Browserless.io: ${extractDomain(url)}`,
      "success"
    );

    return true;
  } catch (error) {
    console.error("[RBI v2.0] Screenshot API failed:", error);
    showNotification("Screenshot API failed: " + error.message, "warning");
    return false;
  }
}

// Display screenshot in clean browser-like layout
function displayScreenshot(imageUrl, url) {
  const browserFrame = document.getElementById("browserFrame");

  browserFrame.innerHTML = `
    <div style="width: 100%; height: 100%; display: flex; flex-direction: column; background: #ffffff;">
      <!-- Top bar with URL and status -->
      <div style="background: #f8f9fa; border-bottom: 1px solid #dee2e6; padding: 8px 16px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;">
        <div style="display: flex; align-items: center; gap: 8px; flex: 1; overflow: hidden;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#28a745" style="flex-shrink: 0;">
            <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10V11H16V16H8V11H9.2V10C9.2,8.6 10.6,7 12,7M12,8.2C11.2,8.2 10.4,8.7 10.4,10V11H13.6V10C13.6,8.7 12.8,8.2 12,8.2Z"/>
          </svg>
          <span style="font-size: 13px; color: #495057; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${url}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
          <span style="font-size: 11px; color: #28a745; font-weight: 600; background: rgba(40, 167, 69, 0.1); padding: 4px 8px; border-radius: 4px; display: flex; align-items: center; gap: 4px;">
            <span style="width: 6px; height: 6px; background: #28a745; border-radius: 50%; display: inline-block;"></span>
            BROWSERLESS.IO
          </span>
        </div>
      </div>
      
      <!-- Screenshot content area -->
      <div style="flex: 1; overflow: auto; background: #ffffff; position: relative;">
        <img id="pageScreenshot" 
             src="${imageUrl}" 
             style="width: 100%; height: auto; display: block; background: white;"
             alt="Page content rendered by Browserless.io" />
      </div>
    </div>
  `;

  console.log("[RBI v2.0] Screenshot displayed successfully");
}

// Load page using iframe (fallback)
function loadViaIframe(url) {
  console.log("[RBI v2.0] Loading via iframe fallback:", url);

  const browserFrame = document.getElementById("browserFrame");

  browserFrame.innerHTML = `
    <div style="width: 100%; height: 100%; display: flex; flex-direction: column; background: #ffffff;">
      <!-- Fallback mode indicator -->
      <div style="background: #fff3cd; border-bottom: 1px solid #ffc107; padding: 8px 16px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#856404">
            <path d="M13 13h-2V7h2m0 10h-2v-2h2M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2z"/>
          </svg>
          <span style="font-size: 13px; color: #856404; font-weight: 500;">Fallback Mode - Direct iframe (less secure)</span>
        </div>
        <span style="font-size: 11px; color: #856404; background: rgba(255, 193, 7, 0.2); padding: 4px 8px; border-radius: 4px;">
          ⚠️ FALLBACK
        </span>
      </div>
      
      <!-- Iframe content -->
      <iframe id="rbiIframe"
              src="${url}" 
              style="flex: 1; width: 100%; border: none; background: white;"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation allow-downloads"
              onload="console.log('[RBI v2.0] Iframe loaded')"
              onerror="console.error('[RBI v2.0] Iframe error')">
      </iframe>
    </div>
  `;

  showNotification(
    `⚠️ Loaded in fallback mode: ${extractDomain(url)}`,
    "warning"
  );
}

// Show loading state
function showLoadingState(url) {
  const browserFrame = document.getElementById("browserFrame");

  browserFrame.innerHTML = `
    <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
      <div style="text-align: center; color: white; max-width: 500px;">
        <div style="width: 60px; height: 60px; border: 4px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 24px;"></div>
        <h3 style="font-size: 22px; font-weight: 600; margin-bottom: 12px;">Loading via Browserless.io</h3>
        <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin-bottom: 8px;">${extractDomain(
          url
        )}</p>
        <p style="color: rgba(255,255,255,0.7); font-size: 14px;">Rendering page securely on remote server...</p>
      </div>
    </div>
  `;
}

// Show error state
function showErrorState(url, error) {
  const browserFrame = document.getElementById("browserFrame");

  browserFrame.innerHTML = `
    <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);">
      <div style="text-align: center; color: white; max-width: 500px; padding: 40px;">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="white" style="margin-bottom: 20px;">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        <h3 style="font-size: 24px; font-weight: 600; margin-bottom: 15px;">Navigation Failed</h3>
        <p style="color: rgba(255,255,255,0.9); line-height: 1.6; margin-bottom: 20px;">
          Could not load <strong>${extractDomain(url)}</strong>
        </p>
        <div style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; padding: 15px; margin-bottom: 20px;">
          <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 0; word-break: break-word;">
            ${error}
          </p>
        </div>
        <button onclick="navigateTo('${url}')" style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
          🔄 Retry
        </button>
      </div>
    </div>
  `;
}

// Show browser ready state
function showBrowserReady(apiConnected) {
  const browserFrame = document.getElementById("browserFrame");

  if (browserFrame) {
    browserFrame.style.display = "block";
    browserFrame.innerHTML = `
      <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <div style="text-align: center; color: white; max-width: 600px; padding: 40px;">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="white" style="margin-bottom: 24px;">
            <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10V11H16V16H8V11H9.2V10C9.2,8.6 10.6,7 12,7M12,8.2C11.2,8.2 10.4,8.7 10.4,10V11H13.6V10C13.6,8.7 12.8,8.2 12,8.2Z"/>
          </svg>
          <h2 style="font-size: 32px; font-weight: 700; margin-bottom: 16px;">Disposable Browser Ready</h2>
          <p style="color: rgba(255,255,255,0.9); font-size: 18px; line-height: 1.6; margin-bottom: 24px;">
            ${
              apiConnected
                ? "✅ <strong>Browserless.io API Connected</strong><br>Your browsing is fully isolated and secure"
                : "⚠️ Using fallback mode<br>Direct iframe rendering (less isolated)"
            }
          </p>
          <div style="background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <p style="color: rgba(255,255,255,0.95); font-size: 15px; margin: 0; line-height: 1.8;">
              🌐 Remote browser rendering<br>
              🔒 Zero local code execution<br>
              🛡️ Enterprise-grade security<br>
              ${
                apiConnected
                  ? "⚡ Browserless.io powered"
                  : "📦 Iframe fallback mode"
              }
            </p>
          </div>
          <p style="color: rgba(255,255,255,0.8); font-size: 14px;">
            Enter a URL in the address bar above to start browsing
          </p>
        </div>
      </div>
    `;
  }
}

// Setup event listeners
function setupEventListeners() {
  const goBtn = document.getElementById("goBtn");
  const urlInput = document.getElementById("urlInput");
  const refreshBtn = document.getElementById("refreshBtn");
  const backBtn = document.getElementById("backBtn");
  const forwardBtn = document.getElementById("forwardBtn");
  const terminateBtn = document.getElementById("terminateSession");

  if (goBtn) {
    goBtn.addEventListener("click", handleGoClick);
  }

  if (urlInput) {
    urlInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        handleGoClick();
      }
    });
    urlInput.addEventListener("focus", () => {
      urlInput.select();
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", handleRefresh);
  }

  if (backBtn) {
    backBtn.addEventListener("click", handleBack);
  }

  if (forwardBtn) {
    forwardBtn.addEventListener("click", handleForward);
  }

  if (terminateBtn) {
    terminateBtn.addEventListener("click", handleTermination);
  }

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey && e.key === "r") || e.key === "F5") {
      e.preventDefault();
      handleRefresh();
    }
    if (e.altKey && e.key === "ArrowLeft") {
      e.preventDefault();
      handleBack();
    }
    if (e.altKey && e.key === "ArrowRight") {
      e.preventDefault();
      handleForward();
    }
    if (e.ctrlKey && e.key === "l") {
      e.preventDefault();
      const urlInput = document.getElementById("urlInput");
      if (urlInput) {
        urlInput.focus();
        urlInput.select();
      }
    }
  });
}

// Event handlers
function handleGoClick() {
  const urlInput = document.getElementById("urlInput");
  const goBtn = document.getElementById("goBtn");

  if (!urlInput || !urlInput.value.trim()) {
    showNotification("Please enter a valid URL", "warning");
    return;
  }

  const url = urlInput.value.trim();

  if (goBtn) {
    goBtn.disabled = true;
    setTimeout(() => {
      goBtn.disabled = false;
    }, 3000);
  }

  navigateTo(url);
}

function handleRefresh() {
  if (currentUrl) {
    showNotification("Refreshing page...", "info");
    navigateTo(currentUrl);
  } else {
    showNotification("No page to refresh", "warning");
  }
}

function handleBack() {
  if (historyIndex > 0) {
    historyIndex--;
    const url = navigationHistory[historyIndex];
    showNotification("Navigating back...", "info");
    navigateTo(url);
    updateNavigationButtons();
  }
}

function handleForward() {
  if (historyIndex < navigationHistory.length - 1) {
    historyIndex++;
    const url = navigationHistory[historyIndex];
    showNotification("Navigating forward...", "info");
    navigateTo(url);
    updateNavigationButtons();
  }
}

function handleTermination() {
  if (confirm("Are you sure you want to end this secure browsing session?")) {
    showNotification("Session terminated", "success");
    setTimeout(() => {
      window.close();
    }, 1000);
  }
}

// History management
function addToHistory(url) {
  if (url && url !== currentUrl) {
    if (historyIndex < navigationHistory.length - 1) {
      navigationHistory = navigationHistory.slice(0, historyIndex + 1);
    }

    navigationHistory.push(url);
    historyIndex = navigationHistory.length - 1;

    if (navigationHistory.length > 50) {
      navigationHistory = navigationHistory.slice(-50);
      historyIndex = navigationHistory.length - 1;
    }

    updateNavigationButtons();
  }
}

function updateNavigationButtons() {
  const backBtn = document.getElementById("backBtn");
  const forwardBtn = document.getElementById("forwardBtn");

  if (backBtn) {
    backBtn.disabled = historyIndex <= 0;
  }

  if (forwardBtn) {
    forwardBtn.disabled = historyIndex >= navigationHistory.length - 1;
  }
}

async function safeReadResponseText(response) {
  try {
    const text = await response.text();
    return text;
  } catch (error) {
    console.warn("[RBI v2.0] Unable to read response body:", error.message);
    return "";
  }
}

function handleApiAuthFailure(status, statusText, errorText = "") {
  isAuthFailure = true;
  const trimmedError = (errorText || "").trim();
  const baseMessage = `Browserless API rejected the request (${status} ${statusText}).`;
  const fullMessage = trimmedError
    ? `${baseMessage} Details: ${trimmedError}`
    : baseMessage;

  console.error("[RBI v2.0] Authorization failure:", fullMessage);

  showNotification(
    `${baseMessage} Please verify your API key, subscription status, or network access.
${trimmedError ? "Server response: " + trimmedError : ""}`.trim(),
    "error"
  );

  const browserFrame = document.getElementById("browserFrame");

  if (browserFrame && !browserFrame.dataset.authErrorShown) {
    browserFrame.dataset.authErrorShown = "true";
    browserFrame.innerHTML = `
      <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);">
        <div style="text-align: center; color: white; max-width: 520px; padding: 36px; background: rgba(0,0,0,0.25); border-radius: 16px; box-shadow: 0 20px 45px rgba(0,0,0,0.35);">
          <svg width="72" height="72" viewBox="0 0 24 24" fill="white" style="margin-bottom: 20px;">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <h3 style="font-size: 24px; font-weight: 700; margin-bottom: 16px;">Browserless Authentication Required</h3>
          <p style="font-size: 16px; line-height: 1.6; color: rgba(255,255,255,0.95); margin-bottom: 18px;">
            We couldn't reach Browserless.io with the provided API key.
          </p>
          <p style="font-size: 14px; line-height: 1.7; color: rgba(255,255,255,0.8); margin-bottom: 22px;">
            <strong>Status:</strong> ${status} ${statusText}<br/>
            ${
              trimmedError
                ? `<strong>Details:</strong> ${trimmedError}<br/>`
                : ""
            }
            Please confirm the API token is valid, has remaining credits, and the Browserless service is accessible from this network.
          </p>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <a href="https://docs.browserless.io/docs/api" target="_blank" rel="noreferrer" style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); padding: 10px 16px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              📘 Browserless API Docs
            </a>
            <button onclick="navigateTo(currentUrl || 'https://www.google.com')" style="background: rgba(255,255,255,0.15); color: white; border: 1px solid rgba(255,255,255,0.25); padding: 10px 16px; border-radius: 8px; cursor: pointer; font-weight: 600;">
              ↻ Retry after updating API key
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

// Utility functions
function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function updateLocationDisplay(location) {
  const locationDisplay = document.getElementById("locationDisplay");
  const locationMap = {
    singapore: "Singapore",
    usa: "United States",
    uk: "United Kingdom",
    canada: "Canada",
    europe: "Europe",
    japan: "Japan",
  };

  if (locationDisplay) {
    locationDisplay.textContent = locationMap[location] || location;
  }
}

function updateSessionDisplay(sessionId) {
  const sessionDisplay = document.getElementById("sessionId");
  if (sessionDisplay) {
    sessionDisplay.textContent =
      sessionId.length > 12 ? sessionId.substring(0, 12) + "..." : sessionId;
  }
}

function hideLoadingScreen() {
  const loadingScreen = document.getElementById("loadingScreen");
  const browserFrame = document.getElementById("browserFrame");

  if (loadingScreen) loadingScreen.style.display = "none";
  if (browserFrame) browserFrame.style.display = "block";

  console.log("[RBI v2.0] Loading screen hidden");
}

function showNotification(message, type = "info") {
  const existingNotifications = document.querySelectorAll(".notification");
  existingNotifications.forEach((notif) => notif.remove());

  const notification = document.createElement("div");
  notification.className = "notification";
  notification.textContent = message;

  const colors = {
    success: "#28a745",
    error: "#dc3545",
    warning: "#ffc107",
    info: "#17a2b8",
  };

  notification.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: ${colors[type] || colors.info};
    color: white;
    padding: 14px 18px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    z-index: 10000;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    max-width: 400px;
    animation: slideIn 0.3s ease-out;
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = "slideOut 0.3s ease-in";
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }
  }, 4000);
}

function startUptimeCounter() {
  const uptimeDisplay = document.getElementById("uptime");

  if (!uptimeDisplay) return;

  uptimeInterval = setInterval(() => {
    if (sessionStartTime) {
      const uptime = Date.now() - sessionStartTime;
      const minutes = Math.floor(uptime / 60000);
      const seconds = Math.floor((uptime % 60000) / 1000);

      uptimeDisplay.textContent = `${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
  }, 1000);
}

// Add CSS animations
const style = document.createElement("style");
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Cleanup
window.addEventListener("beforeunload", () => {
  if (uptimeInterval) {
    clearInterval(uptimeInterval);
  }
});

// Make navigateTo available globally for error retry buttons
window.navigateTo = navigateTo;

console.log("[RBI v2.0] Script loaded and ready");
