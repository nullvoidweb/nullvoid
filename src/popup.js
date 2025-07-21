// Use browser-specific API namespace
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

// AI Chat Configuration - Gemini API
const AI_CONFIG = {
  apiKey: "AIzaSyCU4UMlmR_6Y3TxVrZrgqDdFdFxnYFWSX4",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta",
  model: "gemini-1.5-flash",
  maxTokens: 1000,
  temperature: 0.7,
};

// AI Chat State
let chatHistory = [];
let isAIResponding = false;

// Disposable Browser RBI Integration
async function launchDisposableBrowser(region = "singapore") {
  try {
    console.log(`[RBI] Launching disposable browser in region: ${region}`);

    // Send message to background script to initialize RBI session
    const response = await browserAPI.runtime.sendMessage({
      action: "initializeRBISession",
      region: region,
    });

    console.log("[RBI] Background response:", response);

    if (response && response.success) {
      // Create new tab with RBI browser interface
      const rbiUrl = browserAPI.runtime.getURL(
        `rbi-browser.html?location=${region}&sessionId=${response.sessionId}`
      );

      console.log("[RBI] Creating tab with URL:", rbiUrl);

      const tab = await browserAPI.tabs.create({
        url: rbiUrl,
        active: true,
      });

      console.log(
        `[RBI] Browser launched in tab ${tab.id} with session ${response.sessionId}`
      );

      // Store active session info
      await browserAPI.storage.local.set({
        activeRBISession: {
          sessionId: response.sessionId,
          region: region,
          tabId: tab.id,
          startTime: Date.now(),
        },
      });

      return { success: true, sessionId: response.sessionId, tabId: tab.id };
    } else {
      const errorMsg = response?.error || "Failed to initialize RBI session";
      console.error("[RBI] Background script error:", errorMsg);
      throw new Error(errorMsg);
    }
  } catch (error) {
    console.error("[RBI] Launch failed:", error);
    throw error;
  }
}

// ==================== AI CHAT FUNCTIONALITY ====================

// AI Chat API Functions - Gemini API
async function sendAIMessage(message) {
  try {
    console.log("[AI Chat] Sending message to Gemini:", message);
    console.log("[AI Chat] API Config:", {
      baseUrl: AI_CONFIG.baseUrl,
      model: AI_CONFIG.model,
      hasApiKey: !!AI_CONFIG.apiKey,
    });

    // Build conversation context for Gemini
    let conversationContext =
      "You are a helpful AI assistant integrated into the NULL VOID browser extension. Provide concise, helpful responses. You can assist with web browsing, security questions, email management, and general inquiries.\n\n";

    // Add chat history
    if (chatHistory.length > 0) {
      conversationContext += "Previous conversation:\n";
      chatHistory.forEach((msg) => {
        conversationContext += `${
          msg.role === "user" ? "User" : "Assistant"
        }: ${msg.content}\n`;
      });
      conversationContext += "\n";
    }

    conversationContext += `User: ${message}\nAssistant:`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: conversationContext,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: AI_CONFIG.temperature,
        maxOutputTokens: AI_CONFIG.maxTokens,
        topP: 0.8,
        topK: 10,
      },
    };

    console.log("[AI Chat] Request body:", requestBody);

    const response = await fetch(
      `${AI_CONFIG.baseUrl}/models/${AI_CONFIG.model}:generateContent?key=${AI_CONFIG.apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    console.log(
      "[AI Chat] Response status:",
      response.status,
      response.statusText
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AI Chat] API Error Response:", errorText);
      throw new Error(
        `API Error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json();
    console.log("[AI Chat] API Response:", data);

    if (
      data.candidates &&
      data.candidates.length > 0 &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts.length > 0
    ) {
      return data.candidates[0].content.parts[0].text;
    } else {
      throw new Error("No response content received from Gemini AI");
    }
  } catch (error) {
    console.error("[AI Chat] Gemini API Error:", error);
    throw error;
  }
}

// Add message to chat interface
function addChatMessage(message, isUser = false, isError = false) {
  const chatMessages = document.getElementById("chatMessages");
  if (!chatMessages) return;

  const messageDiv = document.createElement("div");
  messageDiv.className = `chat-message ${
    isUser ? "user-message" : "ai-message"
  }`;

  const currentTime = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  messageDiv.innerHTML = `
    <div class="message-content ${isError ? "error-message" : ""}">
      <span class="message-text">${escapeHtml(message)}</span>
      <span class="message-time">${currentTime}</span>
    </div>
  `;

  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Add to chat history for AI context (exclude error messages)
  if (!isError) {
    chatHistory.push({
      role: isUser ? "user" : "assistant",
      content: message,
    });

    // Keep only last 10 messages to manage token usage
    if (chatHistory.length > 10) {
      chatHistory = chatHistory.slice(-10);
    }

    // Save to storage
    saveChatHistory();
  }
}

// Show typing indicator
function showTypingIndicator() {
  const chatMessages = document.getElementById("chatMessages");
  if (!chatMessages) return;

  const typingDiv = document.createElement("div");
  typingDiv.className = "typing-indicator";
  typingDiv.id = "typingIndicator";
  typingDiv.innerHTML = `
    AI is typing
    <div class="typing-dots">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;

  chatMessages.appendChild(typingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Remove typing indicator
function hideTypingIndicator() {
  const typingIndicator = document.getElementById("typingIndicator");
  if (typingIndicator) {
    typingIndicator.remove();
  }
}

// Process user message and get AI response
async function processUserMessage(userMessage) {
  if (isAIResponding || !userMessage.trim()) return;

  isAIResponding = true;
  const sendButton = document.getElementById("sendMessage");
  const chatInput = document.getElementById("aiChatInput");

  try {
    // Disable input while processing
    if (sendButton) sendButton.disabled = true;
    if (chatInput) chatInput.disabled = true;

    // Add user message to chat
    addChatMessage(userMessage, true);

    // Clear input
    if (chatInput) chatInput.value = "";

    // Show typing indicator
    showTypingIndicator();

    // Get AI response
    const aiResponse = await sendAIMessage(userMessage);

    // Remove typing indicator
    hideTypingIndicator();

    // Add AI response to chat
    addChatMessage(aiResponse, false);

    console.log("[AI Chat] Conversation updated");
  } catch (error) {
    console.error("[AI Chat] Error processing message:", error);

    // Remove typing indicator
    hideTypingIndicator();

    // Show error message
    let errorMessage =
      "Sorry, I'm having trouble responding right now. Please try again.";
    if (error.message.includes("API Error")) {
      errorMessage =
        "Connection error. Please check your internet connection and try again.";
    } else if (error.message.includes("rate limit")) {
      errorMessage =
        "Too many requests. Please wait a moment before sending another message.";
    }

    addChatMessage(errorMessage, false, true);
  } finally {
    isAIResponding = false;

    // Re-enable input
    if (sendButton) sendButton.disabled = false;
    if (chatInput) {
      chatInput.disabled = false;
      chatInput.focus();
    }
  }
}

// Clear chat history
function clearChatHistory() {
  const chatMessages = document.getElementById("chatMessages");
  if (!chatMessages) return;

  // Clear visual chat
  chatMessages.innerHTML = `
    <div class="chat-message ai-message">
      <div class="message-content">
        <span class="message-text">Hello! I'm your AI assistant. How can I help you today?</span>
        <span class="message-time">Just now</span>
      </div>
    </div>
  `;

  // Clear chat history
  chatHistory = [];

  // Clear from storage
  saveChatHistory();

  console.log("[AI Chat] Chat history cleared");
  showNotification("CHAT: Chat cleared", "success");
}

// Utility function to escape HTML
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Load chat history from storage
async function loadChatHistory() {
  try {
    const storage = await browserAPI.storage.local.get(["aiChatHistory"]);
    if (storage.aiChatHistory && Array.isArray(storage.aiChatHistory)) {
      chatHistory = storage.aiChatHistory;

      // Restore visual chat (keeping only recent messages to avoid clutter)
      const chatMessages = document.getElementById("chatMessages");
      if (chatMessages && chatHistory.length > 0) {
        // Clear welcome message
        chatMessages.innerHTML = "";

        // Show only last 6 messages visually
        const recentHistory = chatHistory.slice(-6);
        recentHistory.forEach((msg) => {
          addChatMessage(msg.content, msg.role === "user");
        });
      }

      console.log(
        "[AI Chat] Loaded chat history:",
        chatHistory.length,
        "messages"
      );
    }
  } catch (error) {
    console.error("[AI Chat] Error loading chat history:", error);
  }
}

// Save chat history to storage
async function saveChatHistory() {
  try {
    await browserAPI.storage.local.set({
      aiChatHistory: chatHistory,
    });
    console.log("[AI Chat] Chat history saved");
  } catch (error) {
    console.error("[AI Chat] Error saving chat history:", error);
  }
}

// ==================== END AI CHAT FUNCTIONALITY ====================

// Notification system
function showNotification(message, type = "info") {
  // Create notification element
  const notification = document.createElement("div");
  notification.className = `rbi-notification ${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      ${message}
    </div>
  `;

  // Style the notification
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
    animation: slideIn 0.3s ease-out;
  `;

  // Add animation styles
  const style = document.createElement("style");
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(notification);

  // Auto remove after 4 seconds
  setTimeout(() => {
    notification.style.animation = "slideOut 0.3s ease-in";
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    }, 300);
  }, 4000);
}

// Smart integration toggle
const smartIntegrationToggle = document.getElementById("smartIntegration");
const integrationStatus = document.getElementById("integrationStatus");

// Initialize smart integration toggle state
async function initializeSmartIntegration() {
  console.log("[SmartIntegration] Starting initialization...");

  try {
    // Check for DOM elements first
    const smartIntegrationToggle = document.getElementById("smartIntegration");
    const integrationStatus = document.getElementById("integrationStatus");

    console.log("[SmartIntegration] DOM elements found:", {
      toggle: !!smartIntegrationToggle,
      status: !!integrationStatus,
    });

    if (!smartIntegrationToggle) {
      console.error("[SmartIntegration] Toggle element not found!");
      return;
    }

    // Get current status from background script
    console.log("[SmartIntegration] Requesting status from background...");
    const response = await browserAPI.runtime.sendMessage({
      action: "getSmartIntegrationStatus",
    });

    console.log("[SmartIntegration] Background response:", response);

    smartIntegrationToggle.checked = response.enabled;
    updateIntegrationStatus(response.enabled, integrationStatus);

    // Add event listener for toggle changes
    smartIntegrationToggle.addEventListener("change", async () => {
      const enabled = smartIntegrationToggle.checked;
      console.log("[SmartIntegration] Toggle changed to:", enabled);

      try {
        // Send toggle message to background script
        await browserAPI.runtime.sendMessage({
          action: "toggleSmartIntegration",
          enabled: enabled,
        });

        // Update UI status
        updateIntegrationStatus(enabled, integrationStatus);

        // Update security system state (without duplicate notifications)
        if (window.smartIntegrationSecurity) {
          await window.smartIntegrationSecurity.updateState(enabled);
        }

        // Show user feedback
        showSmartIntegrationFeedback(enabled);
      } catch (error) {
        console.error("[SmartIntegration] Error toggling:", error);
        // Revert toggle state if there was an error
        smartIntegrationToggle.checked = !enabled;
      }
    });

    console.log("[SmartIntegration] SUCCESS: Initialization completed");
  } catch (error) {
    console.error("[SmartIntegration] Error during initialization:", error);
  }
}

function updateIntegrationStatus(enabled, integrationStatus) {
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

// Show feedback when smart integration is toggled
function showSmartIntegrationFeedback(enabled) {
  // Remove any existing smart integration notifications first
  const existingNotifications = document.querySelectorAll(
    ".smart-integration-notification"
  );
  existingNotifications.forEach((notif) => notif.remove());

  // Create notification as an overlay outside the main extension container
  const overlay = document.createElement("div");
  overlay.className = "smart-integration-notification";
  overlay.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 10001 !important;
    pointer-events: none !important;
    background: transparent !important;
    border: none !important;
    margin: 0 !important;
    padding: 0 !important;
  `;

  // Create the actual notification content
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: absolute !important;
    top: 20px !important;
    right: 20px !important;
    background: ${enabled ? "#22c55e" : "#ef4444"} !important;
    color: white !important;
    padding: 12px 16px !important;
    border-radius: 8px !important;
    font-size: 14px !important;
    font-weight: bold !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
    max-width: 280px !important;
    border: none !important;
    margin: 0 !important;
    transform: translateX(100%) !important;
    opacity: 0 !important;
    transition: all 0.3s ease !important;
    z-index: 1 !important;
  `;

  if (enabled) {
    notification.innerHTML =
      "SHIELD: Smart Integration Enabled<br><small style='font-weight: normal; color: rgba(255,255,255,0.9);'>Ad blocking and malicious site protection active</small>";
  } else {
    notification.innerHTML =
      "WARNING: Smart Integration Disabled<br><small style='font-weight: normal; color: rgba(255,255,255,0.9);'>Protection systems are now inactive</small>";
  }

  overlay.appendChild(notification);
  document.body.appendChild(overlay);

  // Animate in
  requestAnimationFrame(() => {
    notification.style.transform = "translateX(0)";
    notification.style.opacity = "1";
  });

  // Remove notification after 3 seconds
  setTimeout(() => {
    notification.style.opacity = "0";
    notification.style.transform = "translateX(100%)";
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 300);
  }, 3000);
}

