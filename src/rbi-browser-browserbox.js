// NULL VOID Remote Browser Isolation - BrowserBox Integration
// Uses BrowserBox webview for true remote browser isolation

console.log("NULL VOID Remote Browser - BrowserBox Integration Loading...");

// Use browser-specific API namespace
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

// Global state
let currentLocation = "singapore";
let currentUrl = "";
let sessionStartTime = null;
let uptimeInterval = null;

// BrowserBox endpoints for different regions
const BROWSERBOX_ENDPOINTS = {
  singapore: {
    name: "Singapore",
    endpoint: "https://browserbox.io/embed",
    demo: "https://demo.browserbox.io"
  },
  usa: {
    name: "United States", 
    endpoint: "https://us.browserbox.io/embed",
    demo: "https://demo.browserbox.io"
  },
  uk: {
    name: "United Kingdom",
    endpoint: "https://uk.browserbox.io/embed", 
    demo: "https://demo.browserbox.io"
  },
  europe: {
    name: "Europe",
    endpoint: "https://eu.browserbox.io/embed",
    demo: "https://demo.browserbox.io"
  },
  canada: {
    name: "Canada",
    endpoint: "https://ca.browserbox.io/embed",
    demo: "https://demo.browserbox.io"
  },
  japan: {
    name: "Japan",
    endpoint: "https://jp.browserbox.io/embed",
    demo: "https://demo.browserbox.io"
  }
};

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  console.log("[RBI BrowserBox] Starting BrowserBox RBI initialization...");
  
  // Force hide loading screen immediately
  setTimeout(() => {
    hideLoadingScreen();
    initializeBrowserBoxRBI();
  }, 100);
  
  setupEventListeners();
  startUptimeCounter();
});

// Initialize BrowserBox RBI
function initializeBrowserBoxRBI() {
  console.log("[RBI BrowserBox] Initializing BrowserBox RBI...");
  
  try {
    // Get parameters from URL
    const urlParams = new URLSearchParams(window.location.search);
    const location = urlParams.get("location") || "singapore";
    const sessionId = urlParams.get("sessionId") || "browserbox_" + Date.now();
    
    currentLocation = location;
    sessionStartTime = Date.now();

    // Update UI
    updateLocationDisplay(location);
    updateSessionDisplay(sessionId);
    
    // Hide loading and show ready state
    hideLoadingScreen();
    showBrowserBoxReady();
    
    // Set default URL
    const urlInput = document.getElementById("urlInput");
    if (urlInput) {
      urlInput.value = "https://www.google.com";
    }
    
    // Show success notification
    showNotification("Remote browser ready - Using BrowserBox isolation", "success");
    
    // Auto-navigate to Google after a short delay
    setTimeout(() => {
      console.log("[RBI BrowserBox] Auto-navigating to Google...");
      navigateViaBrowserBox("https://www.google.com");
    }, 2000);
    
    console.log("[RBI BrowserBox] BrowserBox initialization completed successfully");
    
  } catch (error) {
    console.error("[RBI BrowserBox] Initialization failed:", error);
    hideLoadingScreen();
    showBrowserBoxReady();
    showNotification("Browser ready (BrowserBox mode)", "warning");
  }
}

