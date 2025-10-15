try {
  if (typeof importScripts === "function") {
    importScripts("browserless-config.js");
  }
} catch (error) {
  console.warn("[Background] Failed to preload Browserless config:", error);
}

// Use browser-specific API namespace
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

const DEFAULT_BROWSERLESS_SETTINGS = {
  apiKey: "",
  baseUrl: "https://production-sfo.browserless.io",
  wsUrl: "wss://production-sfo.browserless.io",
  workspaceUrl: "https://chrome.browserless.io",
};

let browserlessConfigCache = null;
let browserlessConfigPromise = null;

async function ensureBrowserlessConfig() {
  if (browserlessConfigCache) {
    return browserlessConfigCache;
  }

  if (!browserlessConfigPromise) {
    const sourcePromise =
      typeof BROWSERLESS_CONFIG_PROMISE !== "undefined"
        ? BROWSERLESS_CONFIG_PROMISE
        : Promise.resolve(
            typeof BROWSERLESS_CONFIG !== "undefined"
              ? BROWSERLESS_CONFIG
              : null
          );

    browserlessConfigPromise = sourcePromise
      .catch((error) => {
        console.warn(
          "[Background] Browserless config unavailable, using defaults:",
          error.message
        );
        return null;
      })
      .then((config) => {
        browserlessConfigCache = {
          ...DEFAULT_BROWSERLESS_SETTINGS,
          ...(config || {}),
        };
        if (!browserlessConfigCache.apiKey) {
          console.warn(
            "[Background] Browserless API key missing. Please provide BROWSERLESS_API_KEY in .env."
          );
        }
        return browserlessConfigCache;
      });
  }

  return browserlessConfigPromise;
}

// --- Smart Prevention System Configuration ---
let smartPreventionEnabled = false;
let smartPreventionInitPromise = null;

// Initialize Smart Prevention System state from storage on startup
async function initializeSmartPreventionState() {
  try {
    const result = await browserAPI.storage.local.get([
      "smartPreventionEnabled",
    ]);
    smartPreventionEnabled = result.smartPreventionEnabled || false;
    console.log(
      "[Background] Smart Prevention System initialized:",
      smartPreventionEnabled
    );

    // Setup web request blocking if enabled
    if (smartPreventionEnabled) {
      await setupWebRequestBlocking();
    }
  } catch (error) {
    console.error(
      "[Background] Failed to initialize Smart Prevention state:",
      error
    );
  }
}

// Initialize on startup and capture the promise so later requests can await completion
smartPreventionInitPromise = initializeSmartPreventionState();

async function ensureSmartPreventionInitialized() {
  try {
    if (smartPreventionInitPromise) {
      await smartPreventionInitPromise;
    } else {
      smartPreventionInitPromise = initializeSmartPreventionState();
      await smartPreventionInitPromise;
    }
  } catch (error) {
    console.warn(
      "[Background] Smart Prevention initialization encountered an issue:",
      error
    );
  }
}

// Listen for storage changes - but prevent infinite loops
browserAPI.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.smartPreventionEnabled) {
    const newValue = changes.smartPreventionEnabled.newValue;
    const oldValue = changes.smartPreventionEnabled.oldValue;

    console.log("[Background] Storage change detected:", {
      oldValue,
      newValue,
      currentState: smartPreventionEnabled,
    });

    // Only handle if the value actually changed and differs from current state
    if (newValue !== oldValue && newValue !== smartPreventionEnabled) {
      console.log("[Background] Syncing state to match storage:", newValue);
      smartPreventionEnabled = newValue;

      // Don't call handleSmartPreventionToggle as it will re-save to storage
      // Just update the internal state and web request blocking
      if (newValue) {
        setupWebRequestBlocking().catch((error) => {
          console.error("[Background] Failed to setup blocking:", error);
        });
      }
    } else {
      console.log(
        "[Background] Ignoring storage change (no actual change or already in sync)"
      );
    }
  }
});

// --- RBI (Remote Browser Isolation) Functions ---

// RBI session management
const activeSessions = new Map();

