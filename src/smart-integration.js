// Smart Integration Content Script
// Handles ad blocking and malicious website detection

// Use browser-specific API namespace
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

// Global state for smart integration
let smartIntegrationEnabled = false;
let adBlockerActive = false;
let maliciousDetectionActive = false;

// Known malicious domains and patterns (this would be updated from a threat intelligence service)
const MALICIOUS_DOMAINS = [
  "phishing-example.com",
  "malware-site.net",
  "scam-website.org",
  "fake-bank-login.com",
  "suspicious-download.xyz",
];

// Malicious URL patterns
const MALICIOUS_PATTERNS = [
  /phishing/i,
  /malware/i,
  /scam/i,
  /fake.*login/i,
  /suspicious.*download/i,
  /free.*money/i,
  /click.*here.*win/i,
  /urgent.*update.*required/i,
];

// Common ad selectors for blocking
const AD_SELECTORS = [
  // Google Ads
  ".adsbygoogle",
  '[id^="google_ads"]',
  '[class*="google-ad"]',

  // Facebook Ads
  '[data-testid="sponsoredData"]',
  '[data-pagelet="BrowseFeedPagelet"] [data-ft*="ei"]',

  // General ad selectors
  ".ad",
  ".ads",
  ".advertisement",
  ".banner-ad",
  '[class*="ad-"]',
  '[id*="ad-"]',
  '[class*="ads-"]',
  '[class*="banner"]',
  '[class*="sponsor"]',
  ".popup-overlay",
  ".popup-ad",

  // Video ads
  ".video-ads",
  ".preroll-ad",
  ".midroll-ad",

  // Sidebar and footer ads
  ".sidebar-ad",
  ".footer-ad",
  ".header-ad",

  // Social media promoted content
  '[data-promoted="true"]',
  ".promoted-tweet",

  // E-commerce ads
  ".product-ads",
  ".shopping-ads",

  // Native ads
  ".native-ad",
  ".sponsored-content",
  '[aria-label*="advertisement"]',
  '[aria-label*="sponsored"]',
];

// Advanced ad blocking patterns
const AD_URL_PATTERNS = [
  /doubleclick\.net/i,
  /googleadservices\.com/i,
  /googlesyndication\.com/i,
  /amazon-adsystem\.com/i,
  /facebook\.com\/tr/i,
  /google-analytics\.com/i,
  /googletagmanager\.com/i,
  /adsystem\.amazon/i,
  /ads\.yahoo\.com/i,
  /bing\.com\/ads/i,
  /outbrain\.com/i,
  /taboola\.com/i,
  /criteo\.com/i,
  /adsrvr\.org/i,
];

// Initialize smart integration
async function initializeSmartIntegration() {
  try {
    // Get smart integration status from storage
    const result = await browserAPI.storage.local.get([
      "smartIntegrationEnabled",
    ]);
    smartIntegrationEnabled = result.smartIntegrationEnabled || false;

    if (smartIntegrationEnabled) {
      console.log("[Smart Integration] Initializing protection systems...");
      enableProtection();
    }

    // Listen for storage changes
    browserAPI.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "local" && changes.smartIntegrationEnabled) {
        const newValue = changes.smartIntegrationEnabled.newValue;
        handleIntegrationToggle(newValue);
      }
    });
  } catch (error) {
    console.error("[Smart Integration] Initialization error:", error);
  }
}

// Handle integration toggle
function handleIntegrationToggle(enabled) {
  smartIntegrationEnabled = enabled;

  if (enabled) {
    console.log("[Smart Integration] Enabling protection systems...");
    enableProtection();
  } else {
    console.log("[Smart Integration] Disabling protection systems...");
    disableProtection();
  }
}

// Enable all protection systems
function enableProtection() {
  enableMaliciousDetection();
  enableAdBlocker();
  injectProtectionStyles();
}

// Disable all protection systems
function disableProtection() {
  disableMaliciousDetection();
  disableAdBlocker();
  removeProtectionStyles();
}

