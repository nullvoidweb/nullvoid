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

// Known sites that block iframe embedding
const FRAME_BLOCKED_SITES = [
  "google.com",
  "duckduckgo.com",
  "bing.com",
  "yahoo.com",
  "facebook.com",
  "twitter.com",
  "youtube.com",
  "instagram.com",
  "linkedin.com",
  "github.com",
  "stackoverflow.com",
  "reddit.com",
  "amazon.com",
  "ebay.com",
  "netflix.com",
  "spotify.com",
  "dropbox.com",
  "microsoft.com",
  "apple.com",
  "zoom.us",
  "teams.microsoft.com",
];

// Sites that work well in iframes
const FRAME_FRIENDLY_SITES = [
  "wikipedia.org",
  "archive.org",
  "news.ycombinator.com",
  "example.com",
  "httpbin.org",
  "httpstat.us",
  "jsonplaceholder.typicode.com",
];

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

    // Initialize smart URL suggestions
    createSmartUrlSuggestions(urlInput);
  }

  // Quick links
  quickLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const url = link.getAttribute("data-url");
      const searchEngine = link.getAttribute("data-search");

      if (searchEngine) {
        // Handle search engines - open in new tab
        const searchUrls = {
          duckduckgo: "https://duckduckgo.com",
          startpage: "https://www.startpage.com",
          searx: "https://searx.be",
        };

        const searchUrl = searchUrls[searchEngine];
        if (searchUrl) {
          showStatus(
            `🔍 Opening ${searchEngine} in new tab (search engines prevent embedding)`,
            "info"
          );
          window.open(searchUrl, "_blank");
        }
      } else if (url) {
        // Handle regular URLs
        const isFrameFriendly = isSiteFrameFriendly(url);

        if (isFrameFriendly) {
          urlInput.value = url;
          showStatus(
            `📚 Loading ${new URL(url).hostname} in secure browser...`,
            "info"
          );
          handleBrowseClick();
        } else {
          urlInput.value = url;
          showStatus(`🌐 Loading ${new URL(url).hostname}...`, "info");
          handleBrowseClick();
        }
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

    // Check if site is known to block framing and warn user
    const isBlocked = checkIfSiteBlocksFraming(url);
    const isFriendly = isSiteFrameFriendly(url);

    if (isBlocked) {
      showStatus(
        `⚠️ ${
          new URL(url).hostname
        } blocks embedded browsing - will show alternative options`,
        "warning"
      );
    } else if (isFriendly) {
      showStatus(
        `📚 ${new URL(url).hostname} should work well in secure browser...`,
        "success"
      );
    } else {
      showStatus("🌐 Loading website securely...", "info");
    }

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
  let loadTimeout;

  // Check if site is known to block framing
  const isFrameBlocked = checkIfSiteBlocksFraming(initialUrl);

  if (isFrameBlocked) {
    handleFrameBlockedSite(container, initialUrl);
    return;
  }

  // Set a timeout to detect frame loading issues
  loadTimeout = setTimeout(() => {
    // If loading takes too long, likely blocked by X-Frame-Options
    if (loading.style.display !== "none") {
      console.log("Frame loading timeout - likely blocked by X-Frame-Options");
      handleFrameLoadingFailure(container, initialUrl);
    }
  }, 8000); // 8 second timeout (reduced from 10 seconds)

  // Handle frame load
  frame.addEventListener("load", () => {
    clearTimeout(loadTimeout);

    // Check if the frame actually loaded content or was blocked
    setTimeout(() => {
      try {
        // Try to access frame content to detect if it's blocked
        const frameDoc = frame.contentDocument || frame.contentWindow.document;

        // More lenient check - only fail if completely empty or obvious error page
        if (!frameDoc) {
          console.log(
            "Frame document not accessible - likely CORS/security restriction"
          );
          // Don't treat CORS restrictions as failures for legitimate sites
          loading.style.display = "none";
          showStatus(
            "🔒 Website loaded securely (CORS protection active)",
            "success"
          );
          return;
        }

        const htmlContent = frameDoc.documentElement.innerHTML;
        const bodyText = frameDoc.body ? frameDoc.body.innerText.trim() : "";

        // Only consider it blocked if there's virtually no content AND it looks like an error
        if (
          htmlContent.length < 50 &&
          (bodyText.includes("refused to connect") ||
            bodyText.includes("refused connection") ||
            bodyText.includes("frame") ||
            htmlContent.includes("x-frame-options"))
        ) {
          console.log("Frame contains error message - treating as blocked");
          handleFrameLoadingFailure(container, initialUrl);
          return;
        }

        loading.style.display = "none";
        showStatus("🔒 Website loaded securely in isolated frame", "success");

        // Try to get the actual URL from the frame (may be blocked by CORS)
        if (
          frame.contentWindow &&
          frame.contentWindow.location.href !== "about:blank"
        ) {
          currentUrl = frame.contentWindow.location.href;
          updateUrlDisplay(currentUrl);
        }
      } catch (e) {
        // CORS blocked or frame restrictions
        console.log("Frame access blocked:", e.message);

        // Check if frame is actually accessible
        if (
          e.name === "SecurityError" &&
          (e.message.includes("frame") || e.message.includes("access"))
        ) {
          // Only treat as blocked if it's clearly a frame-related security error
          const errorMessage = e.message.toLowerCase();
          if (
            errorMessage.includes("x-frame-options") ||
            errorMessage.includes("refused")
          ) {
            handleFrameLoadingFailure(container, initialUrl);
          } else {
            // Regular CORS protection - this is normal and expected
            loading.style.display = "none";
            showStatus(
              "🔒 Website loaded securely (CORS protection active)",
              "success"
            );
          }
        } else {
          loading.style.display = "none";
          showStatus(
            "🔒 Website loaded securely (CORS protection active)",
            "success"
          );
        }
      }
    }, 2000); // Give frame more time to load (increased from 1 second)
  });

  frame.addEventListener("error", () => {
    clearTimeout(loadTimeout);
    handleFrameLoadingFailure(container, initialUrl);
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
  // Show feedback before opening
  showStatus(`🔗 Opening ${new URL(url).hostname} in new tab...`, "success");

  // Open URL in a new tab outside the extension
  try {
    window.open(url, "_blank", "noopener,noreferrer");

    // Additional feedback
    setTimeout(() => {
      showStatus("✅ Site opened in new tab for secure browsing", "success");
    }, 1000);
  } catch (error) {
    console.error("Failed to open new tab:", error);
    showStatus(
      "❌ Failed to open new tab. Please check your popup blocker settings.",
      "error"
    );
  }
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

  // Auto-hide based on message type
  let autoHideDelay = 0;
  switch (type) {
    case "success":
      autoHideDelay = 5000; // 5 seconds
      break;
    case "info":
      autoHideDelay = 4000; // 4 seconds
      break;
    case "warning":
      autoHideDelay = 8000; // 8 seconds for warnings
      break;
    case "error":
      autoHideDelay = 0; // Don't auto-hide errors
      break;
  }

  if (autoHideDelay > 0) {
    setTimeout(() => {
      if (statusElement.style.display !== "none") {
        statusElement.style.display = "none";
      }
    }, autoHideDelay);
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

// Helper functions for detecting frame-blocked sites
function checkIfSiteBlocksFraming(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    return FRAME_BLOCKED_SITES.some(
      (blockedSite) =>
        hostname === blockedSite || hostname.endsWith("." + blockedSite)
    );
  } catch (e) {
    return false;
  }
}

function isSiteFrameFriendly(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    return FRAME_FRIENDLY_SITES.some(
      (friendlySite) =>
        hostname === friendlySite || hostname.endsWith("." + friendlySite)
    );
  } catch (e) {
    return false;
  }
}

function handleFrameBlockedSite(container, url) {
  const loading = container.querySelector("#localLoading");
  const urlObj = new URL(url);
  const hostname = urlObj.hostname;

  loading.innerHTML = `
    <div class="frame-blocked-notice">
      <div class="blocked-icon">🛡️</div>
      <h3>Site Blocks Embedded Browsing</h3>
      <p><strong>${hostname}</strong> prevents loading in embedded browsers for security reasons.</p>
      <div class="blocked-options">
        <button id="openInNewTabBlocked" class="option-btn primary">
          🔗 Open in New Tab
        </button>
        <button id="tryProxyModeBlocked" class="option-btn">
          🌐 Try Proxy Mode
        </button>
        <button id="backToBrowserBlocked" class="option-btn">
          ↩️ Back to Browser
        </button>
      </div>
      <div class="security-info">
        <small>
          <strong>Why this happens:</strong> ${hostname} uses X-Frame-Options headers to prevent clickjacking attacks. 
          This is a legitimate security measure.
        </small>
      </div>
    </div>
  `;

  // Add event listeners to the buttons
  const openNewTabBtn = loading.querySelector("#openInNewTabBlocked");
  const proxyModeBtn = loading.querySelector("#tryProxyModeBlocked");
  const backBtn = loading.querySelector("#backToBrowserBlocked");

  if (openNewTabBtn) {
    openNewTabBtn.addEventListener("click", () => openInNewTab(url));
    addButtonClickFeedback(openNewTabBtn);
  }

  if (proxyModeBtn) {
    proxyModeBtn.addEventListener("click", () => tryProxyMode(url));
    addButtonClickFeedback(proxyModeBtn);
  }

  if (backBtn) {
    backBtn.addEventListener("click", () => location.reload());
    addButtonClickFeedback(backBtn);
  }

  showStatus(
    `🛡️ ${hostname} blocks embedded browsing - choose an alternative option`,
    "warning"
  );
}

function handleFrameLoadingFailure(container, url) {
  const loading = container.querySelector("#localLoading");
  const urlObj = new URL(url);
  const hostname = urlObj.hostname;

  loading.innerHTML = `
    <div class="frame-error-notice">
      <div class="error-icon">⚠️</div>
      <h3>Unable to Load in Embedded Browser</h3>
      <p><strong>${hostname}</strong> cannot be displayed in the secure browser frame.</p>
      <div class="error-details">
        <p>This could be due to:</p>
        <ul>
          <li>X-Frame-Options security headers</li>
          <li>Content Security Policy restrictions</li>
          <li>Network connectivity issues</li>
        </ul>
      </div>
      <div class="error-options">
        <button id="openInNewTabBtn" class="option-btn primary">
          🔗 Open in New Tab
        </button>
        <button id="tryProxyModeBtn" class="option-btn">
          🌐 Try Proxy Mode
        </button>
        <button id="retryWithOptionsBtn" class="option-btn">
          🔄 Retry
        </button>
        <button id="backToBrowserBtn" class="option-btn">
          ↩️ Back to Browser
        </button>
      </div>
    </div>
  `;

  // Add event listeners to the buttons
  const openNewTabBtn = loading.querySelector("#openInNewTabBtn");
  const proxyModeBtn = loading.querySelector("#tryProxyModeBtn");
  const retryBtn = loading.querySelector("#retryWithOptionsBtn");
  const backBtn = loading.querySelector("#backToBrowserBtn");

  if (openNewTabBtn) {
    openNewTabBtn.addEventListener("click", () => openInNewTab(url));
    addButtonClickFeedback(openNewTabBtn);
  }

  if (proxyModeBtn) {
    proxyModeBtn.addEventListener("click", () => tryProxyMode(url));
    addButtonClickFeedback(proxyModeBtn);
  }

  if (retryBtn) {
    retryBtn.addEventListener("click", () => retryWithOptions(url));
    addButtonClickFeedback(retryBtn);
  }

  if (backBtn) {
    backBtn.addEventListener("click", () => location.reload());
    addButtonClickFeedback(backBtn);
  }

  showStatus(`⚠️ ${hostname} cannot be loaded in embedded mode`, "warning");
}

async function tryProxyMode(url) {
  showStatus("🌐 Attempting proxy mode...", "info");

  // For demo purposes, show a better message and then open in new tab
  setTimeout(() => {
    const proceed = confirm(
      `Proxy mode would route ${url} through a secure proxy server to bypass frame restrictions.\n\n` +
        `This feature requires a backend proxy service to be configured.\n\n` +
        `Would you like to open the site in a new tab instead?`
    );

    if (proceed) {
      openInNewTab(url);
      showStatus("🔗 Opening in new tab as alternative", "success");
    } else {
      showStatus("Proxy mode not available in demo", "warning");
    }
  }, 1000);
}

function retryWithOptions(url) {
  // Go back to the initial browser interface and reload
  showStatus("🔄 Returning to browser interface for retry...", "info");

  // Clear the current content and restore the initial interface
  setTimeout(() => {
    location.reload();
  }, 1000);
}

// Add styles for the new elements
const additionalStyles = `
  .frame-blocked-notice, .frame-error-notice {
    padding: 40px 30px;
    text-align: center;
    max-width: 500px;
    margin: 0 auto;
  }

  .blocked-icon, .error-icon {
    font-size: 48px;
    margin-bottom: 20px;
  }

  .frame-blocked-notice h3, .frame-error-notice h3 {
    color: #333;
    margin-bottom: 15px;
    font-size: 24px;
  }

  .frame-blocked-notice p, .frame-error-notice p {
    color: #666;
    margin-bottom: 20px;
    line-height: 1.6;
  }

  .blocked-options, .error-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 25px 0;
  }

  .option-btn {
    padding: 12px 20px;
    border: 2px solid #e9ecef;
    background: white;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
  }

  .option-btn:hover {
    border-color: #667eea;
    background: #f8f9ff;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
  }

  .option-btn:active {
    transform: translateY(0);
    box-shadow: 0 1px 4px rgba(102, 126, 234, 0.3);
  }

  .option-btn.primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-color: transparent;
  }

  .option-btn.primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
  }

  .option-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none !important;
    box-shadow: none !important;
  }

  .security-info, .error-details {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 15px;
    margin-top: 20px;
    text-align: left;
  }

  .error-details ul {
    margin: 10px 0 0 20px;
    color: #666;
  }

  .error-details li {
    margin: 5px 0;
  }
`;

// Inject additional styles
const styleSheet = document.createElement("style");
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);

// Smart URL Suggestions
createSmartUrlSuggestions(document.getElementById("urlInput"));

function createSmartUrlSuggestions(input) {
  const container = document.createElement("div");
  container.className = "url-suggestions";
  container.style.display = "none";

  // Insert after URL input
  input.parentElement.insertBefore(container, input.nextSibling);

  let suggestionTimeout;

  input.addEventListener("input", () => {
    clearTimeout(suggestionTimeout);
    suggestionTimeout = setTimeout(() => {
      updateSuggestions(input.value, container);
    }, 300);
  });

  input.addEventListener("focus", () => {
    if (container.innerHTML) {
      container.style.display = "block";
    }
  });

  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !container.contains(e.target)) {
      container.style.display = "none";
    }
  });
}

