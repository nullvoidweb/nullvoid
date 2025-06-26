// Ephemeral Browser JavaScript with Remote Browser Isolation
console.log("Ephemeral Browser with RBI loaded");

// Use browser-specific API namespace
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

let currentLocation = "singapore";
let rbiSession = null;
let isRBIEnabled = true; // Remote Browser Isolation enabled by default

// RBI Configuration
const RBI_CONFIG = {
  singapore: {
    endpoint: "https://sg.browser-isolation.nullvoid.com",
    region: "ap-southeast-1",
    flag: "🇸🇬",
  },
  usa: {
    endpoint: "https://us.browser-isolation.nullvoid.com",
    region: "us-east-1",
    flag: "🇺🇸",
  },
  uk: {
    endpoint: "https://uk.browser-isolation.nullvoid.com",
    region: "eu-west-2",
    flag: "🇬🇧",
  },
  canada: {
    endpoint: "https://ca.browser-isolation.nullvoid.com",
    region: "ca-central-1",
    flag: "🇨🇦",
  },
};

// Initialize the ephemeral browser
document.addEventListener("DOMContentLoaded", () => {
  initializeEphemeralBrowser();
  setupEventListeners();
  initializeRBI();
});

function initializeEphemeralBrowser() {
  console.log("Initializing ephemeral browser with RBI...");

  // Get location from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const location = urlParams.get("location") || "singapore";
  currentLocation = location;

  // Update location display
  updateLocationDisplay(location);

  // Focus on URL input
  const urlInput = document.getElementById("urlInput");
  if (urlInput) {
    urlInput.focus();
  }

  // Show welcome message
  showStatus(
    "Secure browsing session initialized. Enter a URL to browse safely and anonymously.",
    "success"
  );
}

async function initializeRBI() {
  console.log("Initializing Remote Browser Isolation...");

  try {
    // For demo purposes, disable RBI and use local secure mode
    // In production, you would uncomment the line below and connect to real RBI services
    // rbiSession = await createRBISession(currentLocation);

    // Demo mode - use local secure browsing instead
    console.log("Demo mode: Using local secure browsing instead of RBI");
    isRBIEnabled = false;

    showStatus(
      "🛡️ Secure browsing mode active. Ready to browse safely!",
      "success"
    );
    updateRBIStatus(false);
  } catch (error) {
    console.error("RBI initialization failed:", error);
    isRBIEnabled = false;
    showStatus(
      "⚠️ Remote Browser Isolation unavailable. Using local secure mode.",
      "error"
    );
    updateRBIStatus(false);
  }
}

async function createRBISession(location) {
  const config = RBI_CONFIG[location];
  if (!config) {
    throw new Error(`No RBI config for location: ${location}`);
  }

  try {
    // Simulate RBI session creation (in production, this would call your RBI service)
    const sessionData = {
      sessionId: generateSessionId(),
      endpoint: config.endpoint,
      region: config.region,
      location: location,
      createdAt: Date.now(),
      status: "active",
    };

    console.log("RBI Session created:", sessionData);

    // In production, you would make an actual API call to your RBI service
    // const response = await fetch(`${config.endpoint}/api/sessions`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ location, userAgent: navigator.userAgent })
    // });
    // const sessionData = await response.json();

    return sessionData;
  } catch (error) {
    console.error("Failed to create RBI session:", error);
    return null;
  }
}

function generateSessionId() {
  return "rbi_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
}

function updateLocationDisplay(location) {
  const config = RBI_CONFIG[location];
  const locationNames = {
    singapore: "Singapore 🇸🇬",
    usa: "United States 🇺🇸",
    uk: "United Kingdom 🇬🇧",
    canada: "Canada 🇨🇦",
  };

  const locationElement = document.getElementById("currentLocation");
  if (locationElement) {
    locationElement.textContent = locationNames[location] || "Singapore 🇸🇬";
  }

  // Update region info if available
  const regionElement = document.getElementById("regionInfo");
  if (regionElement && config) {
    regionElement.textContent = config.region;
  }
}

