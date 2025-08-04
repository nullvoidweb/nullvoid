// NULL VOID Extension - Fixed Popup Script
// Clean, working version with proper event handling

// Use browser-specific API namespace
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

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

// AI Configuration
const AI_CONFIG = {
  apiKey: "AIzaSyCU4UMlmR_6Y3TxVrZrgqDdFdFxnYFWSX4",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta",
  model: "gemini-1.5-flash",
  maxTokens: 8000,
  temperature: 0.7,
};

// Initialize extension when DOM is ready
document.addEventListener("DOMContentLoaded", async () => {
  console.log("[Popup] 🚀 NULL VOID Extension Loading...");

  try {
    // Initialize all components
    initializeButtons();
    await loadSavedData();
    await initializeSmartIntegration();
    await initializeAuth();

    console.log("[Popup] ✅ Extension loaded successfully");
    showNotification("NULL VOID Extension Ready", "success");
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

  // Smart integration toggle
  const smartToggle = document.getElementById("smartIntegration");
  if (smartToggle) {
    smartToggle.addEventListener("change", handleSmartIntegrationToggle);
    console.log("[Popup] ✅ Smart integration toggle ready");
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
      region: region
    });

    if (response && response.success) {
      // Create new tab with RBI browser
      const rbiUrl = browserAPI.runtime.getURL(
        `rbi-browser.html?location=${region}&sessionId=${response.sessionId}`
      );

      console.log("[Browser] Opening RBI URL:", rbiUrl);

      await browserAPI.tabs.create({
        url: rbiUrl,
        active: true
      });

      showNotification("Secure browser launched!", "success");

      // Store session info
      await browserAPI.storage.local.set({
        activeRBISession: {
          sessionId: response.sessionId,
          region: region,
          startTime: Date.now()
        }
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
        active: true
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

  if (!emailInput || !emailInput.value || emailInput.value === "your@email.com") {
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

  try {
    if (btn) {
      btn.textContent = "Generating...";
      btn.disabled = true;
    }

    // Clear current email display
    if (emailInput) {
      emailInput.value = "Generating new email...";
    }

    showNotification("🔄 Generating new disposable email...", "info");

    // Clear old email data first
    currentDisposableEmailAddress = null;
    currentDisposableEmailId = null;
    currentEmailToken = null;

    // Generate new email with improved error handling
    const email = await generateDisposableEmail();

    // Update UI with new email
    if (emailInput) {
      emailInput.value = email;
    }

    showNotification("✅ New disposable email generated successfully!", "success");
    console.log("[Email] Successfully regenerated email:", email);

  } catch (error) {
    console.error("[Email] Regeneration failed:", error);
    
    // Restore previous email if available
    const storage = await browserAPI.storage.local.get(['disposableEmail']);
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
      errorMessage = "Email service temporarily unavailable. Please try again later.";
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

  if (!currentDisposableEmailAddress || !currentEmailToken) {
    showNotification("No active email. Generate one first.", "warning");
    return;
  }

  try {
    // Fetch messages
    const messages = await fetchEmailMessages();

    // Show modal
    const modal = document.getElementById("inboxModal");
    if (modal) {
      modal.style.display = "block";

      // Update email display
      const currentEmailDisplay = document.getElementById("currentEmailDisplay");
      if (currentEmailDisplay) {
        currentEmailDisplay.textContent = currentDisposableEmailAddress;
      }

      // Display messages
      displayEmailMessages(messages);
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
        content: dataUrl
      }
    });

    // Open file viewer
    const viewerUrl = browserAPI.runtime.getURL("file-viewer.html");
    await browserAPI.tabs.create({
      url: viewerUrl,
      active: true
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
    const response = await sendAIMessage(message);

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
    addChatMessage("Sorry, I encountered an error. Please try again.", false, true);
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

async function handleSmartIntegrationToggle() {
  const toggle = document.getElementById("smartIntegration");
  if (!toggle) return;

  const enabled = toggle.checked;
  console.log("[Smart] Integration toggled:", enabled);

  try {
    await browserAPI.runtime.sendMessage({
      action: "toggleSmartIntegration",
      enabled: enabled
    });

    showNotification(
      `Smart integration ${enabled ? "enabled" : "disabled"}`,
      "success"
    );

  } catch (error) {
    console.error("[Smart] Toggle failed:", error);
    showNotification("Failed to toggle smart integration", "error");
    toggle.checked = !enabled; // Revert
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
    body: !!body
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
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check if AuthService is available
    if (typeof AuthService !== 'undefined') {
      authService = new AuthService();
      await authService.initialize();
      
      isAuthenticated = authService.isUserAuthenticated();
      userProfile = authService.getUserProfile();
      
      console.log("[Auth] Auth state:", { isAuthenticated, userProfile });
      
      // Update UI
      updateAuthUI();
      
      // Listen for auth state changes
      document.addEventListener('authStateChanged', (event) => {
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
          'nullvoid_auth_token',
          'nullvoid_user_profile'
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
        <img src="${userProfile.avatar || "icons/icon48.png"}" alt="Profile" class="profile-image" />
        <span class="profile-name">${userProfile.name || userProfile.username || "User"}</span>
      </div>
    `;
    profileAvatar.classList.add("authenticated");
    profileAvatar.title = `Logged in as ${userProfile.name || userProfile.username || "User"}`;
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
    const loginDomain = authService ? authService.getCurrentDomain() : "https://nullvoid.zone.id";
    const loginUrl = `${loginDomain}/login?extension=true`;
    
    console.log("[Auth] Opening login URL:", loginUrl);
    
    // Open login page
    await browserAPI.tabs.create({
      url: loginUrl,
      active: true
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
            'nullvoid_auth_token',
            'nullvoid_user_profile'
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
  
  const baseDomain = authService ? authService.getCurrentDomain() : "https://nullvoid.zone.id";
  
  // Create dropdown menu
  const menuItems = [
    {
      text: userProfile.name || userProfile.username || "Profile",
      icon: "👤",
      action: () => {
        const profileUrl = `${baseDomain}/profile`;
        browserAPI.tabs.create({ url: profileUrl });
      }
    },
    {
      text: "View Profile",
      icon: "🔗",
      action: () => {
        const profileUrl = `${baseDomain}/profile`;
        browserAPI.tabs.create({ url: profileUrl });
      }
    }
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
      }
    });
  }
  
  menuItems.push(
    {
      text: "Account Settings",
      icon: "⚙️",
      action: () => {
        const settingsUrl = `${baseDomain}/settings`;
        browserAPI.tabs.create({ url: settingsUrl });
      }
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
              'nullvoid_auth_token',
              'nullvoid_user_profile',
              'nullvoid_current_domain',
              'nullvoid_last_login'
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
      }
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
  
  items.forEach(item => {
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
      menuItem.style.background = "linear-gradient(135deg, #e8f4ff 0%, #d1e9ff 100%)";
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
    const aiChatUrl = browserAPI.runtime.getURL(`ai-chat-full.html?v=2.0&t=${timestamp}`);
    console.log("[AI] AI Chat URL:", aiChatUrl);
    
    await browserAPI.tabs.create({
      url: aiChatUrl,
      active: true
    });
    
    showNotification("Gemini-style AI Chat opened", "success");
    console.log("[AI] ✅ Gemini-style AI Chat tab created successfully");
    
  } catch (error) {
    console.error("[AI] Failed to open full chat:", error);
    showNotification("Failed to open AI chat: " + error.message, "error");
  }
}

// OSINT search is now handled by background script

// Utility Functions
async function generateDisposableEmail() {
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Email] Generation attempt ${attempt}/${maxRetries}`);
      
      // Get available domains with timeout
      const domainsResponse = await fetchWithTimeout("https://api.mail.tm/domains", {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      }, 10000);
      
      if (!domainsResponse.ok) {
        throw new Error(`Failed to fetch domains: ${domainsResponse.status}`);
      }

      const domainsData = await domainsResponse.json();
      const availableDomains = domainsData["hydra:member"];
      
      if (!availableDomains || availableDomains.length === 0) {
        throw new Error("No domains available");
      }

      // Try different domains if available
      const domain = availableDomains[Math.floor(Math.random() * availableDomains.length)].domain;

      // Generate unique credentials with timestamp to avoid conflicts
      const timestamp = Date.now().toString(36);
      const randomStr = Math.random().toString(36).substring(2, 8);
      const username = `nullvoid${timestamp}${randomStr}`;
      const email = `${username}@${domain}`;
      const password = generateSecurePassword();

      console.log(`[Email] Attempting to create: ${email}`);

      // Create account with timeout
      const createResponse = await fetchWithTimeout("https://api.mail.tm/accounts", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "User-Agent": "NULL-VOID-Extension/1.0"
        },
        body: JSON.stringify({ 
          address: email, 
          password: password 
        })
      }, 15000);

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error(`[Email] Create account failed: ${createResponse.status} - ${errorText}`);
        
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
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get authentication token with timeout
      const authResponse = await fetchWithTimeout("https://api.mail.tm/token", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "User-Agent": "NULL-VOID-Extension/1.0"
        },
        body: JSON.stringify({ 
          address: email, 
          password: password 
        })
      }, 15000);

      if (!authResponse.ok) {
        const errorText = await authResponse.text();
        console.error(`[Email] Authentication failed: ${authResponse.status} - ${errorText}`);
        throw new Error(`Failed to authenticate: ${authResponse.status}`);
      }

      const authData = await authResponse.json();
      console.log(`[Email] Authentication successful`);

      // Store globally
      currentDisposableEmailAddress = email;
      currentDisposableEmailId = accountData.id;
      currentEmailToken = authData.token;

      // Save to storage
      await browserAPI.storage.local.set({
        disposableEmail: email,
        disposableEmailId: accountData.id,
        emailToken: authData.token,
        emailPassword: password,
        emailCreatedAt: Date.now()
      });

      console.log(`[Email] Successfully generated: ${email}`);
      return email;

    } catch (error) {
      console.error(`[Email] Attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        // Last attempt failed, throw the error
        throw new Error(`Failed to generate email after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Wait before retrying, with exponential backoff
      const delay = retryDelay * Math.pow(2, attempt - 1);
      console.log(`[Email] Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
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
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

function generateSecurePassword() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function fetchEmailMessages() {
  if (!currentEmailToken) throw new Error("No email token");

  try {
    const response = await fetchWithTimeout("https://api.mail.tm/messages", {
      headers: {
        "Authorization": `Bearer ${currentEmailToken}`,
        "Content-Type": "application/json",
        "User-Agent": "NULL-VOID-Extension/1.0"
      }
    }, 10000);

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, clear stored data
        console.log("[Email] Token expired, clearing stored data");
        currentDisposableEmailAddress = null;
        currentDisposableEmailId = null;
        currentEmailToken = null;
        
        await browserAPI.storage.local.remove([
          'disposableEmail',
          'disposableEmailId', 
          'emailToken',
          'emailPassword'
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
    if (error.message.includes('timeout')) {
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

  emailList.innerHTML = messages.map((msg, index) => {
    const fromName = msg.from?.name || msg.from?.address?.split('@')[0] || "Unknown";
    const fromEmail = msg.from?.address || "unknown@email.com";
    const subject = msg.subject || "No Subject";
    const preview = msg.intro || msg.text?.substring(0, 100) || "No preview available";
    const time = formatEmailTime(msg.createdAt);
    const hasAttachments = msg.attachments && msg.attachments.length > 0;
    
    return `
      <div class="email-item" data-email-id="${msg.id}" data-email-index="${index}" onclick="openEmailDetail(${index})">
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
            ${hasAttachments ? '<div class="attachment-icon">📎</div>' : ''}
          </div>
        </div>
        <div class="email-subject">${subject}</div>
        <div class="email-preview">${preview}${preview.length >= 100 ? '...' : ''}</div>
        <div class="email-actions">
          <span class="view-email">Tap to view</span>
        </div>
      </div>
    `;
  }).join("");

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
  if (!window.currentEmailMessages || !window.currentEmailMessages[emailIndex]) {
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
  const fromName = email.from?.name || email.from?.address?.split('@')[0] || "Unknown";
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
          <div class="sender-avatar-large">${fromName.charAt(0).toUpperCase()}</div>
          <div class="sender-details">
            <div class="sender-name-large">${fromName}</div>
            <div class="sender-email-small">${fromEmail}</div>
            <div class="email-date">${date}</div>
          </div>
        </div>
      </div>
      
      ${email.attachments && email.attachments.length > 0 ? `
        <div class="email-attachments">
          <div class="attachments-header">📎 Attachments (${email.attachments.length})</div>
          <div class="attachments-list">
            ${email.attachments.map(att => `
              <div class="attachment-item">
                <span class="attachment-name">${att.filename || 'Attachment'}</span>
                <span class="attachment-size">${formatFileSize(att.size || 0)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
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
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

async function sendAIMessage(message) {
  const requestBody = {
    contents: [{
      parts: [{ text: `You are a helpful AI assistant. Provide a detailed, comprehensive response to: ${message}` }]
    }],
    generationConfig: {
      temperature: AI_CONFIG.temperature,
      maxOutputTokens: AI_CONFIG.maxTokens
    }
  };

  const response = await fetch(
    `${AI_CONFIG.baseUrl}/models/${AI_CONFIG.model}:generateContent?key=${AI_CONFIG.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    }
  );

  if (!response.ok) throw new Error(`AI API Error: ${response.status}`);

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

function addChatMessage(message, isUser = false, isError = false) {
  const chatMessages = document.getElementById("chatMessages");
  if (!chatMessages) return;

  const messageDiv = document.createElement("div");
  messageDiv.className = `chat-message ${isUser ? "user-message" : "ai-message"}`;

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

async function loadSavedData() {
  try {
    const storage = await browserAPI.storage.local.get([
      "disposableEmail",
      "disposableEmailId",
      "emailToken",
      "chatHistory",
      "theme"
    ]);

    if (storage.disposableEmail) {
      currentDisposableEmailAddress = storage.disposableEmail;
      currentDisposableEmailId = storage.disposableEmailId;
      currentEmailToken = storage.emailToken;

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
          showNotification("✅ Disposable email generated automatically", "success");
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

async function initializeSmartIntegration() {
  try {
    const response = await browserAPI.runtime.sendMessage({
      action: "getSmartIntegrationStatus"
    });

    const toggle = document.getElementById("smartIntegration");
    if (toggle && response) {
      toggle.checked = response.enabled;
    }

  } catch (error) {
    console.warn("[Smart] Failed to initialize:", error);
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
    background: ${type === "success" ? "#22c55e" : type === "error" ? "#ef4444" : "#3b82f6"};
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
    console.log(`${i}: ${btn.id || 'no-id'} - "${btn.textContent.trim()}" - ${btn.disabled ? 'disabled' : 'enabled'}`);
  });
  return `Found ${buttons.length} buttons. Check console for details.`;
};

console.log("[Popup] 🎯 NULL VOID Extension script loaded successfully!");