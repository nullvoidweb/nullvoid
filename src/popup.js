// Use browser-specific API namespace
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

// Theme management
const themeIcon = document.querySelector(".theme-icon");
const moonIcon = document.querySelector(".moon-icon");
const sunIcon = document.querySelector(".sun-icon");
const body = document.body;

// Load saved theme or default to dark
const savedTheme = localStorage.getItem("theme") || "dark";
if (savedTheme === "light") {
  body.classList.add("light-theme");
  if (moonIcon) moonIcon.style.display = "none";
  if (sunIcon) sunIcon.style.display = "block";
} else {
  if (moonIcon) moonIcon.style.display = "block";
  if (sunIcon) sunIcon.style.display = "none";
}

// Theme toggle via icon click
if (themeIcon) {
  themeIcon.addEventListener("click", () => {
    if (body.classList.contains("light-theme")) {
      // Switch to dark theme
      body.classList.remove("light-theme");
      localStorage.setItem("theme", "dark");
      if (moonIcon) moonIcon.style.display = "block";
      if (sunIcon) sunIcon.style.display = "none";
    } else {
      // Switch to light theme
      body.classList.add("light-theme");
      localStorage.setItem("theme", "light");
      if (moonIcon) moonIcon.style.display = "none";
      if (sunIcon) sunIcon.style.display = "block";
    }
  });
}

// Logo click handler for branding/navigation
const brandLogo = document.querySelector(".brand-logo");
if (brandLogo) {
  brandLogo.addEventListener("click", () => {
    // Open extension options page or main website
    console.log("Null Void logo clicked");
    // You can add navigation logic here, such as:
    // browserAPI.tabs.create({ url: "https://nullvoid.io" });
    // or browserAPI.runtime.openOptionsPage();
  });
}

// Smart integration toggle
const smartIntegrationToggle = document.getElementById("smartIntegration");
const integrationStatus = document.getElementById("integrationStatus");

if (smartIntegrationToggle) {
  smartIntegrationToggle.addEventListener("change", () => {
    console.log("Smart integration:", smartIntegrationToggle.checked);
    updateIntegrationStatus(smartIntegrationToggle.checked);

    // Trigger the smart integration security system
    if (window.smartIntegrationSecurity) {
      window.smartIntegrationSecurity.handleToggle({
        target: { checked: smartIntegrationToggle.checked },
      });
    }
  });
}

function updateIntegrationStatus(enabled) {
  if (integrationStatus) {
    if (enabled) {
      integrationStatus.className = "integration-status enabled";
      integrationStatus.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="status-icon">
          <circle cx="12" cy="12" r="10"/>
          <path d="M8 12l2 2 4-4"/>
        </svg>
      `;
    } else {
      integrationStatus.className = "integration-status disabled";
      integrationStatus.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="status-icon">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
      `;
    }
  }
}