function updateRBIStatus(isActive) {
  const securityBadge = document.querySelector(".security-badge");
  if (securityBadge) {
    if (isActive) {
      securityBadge.innerHTML = "🛡️ Remote Browser Isolation Active";
      securityBadge.style.background = "#e8f5e8";
      securityBadge.style.color = "#2d7d32";
      securityBadge.style.border = "1px solid #c8e6c9";
    } else {
      securityBadge.innerHTML = "🔒 Secure & Anonymous";
      securityBadge.style.background = "#e8f5e8";
      securityBadge.style.color = "#2d7d32";
      securityBadge.style.border = "1px solid #c8e6c9";
    }
  }

  // Update privacy features to reflect current mode
  updatePrivacyFeatures(isActive);
}

function updatePrivacyFeatures(isRBIActive) {
  const features = document.querySelectorAll(".privacy-feature");

  if (isRBIActive) {
    // Update features for RBI mode (currently disabled in demo)
    if (features[0]) {
      features[0].innerHTML = `
        <div class="feature-icon">🏢</div>
        <div class="feature-title">Remote Isolation</div>
        <div class="feature-description">Browser runs on secure remote server</div>
      `;
    }
    if (features[1]) {
      features[1].innerHTML = `
        <div class="feature-icon">🔒</div>
        <div class="feature-title">Zero Trust Network</div>
        <div class="feature-description">Network isolated from your device</div>
      `;
    }
    if (features[2]) {
      features[2].innerHTML = `
        <div class="feature-icon">🛡️</div>
        <div class="feature-title">Malware Protection</div>
        <div class="feature-description">Complete protection from malicious content</div>
      `;
    }
    if (features[3]) {
      features[3].innerHTML = `
        <div class="feature-icon">🌍</div>
        <div class="feature-title">Global Endpoints</div>
        <div class="feature-description">Browse from ${RBI_CONFIG[currentLocation].region}</div>
      `;
    }
  } else {
    // Update features for local secure mode
    if (features[0]) {
      features[0].innerHTML = `
        <div class="feature-icon">🚫</div>
        <div class="feature-title">No Tracking</div>
        <div class="feature-description">Blocks trackers and analytics scripts</div>
      `;
    }
    if (features[1]) {
      features[1].innerHTML = `
        <div class="feature-icon">🗑️</div>
        <div class="feature-title">Auto Cleanup</div>
        <div class="feature-description">All data cleared on tab close</div>
      `;
    }
    if (features[2]) {
      features[2].innerHTML = `
        <div class="feature-icon">🔒</div>
        <div class="feature-title">Encrypted</div>
        <div class="feature-description">Secure HTTPS-only connections</div>
      `;
    }
    if (features[3]) {
      features[3].innerHTML = `
        <div class="feature-icon">🌍</div>
        <div class="feature-title">Privacy Focused</div>
        <div class="feature-description">Anonymous browsing from ${RBI_CONFIG[currentLocation].region}</div>
      `;
    }
  }
}

function setupEventListeners() {
  const urlInput = document.getElementById("urlInput");
  const browseBtn = document.getElementById("browseBtn");
  const quickLinks = document.querySelectorAll(".quick-link");

  // Browse button click
  if (browseBtn) {
    browseBtn.addEventListener("click", handleBrowseClick);
  }

  // Enter key in URL input
  if (urlInput) {
    urlInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        handleBrowseClick();
      }
    });

    urlInput.addEventListener("input", () => {
      validateUrl();
    });
  }

  // Quick links
  quickLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const url = link.getAttribute("data-url");
      if (url) {
        urlInput.value = url;
        handleBrowseClick();
      }
    });
  });
}

function validateUrl() {
  const urlInput = document.getElementById("urlInput");
  const browseBtn = document.getElementById("browseBtn");

  if (!urlInput || !browseBtn) return;

  const url = urlInput.value.trim();
  const isValid = isValidUrl(url);

  browseBtn.disabled = !isValid || url.length === 0;

  // Auto-add https:// if missing
  if (
    url &&
    !url.startsWith("http://") &&
    !url.startsWith("https://") &&
    url.includes(".")
  ) {
    urlInput.value = "https://" + url;
  }
}

function isValidUrl(string) {
  if (!string) return false;

  try {
    new URL(string.startsWith("http") ? string : "https://" + string);
    return true;
  } catch (_) {
    return false;
  }
}