// Malicious website detection
function enableMaliciousDetection() {
  maliciousDetectionActive = true;
  checkCurrentSite();

  // Monitor navigation changes
  const observer = new MutationObserver(() => {
    if (maliciousDetectionActive) {
      checkForMaliciousContent();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function disableMaliciousDetection() {
  maliciousDetectionActive = false;
  removeMaliciousWarnings();
}

// Check if current site is malicious
function checkCurrentSite() {
  const currentDomain = window.location.hostname;
  const currentUrl = window.location.href;

  // Check against known malicious domains
  if (MALICIOUS_DOMAINS.includes(currentDomain)) {
    showMaliciousWarning(
      "This domain has been flagged as potentially malicious."
    );
    return;
  }

  // Check against malicious patterns
  for (const pattern of MALICIOUS_PATTERNS) {
    if (pattern.test(currentUrl)) {
      showMaliciousWarning(
        "This URL contains suspicious patterns that may indicate malicious content."
      );
      return;
    }
  }

  // Check for suspicious page content
  checkForMaliciousContent();
}

// Check for malicious content on the page
function checkForMaliciousContent() {
  const pageText = document.body.innerText.toLowerCase();
  const suspiciousKeywords = [
    "urgent security alert",
    "your computer is infected",
    "click here to claim",
    "you have won",
    "verify your account immediately",
    "suspended account",
    "immediate action required",
  ];

  for (const keyword of suspiciousKeywords) {
    if (pageText.includes(keyword)) {
      showMaliciousWarning(
        "This page contains content that may be attempting to deceive users."
      );
      break;
    }
  }
}

// Show malicious warning overlay
function showMaliciousWarning(message) {
  if (document.getElementById("nullvoid-malicious-warning")) {
    return; // Warning already shown
  }

  const warningOverlay = document.createElement("div");
  warningOverlay.id = "nullvoid-malicious-warning";
  warningOverlay.innerHTML = `
    <div class="nullvoid-warning-container">
      <div class="nullvoid-warning-content">
        <div class="nullvoid-warning-icon">⚠️</div>
        <h2>Security Warning</h2>
        <p>${message}</p>
        <p><strong>NULL VOID Smart Integration</strong> has detected potential security risks on this website.</p>
        <div class="nullvoid-warning-buttons">
          <button id="nullvoid-go-back" class="nullvoid-btn-safe">Go Back</button>
          <button id="nullvoid-proceed" class="nullvoid-btn-risk">Proceed at My Own Risk</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(warningOverlay);

  // Add event listeners
  document.getElementById("nullvoid-go-back").addEventListener("click", () => {
    window.history.back();
  });

  document.getElementById("nullvoid-proceed").addEventListener("click", () => {
    removeMaliciousWarnings();
  });
}

// Remove malicious warnings
function removeMaliciousWarnings() {
  const warning = document.getElementById("nullvoid-malicious-warning");
  if (warning) {
    warning.remove();
  }
}

// Ad blocker functionality
function enableAdBlocker() {
  adBlockerActive = true;
  blockAds();

  // Monitor for new ads
  const observer = new MutationObserver(() => {
    if (adBlockerActive) {
      blockAds();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Block network requests for ads
  interceptAdRequests();
}

function disableAdBlocker() {
  adBlockerActive = false;
  restoreAds();
}

// Block ads by hiding elements
function blockAds() {
  AD_SELECTORS.forEach((selector) => {
    try {
      const adElements = document.querySelectorAll(selector);
      adElements.forEach((element) => {
        if (!element.hasAttribute("data-nullvoid-blocked")) {
          element.style.display = "none !important";
          element.style.visibility = "hidden !important";
          element.style.opacity = "0 !important";
          element.style.height = "0 !important";
          element.style.width = "0 !important";
          element.setAttribute("data-nullvoid-blocked", "true");
        }
      });
    } catch (error) {
      // Ignore selector errors
    }
  });

  // Block iframes with ad URLs
  const iframes = document.querySelectorAll("iframe");
  iframes.forEach((iframe) => {
    const src = iframe.src || "";
    if (isAdUrl(src) && !iframe.hasAttribute("data-nullvoid-blocked")) {
      iframe.style.display = "none !important";
      iframe.setAttribute("data-nullvoid-blocked", "true");
    }
  });
}

// Restore ads when ad blocker is disabled
function restoreAds() {
  const blockedElements = document.querySelectorAll("[data-nullvoid-blocked]");
  blockedElements.forEach((element) => {
    element.style.display = "";
    element.style.visibility = "";
    element.style.opacity = "";
    element.style.height = "";
    element.style.width = "";
    element.removeAttribute("data-nullvoid-blocked");
  });
}

// Check if URL is an ad URL
function isAdUrl(url) {
  return AD_URL_PATTERNS.some((pattern) => pattern.test(url));
}

// Intercept ad requests
function interceptAdRequests() {
  // Override fetch to block ad requests
  const originalFetch = window.fetch;
  window.fetch = function (resource, options) {
    const url = typeof resource === "string" ? resource : resource.url;

    if (adBlockerActive && isAdUrl(url)) {
      console.log("[Smart Integration] Blocked ad request:", url);
      return Promise.reject(
        new Error("Request blocked by NULL VOID Smart Integration")
      );
    }

    return originalFetch.apply(this, arguments);
  };

  // Override XMLHttpRequest
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    if (adBlockerActive && isAdUrl(url)) {
      console.log("[Smart Integration] Blocked XMLHttpRequest to ad URL:", url);
      this.abort();
      return;
    }

    return originalOpen.apply(this, arguments);
  };
}

// Inject protection styles
function injectProtectionStyles() {
  if (document.getElementById("nullvoid-protection-styles")) {
    return;
  }

  const styles = document.createElement("style");
  styles.id = "nullvoid-protection-styles";
  styles.textContent = `
    /* Malicious Warning Styles */
    #nullvoid-malicious-warning {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background: rgba(0, 0, 0, 0.95) !important;
      z-index: 999999999 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    
    .nullvoid-warning-container {
      background: #1a1a1a !important;
      border: 2px solid #ef4444 !important;
      border-radius: 12px !important;
      padding: 32px !important;
      max-width: 500px !important;
      text-align: center !important;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8) !important;
    }
    
    .nullvoid-warning-content h2 {
      color: #ef4444 !important;
      margin: 16px 0 !important;
      font-size: 24px !important;
      font-weight: bold !important;
    }
    
    .nullvoid-warning-content p {
      color: #ffffff !important;
      margin: 12px 0 !important;
      line-height: 1.5 !important;
      font-size: 16px !important;
    }
    
    .nullvoid-warning-icon {
      font-size: 48px !important;
      margin-bottom: 16px !important;
    }
    
    .nullvoid-warning-buttons {
      margin-top: 24px !important;
      display: flex !important;
      gap: 12px !important;
      justify-content: center !important;
    }
    
    .nullvoid-btn-safe {
      background: #22c55e !important;
      color: white !important;
      border: none !important;
      padding: 12px 24px !important;
      border-radius: 6px !important;
      font-size: 16px !important;
      font-weight: bold !important;
      cursor: pointer !important;
      transition: background 0.2s !important;
    }
    
    .nullvoid-btn-safe:hover {
      background: #16a34a !important;
    }
    
    .nullvoid-btn-risk {
      background: #ef4444 !important;
      color: white !important;
      border: none !important;
      padding: 12px 24px !important;
      border-radius: 6px !important;
      font-size: 16px !important;
      font-weight: bold !important;
      cursor: pointer !important;
      transition: background 0.2s !important;
    }
    
    .nullvoid-btn-risk:hover {
      background: #dc2626 !important;
    }
    
    /* Ad blocking styles */
    [data-nullvoid-blocked] {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      height: 0 !important;
      width: 0 !important;
    }
  `;

  document.head.appendChild(styles);
}

// Remove protection styles
function removeProtectionStyles() {
  const styles = document.getElementById("nullvoid-protection-styles");
  if (styles) {
    styles.remove();
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeSmartIntegration);
} else {
  initializeSmartIntegration();
}

// Export for testing and debugging
window.nullVoidSmartIntegration = {
  enableProtection,
  disableProtection,
  checkCurrentSite,
  blockAds,
  restoreAds,
};