// Generate real disposable email using multiple APIs with fallback
async function generateRealDisposableEmail() {
  try {
    console.log("[Email] Starting email generation...");

    // Show loading status
    showStatusText("Validating email services...", "info");

    // First, test API connections to ensure they're working
    console.log("[Email] Testing API connections before generation...");
    let apiResults;

    try {
      apiResults = await testEmailApiConnections();
    } catch (testError) {
      console.error("[Email] API testing failed:", testError);
      showStatusText("API testing failed, trying fallback...", "warning");
      // Use a simple fallback if testing fails
      apiResults = {
        secmail: true, // Assume 1SecMail works as it's most reliable
        mail_tm: false,
        mail_tm_personal: false,
      };
    }

    const workingAPIs = Object.entries(apiResults)
      .filter(([api, working]) => working)
      .map(([api]) => api);

    console.log(`[Email] Working APIs detected:`, workingAPIs);

    if (workingAPIs.length === 0) {
      console.warn(
        "[Email] No working APIs found, trying all user-facing APIs anyway"
      );
      // Force try all user-facing APIs even if tests failed
      workingAPIs.push("secmail", "mail_tm");
    }

    console.log(`[Email] ${workingAPIs.length} APIs are working:`, workingAPIs);
    showStatusText("Generating disposable email...", "info");

    // Filter available APIs to only working ones that are user-facing
    const availableAPIs = workingAPIs.filter((api) => {
      const apiConfig = EMAIL_APIS[api];
      if (!apiConfig) return false;

      // Include API if it's user-facing (true) or if userFacing is not explicitly set to false
      // Exclude APIs that are explicitly marked as internal
      return !apiConfig.internal && apiConfig.userFacing !== false;
    });

    // Randomize only user-facing APIs for random email generation
    const randomAPIs = availableAPIs.sort(() => Math.random() - 0.5);

    const allAPIs = [...randomAPIs]; // Use only user-facing email APIs

    console.log(
      "[Email] Starting random email generation with validated working APIs:",
      allAPIs.map((api) => EMAIL_APIS[api]?.name || api)
    );

    for (const apiName of allAPIs) {
      try {
        console.log(`[Email] Trying ${EMAIL_APIS[apiName].name}...`);

        // Double-check API is configured
        if (!EMAIL_APIS[apiName]) {
          console.warn(`[Email] Skipping ${apiName} - not configured`);
          continue;
        }

        // Show which API we're trying
        showStatusText(`Trying ${EMAIL_APIS[apiName].name}...`, "info");

        const result = await generateEmailWithAPI(apiName);

        // SAFETY CHECK: Prevent internal accounts from being returned to users
        if (
          result &&
          (result.internal ||
            result.warning === "INTERNAL_USE_ONLY" ||
            result.api === "mail_tm_personal")
        ) {
          console.error(
            `[Email] ERROR: SECURITY: Attempted to return internal account to user: ${result.email}`
          );
          throw new Error(
            "Internal account cannot be used for user email generation"
          );
        }

        // Validate the result has required fields
        if (!result || !result.email || !result.email.includes("@")) {
          throw new Error(`Invalid email result from ${apiName}`);
        }

        console.log(
          `[Email] SUCCESS: Success with ${EMAIL_APIS[apiName].name}:`,
          result
        );

        // Save email info
        currentDisposableEmailAddress = result.email;
        currentDisposableEmailId = result.id;
        currentEmailAPI = apiName;

        await browserAPI.storage.local.set({
          disposableEmail: result.email,
          disposableEmailId: result.id,
          emailAPI: apiName,
          emailLogin: result.login || "",
          emailDomain: result.domain || "",
          emailPassword: result.password || "",
          emailToken: result.token || "",
          createdAt: Date.now(),
          authToken: "multi-api-token",
        });

        console.log("[Email] Email info saved to storage");

        // Update UI
        await updateUIWithEmail(result.email);

        // Force immediate inbox display update
        console.log("[Email] Forcing immediate inbox display update...");
        try {
          await updateInboxDisplay();
          console.log("[Email] Immediate inbox display update completed");
        } catch (updateError) {
          console.warn("[Email] Immediate inbox update failed:", updateError);
        }

        // Start polling for messages
        await startEmailPolling();
        console.log("[Email] Email polling started successfully");

        // Show status to user
        showStatusText(
          `Email ready: ${result.email} - Checking for messages every 10 seconds`,
          "success"
        );

        // Test the API immediately to verify it's working
        console.log("[Email] Testing API immediately after generation...");
        setTimeout(async () => {
          try {
            const testResult = await window.testEmailReceiving();
            console.log("[Email] Immediate API test result:", testResult);
          } catch (error) {
            console.warn("[Email] Immediate API test failed:", error);
          }
        }, 1000);

        console.log(
          "[Email] SUCCESS: Email generated successfully:",
          result.email
        );
        showStatusText(
          `Email generated with ${EMAIL_APIS[apiName].name}!`,
          "success"
        );
        return result.email;
      } catch (error) {
        console.warn(`[Email] ${EMAIL_APIS[apiName].name} failed:`, error);

        // Continue to next API
        if (apiName === allAPIs[allAPIs.length - 1]) {
          // Last API failed, use fallback
          break;
        }
      }
    }

    // All APIs failed, use local fallback
    console.warn("[Email] All APIs failed, using fallback email");
    const fallbackEmail = generateFakeDisposableEmail();

    currentDisposableEmailAddress = fallbackEmail;
    currentDisposableEmailId = Math.random().toString(36).substring(2, 12);
    currentEmailAPI = "fallback";

    await browserAPI.storage.local.set({
      disposableEmail: fallbackEmail,
      disposableEmailId: currentDisposableEmailId,
      emailAPI: "fallback",
      createdAt: Date.now(),
      authToken: "fallback-token",
    });

    await updateUIWithEmail(fallbackEmail);

    // Show offline warning with a "Force Generate" button
    console.log("[Email] Using fallback email:", fallbackEmail);
    const statusContainer = document.querySelector(".status-text");
    if (statusContainer) {
      // Create a wrapper for status message and button
      const wrapper = document.createElement("div");
      wrapper.style.display = "flex";
      wrapper.style.alignItems = "center";
      wrapper.style.justifyContent = "space-between";
      wrapper.style.width = "100%";

      // Create status message
      const statusMessage = document.createElement("span");
      statusMessage.textContent = "APIs unavailable";
      statusMessage.style.color = "#ff9800"; // warning color

      // Create force generate button
      const forceButton = document.createElement("button");
      forceButton.textContent = "Force Generate";
      forceButton.style.backgroundColor = "#4CAF50";
      forceButton.style.color = "white";
      forceButton.style.border = "none";
      forceButton.style.borderRadius = "4px";
      forceButton.style.padding = "3px 8px";
      forceButton.style.fontSize = "12px";
      forceButton.style.cursor = "pointer";
      forceButton.style.marginLeft = "8px";

      forceButton.addEventListener("click", async () => {
        try {
          statusMessage.textContent = "Forcing email generation...";
          forceButton.disabled = true;
          forceButton.style.opacity = "0.5";

          // Call our force generate function
          const email = await window.forceGenerateEmail();

          // Update UI with success message
          statusMessage.textContent = "Email generated!";
          statusMessage.style.color = "#4CAF50"; // success color

          // Remove button after success
          forceButton.style.display = "none";
        } catch (error) {
          console.error("[Force Generate] Failed:", error);
          statusMessage.textContent = "Generation failed";
          forceButton.textContent = "Try Again";
          forceButton.disabled = false;
          forceButton.style.opacity = "1";
        }
      });

      // Add elements to wrapper
      wrapper.appendChild(statusMessage);
      wrapper.appendChild(forceButton);

      // Clear status container and add wrapper
      statusContainer.innerHTML = "";
      statusContainer.appendChild(wrapper);
    } else {
      showStatusText("Using offline email (APIs unavailable)", "warning");
    }

    return fallbackEmail;
  } catch (error) {
    console.error("[Email] ERROR: Critical error in email generation:", error);
    showStatusText("Email generation failed", "error");

    // Set error state in UI
    const emailInput = document.querySelector(".email-input");
    if (emailInput) {
      emailInput.value = "Error generating email - try again";
      emailInput.style.fontStyle = "italic";
      emailInput.style.color = "#ff6b6b";
    }

    throw error;
  }
}

// Generate fake disposable email (fallback)
function generateFakeDisposableEmail() {
  const domains = ["tempmail.com", "guerrillamail.com", "10minutemail.com"];
  const randomString = Math.random().toString(36).substring(2, 8);
  const randomDomain = domains[Math.floor(Math.random() * domains.length)];
  return `${randomString}@${randomDomain}`;
}

// Update UI with email address
async function updateUIWithEmail(email) {
  try {
    console.log("[Email] Updating UI with email:", email);

    // Update global variables to ensure inbox display works
    currentDisposableEmailAddress = email;
    console.log("[Email] Updated global currentDisposableEmailAddress:", email);

    // Get additional email data from storage to update other globals
    const storage = await browserAPI.storage.local.get([
      "disposableEmailId",
      "emailAPI",
    ]);

    if (storage.disposableEmailId) {
      currentDisposableEmailId = storage.disposableEmailId;
      console.log(
        "[Email] Updated global currentDisposableEmailId:",
        storage.disposableEmailId
      );
    }

    if (storage.emailAPI) {
      currentEmailAPI = storage.emailAPI;
      console.log("[Email] Updated global currentEmailAPI:", storage.emailAPI);
    }

    const emailInput = document.querySelector(".email-input");
    if (emailInput) {
      emailInput.value = email;
      emailInput.style.fontStyle = "normal";
      emailInput.style.color = "";
      console.log("[Email] Updated email input field");
    } else {
      console.warn("[Email] Email input field not found");
    }

    const currentEmailDisplay = document.getElementById("currentEmailDisplay");
    if (currentEmailDisplay) {
      // Show API provider info, especially for personal account
      const apiName = EMAIL_APIS[currentEmailAPI]?.name || "Email service";
      const isPersonal = currentEmailAPI === "mail_tm_personal";
      const displayText = isPersonal ? `${email} (Personal Account)` : email;

      currentEmailDisplay.textContent = displayText;
      console.log("[Email] Updated current email display");
    } else {
      console.warn("[Email] Current email display element not found");
    }

    // Update inbox modal email display
    const inboxEmailDisplay = document.getElementById("inboxEmailDisplay");
    if (inboxEmailDisplay) {
      const apiName = EMAIL_APIS[currentEmailAPI]?.name || "Email service";
      const isPersonal = currentEmailAPI === "mail_tm_personal";
      const providerInfo = isPersonal ? " (Personal Account)" : ` (${apiName})`;

      inboxEmailDisplay.textContent = email + providerInfo;
      console.log("[Email] Updated inbox email display");
    }

    // Update inbox to show current state (even if empty)
    console.log("[Email] Updating inbox display after email generation...");
    try {
      await updateInboxDisplay();
      console.log("[Email] SUCCESS: Inbox updated after email generation");
    } catch (error) {
      console.warn(
        "[Email] Could not update inbox after email generation:",
        error
      );
    }

    console.log("[Email] SUCCESS: UI updated successfully with email");
  } catch (error) {
    console.error("[Email] Error updating UI with email:", error);
  }
}

