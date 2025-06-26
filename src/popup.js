// Use browser-specific API namespace
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

// --- API Configuration ---
const TEMP_MAIL_API_BASE_URL = "https://api.mail.tm";
let currentDisposableEmailAddress = "";
let currentDisposableEmailId = "";
let currentAccountPassword = ""; // Store password for authentication
let intervalId = null;
let selectedEmailId = null; // Track currently selected email
let currentMessages = []; // Cache messages for detail view

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
    const emailList = document.getElementById("emailList");
    const noMessagesText = document.getElementById("noMessages");

    if (loadingMessages) loadingMessages.style.display = "block";
    if (emailList) emailList.innerHTML = "";
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
      const messageCount = messages["hydra:member"].length;
      currentMessages = messages["hydra:member"];

      updateMailCount(messageCount);
      displayEmailList(currentMessages);

      if (noMessagesText) noMessagesText.style.display = "none";
    } else {
      currentMessages = [];
      updateMailCount(0);
      if (emailList) emailList.innerHTML = "";
      if (noMessagesText) noMessagesText.style.display = "block";

      // Clear detail view
      displayEmailDetail(null);
    }
  } catch (error) {
    console.error("Error fetching messages:", error);
    updateMailCount(0);
    const loadingMessages = document.getElementById("loadingMessages");
    const emailList = document.getElementById("emailList");
    const noMessagesText = document.getElementById("noMessages");

    if (loadingMessages) loadingMessages.style.display = "none";
    if (emailList)
      emailList.innerHTML = `<div style="color: red; padding: 16px;">Error fetching messages: ${error.message}</div>`;
    if (noMessagesText) noMessagesText.style.display = "none";
  }
}

// --- Function to update mail count display ---
function updateMailCount(count) {
  const mailCountElement = document.getElementById("mailCount");
  const inboxTextElement = document.getElementById("inboxText");

  if (mailCountElement && inboxTextElement) {
    if (count > 0) {
      mailCountElement.textContent = count;
      mailCountElement.style.display = "inline-block";
      inboxTextElement.textContent = "Inbox";
    } else {
      mailCountElement.style.display = "none";
      inboxTextElement.textContent = "Inbox";
    }
  }
}

// --- Function to display email list ---
function displayEmailList(messages) {
  const emailList = document.getElementById("emailList");
  if (!emailList) return;

  emailList.innerHTML = "";

  messages.forEach((message, index) => {
    const emailItem = document.createElement("div");
    emailItem.className = "email-item";
    emailItem.dataset.messageId = message.id;

    // Extract preview text (first 100 chars)
    let previewText = "No preview available";
    if (message.text) {
      previewText = message.text.substring(0, 100);
    } else if (message.intro) {
      previewText = message.intro;
    }

    emailItem.innerHTML = `
      <div class="email-from">${message.from.address}</div>
      <div class="email-subject">${message.subject || "(No Subject)"}</div>
      <div class="email-preview">${previewText}${
      previewText.length >= 100 ? "..." : ""
    }</div>
      <div class="email-date">${new Date(
        message.createdAt
      ).toLocaleString()}</div>
    `;

    emailItem.addEventListener("click", () => {
      // Remove selection from other items
      document.querySelectorAll(".email-item").forEach((item) => {
        item.classList.remove("selected");
      });

      // Add selection to clicked item
      emailItem.classList.add("selected");
      selectedEmailId = message.id;

      // Show full-screen email detail
      showFullScreenEmail(message);
    });

    emailList.appendChild(emailItem);
  });
}

