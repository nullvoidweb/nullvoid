// NULL VOID Extension - Fixed Popup Script
// Clean, working version with proper event handling

// Use browser-specific API namespace with proper error handling
let browserAPI;
try {
  browserAPI =
    typeof browser !== "undefined"
      ? browser
      : typeof chrome !== "undefined"
      ? chrome
      : null;

  if (!browserAPI) {
    console.error("[Popup] Browser extension API not available!");
    // Create a fallback object to prevent errors
    browserAPI = {
      storage: {
        local: {
          get: () => Promise.resolve({}),
          set: () => Promise.resolve(),
        },
      },
      runtime: {
        sendMessage: () =>
          Promise.resolve({ success: false, error: "API not available" }),
        onMessage: {
          addListener: () => {},
        },
      },
    };
  } else {
    console.log(
      "[Popup] Browser API detected:",
      browserAPI ? "Available" : "Not Available"
    );
  }
} catch (error) {
  console.error("[Popup] Error initializing browser API:", error);
  // Create fallback object
  browserAPI = {
    storage: {
      local: {
        get: () => Promise.resolve({}),
        set: () => Promise.resolve(),
      },
    },
    runtime: {
      sendMessage: () =>
        Promise.resolve({ success: false, error: "API initialization failed" }),
      onMessage: {
        addListener: () => {},
      },
    },
  };
}

// Global state variables
let currentDisposableEmailAddress = null;
let currentDisposableEmailId = null;
let currentEmailToken = null;
let currentEmailAPI = "mail.tm";
let chatHistory = [];
let isAIResponding = false;
let selectedFile = null;

// Auth and Profile state
let authService = null;
let isAuthenticated = false;
let userProfile = null;

// Smart Prevention state tracking
let smartPreventionState = {
  enabled: false,
  lastToggleTime: null,
  isToggling: false,
  persistenceTimeout: null,
  hasInitialized: false,
};

function onSmartPreventionStorageChange(changes, namespace) {
  if (namespace !== "local" || !changes.smartPreventionEnabled) {
    return;
  }

  const newValue = changes.smartPreventionEnabled.newValue;
  if (typeof newValue !== "boolean") {
    return;
  }

  // Ignore updates triggered by the current toggle operation
  if (
    smartPreventionState.isToggling &&
    newValue === smartPreventionState.enabled
  ) {
    return;
  }

  if (
    newValue === smartPreventionState.enabled &&
    smartPreventionState.hasInitialized
  ) {
    return;
  }

  console.log(
    "[Smart Prevention] Storage change detected, syncing UI:",
    newValue
  );

  smartPreventionState.enabled = newValue;
  smartPreventionState.lastToggleTime = Date.now();

  const toggle = document.getElementById("smartPrevention");
  if (toggle) {
    toggle.checked = newValue;
  }
  updateSmartPreventionStatus(newValue);
}

if (browserAPI?.storage?.onChanged) {
  try {
    browserAPI.storage.onChanged.addListener(onSmartPreventionStorageChange);
  } catch (error) {
    console.warn(
      "[Smart Prevention] Failed to attach storage listener:",
      error
    );
  }
}

// AI Configuration
const AI_CONFIG = {
  apiKey: "AIzaSyB-j8iXAEg_W-I2l3PodnJMoO_wgai2VDU",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta",
  model: "gemini-2.5-flash",
  maxTokens: 8000,
  temperature: 0.7,
};

// Initialize extension when DOM is ready
document.addEventListener("DOMContentLoaded", async () => {
  console.log("[Popup] 🚀 NULL VOID Extension Loading...");
  console.log(
    "[Popup] DOM Content Loaded, current readyState:",
    document.readyState
  );

  try {
    // Initialize all components
    console.log("[Popup] Step 1: Initializing buttons...");
    initializeButtons();

    console.log("[Popup] Step 2: Loading saved data...");
    await loadSavedData();

    // Initialize Smart Prevention AFTER buttons are set up
    console.log("[Popup] Step 3: Initializing Smart Prevention...");
    await initializeSmartPrevention();

    console.log("[Popup] Step 4: Initializing Auth...");
    await initializeAuth();

    // Initialize email on startup
    console.log("[Popup] Step 5: Initializing Disposable Email...");
    await initializeDisposableEmail();

    console.log("[Popup] ✅ Extension loaded successfully");
    showNotification("NULL VOID Extension Ready", "success");

    // Final verification
    const smartToggle = document.getElementById("smartPrevention");
    console.log("[Popup] 🔍 Final Smart Prevention toggle check:", {
      exists: !!smartToggle,
      checked: smartToggle?.checked,
      hasListener: smartToggle?.hasAttribute("data-listener-attached"),
    });
  } catch (error) {
    console.error("[Popup] ❌ Extension loading failed:", error);
    showNotification("Extension loading failed", "error");
  }
});

// Initialize all button event listeners
function initializeButtons() {
  console.log("[Popup] Initializing buttons...");

  // Disposable Browser
  const launchBrowserBtn = document.getElementById("launchDisposableBrowser");
  if (launchBrowserBtn) {
    launchBrowserBtn.addEventListener("click", handleLaunchBrowser);
    console.log("[Popup] ✅ Launch browser button ready");
  }

  const selectRegionBtn = document.getElementById("selectRegion");
  if (selectRegionBtn) {
    selectRegionBtn.addEventListener("click", handleSelectRegion);
    console.log("[Popup] ✅ Select region button ready");
  }

  // Email buttons
  const copyEmailBtn = document.getElementById("copyEmailBtn");
  if (copyEmailBtn) {
    copyEmailBtn.addEventListener("click", handleCopyEmail);
    console.log("[Popup] ✅ Copy email button ready");
  }

  const regenerateEmailBtn = document.getElementById("regenerateEmail");
  if (regenerateEmailBtn) {
    regenerateEmailBtn.addEventListener("click", handleRegenerateEmail);
    console.log("[Popup] ✅ Regenerate email button ready");
  }

  const openInboxBtn = document.getElementById("openInbox");
  if (openInboxBtn) {
    openInboxBtn.addEventListener("click", handleOpenInbox);
    console.log("[Popup] ✅ Open inbox button ready");
  }

  // File viewer buttons
  const selectFileBtn = document.getElementById("selectFile");
  if (selectFileBtn) {
    selectFileBtn.addEventListener("click", handleSelectFile);
    console.log("[Popup] ✅ Select file button ready");
  }

  const viewFileBtn = document.getElementById("viewFile");
  if (viewFileBtn) {
    viewFileBtn.addEventListener("click", handleViewFile);
    console.log("[Popup] ✅ View file button ready");
  }

  // AI Chat
  const sendMessageBtn = document.getElementById("sendMessage");
  if (sendMessageBtn) {
    sendMessageBtn.addEventListener("click", handleSendMessage);
    console.log("[Popup] ✅ Send message button ready");
  }

  const clearChatBtn = document.getElementById("clearChat");
  if (clearChatBtn) {
    clearChatBtn.addEventListener("click", handleClearChat);
    console.log("[Popup] ✅ Clear chat button ready");
  }

  // AI Chat input
  const aiChatInput = document.getElementById("aiChatInput");
  if (aiChatInput) {
    aiChatInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });
    console.log("[Popup] ✅ AI chat input ready");
  }

  // File input
  const fileInput = document.getElementById("fileInput");
  if (fileInput) {
    fileInput.addEventListener("change", handleFileSelection);
    console.log("[Popup] ✅ File input ready");
  }

  // Modal close
  const closeInboxBtn = document.getElementById("closeInbox");
  if (closeInboxBtn) {
    closeInboxBtn.addEventListener("click", () => {
      const modal = document.getElementById("inboxModal");
      if (modal) modal.style.display = "none";
    });
  }

  // Back to inbox button
  const backToListBtn = document.getElementById("backToList");
  if (backToListBtn) {
    backToListBtn.addEventListener("click", backToInbox);
    console.log("[Popup] ✅ Back to list button ready");
  }

  // Refresh messages button
  const refreshBtn = document.getElementById("refreshMessages");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", refreshInboxMessages);
    console.log("[Popup] ✅ Refresh messages button ready");
  }

  // Generate new email in inbox
  const generateNewBtn = document.getElementById("generateNewEmail");
  if (generateNewBtn) {
    generateNewBtn.addEventListener("click", async () => {
      await handleRegenerateEmail();
      await refreshInboxMessages();
    });
    console.log("[Popup] ✅ Generate new email button ready");
  }

  // Smart prevention system toggle
  const smartToggle = document.getElementById("smartPrevention");
  if (smartToggle) {
    // DON'T attach listener here - it will be attached in initializeSmartPrevention()
    console.log(
      "[Popup] ✅ Smart prevention system toggle element found (listener will be attached in initializeSmartPrevention)"
    );
  } else {
    console.error("[Popup] ❌ Smart prevention toggle element not found!");
    // List all available elements to debug
    console.log(
      "[Popup] Available input elements:",
      Array.from(document.querySelectorAll("input")).map((el) => ({
        id: el.id,
        type: el.type,
      }))
    );
  }

  // Theme toggle
  initializeTheme();
  console.log("[Popup] ✅ Theme system ready");

  // Profile avatar
  const profileAvatar = document.querySelector(".profile-avatar");
  if (profileAvatar) {
    profileAvatar.addEventListener("click", handleProfileClick);
    console.log("[Popup] ✅ Profile avatar ready");
  }

  // OSINT functionality removed

  // Full AI Chat button
  const openFullAIBtn = document.getElementById("openFullAI");
  if (openFullAIBtn) {
    openFullAIBtn.addEventListener("click", handleOpenFullAI);
    console.log("[Popup] ✅ Full AI Chat button ready");

    // Add visual feedback
    openFullAIBtn.addEventListener("click", () => {
      console.log("[Popup] Full AI Chat button clicked!");
    });
  } else {
    console.error("[Popup] ❌ Full AI Chat button not found!");
  }
}

