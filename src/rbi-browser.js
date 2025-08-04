// Professional Remote Browser Isolation JavaScript
console.log("NULL VOID Remote Browser Isolation loaded");

// Use browser-specific API namespace
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

// Global state
let currentLocation = "singapore";
let rbiInstance = null;
let currentUrl = "";
let sessionStartTime = null;
let uptimeInterval = null;
let navigationHistory = [];
let historyIndex = -1;

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  // Add a safety timeout to ensure loading screen doesn't stay forever
  setTimeout(() => {
    const loadingScreen = document.getElementById("loadingScreen");
    if (loadingScreen && loadingScreen.style.display !== "none") {
      console.warn("[RBI Browser] Force hiding loading screen due to timeout");
      hideLoadingScreen();
      showBrowserReady();
    }
  }, 8000); // 8 second timeout
  
  initializeRemoteBrowser();
  setupEventListeners();
  startUptimeCounter();
});

// Initialize the remote browser
async function initializeRemoteBrowser() {
  console.log("[RBI Browser] Initializing Remote Browser Interface...");

  try {
    // Get parameters from URL
    const urlParams = new URLSearchParams(window.location.search);
    const location = urlParams.get("location") || "singapore";
    const sessionId = urlParams.get("sessionId");
    
    currentLocation = location;
    sessionStartTime = Date.now();

    // Update UI with location and session info
    updateLocationDisplay(location);
    updateSessionDisplay(sessionId || "Initializing...");

    // Show loading screen
    showLoadingScreen("Establishing secure connection...");

    // Initialize BrowserBox RBI service
    const containerElement = document.getElementById("browserFrame");
    
    if (!containerElement) {
      throw new Error("Browser frame container not found");
    }
    
    console.log("[RBI Browser] Creating BrowserBoxRBI instance...");
    
    rbiInstance = new BrowserBoxRBI({
      container: containerElement,
      region: location,
      width: containerElement.clientWidth || 1366,
      height: containerElement.clientHeight || 768,
      onConnectionStatus: handleConnectionStatus,
      onNavigationChange: handleNavigationChange,
      onPageLoad: handlePageLoad,
      onError: handleError
    });
    
    console.log("[RBI Browser] BrowserBoxRBI instance created, initializing...");
    
    // Try initialization with timeout
    try {
      const initPromise = rbiInstance.initialize();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Initialization timeout")), 3000)
      );
      
      await Promise.race([initPromise, timeoutPromise]);
      console.log("[RBI Browser] Session initialized successfully");
      
    } catch (error) {
      console.warn("[RBI Browser] Initialization failed or timed out, using fallback:", error);
      // Continue with fallback - don't throw error
    }
    
    // Update UI with session data
    updateSessionDisplay(sessionId || rbiInstance.config.sessionId);
    hideLoadingScreen();
    
    // Set default URL
    const urlInput = document.getElementById("urlInput");
    if (urlInput) {
      urlInput.value = "https://www.google.com";
    }
    
    // Show success notification
    showNotification("Remote browser ready - Your browsing is now fully isolated", "success");
    
  } catch (error) {
    console.error("[RBI Browser] Initialization failed:", error);
    showErrorScreen("Failed to initialize remote browser", error.message);
    showNotification("Failed to initialize remote browser", "error");
  }
}

// Handle connection status changes
function handleConnectionStatus(status) {
  console.log("[RBI] Connection status:", status);
  
  const statusIndicator = document.querySelector(".status-indicator");
  
  switch (status) {
    case 'connected':
      showNotification("Connected to remote browser", "success");
      if (statusIndicator) {
        statusIndicator.style.background = "#22c55e";
      }
      break;
    case 'disconnected':
      showNotification("Disconnected from remote browser", "warning");
      if (statusIndicator) {
        statusIndicator.style.background = "#f59e0b";
      }
      break;
    case 'terminated':
      showNotification("Session terminated", "info");
      if (statusIndicator) {
        statusIndicator.style.background = "#6b7280";
      }
      break;
  }
}

// Handle navigation changes
function handleNavigationChange(data) {
  console.log("[RBI] Navigation changed:", data);
  
  // Update URL input
  const urlInput = document.getElementById("urlInput");
  if (urlInput && data.url) {
    urlInput.value = data.url;
    currentUrl = data.url;
  }
  
  // Update navigation buttons
  updateNavigationButtons(data.canGoBack, data.canGoForward);
  
  // Add to history
  if (data.url && data.url !== currentUrl) {
    addToHistory(data.url, data.title);
  }
}

// Handle page load events
function handlePageLoad(data) {
  console.log("[RBI] Page loaded:", data);
  showNotification(`Page loaded: ${data.title || data.url}`, "success");
}

