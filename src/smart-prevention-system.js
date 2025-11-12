// Smart Prevention System Content Script
// Handles ad blocking, malicious website detection, and VirusTotal integration

// Use browser-specific API namespace
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

// VirusTotal API Configuration
const VIRUSTOTAL_CONFIG = {
  apiKey: "37485bb784d0a783c2050eea07a90c1ff38e5067528a57cec0357bab55c28639",
  baseUrl: "https://www.virustotal.com/api/v3",
  endpoints: {
    urlScan: "/urls",
    fileScan: "/files",
    urlReport: "/urls/{id}",
    fileReport: "/files/{id}",
    domainInfo: "/domains/{domain}",
    ipInfo: "/ip_addresses/{ip}",
  },
};

// Global state for smart prevention system
let smartPreventionEnabled = false;
let adBlockerActive = false;
let maliciousDetectionActive = false;
let virusTotalActive = false;
let urlScanCache = new Map(); // Cache VirusTotal results
let downloadQueue = new Map(); // Track pending downloads

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

// VirusTotal API Functions
class VirusTotalAPI {
  static async scanUrl(url) {
    try {
      console.log("[VirusTotal] Scanning URL:", url);

      const cacheKey = btoa(url);
      if (urlScanCache.has(cacheKey)) {
        console.log("[VirusTotal] Using cached result for:", url);
        return urlScanCache.get(cacheKey);
      }

      const encodedUrl = this.encodeUrl(url);
      const existingAnalysis = await this.getUrlAnalysis(encodedUrl);
      if (existingAnalysis) {
        const cachedResult = this.parseUrlAnalysis(existingAnalysis);
        urlScanCache.set(cacheKey, cachedResult);
        return cachedResult;
      }

      const submission = await this.submitUrlForScanning(url);
      if (!submission?.data?.id) {
        throw new Error("Scan submission failed");
      }

      const finalAnalysis = await this.pollAnalysisResult(submission.data.id);
      if (finalAnalysis) {
        const parsedResult = this.parseUrlAnalysis(finalAnalysis);
        urlScanCache.set(cacheKey, parsedResult);
        return parsedResult;
      }

      return {
        isMalicious: false,
        isPending: true,
        confidence: 0,
        detections: 0,
        totalEngines: 0,
        message: "Scan submitted to VirusTotal - results pending",
      };
    } catch (error) {
      console.error("[VirusTotal] URL scan error:", error);
      return {
        isMalicious: false,
        isPending: false,
        confidence: 0,
        detections: 0,
        totalEngines: 0,
        error: error.message,
      };
    }
  }

  static parseUrlAnalysis(data) {
    if (!data || !data.attributes) {
      return {
        isMalicious: false,
        confidence: 0,
        detections: 0,
        totalEngines: 0,
        message: "No analysis data available",
      };
    }

    const attributes = data.attributes;
    const stats =
      attributes.last_analysis_stats ||
      attributes.stats ||
      attributes.total_votes;

    if (!stats) {
      return {
        isMalicious: false,
        confidence: 0,
        detections: 0,
        totalEngines: 0,
        message: "No analysis data available",
      };
    }

    const malicious = stats.malicious || 0;
    const suspicious = stats.suspicious || 0;
    const harmless = stats.harmless || 0;
    const undetected = stats.undetected || 0;
    const total = malicious + suspicious + harmless + undetected;

    const detections = malicious + suspicious;
    const confidence = total > 0 ? (detections / total) * 100 : 0;

    return {
      isMalicious: malicious > 0 || suspicious > 2,
      isPending: false,
      confidence,
      detections,
      totalEngines: total,
      details: {
        malicious,
        suspicious,
        harmless,
        undetected,
      },
      message: `${detections}/${total} engines detected threats`,
    };
  }