// Button Handler Functions
async function handleLaunchBrowser() {
  console.log("[Browser] Launching disposable browser...");
  const btn = document.getElementById("launchDisposableBrowser");
  const regionBtn = document.getElementById("selectRegion");
  const region = regionBtn ? regionBtn.textContent.toLowerCase() : "singapore";

  try {
    if (btn) {
      btn.textContent = "Starting...";
      btn.disabled = true;
    }

    showNotification("Launching secure browser...", "info");

    // Send message to background script
    const response = await browserAPI.runtime.sendMessage({
      action: "initializeRBISession",
      region: region,
    });

    if (response && response.success) {
      // Create new tab with RBI browser
      const rbiUrl = browserAPI.runtime.getURL(
        `rbi-browser.html?location=${region}&sessionId=${response.sessionId}`
      );

      console.log("[Browser] Opening RBI URL:", rbiUrl);

      await browserAPI.tabs.create({
        url: rbiUrl,
        active: true,
      });

      showNotification("Secure browser launched!", "success");

      // Store session info
      await browserAPI.storage.local.set({
        activeRBISession: {
          sessionId: response.sessionId,
          region: region,
          startTime: Date.now(),
        },
      });
    } else {
      throw new Error(response?.error || "Failed to launch browser");
    }
  } catch (error) {
    console.error("[Browser] Launch failed:", error);
    showNotification("Failed to launch browser: " + error.message, "error");

    // Fallback: Try direct launch without background script
    try {
      console.log("[Browser] Trying fallback launch...");
      const fallbackSessionId = "fallback_" + Date.now();
      const rbiUrl = browserAPI.runtime.getURL(
        `rbi-browser.html?location=${region}&sessionId=${fallbackSessionId}`
      );

      await browserAPI.tabs.create({
        url: rbiUrl,
        active: true,
      });

      showNotification("Browser launched (fallback mode)", "success");
    } catch (fallbackError) {
      console.error("[Browser] Fallback launch also failed:", fallbackError);
      showNotification("Complete launch failure", "error");
    }
  } finally {
    if (btn) {
      btn.textContent = "start";
      btn.disabled = false;
    }
  }
}

function handleSelectRegion() {
  console.log("[Browser] Selecting region...");
  const btn = document.getElementById("selectRegion");
  if (!btn) return;

  const regions = ["singapore", "usa", "europe", "japan", "canada"];
  const currentRegion = btn.textContent.toLowerCase();
  const currentIndex = regions.indexOf(currentRegion);
  const nextIndex = (currentIndex + 1) % regions.length;
  const nextRegion = regions[nextIndex];

  btn.textContent = nextRegion;
  showNotification(`Region changed to ${nextRegion}`, "info");
}

async function handleCopyEmail() {
  console.log("[Email] Copying email...");
  const emailInput = document.getElementById("disposableEmail");

  if (
    !emailInput ||
    !emailInput.value ||
    emailInput.value === "your@email.com"
  ) {
    showNotification("No email to copy. Generate one first.", "warning");
    return;
  }

  try {
    await navigator.clipboard.writeText(emailInput.value);
    showNotification("Email copied to clipboard!", "success");
  } catch (error) {
    console.error("[Email] Copy failed:", error);
    showNotification("Failed to copy email", "error");
  }
}

async function handleRegenerateEmail() {
  console.log("[Email] Regenerating email...");
  const btn = document.getElementById("regenerateEmail");
  const emailInput = document.getElementById("disposableEmail");

  if (!btn || !emailInput) {
    console.error("[Email] Required elements not found");
    return;
  }

  try {
    // Update button state
    btn.textContent = "Generating...";
    btn.disabled = true;
    emailInput.value = "Generating new email...";

    showNotification("🔄 Generating new disposable email...", "info");

    // Clear old email data
    currentDisposableEmailAddress = null;
    currentDisposableEmailId = null;
    currentEmailToken = null;
    currentEmailAPI = "mail.tm";
    await browserAPI.storage.local.remove([
      "disposableEmail",
      "disposableEmailId",
      "emailToken",
      "emailPassword",
      "emailAPI",
      "emailCreatedAt",
    ]);

    // Generate new email with improved error handling
    const email = await generateDisposableEmail();

    // Update UI - the generateDisposableEmail function already saved to storage
    emailInput.value = email;
    btn.textContent = "regenerate email";
    btn.disabled = false;

    showNotification("✅ New disposable email generated!", "success");
    console.log("[Email] Successfully generated:", email);
  } catch (error) {
    console.error("[Email] Regeneration failed:", error);

    // Restore previous email if available
    const storage = await browserAPI.storage.local.get(["disposableEmail"]);
    if (storage.disposableEmail && emailInput) {
      emailInput.value = storage.disposableEmail;
    } else if (emailInput) {
      emailInput.value = "your@email.com";
    }

    // Show specific error message
    let errorMessage = "Failed to generate email";
    if (error.message.includes("timeout")) {
      errorMessage = "Request timed out. Please try again.";
    } else if (error.message.includes("Rate limited")) {
      errorMessage = "Too many requests. Please wait a moment and try again.";
    } else if (error.message.includes("domains")) {
      errorMessage =
        "Email service temporarily unavailable. Please try again later.";
    } else {
      errorMessage = `Failed to generate email: ${error.message}`;
    }

    showNotification("❌ " + errorMessage, "error");
  } finally {
    if (btn) {
      btn.textContent = "regenerate email";
      btn.disabled = false;
    }
  }
}

async function handleOpenInbox() {
  console.log("[Email] Opening inbox...");

  if (
    !currentDisposableEmailAddress ||
    currentDisposableEmailAddress === "loading..."
  ) {
    showNotification("No active email. Generate one first.", "warning");
    return;
  }

  try {
    // Show modal first
    const modal = document.getElementById("inboxModal");
    if (modal) {
      modal.style.display = "block";

      // Update email display
      const currentEmailDisplay = document.getElementById(
        "currentEmailDisplay"
      );
      if (currentEmailDisplay) {
        currentEmailDisplay.textContent = currentDisposableEmailAddress;
      }

      // Show loading state
      const emailList = document.getElementById("emailList");
      if (emailList) {
        emailList.innerHTML = '<div class="loading">Loading messages...</div>';
      }

      // Fetch and display messages
      await refreshInboxMessages();
    }
  } catch (error) {
    console.error("[Email] Inbox failed:", error);
    showNotification("Failed to open inbox: " + error.message, "error");
  }
}

function handleSelectFile() {
  console.log("[File] Selecting file...");
  const fileInput = document.getElementById("fileInput");
  if (fileInput) {
    fileInput.click();
  }
}