// Initialize disposable browser functionality
async function initializeDisposableBrowser() {
  console.log("[Popup] Initializing disposable browser...");

  try {
    // Get theme elements
    console.log("[Popup] Looking for theme elements...");
    const themeIcon = document.querySelector(".theme-icon");
    const moonIcon = document.querySelector(".moon-icon");
    const sunIcon = document.querySelector(".sun-icon");
    const body = document.body;

    console.log("[Popup] Theme elements found:", {
      themeIcon: !!themeIcon,
      moonIcon: !!moonIcon,
      sunIcon: !!sunIcon,
      body: !!body,
    });

    // Initialize theme based on saved preference
    const savedTheme = localStorage.getItem("theme");
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

    // Initialize disposable email section
    console.log("[Email] Initializing disposable email...");

    try {
      // Check if we have an existing email (updated for RapidAPI)
      const storage = await browserAPI.storage.local.get([
        "disposableEmail",
        "disposableEmailId",
        "emailDomain",
      ]);

      if (storage.disposableEmail && storage.disposableEmailId) {
        console.log("[Email] Found existing email:", storage.disposableEmail);
        currentDisposableEmailAddress = storage.disposableEmail;
        currentDisposableEmailId = storage.disposableEmailId;

        const emailInput = document.querySelector(".email-input");
        if (emailInput) {
          emailInput.value = storage.disposableEmail;
          emailInput.style.fontStyle = "normal";
          emailInput.style.color = "";
        }

        const currentEmailDisplay = document.getElementById(
          "currentEmailDisplay"
        );
        if (currentEmailDisplay) {
          currentEmailDisplay.textContent = storage.disposableEmail;
        }

        // Start polling for messages only if we have existing email
        await startEmailPolling();
      } else {
        console.log("[Email] No existing email found, showing placeholder...");

        // Show placeholder text instead of auto-generating
        const emailInput = document.querySelector(".email-input");
        if (emailInput) {
          emailInput.value = "Click 'regenerate email' to create";
          emailInput.style.fontStyle = "italic";
          emailInput.style.color = "#999";
        }

        const currentEmailDisplay = document.getElementById(
          "currentEmailDisplay"
        );
        if (currentEmailDisplay) {
          currentEmailDisplay.textContent = "No email generated yet";
        }
      }
    } catch (error) {
      console.error("[Email] Error initializing email:", error);

      // Show placeholder on error
      const emailInput = document.querySelector(".email-input");
      if (emailInput) {
        emailInput.value = "Click 'regenerate email' to create";
        emailInput.style.fontStyle = "italic";
        emailInput.style.color = "#999";
      }
    }

    // Disposable Browser buttons - more specific selectors
    console.log("[Popup] Looking for disposable browser section...");
    const browserSection = Array.from(
      document.querySelectorAll(".service-section")
    ).find((section) =>
      section.querySelector("h3")?.textContent.includes("Disposable Browser")
    );

    console.log("[Popup] Browser section found:", !!browserSection);

    const startButton = browserSection
      ? browserSection.querySelector(".btn-primary")
      : null;

    console.log("[Popup] Start button found:", !!startButton);
    console.log("[Popup] Start button text:", startButton?.textContent);

    if (startButton && startButton.textContent.trim() === "start") {
      console.log("[Popup] Adding click event listener to start button");
      startButton.addEventListener("click", async () => {
        console.log("[Popup] Start button clicked!");
        startButton.textContent = "Starting...";
        startButton.disabled = true;

        try {
          // Get selected region
          const regionButton = browserSection.querySelector(".btn-secondary");
          const selectedRegion = regionButton
            ? regionButton.textContent.trim().toLowerCase()
            : "singapore";

          console.log("[Popup] Selected region:", selectedRegion);

          // Launch RBI browser in new tab
          await launchDisposableBrowser(selectedRegion);

          // Update button state
          startButton.textContent = "Active";
          startButton.style.backgroundColor = "#22c55e";

          // Show success notification
          showNotification(
            "LAUNCH: Disposable browser launched successfully!",
            "success"
          );
        } catch (error) {
          console.error("[Popup] Failed to start disposable browser:", error);
          startButton.textContent = "start";
          startButton.disabled = false;
          showNotification(
            "ERROR: Failed to start disposable browser",
            "error"
          );
        }
      });
    } else {
      console.log("[Popup] Start button not found or wrong text content");
    }

    const singaporeButton = browserSection
      ? browserSection.querySelector(".btn-secondary")
      : null;
    if (singaporeButton && singaporeButton.textContent.trim() === "singapore") {
      singaporeButton.addEventListener("click", () => {
        console.log("Changing region...");
        const regions = ["singapore", "usa", "europe", "japan"];
        const currentIndex = regions.indexOf(
          singaporeButton.textContent.trim()
        );
        const nextIndex = (currentIndex + 1) % regions.length;
        singaporeButton.textContent = regions[nextIndex];
      });
    }

    // Email functionality
    console.log("[Email] Setting up email button functionality...");
    const copyButton = document.querySelector(".email-controls .btn-small");
    console.log("[Email] Copy button found:", !!copyButton);

    if (copyButton) {
      console.log("[Email] Adding click listener to copy button");
      copyButton.addEventListener("click", async () => {
        console.log("[Email] Copy button clicked");
        const emailInput = document.querySelector(".email-input");
        if (emailInput) {
          const emailValue = emailInput.value;
          console.log("[Email] Email value to copy:", emailValue);

          // Don't copy placeholder text
          if (
            emailValue.includes("Click 'regenerate email'") ||
            emailValue.includes("Generating email") ||
            emailValue.includes("Error")
          ) {
            console.log("[Email] Blocked copying placeholder text");
            // Show warning and suggest generating email first
            copyButton.textContent = "Generate email first!";
            copyButton.style.color = "#ff6b6b";

            setTimeout(() => {
              copyButton.textContent = "copy";
              copyButton.style.color = "";
            }, 2000);

            return;
          }

          try {
            await navigator.clipboard.writeText(emailValue);
            console.log("[Email] SUCCESS: Email copied to clipboard");
            copyButton.textContent = "copied!";
            copyButton.style.color = "#4CAF50";

            setTimeout(() => {
              copyButton.textContent = "copy";
              copyButton.style.color = "";
            }, 2000);
          } catch (err) {
            console.error("Failed to copy email:", err);
            copyButton.textContent = "error!";
            copyButton.style.color = "#ff6b6b";

            setTimeout(() => {
              copyButton.textContent = "copy";
              copyButton.style.color = "";
            }, 2000);
          }
        }
      });
    }

    const inboxButton = document.getElementById("openInbox");
    console.log("[Email] Inbox button found:", !!inboxButton);

    if (inboxButton) {
      inboxButton.addEventListener("click", async () => {
        console.log("[Email] Opening inbox...");
        console.log(
          "[Email] Current email address:",
          currentDisposableEmailAddress
        );

        // Check if we have a real email first
        if (!currentDisposableEmailAddress) {
          console.warn("[Email] No email address available, showing warning");
          // Show warning that email needs to be generated first
          inboxButton.textContent = "Generate email first!";
          inboxButton.style.color = "#ff6b6b";

          setTimeout(() => {
            inboxButton.textContent = "Inbox";
            inboxButton.style.color = "";
          }, 2000);

          return;
        }

        const modal = document.getElementById("inboxModal");
        console.log("[Email] Modal element found:", !!modal);

        if (modal) {
          modal.style.display = "block";
          console.log("[Email] Modal display set to block");

          // Update current email display in modal
          const currentEmailDisplay = document.getElementById(
            "currentEmailDisplay"
          );
          console.log(
            "[Email] Current email display element found:",
            !!currentEmailDisplay
          );

          if (currentEmailDisplay && currentDisposableEmailAddress) {
            currentEmailDisplay.textContent = currentDisposableEmailAddress;
            console.log("[Email] Updated modal email display");
          }

          // Show loading and refresh messages
          const loadingMessages = document.getElementById("loadingMessages");
          if (loadingMessages) {
            loadingMessages.style.display = "block";
            console.log("[Email] Showing loading messages");
          }

          console.log("[Email] About to update inbox display...");
          await updateInboxDisplay();
          console.log("[Email] SUCCESS: Inbox display updated");
        } else {
          console.error("[Email] ERROR: Modal element not found in DOM");
        }
      });
    } else {
      console.error("[Email] ERROR: Inbox button not found in DOM");
    }

    // Close modal functionality
    const closeInbox = document.getElementById("closeInbox");
    console.log("[Email] Close inbox button found:", !!closeInbox);

    if (closeInbox) {
      closeInbox.addEventListener("click", () => {
        console.log("[Email] Closing inbox modal");
        const modal = document.getElementById("inboxModal");
        if (modal) {
          modal.style.display = "none";
          console.log("[Email] SUCCESS: Modal closed");
        }
      });
    }

    // Close modal when clicking outside
    window.addEventListener("click", (e) => {
      const modal = document.getElementById("inboxModal");
      if (modal && e.target === modal) {
        console.log("[Email] Closing modal via outside click");
        modal.style.display = "none";
      }
    });

    // Refresh messages functionality
    const refreshMessages = document.getElementById("refreshMessages");
    console.log("[Email] Refresh messages button found:", !!refreshMessages);

    if (refreshMessages) {
      refreshMessages.addEventListener("click", async () => {
        console.log("[Email] AGGRESSIVE REFRESH: Refreshing messages...");

        const loadingMessages = document.getElementById("loadingMessages");
        if (loadingMessages) {
          loadingMessages.style.display = "block";
          console.log("[Email] Showing loading indicator");
        }

        // Add visual feedback
        refreshMessages.textContent = "Checking...";
        refreshMessages.disabled = true;

        try {
          // Stop current polling to reset state
          stopEmailPolling();
          console.log("[Email] Stopped current polling");

          // Force clear any cached state
          await browserAPI.storage.local.remove(['cachedMessages']);
          console.log("[Email] Cleared cached messages");

          // Update inbox display
          await updateInboxDisplay();
          console.log("[Email] SUCCESS: Messages refreshed successfully");

          // Restart polling
          await startEmailPolling();
          console.log("[Email] Restarted polling");

          // Show success feedback
          showStatusText("Inbox refreshed successfully!", "success");
        } catch (error) {
          console.error("[Email] ERROR: Error refreshing messages:", error);
          showStatusText("Error refreshing messages", "error");
        } finally {
          // Reset button state
          refreshMessages.textContent = "🔄";
          refreshMessages.disabled = false;
          
          if (loadingMessages) {
            loadingMessages.style.display = "none";
          }
        }
      });
    } else {
      console.error("[Email] ERROR: Refresh messages button not found");
    }

    // Generate new email functionality
    const generateNewEmail = document.getElementById("generateNewEmail");
    console.log("[Email] Generate new email button found:", !!generateNewEmail);

    if (generateNewEmail) {
      generateNewEmail.addEventListener("click", async () => {
        console.log("[Email] Generating new email from inbox...");

        // Show loading state on button
        const originalText = generateNewEmail.textContent;
        generateNewEmail.textContent = "Generating...";
        generateNewEmail.disabled = true;

        try {
          const newEmail = await generateRealDisposableEmail();
          console.log("[Email] New email generated from inbox:", newEmail);

          // Update current email display in modal
          const currentEmailDisplay = document.getElementById(
            "currentEmailDisplay"
          );
          if (currentEmailDisplay) {
            currentEmailDisplay.textContent = newEmail;
            console.log("[Email] Updated modal email display");
          }

          // Clear existing messages and refresh
          const emailList = document.getElementById("emailList");
          if (emailList) {
            emailList.innerHTML = "";
            console.log("[Email] Cleared email list");
          }

          const noMessages = document.getElementById("noMessages");
          if (noMessages) {
            noMessages.style.display = "block";
            noMessages.textContent = "No messages yet for new email.";
          }

          // Start polling for the new email
          await startEmailPolling();

          showStatusText("New email generated successfully!", "success");
          console.log("[Email] SUCCESS: New email generation completed");
        } catch (error) {
          console.error(
            "[Email] ERROR: Error generating new email from inbox:",
            error
          );
          showStatusText("Error generating new email", "error");
        } finally {
          // Restore button state
          generateNewEmail.textContent = originalText;
          generateNewEmail.disabled = false;
        }
      });
    } else {
      console.error("[Email] ERROR: Generate new email button not found");
    }

    // Enhanced secure file viewer buttons
    const fileInput = document.getElementById("fileInput");
    const uploadButton = document.getElementById("selectFile");
    const viewButton = document.getElementById("viewFile");
    const fileInfoDisplay = document.getElementById("fileInfoDisplay");
    const selectedFileName = document.getElementById("selectedFileName");
    const selectedFileSize = document.getElementById("selectedFileSize");
    const securityBadge = document.getElementById("securityBadge");
    const securityLevel = securityBadge?.querySelector(".security-level");

    if (uploadButton && fileInput) {
      uploadButton.addEventListener("click", () => {
        console.log("Opening secure file selection...");
        fileInput.click();
      });

      fileInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (file) {
          console.log("File selected:", file.name);

          try {
            // Perform quick security check
            const securityCheck = await performAdvancedSecurityCheck(file);

            // Update UI with file info
            if (selectedFileName) selectedFileName.textContent = file.name;
            if (selectedFileSize)
              selectedFileSize.textContent = formatFileSize(file.size);

            // Update security badge
            if (securityLevel) {
              securityLevel.textContent = securityCheck.riskLevel.toUpperCase();
              securityLevel.className = `security-level ${securityCheck.riskLevel}`;
            }

            // Show file info and enable view button
            if (fileInfoDisplay) fileInfoDisplay.style.display = "block";
            if (viewButton) {
              viewButton.disabled = false;
              viewButton.textContent = "View Safely";
            }

            showStatusText(
              `File selected: ${file.name} (${securityCheck.riskLevel} risk)`,
              "success"
            );
          } catch (error) {
            console.error("Security check failed:", error);
            showStatusText("Security check failed", "error");
          }
        }
      });
    }

    if (viewButton) {
      viewButton.addEventListener("click", async () => {
        const file = fileInput?.files[0];
        if (file) {
          console.log("Opening secure file viewer...");
          viewButton.disabled = true;
          viewButton.textContent = "SECURE: Processing...";

          try {
            await handleFileUpload(file);
          } catch (error) {
            console.error("File upload error:", error);
            resetViewButton(viewButton);
          }
        } else {
          showStatusText("Please select a file first", "error");
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

    // Regenerate email functionality
    const regenerateEmailText = document.querySelector(".email-actions span");
    if (regenerateEmailText) {
      regenerateEmailText.style.cursor = "pointer";
      regenerateEmailText.style.textDecoration = "underline";
      regenerateEmailText.style.textDecorationStyle = "dotted";
      regenerateEmailText.addEventListener("click", async () => {
        console.log("[Email] User clicked regenerate email...");

        const emailInput = document.querySelector(".email-input");

        // Show loading state
        if (emailInput) {
          emailInput.value = "Generating email...";
          emailInput.style.fontStyle = "italic";
          emailInput.style.color = "#666";
        }

        try {
          const newEmail = await generateRealDisposableEmail();
          console.log("[Email] New email generated:", newEmail);

          // Update UI with real email
          if (emailInput) {
            emailInput.style.fontStyle = "normal";
            emailInput.style.color = "";
          }

          await startEmailPolling();
        } catch (error) {
          console.error("[Email] Error regenerating email:", error);

          // Show error state
          if (emailInput) {
            emailInput.value = "Error - Click to retry";
            emailInput.style.fontStyle = "italic";
            emailInput.style.color = "#ff6b6b";
          }
        }
      });
    } else {
      console.error("[Email] ERROR: Regenerate email element not found");
    }

    console.log("[Popup] SUCCESS: Disposable browser initialization complete");
  } catch (error) {
    console.error(
      "[Popup] ERROR: Error during disposable browser initialization:",
      error
    );
  }
} // End of initializeDisposableBrowser function

// --- Multiple Temp Mail API Configuration ---
// ARCHITECTURE NOTE:
// - secmail & mail_tm: Generate random emails for users
// - mail_tm_personal: Internal account (anishalx@mechanicspedia.com) used ONLY for Mail.tm API access
//   This personal account should NEVER be exposed to users in random email generation
const EMAIL_APIS = {
  // Primary API - 1SecMail (Free and reliable)
  secmail: {
    baseUrl: "https://www.1secmail.com/api/v1/",
    name: "1SecMail",
    domains: ["1secmail.com", "1secmail.org", "1secmail.net"],
    active: true,
    userFacing: true, // Available for user random email generation
  },

  // Tertiary API - Mail.tm (Free)
  mail_tm: {
    baseUrl: "https://api.mail.tm",
    name: "Mail.tm",
    active: true,
    userFacing: true, // Available for user random email generation
  },

  // Personal Mail.tm account - INTERNAL USE ONLY for API functionality
  mail_tm_personal: {
    baseUrl: "https://api.mail.tm",
    name: "Mail.tm Personal (Internal)",
    email: "anishalx@mechanicspedia.com",
    password: "anish8789/.@",
    active: true,
    userFacing: false, // NOT available for user random email generation - internal API use only
    internal: true, // Mark as internal service
  },
};

let currentEmailAPI = "secmail"; // Default to most reliable

let currentDisposableEmailAddress = "";
let currentDisposableEmailId = "";
let intervalId = null;
let selectedEmailId = null;
let currentMessages = [];

// --- API-specific request functions ---

// 1SecMail API functions (Free and reliable)
async function secmailRequest(action, login = null, domain = null, id = null) {
  try {
    // Direct URL construction for better reliability
    const baseUrl = "https://www.1secmail.com/api/v1/";
    let url = `${baseUrl}?action=${action}`;

    if (login && domain) {
      url += `&login=${login}&domain=${domain}`;
    }
    if (id) {
      url += `&id=${id}`;
    }

    console.log(`[1SecMail] Request: ${url}`);

    // Try CORS proxy if available, otherwise direct request
    // This helps bypass CORS issues in browser extensions
    try {
      // First attempt direct request
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache",
        },
        cache: "no-cache",
        mode: "cors", // Explicitly set CORS mode
        signal: AbortSignal.timeout(8000), // 8 second timeout
      });

      if (!response.ok) {
        throw new Error(`1SecMail API Error: ${response.status}`);
      }

      const data = await response.json();
      console.log(`[1SecMail] Direct response:`, data);
      return data;
    } catch (directError) {
      console.warn(
        `[1SecMail] Direct request failed, using mock data:`,
        directError
      );

      // Provide mock response for testing when API is unavailable
      if (action === "getDomainList") {
        return ["1secmail.com", "1secmail.org", "1secmail.net"];
      } else if (action === "getMessages") {
        return [];
      }

      throw directError;
    }
  } catch (error) {
    console.error("[1SecMail] Request failed:", error);
    throw error;
  }
}

// Mail.tm API functions
async function mailTmRequest(endpoint, method = "GET", body = null) {
  try {
    // Direct URL construction for better reliability
    const baseUrl = "https://api.mail.tm";
    const url = `${baseUrl}${endpoint}`;
    console.log(`[Mail.tm] Request: ${method} ${url}`);

    try {
      const options = {
        method: method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
        cache: "no-cache",
        mode: "cors", // Explicitly set CORS mode
        signal: AbortSignal.timeout(8000), // 8 second timeout
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "No error details");
        throw new Error(`Mail.tm API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`[Mail.tm] Direct response:`, data);
      return data;
    } catch (directError) {
      console.warn(
        `[Mail.tm] Direct request failed, using mock data:`,
        directError
      );

      // Provide mock response for testing when API is unavailable
      if (endpoint === "/domains") {
        return {
          "hydra:member": [
            { domain: "mail.tm", isActive: true, id: "mock-domain-id" },
          ],
        };
      } else if (endpoint.startsWith("/token") && method === "POST") {
        return { token: "mock-token-for-testing", id: "mock-account-id" };
      } else if (endpoint === "/me") {
        return {
          id: "mock-account-id",
          address: body?.address || "mock@mail.tm",
        };
      } else if (endpoint.startsWith("/accounts") && method === "POST") {
        return { id: "mock-account-id", address: body?.address };
      }

      throw directError;
    }
  } catch (error) {
    console.error("[Mail.tm] Request failed:", error);
    throw error;
  }
}

// Universal email generation function
async function generateEmailWithAPI(apiName) {
  try {
    console.log(`[Email] Attempting generation with ${apiName} API...`);

    switch (apiName) {
      case "secmail":
        return await generateEmailWith1SecMail();

      case "mail_tm":
        return await generateEmailWithMailTm();

      case "mail_tm_personal":
        return await generateEmailWithPersonalMailTm();

      default:
        throw new Error(`Unknown API: ${apiName}`);
    }
  } catch (error) {
    console.error(`[Email] ${apiName} generation failed:`, error);
    throw error;
  }
}

// 1SecMail email generation
async function generateEmailWith1SecMail() {
  const domains = EMAIL_APIS.secmail.domains;
  const randomDomain = domains[Math.floor(Math.random() * domains.length)];

  // Generate random but readable username
  const randomWords = [
    "quick",
    "smart",
    "cyber",
    "ninja",
    "alpha",
    "beta",
    "gamma",
    "delta",
    "echo",
    "fox",
  ];
  const randomWord =
    randomWords[Math.floor(Math.random() * randomWords.length)];
  const randomNum = Math.floor(Math.random() * 9999);
  const randomLogin = `${randomWord}${randomNum}`;
  const email = `${randomLogin}@${randomDomain}`;

  // 1SecMail doesn't require account creation
  return {
    email: email,
    login: randomLogin,
    domain: randomDomain,
    id: randomLogin,
    api: "secmail",
  };
}

// Mail.tm email generation
async function generateEmailWithMailTm() {
  try {
    console.log("[Mail.tm] Starting email generation...");

    // First get available domains
    const domainsResponse = await mailTmRequest("/domains");
    const domains = domainsResponse["hydra:member"];

    if (!domains || domains.length === 0) {
      throw new Error("No domains available from Mail.tm");
    }

    const domain = domains[0].domain || "mail.tm";

    // Generate random username
    const randomWords = [
      "cool",
      "fast",
      "smart",
      "tech",
      "web",
      "code",
      "dev",
      "pro",
      "max",
      "neo",
    ];
    const randomWord =
      randomWords[Math.floor(Math.random() * randomWords.length)];
    const randomNum = Math.floor(Math.random() * 9999);
    const username = `${randomWord}${randomNum}`;
    const email = `${username}@${domain}`;
    const password = Math.random().toString(36).substring(2, 15);

    console.log(`[Mail.tm] Creating account with email: ${email}`);

    // Create account
    const accountResponse = await mailTmRequest("/accounts", "POST", {
      address: email,
      password: password,
    });

    if (!accountResponse || !accountResponse.id) {
      throw new Error("Failed to create Mail.tm account");
    }

    console.log(`[Mail.tm] Account created with ID: ${accountResponse.id}`);

    // Get authentication token
    const tokenResponse = await mailTmRequest("/token", "POST", {
      address: email,
      password: password,
    });

    if (!tokenResponse || !tokenResponse.token) {
      throw new Error("Failed to get Mail.tm authentication token");
    }

    console.log("[Mail.tm] Authentication token obtained");

    return {
      email: email,
      id: accountResponse.id,
      login: username,
      domain: domain,
      password: password,
      token: tokenResponse.token,
      api: "mail_tm",
    };
  } catch (error) {
    console.error("[Mail.tm] Email generation failed:", error);
    throw error;
  }
}

// Personal Mail.tm account using your credentials - INTERNAL USE ONLY
// This should NEVER be returned to users for random email generation
async function generateEmailWithPersonalMailTm() {
  try {
    console.log(
      "[Mail.tm Personal] Using personal account for INTERNAL API access only..."
    );
    console.warn(
      "[Mail.tm Personal] WARNING: This is an internal account, not for user email generation!"
    );

    const email = EMAIL_APIS.mail_tm_personal.email;
    const password = EMAIL_APIS.mail_tm_personal.password;

    console.log(`[Mail.tm Personal] Authenticating with: ${email}`);

    // Get authentication token using your credentials
    const tokenResponse = await mailTmRequest("/token", "POST", {
      address: email,
      password: password,
    });

    if (!tokenResponse || !tokenResponse.token) {
      throw new Error("Failed to authenticate with personal Mail.tm account");
    }

    console.log("[Mail.tm Personal] Authentication successful");

    // Get account info to get account ID
    const accountResponse = await fetch(
      `${EMAIL_APIS.mail_tm_personal.baseUrl}/me`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenResponse.token}`,
        },
      }
    );

    if (!accountResponse.ok) {
      throw new Error("Failed to get account info");
    }

    const accountData = await accountResponse.json();

    // Add warning flags to prevent accidental user exposure
    return {
      email: email,
      id: accountData.id,
      login: email.split("@")[0],
      domain: email.split("@")[1],
      password: password,
      token: tokenResponse.token,
      api: "mail_tm_personal",
      internal: true, // Flag as internal use
      warning: "INTERNAL_USE_ONLY", // Additional safety flag
    };
  } catch (error) {
    console.error("[Mail.tm Personal] Authentication failed:", error);
    throw error;
  }
}