// --- Function to show full-screen email view ---
async function showFullScreenEmail(message) {
  const inboxListView = document.getElementById("inboxListView");
  const emailDetailFullView = document.getElementById("emailDetailFullView");
  const emailFullContent = document.getElementById("emailFullContent");

  if (!inboxListView || !emailDetailFullView || !emailFullContent) return;

  // Hide list view and show detail view
  inboxListView.style.display = "none";
  emailDetailFullView.style.display = "flex";

  // Show loading state
  emailFullContent.innerHTML = `
    <div class="loading-email-content">
      Loading email content...
    </div>
  `;

  try {
    // Get auth token
    const tokenData = await makeApiRequest("/token", "POST", {
      address: currentDisposableEmailAddress,
      password: currentAccountPassword,
    });

    if (!tokenData || !tokenData.token) {
      throw new Error("Failed to get authentication token.");
    }

    // Fetch full message content
    const fullMessage = await makeApiRequest(
      `/messages/${message.id}`,
      "GET",
      null,
      tokenData.token
    );

    if (fullMessage) {
      // Extract content
      let emailContent = "";
      if (fullMessage.text) {
        emailContent = fullMessage.text;
      } else if (fullMessage.html) {
        // Strip HTML tags for security and clean display
        emailContent = fullMessage.html.replace(/<[^>]*>/g, "");
      } else {
        emailContent = "No message content available.";
      }

      // Display the email in full-screen view
      emailFullContent.innerHTML = `
        <div class="email-header">
          <div class="email-subject-display">${message.subject || "(No Subject)"}</div>
          <div class="email-meta">
            <div class="email-meta-row">
              <span class="email-meta-label">From:</span>
              <span class="email-meta-value">${message.from.address}</span>
            </div>
            <div class="email-meta-row">
              <span class="email-meta-label">To:</span>
              <span class="email-meta-value">${currentDisposableEmailAddress}</span>
            </div>
            <div class="email-meta-row">
              <span class="email-meta-label">Date:</span>
              <span class="email-meta-value">${new Date(message.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div class="email-content">${emailContent}</div>
      `;
    }
  } catch (error) {
    console.error("Error loading email content:", error);
    emailFullContent.innerHTML = `
      <div class="email-header">
        <div class="email-subject-display">${message.subject || "(No Subject)"}</div>
        <div class="email-meta">
          <div class="email-meta-row">
            <span class="email-meta-label">From:</span>
            <span class="email-meta-value">${message.from.address}</span>
          </div>
          <div class="email-meta-row">
            <span class="email-meta-label">Error:</span>
            <span class="email-meta-value" style="color: #dc2626;">Failed to load content</span>
          </div>
        </div>
      </div>
      <div class="email-content" style="color: #dc2626;">
        Error loading email content: ${error.message}
      </div>
    `;
  }
}

// --- Function to go back to email list ---
function goBackToEmailList() {
  const inboxListView = document.getElementById("inboxListView");
  const emailDetailFullView = document.getElementById("emailDetailFullView");

  if (inboxListView && emailDetailFullView) {
    // Show list view and hide detail view
    inboxListView.style.display = "block";
    emailDetailFullView.style.display = "none";
    
    // Clear selection
    document.querySelectorAll(".email-item").forEach((item) => {
      item.classList.remove("selected");
    });
    selectedEmailId = null;
  }
}

// --- Function to start background email polling ---
function startBackgroundEmailPolling() {
  if (
    currentDisposableEmailId &&
    currentDisposableEmailAddress &&
    currentAccountPassword
  ) {
    console.log("Starting background email polling...");

    // Get current message count to send to background
    const currentCount = currentMessages ? currentMessages.length : 0;

    browserAPI.runtime.sendMessage({
      action: "startEmailPolling",
      emailId: currentDisposableEmailId,
      emailAddress: currentDisposableEmailAddress,
      password: currentAccountPassword,
      initialCount: currentCount,
    });
  }
}

// --- Function to stop background email polling ---
function stopBackgroundEmailPolling() {
  browserAPI.runtime.sendMessage({
    action: "stopEmailPolling",
  });
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
  // Stop previous background polling if any
  stopBackgroundEmailPolling();

  updateEmailDisplay("Generating...");

  // Clear messages in modal if open and ensure we're in list view
  const emailList = document.getElementById("emailList");
  const noMessagesText = document.getElementById("noMessages");
  const inboxListView = document.getElementById("inboxListView");
  const emailDetailFullView = document.getElementById("emailDetailFullView");

  if (emailList) emailList.innerHTML = "";
  if (noMessagesText) noMessagesText.style.display = "block";
  
  // Ensure we're in list view (not detail view)
  if (inboxListView && emailDetailFullView) {
    inboxListView.style.display = "block";
    emailDetailFullView.style.display = "none";
  }

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

    // Show success message
    showNotification(
      "Disposable email generated! Background notifications enabled."
    );

    // Start background polling
    startBackgroundEmailPolling();
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
    console.log("NULL VOID Extension loaded");

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
    const backToListButton = document.getElementById("backToList");

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

            // Start background polling
            startBackgroundEmailPolling();
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

    // Back to list button functionality
    if (backToListButton) {
      backToListButton.addEventListener("click", goBackToEmailList);
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