// Generate random disposable email
function generateDisposableEmail() {
  const domains = ["tempmail.com", "guerrillamail.com", "10minutemail.com"];
  const randomString = Math.random().toString(36).substring(2, 8);
  const randomDomain = domains[Math.floor(Math.random() * domains.length)];
  return `${randomString}@${randomDomain}`;
}
// Service button handlers
document.addEventListener("DOMContentLoaded", () => {
  // Initialize with random email
  const emailInput = document.querySelector(".email-input");
  if (emailInput) {
    emailInput.value = generateDisposableEmail();
  }

  // Disposable Browser buttons - more specific selectors
  const browserSection = document.querySelector(".service-section");
  const startButton = browserSection
    ? browserSection.querySelector(".btn-primary")
    : null;
  if (startButton && startButton.textContent.trim() === "start") {
    startButton.addEventListener("click", () => {
      console.log("Starting disposable browser...");
      startButton.textContent = "Starting...";
      setTimeout(() => {
        startButton.textContent = "start";
      }, 2000);
    });
  }

  const singaporeButton = browserSection
    ? browserSection.querySelector(".btn-secondary")
    : null;
  if (singaporeButton && singaporeButton.textContent.trim() === "singapore") {
    singaporeButton.addEventListener("click", () => {
      console.log("Changing region...");
      const regions = ["singapore", "usa", "europe", "japan"];
      const currentIndex = regions.indexOf(singaporeButton.textContent.trim());
      const nextIndex = (currentIndex + 1) % regions.length;
      singaporeButton.textContent = regions[nextIndex];
    });
  }

  // Email functionality
  const copyButton = document.querySelector(".email-controls .btn-small");
  if (copyButton) {
    copyButton.addEventListener("click", async () => {
      const emailInput = document.querySelector(".email-input");
      if (emailInput) {
        try {
          await navigator.clipboard.writeText(emailInput.value);
          copyButton.textContent = "copied!";
          setTimeout(() => {
            copyButton.textContent = "copy";
          }, 2000);
        } catch (err) {
          console.error("Failed to copy email:", err);
        }
      }
    });
  }

  const inboxButton = document.getElementById("openInbox");
  if (inboxButton) {
    inboxButton.addEventListener("click", () => {
      console.log("Opening inbox...");
      const modal = document.getElementById("inboxModal");
      if (modal) {
        modal.style.display = "block";
      }
    });
  }

  // File viewer buttons
  const uploadButton = document.getElementById("selectFile");
  const viewButton = document.getElementById("viewFile");

  if (uploadButton) {
    uploadButton.addEventListener("click", () => {
      console.log("Opening file upload...");
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "*/*";
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          console.log("File selected:", file.name);
          uploadButton.textContent = "uploaded!";
          setTimeout(() => {
            uploadButton.textContent = "upload";
          }, 2000);
        }
      };
      input.click();
    });
  }

  if (viewButton) {
    viewButton.addEventListener("click", () => {
      console.log("Opening file viewer...");
      viewButton.textContent = "viewing...";
      setTimeout(() => {
        viewButton.textContent = "view";
      }, 2000);
    });
  }

  // AI chat search
  const searchInput = document.getElementById("aiSearchInput");
  if (searchInput) {
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        console.log("AI chat search:", searchInput.value);
        searchInput.placeholder = "searching...";
        setTimeout(() => {
          searchInput.placeholder = "search bar";
          searchInput.value = "";
        }, 2000);
      }
    });
  }

  // Modal close functionality
  const closeModal = document.getElementById("closeInbox");
  if (closeModal) {
    closeModal.addEventListener("click", () => {
      const modal = document.getElementById("inboxModal");
      if (modal) {
        modal.style.display = "none";
      }
    });
  }

  // Close modal when clicking outside
  window.addEventListener("click", (e) => {
    const modal = document.getElementById("inboxModal");
    if (e.target === modal) {
      modal.style.display = "none";
    }
  });
});

// Regenerate email functionality
const regenerateEmailText = document.querySelector(".email-actions span");
if (regenerateEmailText) {
  regenerateEmailText.style.cursor = "pointer";
  regenerateEmailText.style.textDecoration = "underline";
  regenerateEmailText.style.textDecorationStyle = "dotted";
  regenerateEmailText.addEventListener("click", () => {
    const emailInput = document.querySelector(".email-input");
    if (emailInput) {
      emailInput.value = generateDisposableEmail();
      console.log("New email generated:", emailInput.value);
    }
  });
}

// --- API Configuration (keeping existing email API functionality) ---
const TEMP_MAIL_API_BASE_URL = "https://api.mail.tm";
let currentDisposableEmailAddress = "";
let currentDisposableEmailId = "";
let currentAccountPassword = "";
let intervalId = null;
let selectedEmailId = null;
let currentMessages = [];

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
    console.error("[API Request] Error:", error);
    throw error;
  }
}

// Initialize UI when popup opens
document.addEventListener("DOMContentLoaded", async () => {
  await initializeEmailFeatures();
  initializeAIFeatures();
});

function initializeAIFeatures() {
  const aiSearchInput = document.getElementById("aiSearchInput");

  // AI search is already handled in the main event listeners above
  // This function can be used for additional AI features if needed
  if (aiSearchInput) {
    console.log("AI search input initialized");
  }
}