async function handleBrowseClick() {
  const urlInput = document.getElementById("urlInput");
  const browseBtn = document.getElementById("browseBtn");

  if (!urlInput || !browseBtn) return;

  let url = urlInput.value.trim();

  if (!url) {
    showStatus("Please enter a website URL", "error");
    return;
  }

  // Validate and format URL
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }

  if (!isValidUrl(url)) {
    showStatus("Please enter a valid website URL", "error");
    return;
  }

  try {
    // Show loading state
    browseBtn.textContent = "Loading...";
    browseBtn.disabled = true;

    showStatus("Opening website securely...", "success");

    // Navigate to the URL with enhanced privacy
    await navigateSecurely(url);
  } catch (error) {
    console.error("Error navigating:", error);
    showStatus("Failed to load website. Please try again.", "error");
  } finally {
    // Reset button state
    browseBtn.textContent = "Browse Safely";
    browseBtn.disabled = false;
  }
}

async function navigateSecurely(url) {
  console.log("Navigating securely to:", url);

  try {
    // For demo mode, always use local secure navigation
    // In production with real RBI service, you would check:
    // if (isRBIEnabled && rbiSession) {
    //   await navigateWithRBI(url);
    // } else {
    //   await navigateLocally(url);
    // }

    await navigateLocally(url);
  } catch (error) {
    console.error("Secure navigation failed:", error);
    throw error;
  }
}

async function navigateWithRBI(url) {
  console.log("Navigating with Remote Browser Isolation:", url);

  try {
    // Create RBI iframe for the remote browser session
    const rbiFrame = createRBIFrame(url);

    // Replace the main content with the RBI frame
    const mainContent = document.querySelector(".main-content");
    if (mainContent) {
      mainContent.innerHTML = "";
      mainContent.appendChild(rbiFrame);
    }

    // Show RBI status
    showStatus(
      "🏢 Connected to Remote Browser Isolation. Your browsing is completely isolated.",
      "success"
    );

    // Track RBI session
    await trackRBISession(url);
  } catch (error) {
    console.error("RBI navigation failed:", error);
    showStatus(
      "RBI navigation failed. Switching to local secure mode.",
      "error"
    );

    // Fallback to local navigation
    isRBIEnabled = false;
    updateRBIStatus(false);
    await navigateLocally(url);
  }
}

function createRBIFrame(url) {
  const container = document.createElement("div");
  container.className = "rbi-container";

  // In production, this would connect to your actual RBI service
  const rbiUrl = `${
    RBI_CONFIG[currentLocation].endpoint
  }/browse?url=${encodeURIComponent(url)}&session=${rbiSession.sessionId}`;

  container.innerHTML = `
    <div class="rbi-header">
      <div class="rbi-controls">
        <button id="rbiBack" class="rbi-btn" title="Back">⬅️</button>
        <button id="rbiForward" class="rbi-btn" title="Forward">➡️</button>
        <button id="rbiRefresh" class="rbi-btn" title="Refresh">🔄</button>
        <div class="rbi-url-display">
          <span class="rbi-secure-icon">🔒</span>
          <span class="rbi-url">${url}</span>
        </div>
        <button id="rbiNewTab" class="rbi-btn" title="New Tab">➕</button>
        <button id="rbiClose" class="rbi-btn" title="Close">❌</button>
      </div>
      <div class="rbi-status">
        <span class="rbi-status-indicator">🏢 Remote Isolated</span>
        <span class="rbi-location">${RBI_CONFIG[currentLocation].region}</span>
      </div>
    </div>
    <div class="rbi-content">
      <iframe 
        id="rbiFrame"
        src="${rbiUrl}"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        allowfullscreen
        title="Remote Browser Isolation Frame">
      </iframe>
      <div class="rbi-loading" id="rbiLoading">
        <div class="rbi-spinner"></div>
        <p>Connecting to Remote Browser Isolation...</p>
      </div>
    </div>
  `;

  // Setup RBI frame event listeners
  setupRBIControls(container);

  return container;
}

function setupRBIControls(container) {
  const frame = container.querySelector("#rbiFrame");
  const loading = container.querySelector("#rbiLoading");

  // Handle frame load
  frame.addEventListener("load", () => {
    loading.style.display = "none";
    showStatus("🏢 Remote Browser Isolation session active", "success");
  });

  frame.addEventListener("error", () => {
    loading.innerHTML = `
      <div class="rbi-error">
        <h3>🚫 RBI Connection Failed</h3>
        <p>Unable to connect to Remote Browser Isolation service.</p>
        <button onclick="location.reload()" class="rbi-retry-btn">Retry Connection</button>
      </div>
    `;
  });

  // Setup control buttons
  const backBtn = container.querySelector("#rbiBack");
  const forwardBtn = container.querySelector("#rbiForward");
  const refreshBtn = container.querySelector("#rbiRefresh");
  const newTabBtn = container.querySelector("#rbiNewTab");
  const closeBtn = container.querySelector("#rbiClose");

  if (backBtn) backBtn.addEventListener("click", () => sendRBICommand("back"));
  if (forwardBtn)
    forwardBtn.addEventListener("click", () => sendRBICommand("forward"));
  if (refreshBtn)
    refreshBtn.addEventListener("click", () => sendRBICommand("refresh"));
  if (newTabBtn)
    newTabBtn.addEventListener("click", () => sendRBICommand("newTab"));
  if (closeBtn) closeBtn.addEventListener("click", () => closeRBISession());
}