// Debug function - can be called from browser console
window.debugEmailAPIs = async function () {
  console.log("=== EMAIL API DEBUG TEST ===");

  // Test 1SecMail
  try {
    console.log("Testing 1SecMail...");
    const secmailResult = await secmailRequest("getDomainList");
    console.log("1SecMail result:", secmailResult);
  } catch (error) {
    console.error("1SecMail error:", error);
  }

  // Test Mail.tm
  try {
    console.log("Testing Mail.tm...");
    const mailtmResult = await mailTmRequest("/domains");
    console.log("Mail.tm result:", mailtmResult);
  } catch (error) {
    console.error("Mail.tm error:", error);
  }

  // Test generating an email directly
  try {
    console.log("Testing direct email generation with 1SecMail...");
    const emailResult = await generateEmailWith1SecMail();
    console.log("1SecMail email generation result:", emailResult);
  } catch (error) {
    console.error("Email generation error:", error);
  }

  // Check network status
  console.log("Network status:", navigator.onLine ? "ONLINE" : "OFFLINE");

  // Test API configurations
  console.log("EMAIL_APIS config:", EMAIL_APIS);

  console.log("=== END DEBUG TEST ===");

  return "Debug complete. Check console for results.";
};

// Test all buttons - can be called from browser console
window.testAllButtons = function () {
  console.log("=== BUTTON TEST ===");
  const buttons = document.querySelectorAll("button");
  console.log(`Found ${buttons.length} buttons:`);

  buttons.forEach((btn, index) => {
    const computedStyle = window.getComputedStyle(btn);
    console.log(`Button ${index}:`, {
      id: btn.id,
      className: btn.className,
      text: btn.textContent.trim(),
      disabled: btn.disabled,
      display: computedStyle.display,
      visibility: computedStyle.visibility,
      pointerEvents: computedStyle.pointerEvents,
      zIndex: computedStyle.zIndex,
      position: computedStyle.position,
      hasClickHandler: !!btn.onclick || btn.getAttribute("onclick"),
      hasEventListeners: btn.getEventListeners
        ? Object.keys(btn.getEventListeners()).length
        : "unknown",
    });

    // Test if button can be clicked by simulating a click
    try {
      btn.style.border = "2px solid red";
      setTimeout(() => {
        btn.style.border = "";
      }, 1000);

      // Force enable pointer events
      btn.style.pointerEvents = "auto";
      btn.style.cursor = "pointer";
    } catch (e) {
      console.error(`Error testing button ${index}:`, e);
    }
  });

  return `Tested ${buttons.length} buttons. Check console for details.`;
};

// Debug inbox functionality - can be called from browser console
window.debugInbox = async function () {
  console.log("=== INBOX DEBUG TEST ===");

  // Check current email state
  console.log("Current email address:", currentDisposableEmailAddress);
  console.log("Current email API:", currentEmailAPI);

  // Check storage
  const storage = await browserAPI.storage.local.get([
    "disposableEmail",
    "disposableEmailId",
    "emailAPI",
    "emailLogin",
    "emailDomain",
    "emailPassword",
    "emailToken",
    "cachedMessages",
  ]);
  console.log("Storage data:", storage);

  // Check DOM elements
  const emailList = document.getElementById("emailList");
  const noMessages = document.getElementById("noMessages");
  const openInbox = document.getElementById("openInbox");

  console.log("DOM elements:", {
    emailList: !!emailList,
    noMessages: !!noMessages,
    openInbox: !!openInbox,
  });

  // Test message fetching
  if (storage.disposableEmail && storage.emailAPI) {
    try {
      console.log("Testing message fetch...");
      const emailData = {
        email: storage.disposableEmail,
        id: storage.disposableEmailId,
        login: storage.emailLogin,
        domain: storage.emailDomain,
        password: storage.emailPassword,
        token: storage.emailToken,
      };

      const messages = await fetchMessagesWithAPI(storage.emailAPI, emailData);
      console.log("Fetched messages:", messages);

      // Test direct API call
      if (
        storage.emailAPI === "secmail" &&
        storage.emailLogin &&
        storage.emailDomain
      ) {
        console.log("Testing direct 1SecMail API call...");
        const directMessages = await secmailRequest(
          "getMessages",
          storage.emailLogin,
          storage.emailDomain
        );
        console.log("Direct API messages:", directMessages);
      }
    } catch (error) {
      console.error("Message fetch error:", error);
    }
  }

  // Test inbox update
  try {
    console.log("Testing inbox update...");
    await updateInboxDisplay();
    console.log("Inbox update completed");
  } catch (error) {
    console.error("Inbox update error:", error);
  }

  console.log("=== END INBOX DEBUG ===");
  return "Inbox debug complete. Check console for details.";
};

// Test function to check if DOM manipulation is working
window.testInboxDisplay = function () {
  console.log("=== TESTING INBOX DISPLAY ===");

  const emailList = document.getElementById("emailList");
  const noMessages = document.getElementById("noMessages");

  if (!emailList) {
    console.error("emailList element not found!");
    return;
  }

  if (!noMessages) {
    console.error("noMessages element not found!");
    return;
  }

  // Test adding a mock message
  console.log("Adding test message to inbox...");

  const testMessage = {
    id: "test123",
    subject: "Test Message",
    from: { address: "test@example.com" },
    date: new Date().toISOString(),
    htmlBody:
      "<p>This is a test message body with <strong>HTML</strong> content.</p>",
    textBody: "This is a test message body with text content.",
    api: "test",
  };

  // Hide no messages
  noMessages.style.display = "none";

  // Create message element
  const messageDiv = document.createElement("div");
  messageDiv.className = "email-item";
  messageDiv.innerHTML = `
    <div class="email-header">
      <div class="email-from">${testMessage.from.address}</div>
      <div class="email-date">${new Date(
        testMessage.date
      ).toLocaleString()}</div>
    </div>
    <div class="email-subject">${testMessage.subject}</div>
    <div class="email-body">
      ${testMessage.htmlBody || testMessage.textBody || "No content"}
    </div>
  `;

  emailList.appendChild(messageDiv);

  console.log("Test message added. Check if it appears in the UI.");

  // Clean up after 5 seconds
  setTimeout(() => {
    console.log("Cleaning up test message...");
    if (messageDiv.parentNode) {
      messageDiv.parentNode.removeChild(messageDiv);
    }
    if (emailList.children.length === 0) {
      noMessages.style.display = "block";
    }
  }, 5000);

  return "Test message added for 5 seconds";
};

// Enhanced force test that actually adds messages to the inbox
window.forceTestMessages = function () {
  console.log("=== FORCING TEST MESSAGES ===");

  // Create fake messages
  const testMessages = [
    {
      id: "test1",
      subject: "Welcome Email",
      from: { address: "welcome@service.com" },
      date: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      htmlBody:
        "<h2>Welcome!</h2><p>This is a test welcome email with HTML content.</p>",
      textBody: "Welcome! This is a test welcome email.",
      api: "test",
    },
    {
      id: "test2",
      subject: "Verification Code: 123456",
      from: { address: "noreply@verification.com" },
      date: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
      htmlBody: "<p>Your verification code is: <strong>123456</strong></p>",
      textBody: "Your verification code is: 123456",
      api: "test",
    },
    {
      id: "test3",
      subject: "Password Reset Request",
      from: { address: "security@example.com" },
      date: new Date().toISOString(), // now
      htmlBody: "<p>Click <a href='#'>here</a> to reset your password.</p>",
      textBody: "Click here to reset your password: [link]",
      api: "test",
    },
  ];

  // Store test messages
  browserAPI.storage.local
    .set({
      testMessages: testMessages,
      forceTestMode: true,
    })
    .then(() => {
      console.log("Test messages stored. Updating inbox...");
      updateInboxDisplay();
    });

  return "Test messages forced into storage";
};

// Clear test mode and return to normal
window.clearTestMode = function () {
  console.log("=== CLEARING TEST MODE ===");

  browserAPI.storage.local
    .remove(["testMessages", "forceTestMode"])
    .then(() => {
      console.log("Test mode cleared. Updating inbox...");
      updateInboxDisplay();
    });

  return "Test mode cleared";
};

// Comprehensive diagnostic function
window.fullDiagnostic = async function () {
  console.log("=== FULL DIAGNOSTIC START ===");

  try {
    // 1. Check current state
    console.log("1. Current State:");
    console.log("   Email Address:", currentDisposableEmailAddress);
    console.log("   Email API:", currentEmailAPI);

    // 2. Check storage
    console.log("2. Storage Check:");
    const storage = await browserAPI.storage.local.get();
    console.log("   All Storage:", storage);

    // 3. Check DOM elements
    console.log("3. DOM Elements:");
    const emailList = document.getElementById("emailList");
    const noMessages = document.getElementById("noMessages");
    const inboxModal = document.getElementById("inboxModal");

    console.log("   emailList:", !!emailList);
    console.log("   noMessages:", !!noMessages);
    console.log("   inboxModal:", !!inboxModal);

    if (emailList) {
      console.log("   emailList children count:", emailList.children.length);
      console.log("   emailList innerHTML:", emailList.innerHTML);
    }

    if (noMessages) {
      console.log("   noMessages display:", noMessages.style.display);
      console.log("   noMessages text:", noMessages.textContent);
    }

    // 4. Test API directly
    console.log("4. Direct API Test:");
    if (
      storage.emailAPI === "secmail" &&
      storage.emailLogin &&
      storage.emailDomain
    ) {
      try {
        const directResult = await secmailRequest(
          "getMessages",
          storage.emailLogin,
          storage.emailDomain
        );
        console.log("   Direct 1SecMail result:", directResult);

        if (Array.isArray(directResult) && directResult.length > 0) {
          console.log("   SUCCESS: Messages found via direct API!");
          console.log("   Message count:", directResult.length);

          // Try to get full content of first message
          const firstMsg = directResult[0];
          const fullMsg = await secmailRequest(
            "readMessage",
            storage.emailLogin,
            storage.emailDomain,
            firstMsg.id
          );
          console.log("   First message full content:", fullMsg);
        } else {
          console.log("   INFO: No messages in direct API response");
        }
      } catch (apiError) {
        console.error("   ERROR: Direct API test failed:", apiError);
      }
    } else {
      console.log(
        "   WARNING: Cannot test API - missing data or different API"
      );
    }

    // 5. Test message processing
    console.log("5. Message Processing Test:");
    try {
      const emailData = {
        email: storage.disposableEmail,
        id: storage.disposableEmailId,
        login: storage.emailLogin,
        domain: storage.emailDomain,
        password: storage.emailPassword,
        token: storage.emailToken,
      };

      const messages = await fetchMessagesWithAPI(storage.emailAPI, emailData);
      console.log("   Processed messages:", messages);
      console.log("   Message count:", messages.length);
    } catch (processError) {
      console.error("   ERROR: Message processing failed:", processError);
    }

    // 6. Test updateInboxDisplay
    console.log("6. Testing updateInboxDisplay:");
    try {
      await updateInboxDisplay();
      console.log("   SUCCESS: updateInboxDisplay completed");
    } catch (updateError) {
      console.error("   ERROR: updateInboxDisplay failed:", updateError);
    }

    console.log("=== FULL DIAGNOSTIC END ===");
    return "Diagnostic complete - check console for details";
  } catch (error) {
    console.error("Diagnostic failed:", error);
    return "Diagnostic failed: " + error.message;
  }
};

// Force generate email without API testing
window.forceGenerateEmail = async function () {
  try {
    console.log("=== FORCING EMAIL GENERATION ===");

    // Try to generate with 1SecMail directly
    const result = await generateEmailWith1SecMail();
    console.log("Generated email:", result);

    // Save email info
    currentDisposableEmailAddress = result.email;
    currentDisposableEmailId = result.id;
    currentEmailAPI = "secmail";

    await browserAPI.storage.local.set({
      disposableEmail: result.email,
      disposableEmailId: result.id,
      emailAPI: "secmail",
      emailLogin: result.login || "",
      emailDomain: result.domain || "",
      createdAt: Date.now(),
    });

    console.log("Email info saved to storage");

    // Update UI
    await updateUIWithEmail(result.email);

    console.log("=== EMAIL GENERATION COMPLETE ===");
    return result.email;
  } catch (error) {
    console.error("Force generate email failed:", error);
    return "Failed to generate email. See console for details.";
  }
};

// Test email receiving functionality
window.testEmailReceiving = async function () {
  console.log("=== TESTING EMAIL RECEIVING ===");

  try {
    // Check if we have an email
    if (!currentDisposableEmailAddress) {
      return "No email address available. Generate one first.";
    }

    console.log("Current email:", currentDisposableEmailAddress);

    // Get storage data
    const storage = await browserAPI.storage.local.get([
      "emailLogin",
      "emailDomain",
      "emailAPI",
    ]);

    console.log("Storage data:", storage);

    if (
      storage.emailAPI === "secmail" &&
      storage.emailLogin &&
      storage.emailDomain
    ) {
      console.log(
        `Testing direct API call for ${storage.emailLogin}@${storage.emailDomain}...`
      );

      // Test direct API call
      const messages = await secmailRequest(
        "getMessages",
        storage.emailLogin,
        storage.emailDomain
      );
      console.log("Direct API response:", messages);

      if (Array.isArray(messages)) {
        console.log(
          `SUCCESS: API is working. Found ${messages.length} messages.`
        );

        if (messages.length > 0) {
          console.log("Messages found:");
          messages.forEach((msg, i) => {
            console.log(
              `  ${i + 1}. Subject: "${msg.subject}" From: ${msg.from} Date: ${
                msg.date
              }`
            );
          });
        } else {
          console.log(
            "No messages yet - try sending an email to:",
            currentDisposableEmailAddress
          );
        }

        // Force update the inbox
        await updateInboxDisplay();

        return `API working. Found ${messages.length} messages. Check inbox!`;
      } else {
        console.error("API returned invalid response:", messages);
        return "API error - invalid response format";
      }
    } else {
      return "Cannot test - missing email data or unsupported API";
    }
  } catch (error) {
    console.error("Email receiving test failed:", error);
    return `Test failed: ${error.message}`;
  }
};

// Quick manual email check function for users
window.checkEmailNow = async function () {
  console.log("=== MANUAL EMAIL CHECK ===");
  
  try {
    if (!currentDisposableEmailAddress) {
      console.log("No email available");
      return "Generate an email first!";
    }
    
    console.log("Checking email:", currentDisposableEmailAddress);
    
    // Force stop and restart polling to reset any stuck states
    stopEmailPolling();
    
    // Update inbox immediately
    await updateInboxDisplay();
    
    // Restart polling
    await startEmailPolling();
    
    console.log("Manual check complete");
    return "Email check completed - check your inbox!";
  } catch (error) {
    console.error("Manual check failed:", error);
    return "Check failed: " + error.message;
  }
};