function handleFileSelection(event) {
  const file = event.target.files[0];
  if (!file) return;

  console.log("[File] File selected:", file.name);
  selectedFile = file;

  // Update UI
  const fileNameDisplay = document.getElementById("selectedFileName");
  const fileSizeDisplay = document.getElementById("selectedFileSize");
  const fileInfoDisplay = document.getElementById("fileInfoDisplay");
  const viewFileBtn = document.getElementById("viewFile");

  if (fileNameDisplay) fileNameDisplay.textContent = file.name;
  if (fileSizeDisplay) fileSizeDisplay.textContent = formatFileSize(file.size);
  if (fileInfoDisplay) fileInfoDisplay.style.display = "block";
  if (viewFileBtn) viewFileBtn.disabled = false;

  showNotification(`File selected: ${file.name}`, "success");
}

async function handleViewFile() {
  if (!selectedFile) {
    showNotification("No file selected", "warning");
    return;
  }

  console.log("[File] Viewing file:", selectedFile.name);

  try {
    // Convert file to data URL
    const dataUrl = await fileToDataUrl(selectedFile);

    // Store file data
    await browserAPI.storage.local.set({
      pendingFileData: {
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type,
        content: dataUrl,
      },
    });

    // Open file viewer
    const viewerUrl = browserAPI.runtime.getURL("file-viewer-secure.html");
    await browserAPI.tabs.create({
      url: viewerUrl,
      active: true,
    });

    showNotification("File viewer opened!", "success");
  } catch (error) {
    console.error("[File] View failed:", error);
    showNotification("Failed to view file: " + error.message, "error");
  }
}

async function handleSendMessage() {
  const chatInput = document.getElementById("aiChatInput");
  if (!chatInput || !chatInput.value.trim()) return;

  const message = chatInput.value.trim();
  console.log("[AI] Sending message:", message);

  if (isAIResponding) {
    showNotification("AI is already responding...", "warning");
    return;
  }

  try {
    isAIResponding = true;
    const sendBtn = document.getElementById("sendMessage");
    if (sendBtn) sendBtn.disabled = true;

    // Add user message
    addChatMessage(message, true);
    chatInput.value = "";

    // Show typing indicator
    showTypingIndicator();

    // Get AI response
    const rawResponse = await sendAIMessage(message);

    // Clean up formatting in AI response
    const response = cleanResponseFormatting(rawResponse);

    // Remove typing indicator
    hideTypingIndicator();

    // Add AI response
    addChatMessage(response, false);

    // Save to history
    chatHistory.push(
      { role: "user", content: message },
      { role: "assistant", content: response }
    );

    // Keep history manageable
    if (chatHistory.length > 20) {
      chatHistory = chatHistory.slice(-20);
    }

    await browserAPI.storage.local.set({ chatHistory });
  } catch (error) {
    console.error("[AI] Message failed:", error);
    hideTypingIndicator();

    // Provide more specific error messages
    let errorMessage = "Sorry, I encountered an error. Please try again.";
    if (error.message.includes("API key invalid")) {
      errorMessage = "API key error. Please check configuration.";
    } else if (error.message.includes("Rate limit exceeded")) {
      errorMessage = "Rate limit exceeded. Please wait a moment and try again.";
    } else if (error.message.includes("Content blocked")) {
      errorMessage =
        "Your message was blocked by safety filters. Please rephrase and try again.";
    } else if (error.message.includes("quota exceeded")) {
      errorMessage = "API quota exceeded. Please try again later.";
    }

    addChatMessage(errorMessage, false, true);
  } finally {
    isAIResponding = false;
    const sendBtn = document.getElementById("sendMessage");
    if (sendBtn) sendBtn.disabled = false;
  }
}

function handleClearChat() {
  console.log("[AI] Clearing chat...");

  const chatMessages = document.getElementById("chatMessages");
  if (chatMessages) {
    chatMessages.innerHTML = `
      <div class="chat-message ai-message">
        <div class="message-content">
          <span class="message-text">Hello! I'm your AI assistant. How can I help you today?</span>
          <span class="message-time">Just now</span>
        </div>
      </div>
    `;
  }

  chatHistory = [];
  browserAPI.storage.local.set({ chatHistory });
  showNotification("Chat cleared", "success");
}

async function handleSmartPreventionToggle() {
  console.log("[Smart Prevention] Toggle function called");

  // Prevent double-clicking or rapid toggling
  if (smartPreventionState.isToggling) {
    console.log("[Smart Prevention] Already toggling, ignoring request");
    return;
  }

  smartPreventionState.isToggling = true;
  smartPreventionState.lastToggleTime = Date.now();

  const toggle = document.getElementById("smartPrevention");
  if (!toggle) {
    console.error("[Smart Prevention] Toggle element not found in handler");
    smartPreventionState.isToggling = false;
    return;
  }

  // IMPORTANT: User already clicked, so toggle.checked is ALREADY the new state!
  const newState = toggle.checked;

  console.log(`[Smart Prevention] User toggled to: ${newState}`);

  // Check if browser API is available
  if (!browserAPI || !browserAPI.storage || !browserAPI.storage.local) {
    console.error("[Smart Prevention] Browser storage API not available");
    showNotification("Browser extension API not available", "error");
    // Revert toggle
    toggle.checked = !newState;
    updateSmartPreventionStatus(!newState);
    smartPreventionState.isToggling = false;
    return;
  }

  try {
    // Clear any existing persistence timeout
    if (smartPreventionState.persistenceTimeout) {
      clearTimeout(smartPreventionState.persistenceTimeout);
      smartPreventionState.persistenceTimeout = null;
    }

    // UI is already updated by the user click, just update status indicator
    updateSmartPreventionStatus(newState);

    // Store state immediately with timestamp
    await browserAPI.storage.local.set({
      smartPreventionEnabled: newState,
      smartPreventionTimestamp: Date.now(),
    });

    // Update internal state
    smartPreventionState.enabled = newState;

    console.log("[Smart Prevention] Storage updated successfully");

    // Send message to background script with timeout (non-blocking)
    let response;
    try {
      if (browserAPI.runtime && browserAPI.runtime.sendMessage) {
        console.log("[Smart Prevention] Sending message to background...");
        response = await Promise.race([
          browserAPI.runtime.sendMessage({
            action: "toggleSmartPrevention",
            enabled: newState,
            timestamp: Date.now(),
          }),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Background response timeout after 5s")),
              5000
            )
          ),
        ]);
        console.log(
          "[Smart Prevention] Background response received:",
          response
        );

        if (response && response.success) {
          showNotification(
            `Smart prevention system ${newState ? "enabled" : "disabled"}`,
            "success"
          );
          console.log(
            "[Smart Prevention] Toggle operation completed successfully"
          );
        } else {
          // Background responded but with error - not critical
          console.warn(
            "[Smart Prevention] Background reported issue:",
            response?.error
          );
          showNotification(
            `Smart prevention system ${
              newState ? "enabled" : "disabled"
            } (some features may not work)`,
            "success"
          );
        }
      } else {
        console.warn("[Smart Prevention] Runtime messaging API not available");
        // Continue without background communication
        showNotification(
          `Smart prevention system ${
            newState ? "enabled" : "disabled"
          } (local only)`,
          "success"
        );
      }
    } catch (communicationError) {
      // Background communication failed - NOT critical, state is already saved
      console.warn(
        "[Smart Prevention] Background communication error (non-critical):",
        communicationError.message
      );

      // State is already saved to storage, so this is still a success
      showNotification(
        `Smart prevention system ${newState ? "enabled" : "disabled"}`,
        "success"
      );
    }

    // Set persistence timeout to maintain state regardless of background communication
    smartPreventionState.persistenceTimeout = setTimeout(() => {
      console.log(
        "[Smart Prevention] State persistence timeout - reinforcing state"
      );
      if (toggle.checked !== smartPreventionState.enabled) {
        console.warn("[Smart Prevention] Correcting state drift");
        toggle.checked = smartPreventionState.enabled;
        updateSmartPreventionStatus(smartPreventionState.enabled);
      }
    }, 2000);
  } catch (error) {
    console.error(
      "[Smart Prevention] Critical toggle operation failed:",
      error
    );

    // Only revert for storage errors or other critical failures
    try {
      if (browserAPI.storage && browserAPI.storage.local) {
        await browserAPI.storage.local.set({
          smartPreventionEnabled: !newState,
          smartPreventionTimestamp: Date.now(),
        });
      }
      toggle.checked = !newState;
      smartPreventionState.enabled = !newState;
      updateSmartPreventionStatus(!newState);
      showNotification("Failed to toggle smart prevention system", "error");
    } catch (revertError) {
      console.error("[Smart Prevention] Failed to revert state:", revertError);
      showNotification(
        "Smart prevention system state may be inconsistent",
        "error"
      );
    }
  } finally {
    smartPreventionState.isToggling = false;
  }
}