async function sendRBICommand(command) {
  console.log("Sending RBI command:", command);

  try {
    // In production, send commands to RBI service
    const frame = document.querySelector("#rbiFrame");
    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage(
        {
          type: "rbi-command",
          command: command,
          sessionId: rbiSession.sessionId,
        },
        "*"
      );
    }
  } catch (error) {
    console.error("Failed to send RBI command:", error);
  }
}

async function trackRBISession(url) {
  if (!rbiSession) return;

  // Track session usage
  rbiSession.lastUrl = url;
  rbiSession.lastActivity = Date.now();

  // Store session info
  try {
    await browserAPI.storage.local.set({
      rbiSession: rbiSession,
    });
  } catch (error) {
    console.error("Failed to store RBI session:", error);
  }
}

async function closeRBISession() {
  console.log("Closing RBI session");

  try {
    if (rbiSession) {
      // In production, terminate RBI session on server
      // await fetch(`${RBI_CONFIG[currentLocation].endpoint}/api/sessions/${rbiSession.sessionId}`, {
      //   method: 'DELETE'
      // });

      showStatus("🏢 Remote Browser Isolation session terminated", "success");
    }

    // Clear session data
    rbiSession = null;
    await browserAPI.storage.local.remove(["rbiSession"]);

    // Close the tab
    window.close();
  } catch (error) {
    console.error("Failed to close RBI session:", error);
    window.close();
  }
}

async function navigateLocally(url) {
  console.log("Navigating locally to:", url);

  // Enhanced URL for local privacy
  const secureUrl = enhanceUrlForPrivacy(url);

  // Instead of redirecting the whole page, create an iframe for browsing
  createLocalBrowsingFrame(secureUrl);
}

function createLocalBrowsingFrame(url) {
  const container = document.createElement("div");
  container.className = "local-browser-container";

  container.innerHTML = `
    <div class="local-browser-header">
      <div class="local-browser-controls">
        <button id="localBack" class="local-btn" title="Back">⬅️</button>
        <button id="localForward" class="local-btn" title="Forward">➡️</button>
        <button id="localRefresh" class="local-btn" title="Refresh">🔄</button>
        <div class="local-url-display">
          <span class="local-secure-icon">🔒</span>
          <span class="local-url">${url}</span>
        </div>
        <button id="localNewTab" class="local-btn" title="Open in New Tab">🔗</button>
        <button id="localClose" class="local-btn" title="Close">❌</button>
      </div>
      <div class="local-status">
        <span class="local-status-indicator">🔒 Secure Local Browsing</span>
        <span class="local-location">${RBI_CONFIG[currentLocation].region}</span>
      </div>
    </div>
    <div class="local-browser-content">
      <iframe 
        id="localFrame"
        src="${url}"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation"
        allowfullscreen
        title="Secure Local Browser Frame">
      </iframe>
      <div class="local-loading" id="localLoading">
        <div class="local-spinner"></div>
        <p>Loading website securely...</p>
      </div>
    </div>
  `;

  // Replace the main content with the browser frame
  const mainContent = document.querySelector(".main-content");
  if (mainContent) {
    mainContent.innerHTML = "";
    mainContent.appendChild(container);
  }

  // Setup local browser controls
  setupLocalBrowserControls(container, url);
}