async function initializeEmailFeatures() {
  try {
    // Check for existing email
    const storage = await browserAPI.storage.local.get([
      "disposableEmail",
      "disposableEmailId",
      "authToken",
    ]);

    if (
      storage.disposableEmail &&
      storage.disposableEmailId &&
      storage.authToken
    ) {
      currentDisposableEmailAddress = storage.disposableEmail;
      currentDisposableEmailId = storage.disposableEmailId;
      await updateUIWithEmail(storage.disposableEmail);
      await startEmailPolling();
    }
  } catch (error) {
    console.error("Error initializing email features:", error);
    showStatusText("Error loading email features", "error");
  }
}

function showStatusText(message, type = "info") {
  const statusText = document.getElementById("statusText");
  if (statusText) {
    statusText.textContent = message;
    statusText.className = `status-text ${type}`;
    statusText.style.opacity = "1";

    setTimeout(() => {
      statusText.style.opacity = "0";
    }, 3000);
  }
}

// --- Email Management Functions ---

async function generateDisposableEmail() {
  try {
    showStatusText("Generating new email address...");

    // Get available domains
    const domains = await makeApiRequest("/domains");
    if (!domains || domains.length === 0) {
      throw new Error("No available email domains");
    }

    const domain = domains[0].domain;
    const randomPrefix = Math.random().toString(36).substring(2, 12);
    const email = `${randomPrefix}@${domain}`;
    const password = Math.random().toString(36).substring(2, 12);

    // Create account
    const account = await makeApiRequest("/accounts", "POST", {
      address: email,
      password: password,
    });

    // Get auth token
    const auth = await makeApiRequest("/token", "POST", {
      address: email,
      password: password,
    });

    // Save credentials
    currentDisposableEmailAddress = email;
    currentDisposableEmailId = account.id;
    currentAccountPassword = password;

    await browserAPI.storage.local.set({
      disposableEmail: email,
      disposableEmailId: account.id,
      authToken: auth.token,
    });

    await updateUIWithEmail(email);
    await startEmailPolling();

    showStatusText("New email address generated!", "success");
  } catch (error) {
    console.error("Error generating email:", error);
    showStatusText("Failed to generate email address", "error");
  }
}

async function updateUIWithEmail(email) {
  const emailDisplay = document.querySelector(".email-display");
  if (emailDisplay) {
    emailDisplay.textContent = email;
  }

  const copyBtn = document.querySelector(".copy-btn");
  if (copyBtn) {
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(email);
      showStatusText("Email copied to clipboard!", "success");
    };
  }

  await updateInboxDisplay();
}

async function startEmailPolling() {
  if (intervalId) {
    clearInterval(intervalId);
  }

  // Poll for new emails every 10 seconds
  intervalId = setInterval(async () => {
    await updateInboxDisplay();
  }, 10000);

  // Initial update
  await updateInboxDisplay();
}

async function updateInboxDisplay() {
  try {
    const storage = await browserAPI.storage.local.get(["authToken"]);
    if (!storage.authToken) return;

    const messages = await makeApiRequest(
      "/messages",
      "GET",
      null,
      storage.authToken
    );
    currentMessages = messages;

    const inboxList = document.querySelector(".inbox-list");
    if (!inboxList) return;

    inboxList.innerHTML = "";

    messages.forEach((message) => {
      const item = document.createElement("div");
      item.className = "inbox-item";
      item.onclick = () => showEmailDetails(message.id);

      item.innerHTML = `
        <div class="email-subject">${message.subject || "No Subject"}</div>
        <div class="email-from">${message.from.address}</div>
        <div class="email-time">${new Date(
          message.createdAt
        ).toLocaleTimeString()}</div>
      `;

      inboxList.appendChild(item);
    });
  } catch (error) {
    console.error("Error updating inbox:", error);
  }
}

async function showEmailDetails(messageId) {
  const message = currentMessages.find((m) => m.id === messageId);
  if (!message) return;

  selectedEmailId = messageId;

  const detailView = document.querySelector(".email-detail-view");
  if (!detailView) return;

  detailView.innerHTML = `
    <div class="detail-header">
      <button class="back-btn">← Back</button>
      <h3>${message.subject || "No Subject"}</h3>
      <div class="detail-meta">
        From: ${message.from.address}<br>
        Time: ${new Date(message.createdAt).toLocaleString()}
      </div>
    </div>
    <div class="detail-body">${message.html || message.text}</div>
  `;

  const backBtn = detailView.querySelector(".back-btn");
  if (backBtn) {
    backBtn.onclick = () => {
      selectedEmailId = null;
      detailView.innerHTML = "";
    };
  }
}