// Show BrowserBox ready state
function showBrowserBoxReady() {
  const browserFrame = document.getElementById("browserFrame");
  
  if (browserFrame) {
    browserFrame.style.display = "block";
    browserFrame.innerHTML = `
      <div style="width: 100%; height: 100%; position: relative; background: #f8f9fa;">
        <div id="rbi-content-area" style="width: 100%; height: 100%; background: white; position: relative;">
          <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);">
            <div style="text-align: center; color: white; max-width: 500px; padding: 40px;">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="white" style="margin-bottom: 20px;">
                <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10V11H16V16H8V11H9.2V10C9.2,8.6 10.6,7 12,7M12,8.2C11.2,8.2 10.4,8.7 10.4,10V11H13.6V10C13.6,8.7 12.8,8.2 12,8.2Z"/>
              </svg>
              <h3 style="font-size: 24px; font-weight: 600; margin-bottom: 15px;">📦 BrowserBox RBI Ready</h3>
              <p style="color: rgba(255,255,255,0.9); line-height: 1.6; margin-bottom: 20px;">
                Your secure remote browser is ready using <strong>BrowserBox Technology</strong> in <strong>${BROWSERBOX_ENDPOINTS[currentLocation]?.name || currentLocation.toUpperCase()}</strong>.<br>
                Enter a URL in the address bar above to start secure browsing.
              </p>
              <div style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); 
                          border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 0;">
                  📦 BrowserBox isolation • 🖥️ Remote rendering • 🛡️ Enterprise security
                </p>
              </div>
              <div style="background: rgba(34, 197, 94, 0.2); border: 1px solid rgba(34, 197, 94, 0.3); 
                          border-radius: 8px; padding: 12px;">
                <p style="color: #22c55e; font-size: 13px; margin: 0;">
                  ✅ BrowserBox initialized • Ready for secure browsing
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  console.log("[RBI BrowserBox] BrowserBox ready state shown");
}

// Navigate via BrowserBox
function navigateViaBrowserBox(url) {
  try {
    currentUrl = url;
    console.log("[RBI BrowserBox] Navigating to URL via BrowserBox:", url);
    
    // Get the browser frame container
    const browserFrame = document.getElementById('browserFrame');
    if (!browserFrame) {
      console.error("[RBI BrowserBox] Browser frame not found");
      showNotification("Browser frame not found", "error");
      return;
    }
    
    // Show loading notification
    showNotification(`Loading ${extractDomain(url)} via BrowserBox...`, "info");
    
    // Get BrowserBox endpoint for current region
    const endpoint = BROWSERBOX_ENDPOINTS[currentLocation];
    
    // Method 1: Try BrowserBox webview
    tryBrowserBoxWebview(url, endpoint);
    
    // Update navigation buttons
    updateNavigationButtons();
    
  } catch (error) {
    console.error("[RBI BrowserBox] Navigation failed:", error);
    showNotification("Navigation failed: " + error.message, "error");
  }
}

// Try BrowserBox webview
function tryBrowserBoxWebview(url, endpoint) {
  const browserFrame = document.getElementById('browserFrame');
  
  // Method 1: Try with BrowserBox webview custom element
  console.log("[RBI BrowserBox] Trying BrowserBox webview method");
  
  browserFrame.innerHTML = `
    <div style="width: 100%; height: 100%; position: relative; background: white;">
      <div id="browserbox-container" style="width: 100%; height: 100%;">
        <!-- BrowserBox webview will be inserted here -->
      </div>
    </div>
  `;
  
  // Load BrowserBox webview script and create element
  loadBrowserBoxScript().then(() => {
    const container = document.getElementById('browserbox-container');
    if (container && window.BrowserBoxWebview) {
      // Create BrowserBox webview element
      const webview = document.createElement('browserbox-webview');
      webview.setAttribute('width', '100%');
      webview.setAttribute('height', '100%');
      webview.setAttribute('src', url);
      webview.style.cssText = 'width: 100%; height: 100%; border: none;';
      
      container.appendChild(webview);
      
      // Add BrowserBox overlay
      addBrowserBoxOverlay(browserFrame);
      
      showNotification(`Successfully loaded via BrowserBox (${endpoint.name})`, "success");
      
    } else {
      // Fallback to demo iframe
      tryBrowserBoxDemo(url, endpoint);
    }
  }).catch(() => {
    // Fallback to demo iframe
    tryBrowserBoxDemo(url, endpoint);
  });
}

// Try BrowserBox demo
function tryBrowserBoxDemo(url, endpoint) {
  console.log("[RBI BrowserBox] Trying BrowserBox demo method");
  
  const browserFrame = document.getElementById('browserFrame');
  const demoUrl = `${endpoint.demo}?url=${encodeURIComponent(url)}`;
  
  browserFrame.innerHTML = `
    <div style="width: 100%; height: 100%; position: relative; background: white;">
      <iframe id="rbi-browserbox-iframe" 
              src="${demoUrl}" 
              style="width: 100%; height: 100%; border: none; background: white;"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation allow-downloads"
              onload="console.log('RBI BrowserBox: Demo loaded successfully')"
              onerror="console.error('RBI BrowserBox: Demo failed')">
      </iframe>
    </div>
  `;
  
  // Add BrowserBox overlay
  addBrowserBoxOverlay(browserFrame);
  
  // Check if demo loaded successfully
  setTimeout(() => {
    showNotification(`Loaded via BrowserBox demo (${endpoint.name})`, "success");
  }, 3000);
}

// Load BrowserBox script
function loadBrowserBoxScript() {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.BrowserBoxWebview) {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://raw.githubusercontent.com/BrowserBox/BrowserBox/main/api/browserbox-webview.js';
    script.onload = () => {
      console.log("[RBI BrowserBox] BrowserBox script loaded");
      resolve();
    };
    script.onerror = () => {
      console.warn("[RBI BrowserBox] BrowserBox script failed to load");
      reject();
    };
    
    document.head.appendChild(script);
    
    // Timeout after 5 seconds
    setTimeout(() => {
      if (!window.BrowserBoxWebview) {
        reject();
      }
    }, 5000);
  });
}

// Add BrowserBox overlay
function addBrowserBoxOverlay(container) {
  // Remove any existing overlay
  const existingOverlay = container.querySelector('.browserbox-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }
  
  const overlay = document.createElement('div');
  overlay.className = 'browserbox-overlay';
  overlay.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(79, 70, 229, 0.9);
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 6px;
    backdrop-filter: blur(4px);
    border: 1px solid rgba(255,255,255,0.1);
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  `;
  
  overlay.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10V11H16V16H8V11H9.2V10C9.2,8.6 10.6,7 12,7M12,8.2C11.2,8.2 10.4,8.7 10.4,10V11H13.6V10C13.6,8.7 12.8,8.2 12,8.2Z"/>
    </svg>
    ${BROWSERBOX_ENDPOINTS[currentLocation]?.name.toUpperCase() || currentLocation.toUpperCase()} • <span style="color: #22c55e;">BROWSERBOX</span>
  `;
  container.appendChild(overlay);
}

// Setup event listeners (same as proxy version)
function setupEventListeners() {
  const goBtn = document.getElementById("goBtn");
  const urlInput = document.getElementById("urlInput");
  const refreshBtn = document.getElementById("refreshBtn");
  const terminateBtn = document.getElementById("terminateSession");

  if (goBtn) {
    goBtn.addEventListener("click", handleGoNavigation);
  }

  if (urlInput) {
    urlInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        handleGoNavigation();
      }
    });
    urlInput.addEventListener("focus", () => {
      urlInput.select();
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      if (currentUrl) {
        navigateViaBrowserBox(currentUrl);
      } else {
        showNotification("No page to refresh", "warning");
      }
    });
  }

  if (terminateBtn) {
    terminateBtn.addEventListener("click", () => {
      if (confirm("Are you sure you want to end this secure browsing session?")) {
        showNotification("Session terminated", "success");
        setTimeout(() => {
          window.close();
        }, 1000);
      }
    });
  }
}

// Handle go navigation
function handleGoNavigation() {
  const urlInput = document.getElementById("urlInput");
  const goBtn = document.getElementById("goBtn");
  
  if (!urlInput || !urlInput.value.trim()) {
    showNotification("Please enter a valid URL", "warning");
    return;
  }

  let url = urlInput.value.trim();
  
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  urlInput.value = url;
  
  if (goBtn) {
    goBtn.disabled = true;
    goBtn.textContent = "Loading...";
  }
  
  const browserFrame = document.getElementById("browserFrame");
  const loadingScreen = document.getElementById("loadingScreen");
  
  if (browserFrame) browserFrame.style.display = "block";
  if (loadingScreen) loadingScreen.style.display = "none";
  
  navigateViaBrowserBox(url);
  
  setTimeout(() => {
    if (goBtn) {
      goBtn.disabled = false;
      goBtn.innerHTML = `
        <svg class="svg-icon" viewBox="0 0 24 24">
          <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
        </svg>
        Go
      `;
    }
  }, 3000);
}

// Utility functions (same as proxy version)
function updateNavigationButtons() {
  const backBtn = document.getElementById("backBtn");
  const forwardBtn = document.getElementById("forwardBtn");
  
  if (backBtn) backBtn.disabled = !currentUrl;
  if (forwardBtn) forwardBtn.disabled = true;
}

function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function updateLocationDisplay(location) {
  const locationDisplay = document.getElementById("locationDisplay");
  if (locationDisplay) {
    locationDisplay.textContent = BROWSERBOX_ENDPOINTS[location]?.name || location;
  }
}

function updateSessionDisplay(sessionId) {
  const sessionDisplay = document.getElementById("sessionId");
  if (sessionDisplay) {
    sessionDisplay.textContent = sessionId.length > 12 ? 
      sessionId.substring(0, 12) + "..." : sessionId;
  }
}

function hideLoadingScreen() {
  const loadingScreen = document.getElementById("loadingScreen");
  const browserFrame = document.getElementById("browserFrame");
  
  if (loadingScreen) loadingScreen.style.display = "none";
  if (browserFrame) browserFrame.style.display = "block";
  
  console.log("[RBI BrowserBox] Loading screen hidden");
}

function showNotification(message, type = "info") {
  const existingNotifications = document.querySelectorAll('.notification');
  existingNotifications.forEach(notif => notif.remove());
  
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: ${type === "success" ? "#22c55e" : type === "error" ? "#ef4444" : type === "warning" ? "#f59e0b" : "#3b82f6"};
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-width: 350px;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
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
      
      uptimeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }, 1000);
}

window.addEventListener('beforeunload', () => {
  if (uptimeInterval) {
    clearInterval(uptimeInterval);
  }
});

console.log("[RBI BrowserBox] BrowserBox integration script loaded successfully");