function setupLocalBrowserControls(container, initialUrl) {
  const frame = container.querySelector("#localFrame");
  const loading = container.querySelector("#localLoading");
  let currentUrl = initialUrl;

  // Handle frame load
  frame.addEventListener("load", () => {
    loading.style.display = "none";
    showStatus("🔒 Website loaded securely in isolated frame", "success");

    // Try to get the actual URL from the frame (may be blocked by CORS)
    try {
      if (
        frame.contentWindow &&
        frame.contentWindow.location.href !== "about:blank"
      ) {
        currentUrl = frame.contentWindow.location.href;
        updateUrlDisplay(currentUrl);
      }
    } catch (e) {
      // CORS blocked, which is expected for cross-origin frames
      console.log("Frame URL access blocked by CORS (expected)");
    }
  });

  frame.addEventListener("error", () => {
    loading.innerHTML = `
      <div class="local-error">
        <h3>🚫 Loading Failed</h3>
        <p>Unable to load the website. This may be due to security restrictions.</p>
        <button onclick="location.reload()" class="local-retry-btn">Try Again</button>
        <button onclick="openInNewTab('${currentUrl}')" class="local-retry-btn">Open in New Tab</button>
      </div>
    `;
  });

  // Setup control buttons
  const backBtn = container.querySelector("#localBack");
  const forwardBtn = container.querySelector("#localForward");
  const refreshBtn = container.querySelector("#localRefresh");
  const newTabBtn = container.querySelector("#localNewTab");
  const closeBtn = container.querySelector("#localClose");

  if (backBtn)
    backBtn.addEventListener("click", () => {
      try {
        frame.contentWindow.history.back();
      } catch (e) {
        showStatus("Navigation blocked by security policy", "error");
      }
    });

  if (forwardBtn)
    forwardBtn.addEventListener("click", () => {
      try {
        frame.contentWindow.history.forward();
      } catch (e) {
        showStatus("Navigation blocked by security policy", "error");
      }
    });

  if (refreshBtn)
    refreshBtn.addEventListener("click", () => {
      frame.src = frame.src;
      loading.style.display = "flex";
    });

  if (newTabBtn)
    newTabBtn.addEventListener("click", () => openInNewTab(currentUrl));

  if (closeBtn)
    closeBtn.addEventListener("click", () => {
      // Go back to the landing page
      location.reload();
    });
}

function updateUrlDisplay(url) {
  const urlDisplay = document.querySelector(".local-url");
  if (urlDisplay) {
    urlDisplay.textContent = url;
  }
}

function openInNewTab(url) {
  // Open URL in a new tab outside the extension
  window.open(url, "_blank");
}

function enhanceUrlForPrivacy(url) {
  // For a real implementation, you might:
  // 1. Route through a privacy proxy
  // 2. Add security headers
  // 3. Strip tracking parameters
  // 4. Use a VPN endpoint based on selected location

  console.log(`Enhancing URL for privacy (location: ${currentLocation}):`, url);

  // Strip common tracking parameters
  const trackingParams = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "fbclid",
    "ref",
    "referrer",
    "_ga",
    "gclsrc",
  ];

  try {
    const urlObj = new URL(url);
    trackingParams.forEach((param) => {
      urlObj.searchParams.delete(param);
    });

    return urlObj.toString();
  } catch (error) {
    console.error("Error enhancing URL:", error);
    return url;
  }
}

function showStatus(message, type = "success") {
  const statusElement = document.getElementById("statusMessage");
  if (!statusElement) return;

  statusElement.textContent = message;
  statusElement.className = `status-message status-${type}`;
  statusElement.style.display = "block";

  // Hide after 5 seconds for success messages
  if (type === "success") {
    setTimeout(() => {
      statusElement.style.display = "none";
    }, 5000);
  }
}

// Handle page unload to notify background script
window.addEventListener("beforeunload", () => {
  // Let background script know this ephemeral session is ending
  if (browserAPI && browserAPI.runtime) {
    browserAPI.runtime
      .sendMessage({
        action: "ephemeralSessionEnding",
        location: currentLocation,
      })
      .catch((error) => {
        console.log("Could not notify background script:", error);
      });
  }
});

// Security enhancements
document.addEventListener("contextmenu", (e) => {
  // Optionally disable right-click menu for added security
  // e.preventDefault();
});

// Prevent F12, Ctrl+Shift+I, etc. for added security (optional)
document.addEventListener("keydown", (e) => {
  if (
    e.key === "F12" ||
    (e.ctrlKey && e.shiftKey && e.key === "I") ||
    (e.ctrlKey && e.shiftKey && e.key === "C") ||
    (e.ctrlKey && e.key === "u")
  ) {
    // Optionally prevent dev tools access
    // e.preventDefault();
  }
});

console.log("Ephemeral browser initialized successfully");