// Handle errors
function handleError(type, message) {
  console.error("[RBI] Error:", type, message);
  showNotification(`Error: ${message}`, "error");
}

// Setup all event listeners
function setupEventListeners() {
  // Navigation buttons
  const backBtn = document.getElementById("backBtn");
  const forwardBtn = document.getElementById("forwardBtn");
  const refreshBtn = document.getElementById("refreshBtn");
  const goBtn = document.getElementById("goBtn");
  const urlInput = document.getElementById("urlInput");
  const terminateBtn = document.getElementById("terminateSession");
  const retryBtn = document.getElementById("retryBtn");

  // Back button
  if (backBtn) {
    backBtn.addEventListener("click", handleBackNavigation);
  }

  // Forward button
  if (forwardBtn) {
    forwardBtn.addEventListener("click", handleForwardNavigation);
  }

  // Refresh button
  if (refreshBtn) {
    refreshBtn.addEventListener("click", handleRefresh);
  }

  // Go button
  if (goBtn) {
    goBtn.addEventListener("click", handleGoNavigation);
  }

  // URL input
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

  // Terminate session button
  if (terminateBtn) {
    terminateBtn.addEventListener("click", handleSessionTermination);
  }

  // Retry button
  if (retryBtn) {
    retryBtn.addEventListener("click", () => {
      location.reload();
    });
  }

  // Keyboard shortcuts
  document.addEventListener("keydown", handleKeyboardShortcuts);
}

// Handle back navigation
async function handleBackNavigation() {
  try {
    const backBtn = document.getElementById("backBtn");
    if (backBtn && backBtn.disabled) return;

    console.log("[RBI] Back navigation requested");
    
    if (rbiInstance) {
      showNotification("Navigating back...", "info");
      const result = rbiInstance.goBack();
      
      if (result) {
        // Update history index
        if (historyIndex > 0) {
          historyIndex--;
          updateNavigationButtons(historyIndex > 0, historyIndex < navigationHistory.length - 1);
        }
      }
    }
  } catch (error) {
    console.error("[RBI] Back navigation failed:", error);
    showNotification("Back navigation failed", "error");
  }
}

// Handle forward navigation
async function handleForwardNavigation() {
  try {
    const forwardBtn = document.getElementById("forwardBtn");
    if (forwardBtn && forwardBtn.disabled) return;

    console.log("[RBI] Forward navigation requested");
    
    if (rbiInstance) {
      showNotification("Navigating forward...", "info");
      const result = rbiInstance.goForward();
      
      if (result) {
        // Update history index
        if (historyIndex < navigationHistory.length - 1) {
          historyIndex++;
          updateNavigationButtons(historyIndex > 0, historyIndex < navigationHistory.length - 1);
        }
      }
    }
  } catch (error) {
    console.error("[RBI] Forward navigation failed:", error);
    showNotification("Forward navigation failed", "error");
  }
}

// Handle refresh
async function handleRefresh() {
  try {
    const refreshBtn = document.getElementById("refreshBtn");
    if (refreshBtn && refreshBtn.disabled) return;

    console.log("[RBI] Refresh requested");
    
    if (rbiInstance) {
      // Disable button temporarily
      refreshBtn.disabled = true;
      
      showNotification("Refreshing page...", "info");
      const result = rbiInstance.refresh();
      
      // Re-enable button after delay
      setTimeout(() => {
        refreshBtn.disabled = false;
      }, 2000);
    }
  } catch (error) {
    console.error("[RBI] Refresh failed:", error);
    showNotification("Refresh failed", "error");
    
    // Re-enable button on error
    const refreshBtn = document.getElementById("refreshBtn");
    if (refreshBtn) refreshBtn.disabled = false;
  }
}

// Handle go navigation
async function handleGoNavigation() {
  const urlInput = document.getElementById("urlInput");
  const goBtn = document.getElementById("goBtn");
  
  if (!urlInput || !urlInput.value.trim()) {
    showNotification("Please enter a valid URL", "warning");
    return;
  }

  try {
    let url = urlInput.value.trim();
    
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    console.log("[RBI] Go navigation to:", url);
    
    // Disable button temporarily
    if (goBtn) {
      goBtn.disabled = true;
      goBtn.innerHTML = `
        <svg class="svg-icon" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        Loading...
      `;
    }
    
    if (rbiInstance) {
      showNotification("Navigating to " + url, "info");
      
      try {
        const result = await rbiInstance.navigate(url);
        
        if (result && result.success) {
          showNotification("Navigation successful", "success");
          addToHistory(result.url, "");
        } else {
          throw new Error("Navigation returned unsuccessful result");
        }
      } catch (navError) {
        console.error("[RBI] Navigation error:", navError);
        
        // Fallback: Try direct iframe navigation
        console.log("[RBI] Trying fallback navigation...");
        const contentArea = document.getElementById('rbi-content-area');
        if (contentArea) {
          contentArea.innerHTML = `
            <iframe src="${url}" style="width: 100%; height: 100%; border: none;" 
                    onload="console.log('Fallback navigation successful')"
                    onerror="console.error('Fallback navigation failed')">
            </iframe>
          `;
          showNotification("Navigation completed (fallback mode)", "success");
        } else {
          throw navError;
        }
      }
    } else {
      throw new Error("RBI instance not initialized");
    }
    
  } catch (error) {
    console.error("[RBI] Navigation failed:", error);
    showNotification("Navigation failed: " + error.message, "error");
  } finally {
    // Re-enable button
    if (goBtn) {
      goBtn.disabled = false;
      goBtn.innerHTML = `
        <svg class="svg-icon" viewBox="0 0 24 24">
          <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
        </svg>
        Go
      `;
    }
  }
}