async function handleFileUpload(file) {
  const viewFileBtn = document.getElementById("viewFile");

  try {
    showStatusText("Processing file...");

    // Validate file size (limit to 50MB for better compatibility)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      showStatusText("File too large. Maximum size is 50MB.", "error");
      resetViewButton(viewFileBtn);
      return;
    }

    // Security check for dangerous file types
    const dangerousExtensions = [
      ".exe",
      ".bat",
      ".cmd",
      ".scr",
      ".vbs",
      ".com",
      ".pif",
    ];
    const extension = file.name
      .toLowerCase()
      .substring(file.name.lastIndexOf("."));

    if (dangerousExtensions.includes(extension)) {
      const proceed = confirm(
        `Warning: "${file.name}" is a potentially dangerous file type.\n\n` +
          `Opening executable files can harm your computer.\n\n` +
          `Do you want to proceed with caution?`
      );

      if (!proceed) {
        showStatusText("File viewing cancelled for security.", "warning");
        resetViewButton(viewFileBtn);
        return;
      }
    }

    showStatusText("Reading file content...");

    // Read file content
    const fileContent = await readFileAsDataURL(file);

    // Create file info object
    const fileInfo = {
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      content: fileContent,
      uploadedAt: new Date().toISOString(),
      securityLevel: assessFileSecurityLevel(file.name, file.type, file.size),
    };

    showStatusText("Opening secure viewer...");

    // Store file data temporarily
    await browserAPI.storage.local.set({ pendingFileData: fileInfo });

    // Open file viewer in new tab
    const tab = await browserAPI.tabs.create({
      url: browserAPI.runtime.getURL("file-viewer.html"),
      active: true,
    });

    console.log("[File Viewer] Opened in new tab:", tab.id);

    // Show success notification
    showStatusText(`File "${file.name}" opened in secure viewer`, "success");

    // Reset button after short delay
    setTimeout(() => resetViewButton(viewFileBtn), 2000);
  } catch (error) {
    console.error("[File Viewer] Error handling file upload:", error);
    showStatusText(`Failed to process file: ${error.message}`, "error");
    resetViewButton(viewFileBtn);
  }
}

function resetViewButton(viewFileBtn) {
  if (viewFileBtn) {
    viewFileBtn.disabled = false;
    viewFileBtn.textContent = "View Safely";
  }
}