async function handleRBISessionInit(region) {
  try {
    console.log(`[RBI Background] Initializing session for region: ${region}`);

    // Since we can't use ES6 imports in service worker directly,
    // we'll use a simpler approach for production

    // Generate session ID
    const sessionId =
      "rbi_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);

    // Store active session
    activeSessions.set(sessionId, {
      region: region,
      startTime: Date.now(),
      status: "active",
    });

    console.log(`[RBI Background] Session created: ${sessionId}`);

    return {
      success: true,
      sessionId: sessionId,
      region: region,
      endpoint: await getRegionEndpoint(region),
    };
  } catch (error) {
    console.error("[RBI Background] Session initialization failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Get region endpoint configuration
async function getRegionEndpoint(region) {
  const browserlessConfig = await ensureBrowserlessConfig();

  const endpoints = {
    singapore: {
      api: browserlessConfig.baseUrl,
      ws: browserlessConfig.wsUrl,
      workspaceUrl: browserlessConfig.workspaceUrl,
      region: "ap-southeast-1",
      flag: "🇸🇬",
      location: "Singapore",
      browserless: browserlessConfig,
    },
    usa: {
      api: browserlessConfig.baseUrl,
      ws: browserlessConfig.wsUrl,
      workspaceUrl: browserlessConfig.workspaceUrl,
      region: "us-east-1",
      flag: "🇺🇸",
      location: "United States",
      browserless: browserlessConfig,
    },
    uk: {
      api: browserlessConfig.baseUrl,
      ws: browserlessConfig.wsUrl,
      workspaceUrl: browserlessConfig.workspaceUrl,
      region: "eu-west-2",
      flag: "🇬🇧",
      location: "United Kingdom",
      browserless: browserlessConfig,
    },
    canada: {
      api: browserlessConfig.baseUrl,
      ws: browserlessConfig.wsUrl,
      workspaceUrl: browserlessConfig.workspaceUrl,
      region: "ca-central-1",
      flag: "🇨🇦",
      location: "Canada",
      browserless: browserlessConfig,
    },
    europe: {
      api: browserlessConfig.baseUrl,
      ws: browserlessConfig.wsUrl,
      workspaceUrl: browserlessConfig.workspaceUrl,
      region: "eu-west-1",
      flag: "🇪🇺",
      location: "Europe",
      browserless: browserlessConfig,
    },
    japan: {
      api: browserlessConfig.baseUrl,
      ws: browserlessConfig.wsUrl,
      workspaceUrl: browserlessConfig.workspaceUrl,
      region: "ap-northeast-1",
      flag: "🇯🇵",
      location: "Japan",
      browserless: browserlessConfig,
    },
  };

  return endpoints[region] || endpoints.singapore;
}

async function handleRBISessionTermination(sessionId) {
  try {
    console.log(`[RBI Background] Terminating session: ${sessionId}`);

    const sessionInfo = activeSessions.get(sessionId);
    if (!sessionInfo) {
      throw new Error("Session not found");
    }

    // Remove from active sessions
    activeSessions.delete(sessionId);

    // Clear browsing data for this session
    await clearRBISessionData(sessionId);

    console.log(`[RBI Background] Session terminated: ${sessionId}`);

    return {
      success: true,
      message: "Session terminated successfully",
    };
  } catch (error) {
    console.error("[RBI Background] Session termination failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function handleRBISessionStatus(sessionId) {
  try {
    const sessionInfo = activeSessions.get(sessionId);
    if (!sessionInfo) {
      return {
        success: false,
        error: "Session not found",
      };
    }

    return {
      success: true,
      status: "active",
      region: sessionInfo.region,
      startTime: sessionInfo.startTime,
      duration: Date.now() - sessionInfo.startTime,
    };
  } catch (error) {
    console.error("[RBI Background] Session status check failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Clear browsing data specific to RBI session
async function clearRBISessionData(sessionId) {
  try {
    // Clear cookies, cache, local storage, etc. for this session
    await browserAPI.browsingData.remove(
      {
        // Remove data from the last hour (session duration)
        since: Date.now() - 60 * 60 * 1000,
      },
      {
        cache: true,
        cookies: true,
        downloads: false,
        fileSystems: true,
        formData: true,
        history: false, // Keep history for user convenience
        indexedDB: true,
        localStorage: true,
        passwords: false, // Don't clear saved passwords
        serviceWorkers: true,
        webSQL: true,
      }
    );

    console.log(
      `[RBI Background] Cleared browsing data for session: ${sessionId}`
    );
  } catch (error) {
    console.error("[RBI Background] Failed to clear session data:", error);
  }
}

// Monitor tab closures to clean up RBI sessions
browserAPI.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  try {
    // Check if this was an RBI tab
    const result = await browserAPI.storage.local.get(["activeRBISession"]);
    if (result.activeRBISession && result.activeRBISession.tabId === tabId) {
      console.log(
        `[RBI Background] RBI tab closed, cleaning up session: ${result.activeRBISession.sessionId}`
      );

      // Terminate the session
      await handleRBISessionTermination(result.activeRBISession.sessionId);

      // Clear storage
      await browserAPI.storage.local.remove(["activeRBISession"]);
    }
  } catch (error) {
    console.error("[RBI Background] Error handling tab closure:", error);
  }
});

// Periodic cleanup of inactive sessions
setInterval(async () => {
  const now = Date.now();
  const maxSessionDuration = 24 * 60 * 60 * 1000; // 24 hours

  for (const [sessionId, sessionInfo] of activeSessions.entries()) {
    if (now - sessionInfo.startTime > maxSessionDuration) {
      console.log(
        `[RBI Background] Auto-terminating expired session: ${sessionId}`
      );
      await handleRBISessionTermination(sessionId);
    }
  }
}, 60 * 60 * 1000); // Check every houron ---
const TEMP_MAIL_API_BASE_URL = "https://api.mail.tm";
let pollingInterval = null;
let previousMessageCount = 0;

// Listen for when the extension is installed or updated
browserAPI.runtime.onInstalled.addListener(() => {
  console.log("NULL VOID Extension Installed");

  // Initialize smart prevention system
  initializeSmartPrevention();

  // Initialize background email polling
  initializeEmailPolling();
});

// Listen for when the extension starts up
browserAPI.runtime.onStartup.addListener(() => {
  console.log("NULL VOID Extension Started");

  // Initialize smart prevention system
  initializeSmartPrevention();

  // Initialize background email polling
  initializeEmailPolling();
});

// --- Smart Prevention System Functions ---
async function initializeSmartPrevention() {
  console.log("Initializing Smart Prevention System...");

  // Get stored smart prevention system status
  const result = await browserAPI.storage.local.get(["smartPreventionEnabled"]);
  smartPreventionEnabled = result.smartPreventionEnabled || false;

  console.log("Smart Prevention System Status:", smartPreventionEnabled);

  // Set up web request blocking if enabled
  if (smartPreventionEnabled) {
    setupWebRequestBlocking();
  }

  // Listen for tab updates to inject content script
  browserAPI.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url && smartPreventionEnabled) {
      injectSmartPreventionScript(tabId);
    }
  });
}

// Inject smart prevention system content script into tabs
async function injectSmartPreventionScript(tabId) {
  try {
    const tab = await browserAPI.tabs.get(tabId);

    // Skip special pages and extension pages
    const skipUrls = [
      "chrome://",
      "moz-extension://",
      "chrome-extension://",
      "edge://",
      "about:",
      "data:",
      "file://",
      "ftp://",
    ];

    if (skipUrls.some((prefix) => tab.url.startsWith(prefix))) {
      console.log(
        `[Background] Skipping script injection for protected URL: ${tab.url}`
      );
      return;
    }

    // Check if scripting API is available
    if (!browserAPI.scripting) {
      console.warn("[Background] Scripting API not available");
      return;
    }

    // Inject the smart prevention system script
    await browserAPI.scripting.executeScript({
      target: { tabId: tabId },
      files: ["smart-prevention-system.js"],
    });

    console.log(
      `[Background] Smart Prevention System script injected into tab ${tabId} (${tab.url})`
    );
  } catch (error) {
    // Don't log as error since many injection failures are expected (protected pages, etc.)
    console.warn(
      `[Background] Could not inject script into tab ${tabId}:`,
      error.message
    );
  }
}

// Setup web request blocking for malicious sites and ads
async function setupWebRequestBlocking() {
  try {
    // Check if declarativeNetRequest API is available
    if (!browserAPI.declarativeNetRequest) {
      console.warn(
        "[Background] declarativeNetRequest API not available, skipping web request blocking"
      );
      return;
    }

    if (smartPreventionEnabled) {
      // Enable ad blocking and malicious site blocking rules
      await browserAPI.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: ["nullvoid_ad_blocker", "nullvoid_malicious_blocker"],
      });
      console.log("Web request blocking rules enabled");
    } else {
      // Disable all blocking rules
      await browserAPI.declarativeNetRequest.updateEnabledRulesets({
        disableRulesetIds: [
          "nullvoid_ad_blocker",
          "nullvoid_malicious_blocker",
        ],
      });
      console.log("Web request blocking rules disabled");
    }
  } catch (error) {
    console.warn(
      "[Background] Web request blocking setup failed (non-critical):",
      error
    );
    // Don't throw the error - this is not critical for the toggle operation
  }
}

// Handle messages from popup and content scripts
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[Background] Received message:", message);

  switch (message.action) {
    case "toggleSmartPrevention":
      console.log(
        "[Background] Processing toggleSmartPrevention:",
        message.enabled
      );
      ensureSmartPreventionInitialized()
        .then(() => handleSmartPreventionToggle(message.enabled))
        .then(() => {
          console.log("[Background] Toggle completed successfully");
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error("[Background] Toggle failed:", error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep message channel open for async response

    case "getSmartPreventionStatus":
      ensureSmartPreventionInitialized()
        .then(() => {
          console.log(
            "[Background] Getting Smart Prevention status:",
            smartPreventionEnabled
          );
          sendResponse({
            enabled: smartPreventionEnabled,
            success: true,
          });
        })
        .catch((error) => {
          console.warn(
            "[Background] Unable to provide Smart Prevention status:",
            error
          );
          sendResponse({
            enabled: smartPreventionEnabled,
            success: false,
            error: error.message,
          });
        });
      return true;

    case "reportMaliciousSite":
      handleMaliciousSiteReport(message.data);
      sendResponse({ success: true });
      break;

    case "reportBlockedAd":
      console.log("Ad blocked:", message.data);
      sendResponse({ success: true });
      break;

    case "authComplete":
      console.log("[Auth] Authentication completed:", message);
      // Forward to popup if it's open
      browserAPI.runtime
        .sendMessage({
          action: "authStateChanged",
          isAuthenticated: true,
          userProfile: message.user,
        })
        .catch(() => {
          // Ignore if popup is not open
        });
      sendResponse({ success: true });
      break;

    case "authFailed":
      console.log("[Auth] Authentication failed:", message.error);
      // Forward to popup if it's open
      browserAPI.runtime
        .sendMessage({
          action: "authStateChanged",
          isAuthenticated: false,
          userProfile: null,
        })
        .catch(() => {
          // Ignore if popup is not open
        });
      sendResponse({ success: true });
      break;

      // OSINT functionality removed // Keep message channel open for async response
      break;

    case "initializeRBISession":
      console.log(
        "[Background] Received initializeRBISession request for region:",
        message.region
      );
      handleRBISessionInit(message.region)
        .then((result) => {
          console.log("[Background] RBI session init result:", result);
          sendResponse(result);
        })
        .catch((error) => {
          console.error("[Background] RBI session init error:", error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep channel open for async response

    case "terminateRBISession":
      handleRBISessionTermination(message.sessionId)
        .then((result) => sendResponse(result))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true;

    case "getRBISessionStatus":
      handleRBISessionStatus(message.sessionId)
        .then((result) => sendResponse(result))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true;
  }

  return true; // Keep the message channel open for async response
});

// Handle smart prevention system toggle
async function handleSmartPreventionToggle(enabled) {
  console.log(
    `[Background] handleSmartPreventionToggle called with: ${enabled}`
  );

  try {
    // Update state FIRST to prevent race conditions with storage listener
    smartPreventionEnabled = enabled;

    // Store the setting
    await browserAPI.storage.local.set({
      smartPreventionEnabled: enabled,
      smartPreventionTimestamp: Date.now(),
    });
    console.log(
      `[Background] Storage updated: smartPreventionEnabled = ${enabled}`
    );

    // Update web request blocking rules (non-critical - don't let this fail the whole operation)
    try {
      await setupWebRequestBlocking();
      console.log("[Background] Web request blocking updated successfully");
    } catch (blockingError) {
      console.warn(
        "[Background] Web request blocking failed (non-critical):",
        blockingError.message
      );
      // Continue anyway
    }

    if (enabled) {
      console.log("[Background] Injecting scripts into existing tabs...");
      // Inject script into all existing tabs (non-critical - don't let this fail the whole operation)
      try {
        const tabs = await browserAPI.tabs.query({});
        let injectedCount = 0;

        for (const tab of tabs) {
          if (
            tab.id &&
            tab.url &&
            !tab.url.startsWith("chrome://") &&
            !tab.url.startsWith("moz-extension://") &&
            !tab.url.startsWith("chrome-extension://") &&
            !tab.url.startsWith("edge://") &&
            !tab.url.startsWith("about:")
          ) {
            try {
              await injectSmartPreventionScript(tab.id);
              injectedCount++;
            } catch (error) {
              console.warn(
                `[Background] Could not inject into tab ${tab.id}:`,
                error.message
              );
            }
          }
        }
        console.log(
          `[Background] Successfully injected scripts into ${injectedCount} tabs`
        );
      } catch (tabError) {
        console.warn(
          "[Background] Tab script injection failed (non-critical):",
          tabError.message
        );
        // Continue anyway
      }
    } else {
      console.log("[Background] Disabling protection in existing tabs...");
      // Disable protection in all tabs (non-critical)
      try {
        const tabs = await browserAPI.tabs.query({});
        let disabledCount = 0;

        for (const tab of tabs) {
          if (tab.id) {
            try {
              await browserAPI.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                  // Disable smart prevention system in this tab
                  if (window.nullVoidSmartPrevention) {
                    window.nullVoidSmartPrevention.disableProtection();
                  }
                },
              });
              disabledCount++;
            } catch (error) {
              console.warn(
                `[Background] Could not disable protection in tab ${tab.id}:`,
                error.message
              );
            }
          }
        }
        console.log(
          `[Background] Successfully disabled protection in ${disabledCount} tabs`
        );
      } catch (tabError) {
        console.warn(
          "[Background] Tab script removal failed (non-critical):",
          tabError.message
        );
        // Continue anyway
      }
    }

    console.log(
      `[Background] Smart Prevention System ${
        enabled ? "enabled" : "disabled"
      } successfully`
    );

    // Always return success if storage update succeeded
    return { success: true, enabled: enabled };
  } catch (error) {
    console.error(
      `[Background] Critical error in handleSmartPreventionToggle:`,
      error
    );
    // Only throw if storage failed
    throw error;
  }
}

// Handle malicious site reports
function handleMaliciousSiteReport(data) {
  console.log("Malicious site reported:", data);

  // In a production environment, you would:
  // 1. Send this data to your threat intelligence service
  // 2. Update your malicious domain lists
  // 3. Notify other users or security services
}

// Listen for storage changes
browserAPI.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.smartIntegrationEnabled) {
    const newValue = changes.smartIntegrationEnabled.newValue;
    if (newValue !== smartIntegrationEnabled) {
      handleSmartIntegrationToggle(newValue);
    }
  }
});