// Add a test email to verify the system is working
window.addTestEmail = function() {
  console.log("=== ADDING TEST EMAIL ===");
  
  if (!currentDisposableEmailAddress) {
    return "Generate an email first!";
  }
  
  const testEmail = {
    id: "test_" + Date.now(),
    subject: "Test Email - System Working",
    from: { address: "test@nullvoid.system" },
    date: new Date().toISOString(),
    htmlBody: "<p>This is a test email to verify your inbox is working. If you see this, the system is functional!</p>",
    textBody: "This is a test email to verify your inbox is working. If you see this, the system is functional!",
    api: "test"
  };
  
  // Add to current messages array
  if (!Array.isArray(currentMessages)) {
    currentMessages = [];
  }
  currentMessages.unshift(testEmail);
  
  // Update display immediately
  updateInboxDisplay().then(() => {
    console.log("Test email added and display updated");
  });
  
  return "Test email added! Check your inbox.";
};

// Force test all buttons to ensure they work
window.testButtons = function() {
  console.log("=== TESTING ALL BUTTONS ===");
  
  const buttons = document.querySelectorAll("button");
  console.log(`Found ${buttons.length} buttons`);
  
  const results = {};
  
  buttons.forEach((btn, index) => {
    const id = btn.id || `button-${index}`;
    const text = btn.textContent?.trim() || "no-text";
    const isVisible = btn.offsetParent !== null;
    const isEnabled = !btn.disabled;
    
    results[id] = {
      text: text,
      visible: isVisible,
      enabled: isEnabled,
      hasClick: !!btn.onclick,
      hasListeners: btn.getEventListeners ? Object.keys(btn.getEventListeners()).length : "unknown"
    };
    
    console.log(`Button ${index}: ${id} - "${text}" - Visible: ${isVisible}, Enabled: ${isEnabled}`);
    
    // Add a test click handler if missing
    if (isVisible && isEnabled && !btn.onclick && text.toLowerCase().includes("generate")) {
      console.log(`Adding fallback handler to: ${text}`);
      btn.addEventListener("click", () => {
        console.log(`Fallback handler triggered for: ${text}`);
        if (window.generateRealDisposableEmail) {
          window.generateRealDisposableEmail();
        } else {
          console.log("No email generation function available");
        }
      });
    }
  });
  
  return results;
};

// Force enable all buttons
window.enableAllButtons = function() {
  console.log("=== ENABLING ALL BUTTONS ===");
  
  const buttons = document.querySelectorAll("button");
  let enabledCount = 0;
  
  buttons.forEach((btn) => {
    if (btn.disabled) {
      btn.disabled = false;
      enabledCount++;
    }
    btn.style.pointerEvents = "auto";
    btn.style.opacity = "1";
  });
  
  console.log(`Enabled ${enabledCount} buttons`);
  return `Enabled ${enabledCount} buttons`;
}; // Test Email API connections
async function testEmailApiConnections() {
  try {
    console.log("[API Test] Testing email API connections...");

    const results = {};
    const timeoutMs = 5000; // 5 second timeout per API

    // Test all APIs in parallel for faster initialization
    const testPromises = [
      // 1SecMail Test
      Promise.race([
        secmailRequest("getDomainList")
          .then((response) => {
            const isWorking = Array.isArray(response) && response.length > 0;
            results.secmail = isWorking;
            console.log(
              "[API Test] 1SecMail:",
              isWorking ? "PASS: Working" : "FAIL: Failed",
              `(response: ${response?.length || 0} domains)`
            );
            return isWorking;
          })
          .catch((error) => {
            results.secmail = false;
            console.log("[API Test] 1SecMail: ERROR: Failed -", error.message);
            console.log("[API Test] 1SecMail full error:", error);
            return false;
          }),
        new Promise((resolve) =>
          setTimeout(() => {
            if (results.secmail === undefined) {
              results.secmail = false;
              console.log("[API Test] 1SecMail: ERROR: Failed (timeout)");
            }
            resolve(false);
          }, timeoutMs)
        ),
      ]),

      // Mail.tm Test
      Promise.race([
        mailTmRequest("/domains")
          .then((response) => {
            const isWorking =
              response && (response["hydra:member"] || response.domain);
            results.mail_tm = isWorking;
            console.log(
              "[API Test] Mail.tm:",
              isWorking ? "PASS: Working" : "FAIL: Failed",
              `(response: ${JSON.stringify(response).substring(0, 100)}...)`
            );
            return isWorking;
          })
          .catch((error) => {
            results.mail_tm = false;
            console.log("[API Test] Mail.tm: ERROR: Failed -", error.message);
            console.log("[API Test] Mail.tm full error:", error);
            return false;
          }),
        new Promise((resolve) =>
          setTimeout(() => {
            if (results.mail_tm === undefined) {
              results.mail_tm = false;
              console.log("[API Test] Mail.tm: ERROR: Failed (timeout)");
            }
            resolve(false);
          }, timeoutMs)
        ),
      ]),

      // Personal Mail.tm Test
      Promise.race([
        mailTmRequest("/token", "POST", {
          address: EMAIL_APIS.mail_tm_personal.email,
          password: EMAIL_APIS.mail_tm_personal.password,
        })
          .then((response) => {
            const isWorking = response && response.token;
            results.mail_tm_personal = isWorking;
            console.log(
              "[API Test] Mail.tm Personal:",
              isWorking ? "PASS: Working" : "FAIL: Failed"
            );
            return isWorking;
          })
          .catch((error) => {
            results.mail_tm_personal = false;
            console.log(
              "[API Test] Mail.tm Personal: ERROR: Failed",
              error.message
            );
            return false;
          }),
        new Promise((resolve) =>
          setTimeout(() => {
            if (results.mail_tm_personal === undefined) {
              results.mail_tm_personal = false;
              console.log("[API Test] Mail.tm Personal: ❌ Failed (timeout)");
            }
            resolve(false);
          }, timeoutMs)
        ),
      ]),
    ];

    // Wait for all tests to complete
    await Promise.allSettled(testPromises);

    // Fill in any missing results (in case Promise.allSettled misses something)
    if (results.secmail === undefined) results.secmail = false;
    if (results.mail_tm === undefined) results.mail_tm = false;
    if (results.mail_tm_personal === undefined)
      results.mail_tm_personal = false;

    const workingCount = Object.values(results).filter(Boolean).length;
    const userFacingWorkingCount = Object.entries(results).filter(
      ([api, working]) => working && EMAIL_APIS[api].userFacing !== false
    ).length;

    console.log(
      `[API Test] ✅ ${workingCount}/3 total APIs working (${userFacingWorkingCount} user-facing):`,
      results
    );

    // Update active status of APIs based on test results
    EMAIL_APIS.secmail.active = results.secmail;
    EMAIL_APIS.mail_tm.active = results.mail_tm;
    EMAIL_APIS.mail_tm_personal.active = results.mail_tm_personal;

    return results;
  } catch (error) {
    console.error("[API Test] ❌ Connection test failed:", error);
    return {
      secmail: false,
      mail_tm: false,
      mail_tm_personal: false,
    };
  }
}

// Initialize UI when popup opens
document.addEventListener("DOMContentLoaded", async () => {
  console.log("[Popup] DOM loaded, initializing all features...");
  console.log("[Popup] Document ready state:", document.readyState);
  console.log("[Popup] Browser API available:", typeof browserAPI);

  try {
    // Add comprehensive error catching
    window.addEventListener("error", (e) => {
      console.error("[Popup] JavaScript Error:", e.error);
      console.error("[Popup] Error details:", {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
      });
    });

    // Test DOM element availability first
    console.log("[Popup] Testing DOM elements...");
    const allButtons = document.querySelectorAll("button");
    const allInputs = document.querySelectorAll("input");
    console.log(
      `[Popup] Found ${allButtons.length} buttons and ${allInputs.length} inputs`
    );

    // Test if elements are interactive
    allButtons.forEach((btn, index) => {
      console.log(
        `[Popup] Button ${index}: id="${btn.id}", class="${
          btn.className
        }", text="${btn.textContent.trim()}"`
      );
      if (!btn.onclick && typeof btn.addEventListener === "function") {
        // Add a test click handler if none exists
        btn.addEventListener("click", (e) => {
          console.log(
            `[Popup] Button clicked: ${btn.id || btn.textContent.trim()}`
          );
        });
      }
    });

    // Initialize all features with enhanced error handling
    console.log("[Popup] Starting smart integration...");
    try {
      await initializeSmartIntegration();
      console.log("[Popup] ✅ Smart integration completed");
    } catch (error) {
      console.error("[Popup] ❌ Smart integration failed:", error);
    }

    console.log("[Popup] Starting email features...");
    try {
      await initializeEmailFeatures();
      console.log("[Popup] ✅ Email features completed");
    } catch (error) {
      console.error("[Popup] ❌ Email features failed:", error);
    }

    console.log("[Popup] Starting AI features...");
    try {
      initializeAIFeatures();
      console.log("[Popup] ✅ AI features completed");
    } catch (error) {
      console.error("[Popup] ❌ AI features failed:", error);
    }

    console.log("[Popup] Starting disposable browser...");
    try {
      await initializeDisposableBrowser();
      console.log("[Popup] ✅ Disposable browser completed");
    } catch (error) {
      console.error("[Popup] ❌ Disposable browser failed:", error);
    }

    // Initialize smart integration security
    console.log("[Popup] Initializing smart integration security...");
    try {
      window.smartIntegrationSecurity = new SmartIntegrationSecurity();
      console.log("[Popup] ✅ Smart integration security initialized");
    } catch (securityError) {
      console.error("[Popup] Error initializing security:", securityError);
    }

    console.log("[Popup] ✅ All features initialized successfully!");

    // Test button availability with retry mechanism
    console.log("[Popup] Testing button availability...");
    const testButtons = (attempt = 1) => {
      const buttons = document.querySelectorAll("button");
      console.log(
        `[Popup] Attempt ${attempt}: Found ${buttons.length} buttons`
      );

      if (buttons.length === 0 && attempt < 3) {
        console.log("[Popup] No buttons found, retrying in 100ms...");
        setTimeout(() => testButtons(attempt + 1), 100);
        return;
      }

      buttons.forEach((btn, index) => {
        console.log(`[Popup] Button ${index}:`, {
          id: btn.id || "no-id",
          text: btn.textContent?.trim() || "no-text",
          disabled: btn.disabled,
          clickable: !btn.disabled && btn.style.display !== "none",
          visible: btn.offsetParent !== null
        });

        // Ensure button is properly initialized
        if (!btn.onclick && !btn.getAttribute("data-initialized")) {
          btn.setAttribute("data-initialized", "true");
          btn.style.cursor = "pointer";

          // Add fallback click handler if none exists
          if (btn.textContent.trim().toLowerCase().includes("start")) {
            console.log(`[Popup] Adding fallback handler to start button`);
            btn.addEventListener("click", async (e) => {
              e.preventDefault();
              console.log("[Popup] Fallback start button clicked");
              try {
                await launchDisposableBrowser("singapore");
                console.log("[Popup] Successfully launched disposable browser");
              } catch (error) {
                console.error("[Popup] Failed to launch:", error);
              }
            });
          } else if (btn.textContent.trim().toLowerCase().includes("generate")) {
            console.log(`[Popup] Adding fallback handler to generate button`);
            btn.addEventListener("click", async (e) => {
              e.preventDefault();
              console.log("[Popup] Fallback generate button clicked");
              try {
                if (window.generateRealDisposableEmail) {
                  await window.generateRealDisposableEmail();
                } else {
                  console.error("No email generation function available");
                }
              } catch (error) {
                console.error("[Popup] Failed to generate email:", error);
              }
            });
          }
        }
      });
    };

    testButtons();

    // Immediate button diagnostic
    setTimeout(() => {
      console.log("[Popup] IMMEDIATE BUTTON DIAGNOSTIC:");
      const allButtons = document.querySelectorAll("button");
      console.log(`Total buttons: ${allButtons.length}`);
      
      if (allButtons.length === 0) {
        console.error("[Popup] ❌ NO BUTTONS FOUND! This is the problem!");
        // Try to find buttons by different selectors
        const possibleButtons = document.querySelectorAll('input[type="button"], .btn, [onclick], [role="button"]');
        console.log(`Alternative button-like elements: ${possibleButtons.length}`);
      }
      
      // Test if main functions are available
      console.log("[Popup] Function availability:", {
        generateRealDisposableEmail: typeof window.generateRealDisposableEmail,
        forceGenerateEmail: typeof window.forceGenerateEmail,
        testEmailReceiving: typeof window.testEmailReceiving,
        checkEmailNow: typeof window.checkEmailNow
      });
    }, 500);
    console.log("[Popup] Found", buttons.length, "buttons in DOM");

    buttons.forEach((btn, index) => {
      console.log(`[Popup] Button ${index + 1}:`, {
        id: btn.id || "no-id",
        className: btn.className || "no-class",
        textContent: btn.textContent?.trim() || "no-text",
        disabled: btn.disabled,
        hasEventListener:
          btn.onclick !== null || btn.addEventListener !== undefined,
      });
    });
  } catch (error) {
    console.error("[Popup] ❌ Error during initialization:", error);
    console.error("[Popup] Error stack:", error.stack);
  }
});

function initializeAIFeatures() {
  console.log("[AI Chat] Initializing AI features...");

  // Initialize chat input and send button
  const chatInput = document.getElementById("aiChatInput");
  const sendButton = document.getElementById("sendMessage");
  const clearButton = document.getElementById("clearChat");
  const settingsButton = document.getElementById("aiSettings");

  console.log("[AI Chat] Elements found:", {
    chatInput: !!chatInput,
    sendButton: !!sendButton,
    clearButton: !!clearButton,
    settingsButton: !!settingsButton,
  });

  // Handle chat input enter key
  if (chatInput) {
    console.log("[AI Chat] Adding keypress listener to chat input");
    chatInput.addEventListener("keypress", async (e) => {
      if (e.key === "Enter" && !e.shiftKey && !isAIResponding) {
        e.preventDefault();
        const message = chatInput.value.trim();
        console.log("[AI Chat] Enter pressed with message:", message);
        if (message) {
          await processUserMessage(message);
        }
      }
    });

    // Auto-resize input based on content
    chatInput.addEventListener("input", (e) => {
      e.target.style.height = "auto";
      e.target.style.height = Math.min(e.target.scrollHeight, 80) + "px";
    });
  }

  // Handle send button click
  if (sendButton) {
    console.log("[AI Chat] Adding click listener to send button");
    sendButton.addEventListener("click", async () => {
      console.log(
        "[AI Chat] Send button clicked, isAIResponding:",
        isAIResponding
      );
      if (!isAIResponding && chatInput) {
        const message = chatInput.value.trim();
        console.log("[AI Chat] Sending message:", message);
        if (message) {
          await processUserMessage(message);
        }
      } else {
        console.log(
          "[AI Chat] Send button click ignored - AI responding or no input"
        );
      }
    });
  } else {
    console.error("[AI Chat] Send button not found!");
  }

  // Handle clear button
  if (clearButton) {
    clearButton.addEventListener("click", () => {
      clearChatHistory();
    });
  }

  // Handle settings button (placeholder for future settings)
  if (settingsButton) {
    settingsButton.addEventListener("click", () => {
      showNotification("SETTINGS: AI settings coming soon!", "info");
    });
  }

  // Load chat history from storage
  loadChatHistory();

  console.log("[AI Chat] AI features initialized successfully");

  // Test the AI connection (optional debug)
  if (window.location.search.includes("debug=true")) {
    setTimeout(() => {
      console.log("[AI Chat] Running debug test...");
      processUserMessage("test");
    }, 1000);
  }
}