function assessFileSecurityLevel(name, type, size) {
  const dangerousExtensions = [
    ".exe",
    ".bat",
    ".cmd",
    ".scr",
    ".vbs",
    ".js",
    ".jar",
  ];
  const extension = name.toLowerCase().substring(name.lastIndexOf("."));

  if (dangerousExtensions.includes(extension)) {
    return "high-risk";
  } else if (size > 50 * 1024 * 1024) {
    // 50MB
    return "medium-risk";
  } else if (type && type.startsWith("application/")) {
    return "medium-risk";
  } else {
    return "safe";
  }
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = (error) => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function showStatusText(message, type = "info") {
  // Create or get status element
  let statusElement = document.getElementById("fileViewerStatus");

  if (!statusElement) {
    statusElement = document.createElement("div");
    statusElement.id = "fileViewerStatus";
    statusElement.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      z-index: 10000;
      max-width: 250px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(statusElement);
  }

  // Set message and style based on type
  statusElement.textContent = message;

  const styles = {
    info: { background: "#3b82f6", color: "white" },
    success: { background: "#10b981", color: "white" },
    error: { background: "#ef4444", color: "white" },
    warning: { background: "#f59e0b", color: "white" },
  };

  const style = styles[type] || styles.info;
  statusElement.style.background = style.background;
  statusElement.style.color = style.color;
  statusElement.style.opacity = "1";

  // Auto-hide after delay
  clearTimeout(statusElement.hideTimeout);
  statusElement.hideTimeout = setTimeout(
    () => {
      if (statusElement.parentNode) {
        statusElement.style.opacity = "0";
        setTimeout(() => {
          if (statusElement.parentNode) {
            statusElement.parentNode.removeChild(statusElement);
          }
        }, 300);
      }
    },
    type === "error" ? 5000 : 3000
  );
}

// --- Smart Integration Security System ---
class SmartIntegrationSecurity {
  constructor() {
    this.isEnabled = true;
    this.init();
  }

  async init() {
    // Get current state from storage
    const result = await browserAPI.storage.local.get([
      "smartIntegrationEnabled",
    ]);
    this.isEnabled = result.smartIntegrationEnabled !== false; // Default to true

    // Update UI
    const toggle = document.getElementById("smartIntegration");
    if (toggle) {
      toggle.checked = this.isEnabled;
      toggle.addEventListener("change", (e) => this.handleToggle(e));
    }

    // Update visual status
    updateIntegrationStatus(this.isEnabled);

    // Initialize security systems
    if (this.isEnabled) {
      this.enableSecuritySystems();
    }

    console.log(
      "[Smart Integration] Security system initialized:",
      this.isEnabled ? "ENABLED" : "DISABLED"
    );
  }

  async handleToggle(event) {
    this.isEnabled = event.target.checked;

    // Save state
    await browserAPI.storage.local.set({
      smartIntegrationEnabled: this.isEnabled,
    });

    // Update visual status
    updateIntegrationStatus(this.isEnabled);

    if (this.isEnabled) {
      this.enableSecuritySystems();
      this.showNotification(
        "Smart Integration Enabled",
        "Malicious website blocking, file protection, and ad blocking are now active."
      );
    } else {
      this.disableSecuritySystems();
      this.showNotification(
        "Smart Integration Disabled",
        "Security features have been disabled. Browse with caution."
      );
    }

    console.log(
      "[Smart Integration] Security system:",
      this.isEnabled ? "ENABLED" : "DISABLED"
    );
  }

  async enableSecuritySystems() {
    // Send message to background script to enable security
    try {
      await browserAPI.runtime.sendMessage({
        action: "enableSecurity",
        systems: {
          malwareBlocking: true,
          fileProtection: true,
          adBlocking: true,
        },
      });

      // Send message to all content scripts to enable security
      const tabs = await browserAPI.tabs.query({});
      for (const tab of tabs) {
        try {
          await browserAPI.tabs.sendMessage(tab.id, {
            action: "toggleSecurity",
            enabled: true,
          });
        } catch (error) {
          // Ignore errors for tabs that can't receive messages
        }
      }
    } catch (error) {
      console.error(
        "[Smart Integration] Failed to enable security systems:",
        error
      );
    }
  }

  async disableSecuritySystems() {
    // Send message to background script to disable security
    try {
      await browserAPI.runtime.sendMessage({
        action: "disableSecurity",
      });

      // Send message to all content scripts to completely disable security
      const tabs = await browserAPI.tabs.query({});
      for (const tab of tabs) {
        try {
          await browserAPI.tabs.sendMessage(tab.id, {
            action: "toggleSecurity",
            enabled: false,
          });
        } catch (error) {
          // Ignore errors for tabs that can't receive messages
        }
      }

      // Clear extension badge
      await browserAPI.action.setBadgeText({ text: "" });
    } catch (error) {
      console.error(
        "[Smart Integration] Failed to disable security systems:",
        error
      );
    }
  }

  showNotification(title, message) {
    // Show a brief status message
    const statusElement = document.createElement("div");
    statusElement.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #4CAF50;
      color: white;
      padding: 10px 15px;
      border-radius: 5px;
      font-size: 12px;
      z-index: 10000;
      max-width: 250px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    statusElement.innerHTML = `<strong>${title}</strong><br>${message}`;

    document.body.appendChild(statusElement);

    setTimeout(() => {
      if (statusElement.parentNode) {
        statusElement.parentNode.removeChild(statusElement);
      }
    }, 3000);
  }
}

// Initialize Smart Integration when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  window.smartIntegrationSecurity = new SmartIntegrationSecurity();
});