// --- Email polling functions ---
async function initializeEmailPolling() {
  // Get stored email data
  const result = await browserAPI.storage.local.get([
    "disposableEmailId",
    "disposableEmailAddress",
    "accountPassword",
  ]);

  if (
    result.disposableEmailId &&
    result.disposableEmailAddress &&
    result.accountPassword
  ) {
    console.log(
      "Starting background email polling for:",
      result.disposableEmailAddress
    );
    startEmailPolling(
      result.disposableEmailId,
      result.disposableEmailAddress,
      result.accountPassword
    );
  }
}

function startEmailPolling(emailId, emailAddress, password) {
  // Clear any existing interval
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  // Poll every 30 seconds
  pollingInterval = setInterval(async () => {
    await checkForNewEmails(emailId, emailAddress, password);
  }, 30000);

  // Also check immediately
  checkForNewEmails(emailId, emailAddress, password);
}

function stopEmailPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

async function checkForNewEmails(emailId, emailAddress, password) {
  try {
    // Authenticate with Mail.tm API
    const tokenResponse = await fetch(`${TEMP_MAIL_API_BASE_URL}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: emailAddress, password: password }),
    });

    if (!tokenResponse.ok) {
      console.error("Failed to authenticate for background email check");
      return;
    }

    const tokenData = await tokenResponse.json();
    const authToken = tokenData.token;

    // Fetch messages
    const messagesResponse = await fetch(`${TEMP_MAIL_API_BASE_URL}/messages`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!messagesResponse.ok) {
      console.error("Failed to fetch messages for background check");
      return;
    }

    const messages = await messagesResponse.json();

    if (messages && messages["hydra:member"]) {
      const currentMessageCount = messages["hydra:member"].length;

      // Check for new messages
      if (
        currentMessageCount > previousMessageCount &&
        previousMessageCount > 0
      ) {
        const newEmailCount = currentMessageCount - previousMessageCount;
        const latestMessage = messages["hydra:member"][0]; // Most recent message

        console.log(
          `New emails detected in background! Count: ${newEmailCount}`
        );

        // Show desktop notification
        if (newEmailCount === 1) {
          showBackgroundNotification(
            `New Email - NULL VOID`,
            `From: ${latestMessage.from.address}\nSubject: ${latestMessage.subject}`
          );
        } else {
          showBackgroundNotification(
            `${newEmailCount} New Emails - NULL VOID`,
            `You have ${newEmailCount} new emails in your disposable inbox`
          );
        }
      }

      previousMessageCount = currentMessageCount;

      // Store updated count for popup
      await browserAPI.storage.local.set({ messageCount: currentMessageCount });
    }
  } catch (error) {
    console.error("Error checking for new emails in background:", error);
  }
}

function showBackgroundNotification(title, body) {
  const notificationOptions = {
    type: "basic",
    iconUrl: "icons/icon48.png",
    title: title,
    message: body,
    priority: 1,
    requireInteraction: false,
  };

  const notificationId = `null-void-${Date.now()}`;

  browserAPI.notifications.create(
    notificationId,
    notificationOptions,
    (notId) => {
      if (browserAPI.runtime.lastError) {
        console.error(
          "Background notification error:",
          browserAPI.runtime.lastError
        );
      } else {
        console.log("Background notification created successfully:", notId);

        // Auto-clear after 5 seconds
        setTimeout(() => {
          browserAPI.notifications.clear(notificationId);
        }, 5000);
      }
    }
  );
}

// Listen for messages from popup
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "startEmailPolling") {
    const { emailId, emailAddress, password } = request;
    previousMessageCount = request.initialCount || 0;
    startEmailPolling(emailId, emailAddress, password);
    sendResponse({ success: true });
  } else if (request.action === "stopEmailPolling") {
    stopEmailPolling();
    sendResponse({ success: true });
  }
});

// --- Ephemeral Tab Cleanup ---
// Listen for when a tab is closed
browserAPI.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  const result = await browserAPI.storage.local.get([
    "ephemeralTabId",
    "ephemeralLocation",
    "ephemeralStartTime",
  ]);
  if (result.ephemeralTabId === tabId) {
    console.log(`Ephemeral tab ${tabId} closed. Clearing browsing data...`);

    const duration = result.ephemeralStartTime
      ? Date.now() - result.ephemeralStartTime
      : 0;
    const location = result.ephemeralLocation || "unknown";

    console.log(
      `Ephemeral session duration: ${Math.round(
        duration / 1000
      )}s, Location: ${location}`
    );

    try {
      // Clear browsing data for the ephemeral session
      await browserAPI.BrowseData.remove(
        {
          since: result.ephemeralStartTime || 0,
        },
        {
          cookies: true,
          history: true,
          localStorage: true,
          sessionStorage: true,
          cache: true,
          cacheStorage: true,
          downloads: false, // Keep downloads but clear other data
          formData: true,
          indexedDB: true,
          pluginData: true,
          passwords: false, // Don't clear saved passwords
          webSQL: true,
        }
      );

      console.log(`Browsing data cleared for ephemeral session ${tabId}`);

      // Show notification about cleanup
      try {
        await browserAPI.notifications.create({
          type: "basic",
          iconUrl: "icons/icon48.png",
          title: "NULL VOID - Session Ended",
          message: `Disposable browser session ended. All browsing data has been securely cleared.`,
        });
      } catch (notificationError) {
        console.log("Could not show notification:", notificationError);
      }
    } catch (error) {
      console.error(
        `Failed to clear browsing data for ephemeral tab ${tabId}:`,
        error
      );
    }

    // Clear the stored ephemeral tab info
    await browserAPI.storage.local.remove([
      "ephemeralTabId",
      "ephemeralLocation",
      "ephemeralStartTime",
    ]);
  }
});

// Listen for messages from ephemeral browser
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ephemeralSessionEnding") {
    console.log("Ephemeral session ending notification received:", request);
    // Could perform additional cleanup here
    sendResponse({ received: true });
  }
});

// --- Smart Prevention System Security System ---
let securityEnabled = true;
let securityStats = {
  malwareBlocked: 0,
  filesBlocked: 0,
  adsBlocked: 0,
  lastUpdated: Date.now(),
};

// Handle Smart Prevention System security messages
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case "enableSecurity":
      enableSecuritySystems(message.systems);
      sendResponse({ success: true });
      break;

    case "disableSecurity":
      disableSecuritySystems();
      sendResponse({ success: true });
      break;

    case "getSecurityStatus":
      sendResponse({ enabled: securityEnabled });
      break;

    case "logSecurityEvent":
      logSecurityEvent(message);
      sendResponse({ success: true });
      break;

    case "updateAdBlockCount":
      securityStats.adsBlocked += message.count;
      updateBadgeText();
      sendResponse({ success: true });
      break;

    case "getSecurityStats":
      sendResponse(securityStats);
      break;
  }
});

async function enableSecuritySystems(systems) {
  securityEnabled = true;

  // Save security state
  await browserAPI.storage.local.set({ smartIntegrationEnabled: true });

  // Update all active tabs
  const tabs = await browserAPI.tabs.query({});
  tabs.forEach((tab) => {
    if (
      tab.url &&
      !tab.url.startsWith("chrome://") &&
      !tab.url.startsWith("moz-extension://")
    ) {
      browserAPI.tabs
        .sendMessage(tab.id, {
          action: "toggleSecurity",
          enabled: true,
        })
        .catch(() => {
          // Ignore errors for tabs that don't have the content script
        });
    }
  });

  // Set up request blocking
  setupRequestBlocking();

  console.log("[Smart Prevention System] Security systems enabled");
}

async function disableSecuritySystems() {
  securityEnabled = false;

  // Save security state
  await browserAPI.storage.local.set({ smartIntegrationEnabled: false });

  // Update all active tabs
  const tabs = await browserAPI.tabs.query({});
  tabs.forEach((tab) => {
    if (
      tab.url &&
      !tab.url.startsWith("chrome://") &&
      !tab.url.startsWith("moz-extension://")
    ) {
      browserAPI.tabs
        .sendMessage(tab.id, {
          action: "toggleSecurity",
          enabled: false,
        })
        .catch(() => {
          // Ignore errors for tabs that don't have the content script
        });
    }
  });

  // Clear badge
  browserAPI.action.setBadgeText({ text: "" });

  console.log("[Smart Prevention System] Security systems disabled");
}

function setupRequestBlocking() {
  // Known malicious domains for request blocking
  const maliciousDomains = [
    "*://*.malware-site.com/*",
    "*://*.phishing-domain.net/*",
    "*://*.dangerous-download.org/*",
  ];

  // Set up declarative net request rules for ad blocking
  const adBlockRules = [
    {
      id: 1,
      priority: 1,
      action: { type: "block" },
      condition: {
        urlFilter: "*doubleclick.net*",
        resourceTypes: ["script", "image", "xmlhttprequest"],
      },
    },
    {
      id: 2,
      priority: 1,
      action: { type: "block" },
      condition: {
        urlFilter: "*googlesyndication.com*",
        resourceTypes: ["script", "image", "xmlhttprequest"],
      },
    },
    {
      id: 3,
      priority: 1,
      action: { type: "block" },
      condition: {
        urlFilter: "*googleadservices.com*",
        resourceTypes: ["script", "image", "xmlhttprequest"],
      },
    },
  ];

  // Apply rules if declarativeNetRequest is available
  if (browserAPI.declarativeNetRequest) {
    browserAPI.declarativeNetRequest
      .updateDynamicRules({
        removeRuleIds: [1, 2, 3],
        addRules: adBlockRules,
      })
      .catch((error) => {
        console.warn(
          "[Smart Prevention System] Could not set up request blocking:",
          error
        );
      });
  }
}

function logSecurityEvent(event) {
  const timestamp = new Date().toISOString();

  switch (event.type) {
    case "malware_blocked":
      securityStats.malwareBlocked++;
      console.log(
        `[Security Event] Malware blocked: ${event.domain} at ${timestamp}`
      );
      break;

    case "file_blocked":
      securityStats.filesBlocked++;
      console.log(
        `[Security Event] Dangerous file blocked: ${event.file} at ${timestamp}`
      );
      break;

    case "malware_risk_accepted":
      console.log(
        `[Security Event] User accepted malware risk: ${event.domain} at ${timestamp}`
      );
      break;
  }

  securityStats.lastUpdated = Date.now();
  updateBadgeText();

  // Store security log
  browserAPI.storage.local.get(["securityLog"]).then((result) => {
    const log = result.securityLog || [];
    log.push({
      ...event,
      timestamp,
    });

    // Keep only last 100 events
    if (log.length > 100) {
      log.splice(0, log.length - 100);
    }

    browserAPI.storage.local.set({ securityLog: log });
  });
}

function updateBadgeText() {
  if (!securityEnabled) return;

  const totalBlocked =
    securityStats.malwareBlocked +
    securityStats.filesBlocked +
    Math.min(securityStats.adsBlocked, 99);

  if (totalBlocked > 0) {
    browserAPI.action.setBadgeText({
      text: totalBlocked > 99 ? "99+" : totalBlocked.toString(),
    });
    browserAPI.action.setBadgeBackgroundColor({ color: "#4CAF50" });
  }
}

// Initialize security system on startup
browserAPI.runtime.onStartup.addListener(async () => {
  const result = await browserAPI.storage.local.get([
    "smartIntegrationEnabled",
  ]);
  if (result.smartIntegrationEnabled !== false) {
    enableSecuritySystems({
      malwareBlocking: true,
      fileProtection: true,
      adBlocking: true,
    });
  }
});

// Initialize security system on install
browserAPI.runtime.onInstalled.addListener(async () => {
  const result = await browserAPI.storage.local.get([
    "smartIntegrationEnabled",
  ]);
  if (result.smartIntegrationEnabled !== false) {
    enableSecuritySystems({
      malwareBlocking: true,
      fileProtection: true,
      adBlocking: true,
    });
  }
});

// --- Content Script for Auto-Fill (Optional for Disposable Email) ---
// You could add a context menu item to auto-fill an email,
// or let the user copy/paste manually.
// This example doesn't include auto-fill content script for simplicity,
// as the primary function of the email is to display and copy.
// If you wanted auto-fill, you'd need a content.js and inject it
// using chrome.scripting.executeScript.
// --- OSINT Functions ---

async function handleOsintSearch(query, type) {
  const API_KEY = "ijVL3k0b35IyrwhRG1nC1OUnNuqF90CWt";
  const BASE_URL = "https://api.shodan.io";

  try {
    console.log(`[OSINT Background] Performing ${type} search for: ${query}`);

    let endpoint;
    let params = new URLSearchParams({ key: API_KEY });

    switch (type) {
      case "host":
        // Host lookup - get info about specific IP
        if (!isValidIP(query)) {
          throw new Error("Please enter a valid IP address for host lookup");
        }
        endpoint = `${BASE_URL}/shodan/host/${query}`;
        break;

      case "search":
        // General search
        endpoint = `${BASE_URL}/shodan/host/search`;
        params.append("query", query);
        params.append("limit", "10");
        break;

      case "count":
        // Count search results
        endpoint = `${BASE_URL}/shodan/host/count`;
        params.append("query", query);
        break;

      case "honeypot":
        // Honeypot check
        if (!isValidIP(query)) {
          throw new Error("Please enter a valid IP address for honeypot check");
        }
        endpoint = `${BASE_URL}/labs/honeyscore/${query}`;
        params = new URLSearchParams({ key: API_KEY });
        break;

      default:
        throw new Error("Invalid search type");
    }

    const url =
      type === "host" || type === "honeypot"
        ? `${endpoint}?${params.toString()}`
        : `${endpoint}?${params.toString()}`;

    console.log("[OSINT Background] Fetching:", url);

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Invalid API key");
      } else if (response.status === 404) {
        throw new Error("No information available for this query");
      } else if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later");
      } else {
        throw new Error(`API error: ${response.status}`);
      }
    }

    const data = await response.json();

    return {
      query: query,
      type: type,
      data: data,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("[OSINT Background] Shodan API error:", error);
    throw error;
  }
}

function isValidIP(ip) {
  const ipRegex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipRegex.test(ip);
}

// --- Browserless.io Integration ---

// Handle Browserless.io RBI session initialization
async function handleBrowserlessRBIInit(region) {
  try {
    console.log(`[Browserless RBI] Initializing session for region: ${region}`);

    const browserlessConfig = await ensureBrowserlessConfig();
    const apiKey = browserlessConfig.apiKey;
    const baseUrl = browserlessConfig.baseUrl;

    // Test connection to Browserless.io
    const response = await fetch(`${baseUrl}/json/version?token=${apiKey}`);

    if (!response.ok) {
      throw new Error(`Browserless.io connection failed: ${response.status}`);
    }

    const versionInfo = await response.json();
    console.log("[Browserless RBI] Connection successful:", versionInfo);

    // Generate session ID
    const sessionId =
      "browserless_" +
      Date.now() +
      "_" +
      Math.random().toString(36).substr(2, 9);

    // Store active session
    activeSessions.set(sessionId, {
      region: region,
      startTime: Date.now(),
      status: "active",
      type: "browserless",
    });

    return {
      success: true,
      sessionId: sessionId,
      region: region,
      endpoint: {
        api: baseUrl,
        apiKey: apiKey,
        type: "browserless",
      },
    };
  } catch (error) {
    console.error("[Browserless RBI] Session initialization failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Add Browserless.io message handler
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "initializeBrowserlessRBI") {
    handleBrowserlessRBIInit(message.region)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
});