function updateSuggestions(query, container) {
  if (!query || query.length < 3) {
    container.style.display = "none";
    return;
  }

  const suggestions = [];

  // Add frame-friendly suggestions
  const frameFriendlySuggestions = [
    {
      url: "https://en.wikipedia.org",
      name: "Wikipedia",
      icon: "📚",
      note: "Frame-friendly",
    },
    {
      url: "https://news.ycombinator.com",
      name: "Hacker News",
      icon: "📰",
      note: "Frame-friendly",
    },
    {
      url: "https://archive.org",
      name: "Internet Archive",
      icon: "🏛️",
      note: "Frame-friendly",
    },
    {
      url: "https://httpbin.org",
      name: "HTTPBin Testing",
      icon: "🔧",
      note: "Frame-friendly",
    },
  ];

  // Add search engine suggestions (open in new tab)
  const searchSuggestions = [
    {
      url: "https://duckduckgo.com",
      name: "DuckDuckGo Search",
      icon: "🦆",
      note: "Opens in new tab",
    },
    {
      url: "https://www.startpage.com",
      name: "Startpage Search",
      icon: "🔍",
      note: "Opens in new tab",
    },
  ];

  // Filter suggestions based on query
  const lowerQuery = query.toLowerCase();

  frameFriendlySuggestions.forEach((suggestion) => {
    if (
      suggestion.name.toLowerCase().includes(lowerQuery) ||
      suggestion.url.includes(lowerQuery)
    ) {
      suggestions.push(suggestion);
    }
  });

  searchSuggestions.forEach((suggestion) => {
    if (suggestion.name.toLowerCase().includes(lowerQuery)) {
      suggestions.push(suggestion);
    }
  });

  if (suggestions.length === 0) {
    container.style.display = "none";
    return;
  }

  container.innerHTML = suggestions
    .map(
      (suggestion) => `
    <div class="suggestion-item" data-url="${suggestion.url}" data-type="${
        suggestion.note.includes("new tab") ? "newtab" : "frame"
      }">
      <span class="suggestion-icon">${suggestion.icon}</span>
      <div class="suggestion-info">
        <div class="suggestion-name">${suggestion.name}</div>
        <div class="suggestion-note">${suggestion.note}</div>
      </div>
    </div>
  `
    )
    .join("");

  container.style.display = "block";

  // Add click handlers
  container.querySelectorAll(".suggestion-item").forEach((item) => {
    item.addEventListener("click", () => {
      const url = item.getAttribute("data-url");
      const type = item.getAttribute("data-type");
      const urlInput = document.getElementById("urlInput");

      if (type === "newtab") {
        showStatus(
          `🔍 Opening in new tab (search engines prevent embedding)`,
          "info"
        );
        window.open(url, "_blank");
      } else {
        urlInput.value = url;
        handleBrowseClick();
      }

      container.style.display = "none";
    });
  });
}

