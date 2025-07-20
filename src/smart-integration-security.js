// Smart Integration Security Content Script
// Handles malicious website blocking, file protection, and stealth ad blocking

(function () {
  "use strict";

  // Security state
  let securityEnabled = false;
  let blockedRequests = 0;
  let adsBlocked = 0;
  let isInitialized = false;

  // Stealth mode - make ad blocker undetectable
  const stealthMode = {
    // Override common ad detection methods
    init() {
      this.hideBlockerSignatures();
      this.overrideDetectionMethods();
      this.mimicNormalBehavior();
    },

    hideBlockerSignatures() {
      // Hide the fact that we're blocking ads
      Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
        get: function () {
          const originalValue = Object.getOwnPropertyDescriptor(
            Element.prototype,
            "offsetHeight"
          ).get.call(this);
          // If element is ad-blocked (display: none), fake normal height
          if (
            this.style.display === "none" &&
            this.hasAttribute("data-nullvoid-blocked")
          ) {
            return 250; // Fake normal ad height
          }
          return originalValue;
        },
        configurable: true,
      });

      Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
        get: function () {
          const originalValue = Object.getOwnPropertyDescriptor(
            Element.prototype,
            "offsetWidth"
          ).get.call(this);
          if (
            this.style.display === "none" &&
            this.hasAttribute("data-nullvoid-blocked")
          ) {
            return 300; // Fake normal ad width
          }
          return originalValue;
        },
        configurable: true,
      });

      // Override clientHeight/clientWidth for blocked ads
      Object.defineProperty(HTMLElement.prototype, "clientHeight", {
        get: function () {
          const originalValue = Object.getOwnPropertyDescriptor(
            Element.prototype,
            "clientHeight"
          ).get.call(this);
          if (
            this.style.display === "none" &&
            this.hasAttribute("data-nullvoid-blocked")
          ) {
            return 250;
          }
          return originalValue;
        },
        configurable: true,
      });

      Object.defineProperty(HTMLElement.prototype, "clientWidth", {
        get: function () {
          const originalValue = Object.getOwnPropertyDescriptor(
            Element.prototype,
            "clientWidth"
          ).get.call(this);
          if (
            this.style.display === "none" &&
            this.hasAttribute("data-nullvoid-blocked")
          ) {
            return 300;
          }
          return originalValue;
        },
        configurable: true,
      });
    },

    overrideDetectionMethods() {
      // Override getComputedStyle for blocked ads
      const originalGetComputedStyle = window.getComputedStyle;
      window.getComputedStyle = function (element, pseudoElt) {
        const styles = originalGetComputedStyle.call(this, element, pseudoElt);
        if (
          element.hasAttribute &&
          element.hasAttribute("data-nullvoid-blocked")
        ) {
          return new Proxy(styles, {
            get(target, prop) {
              if (prop === "display") return "block";
              if (prop === "visibility") return "visible";
              if (prop === "opacity") return "1";
              return target[prop];
            },
          });
        }
        return styles;
      };

      // Override querySelector to hide our blocking
      const originalQuerySelector = Document.prototype.querySelector;
      Document.prototype.querySelector = function (selector) {
        // If website is trying to detect ad blockers, return fake elements
        if (
          selector.includes("ad") &&
          selector.includes('[style*="display: none"]')
        ) {
          return null; // Hide evidence of blocking
        }
        return originalQuerySelector.call(this, selector);
      };
    },

    mimicNormalBehavior() {
      // Create fake ad elements to fool detection scripts
      this.createFakeAdElements();

      // Simulate ad loading delays
      setTimeout(() => {
        this.simulateAdNetworkResponses();
      }, Math.random() * 2000 + 1000);
    },

    createFakeAdElements() {
      // Create invisible but "present" ad containers
      ["google_ads_iframe_1", "google_ads_iframe_2"].forEach((id, index) => {
        if (!document.getElementById(id)) {
          const fakeAd = document.createElement("div");
          fakeAd.id = id;
          fakeAd.style.cssText = `
            position: absolute !important;
            top: -9999px !important;
            left: -9999px !important;
            width: 300px !important;
            height: 250px !important;
            opacity: 0 !important;
            pointer-events: none !important;
          `;
          fakeAd.innerHTML = `<iframe src="about:blank" width="300" height="250"></iframe>`;
          document.body.appendChild(fakeAd);
        }
      });
    },

    simulateAdNetworkResponses() {
      // Fake Google AdSense responses
      window.googletag = window.googletag || { cmd: [] };
      window.googletag.display = function () {
        return true;
      };
      window.googletag.defineSlot = function () {
        return {
          addService: function () {
            return this;
          },
        };
      };

      // Fake Amazon A9 responses
      window.apstag = window.apstag || {
        init: function () {},
        fetchBids: function () {},
      };

      // Fake common ad networks
      window.pbjs = window.pbjs || {
        que: [],
        addAdUnits: function () {},
        requestBids: function () {},
      };
    },
  };

  // Known malicious domains and patterns
  const maliciousDomains = [
    "phishing-site.com",
    "fake-bank.net",
    "malware-download.org",
    "scam-website.net",
    "suspicious-domain.com",
  ];

  // Known malicious file patterns
  const dangerousFilePatterns = [
    /\.exe$/i,
    /\.scr$/i,
    /\.bat$/i,
    /\.cmd$/i,
    /\.com$/i,
    /\.pif$/i,
    /\.vbs$/i,
    /\.js$/i,
    /\.jar$/i,
    /\.apk$/i,
    /\.msi$/i,
    /\.app$/i,
    /\.deb$/i,
    /\.rpm$/i,
    /\.dmg$/i,
  ];

  // Advanced ad blocking - multiple detection methods
  const advancedAdBlocker = {
    // Advanced selectors for modern ads
    selectors: [
      // Standard ad containers
      ".ad",
      ".ads",
      ".advertisement",
      ".banner",
      ".promo",
      ".sponsored",
      ".ad-container",
      ".ad-banner",
      ".ad-content",
      ".ad-wrapper",
      ".advertisement-banner",
      ".advertising",
      ".adsense",
      ".adnxs",

      // Google Ads
      '[id*="google_ads"]',
      '[class*="google-ads"]',
      "ins.adsbygoogle",
      'iframe[src*="googlesyndication"]',
      'iframe[src*="doubleclick"]',

      // Social media ads
      '[data-testid="placementTracking"]',
      '[data-ad-preview="message"]',
      "div[data-ad]",
      '[aria-label*="Sponsored"]',
      "[data-sponsor]",

      // E-commerce ads
      ".sponsored-products",
      ".sponsored-product",
      ".s-sponsored-list-item",
      '[data-component-type="s-sponsored-result"]',

      // Video ads
      ".video-ads",
      ".preroll-ads",
      ".midroll-ads",
      ".overlay-ads",

      // Native ads
      ".native-ad",
      ".content-ad",
      ".recommended-ad",
      ".promoted-content",

      // Popup and overlay ads
      ".popup-ad",
      ".overlay-ad",
      ".modal-ad",
      ".interstitial-ad",

      // Sidebar ads
      ".sidebar-ad",
      ".rail-ad",
      ".right-rail",
      ".left-rail",

      // Header/footer ads
      ".header-ad",
      ".footer-ad",
      ".top-banner",
      ".bottom-banner",
    ],

    // Text-based detection for native ads
    suspiciousText: [
      /promoted/i,
      /sponsored/i,
      /advertisement/i,
      /ad\s*$/i,
      /casino/i,
      /betting/i,
      /loan/i,
      /credit/i,
      /insurance/i,
      /weight.*loss/i,
      /diet.*pills/i,
      /miracle.*cure/i,
      /click.*here/i,
      /limited.*time/i,
      /act.*now/i,
    ],

    // Stealth blocking method
    stealthBlock(element) {
      if (!element || element.hasAttribute("data-nullvoid-blocked")) return;

      // Mark as blocked for our tracking
      element.setAttribute("data-nullvoid-blocked", "true");

      // Instead of display:none, use more subtle methods
      const blockingMethods = [
        () => {
          // Method 1: Move off-screen
          element.style.cssText += `
            position: absolute !important;
            top: -9999px !important;
            left: -9999px !important;
            opacity: 0 !important;
            pointer-events: none !important;
          `;
        },
        () => {
          // Method 2: Zero dimensions
          element.style.cssText += `
            width: 0 !important;
            height: 0 !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
          `;
        },
        () => {
          // Method 3: Clip to invisible
          element.style.cssText += `
            clip: rect(0,0,0,0) !important;
            clip-path: inset(100%) !important;
            position: absolute !important;
          `;
        },
      ];

      // Randomly choose blocking method to avoid detection patterns
      const method =
        blockingMethods[Math.floor(Math.random() * blockingMethods.length)];
      method();

      adsBlocked++;
    },

    // Content-based ad detection
    isAdByContent(element) {
      const text = element.textContent || "";
      const html = element.innerHTML || "";

      // Check for suspicious text patterns
      if (this.suspiciousText.some((pattern) => pattern.test(text))) {
        return true;
      }

      // Check for ad-related attributes
      const attributes = Array.from(element.attributes || []);
      const adAttributes = attributes.some((attr) =>
        /ad|sponsor|promo|banner/i.test(attr.name + attr.value)
      );

      if (adAttributes) return true;

      // Check for suspicious URLs in iframes/images
      const urls = [];
      if (element.src) urls.push(element.src);
      if (element.href) urls.push(element.href);

      const adDomains = [
        "doubleclick",
        "googlesyndication",
        "googleadservices",
        "amazon-adsystem",
        "adsystem",
        "adnxs",
        "adsafeprotected",
        "adsrvr",
        "facebook.com/tr",
        "outbrain",
        "taboola",
      ];

      return urls.some((url) =>
        adDomains.some((domain) => url.includes(domain))
      );
    },

    // Advanced scanning
    scanForAds() {
      if (!securityEnabled) return;

      // Scan by selectors
      this.selectors.forEach((selector) => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach((el) => this.stealthBlock(el));
        } catch (e) {
          // Ignore selector errors
        }
      });

      // Scan by content
      const allElements = document.querySelectorAll(
        "div, span, section, article, aside, iframe, img"
      );
      allElements.forEach((element) => {
        if (this.isAdByContent(element)) {
          this.stealthBlock(element);
        }
      });

      // Block ad scripts
      this.blockAdScripts();
    },

    blockAdScripts() {
      const adScriptDomains = [
        "googlesyndication.com",
        "doubleclick.net",
        "amazon-adsystem.com",
        "adsystem.com",
        "facebook.com/tr",
        "outbrain.com",
        "taboola.com",
      ];

      document.querySelectorAll("script[src]").forEach((script) => {
        const src = script.src;
        if (adScriptDomains.some((domain) => src.includes(domain))) {
          script.remove();
          adsBlocked++;
        }
      });
    },
  };

  // Initialize security system only when enabled
  async function initSecurity() {
    if (isInitialized) return;

    // Check if security is enabled
    const isEnabled = await checkSecurityStatus();
    if (!isEnabled) {
      securityEnabled = false;
      return;
    }

    securityEnabled = true;
    isInitialized = true;

    console.log("[NULL VOID] Security systems initializing...");

    // Initialize stealth mode first
    stealthMode.init();

    // Set up all security features
    setupMalwareDetection();
    setupFileProtection();
    setupStealthAdBlocking();
    setupRealTimeMonitoring();

    console.log("[NULL VOID] Security systems active");
  }

  // Completely disable all security features
  function disableSecurity() {
    securityEnabled = false;
    isInitialized = false;

    console.log("[NULL VOID] Disabling all security features...");

    // Remove all active warnings and overlays
    document.querySelectorAll('[id*="nullvoid"]').forEach((el) => el.remove());

    // Restore blocked ads by removing our attributes and styles
    document.querySelectorAll("[data-nullvoid-blocked]").forEach((el) => {
      el.removeAttribute("data-nullvoid-blocked");
      // Reset styles
      el.style.position = "";
      el.style.top = "";
      el.style.left = "";
      el.style.opacity = "";
      el.style.pointerEvents = "";
      el.style.width = "";
      el.style.height = "";
      el.style.overflow = "";
      el.style.margin = "";
      el.style.padding = "";
      el.style.clip = "";
      el.style.clipPath = "";
      el.style.display = "";
    });

    // Clear all event listeners by cloning and replacing elements
    const elementsWithListeners = document.querySelectorAll("a, form");
    elementsWithListeners.forEach((el) => {
      if (el.hasAttribute("data-nullvoid-protected")) {
        const newElement = el.cloneNode(true);
        newElement.removeAttribute("data-nullvoid-protected");
        el.parentNode.replaceChild(newElement, el);
      }
    });

    // Disconnect all observers
    if (window.nullVoidObservers) {
      window.nullVoidObservers.forEach((observer) => observer.disconnect());
      window.nullVoidObservers = [];
    }

    console.log("[NULL VOID] All security features disabled");
  }

  async function checkSecurityStatus() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "getSecurityStatus",
      });
      return response && response.enabled;
    } catch (error) {
      console.warn("[NULL VOID] Could not check security status:", error);
      return false; // Default to disabled for safety
    }
  }

  function setupMalwareDetection() {
    if (!securityEnabled) return;

    // Check current domain
    const currentDomain = window.location.hostname;

    if (isMaliciousDomain(currentDomain)) {
      blockMaliciousWebsite(currentDomain);
      return;
    }

    // Monitor for suspicious activities
    monitorSuspiciousContent();
  }

  function isMaliciousDomain(domain) {
    return maliciousDomains.some((malicious) => {
      return (
        domain.includes(malicious) ||
        domain.match(new RegExp(malicious.replace(/\./g, "\\.")))
      );
    });
  }

  function blockMaliciousWebsite(domain) {
    if (!securityEnabled) return;

    // Create warning overlay
    const overlay = document.createElement("div");
    overlay.id = "nullvoid-security-warning";
    overlay.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: Arial, sans-serif;
      ">
        <div style="
          background: white;
          padding: 40px;
          border-radius: 10px;
          max-width: 500px;
          text-align: center;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        ">
          <div style="color: #e74c3c; font-size: 48px; margin-bottom: 20px;">⚠️</div>
          <h2 style="color: #e74c3c; margin-bottom: 20px;">Dangerous Website Blocked</h2>
          <p style="margin-bottom: 20px; line-height: 1.6;">
            NULL VOID has detected that <strong>${domain}</strong> is potentially malicious and may harm your device or steal your information.
          </p>
          <div style="margin-bottom: 30px;">
            <button id="nullvoid-go-back" style="
              background: #27ae60;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 5px;
              font-size: 16px;
              cursor: pointer;
              margin-right: 10px;
            ">Go Back Safe</button>
            <button id="nullvoid-proceed-anyway" style="
              background: #95a5a6;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 5px;
              font-size: 16px;
              cursor: pointer;
            ">Proceed Anyway</button>
          </div>
          <p style="font-size: 12px; color: #7f8c8d;">
            Protected by NULL VOID Smart Integration
          </p>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Add event listeners
    document
      .getElementById("nullvoid-go-back")
      .addEventListener("click", () => {
        window.history.back();
      });

    document
      .getElementById("nullvoid-proceed-anyway")
      .addEventListener("click", () => {
        overlay.remove();
        // Log the risk acceptance
        console.log("[NULL VOID] User proceeded despite malware warning");
        chrome.runtime.sendMessage({
          action: "logSecurityEvent",
          type: "malware_risk_accepted",
          domain: domain,
        });
      });

    // Log the block
    chrome.runtime.sendMessage({
      action: "logSecurityEvent",
      type: "malware_blocked",
      domain: domain,
    });
  }

  function setupFileProtection() {
    if (!securityEnabled) return;

    // Monitor all links and forms for file downloads
    const clickHandler = (e) => {
      if (!securityEnabled) return;

      const target = e.target.closest("a");
      if (!target) return;

      const href = target.href;
      if (!href) return;

      // Check if it's a file download
      const isDangerous = dangerousFilePatterns.some((pattern) =>
        pattern.test(href)
      );

      if (isDangerous) {
        e.preventDefault();
        e.stopPropagation();
        showFileWarning(href, target);
      }
    };

    // Monitor form submissions that might download files
    const submitHandler = (e) => {
      if (!securityEnabled) return;

      const form = e.target;
      if (form.method && form.method.toLowerCase() === "post") {
        // Check if form might be downloading a file
        const action = form.action || window.location.href;
        const isDangerous = dangerousFilePatterns.some((pattern) =>
          pattern.test(action)
        );

        if (isDangerous) {
          e.preventDefault();
          showFileWarning(action, form);
        }
      }
    };

    // Add event listeners with tracking
    document.addEventListener("click", clickHandler, true);
    document.addEventListener("submit", submitHandler, true);

    // Store listeners for cleanup
    if (!window.nullVoidObservers) window.nullVoidObservers = [];
    window.nullVoidEventListeners = [
      { element: document, event: "click", handler: clickHandler },
      { element: document, event: "submit", handler: submitHandler },
    ];

    // Mark as protected
    document.querySelectorAll("a, form").forEach((el) => {
      el.setAttribute("data-nullvoid-protected", "true");
    });
  }

  function showFileWarning(fileUrl, element) {
    if (!securityEnabled) return;

    const fileName = fileUrl.split("/").pop() || "Unknown file";

    const warningDiv = document.createElement("div");
    warningDiv.id = "nullvoid-file-warning";
    warningDiv.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: Arial, sans-serif;
      ">
        <div style="
          background: white;
          padding: 30px;
          border-radius: 10px;
          max-width: 400px;
          text-align: center;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        ">
          <div style="color: #e67e22; font-size: 48px; margin-bottom: 20px;">🛡️</div>
          <h3 style="color: #e67e22; margin-bottom: 15px;">Dangerous File Blocked</h3>
          <p style="margin-bottom: 15px;">
            <strong>${fileName}</strong> could be harmful to your device.
          </p>
          <p style="margin-bottom: 25px; font-size: 14px; color: #7f8c8d;">
            Executable files can contain malware. Only download if you trust the source.
          </p>
          <div>
            <button onclick="this.parentElement.parentElement.parentElement.parentElement.remove()" style="
              background: #27ae60;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 5px;
              cursor: pointer;
              margin-right: 10px;
            ">Cancel Download</button>
            <button onclick="
              window.open('${fileUrl}', '_blank');
              this.parentElement.parentElement.parentElement.parentElement.remove();
            " style="
              background: #e74c3c;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 5px;
              cursor: pointer;
            ">Download Anyway</button>
          </div>
        </div>
      </div>
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        z-index: 999998;
      " onclick="this.parentElement.remove()"></div>
    `;

    document.body.appendChild(warningDiv);

    // Log the block
    chrome.runtime.sendMessage({
      action: "logSecurityEvent",
      type: "file_blocked",
      file: fileName,
      url: fileUrl,
    });
  }

  function setupStealthAdBlocking() {
    if (!securityEnabled) return;

    // Initial scan
    advancedAdBlocker.scanForAds();

    // Set up mutation observer for dynamic content
    const observer = new MutationObserver((mutations) => {
      if (!securityEnabled) return;

      let shouldScan = false;
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
          shouldScan = true;
        }
      });

      if (shouldScan) {
        // Debounce scanning to avoid performance issues
        clearTimeout(window.nullVoidScanTimeout);
        window.nullVoidScanTimeout = setTimeout(() => {
          advancedAdBlocker.scanForAds();
        }, 100);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Store observer for cleanup
    if (!window.nullVoidObservers) window.nullVoidObservers = [];
    window.nullVoidObservers.push(observer);

    // Update ad block count
    if (adsBlocked > 0) {
      chrome.runtime.sendMessage({
        action: "updateAdBlockCount",
        count: adsBlocked,
      });
    }
  }

  function monitorSuspiciousContent() {
    if (!securityEnabled) return;

    // Monitor for suspicious patterns in page content
    const suspiciousPatterns = [
      /click here to claim/i,
      /you've won/i,
      /urgent.*action.*required/i,
      /verify.*account.*immediately/i,
      /suspended.*account/i,
      /congratulations.*winner/i,
      /limited.*time.*offer/i,
      /act.*now.*expires/i,
    ];

    const pageText = document.body.textContent || "";

    let suspiciousCount = 0;
    suspiciousPatterns.forEach((pattern) => {
      if (pattern.test(pageText)) {
        suspiciousCount++;
      }
    });

    // Only show warning if multiple suspicious patterns detected
    if (suspiciousCount >= 2) {
      showSuspiciousContentWarning();
    }
  }

  function showSuspiciousContentWarning() {
    if (!securityEnabled) return;

    // Check if warning already shown
    if (document.getElementById("nullvoid-suspicious-warning")) return;

    const warning = document.createElement("div");
    warning.id = "nullvoid-suspicious-warning";
    warning.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f39c12;
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        z-index: 999999;
        font-family: Arial, sans-serif;
        max-width: 300px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      ">
        <strong>⚠️ Suspicious Content Detected</strong>
        <p style="margin: 5px 0 0 0; font-size: 12px;">
          This page contains patterns commonly used in scams. Be cautious.
        </p>
        <button onclick="this.parentElement.parentElement.remove()" style="
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          padding: 5px 10px;
          border-radius: 3px;
          cursor: pointer;
          float: right;
          margin-top: 10px;
        ">Dismiss</button>
      </div>
    `;

    document.body.appendChild(warning);

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      if (warning.parentNode) {
        warning.parentNode.removeChild(warning);
      }
    }, 10000);
  }

  function setupRealTimeMonitoring() {
    if (!securityEnabled) return;

    // Monitor for new script injections
    const observer = new MutationObserver((mutations) => {
      if (!securityEnabled) return;

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeName === "SCRIPT" && node.src) {
            // Check if script is from suspicious domain
            try {
              const scriptDomain = new URL(node.src).hostname;
              if (isMaliciousDomain(scriptDomain)) {
                node.remove();
                console.log("[NULL VOID] Blocked malicious script:", node.src);
              }
            } catch (e) {
              // Ignore URL parsing errors
            }
          }
        });
      });
    });

    observer.observe(document.head, {
      childList: true,
      subtree: true,
    });

    // Store observer for cleanup
    if (!window.nullVoidObservers) window.nullVoidObservers = [];
    window.nullVoidObservers.push(observer);
  }

  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "toggleSecurity") {
      if (message.enabled) {
        // Enable security
        securityEnabled = true;
        initSecurity();
      } else {
        // Completely disable security
        disableSecurity();
      }
      sendResponse({ success: true, enabled: securityEnabled });
    } else if (message.action === "getSecurityStats") {
      sendResponse({
        blockedRequests: blockedRequests,
        adsBlocked: adsBlocked,
        securityEnabled: securityEnabled,
      });
    }
  });

  // Initialize on page load only if security is enabled
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSecurity);
  } else {
    initSecurity();
  }

  // Periodic status check
  setInterval(async () => {
    const enabled = await checkSecurityStatus();
    if (enabled && !securityEnabled) {
      initSecurity();
    } else if (!enabled && securityEnabled) {
      disableSecurity();
    }
  }, 5000);
})();
