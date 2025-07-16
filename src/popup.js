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
    console.error("[API Error]", error);
    throw error;
  }
}

// Initialize UI when popup opens
document.addEventListener("DOMContentLoaded", async () => {
  initializeUI();
  await initializeEmailFeatures();
});

function initializeUI() {
  // Initialize the RBI browser button
  const openRBIButton = document.getElementById("openRBIBrowser");
  if (openRBIButton) {
    openRBIButton.addEventListener("click", async () => {
      try {
        showStatusText("Connecting to Remote Browser...");

        // Get selected location
        const locationSelect = document.querySelector(".location-select");
        const selectedLocation = locationSelect
          ? locationSelect.value
          : "singapore";

        // Check for active RBI tab
        const storage = await browserAPI.storage.local.get(["rbiTabId"]);
        if (storage.rbiTabId) {
          try {
            const tab = await browserAPI.tabs.get(storage.rbiTabId);
            if (tab) {
              await browserAPI.tabs.update(tab.id, { active: true });
              window.close();
              return;
            }
          } catch (error) {
            await browserAPI.storage.local.remove(["rbiTabId"]);
          }
        }

        // Create new RBI browser tab
        const rbiUrl = `${browserAPI.runtime.getURL(
          "rbi-browser.html"
        )}?location=${selectedLocation}`;
        const newTab = await browserAPI.tabs.create({
          url: rbiUrl,
          active: true,
        });

        // Store tab info
        await browserAPI.storage.local.set({
          rbiTabId: newTab.id,
          rbiLocation: selectedLocation,
        });

        window.close();
      } catch (error) {
        console.error("Error opening RBI browser:", error);
        showStatusText("Failed to open Remote Browser", "error");
      }
    });
  }

  // Initialize file viewer functionality
  const fileInput = document.getElementById("fileInput");
  const selectFileBtn = document.getElementById("selectFile");
  const viewFileBtn = document.getElementById("viewFile");
  const fileNameSpan = document.getElementById("fileName");

  if (fileInput && selectFileBtn && viewFileBtn) {
    selectFileBtn.addEventListener("click", () => {
      fileInput.click();
    });

    fileInput.addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (file) {
        // Show file name and enable view button
        fileNameSpan.textContent = file.name;
        fileNameSpan.style.display = "inline";
        viewFileBtn.disabled = false;

        // Store file reference
        fileInput.fileData = file;
      }
    });

    viewFileBtn.addEventListener("click", async () => {
      const file = fileInput.fileData;
      if (file) {
        viewFileBtn.disabled = true;
        viewFileBtn.textContent = "Processing...";
        await handleFileUpload(file);
      }
    });
  }

  // Add status text element
  if (!document.getElementById("statusText")) {
    const statusText = document.createElement("div");
    statusText.id = "statusText";
    statusText.className = "status-text";
    document.body.appendChild(statusText);
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
  try {
    showStatusText("Processing file...");

    // Validate file size (limit to 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      showStatusText("File too large. Maximum size is 10MB.", "error");
      return;
    }

    // Read file content
    const fileContent = await readFileAsDataURL(file);

    // Create file info object
    const fileInfo = {
      name: file.name,
      size: file.size,
      type: file.type,
      content: fileContent,
      uploadedAt: new Date().toISOString(),
    };

    // Store file data temporarily
    await browserAPI.storage.local.set({ pendingFileData: fileInfo });

    // Open file viewer in new tab
    const tab = await browserAPI.tabs.create({
      url: browserAPI.runtime.getURL("file-viewer.html"),
      active: true,
    });

    console.log("File viewer opened in new tab:", tab.id);

    // Show success notification
    showStatusText(`File "${file.name}" opened in secure viewer`, "success");

    window.close();
  } catch (error) {
    console.error("Error handling file upload:", error);
    showStatusText("Failed to process file", "error");
  }
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}