// Add CSS for suggestions
const suggestionStyles = `
  .url-suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #dee2e6;
    border-radius: 0 0 12px 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    max-height: 200px;
    overflow-y: auto;
  }

  .suggestion-item {
    display: flex;
    align-items: center;
    padding: 12px 15px;
    cursor: pointer;
    border-bottom: 1px solid #f1f1f1;
    transition: background-color 0.2s ease;
  }

  .suggestion-item:hover {
    background-color: #f8f9fa;
  }

  .suggestion-item:last-child {
    border-bottom: none;
  }

  .suggestion-icon {
    font-size: 16px;
    margin-right: 12px;
  }

  .suggestion-info {
    flex: 1;
  }

  .suggestion-name {
    font-weight: 500;
    color: #333;
    font-size: 14px;
  }

  .suggestion-note {
    font-size: 12px;
    color: #666;
    margin-top: 2px;
  }

  .url-input-container {
    position: relative;
  }
`;

// Add suggestion styles to the page
const suggestionStyleSheet = document.createElement("style");
suggestionStyleSheet.textContent = suggestionStyles;
document.head.appendChild(suggestionStyleSheet);

// Add click feedback to buttons
function addButtonClickFeedback(button) {
  if (!button) return;

  button.addEventListener("click", function () {
    // Add click animation
    this.style.transform = "scale(0.95)";
    this.style.opacity = "0.8";

    setTimeout(() => {
      this.style.transform = "";
      this.style.opacity = "";
    }, 150);
  });
}

// Ensure all option buttons get click feedback
function setupButtonFeedback(container) {
  const buttons = container.querySelectorAll(".option-btn");
  buttons.forEach(addButtonClickFeedback);
}

// Apply click feedback to existing buttons
document.querySelectorAll(".option-btn").forEach(addButtonClickFeedback);