// Theme Functions
function initializeTheme() {
  console.log("[Theme] Initializing theme system...");

  const themeIcon = document.querySelector(".theme-icon");
  const moonIcon = document.querySelector(".moon-icon");
  const sunIcon = document.querySelector(".sun-icon");
  const body = document.body;

  console.log("[Theme] Elements found:", {
    themeIcon: !!themeIcon,
    moonIcon: !!moonIcon,
    sunIcon: !!sunIcon,
    body: !!body,
  });

  if (!themeIcon || !moonIcon || !sunIcon) {
    console.warn("[Theme] Missing theme elements");
    return;
  }

  // Load saved theme preference
  const savedTheme = localStorage.getItem("theme") || "dark";
  console.log("[Theme] Saved theme:", savedTheme);

  // Apply initial theme
  if (savedTheme === "light") {
    body.classList.add("light-theme");
    moonIcon.style.display = "none";
    sunIcon.style.display = "block";
  } else {
    body.classList.remove("light-theme");
    moonIcon.style.display = "block";
    sunIcon.style.display = "none";
  }

  // Add click handler
  themeIcon.addEventListener("click", handleThemeToggle);
  console.log("[Theme] Theme toggle handler attached");
}

async function handleThemeToggle() {
  console.log("[Theme] Theme toggle clicked");

  const body = document.body;
  const moonIcon = document.querySelector(".moon-icon");
  const sunIcon = document.querySelector(".sun-icon");

  if (!moonIcon || !sunIcon) {
    console.error("[Theme] Missing icon elements");
    return;
  }

  if (body.classList.contains("light-theme")) {
    // Switch to dark theme
    console.log("[Theme] Switching to dark theme");
    body.classList.remove("light-theme");
    localStorage.setItem("theme", "dark");
    moonIcon.style.display = "block";
    sunIcon.style.display = "none";
    showNotification("Dark theme activated", "success");

    // Save to browser storage
    try {
      await browserAPI.storage.local.set({ theme: "dark" });
    } catch (error) {
      console.warn("[Theme] Failed to save theme to storage:", error);
    }
  } else {
    // Switch to light theme
    console.log("[Theme] Switching to light theme");
    body.classList.add("light-theme");
    localStorage.setItem("theme", "light");
    moonIcon.style.display = "none";
    sunIcon.style.display = "block";
    showNotification("Light theme activated", "success");

    // Save to browser storage
    try {
      await browserAPI.storage.local.set({ theme: "light" });
    } catch (error) {
      console.warn("[Theme] Failed to save theme to storage:", error);
    }
  }
}

// Profile Functions
async function initializeAuth() {
  console.log("[Auth] Initializing authentication...");

  try {
    // Wait a bit for auth-service.js to load
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check if AuthService is available
    if (typeof AuthService !== "undefined") {
      authService = new AuthService();
      await authService.initialize();

      isAuthenticated = authService.isUserAuthenticated();
      userProfile = authService.getUserProfile();

      console.log("[Auth] Auth state:", { isAuthenticated, userProfile });

      // Update UI
      updateAuthUI();

      // Listen for auth state changes
      document.addEventListener("authStateChanged", (event) => {
        console.log("[Auth] Auth state changed:", event.detail);
        isAuthenticated = event.detail.isAuthenticated;
        userProfile = event.detail.userProfile;
        updateAuthUI();
      });

      // Listen for background script messages
      browserAPI.runtime.onMessage.addListener((message) => {
        if (message.action === "authStateChanged") {
          isAuthenticated = message.isAuthenticated;
          userProfile = message.userProfile;
          updateAuthUI();
        }
      });
    } else {
      console.warn("[Auth] AuthService not available, using fallback");
      // Try to load saved auth data from storage
      try {
        const storage = await browserAPI.storage.local.get([
          "nullvoid_auth_token",
          "nullvoid_user_profile",
        ]);

        if (storage.nullvoid_auth_token && storage.nullvoid_user_profile) {
          isAuthenticated = true;
          userProfile = storage.nullvoid_user_profile;
          console.log("[Auth] Loaded auth from storage:", userProfile);
        }
      } catch (storageError) {
        console.warn("[Auth] Failed to load from storage:", storageError);
      }

      updateAuthUI(); // Show current state
    }
  } catch (error) {
    console.error("[Auth] Failed to initialize:", error);
    updateAuthUI(); // Show login state
  }
}