  static async checkDomain(domain) {
    try {
      console.log("[VirusTotal] Checking domain:", domain);

      const response = await fetch(
        `${VIRUSTOTAL_CONFIG.baseUrl}/domains/${domain}`,
        {
          headers: {
            "x-apikey": VIRUSTOTAL_CONFIG.apiKey,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return this.parseDomainAnalysis(data.data);
      }

      return {
        isMalicious: false,
        reputation: 0,
        categories: [],
        message: "Domain analysis not available",
      };
    } catch (error) {
      console.error("[VirusTotal] Domain check error:", error);
      return {
        isMalicious: false,
        reputation: 0,
        categories: [],
        error: error.message,
      };
    }
  }

  static parseDomainAnalysis(data) {
    if (!data || !data.attributes) {
      return {
        isMalicious: false,
        reputation: 0,
        categories: [],
        message: "No domain data available",
      };
    }

    const attributes = data.attributes;
    const reputation = attributes.reputation || 0;
    const categories = attributes.categories || {};
    const stats = attributes.last_analysis_stats || {};

    const malicious = stats.malicious || 0;
    const suspicious = stats.suspicious || 0;

    return {
      isMalicious: malicious > 0 || reputation < -10,
      reputation,
      categories: Object.keys(categories),
      stats,
      message: `Reputation: ${reputation}, Categories: ${Object.keys(
        categories
      ).join(", ")}`,
    };
  }

  static encodeUrl(url) {
    return btoa(url).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }

  static async getUrlAnalysis(encodedUrl) {
    try {
      const response = await fetch(
        `${VIRUSTOTAL_CONFIG.baseUrl}/urls/${encodedUrl}`,
        {
          headers: {
            "x-apikey": VIRUSTOTAL_CONFIG.apiKey,
          },
        }
      );

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Analysis lookup failed: ${response.status}`);
      }

      const reportData = await response.json();
      return reportData.data;
    } catch (error) {
      console.warn("[VirusTotal] Error retrieving existing analysis:", error);
      return null;
    }
  }

  static async submitUrlForScanning(url) {
    const response = await fetch(`${VIRUSTOTAL_CONFIG.baseUrl}/urls`, {
      method: "POST",
      headers: {
        "x-apikey": VIRUSTOTAL_CONFIG.apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `url=${encodeURIComponent(url)}`,
    });

    if (!response.ok) {
      const message = `Scan submission failed: ${response.status}`;
      console.error("[VirusTotal]", message);
      throw new Error(message);
    }

    return response.json();
  }

  static async pollAnalysisResult(analysisId, attempts = 6, intervalMs = 3000) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (attempt > 0) {
        await this.delay(intervalMs);
      }

      try {
        const response = await fetch(
          `${VIRUSTOTAL_CONFIG.baseUrl}/analyses/${analysisId}`,
          {
            headers: {
              "x-apikey": VIRUSTOTAL_CONFIG.apiKey,
            },
          }
        );

        if (!response.ok) {
          console.warn(
            `[VirusTotal] Analysis polling failed (attempt ${attempt + 1}):`,
            response.status
          );
          continue;
        }

        const analysisData = await response.json();
        const status = analysisData?.data?.attributes?.status;

        if (status === "completed") {
          return analysisData.data;
        }

        if (status === "failed" || status === "error") {
          console.warn(
            `[VirusTotal] Analysis returned failure status: ${status}`
          );
          return null;
        }
      } catch (error) {
        console.warn(
          `[VirusTotal] Error polling analysis (attempt ${attempt + 1}):`,
          error
        );
      }
    }

    return null;
  }

  static delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Real-time URL monitoring
async function checkUrlWithVirusTotal(url) {
  if (!virusTotalActive) return { safe: true };

  try {
    const domain = new URL(url).hostname;

    // Check both URL and domain
    const [urlResult, domainResult] = await Promise.all([
      VirusTotalAPI.scanUrl(url),
      VirusTotalAPI.checkDomain(domain),
    ]);

    const isPending = Boolean(urlResult.isPending);
    const isMalicious = urlResult.isMalicious || domainResult.isMalicious;
    const confidence = Math.max(
      urlResult.confidence || 0,
      domainResult.reputation ? Math.abs(domainResult.reputation) * 10 : 0
    );

    const safe = !isMalicious && !isPending;
    const recommendation = isMalicious
      ? "BLOCK"
      : isPending || confidence > 30
      ? "WARN"
      : "ALLOW";

    return {
      safe,
      confidence: confidence,
      urlAnalysis: urlResult,
      domainAnalysis: domainResult,
      recommendation,
      isPending,
    };
  } catch (error) {
    console.error("[VirusTotal] URL check error:", error);
    return { safe: true, error: error.message };
  }
}

// Download protection
function setupDownloadProtection() {
  // Intercept download attempts
  document.addEventListener(
    "click",
    async (event) => {
      const target = event.target.closest("a[href], button[onclick]");
      if (!target) return;

      const href = target.href || target.getAttribute("onclick");
      if (!href) return;

      // Check if it's a download link
      const downloadPatterns = [
        /\.(exe|msi|dmg|pkg|deb|rpm|zip|rar|7z|tar|gz)$/i,
        /download/i,
        /\/file\//i,
        /attachment/i,
      ];

      const isDownload = downloadPatterns.some((pattern) => pattern.test(href));
      if (!isDownload) return;

      // Prevent default download
      event.preventDefault();
      event.stopPropagation();

      console.log("[VirusTotal] Checking download:", href);
      showDownloadScanningModal(href);

      try {
        const scanResult = await checkUrlWithVirusTotal(href);

        if (scanResult.urlAnalysis?.isPending) {
          showPendingDownloadWarning(href, scanResult);
        } else if (!scanResult.safe) {
          showMaliciousDownloadWarning(href, scanResult);
        } else if (scanResult.recommendation === "WARN") {
          showSuspiciousDownloadWarning(href, scanResult);
        } else {
          hideDownloadScanningModal();
          showDownloadApprovedNotification(href);
          // Allow download to proceed
          window.open(href, "_blank");
        }
      } catch (error) {
        console.error("[VirusTotal] Download check failed:", error);
        hideDownloadScanningModal();
        showDownloadErrorWarning(href, error);
      }
    },
    true
  );
}

// Navigation protection
async function checkPageNavigation() {
  if (!virusTotalActive) return;

  const currentUrl = window.location.href;
  const scanResult = await checkUrlWithVirusTotal(currentUrl);

  if (scanResult.urlAnalysis?.isPending) {
    showSuspiciousPageWarning(currentUrl, scanResult);
  } else if (!scanResult.safe) {
    showMaliciousPageWarning(currentUrl, scanResult);
  } else if (scanResult.recommendation === "WARN") {
    showSuspiciousPageWarning(currentUrl, scanResult);
  }
}

// Initialize smart prevention system
async function initializeSmartPrevention() {
  try {
    // Get smart prevention system status from storage
    const result = await browserAPI.storage.local.get([
      "smartPreventionEnabled",
      "virusTotalEnabled",
    ]);
    smartPreventionEnabled = result.smartPreventionEnabled || false;
    virusTotalActive = result.virusTotalEnabled !== false; // Default to true

    if (smartPreventionEnabled) {
      console.log(
        "[Smart Prevention System] Initializing protection systems..."
      );
      enableProtection();
    }

    if (virusTotalActive) {
      console.log("[Smart Prevention System] VirusTotal integration enabled");
      // Check current page immediately
      setTimeout(checkPageNavigation, 2000);
    }

    // Listen for storage changes
    browserAPI.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "local") {
        if (changes.smartPreventionEnabled) {
          const newValue = changes.smartPreventionEnabled.newValue;
          handlePreventionToggle(newValue);
        }
        if (changes.virusTotalEnabled) {
          virusTotalActive = changes.virusTotalEnabled.newValue;
          console.log(
            `[VirusTotal] ${virusTotalActive ? "Enabled" : "Disabled"}`
          );
        }
      }
    });
  } catch (error) {
    console.error("[Smart Prevention System] Initialization error:", error);
  }
}

// Handle prevention toggle
function handlePreventionToggle(enabled) {
  smartPreventionEnabled = enabled;

  if (enabled) {
    console.log("[Smart Prevention System] Enabling protection systems...");
    enableProtection();
  } else {
    console.log("[Smart Prevention System] Disabling protection systems...");
    disableProtection();
  }
}

// Enable all protection systems
function enableProtection() {
  enableMaliciousDetection();
  enableAdBlocker();
  setupDownloadProtection();
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

// VirusTotal UI Functions
function showDownloadScanningModal(downloadUrl) {
  const modalId = "nullvoid-download-scanning";
  if (document.getElementById(modalId)) return;

  const modal = document.createElement("div");
  modal.id = modalId;
  modal.innerHTML = `
    <div class="nullvoid-modal-container">
      <div class="nullvoid-modal-content">
        <div class="nullvoid-scanning-icon">🔍</div>
        <h3>Scanning Download</h3>
        <p>VirusTotal is checking this file for security threats...</p>
        <div class="nullvoid-download-info">
          <strong>File:</strong> ${downloadUrl.split("/").pop()}
        </div>
        <div class="nullvoid-progress-bar">
          <div class="nullvoid-progress-fill"></div>
        </div>
        <p class="nullvoid-scanning-text">Please wait while we verify this download is safe</p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function hideDownloadScanningModal() {
  const modal = document.getElementById("nullvoid-download-scanning");
  if (modal) modal.remove();
}

function showMaliciousDownloadWarning(downloadUrl, scanResult) {
  hideDownloadScanningModal();

  const warningId = "nullvoid-malicious-download";
  if (document.getElementById(warningId)) return;

  const warning = document.createElement("div");
  warning.id = warningId;
  warning.innerHTML = `
    <div class="nullvoid-warning-container">
      <div class="nullvoid-warning-content">
        <div class="nullvoid-warning-icon">🚨</div>
        <h2>Malicious Download Blocked</h2>
        <p><strong>VirusTotal detected this download as malicious!</strong></p>
        <div class="nullvoid-threat-details">
          <p><strong>File:</strong> ${downloadUrl.split("/").pop()}</p>
          <p><strong>Threat Level:</strong> HIGH RISK</p>
          <p><strong>Detections:</strong> ${
            scanResult.urlAnalysis?.detections || 0
          }/${scanResult.urlAnalysis?.totalEngines || 0} security engines</p>
          <p><strong>Confidence:</strong> ${Math.round(
            scanResult.confidence || 0
          )}%</p>
        </div>
        <div class="nullvoid-warning-buttons">
          <button id="nullvoid-download-close" class="nullvoid-btn-safe">Close</button>
          <button id="nullvoid-download-report" class="nullvoid-btn-info">Report False Positive</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(warning);

  document
    .getElementById("nullvoid-download-close")
    .addEventListener("click", () => {
      warning.remove();
    });

  document
    .getElementById("nullvoid-download-report")
    .addEventListener("click", () => {
      window.open(
        `https://www.virustotal.com/gui/url/${btoa(downloadUrl)}`,
        "_blank"
      );
      warning.remove();
    });
}

function showSuspiciousDownloadWarning(downloadUrl, scanResult) {
  hideDownloadScanningModal();

  const warningId = "nullvoid-suspicious-download";
  if (document.getElementById(warningId)) return;

  const warning = document.createElement("div");
  warning.id = warningId;
  warning.innerHTML = `
    <div class="nullvoid-warning-container">
      <div class="nullvoid-warning-content">
        <div class="nullvoid-warning-icon">⚠️</div>
        <h2>Suspicious Download Detected</h2>
        <p><strong>VirusTotal flagged this download as potentially suspicious.</strong></p>
        <div class="nullvoid-threat-details">
          <p><strong>File:</strong> ${downloadUrl.split("/").pop()}</p>
          <p><strong>Threat Level:</strong> MEDIUM RISK</p>
          <p><strong>Confidence:</strong> ${Math.round(
            scanResult.confidence || 0
          )}%</p>
        </div>
        <div class="nullvoid-warning-buttons">
          <button id="nullvoid-download-block" class="nullvoid-btn-safe">Block Download</button>
          <button id="nullvoid-download-proceed" class="nullvoid-btn-risk">Download Anyway</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(warning);

  document
    .getElementById("nullvoid-download-block")
    .addEventListener("click", () => {
      warning.remove();
    });

  document
    .getElementById("nullvoid-download-proceed")
    .addEventListener("click", () => {
      warning.remove();
      window.open(downloadUrl, "_blank");
    });
}

function showPendingDownloadWarning(downloadUrl, scanResult) {
  hideDownloadScanningModal();

  const warningId = "nullvoid-pending-download";
  if (document.getElementById(warningId)) return;

  const warning = document.createElement("div");
  warning.id = warningId;
  warning.innerHTML = `
    <div class="nullvoid-warning-container">
      <div class="nullvoid-warning-content">
        <div class="nullvoid-warning-icon">⏳</div>
        <h2>Scan In Progress</h2>
        <p><strong>VirusTotal is still analyzing this download.</strong></p>
        <div class="nullvoid-threat-details">
          <p><strong>File:</strong> ${downloadUrl.split("/").pop()}</p>
          <p><strong>Status:</strong> Pending verification</p>
          <p><strong>Advice:</strong> Wait for the scan to finish before downloading.</p>
        </div>
        <div class="nullvoid-warning-buttons">
          <button id="nullvoid-pending-cancel" class="nullvoid-btn-safe">Cancel Download</button>
          <button id="nullvoid-pending-proceed" class="nullvoid-btn-risk">Download Anyway</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(warning);

  document
    .getElementById("nullvoid-pending-cancel")
    .addEventListener("click", () => {
      warning.remove();
    });

  document
    .getElementById("nullvoid-pending-proceed")
    .addEventListener("click", () => {
      warning.remove();
      window.open(downloadUrl, "_blank");
    });
}

function showMaliciousPageWarning(pageUrl, scanResult) {
  const warningId = "nullvoid-malicious-page";
  if (document.getElementById(warningId)) return;

  const warning = document.createElement("div");
  warning.id = warningId;
  warning.innerHTML = `
    <div class="nullvoid-warning-container">
      <div class="nullvoid-warning-content">
        <div class="nullvoid-warning-icon">🚨</div>
        <h2>Malicious Website Detected</h2>
        <p><strong>VirusTotal has flagged this website as malicious!</strong></p>
        <div class="nullvoid-threat-details">
          <p><strong>Domain:</strong> ${new URL(pageUrl).hostname}</p>
          <p><strong>Threat Level:</strong> HIGH RISK</p>
          <p><strong>Detections:</strong> ${
            scanResult.urlAnalysis?.detections || 0
          }/${scanResult.urlAnalysis?.totalEngines || 0} security engines</p>
        </div>
        <div class="nullvoid-warning-buttons">
          <button id="nullvoid-page-back" class="nullvoid-btn-safe">Go Back</button>
          <button id="nullvoid-page-proceed" class="nullvoid-btn-risk">Proceed at My Own Risk</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(warning);

  document
    .getElementById("nullvoid-page-back")
    .addEventListener("click", () => {
      window.history.back();
    });

  document
    .getElementById("nullvoid-page-proceed")
    .addEventListener("click", () => {
      warning.remove();
    });
}

function showSuspiciousPageWarning(pageUrl, scanResult) {
  const warningId = "nullvoid-suspicious-page";
  if (document.getElementById(warningId)) return;

  const isPending = Boolean(scanResult?.urlAnalysis?.isPending);
  const warning = document.createElement("div");
  warning.id = warningId;
  warning.innerHTML = `
    <div class="nullvoid-warning-container">
      <div class="nullvoid-warning-content">
        <div class="nullvoid-warning-icon">${isPending ? "⏳" : "⚠️"}</div>
        <h2>${
          isPending
            ? "Security Scan In Progress"
            : "Suspicious Website Detected"
        }</h2>
        <p><strong>${
          isPending
            ? "VirusTotal is still analyzing this page."
            : "VirusTotal flagged this website as potentially risky."
        }</strong></p>
        <div class="nullvoid-threat-details">
          <p><strong>Domain:</strong> ${new URL(pageUrl).hostname}</p>
          ${
            isPending
              ? "<p><strong>Status:</strong> Pending verification</p>"
              : `<p><strong>Detections:</strong> ${
                  scanResult.urlAnalysis?.detections || 0
                }/${
                  scanResult.urlAnalysis?.totalEngines || 0
                } security engines</p>`
          }
          <p><strong>Recommendation:</strong> ${
            isPending
              ? "Wait for the scan to finish before proceeding."
              : "Proceed only if you trust this site."
          }</p>
        </div>
        <div class="nullvoid-warning-buttons">
          <button id="nullvoid-suspicious-back" class="nullvoid-btn-safe">Go Back</button>
          <button id="nullvoid-suspicious-proceed" class="nullvoid-btn-risk">Proceed Anyway</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(warning);

  document
    .getElementById("nullvoid-suspicious-back")
    .addEventListener("click", () => {
      window.history.back();
      warning.remove();
    });

  document
    .getElementById("nullvoid-suspicious-proceed")
    .addEventListener("click", () => {
      warning.remove();
    });
}

function showDownloadApprovedNotification(downloadUrl) {
  const notification = document.createElement("div");
  notification.className = "nullvoid-notification success";
  notification.innerHTML = `
    <div class="nullvoid-notification-content">
      <span class="nullvoid-notification-icon">✅</span>
      <span>Download verified safe by VirusTotal</span>
    </div>
  `;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add("show");
  }, 100);

  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function showDownloadErrorWarning(downloadUrl, error) {
  hideDownloadScanningModal();

  const warningId = "nullvoid-download-error";
  if (document.getElementById(warningId)) return;

  const warning = document.createElement("div");
  warning.id = warningId;
  warning.innerHTML = `
    <div class="nullvoid-warning-container">
      <div class="nullvoid-warning-content">
        <div class="nullvoid-warning-icon">❌</div>
        <h2>Security Scan Failed</h2>
        <p>Unable to verify download safety with VirusTotal.</p>
        <div class="nullvoid-threat-details">
          <p><strong>File:</strong> ${downloadUrl.split("/").pop()}</p>
          <p><strong>Error:</strong> ${error.message || "Unknown error"}</p>
        </div>
        <div class="nullvoid-warning-buttons">
          <button id="nullvoid-error-block" class="nullvoid-btn-safe">Block Download</button>
          <button id="nullvoid-error-proceed" class="nullvoid-btn-risk">Download at My Risk</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(warning);

  document
    .getElementById("nullvoid-error-block")
    .addEventListener("click", () => {
      warning.remove();
    });

  document
    .getElementById("nullvoid-error-proceed")
    .addEventListener("click", () => {
      warning.remove();
      window.open(downloadUrl, "_blank");
    });
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
        <p><strong>NULL VOID Smart Prevention System</strong> has detected potential security risks on this website.</p>
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
      console.log("[Smart Prevention System] Blocked ad request:", url);
      return Promise.reject(
        new Error("Request blocked by NULL VOID Smart Prevention System")
      );
    }

    return originalFetch.apply(this, arguments);
  };

  // Override XMLHttpRequest
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    if (adBlockerActive && isAdUrl(url)) {
      console.log(
        "[Smart Prevention System] Blocked XMLHttpRequest to ad URL:",
        url
      );
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
    
    /* VirusTotal Modal Styles */
    #nullvoid-download-scanning,
    #nullvoid-malicious-download,
    #nullvoid-suspicious-download,
    #nullvoid-malicious-page,
    #nullvoid-download-error {
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
    
    .nullvoid-modal-container {
      background: #1a1a1a !important;
      border: 2px solid #3b82f6 !important;
      border-radius: 12px !important;
      padding: 32px !important;
      max-width: 500px !important;
      text-align: center !important;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8) !important;
    }
    
    .nullvoid-modal-content h3 {
      color: #3b82f6 !important;
      margin: 16px 0 !important;
      font-size: 24px !important;
      font-weight: bold !important;
    }
    
    .nullvoid-modal-content p {
      color: #ffffff !important;
      margin: 12px 0 !important;
      line-height: 1.5 !important;
      font-size: 16px !important;
    }
    
    .nullvoid-scanning-icon {
      font-size: 48px !important;
      margin-bottom: 16px !important;
      animation: spin 2s linear infinite !important;
    }
    
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    .nullvoid-progress-bar {
      width: 100% !important;
      height: 8px !important;
      background: #374151 !important;
      border-radius: 4px !important;
      margin: 20px 0 !important;
      overflow: hidden !important;
    }
    
    .nullvoid-progress-fill {
      height: 100% !important;
      background: linear-gradient(90deg, #3b82f6, #8b5cf6) !important;
      animation: progress 3s ease-in-out infinite !important;
    }
    
    @keyframes progress {
      0% { width: 0%; }
      50% { width: 70%; }
      100% { width: 100%; }
    }
    
    .nullvoid-threat-details {
      background: rgba(239, 68, 68, 0.1) !important;
      border: 1px solid #ef4444 !important;
      border-radius: 8px !important;
      padding: 16px !important;
      margin: 16px 0 !important;
      text-align: left !important;
    }
    
    .nullvoid-threat-details p {
      margin: 8px 0 !important;
      font-size: 14px !important;
    }
    
    .nullvoid-download-info {
      background: rgba(59, 130, 246, 0.1) !important;
      border: 1px solid #3b82f6 !important;
      border-radius: 8px !important;
      padding: 12px !important;
      margin: 16px 0 !important;
      font-size: 14px !important;
      color: #ffffff !important;
    }
    
    .nullvoid-scanning-text {
      color: #9ca3af !important;
      font-size: 14px !important;
      margin-top: 16px !important;
    }
    
    .nullvoid-btn-info {
      background: #3b82f6 !important;
      color: white !important;
      border: none !important;
      padding: 12px 24px !important;
      border-radius: 6px !important;
      font-size: 16px !important;
      font-weight: bold !important;
      cursor: pointer !important;
      transition: background 0.2s !important;
    }
    
    .nullvoid-btn-info:hover {
      background: #2563eb !important;
    }
    
    /* Notification Styles */
    .nullvoid-notification {
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      background: #1a1a1a !important;
      border-radius: 8px !important;
      padding: 16px 20px !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
      z-index: 999999 !important;
      transform: translateX(400px) !important;
      transition: transform 0.3s ease !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    
    .nullvoid-notification.show {
      transform: translateX(0) !important;
    }
    
    .nullvoid-notification.success {
      border-left: 4px solid #22c55e !important;
    }
    
    .nullvoid-notification-content {
      display: flex !important;
      align-items: center !important;
      gap: 12px !important;
      color: #ffffff !important;
      font-size: 14px !important;
    }
    
    .nullvoid-notification-icon {
      font-size: 18px !important;
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
  document.addEventListener("DOMContentLoaded", initializeSmartPrevention);
} else {
  initializeSmartPrevention();
}

// Export for testing and debugging
if (typeof window !== "undefined") {
  window.nullVoidSmartPrevention = {
    enableProtection,
    disableProtection,
    checkCurrentSite,
    blockAds,
    restoreAds,
    checkUrlWithVirusTotal,
    VirusTotalAPI,

    // Additional testing functions
    getSystemStatus: () => ({
      smartPreventionEnabled,
      adBlockerActive,
      maliciousDetectionActive,
      virusTotalActive,
      cacheSize: urlScanCache.size,
      version: "1.0.0",
    }),

    // Force enable all features for testing
    forceEnable: () => {
      smartPreventionEnabled = true;
      virusTotalActive = true;
      enableProtection();
      console.log("[Smart Prevention System] Force enabled for testing");
    },

    // Test functions
    testAdBlocking: () => {
      const testAds = document.querySelectorAll(
        ".adsbygoogle, .ad, .advertisement"
      );
      console.log(`[Test] Found ${testAds.length} ad elements`);
      blockAds();
      const blockedAds = document.querySelectorAll("[data-nullvoid-blocked]");
      console.log(`[Test] Blocked ${blockedAds.length} ad elements`);
      return { total: testAds.length, blocked: blockedAds.length };
    },

    // Clear cache for testing
    clearCache: () => {
      urlScanCache.clear();
      console.log("[Test] VirusTotal cache cleared");
    },

    // Test malicious detection
    testMaliciousDetection: () => {
      checkCurrentSite();
      console.log("[Test] Malicious detection test triggered");
    },
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    VirusTotalAPI,
    checkUrlWithVirusTotal,
  };
}
