// Remote Browser Isolation JavaScript
console.log("Remote Browser Isolation interface loaded");

// Use browser-specific API namespace
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

let currentLocation = "singapore";
let rbiInstance = null;
let currentUrl = "";

// Initialize the remote browser
document.addEventListener("DOMContentLoaded", () => {
  initializeRemoteBrowser();
  setupEventListeners();
});

async function initializeRemoteBrowser() {
  console.log("Initializing Remote Browser...");

  try {
    // Get location from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const location = urlParams.get("location") || "singapore";
    currentLocation = location;

    // Update location display
    updateLocationDisplay(location);

    // Initialize Browserless RBI service
    rbiInstance = new BrowserlessRBIService({
      containerElement: document.getElementById("browserCanvas"),
      region: location,
      onConnectionStatus: (status) => {
        console.log(`RBI Connection status: ${status}`);
        if (status === "disconnected") {
          showStatus("Remote Browser disconnected. Please try again.", "error");
        }
      },
      onNavigationChange: (data) => {
        if (data && data.url) {
          document.getElementById("urlInput").value = data.url;
          currentUrl = data.url;
        }
      },
      onError: (code, message) => {
        showStatus(`Error: ${message}`, "error");
      },
    });

    // Create RBI session
    await rbiInstance.initialize();
    console.log("Browserless RBI session created successfully");

    // Set up canvas for browser display
    setupBrowserCanvas();

    // Focus on URL input
    const urlInput = document.getElementById("urlInput");
    if (urlInput) {
      urlInput.focus();
    }

    showStatus(
      "Remote Browser Isolation ready. Your connection is secure.",
      "success"
    );
  } catch (error) {
    console.error("Failed to initialize Remote Browser:", error);
    showStatus(
      "Failed to connect to Remote Browser. Please try again.",
      "error"
    );
  }
}

function setupBrowserCanvas() {
  const container = document.getElementById("browserCanvas");
  if (!container) return;

  // Container is ready for the iframe to be inserted by the BrowserlessRBIService
  console.log("Browser container is ready for remote browser content");
}

function setupEventListeners() {
  // Navigation controls
  const backBtn = document.getElementById("backBtn");
  const forwardBtn = document.getElementById("forwardBtn");
  const refreshBtn = document.getElementById("refreshBtn");
  const urlInput = document.getElementById("urlInput");
  const goBtn = document.getElementById("goBtn");

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (rbiInstance) rbiInstance.goBack();
    });
  }

  if (forwardBtn) {
    forwardBtn.addEventListener("click", () => {
      if (rbiInstance) rbiInstance.goForward();
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      if (rbiInstance) rbiInstance.refresh();
    });
  }

  if (urlInput) {
    urlInput.addEventListener("keyup", (event) => {
      if (event.key === "Enter") {
        navigateToUrl(urlInput.value);
      }
    });
  }

  if (goBtn) {
    goBtn.addEventListener("click", () => {
      if (urlInput) navigateToUrl(urlInput.value);
    });
  }

  // Handle keyboard events
  document.addEventListener("keydown", (event) => {
    if (rbiInstance && document.activeElement.id !== "urlInput") {
      rbiInstance.sendKeyboard(event);
    }
  });
}

async function navigateToUrl(url) {
  if (!url) return;

  // Prevent multiple simultaneous navigation calls
  if (navigateToUrl.isNavigating) {
    console.log("Navigation already in progress, skipping");
    return;
  }

  navigateToUrl.isNavigating = true;

  try {
    // Normalize URL
    if (!url.startsWith("http")) {
      url = "https://" + url;
    }

    // Validate URL
    new URL(url);

    showStatus(`Loading ${url}...`, "info");

    if (rbiInstance) {
      await rbiInstance.navigate(url);
      currentUrl = url;
      document.getElementById("urlInput").value = url;
    }
  } catch (error) {
    console.error("Navigation failed:", error);

    // More specific error handling
    if (error.message && error.message.includes("429")) {
      showStatus(
        "Rate limited - please wait before navigating again",
        "warning"
      );
    } else {
      showStatus("Invalid URL or navigation failed", "error");
    }
  } finally {
    // Reset navigation flag after a short delay
    setTimeout(() => {
      navigateToUrl.isNavigating = false;
    }, 1000);
  }
}

// Mouse events are handled directly by the iframe
function handleMouseEvent(event) {
  // No need to handle mouse events manually, as they'll be captured by the iframe
  console.log("Mouse events are handled directly by the remote browser iframe");
}

function updateLocationDisplay(location) {
  const locationBadge = document.getElementById("locationBadge");
  if (!locationBadge) return;

  const flags = {
    singapore: "🇸🇬",
    usa: "🇺🇸",
    uk: "🇬🇧",
    canada: "🇨🇦",
  };

  const names = {
    singapore: "Singapore",
    usa: "United States",
    uk: "United Kingdom",
    canada: "Canada",
  };

  locationBadge.innerHTML = `
    <span class="location-flag">${flags[location] || "🌍"}</span>
    <span class="location-name">${names[location] || location}</span>
  `;
}

function showStatus(message, type = "info") {
  const statusElement = document.getElementById("statusMessage");
  if (!statusElement) return;

  statusElement.textContent = message;
  statusElement.className = `status-message show ${type}`;

  setTimeout(() => {
    statusElement.className = statusElement.className.replace("show", "");
  }, 3000);
}

// Clean up RBI session when tab is closed
window.addEventListener("beforeunload", () => {
  if (rbiInstance) {
    rbiInstance.cleanup();
  }
});