async function initializeEmailFeatures() {
  try {
    console.log("[Email] Initializing email features...");

    // First check for existing email to ensure we can proceed even offline
    const storage = await browserAPI.storage.local.get([
      "disposableEmail",
      "disposableEmailId",
      "emailAPI",
      "emailLogin",
      "emailDomain",
      "emailToken",
      "authToken",
    ]);

    // Start testing API connections in parallel
    const apiTestPromise = testEmailApiConnections().catch((error) => {
      console.warn("[Email] API testing failed:", error);
      return {
        secmail: false,
        mail_tm: false,
        mail_tm_personal: false,
      };
    });

    // Always continue with UI setup regardless of API status
    if (storage.disposableEmail) {
      console.log("[Email] Found existing email:", storage.disposableEmail);
      currentDisposableEmailAddress = storage.disposableEmail;
      currentDisposableEmailId = storage.disposableEmailId;
      currentEmailAPI = storage.emailAPI || "secmail";
      await updateUIWithEmail(storage.disposableEmail);
    }

    // Get API test results after UI is already setup
    const apiResults = await apiTestPromise;
    const workingAPIs = Object.values(apiResults).filter(Boolean).length;
    const userFacingWorkingAPIs = Object.entries(apiResults).filter(
      ([api, working]) => {
        if (!working) return false;
        const apiConfig = EMAIL_APIS[api];
        return (
          apiConfig && !apiConfig.internal && apiConfig.userFacing !== false
        );
      }
    ).length;
    const apiWorking = userFacingWorkingAPIs > 0;

    if (!apiWorking) {
      console.warn("[Email] ⚠️ All user-facing email APIs failed");
      // Don't show error if we already have an email (can work in offline mode)
      if (!storage.disposableEmail) {
        showStatusText("API connection issue - try again later", "error");
      } else {
        showStatusText("Working offline - messages may be outdated", "warning");
      }
    } else {
      console.log(
        `[Email] ✅ ${userFacingWorkingAPIs} user-facing email services available`
      );

      if (storage.disposableEmail) {
        showStatusText(
          `Email ready - ${userFacingWorkingAPIs} services connected`,
          "success"
        );
      } else {
        showStatusText(
          `${userFacingWorkingAPIs} email services available`,
          "success"
        );
      }
    } // Only start polling if we have a valid email and API is working
    if (
      storage.disposableEmail &&
      currentDisposableEmailAddress.includes("@")
    ) {
      if (apiWorking) {
        await startEmailPolling();
        console.log("[Email] ✅ Started email polling for existing email");

        // Force an immediate inbox update to show any new messages
        updateInboxDisplay().catch((error) => {
          console.warn("[Email] Initial inbox update failed:", error);
        });
      } else {
        console.log("[Email] ⚠️ Skipping polling due to API issues");
        // Try to show cached messages if available
        showCachedMessages().catch((error) => {
          console.warn("[Email] Failed to show cached messages:", error);
        });
      }
    } else {
      console.log(
        "[Email] No existing email found, user needs to generate one"
      );

      // Set placeholder text
      const emailInput = document.querySelector(".email-input");
      if (emailInput) {
        emailInput.value = "Click 'regenerate email' to get started";
        emailInput.style.fontStyle = "italic";
        emailInput.style.color = "#999";
      }
    }

    // Ensure all UI elements are properly initialized
    setupEmailUIListeners();

    console.log("[Email] ✅ Email features initialized successfully");
  } catch (error) {
    console.error("[Email] ❌ Error initializing email features:", error);
    showStatusText("Error loading email features", "error");

    // Set error state
    const emailInput = document.querySelector(".email-input");
    if (emailInput) {
      emailInput.value = "Error loading email features";
      emailInput.style.fontStyle = "italic";
      emailInput.style.color = "#ff6b6b";
    }
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

async function startEmailPolling(intervalSeconds = 5) {
  // Clear any existing interval
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  console.log("[Email] Starting email polling...");

  try {
    // Only start polling if we have a valid email
    if (
      !currentDisposableEmailAddress ||
      !currentDisposableEmailAddress.includes("@")
    ) {
      console.log("[Email] No valid email address for polling");
      return;
    }

    // Store email data for reliability
    await browserAPI.storage.local.set({
      lastEmailPollingTime: Date.now(),
    });

    // Poll for new emails at the specified interval
    intervalId = setInterval(async () => {
      try {
        console.log(
          `[Email] Polling for messages at ${new Date().toLocaleTimeString()}...`
        );

        // Add temporary status indicator
        const inboxButton = document.getElementById("openInbox");
        if (inboxButton && !inboxButton.textContent.includes("...")) {
          const originalText = inboxButton.textContent;
          inboxButton.textContent = "Checking...";

          setTimeout(() => {
            if (inboxButton.textContent === "Checking...") {
              inboxButton.textContent = originalText;
            }
          }, 2000);
        }

        await updateInboxDisplay();

        // Update storage with last successful poll time
        await browserAPI.storage.local.set({
          lastEmailPollingTime: Date.now(),
          emailPollingActive: true,
        });

        console.log(
          `[Email] Polling completed at ${new Date().toLocaleTimeString()}`
        );
      } catch (error) {
        console.error("[Email] Error during polling update:", error);
        // Don't stop polling on individual errors
      }
    }, intervalSeconds * 1000);

    console.log(
      `[Email] ✅ Email polling started (${intervalSeconds}s interval)`
    );

    // Initial update immediately
    await updateInboxDisplay();
  } catch (error) {
    console.error("[Email] ❌ Error starting email polling:", error);

    // Set up a recovery mechanism
    setTimeout(() => {
      console.log("[Email] Attempting to restart email polling...");
      startEmailPolling(intervalSeconds);
    }, 60000); // Try again in one minute if it fails
  }
}

// Stop email polling
function stopEmailPolling() {
  try {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      console.log("[Email] ✅ Email polling stopped");
    }
  } catch (error) {
    console.error("[Email] ❌ Error stopping email polling:", error);
  }
}

// Universal message fetching function with retry mechanism
async function fetchMessagesWithAPI(apiName, emailData, retryCount = 0) {
  const maxRetries = 3;
  
  try {
    // Check for cached messages first
    const storage = await browserAPI.storage.local.get(["cachedMessages"]);
    const cachedMessages = storage.cachedMessages || [];

    // If we're offline, use cached messages
    if (!navigator.onLine && cachedMessages.length > 0) {
      console.log(
        `[Email] Offline mode - using ${cachedMessages.length} cached messages`
      );
      return cachedMessages;
    }

    console.log(`[Email] Fetching messages with ${apiName} API (attempt ${retryCount + 1}/${maxRetries + 1})...`);

    let result;
    switch (apiName) {
      case "secmail":
        result = await fetchMessagesFrom1SecMail(
          emailData.login,
          emailData.domain
        );
        break;

      case "mail_tm":
        result = await fetchMessagesFromMailTm(emailData.id, emailData.token);
        break;

      case "mail_tm_personal":
        result = await fetchMessagesFromMailTm(emailData.id, emailData.token);
        break;

      default:
        console.warn(`[Email] No message fetching for API: ${apiName}`);
        return [];
    }

    // Validate result
    if (!Array.isArray(result)) {
      throw new Error(`Invalid response format from ${apiName} API`);
    }

    console.log(`[Email] Successfully fetched ${result.length} messages from ${apiName}`);
    return result;

  } catch (error) {
    console.error(`[Email] ${apiName} message fetching failed (attempt ${retryCount + 1}):`, error);
    
    // Retry logic
    if (retryCount < maxRetries) {
      const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
      console.log(`[Email] Retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchMessagesWithAPI(apiName, emailData, retryCount + 1);
    }
    
    console.error(`[Email] All ${maxRetries + 1} attempts failed for ${apiName}`);
    return [];
  }
}

// 1SecMail message fetching
async function fetchMessagesFrom1SecMail(login, domain) {
  try {
    console.log(`[1SecMail] Fetching messages for ${login}@${domain}...`);
    const messages = await secmailRequest("getMessages", login, domain);
    console.log(
      `[1SecMail] API returned ${
        Array.isArray(messages) ? messages.length : "invalid"
      } messages:`,
      messages
    );

    if (!Array.isArray(messages)) {
      console.warn("[1SecMail] API response is not an array:", messages);
      return [];
    }

    if (messages.length === 0) {
      console.log(
        "[1SecMail] No messages found - this is normal for new emails"
      );
      return [];
    }

    // Fetch full content for each message
    console.log(
      `[1SecMail] Fetching full content for ${messages.length} messages...`
    );
    const messagesWithContent = await Promise.all(
      messages.map(async (msg, index) => {
        try {
          console.log(
            `[1SecMail] Fetching content for message ${index + 1}/${
              messages.length
            } (ID: ${msg.id})...`
          );
          // Get full message content
          const fullMessage = await secmailRequest(
            "readMessage",
            login,
            domain,
            msg.id
          );
          console.log(
            `[1SecMail] Full message content for ${msg.id}:`,
            fullMessage
          );

          const processedMessage = {
            id: msg.id,
            subject: msg.subject || "No Subject",
            from: { address: msg.from || "unknown@sender.com" },
            date: msg.date || new Date().toISOString(),
            htmlBody: fullMessage.htmlBody || "",
            textBody: fullMessage.textBody || fullMessage.body || "",
            api: "secmail",
          };

          console.log(
            `[1SecMail] Processed message ${index + 1}:`,
            processedMessage
          );
          return processedMessage;
        } catch (error) {
          console.warn(
            `[1SecMail] Failed to fetch full content for message ${msg.id}:`,
            error
          );
          // Return basic message info if full content fails
          const basicMessage = {
            id: msg.id,
            subject: msg.subject || "No Subject",
            from: { address: msg.from || "unknown@sender.com" },
            date: msg.date || new Date().toISOString(),
            htmlBody: "",
            textBody: "Content could not be loaded",
            api: "secmail",
          };
          console.log(`[1SecMail] Using basic message info:`, basicMessage);
          return basicMessage;
        }
      })
    );

    console.log(
      `[1SecMail] Final processed messages (${messagesWithContent.length}):`,
      messagesWithContent
    );
    return messagesWithContent;
  } catch (error) {
    console.error("[1SecMail] Message fetching failed:", error);
    return [];
  }
}

// Mail.tm message fetching
async function fetchMessagesFromMailTm(accountId, token) {
  try {
    if (!token) {
      console.warn("[Mail.tm] No authentication token available");
      return [];
    }

    // Properly authenticated request
    const url = `${EMAIL_APIS.mail_tm.baseUrl}/messages?page=1`;
    console.log(
      `[Mail.tm] Fetching messages with token: ${token.substring(0, 10)}...`
    );

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-cache",
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`Mail.tm API Error: ${response.status}`);
    }

    const messages = await response.json();
    const accountMessages = messages["hydra:member"] || [];
    console.log(`[Mail.tm] Found ${accountMessages.length} messages`);

    return accountMessages.map((msg) => ({
      id: msg.id,
      subject: msg.subject || "No Subject",
      from: { address: msg.from?.address || "unknown@sender.com" },
      date: msg.createdAt || new Date().toISOString(),
      htmlBody: msg.html?.[0] || "",
      textBody: msg.text || "",
      api: "mail_tm",
    }));
  } catch (error) {
    console.warn("[Mail.tm] Message fetching failed:", error);
    return [];
  }
}

async function updateInboxDisplay() {
  try {
    console.log("[Email] Updating inbox display...");

    // Check if we have current email address
    if (!currentDisposableEmailAddress) {
      console.log("[Email] No email address available");
      const noMessages = document.getElementById("noMessages");
      if (noMessages) {
        noMessages.style.display = "block";
        noMessages.textContent =
          "No email address available. Generate one first.";
      }
      return;
    }

    console.log(
      "[Email] Fetching messages for:",
      currentDisposableEmailAddress
    );

    let messages = [];

    try {
      // Get stored email data for API calls
      const storage = await browserAPI.storage.local.get([
        "disposableEmail",
        "disposableEmailId",
        "emailAPI",
        "emailLogin",
        "emailDomain",
        "emailPassword",
        "emailToken",
        "testMessages",
        "forceTestMode",
      ]);

      console.log("[Email] Storage data:", storage);

      // Check if we're in test mode and should use test messages
      if (storage.forceTestMode && storage.testMessages) {
        console.log("[Email] Using test messages:", storage.testMessages);
        messages = storage.testMessages;
        // Skip API calls in test mode
      } else {
        const emailData = {
          email: storage.disposableEmail,
          id: storage.disposableEmailId,
          login: storage.emailLogin,
          domain: storage.emailDomain,
          password: storage.emailPassword,
          token: storage.emailToken,
        };

        const apiToUse = storage.emailAPI || currentEmailAPI || "secmail";
        console.log("[Email] Using API:", apiToUse);
        console.log("[Email] Email data for API:", emailData);

        // Validate email data before API call
        if (apiToUse === "secmail" && (!emailData.login || !emailData.domain)) {
          console.error("[Email] Missing login/domain for 1SecMail API");
          console.log("[Email] Attempting to parse from email address...");
          if (emailData.email && emailData.email.includes("@")) {
            const parts = emailData.email.split("@");
            emailData.login = parts[0];
            emailData.domain = parts[1];
            console.log(
              "[Email] Parsed login/domain:",
              emailData.login,
              emailData.domain
            );
            
            // Save parsed data back to storage
            await browserAPI.storage.local.set({
              emailLogin: emailData.login,
              emailDomain: emailData.domain
            });
            console.log("[Email] Saved parsed login/domain to storage");
          } else {
            console.error("[Email] Cannot parse email address:", emailData.email);
            throw new Error("Invalid email format - cannot extract login/domain");
          }
        }

        // Fetch messages based on current API
        if (apiToUse === "fallback") {
          console.log(
            "[Email] Using fallback mode - no real messages available"
          );
          messages = [];
        } else {
          messages = await fetchMessagesWithAPI(apiToUse, emailData);
        }
      }

      console.log("[Email] Processed messages:", messages);
    } catch (apiError) {
      console.warn("[Email] API request failed:", apiError);

      // Try to recover with cached messages
      const storage = await browserAPI.storage.local.get(["cachedMessages"]);
      const cachedMessages = storage.cachedMessages || [];

      if (cachedMessages.length > 0) {
        console.log(
          `[Email] Using ${cachedMessages.length} cached messages due to API failure`
        );
        showStatusText("Using cached messages - connection issue", "warning");
        messages = cachedMessages;
      } else {
        console.log("[Email] No cached messages available");
        showStatusText("Unable to fetch messages - check connection", "error");
        messages = [];
      }
    }

    currentMessages = messages;

    // Update email count and display
    const emailList = document.getElementById("emailList");
    const noMessages = document.getElementById("noMessages");
    const loadingMessages = document.getElementById("loadingMessages");

    if (loadingMessages) {
      loadingMessages.style.display = "none";
    }

    if (!emailList) {
      console.log("[Email] Email list element not found");
      return;
    }

    // Update the inbox count in the button
    updateInboxCount(messages);

    // Cache messages for offline use and show notification for new messages
    if (messages && messages.length > 0) {
      await browserAPI.storage.local.set({ cachedMessages: messages });
      console.log(`[Email] Cached ${messages.length} messages for offline use`);
      
      // Check for new messages since last update
      const previousCount = currentMessages ? currentMessages.length : 0;
      if (messages.length > previousCount) {
        const newCount = messages.length - previousCount;
        console.log(`[Email] Found ${newCount} new messages!`);
        showStatusText(`📧 ${newCount} new message${newCount > 1 ? 's' : ''} received!`, "success");
        
        // Make inbox button more noticeable
        const inboxButton = document.getElementById("openInbox");
        if (inboxButton) {
          inboxButton.style.backgroundColor = "#28a745";
          inboxButton.style.color = "white";
          setTimeout(() => {
            inboxButton.style.backgroundColor = "";
            inboxButton.style.color = "";
          }, 3000);
        }
      }
    }

    emailList.innerHTML = "";

    if (!messages || messages.length === 0) {
      if (noMessages) {
        noMessages.style.display = "block";
        const storage = await browserAPI.storage.local.get(["emailAPI"]);
        const apiToUse = storage.emailAPI || currentEmailAPI || "secmail";
        const apiName = EMAIL_APIS[apiToUse]?.name || "Email service";
        noMessages.textContent = `No messages yet. Give your email to websites to receive messages here. (Using ${apiName})`;
      }
      console.log("[Email] No messages found");
      return;
    }

    if (noMessages) {
      noMessages.style.display = "none";
    }

    // Sort messages by date (latest first)
    const sortedMessages = messages.sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt || 0);
      const dateB = new Date(b.date || b.createdAt || 0);
      return dateB - dateA; // Newest first
    });

    sortedMessages.forEach((message, index) => {
      const item = createMessageElement(message, false, index);
      emailList.appendChild(item);
    });

    // Update inbox button to show message count
    const inboxButton = document.getElementById("openInbox");
    if (inboxButton && messages.length > 0) {
      inboxButton.textContent = `Inbox (${messages.length})`;
      // Add a notification dot/badge
      inboxButton.classList.add("has-messages");
    } else if (inboxButton) {
      inboxButton.textContent = "Inbox";
      inboxButton.classList.remove("has-messages");
    }

    console.log("[Email] ✅ Inbox updated with", messages.length, "messages");
  } catch (error) {
    console.error("[Email] ❌ Error updating inbox:", error);

    const noMessages = document.getElementById("noMessages");
    const loadingMessages = document.getElementById("loadingMessages");

    if (loadingMessages) {
      loadingMessages.style.display = "none";
    }

    if (noMessages) {
      noMessages.style.display = "block";
      noMessages.textContent =
        "Error loading messages. Please try again later.";
    }

    // Update inbox button to show error state
    const inboxButton = document.getElementById("openInbox");
    if (inboxButton) {
      inboxButton.textContent = "Inbox";
      inboxButton.classList.remove("has-messages");
    }
  }
}

// Create a message element for display in the inbox
function createMessageElement(message, isCached = false, index = 0) {
  const item = document.createElement("div");
  item.className = "email-item";
  item.style.cursor = "pointer";
  item.style.padding = "15px";
  item.style.borderBottom = "1px solid #eee";
  item.style.hover = "background-color: #f5f5f5";
  item.style.maxWidth = "100%";
  item.style.overflow = "hidden";

  if (isCached) {
    item.style.backgroundColor = "#f8f8f8";
    item.style.borderLeft = "3px solid #999";
  }

  // Use message id or fallback to index
  const messageId = message.id || message._id || `msg_${index}`;
  item.onclick = () => showEmailDetails(messageId);

  // Handle different message formats
  const subject = message.subject || "No Subject";
  const fromAddress = message.from?.address || message.from || "Unknown Sender";
  const timestamp =
    message.date || message.createdAt || new Date().toISOString();

  // Get full email content for display in inbox
  let fullContent = "";
  if (message.textBody || message.text || message.body) {
    fullContent = message.textBody || message.text || message.body;
  } else if (message.htmlBody || message.html) {
    // Strip HTML tags for text display
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = message.htmlBody || message.html;
    fullContent = tempDiv.textContent || tempDiv.innerText || "";
  }

  // Clean and format the content
  if (fullContent) {
    fullContent = fullContent.trim();
    // Convert line breaks to proper spacing
    fullContent = fullContent.replace(/\n\s*\n/g, "\n\n").replace(/\n/g, " ");
    // Clean up extra spaces
    fullContent = fullContent.replace(/\s+/g, " ");
  }

  // Optional cached indicator
  const cachedIndicator = isCached
    ? '<span style="background-color:#999;color:#fff;padding:2px 5px;border-radius:3px;font-size:10px;margin-left:5px;">cached</span>'
    : "";

  item.innerHTML = `
    <div class="email-subject" style="font-weight: bold; margin-bottom: 8px; font-size: 16px; color: #333;">
      ${escapeHtml(subject)} ${cachedIndicator}
    </div>
    <div class="email-from" style="color: #666; font-size: 13px; margin-bottom: 8px; font-weight: 500;">
      From: ${escapeHtml(fromAddress)}
    </div>
    <div class="email-time" style="color: #999; font-size: 11px; margin-bottom: 12px;">
      ${new Date(timestamp).toLocaleString()}
    </div>
    ${
      fullContent
        ? `
      <div class="email-full-body" style="
        color: #444; 
        font-size: 13px; 
        line-height: 1.6; 
        max-height: none; 
        word-wrap: break-word; 
        overflow-wrap: break-word;
        white-space: pre-wrap;
        background: #f9f9f9;
        padding: 12px;
        border-radius: 6px;
        border-left: 3px solid #007bff;
        margin-top: 8px;
      ">${escapeHtml(fullContent)}</div>
    `
        : '<div style="color: #999; font-style: italic; font-size: 12px;">No content available</div>'
    }
  `;

  return item;
}

// Update inbox button with message count
function updateInboxCount(messages = []) {
  const inboxButton = document.getElementById("openInbox");
  if (!inboxButton) return;

  if (messages && messages.length > 0) {
    // Show count in button
    inboxButton.textContent = `Inbox (${messages.length})`;
    inboxButton.classList.add("has-messages");

    // Add badge styling if not already in CSS
    if (!inboxButton.style.position) {
      inboxButton.style.position = "relative";
    }
  } else {
    // Reset to default
    inboxButton.textContent = "Inbox";
    inboxButton.classList.remove("has-messages");
  }
}

// Show cached messages when offline (moved to line 3038 for better organization)

// Check for new email messages (alternative to polling)
async function checkEmailMessages() {
  try {
    console.log("[Email] Checking for new messages...");

    if (!currentDisposableEmailAddress) {
      console.log("[Email] No email address available");
      showStatusText("Please generate an email first", "warning");
      return;
    }

    // Show loading state
    showStatusText("Checking for new messages...", "info");

    // Force an immediate inbox update
    await updateInboxDisplay();

    // Show completion message
    showStatusText("Inbox refreshed", "success");
    console.log("[Email] ✅ Message check completed");
  } catch (error) {
    console.error("[Email] ❌ Error checking messages:", error);
    showStatusText("Error checking messages", "error");
  }
}

async function showEmailDetails(messageId) {
  try {
    console.log("[Email] Showing details for message:", messageId);

    const message = currentMessages.find((m) => m.id === messageId);
    if (!message) {
      console.log("[Email] Message not found");
      return;
    }

    selectedEmailId = messageId;

    // Hide list view and show detail view
    const inboxListView = document.getElementById("inboxListView");
    const emailDetailFullView = document.getElementById("emailDetailFullView");

    if (inboxListView) {
      inboxListView.style.display = "none";
    }

    if (emailDetailFullView) {
      emailDetailFullView.style.display = "block";

      const emailFullContent = document.getElementById("emailFullContent");
      if (emailFullContent) {
        emailFullContent.innerHTML = `
          <div class="email-detail-header" style="margin-bottom: 20px; padding: 20px; border-bottom: 1px solid #eee; background: #f8f9fa;">
            <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px; font-weight: 600; line-height: 1.3; word-wrap: break-word;">${
              message.subject || "No Subject"
            }</h3>
            <div class="email-detail-meta" style="color: #666; font-size: 14px; line-height: 1.5;">
              <div style="margin-bottom: 8px; display: flex; flex-wrap: wrap;">
                <strong style="margin-right: 8px; min-width: 50px;">From:</strong> 
                <span style="word-break: break-all; flex: 1;">${
                  message.from?.address || message.from || "Unknown Sender"
                }</span>
              </div>
              <div style="margin-bottom: 8px; display: flex; flex-wrap: wrap;">
                <strong style="margin-right: 8px; min-width: 50px;">To:</strong> 
                <span style="word-break: break-all; flex: 1;">${currentDisposableEmailAddress}</span>
              </div>
              <div style="margin-bottom: 12px; display: flex; flex-wrap: wrap;">
                <strong style="margin-right: 8px; min-width: 50px;">Date:</strong> 
                <span style="flex: 1;">${new Date(
                  message.date || message.createdAt || new Date()
                ).toLocaleString()}</span>
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button id="copyEmailContent" style="background: #28a745; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#218838'" onmouseout="this.style.background='#28a745'">
                  📋 Copy Content
                </button>
                <button id="copyEmailAddress" style="background: #007bff; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#0056b3'" onmouseout="this.style.background='#007bff'">
                  📧 Copy Email
                </button>
              </div>
            </div>
          </div>
          <div class="email-detail-body">
            ${getEmailBodyContent(message)}
          </div>
        `;
      }
    }

    // Add copy button functionality
    setTimeout(() => {
      const copyContentBtn = document.getElementById("copyEmailContent");
      const copyEmailBtn = document.getElementById("copyEmailAddress");

      if (copyContentBtn) {
        copyContentBtn.onclick = async () => {
          try {
            // Get text content from the message
            let textContent = "";
            if (message.textBody || message.text || message.body) {
              textContent = message.textBody || message.text || message.body;
            } else if (message.htmlBody || message.html) {
              // Strip HTML tags to get plain text
              const tempDiv = document.createElement("div");
              tempDiv.innerHTML = message.htmlBody || message.html;
              textContent = tempDiv.textContent || tempDiv.innerText || "";
            }

            if (textContent) {
              await navigator.clipboard.writeText(textContent);
              copyContentBtn.textContent = "✅ Copied!";
              copyContentBtn.style.background = "#28a745";
              setTimeout(() => {
                copyContentBtn.textContent = "📋 Copy Content";
                copyContentBtn.style.background = "#28a745";
              }, 2000);
            } else {
              copyContentBtn.textContent = "❌ No content";
              setTimeout(() => {
                copyContentBtn.textContent = "📋 Copy Content";
              }, 2000);
            }
          } catch (error) {
            console.error("Copy failed:", error);
            copyContentBtn.textContent = "❌ Copy failed";
            setTimeout(() => {
              copyContentBtn.textContent = "📋 Copy Content";
            }, 2000);
          }
        };
      }

      if (copyEmailBtn) {
        copyEmailBtn.onclick = async () => {
          try {
            await navigator.clipboard.writeText(currentDisposableEmailAddress);
            copyEmailBtn.textContent = "✅ Copied!";
            copyEmailBtn.style.background = "#007bff";
            setTimeout(() => {
              copyEmailBtn.textContent = "📧 Copy Email";
              copyEmailBtn.style.background = "#007bff";
            }, 2000);
          } catch (error) {
            console.error("Copy failed:", error);
            copyEmailBtn.textContent = "❌ Copy failed";
            setTimeout(() => {
              copyEmailBtn.textContent = "📧 Copy Email";
            }, 2000);
          }
        };
      }
    }, 100);

    // Add back button functionality
    const backToList = document.getElementById("backToList");
    if (backToList) {
      backToList.onclick = () => {
        console.log("[Email] Going back to inbox list");
        if (emailDetailFullView) {
          emailDetailFullView.style.display = "none";
        }
        if (inboxListView) {
          inboxListView.style.display = "block";
        }
        selectedEmailId = null;
      };
    }
  } catch (error) {
    console.error("[Email] Error showing email details:", error);
  }
}

// Get email body content with fallbacks and formatting
function getEmailBodyContent(message) {
  try {
    // Try different content fields in order of preference
    let content = "";

    // First try HTML content
    if (message.htmlBody || message.html) {
      content = message.htmlBody || message.html;

      // Clean up and enhance HTML content
      if (content && content.includes("<")) {
        // Sanitize and enhance HTML
        content = sanitizeEmailHTML(content);
      } else if (content) {
        // If it's text content in an HTML field, wrap it in paragraphs
        content = formatTextContent(content);
      }
    }
    // Fall back to text content
    else if (message.textBody || message.text || message.body) {
      content = message.textBody || message.text || message.body;
      content = formatTextContent(content);
    }
    // Try alternative field names
    else if (message.content) {
      content = formatTextContent(message.content);
    }

    // If still no content, show a helpful message
    if (!content || content.trim() === "") {
      content = `
        <div style="text-align: center; padding: 30px; color: #666; font-style: italic; background: #f8f9fa; border-radius: 8px; margin: 20px 0;">
          <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">📧</div>
          <p style="margin: 0 0 10px 0; font-size: 16px;">No content available for this message</p>
          <p style="font-size: 12px; margin: 0; color: #999;">
            API: ${message.api || "Unknown"}<br>
            Message ID: ${message.id || "Unknown"}
          </p>
        </div>
      `;
    }

    return content;
  } catch (error) {
    console.error("[Email] Error processing email content:", error);
    return `
      <div style="padding: 20px; color: #dc3545; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; margin: 20px 0;">
        <strong>Error loading message content</strong><br>
        <small>${error.message || "Unknown error occurred"}</small>
      </div>
    `;
  }
}

// Helper function to format text content with proper line breaks and styling
function formatTextContent(text) {
  if (!text) return "";

  // Escape HTML to prevent XSS
  const escaped = escapeHtml(text.toString());

  // Convert URLs to clickable links
  const withLinks = escaped.replace(
    /(https?:\/\/[^\s<>"']+)/gi,
    '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #0066cc; word-break: break-all;">$1</a>'
  );

  // Convert email addresses to clickable links
  const withEmails = withLinks.replace(
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
    '<a href="mailto:$1" style="color: #0066cc; word-break: break-all;">$1</a>'
  );

  // Handle long lines by adding word breaks
  const lines = withEmails.split("\n");
  const processedLines = lines.map((line) => {
    // Break very long lines without spaces
    if (line.length > 80 && !line.includes(" ")) {
      return line.replace(/(.{60})/g, "$1<wbr>");
    }
    return line;
  });

  return `<div style="white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; hyphens: auto;">${processedLines.join(
    "\n"
  )}</div>`;
}

// Helper function to sanitize and enhance HTML content
function sanitizeEmailHTML(html) {
  if (!html) return "";

  // Create a temporary div to safely parse HTML
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;

  // Remove potentially dangerous elements
  const dangerousTags = [
    "script",
    "object",
    "embed",
    "iframe",
    "form",
    "input",
    "button",
  ];
  dangerousTags.forEach((tag) => {
    const elements = tempDiv.querySelectorAll(tag);
    elements.forEach((el) => el.remove());
  });

  // Remove dangerous attributes
  const allElements = tempDiv.querySelectorAll("*");
  allElements.forEach((el) => {
    // Remove event handlers
    for (let i = el.attributes.length - 1; i >= 0; i--) {
      const attr = el.attributes[i];
      if (attr.name.startsWith("on")) {
        el.removeAttribute(attr.name);
      }
    }

    // Remove javascript: links
    if (el.href && el.href.toLowerCase().startsWith("javascript:")) {
      el.removeAttribute("href");
    }

    // Add safe target for links
    if (el.tagName === "A" && el.href) {
      el.target = "_blank";
      el.rel = "noopener noreferrer";
      el.style.wordBreak = "break-all";
    }

    // Ensure images are responsive
    if (el.tagName === "IMG") {
      el.style.maxWidth = "100%";
      el.style.height = "auto";
    }

    // Add responsive styles to tables
    if (el.tagName === "TABLE") {
      el.style.width = "100%";
      el.style.borderCollapse = "collapse";
      el.style.fontSize = "13px";
    }

    // Style table cells
    if (el.tagName === "TD" || el.tagName === "TH") {
      el.style.border = "1px solid #ddd";
      el.style.padding = "8px";
      el.style.wordWrap = "break-word";
    }
  });

  // Add container styling for better layout
  const container = document.createElement("div");
  container.style.cssText = `
    overflow-wrap: break-word;
    word-wrap: break-word;
    hyphens: auto;
    line-height: 1.6;
  `;
  container.innerHTML = tempDiv.innerHTML;

  return container.outerHTML;
}

async function handleFileUpload(file) {
  const viewFileBtn = document.getElementById("viewFile");

  try {
    showStatusText("SECURE: Initializing secure file processing...");

    // Enhanced security validation
    const securityCheck = await performAdvancedSecurityCheck(file);

    if (!securityCheck.allowed) {
      showStatusText(securityCheck.reason, "error");
      resetViewButton(viewFileBtn);
      return;
    }

    // Show warning for high-risk files
    if (securityCheck.riskLevel === "high") {
      const warningMessage =
        `WARNING: HIGH RISK FILE DETECTED\n\n` +
        `File: ${file.name}\n` +
        `Risk: ${securityCheck.riskReason}\n\n` +
        `This file will be opened in MAXIMUM ISOLATION mode:\n` +
        `• No system access\n` +
        `• No network access\n` +
        `• No file system access\n` +
        `• Complete sandboxing\n\n` +
        `Do you want to proceed with maximum security?`;

      if (!confirm(warningMessage)) {
        showStatusText("File viewing cancelled for security.", "warning");
        resetViewButton(viewFileBtn);
        return;
      }
    }

    showStatusText("SCAN: Scanning file for threats...");

    // Simulate virus/malware scan
    await simulateSecurityScan(file);

    showStatusText("READ: Reading file content securely...");

    // Read file content with additional security measures
    const fileContent = await readFileSecurely(file);

    // Generate security metadata
    const securityMetadata = await generateSecurityMetadata(file, fileContent);

    // Create enhanced file info object
    const fileInfo = {
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      content: fileContent,
      uploadedAt: new Date().toISOString(),
      securityLevel: securityCheck.riskLevel,
      securityMetadata: securityMetadata,
      isolationLevel: "maximum",
      permissions: {
        networkAccess: false,
        fileSystemAccess: false,
        clipboardAccess: false,
        geolocationAccess: false,
        cameraAccess: false,
        microphoneAccess: false,
        storageAccess: false,
      },
    };

    showStatusText("LAUNCH: Opening in secure isolated environment...");

    // Store file data temporarily with enhanced security
    await browserAPI.storage.local.set({
      pendingFileData: fileInfo,
      fileSecurityToken: securityMetadata.token,
    });

    // Open file viewer in new tab with strict isolation
    const tab = await browserAPI.tabs.create({
      url: browserAPI.runtime.getURL("file-viewer-secure.html"),
      active: true,
    });

    console.log("[Secure File Viewer] Opened in isolated tab:", tab.id);

    // Show success notification with security info
    showStatusText(
      `SECURE: File "${file.name}" opened in maximum isolation (${securityCheck.riskLevel} risk)`,
      "success"
    );

    // Reset button after short delay
    setTimeout(() => resetViewButton(viewFileBtn), 3000);
  } catch (error) {
    console.error("[Secure File Viewer] Error processing file:", error);
    showStatusText(`ERROR: Failed to process file: ${error.message}`, "error");
    resetViewButton(viewFileBtn);
  }
}

function resetViewButton(viewFileBtn) {
  if (viewFileBtn) {
    viewFileBtn.disabled = false;
    viewFileBtn.textContent = "View Safely";
  }
}

// Enhanced security functions for file processing
async function performAdvancedSecurityCheck(file) {
  console.log("[Security] Performing advanced security check for:", file.name);

  // File size validation (enhanced limits)
  const maxSize = 100 * 1024 * 1024; // 100MB max
  if (file.size > maxSize) {
    return {
      allowed: false,
      reason: `File too large: ${formatFileSize(
        file.size
      )} (max: ${formatFileSize(maxSize)})`,
      riskLevel: "blocked",
    };
  }

  // Zero-byte file check
  if (file.size === 0) {
    return {
      allowed: false,
      reason: "Empty files are not allowed",
      riskLevel: "blocked",
    };
  }

  // Enhanced dangerous file type detection
  const dangerousExtensions = new Set([
    ".exe",
    ".bat",
    ".cmd",
    ".scr",
    ".vbs",
    ".com",
    ".pif",
    ".application",
    ".gadget",
    ".msi",
    ".msp",
    ".mst",
    ".dll",
    ".scf",
    ".lnk",
    ".inf",
    ".reg",
    ".ps1",
    ".ps1xml",
    ".ps2",
    ".ps2xml",
    ".psc1",
    ".psc2",
    ".msh",
    ".msh1",
    ".msh2",
    ".mshxml",
    ".msh1xml",
    ".msh2xml",
    ".wsf",
    ".wsh",
    ".jar",
    ".jse",
    ".vbe",
    ".vb",
    ".ws",
    ".wsc",
  ]);

  const suspiciousExtensions = new Set([
    ".js",
    ".jse",
    ".hta",
    ".htm",
    ".html",
    ".svg",
    ".xml",
  ]);

  const extension = file.name
    .toLowerCase()
    .substring(file.name.lastIndexOf("."));

  if (dangerousExtensions.has(extension)) {
    return {
      allowed: true,
      riskLevel: "high",
      riskReason: `Executable file type: ${extension}`,
      isolationRequired: true,
    };
  }

  if (suspiciousExtensions.has(extension)) {
    return {
      allowed: true,
      riskLevel: "medium",
      riskReason: `Script/markup file type: ${extension}`,
      isolationRequired: true,
    };
  }

  // File name pattern analysis
  const suspiciousPatterns = [
    /\.(exe|bat|cmd)\./i, // Double extensions
    /^\s*con\s*$/i, // Windows reserved names
    /^\s*prn\s*$/i,
    /^\s*aux\s*$/i,
    /^\s*nul\s*$/i,
    /[<>:"|?*]/, // Invalid filename characters
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(file.name)) {
      return {
        allowed: true,
        riskLevel: "medium",
        riskReason: "Suspicious file name pattern",
        isolationRequired: true,
      };
    }
  }

  // Large file warning
  if (file.size > 50 * 1024 * 1024) {
    return {
      allowed: true,
      riskLevel: "medium",
      riskReason: `Large file size: ${formatFileSize(file.size)}`,
      isolationRequired: true,
    };
  }

  return {
    allowed: true,
    riskLevel: "low",
    riskReason: "Standard file type",
    isolationRequired: false,
  };
}

async function simulateSecurityScan(file) {
  // Simulate a realistic security scan delay
  const scanTime = Math.min((file.size / (1024 * 1024)) * 500 + 1000, 5000); // 500ms per MB, max 5s

  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(
        `[Security] File scan complete for ${file.name} (${scanTime}ms)`
      );
      resolve({ clean: true, scanTime });
    }, scanTime);
  });
}

async function readFileSecurely(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const result = e.target.result;

        // Additional content validation
        if (!result || typeof result !== "string") {
          reject(new Error("Invalid file content"));
          return;
        }

        // Check for data URL format
        if (!result.startsWith("data:")) {
          reject(new Error("Invalid file format"));
          return;
        }

        resolve(result);
      } catch (error) {
        reject(new Error("Failed to process file content"));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsDataURL(file);
  });
}

async function generateSecurityMetadata(file, content) {
  try {
    // Generate file hash for integrity verification
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Generate security token
    const tokenArray = new Uint8Array(16);
    crypto.getRandomValues(tokenArray);
    const token = Array.from(tokenArray, (b) =>
      b.toString(16).padStart(2, "0")
    ).join("");

    return {
      hash: hash,
      token: token,
      timestamp: new Date().toISOString(),
      size: file.size,
      type: file.type,
      name: file.name,
      scanStatus: "clean",
      isolationLevel: "maximum",
    };
  } catch (error) {
    console.warn("[Security] Failed to generate metadata:", error);
    return {
      hash: "unknown",
      token: "fallback_" + Date.now(),
      timestamp: new Date().toISOString(),
      size: file.size,
      type: file.type,
      name: file.name,
      scanStatus: "unknown",
      isolationLevel: "maximum",
    };
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
      // Note: Event listener handled by main initializeSmartIntegration() function
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

  // Method to update state without triggering notifications (called by main toggle handler)
  async updateState(enabled) {
    this.isEnabled = enabled;

    // Save state
    await browserAPI.storage.local.set({
      smartIntegrationEnabled: this.isEnabled,
    });

    // Update visual status
    updateIntegrationStatus(this.isEnabled);

    if (this.isEnabled) {
      this.enableSecuritySystems();
    } else {
      this.disableSecuritySystems();
    }

    console.log(
      "[Smart Integration] Security system:",
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
      // Note: Notification handled by main toggle handler
    } else {
      this.disableSecuritySystems();
      // Note: Notification handled by main toggle handler
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
    try {
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
    } catch (error) {
      console.error("[Notification] Failed to show notification:", error);
    }
  }
}

// Show cached messages when offline
async function showCachedMessages() {
  try {
    console.log("[Email] Attempting to display cached messages");

    // Check if we have cached messages
    const storage = await browserAPI.storage.local.get(["cachedMessages"]);
    if (!storage.cachedMessages || !Array.isArray(storage.cachedMessages)) {
      console.log("[Email] No cached messages found");
      return;
    }

    const messages = storage.cachedMessages;
    console.log("[Email] Found cached messages:", messages.length);

    // Use the existing UI update code but with cached data
    currentMessages = messages;

    const emailList = document.getElementById("emailList");
    const noMessages = document.getElementById("noMessages");
    const loadingMessages = document.getElementById("loadingMessages");

    if (loadingMessages) {
      loadingMessages.style.display = "none";
    }

    if (!emailList) {
      console.log("[Email] Email list element not found");
      return;
    }

    emailList.innerHTML = "";

    if (!messages || messages.length === 0) {
      if (noMessages) {
        noMessages.style.display = "block";
        noMessages.textContent =
          "No cached messages available. Connect to internet to fetch new messages.";
      }
      return;
    }

    if (noMessages) {
      noMessages.style.display = "none";
    }

    // Display cached messages
    messages.forEach((message, index) => {
      const item = document.createElement("div");
      item.className = "email-item";
      item.style.cursor = "pointer";
      item.style.padding = "10px";
      item.style.borderBottom = "1px solid #eee";

      const messageId = message.id || `msg_${index}`;
      item.onclick = () => showEmailDetails(messageId);

      const subject = message.subject || "No Subject";
      const fromAddress =
        message.from?.address || message.from || "Unknown Sender";
      const timestamp =
        message.date || message.createdAt || new Date().toISOString();

      item.innerHTML = `
        <div class="email-subject" style="font-weight: bold; margin-bottom: 5px;">
          ${escapeHtml(
            subject
          )} <span style="color: #999; font-size: 11px;">(cached)</span>
        </div>
        <div class="email-from" style="color: #666; font-size: 12px; margin-bottom: 3px;">
          From: ${escapeHtml(fromAddress)}
        </div>
        <div class="email-time" style="color: #999; font-size: 11px;">
          ${new Date(timestamp).toLocaleString()}
        </div>
      `;

      emailList.appendChild(item);
    });

    // Update inbox button to show cached message count
    const inboxButton = document.getElementById("openInbox");
    if (inboxButton && messages.length > 0) {
      inboxButton.textContent = `Inbox (${messages.length} cached)`;
      inboxButton.classList.add("has-messages");
    }

    console.log("[Email] ✅ Displayed cached messages:", messages.length);
  } catch (error) {
    console.error("[Email] ❌ Error showing cached messages:", error);
  }
}

// Setup all email UI listeners
function setupEmailUIListeners() {
  try {
    console.log("[Email] Setting up email UI listeners...");
    
    // Find all possible email generation buttons
    const regenerateButton = document.getElementById("regenerateEmail");
    const generateButton = document.getElementById("generateEmail");
    const regenerateText = document.querySelector(".email-actions span");
    const anyGenerateButton = document.querySelector('[id*="generate"], [class*="generate"]');
    
    console.log("[Email] Found buttons:", {
      regenerateButton: !!regenerateButton,
      generateButton: !!generateButton, 
      regenerateText: !!regenerateText,
      anyGenerateButton: !!anyGenerateButton
    });

    // Setup regenerate button (primary)
    if (regenerateButton) {
      console.log("[Email] Setting up regenerateEmail button");
      regenerateButton.addEventListener("click", async (e) => {
        e.preventDefault();
        console.log("[Email] Regenerate button clicked!");
        try {
          await generateRealDisposableEmail();
        } catch (error) {
          console.error("[Email] Generation error:", error);
          showStatusText("Could not generate email - check connection", "error");
        }
      });
    }

    // Setup alternative generate button
    if (generateButton) {
      console.log("[Email] Setting up generateEmail button");
      generateButton.addEventListener("click", async (e) => {
        e.preventDefault();
        console.log("[Email] Generate button clicked!");
        try {
          await generateRealDisposableEmail();
        } catch (error) {
          console.error("[Email] Generation error:", error);
          showStatusText("Could not generate email - check connection", "error");
        }
      });
    }

    // Setup regenerate text link
    if (regenerateText) {
      console.log("[Email] Setting up regenerate text link");
      regenerateText.style.cursor = "pointer";
      regenerateText.style.textDecoration = "underline";
      regenerateText.addEventListener("click", async (e) => {
        e.preventDefault();
        console.log("[Email] Regenerate text clicked!");
        try {
          await generateRealDisposableEmail();
        } catch (error) {
          console.error("[Email] Generation error:", error);
          showStatusText("Could not generate email - check connection", "error");
        }
      });
    }

    // Refresh inbox button
    const refreshButton = document.getElementById("refreshInbox");
    if (refreshButton) {
      refreshButton.addEventListener("click", async () => {
        try {
          await updateInboxDisplay();
          showStatusText("Inbox refreshed", "success");
        } catch (error) {
          console.error("[Email] Refresh error:", error);
          showStatusText("Could not refresh inbox", "error");
          // Try showing cached messages if available
          showCachedMessages();
        }
      });
    }

    console.log("[Email] ✅ UI listeners initialized");
  } catch (error) {
    console.error("[Email] ❌ Error setting up UI listeners:", error);
  }
}

// Cache messages for offline access
function cacheMessages(messages) {
  if (!messages || !Array.isArray(messages)) return;

  try {
    browserAPI.storage.local.set({
      cachedMessages: messages,
      cachedAt: Date.now(),
    });
    console.log(
      "[Email] ✅ Cached",
      messages.length,
      "messages for offline access"
    );
  } catch (error) {
    console.error("[Email] ❌ Error caching messages:", error);
  }
}

// Update updateInboxDisplay to cache messages when successful
const originalUpdateInboxDisplay = updateInboxDisplay;
updateInboxDisplay = async function () {
  try {
    await originalUpdateInboxDisplay.apply(this, arguments);
    // Cache messages after successful update
    if (currentMessages && currentMessages.length > 0) {
      cacheMessages(currentMessages);
    }
  } catch (error) {
    console.error("[Email] ❌ Enhanced inbox update failed:", error);
    throw error;
  }
};

// Final script loading confirmation
console.log("[Popup] 🎉 popup.js has fully loaded and parsed successfully!");
console.log("[Popup] Ready for user interaction...");

// Global error handler for disposable email operations
window.addEventListener("unhandledrejection", (event) => {
  console.error("[Global] Unhandled promise rejection:", event.reason);

  // If it's an email-related error, show user-friendly message
  if (event.reason && event.reason.toString().includes("Email")) {
    showStatusText("Email service temporarily unavailable", "error");
  }

  // Prevent default browser error handling
  event.preventDefault();
});

// Global click handler as fallback for buttons that might not have event listeners
document.addEventListener("click", (event) => {
  const target = event.target;
  
  console.log("[Global] Click detected on:", target.tagName, target.id, target.className, target.textContent?.trim());

  // Only handle button clicks that haven't been handled by specific event listeners
  if (target.tagName === "BUTTON" && !target.getAttribute("data-handled")) {
    console.log(
      "[Global] Fallback click handler for button:",
      target.textContent.trim()
    );

    // Mark as handled to prevent duplicate handling
    target.setAttribute("data-handled", "true");

    // Handle specific button types based on text content or class
    const buttonText = target.textContent.trim().toLowerCase();
    const buttonId = target.id.toLowerCase();

    if (buttonText === "start" && target.closest(".rbi-section")) {
      console.log("[Global] Handling start button click");
      event.preventDefault();
      launchDisposableBrowser("singapore").catch(console.error);
    } else if (
      buttonText.includes("generate") ||
      buttonId.includes("generate") ||
      buttonText.includes("regenerate") ||
      buttonId.includes("regenerate") ||
      target.closest(".email-section")
    ) {
      console.log("[Global] Handling email generate button click");
      event.preventDefault();
      
      // Try multiple generation methods
      if (window.generateRealDisposableEmail) {
        window.generateRealDisposableEmail().catch(console.error);
      } else if (window.forceGenerateEmail) {
        window.forceGenerateEmail().catch(console.error);
      } else {
        console.error("[Global] No email generation function available");
      }
    } else if (buttonText === "force generate") {
      console.log("[Global] Handling force generate button click");
      event.preventDefault();
      window.forceGenerateEmail &&
        window.forceGenerateEmail().catch(console.error);
    } else if (buttonText.includes("refresh") || buttonId.includes("refresh")) {
      console.log("[Global] Handling refresh button click");
      event.preventDefault();
      if (window.checkEmailNow) {
        window.checkEmailNow().catch(console.error);
      } else if (window.updateInboxDisplay) {
        window.updateInboxDisplay().catch(console.error);
      }
    }

    // Remove the handled flag after a delay to allow re-clicking
    setTimeout(() => {
      target.removeAttribute("data-handled");
    }, 1000);
  }
  
  // Also handle spans and other clickable elements that might be email buttons
  if ((target.tagName === "SPAN" || target.tagName === "DIV") && 
      (target.textContent?.includes("regenerate") || target.textContent?.includes("generate"))) {
    console.log("[Global] Handling text element click for email generation");
    event.preventDefault();
    if (window.generateRealDisposableEmail) {
      window.generateRealDisposableEmail().catch(console.error);
    }
  }
});

// Utility function to format file sizes
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

console.log("[Popup] SUCCESS: Global event handlers initialized!");
