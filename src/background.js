// Use browser-specific API namespace
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

// --- Email polling configuration ---
const TEMP_MAIL_API_BASE_URL = "https://api.mail.tm";
let pollingInterval = null;
let previousMessageCount = 0;

// Listen for when the extension is installed or updated
browserAPI.runtime.onInstalled.addListener(() => {
  console.log("NULL VOID Extension Installed");

  // Initialize background email polling
  initializeEmailPolling();
});

// Listen for when the extension starts up
browserAPI.runtime.onStartup.addListener(() => {
  console.log("NULL VOID Extension Started");

  // Initialize background email polling
  initializeEmailPolling();
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

// --- Content Script for Auto-Fill (Optional for Disposable Email) ---
// You could add a context menu item to auto-fill an email,
// or let the user copy/paste manually.
// This example doesn't include auto-fill content script for simplicity,
// as the primary function of the email is to display and copy.
// If you wanted auto-fill, you'd need a content.js and inject it
// using chrome.scripting.executeScript.
