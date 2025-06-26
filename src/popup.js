// Use browser-specific API namespace
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

// --- API Configuration ---
const TEMP_MAIL_API_BASE_URL = "https://api.mail.tm";
let currentDisposableEmailAddress = "";
let currentDisposableEmailId = "";
let currentAccountPassword = ""; // Store password for authentication
let intervalId = null;

// --- Utility function to make API requests ---
async function makeApiRequest(
  endpoint,
  method = "GET",
  body = null,
  token = null
) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  console.log(`[API Request] ${method} ${TEMP_MAIL_API_BASE_URL}${endpoint}`);
  if (body) {
    console.log("[API Request] Body:", JSON.stringify(body, null, 2));
  }

  try {
    const response = await fetch(`${TEMP_MAIL_API_BASE_URL}${endpoint}`, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : null,
    });

    console.log(`[API Response] Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API Response] Error:", errorText);
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const jsonData = await response.json();
    console.log("[API Response] Data:", jsonData);
    return jsonData;
  } catch (error) {
    console.error("API request failed:", error);
    alert(`Error: ${error.message}. Check console for details.`);
    return null;
  }
}

// --- Function to fetch and display messages ---
async function fetchAndDisplayMessages() {
  if (!currentDisposableEmailId || !currentAccountPassword) {
    console.log(
      "No disposable email ID or password available to fetch messages."
    );
    return;
  }

  try {
    // Show loading state
    const loadingMessages = document.getElementById("loadingMessages");
    const messageList = document.getElementById("messageList");
    const noMessagesText = document.getElementById("noMessages");

    if (loadingMessages) loadingMessages.style.display = "block";
    if (messageList) messageList.innerHTML = "";
    if (noMessagesText) noMessagesText.style.display = "none";

    // Authenticate with Mail.tm API
    const tokenData = await makeApiRequest("/token", "POST", {
      address: currentDisposableEmailAddress,
      password: currentAccountPassword,
    });

    if (!tokenData || !tokenData.token) {
      throw new Error("Failed to get authentication token for inbox.");
    }
    const authToken = tokenData.token;

    // Fetch messages using the correct endpoint
    const messages = await makeApiRequest(`/messages`, "GET", null, authToken);

    if (loadingMessages) loadingMessages.style.display = "none";

    if (
      messages &&
      messages["hydra:member"] &&
      messages["hydra:member"].length > 0
    ) {
      if (messageList) {
        messageList.innerHTML = ""; // Clear previous messages
        messages["hydra:member"].forEach((msg) => {
          const li = document.createElement("li");
          li.innerHTML = `
            <div>
              <strong>From:</strong> ${msg.from.address}<br>
              <strong>Subject:</strong> ${msg.subject}<br>
              <em>${new Date(msg.createdAt).toLocaleString()}</em>
            </div>
          `;
          messageList.appendChild(li);
        });
      }
      if (noMessagesText) noMessagesText.style.display = "none";
    } else {
      if (messageList) messageList.innerHTML = "";
      if (noMessagesText) noMessagesText.style.display = "block";
    }
  } catch (error) {
    console.error("Error fetching messages:", error);
    const loadingMessages = document.getElementById("loadingMessages");
    const messageList = document.getElementById("messageList");
    const noMessagesText = document.getElementById("noMessages");

    if (loadingMessages) loadingMessages.style.display = "none";
    if (messageList)
      messageList.innerHTML = `<li style="color: red;">Error fetching messages: ${error.message}</li>`;
    if (noMessagesText) noMessagesText.style.display = "none";
  }
}

// --- Function to update email display in all places ---
function updateEmailDisplay(email) {
  const disposableEmailInput = document.getElementById("disposableEmail");
  const currentEmailDisplay = document.getElementById("currentEmailDisplay");

  if (disposableEmailInput) {
    disposableEmailInput.value = email || "Click 'Generate' to get an email";
  }
  if (currentEmailDisplay) {
    currentEmailDisplay.textContent = email || "No email generated";
  }
}

// --- Function to generate new email ---
async function generateNewEmail() {
  // Clear previous interval if any
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  updateEmailDisplay("Generating...");

  // Clear messages in modal if open
  const messageList = document.getElementById("messageList");
  const noMessagesText = document.getElementById("noMessages");
  if (messageList) messageList.innerHTML = "";
  if (noMessagesText) noMessagesText.style.display = "block";

  try {
    // Step 1: Get available domains
    console.log("Attempting to fetch domains...");
    const domains = await makeApiRequest("/domains");
    if (
      !domains ||
      !domains["hydra:member"] ||
      domains["hydra:member"].length === 0
    ) {
      console.error("No domains available from API response:", domains);
      throw new Error("No domains available from API.");
    }
    const randomDomain =
      domains["hydra:member"][
        Math.floor(Math.random() * domains["hydra:member"].length)
      ].domain;
    console.log("Selected domain:", randomDomain);

    // Step 2: Create a new account/email address
    const username = `temp-${Date.now()}`;
    const password = Math.random().toString(36).substring(2, 15);
    const newAddress = `${username}@${randomDomain}`;

    console.log(`Attempting to create account: ${newAddress}`);
    const accountData = await makeApiRequest("/accounts", "POST", {
      address: newAddress,
      password: password,
    });

    if (!accountData || !accountData.address || !accountData.id) {
      throw new Error("Failed to create disposable email account.");
    }

    currentDisposableEmailAddress = accountData.address;
    currentDisposableEmailId = accountData.id;
    currentAccountPassword = password; // Store password for authentication

    updateEmailDisplay(currentDisposableEmailAddress);
    browserAPI.storage.local.set({
      disposableEmail: currentDisposableEmailAddress,
      disposableEmailId: currentDisposableEmailId,
      accountPassword: currentAccountPassword,
    });

    console.log(
      "Generated disposable email:",
      currentDisposableEmailAddress,
      "ID:",
      currentDisposableEmailId
    );

    // Start polling for messages
    intervalId = setInterval(fetchAndDisplayMessages, 5000); // Poll every 5 seconds

    // Show success message
    showNotification(
      "Disposable email generated! Inbox will refresh every 5 seconds."
    );
  } catch (error) {
    console.error("Error generating email:", error);
    updateEmailDisplay("Error generating email");
    showNotification(
      `Error generating email: ${error.message}. Check console.`,
      "error"
    );
  }
}

// --- Function to show notifications ---
function showNotification(message, type = "success") {
  // Create notification element
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === "error" ? "#ef4444" : "#10b981"};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    transform: translateX(100%);
    transition: transform 0.3s ease;
  `;

  document.body.appendChild(notification);

  // Animate in
  setTimeout(() => {
    notification.style.transform = "translateX(0)";
  }, 100);

  // Remove after delay
  setTimeout(() => {
    notification.style.transform = "translateX(100%)";
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// --- Main DOM Content Loaded Listener ---
document.addEventListener("DOMContentLoaded", () => {
  try {
    const disposableEmailInput = document.getElementById("disposableEmail");
    const copyEmailButton = document.getElementById("copyEmail");
    const generateEmailButton = document.getElementById("generateEmail");
    const openEphemeralTabButton = document.getElementById("openEphemeralTab");
    const openInboxButton = document.getElementById("openInbox");
    const inboxModal = document.getElementById("inboxModal");
    const closeInboxButton = document.getElementById("closeInbox");
    const refreshMessagesButton = document.getElementById("refreshMessages");
    const generateNewEmailButton = document.getElementById("generateNewEmail");
    const smartIntegrationsToggle =
      document.getElementById("smartIntegrations");

    // Load saved disposable email on startup
    browserAPI.storage.local.get(
      ["disposableEmail", "disposableEmailId", "accountPassword"],
      async function (result) {
        try {
          if (
            result.disposableEmail &&
            result.disposableEmailId &&
            result.accountPassword
          ) {
            currentDisposableEmailAddress = result.disposableEmail;
            currentDisposableEmailId = result.disposableEmailId;
            currentAccountPassword = result.accountPassword;
            updateEmailDisplay(currentDisposableEmailAddress);
            console.log("Loaded saved email:", currentDisposableEmailAddress);
            // Start polling for messages with a delay to prevent immediate API calls
            setTimeout(() => {
              intervalId = setInterval(fetchAndDisplayMessages, 5000);
            }, 1000);
          }
        } catch (error) {
          console.error("Error loading saved email:", error);
        }
      }
    );

    // --- Email functionality ---
    if (generateEmailButton) {
      generateEmailButton.addEventListener("click", generateNewEmail);
    }

    if (copyEmailButton) {
      copyEmailButton.addEventListener("click", () => {
        if (currentDisposableEmailAddress) {
          navigator.clipboard
            .writeText(currentDisposableEmailAddress)
            .then(() => {
              showNotification("Email copied to clipboard!");
            })
            .catch(() => {
              // Fallback for older browsers
              disposableEmailInput.select();
              document.execCommand("copy");
              showNotification("Email copied to clipboard!");
            });
        } else {
          showNotification("No email to copy. Generate one first.", "error");
        }
      });
    }

    // --- Inbox Modal functionality ---
    if (openInboxButton) {
      openInboxButton.addEventListener("click", () => {
        inboxModal.style.display = "block";
        // Fetch messages when opening inbox
        fetchAndDisplayMessages();
      });
    }

    if (closeInboxButton) {
      closeInboxButton.addEventListener("click", () => {
        inboxModal.style.display = "none";
      });
    }

    if (refreshMessagesButton) {
      refreshMessagesButton.addEventListener("click", fetchAndDisplayMessages);
    }

    if (generateNewEmailButton) {
      generateNewEmailButton.addEventListener("click", () => {
        generateNewEmail();
        // Keep modal open to show the new email
      });
    }

    // Close modal when clicking outside
    window.addEventListener("click", (event) => {
      if (event.target === inboxModal) {
        inboxModal.style.display = "none";
      }
    });

    // --- Ephemeral Tab Functionality ---
    if (openEphemeralTabButton) {
      openEphemeralTabButton.addEventListener("click", async () => {
        try {
          const newTab = await browserAPI.tabs.create({
            url: "about:blank",
            active: true,
          });
          // Store the tab ID to monitor it
          browserAPI.storage.local.set({ ephemeralTabId: newTab.id });
          showNotification(
            "Ephemeral tab opened! Data will be cleared when closed."
          );
        } catch (error) {
          console.error("Error opening ephemeral tab:", error);
          showNotification("Error opening ephemeral tab", "error");
        }
      });
    }

    // --- Smart Integrations Toggle ---
    if (smartIntegrationsToggle) {
      // Load saved setting
      browserAPI.storage.local.get(["smartIntegrations"], (result) => {
        if (result.smartIntegrations !== undefined) {
          smartIntegrationsToggle.checked = result.smartIntegrations;
        }
      });

      smartIntegrationsToggle.addEventListener("change", () => {
        browserAPI.storage.local.set({
          smartIntegrations: smartIntegrationsToggle.checked,
        });
        showNotification(
          `Smart Integrations ${
            smartIntegrationsToggle.checked ? "enabled" : "disabled"
          }`
        );
      });
    }
  } catch (error) {
    console.error("Error initializing popup:", error);
  }
});

// Clean up interval when popup closes (good practice, though service worker might handle persistence)
window.addEventListener("beforeunload", () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
});