function updateAuthUI() {
  const profileAvatar = document.querySelector(".profile-avatar");
  if (!profileAvatar) return;

  // Clear existing content
  profileAvatar.innerHTML = "";

  if (isAuthenticated && userProfile) {
    // Show user profile
    profileAvatar.innerHTML = `
      <div class="profile-info">
        <img src="${
          userProfile.avatar || "icons/icon48.png"
        }" alt="Profile" class="profile-image" />
        <span class="profile-name">${
          userProfile.name || userProfile.username || "User"
        }</span>
      </div>
    `;
    profileAvatar.classList.add("authenticated");
    profileAvatar.title = `Logged in as ${
      userProfile.name || userProfile.username || "User"
    }`;
  } else {
    // Show login icon
    profileAvatar.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    `;
    profileAvatar.classList.remove("authenticated");
    profileAvatar.title = "Click to login";
  }
}

async function handleProfileClick() {
  console.log("[Profile] Profile clicked");

  if (isAuthenticated && userProfile) {
    showProfileMenu();
  } else {
    await handleLoginClick();
  }
}

async function handleLoginClick() {
  console.log("[Auth] Login clicked");

  try {
    // Get the primary domain for login
    const loginDomain = authService
      ? authService.getCurrentDomain()
      : "https://nullvoid.zone.id";
    const loginUrl = `${loginDomain}/login?extension=true`;

    console.log("[Auth] Opening login URL:", loginUrl);

    // Open login page
    await browserAPI.tabs.create({
      url: loginUrl,
      active: true,
    });

    // Show status message to user
    showNotification(
      "Login page opened. After logging in, your profile will sync automatically.",
      "info"
    );

    // If no auth service, set up a simple check for login completion
    if (!authService) {
      // Check periodically if user has logged in
      const checkLoginInterval = setInterval(async () => {
        try {
          const storage = await browserAPI.storage.local.get([
            "nullvoid_auth_token",
            "nullvoid_user_profile",
          ]);

          if (storage.nullvoid_auth_token && storage.nullvoid_user_profile) {
            isAuthenticated = true;
            userProfile = storage.nullvoid_user_profile;
            updateAuthUI();
            showNotification("Login successful!", "success");
            clearInterval(checkLoginInterval);
          }
        } catch (error) {
          console.warn("[Auth] Login check failed:", error);
        }
      }, 2000);

      // Stop checking after 5 minutes
      setTimeout(() => {
        clearInterval(checkLoginInterval);
      }, 300000);
    }
  } catch (error) {
    console.error("[Auth] Login failed:", error);
    showNotification("Failed to open login page", "error");
  }
}

function showProfileMenu() {
  console.log("[Profile] Showing profile menu");

  const baseDomain = authService
    ? authService.getCurrentDomain()
    : "https://nullvoid.zone.id";

  // Create dropdown menu
  const menuItems = [
    {
      text: userProfile.name || userProfile.username || "Profile",
      icon: "👤",
      action: () => {
        const profileUrl = `${baseDomain}/profile`;
        browserAPI.tabs.create({ url: profileUrl });
      },
    },
    {
      text: "View Profile",
      icon: "🔗",
      action: () => {
        const profileUrl = `${baseDomain}/profile`;
        browserAPI.tabs.create({ url: profileUrl });
      },
    },
  ];

  // Add refresh option only if auth service is available
  if (authService) {
    menuItems.push({
      text: "Refresh Profile",
      icon: "🔄",
      action: async () => {
        try {
          showNotification("Refreshing profile...", "info");
          await authService.refreshProfile();
          showNotification("Profile refreshed!", "success");
        } catch (error) {
          console.error("[Profile] Refresh failed:", error);
          showNotification("Failed to refresh profile", "error");
        }
      },
    });
  }

  menuItems.push(
    {
      text: "Account Settings",
      icon: "⚙️",
      action: () => {
        const settingsUrl = `${baseDomain}/settings`;
        browserAPI.tabs.create({ url: settingsUrl });
      },
    },
    {
      text: "Logout",
      icon: "🚪",
      action: async () => {
        try {
          showNotification("Logging out...", "info");

          if (authService) {
            await authService.logout();
          } else {
            // Fallback logout - clear storage
            await browserAPI.storage.local.remove([
              "nullvoid_auth_token",
              "nullvoid_user_profile",
              "nullvoid_current_domain",
              "nullvoid_last_login",
            ]);

            isAuthenticated = false;
            userProfile = null;
            updateAuthUI();
          }

          showNotification("Logged out successfully", "success");
        } catch (error) {
          console.error("[Profile] Logout failed:", error);
          showNotification("Failed to logout", "error");
        }
      },
    }
  );

  const menu = createDropdownMenu(menuItems);

  // Position menu near profile avatar
  const profileAvatar = document.querySelector(".profile-avatar");
  if (profileAvatar && menu) {
    const rect = profileAvatar.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.right = `${window.innerWidth - rect.right}px`;
    menu.style.zIndex = "10000";
  }
}

function createDropdownMenu(items) {
  // Remove existing menu
  const existingMenu = document.querySelector(".profile-dropdown-menu");
  if (existingMenu) {
    existingMenu.remove();
  }

  const menu = document.createElement("div");
  menu.className = "profile-dropdown-menu";
  menu.style.cssText = `
    background: linear-gradient(135deg, #ffffff 0%, #f8fbff 100%);
    border: 1px solid rgba(0, 102, 204, 0.2);
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 102, 204, 0.15);
    padding: 8px 0;
    min-width: 200px;
    font-size: 14px;
  `;

  items.forEach((item) => {
    const menuItem = document.createElement("div");
    menuItem.className = "profile-menu-item";
    menuItem.style.cssText = `
      padding: 12px 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      color: #1a365d;
      transition: all 0.2s ease;
    `;

    menuItem.innerHTML = `
      <span style="font-size: 16px;">${item.icon}</span>
      <span>${item.text}</span>
    `;

    menuItem.addEventListener("mouseenter", () => {
      menuItem.style.background =
        "linear-gradient(135deg, #e8f4ff 0%, #d1e9ff 100%)";
      menuItem.style.color = "#0066cc";
    });

    menuItem.addEventListener("mouseleave", () => {
      menuItem.style.background = "transparent";
      menuItem.style.color = "#1a365d";
    });

    menuItem.addEventListener("click", () => {
      item.action();
      menu.remove();
    });

    menu.appendChild(menuItem);
  });

  // Close menu when clicking outside
  setTimeout(() => {
    document.addEventListener("click", function closeMenu(e) {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener("click", closeMenu);
      }
    });
  }, 100);

  document.body.appendChild(menu);
  return menu;
}

// OSINT functionality removed

async function handleOpenFullAI() {
  console.log("[AI] Opening full AI chat - Gemini style");

  try {
    // Open full AI chat interface with cache busting
    const timestamp = Date.now();
    const aiChatUrl = browserAPI.runtime.getURL(
      `ai-chat-full.html?v=2.0&t=${timestamp}`
    );
    console.log("[AI] AI Chat URL:", aiChatUrl);

    // Create a new tab for the AI chat instead of popup window
    await browserAPI.tabs.create({
      url: aiChatUrl,
      active: true,
    });

    showNotification("NULL VOID AI Chat opened in new tab", "success");
    console.log("[AI] ✅ NULL VOID AI Chat tab created successfully");
  } catch (error) {
    console.error("[AI] Failed to open full chat:", error);
    // Fallback to tab if window creation fails
    try {
      await browserAPI.tabs.create({
        url: aiChatUrl,
        active: true,
      });
      showNotification("AI Chat opened in new tab", "success");
    } catch (tabError) {
      showNotification("Failed to open AI chat: " + error.message, "error");
    }
  }
}

// OSINT search is now handled by background script

// Utility Functions
async function generateDisposableEmail() {
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `[Email] Generation attempt ${attempt}/${maxRetries} using mail.tm`
      );

      // First, get available domains from mail.tm
      const domainsResponse = await fetchWithTimeout(
        "https://api.mail.tm/domains",
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "NULL-VOID-Extension/1.0",
          },
        },
        15000
      );

      if (!domainsResponse.ok) {
        throw new Error(`Failed to get domains: ${domainsResponse.status}`);
      }

      const domainsData = await domainsResponse.json();
      const domains = domainsData["hydra:member"] || [];

      if (domains.length === 0) {
        throw new Error("No available domains from mail.tm");
      }

      // Generate random email address
      const randomStr = Math.random().toString(36).substring(2, 12);
      const domain = domains[0].domain; // Use first available domain
      const email = `${randomStr}@${domain}`;
      const password = Math.random().toString(36).substring(2, 15);

      console.log(`[Email] Attempting to create: ${email}`);

      // Create account with timeout
      const createResponse = await fetchWithTimeout(
        "https://api.mail.tm/accounts",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "NULL-VOID-Extension/1.0",
          },
          body: JSON.stringify({
            address: email,
            password: password,
          }),
        },
        15000
      );

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error(
          `[Email] Create account failed: ${createResponse.status} - ${errorText}`
        );

        if (createResponse.status === 422) {
          // Account already exists, try with different username
          throw new Error("Account conflict, retrying with different username");
        } else if (createResponse.status === 429) {
          // Rate limited, wait longer
          throw new Error("Rate limited, waiting before retry");
        } else {
          throw new Error(`Failed to create account: ${createResponse.status}`);
        }
      }

      const accountData = await createResponse.json();
      console.log(`[Email] Account created successfully: ${accountData.id}`);

      // Small delay before authentication
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Get authentication token with timeout
      const authResponse = await fetchWithTimeout(
        "https://api.mail.tm/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "NULL-VOID-Extension/1.0",
          },
          body: JSON.stringify({
            address: email,
            password: password,
          }),
        },
        15000
      );

      if (!authResponse.ok) {
        const errorText = await authResponse.text();
        console.error(
          `[Email] Authentication failed: ${authResponse.status} - ${errorText}`
        );
        throw new Error(`Failed to authenticate: ${authResponse.status}`);
      }

      const authData = await authResponse.json();
      console.log(`[Email] Authentication successful`);

      // Store globally
      currentDisposableEmailAddress = email;
      currentDisposableEmailId = accountData.id;
      currentEmailToken = authData.token;
      currentEmailAPI = "mail.tm";

      // Save to storage
      await browserAPI.storage.local.set({
        disposableEmail: email,
        disposableEmailId: accountData.id,
        emailToken: authData.token,
        emailPassword: password,
        emailAPI: "mail.tm",
        emailCreatedAt: Date.now(),
      });

      console.log(`[Email] Successfully generated: ${email}`);
      return email;
    } catch (error) {
      console.error(`[Email] Attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        // Last attempt failed, throw the error
        throw new Error(
          `Failed to generate email after ${maxRetries} attempts: ${error.message}`
        );
      }

      // Wait before retrying, with exponential backoff
      const delay = retryDelay * Math.pow(2, attempt - 1);
      console.log(`[Email] Waiting ${delay}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// Helper function for fetch with timeout
async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error("Request timeout");
    }
    throw error;
  }
}

function generateSecurePassword() {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function fetchEmailMessages() {
  if (!currentEmailToken) throw new Error("No email token");

  try {
    const response = await fetchWithTimeout(
      "https://api.mail.tm/messages",
      {
        headers: {
          Authorization: `Bearer ${currentEmailToken}`,
          "Content-Type": "application/json",
          "User-Agent": "NULL-VOID-Extension/1.0",
        },
      },
      10000
    );

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, clear stored data
        console.log("[Email] Token expired, clearing stored data");
        currentDisposableEmailAddress = null;
        currentDisposableEmailId = null;
        currentEmailToken = null;

        await browserAPI.storage.local.remove([
          "disposableEmail",
          "disposableEmailId",
          "emailToken",
          "emailPassword",
        ]);

        throw new Error("Email session expired. Please regenerate email.");
      } else if (response.status === 429) {
        throw new Error("Rate limited. Please try again in a moment.");
      } else {
        throw new Error(`Failed to fetch messages: ${response.status}`);
      }
    }

    const data = await response.json();
    return data["hydra:member"] || [];
  } catch (error) {
    if (error.message.includes("timeout")) {
      throw new Error("Request timed out. Please check your connection.");
    }
    throw error;
  }
}

function displayEmailMessages(messages) {
  const emailList = document.getElementById("emailList");
  const noMessages = document.getElementById("noMessages");

  if (!emailList) return;

  if (messages.length === 0) {
    emailList.innerHTML = "";
    if (noMessages) noMessages.style.display = "block";
    return;
  }

  if (noMessages) noMessages.style.display = "none";

  emailList.innerHTML = messages
    .map((msg, index) => {
      const fromName =
        msg.from?.name || msg.from?.address?.split("@")[0] || "Unknown";
      const fromEmail = msg.from?.address || "unknown@email.com";
      const subject = msg.subject || "No Subject";
      const preview =
        msg.intro || msg.text?.substring(0, 100) || "No preview available";
      const time = formatEmailTime(msg.createdAt);
      const hasAttachments = msg.attachments && msg.attachments.length > 0;

      return `
      <div class="email-item" data-email-id="${
        msg.id
      }" data-email-index="${index}" onclick="openEmailDetail(${index})">
        <div class="email-item-header">
          <div class="email-sender">
            <div class="sender-avatar">${fromName.charAt(0).toUpperCase()}</div>
            <div class="sender-info">
              <div class="sender-name">${fromName}</div>
              <div class="sender-email">${fromEmail}</div>
            </div>
          </div>
          <div class="email-meta">
            <div class="email-time">${time}</div>
            ${hasAttachments ? '<div class="attachment-icon">📎</div>' : ""}
          </div>
        </div>
        <div class="email-subject">${subject}</div>
        <div class="email-preview">${preview}${
        preview.length >= 100 ? "..." : ""
      }</div>
        <div class="email-actions">
          <span class="view-email">Tap to view</span>
        </div>
      </div>
    `;
    })
    .join("");

  // Store messages globally for detail view
  window.currentEmailMessages = messages;
}

function formatEmailTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

function openEmailDetail(emailIndex) {
  if (
    !window.currentEmailMessages ||
    !window.currentEmailMessages[emailIndex]
  ) {
    console.error("Email not found");
    return;
  }

  const email = window.currentEmailMessages[emailIndex];
  const inboxListView = document.getElementById("inboxListView");
  const emailDetailView = document.getElementById("emailDetailFullView");
  const emailContent = document.getElementById("emailFullContent");

  if (!inboxListView || !emailDetailView || !emailContent) {
    console.error("Email detail elements not found");
    return;
  }

  // Hide inbox list and show detail view
  inboxListView.style.display = "none";
  emailDetailView.style.display = "block";

  // Format email content
  const fromName =
    email.from?.name || email.from?.address?.split("@")[0] || "Unknown";
  const fromEmail = email.from?.address || "unknown@email.com";
  const subject = email.subject || "No Subject";
  const date = new Date(email.createdAt).toLocaleString();
  const htmlContent = email.html || email.text || "No content available";

  // Create detailed email view
  emailContent.innerHTML = `
    <div class="email-detail-container">
      <div class="email-detail-header-info">
        <div class="email-detail-subject">${subject}</div>
        <div class="email-detail-from">
          <div class="sender-avatar-large">${fromName
            .charAt(0)
            .toUpperCase()}</div>
          <div class="sender-details">
            <div class="sender-name-large">${fromName}</div>
            <div class="sender-email-small">${fromEmail}</div>
            <div class="email-date">${date}</div>
          </div>
        </div>
      </div>
      
      ${
        email.attachments && email.attachments.length > 0
          ? `
        <div class="email-attachments">
          <div class="attachments-header">📎 Attachments (${
            email.attachments.length
          })</div>
          <div class="attachments-list">
            ${email.attachments
              .map(
                (att) => `
              <div class="attachment-item">
                <span class="attachment-name">${
                  att.filename || "Attachment"
                }</span>
                <span class="attachment-size">${formatFileSize(
                  att.size || 0
                )}</span>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `
          : ""
      }
      
      <div class="email-body">
        <div class="email-content-wrapper">
          ${htmlContent}
        </div>
      </div>
      
      <div class="email-actions-bar">
        <button class="email-action-btn reply-btn" onclick="replyToEmail(${emailIndex})">
          ↩️ Reply
        </button>
        <button class="email-action-btn forward-btn" onclick="forwardEmail(${emailIndex})">
          ➡️ Forward
        </button>
        <button class="email-action-btn delete-btn" onclick="deleteEmail(${emailIndex})">
          🗑️ Delete
        </button>
      </div>
    </div>
  `;
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function backToInbox() {
  const inboxListView = document.getElementById("inboxListView");
  const emailDetailView = document.getElementById("emailDetailFullView");

  if (inboxListView && emailDetailView) {
    emailDetailView.style.display = "none";
    inboxListView.style.display = "block";
  }
}

function replyToEmail(emailIndex) {
  // Placeholder for reply functionality
  showNotification("Reply functionality coming soon!", "info");
}

function forwardEmail(emailIndex) {
  // Placeholder for forward functionality
  showNotification("Forward functionality coming soon!", "info");
}

function deleteEmail(emailIndex) {
  // Placeholder for delete functionality
  showNotification("Delete functionality coming soon!", "info");
}

// Clean up AI response formatting to remove asterisks and markdown
function cleanResponseFormatting(response) {
  if (!response) return response;

  let cleanedResponse = response;

  // Remove markdown bold formatting (**text**)
  cleanedResponse = cleanedResponse.replace(/\*\*([^*]+)\*\*/g, "$1");

  // Remove markdown italic formatting (*text*)
  cleanedResponse = cleanedResponse.replace(/\*([^*]+)\*/g, "$1");

  // Remove markdown headers (### text)
  cleanedResponse = cleanedResponse.replace(/^#{1,6}\s+(.+)$/gm, "$1");

  // Replace markdown bullet points (* text) with clean hyphens (- text)
  cleanedResponse = cleanedResponse.replace(/^\s*\*\s+/gm, "- ");

  // Remove any remaining standalone asterisks
  cleanedResponse = cleanedResponse.replace(/\*/g, "");

  // Clean up backticks and code formatting
  cleanedResponse = cleanedResponse.replace(/`([^`]+)`/g, "$1");
  cleanedResponse = cleanedResponse.replace(/```[^`]*```/g, "");

  // Clean up extra whitespace
  cleanedResponse = cleanedResponse.replace(/\n{3,}/g, "\n\n");
  cleanedResponse = cleanedResponse.trim();

  return cleanedResponse;
}

async function sendAIMessage(message) {
  try {
    // User-friendly prompt for popup AI with clean formatting
    const userFriendlyPrompt = `You are NULL VOID AI, a helpful assistant for users of the NULL VOID browser extension.

🛡️ YOUR ROLE:
- Help users understand and use NULL VOID extension features
- Provide simple, easy-to-follow guidance
- Keep explanations user-friendly and accessible
- Focus on what users can see and do in the extension

🎯 RESPONSE FORMATTING RULES:
- Write in clean, natural sentences without asterisks or special formatting
- Use simple bullet points with hyphens (-) when listing steps
- Write clear paragraph breaks for easy reading
- Use everyday language that flows naturally
- Avoid markdown formatting, asterisks, or special characters in responses
- Make responses feel like friendly conversation, not technical documentation

🎯 RESPONSE GUIDELINES:
- Use simple, clear language that anyone can understand
- Give step-by-step instructions using the extension's buttons and menus
- Focus on user interface elements, not technical details
- Never mention file names, code, or internal configurations
- Be encouraging and helpful
- Keep cybersecurity advice practical and easy to follow
- Format responses as natural, readable text without special characters

⚠️ IMPORTANT:
- NO technical jargon or developer terms
- NO file names or internal system details
- NO asterisks (*) or markdown formatting in responses
- Focus on visible buttons, menus, and options in the extension
- Explain what features do for users, not how they work internally
- Write like you're having a friendly conversation

User Question: ${message}

Provide helpful, user-friendly guidance with clean formatting:`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: userFriendlyPrompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3, // Slightly higher for more natural, friendly responses
        maxOutputTokens: AI_CONFIG.maxTokens,
        topP: 0.8,
        topK: 40,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
      ],
    };

    const response = await fetch(
      `${AI_CONFIG.baseUrl}/models/${AI_CONFIG.model}:generateContent?key=${AI_CONFIG.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[POPUP AI] API Error Response:", errorText);

      if (response.status === 400) {
        throw new Error("Bad request - check your message format");
      } else if (response.status === 403) {
        throw new Error("API key invalid or quota exceeded");
      } else if (response.status === 429) {
        throw new Error("Rate limit exceeded - please wait a moment");
      } else {
        throw new Error(`AI API Error: ${response.status} - ${errorText}`);
      }
    }

    const data = await response.json();

    // Enhanced response validation
    if (!data) {
      throw new Error("Empty response from AI API");
    }

    if (data.error) {
      console.error("[POPUP AI] API returned error:", data.error);
      throw new Error(`AI API Error: ${data.error.message || data.error}`);
    }

    if (!data.candidates || data.candidates.length === 0) {
      if (data.promptFeedback && data.promptFeedback.blockReason) {
        throw new Error(`Content blocked: ${data.promptFeedback.blockReason}`);
      }
      throw new Error("No response candidates from AI API");
    }

    const candidate = data.candidates[0];

    if (candidate.finishReason && candidate.finishReason === "SAFETY") {
      throw new Error("SAFETY: Content was blocked by safety filters");
    }

    if (
      !candidate.content ||
      !candidate.content.parts ||
      candidate.content.parts.length === 0
    ) {
      throw new Error("Invalid response structure from AI API");
    }

    return candidate.content.parts[0].text;
  } catch (error) {
    console.error("[POPUP AI] sendAIMessage Error:", error);
    throw error;
  }
}

function addChatMessage(message, isUser = false, isError = false) {
  const chatMessages = document.getElementById("chatMessages");
  if (!chatMessages) return;

  const messageDiv = document.createElement("div");
  messageDiv.className = `chat-message ${
    isUser ? "user-message" : "ai-message"
  }`;

  messageDiv.innerHTML = `
    <div class="message-content ${isError ? "error-message" : ""}">
      <span class="message-text">${escapeHtml(message)}</span>
      <span class="message-time">${new Date().toLocaleTimeString()}</span>
    </div>
  `;

  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
  const chatMessages = document.getElementById("chatMessages");
  if (!chatMessages) return;

  const typingDiv = document.createElement("div");
  typingDiv.id = "typingIndicator";
  typingDiv.className = "typing-indicator";
  typingDiv.innerHTML = `
    <div class="message-content">
      <span class="message-text">AI is typing...</span>
    </div>
  `;

  chatMessages.appendChild(typingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
  const indicator = document.getElementById("typingIndicator");
  if (indicator) indicator.remove();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Fetch messages from email API
async function refreshInboxMessages() {
  if (!currentDisposableEmailAddress || !currentEmailToken) {
    console.error("[Email] No email address or token available");
    return;
  }

  const emailList = document.getElementById("emailList");
  const noMessages = document.getElementById("noMessages");

  try {
    // Show loading state
    if (emailList) {
      emailList.innerHTML = '<div class="loading">Loading messages...</div>';
    }

    console.log(
      `[Email] Fetching messages for: ${currentDisposableEmailAddress}`
    );

    // Use mail.tm API to fetch messages
    const response = await fetchWithTimeout(
      "https://api.mail.tm/messages",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${currentEmailToken}`,
          "Content-Type": "application/json",
          "User-Agent": "NULL-VOID-Extension/1.0",
        },
      },
      15000
    );

    if (!response.ok) {
      throw new Error(
        `mail.tm API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    const messages = data["hydra:member"] || [];

    console.log(`[Email] Fetched ${messages.length} messages from mail.tm`);

    displayEmailMessages(messages);
  } catch (error) {
    console.error("[Email] Failed to fetch messages:", error);

    if (emailList) {
      emailList.innerHTML = `
        <div class="error">
          <p>Failed to load messages</p>
          <p>Current email: <strong>${currentDisposableEmailAddress}</strong></p>
          <p>Error: ${error.message}</p>
          <p>Try sending an email and refresh in a few minutes.</p>
          <button onclick="refreshInboxMessages()" class="btn btn-primary btn-small">Try Again</button>
        </div>
      `;
    }
  }
}

// Display email messages in the inbox
function displayEmailMessages(messages) {
  const emailList = document.getElementById("emailList");
  const noMessages = document.getElementById("noMessages");

  if (!emailList) return;

  if (!messages || messages.length === 0) {
    emailList.innerHTML = `
      <div class="info-message">
        <h4>Email Address: ${currentDisposableEmailAddress}</h4>
        <p>Send an email to this address from your Gmail account.</p>
        <p>Messages may take 1-2 minutes to appear.</p>
        <button onclick="refreshInboxMessages()" class="btn btn-primary btn-small" style="margin-top: 10px;">
          Refresh Messages
        </button>
      </div>
    `;
    if (noMessages) noMessages.style.display = "block";
    return;
  }

  if (noMessages) noMessages.style.display = "none";

  emailList.innerHTML = messages
    .map(
      (msg) => `
    <div class="email-item" data-id="${msg.id}">
      <div class="email-sender">${
        msg.from?.address || msg.from || "Unknown"
      }</div>
      <div class="email-subject">${msg.subject || "(No subject)"}</div>
      <div class="email-date">${new Date(
        msg.createdAt || msg.date
      ).toLocaleString()}</div>
    </div>
  `
    )
    .join("");

  // Add click handlers
  emailList.querySelectorAll(".email-item").forEach((item) => {
    item.addEventListener("click", () => {
      const msgId = item.getAttribute("data-id");
      viewEmailMessage(msgId);
    });
  });
}

// View individual email message
async function viewEmailMessage(messageId) {
  if (!currentDisposableEmailAddress || !messageId || !currentEmailToken)
    return;

  try {
    // Use mail.tm API to fetch individual message
    const response = await fetchWithTimeout(
      `https://api.mail.tm/messages/${messageId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${currentEmailToken}`,
          "Content-Type": "application/json",
          "User-Agent": "NULL-VOID-Extension/1.0",
        },
      },
      15000
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch message: ${response.status}`);
    }

    const message = await response.json();

    // Show email detail view
    const detailView = document.getElementById("emailDetailFullView");
    const listView = document.getElementById("inboxListView");
    const content = document.getElementById("emailFullContent");

    if (detailView && listView && content) {
      listView.style.display = "none";
      detailView.style.display = "block";

      content.innerHTML = `
        <div class="email-detail">
          <div class="email-header">
            <div><strong>From:</strong> ${
              message.from?.address || message.from || "Unknown"
            }</div>
            <div><strong>To:</strong> ${
              message.to?.[0]?.address || currentDisposableEmailAddress
            }</div>
            <div><strong>Subject:</strong> ${
              message.subject || "(No subject)"
            }</div>
            <div><strong>Date:</strong> ${new Date(
              message.createdAt
            ).toLocaleString()}</div>
          </div>
          <div class="email-body">
            ${message.html || message.text || "(No content)"}
          </div>
        </div>
      `;
    }
  } catch (error) {
    console.error("[Email] Failed to read message:", error);
    showNotification("Failed to load message", "error");
  }
}

// Back to inbox list
function backToInbox() {
  const detailView = document.getElementById("emailDetailFullView");
  const listView = document.getElementById("inboxListView");

  if (detailView && listView) {
    detailView.style.display = "none";
    listView.style.display = "block";
  }
}

// Initialize disposable email
async function initializeDisposableEmail() {
  const emailInput = document.getElementById("disposableEmail");
  if (!emailInput) return;

  try {
    // Check if we have a saved email
    const storage = await browserAPI.storage.local.get([
      "disposableEmail",
      "disposableEmailId",
      "emailToken",
      "emailPassword",
      "emailAPI",
      "emailCreatedAt",
    ]);

    if (
      storage.disposableEmail &&
      storage.emailCreatedAt &&
      storage.emailToken
    ) {
      // Check if email is less than 24 hours old
      const age = Date.now() - storage.emailCreatedAt;
      if (age < 24 * 60 * 60 * 1000) {
        emailInput.value = storage.disposableEmail;
        currentDisposableEmailAddress = storage.disposableEmail;
        currentDisposableEmailId = storage.disposableEmailId;
        currentEmailToken = storage.emailToken;
        currentEmailAPI = storage.emailAPI || "mail.tm";
        return;
      }
    }

    // Generate new email if no valid saved email
    const email = await generateDisposableEmail();
    emailInput.value = email;
  } catch (error) {
    console.error("[Email] Initialization failed:", error);
    emailInput.value = "Error generating email";
  }
}

async function loadSavedData() {
  try {
    const storage = await browserAPI.storage.local.get([
      "disposableEmail",
      "disposableEmailId",
      "emailToken",
      "emailPassword",
      "emailAPI",
      "chatHistory",
      "theme",
    ]);

    if (storage.disposableEmail && storage.emailToken) {
      currentDisposableEmailAddress = storage.disposableEmail;
      currentDisposableEmailId = storage.disposableEmailId;
      currentEmailToken = storage.emailToken;
      currentEmailAPI = storage.emailAPI || "mail.tm";

      const emailInput = document.getElementById("disposableEmail");
      if (emailInput) emailInput.value = storage.disposableEmail;
    } else {
      // No email exists, generate one automatically
      console.log("[Popup] No saved email found, generating new one...");
      setTimeout(async () => {
        try {
          const email = await generateDisposableEmail();
          const emailInput = document.getElementById("disposableEmail");
          if (emailInput) emailInput.value = email;
          showNotification(
            "✅ Disposable email generated automatically",
            "success"
          );
        } catch (error) {
          console.error("[Popup] Auto email generation failed:", error);
          // Don't show error notification for auto-generation failure
        }
      }, 1000); // Delay to ensure UI is ready
    }

    if (storage.chatHistory) {
      chatHistory = storage.chatHistory;
    }

    // Apply saved theme if available
    if (storage.theme) {
      localStorage.setItem("theme", storage.theme);
    }
  } catch (error) {
    console.error("[Popup] Failed to load saved data:", error);
  }
}

async function initializeSmartPrevention() {
  try {
    console.log(
      "[Smart Prevention] Starting Smart Prevention initialization..."
    );

    // Check if browser API is available
    if (!browserAPI) {
      console.error(
        "[Smart Prevention] Browser API not available during initialization"
      );
      return;
    }

    // Wait a bit to ensure DOM is fully ready
    await new Promise((resolve) => setTimeout(resolve, 100));

    // First check if the toggle element exists
    const toggle = document.getElementById("smartPrevention");
    if (!toggle) {
      console.error(
        "[Smart Prevention] Toggle element 'smartPrevention' not found in DOM!"
      );
      console.log(
        "[Smart Prevention] Available elements with 'smart':",
        Array.from(document.querySelectorAll('[id*="smart"]')).map(
          (el) => el.id
        )
      );
      return;
    }

    console.log("[Smart Prevention] Toggle element found:", toggle);

    // Check storage first for most recent state
    let storageResult;
    try {
      if (browserAPI.storage && browserAPI.storage.local) {
        storageResult = await browserAPI.storage.local.get([
          "smartPreventionEnabled",
          "smartPreventionTimestamp",
        ]);
        console.log("[Smart Prevention] Storage result:", storageResult);
      } else {
        console.warn("[Smart Prevention] Storage API not available");
        storageResult = {};
      }
    } catch (error) {
      console.warn("[Smart Prevention] Storage access failed:", error);
      storageResult = {};
    }

    // Get current status from background script with timeout
    let response;
    try {
      if (browserAPI.runtime && browserAPI.runtime.sendMessage) {
        response = await Promise.race([
          browserAPI.runtime.sendMessage({
            action: "getSmartPreventionStatus",
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 5000)
          ),
        ]);
        console.log("[Smart Prevention] Background response:", response);
      } else {
        console.warn("[Smart Prevention] Runtime messaging API not available");
        response = null;
      }
    } catch (error) {
      console.warn(
        "[Smart Prevention] Background communication failed:",
        error
      );
      response = null;
    }

    // Determine the current state (prioritize storage with recent timestamp)
    let currentState = false;
    const storageTimestamp = storageResult.smartPreventionTimestamp || 0;
    const now = Date.now();
    const isRecentStorage = now - storageTimestamp < 30000; // Within 30 seconds

    if (storageResult.smartPreventionEnabled !== undefined && isRecentStorage) {
      currentState = storageResult.smartPreventionEnabled;
      console.log(
        "[Smart Prevention] Using recent storage state:",
        currentState
      );
    } else if (storageResult.smartPreventionEnabled !== undefined) {
      currentState = storageResult.smartPreventionEnabled;
      console.log("[Smart Prevention] Using storage state:", currentState);
    } else if (response && typeof response.enabled === "boolean") {
      currentState = response.enabled;
      console.log("[Smart Prevention] Using background state:", currentState);
    } else {
      console.log("[Smart Prevention] Using default state: false");
    }

    // Update internal state tracking
    smartPreventionState.enabled = currentState;
    smartPreventionState.lastToggleTime = storageTimestamp;
    smartPreventionState.hasInitialized = true;

    // Set the toggle state
    toggle.checked = currentState;
    console.log("[Smart Prevention] Toggle state set to:", currentState);

    // Update UI status indicator
    updateSmartPreventionStatus(currentState);

    // Set up persistence timeout to maintain state
    if (smartPreventionState.persistenceTimeout) {
      clearTimeout(smartPreventionState.persistenceTimeout);
    }

    smartPreventionState.persistenceTimeout = setTimeout(() => {
      console.log("[Smart Prevention] Post-init persistence check");
      if (toggle.checked !== smartPreventionState.enabled) {
        console.log("[Smart Prevention] Correcting toggle state drift");
        toggle.checked = smartPreventionState.enabled;
        updateSmartPreventionStatus(smartPreventionState.enabled);
      }
    }, 1000);

    // Ensure the toggle event listener is attached
    if (!toggle.hasAttribute("data-listener-attached")) {
      toggle.addEventListener("change", handleSmartPreventionToggle);
      toggle.setAttribute("data-listener-attached", "true");
      console.log("[Smart Prevention] Event listener attached to toggle");
    }

    console.log("[Smart Prevention] Initialization completed successfully");
  } catch (error) {
    console.error("[Smart Prevention] Failed to initialize:", error);

    // Set default state on error
    const toggle = document.getElementById("smartPrevention");
    if (toggle) {
      toggle.checked = false;
      smartPreventionState.enabled = false;
      updateSmartPreventionStatus(false);
      smartPreventionState.hasInitialized = true;

      // Ensure event listener is still attached even on error
      if (!toggle.hasAttribute("data-listener-attached")) {
        toggle.addEventListener("change", handleSmartPreventionToggle);
        toggle.setAttribute("data-listener-attached", "true");
      }
    }
  }
}

// Cleanup function to maintain state when popup is closed
function cleanupSmartPreventionState() {
  console.log("[Smart Prevention] Cleaning up state on popup close");

  // Clear any existing persistence timeouts
  if (smartPreventionState.persistenceTimeout) {
    clearTimeout(smartPreventionState.persistenceTimeout);
    smartPreventionState.persistenceTimeout = null;
  }
}

// Listen for popup unload to maintain state
window.addEventListener("beforeunload", cleanupSmartPreventionState);
window.addEventListener("pagehide", cleanupSmartPreventionState);

// Also listen for visibility changes to reinforce state
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    cleanupSmartPreventionState();
  } else {
    // Popup is visible again, reinforce current state
    setTimeout(() => {
      const toggle = document.getElementById("smartPrevention");
      if (toggle && toggle.checked !== smartPreventionState.enabled) {
        console.log(
          "[Smart Prevention] Correcting state after visibility change"
        );
        toggle.checked = smartPreventionState.enabled;
        updateSmartPreventionStatus(smartPreventionState.enabled);
      }
    }, 100);
  }
});

// Update Smart Prevention status indicator
function updateSmartPreventionStatus(enabled) {
  const statusElement = document.getElementById("integrationStatus");
  if (statusElement) {
    if (enabled) {
      statusElement.classList.add("active");
      statusElement.title = "Smart Prevention System Active";
    } else {
      statusElement.classList.remove("active");
      statusElement.title = "Smart Prevention System Inactive";
    }
  }
}

function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${
      type === "success" ? "#22c55e" : type === "error" ? "#ef4444" : "#3b82f6"
    };
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-width: 300px;
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 4000);
}

// Debug function
window.testButtons = function () {
  const buttons = document.querySelectorAll("button");
  console.log(`Found ${buttons.length} buttons:`);
  buttons.forEach((btn, i) => {
    console.log(
      `${i}: ${btn.id || "no-id"} - "${btn.textContent.trim()}" - ${
        btn.disabled ? "disabled" : "enabled"
      }`
    );
  });
  return `Found ${buttons.length} buttons. Check console for details.`;
};

console.log("[Popup] 🎯 NULL VOID Extension script loaded successfully!");