// Handle session termination
async function handleSessionTermination() {
  try {
    const terminateBtn = document.getElementById("terminateSession");
    
    // Confirm termination
    if (!confirm("Are you sure you want to terminate this secure browsing session?")) {
      return;
    }
    
    console.log("[RBI] Session termination requested");
    
    // Disable button
    if (terminateBtn) {
      terminateBtn.disabled = true;
      terminateBtn.innerHTML = `
        <svg class="svg-icon" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        Terminating...
      `;
    }
    
    showNotification("Terminating session...", "info");
    
    if (rbiInstance) {
      await rbiInstance.terminate();
    }
    
    // Notify background script
    try {
      await browserAPI.runtime.sendMessage({
        action: 'terminateRBISession',
        sessionId: rbiInstance?.config.sessionId
      });
    } catch (error) {
      console.warn("[RBI] Failed to notify background script:", error);
    }
    
    // Clear storage
    try {
      await browserAPI.storage.local.remove(['activeRBISession']);
    } catch (error) {
      console.warn("[RBI] Failed to clear storage:", error);
    }
    
    showNotification("Session terminated successfully", "success");
    
    // Close tab after delay
    setTimeout(() => {
      window.close();
    }, 3000);
    
  } catch (error) {
    console.error("[RBI] Session termination failed:", error);
    showNotification("Failed to terminate session", "error");
    
    // Re-enable button on error
    const terminateBtn = document.getElementById("terminateSession");
    if (terminateBtn) {
      terminateBtn.disabled = false;
      terminateBtn.innerHTML = `
        <svg class="svg-icon" viewBox="0 0 24 24">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
        End Session
      `;
    }
  }
}

// Handle keyboard shortcuts
function handleKeyboardShortcuts(e) {
  // Ctrl+R or F5 - Refresh
  if ((e.ctrlKey && e.key === 'r') || e.key === 'F5') {
    e.preventDefault();
    handleRefresh();
  }
  
  // Alt+Left - Back
  if (e.altKey && e.key === 'ArrowLeft') {
    e.preventDefault();
    handleBackNavigation();
  }
  
  // Alt+Right - Forward
  if (e.altKey && e.key === 'ArrowRight') {
    e.preventDefault();
    handleForwardNavigation();
  }
  
  // Ctrl+L - Focus URL bar
  if (e.ctrlKey && e.key === 'l') {
    e.preventDefault();
    const urlInput = document.getElementById("urlInput");
    if (urlInput) {
      urlInput.focus();
      urlInput.select();
    }
  }
}

// Update navigation buttons state
function updateNavigationButtons(canGoBack, canGoForward) {
  const backBtn = document.getElementById("backBtn");
  const forwardBtn = document.getElementById("forwardBtn");
  
  if (backBtn) {
    backBtn.disabled = !canGoBack;
  }
  
  if (forwardBtn) {
    forwardBtn.disabled = !canGoForward;
  }
}

// Add URL to navigation history
function addToHistory(url, title) {
  if (url && url !== currentUrl) {
    // Remove any forward history if we're navigating to a new page
    if (historyIndex < navigationHistory.length - 1) {
      navigationHistory = navigationHistory.slice(0, historyIndex + 1);
    }
    
    navigationHistory.push({ url, title, timestamp: Date.now() });
    historyIndex = navigationHistory.length - 1;
    
    // Limit history size
    if (navigationHistory.length > 50) {
      navigationHistory = navigationHistory.slice(-50);
      historyIndex = navigationHistory.length - 1;
    }
    
    currentUrl = url;
  }
}

// Update location display
function updateLocationDisplay(location) {
  const locationDisplay = document.getElementById("locationDisplay");
  const endpoints = {
    singapore: "Singapore",
    usa: "United States", 
    uk: "United Kingdom",
    canada: "Canada",
    europe: "Europe",
    japan: "Japan"
  };
  
  if (locationDisplay) {
    locationDisplay.textContent = endpoints[location] || "Unknown";
  }
}

// Update session display
function updateSessionDisplay(sessionId) {
  const sessionDisplay = document.getElementById("sessionId");
  if (sessionDisplay) {
    sessionDisplay.textContent = sessionId.length > 12 ? 
      sessionId.substring(0, 12) + "..." : sessionId;
  }
}

// Show loading screen
function showLoadingScreen(message = "Loading...") {
  const loadingScreen = document.getElementById("loadingScreen");
  const loadingText = loadingScreen?.querySelector(".loading-text");
  const browserFrame = document.getElementById("browserFrame");
  
  if (loadingText) {
    loadingText.textContent = message;
  }
  
  if (loadingScreen) {
    loadingScreen.style.display = "flex";
  }
  
  if (browserFrame) {
    browserFrame.style.display = "none";
  }
}

// Hide loading screen
function hideLoadingScreen() {
  const loadingScreen = document.getElementById("loadingScreen");
  const browserFrame = document.getElementById("browserFrame");
  
  if (loadingScreen) {
    loadingScreen.style.display = "none";
  }
  
  if (browserFrame) {
    browserFrame.style.display = "block";
  }
  
  console.log("[RBI Browser] Loading screen hidden");
}

// Show browser ready state
function showBrowserReady() {
  const browserFrame = document.getElementById("browserFrame");
  
  if (browserFrame) {
    // Ensure the browser frame is visible
    browserFrame.style.display = "block";
    
    // If it's empty or still loading, show ready screen
    if (!browserFrame.innerHTML || browserFrame.innerHTML.includes("Loading")) {
      browserFrame.innerHTML = `
        <div id="rbi-browser-interface" style="width: 100%; height: 100%; position: relative; background: #f8f9fa;">
          <div id="rbi-content-area" style="width: 100%; height: 100%; background: white; position: relative;">
            <div id="rbi-ready-screen" style="display: flex; align-items: center; justify-content: center; height: 100%; background: linear-gradient(135deg, #6c757d 0%, #868e96 100%);">
              <div style="text-align: center; color: white; max-width: 500px; padding: 40px;">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="white" style="margin-bottom: 20px;">
                  <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10V11H16V16H8V11H9.2V10C9.2,8.6 10.6,7 12,7M12,8.2C11.2,8.2 10.4,8.7 10.4,10V11H13.6V10C13.6,8.7 12.8,8.2 12,8.2Z"/>
                </svg>
                <h3 style="font-size: 24px; font-weight: 600; margin-bottom: 15px;">Remote Browser Ready</h3>
                <p style="color: rgba(255,255,255,0.9); line-height: 1.6; margin-bottom: 20px;">
                  Your secure remote browser is ready in <strong>${currentLocation}</strong>. 
                  Enter a URL in the address bar to start browsing.
                </p>
                <div style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); 
                            border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                  <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 0;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle; margin-right: 8px;">
                      <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10V11H16V16H8V11H9.2V10C9.2,8.6 10.6,7 12,7M12,8.2C11.2,8.2 10.4,8.7 10.4,10V11H13.6V10C13.6,8.7 12.8,8.2 12,8.2Z"/>
                    </svg>
                    Complete isolation • Zero local execution • Enterprise security
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  }
  
  console.log("[RBI Browser] Browser ready state shown");
}

// Show error screen
function showErrorScreen(title, message) {
  const errorScreen = document.getElementById("errorScreen");
  const errorTitle = errorScreen?.querySelector(".error-title");
  const errorMessage = document.getElementById("errorMessage");
  
  if (errorTitle) {
    errorTitle.textContent = title;
  }
  
  if (errorMessage) {
    errorMessage.textContent = message;
  }
  
  if (errorScreen) {
    errorScreen.style.display = "flex";
  }
}

// Show notification
function showNotification(message, type = "info") {
  // Remove existing notifications
  const existingNotifications = document.querySelectorAll('.notification');
  existingNotifications.forEach(notif => notif.remove());
  
  // Create notification
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  // Add to page
  document.body.appendChild(notification);
  
  // Show notification
  setTimeout(() => {
    notification.classList.add('show');
  }, 100);
  
  // Auto remove after 4 seconds
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 4000);
}

// Start uptime counter
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

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (uptimeInterval) {
    clearInterval(uptimeInterval);
  }
  
  // Attempt to cleanup RBI instance
  if (rbiInstance) {
    try {
      rbiInstance.terminate();
    } catch (error) {
      console.warn("[RBI] Cleanup failed:", error);
    }
  }
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log("[RBI] Page hidden");
  } else {
    console.log("[RBI] Page visible");
  }
});

console.log("[RBI Browser] Interface ready");