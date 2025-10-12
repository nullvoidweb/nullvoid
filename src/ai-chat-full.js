// NULL VOID AI Chat - Free AI Assistant v2.0
// Advanced AI chat interface
console.log("[NULL VOID AI] Loading free AI assistant v2.0");

// Use browser-specific API namespace
const browserAPI =
  typeof browser !== "undefined"
    ? browser
    : typeof chrome !== "undefined"
    ? chrome
    : null;

// Enhanced AI Configuration
const AI_CONFIG = {
  apiKey: "AIzaSyB-j8iXAEg_W-I2l3PodnJMoO_wgai2VDU",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta",
  model: "gemini-2.5-flash",
  maxTokens: 8000,
  temperature: 0.7,
};

// Global state
let chatHistory = [];
let isAIResponding = false;
let isChatMode = false;
let currentChatId = null;
let allChats = {};
let settings = {
  temperature: 0.7,
  maxTokens: 8000,
  autoSave: true,
  darkMode: true,
};

// User-friendly system prompt for end-users
const SYSTEM_PROMPT = `You are NULL VOID AI, a helpful assistant for the NULL VOID browser extension. You help users stay safe online and use the extension's features effectively.

🛡️ YOUR ROLE:
- Help users understand and use NULL VOID extension features
- Provide simple, easy-to-follow security advice
- Offer user-friendly troubleshooting steps
- Keep users safe while browsing the internet

🎯 NULL VOID EXTENSION FEATURES YOU HELP WITH:

Disposable Browser:
A secure way to browse suspicious or unknown websites. It keeps your main computer safe from malware and viruses by acting like a protective bubble around dangerous sites.

AI Security Assistant:
That's you! Ready to answer questions and provide guidance, help with cybersecurity advice and safe browsing tips, and explain extension features in simple terms.

Temporary Email:
Create disposable email addresses for online registrations. This protects your real email from spam and tracking, and is perfect for one-time signups or testing services.

Smart Protection:
Automatically blocks malicious websites and content, warns you about phishing attempts and scams, and works quietly in the background to keep you safe.

Secure File Viewer:
Safely preview documents and files. This prevents malicious files from harming your computer by showing content without running dangerous code.

🎯 CRITICAL FORMATTING RULES - MUST FOLLOW EXACTLY:
- NEVER use asterisks (*) anywhere in your response
- NEVER use markdown formatting like **bold** or *italic*
- NEVER use ### headers or # titles
- NEVER use backticks or code blocks
- NEVER use special formatting characters
- Write everything in plain, natural text
- Use simple hyphens (-) for bullet points only when listing steps
- Use normal paragraph breaks for spacing
- Write like you're speaking to a friend, not writing documentation

🎯 HOW TO RESPOND:
- Use simple, clear language that anyone can understand
- Focus on what users need to do, not technical details
- Give step-by-step instructions using the extension interface
- Never mention internal files, code, or technical implementation
- Always prioritize user safety and privacy
- Be encouraging and helpful, not intimidating
- Format responses as natural, readable text without any special characters

⚠️ ABSOLUTE REQUIREMENTS:
- NO technical file names or code references
- NO internal configuration details
- NO developer jargon or programming terms
- NO asterisks (*) anywhere in your response
- NO markdown formatting of any kind
- NO special characters for formatting
- Focus on user interface and visible features
- Explain benefits and safety, not how things work internally
- Keep explanations simple and actionable
- Write like you're having a friendly conversation

REMEMBER: Every time you use an asterisk (*), markdown formatting (**text**), or headers (###), you make the response harder to read. Write everything in plain, natural sentences that flow like normal conversation.`;

// Initialize when DOM is ready (only in browser environment)
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    console.log("[NULL VOID AI] Interface loading...");
    initializeInterface();
    setupEventListeners();
    console.log("[NULL VOID AI] Interface ready");
  });
}

function initializeInterface() {
  // Load settings and chat history
  loadSettings();
  loadAllChats();
  loadChatHistory();

  // Auto-resize textarea and handle send button
  const chatInput = document.getElementById("chatInput");
  if (chatInput) {
    chatInput.addEventListener("input", handleInputChange);
  }

  // Update recent chats display
  updateRecentChats();
}

function setupEventListeners() {
  // Chat input
  const chatInput = document.getElementById("chatInput");
  if (chatInput) {
    chatInput.addEventListener("keydown", handleInputKeydown);
  }

  // Send button
  const sendBtn = document.getElementById("sendBtn");
  if (sendBtn) {
    sendBtn.addEventListener("click", handleSendMessage);
  }

  // New chat button
  const newChatBtn = document.getElementById("newChatBtn");
  if (newChatBtn) {
    newChatBtn.addEventListener("click", handleNewChat);
  }

  // Suggestion pills
  const suggestionPills = document.querySelectorAll(".suggestion-pill");
  suggestionPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      const prompt = pill.getAttribute("data-prompt");
      handleSuggestionClick(prompt);
    });
  });

  // Hamburger menu (sidebar toggle when hidden)
  const hamburgerMenu = document.getElementById("hamburgerMenu");
  if (hamburgerMenu) {
    hamburgerMenu.addEventListener("click", toggleSidebar);
  }

  // Search icon
  const searchIcon = document.querySelector(".search-icon");
  if (searchIcon) {
    searchIcon.addEventListener("click", toggleSearch);
  }

  // Settings button
  const settingsBtn = document.getElementById("settingsBtn");
  if (settingsBtn) {
    settingsBtn.addEventListener("click", openSettings);
  }

  // About button
  const aboutBtn = document.querySelector(".about-btn");
  if (aboutBtn) {
    aboutBtn.addEventListener("click", openAbout);
  }

  // Model selector
  const modelSelector = document.getElementById("modelSelector");
  if (modelSelector) {
    modelSelector.addEventListener("click", handleModelSelector);
    modelSelector.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleModelSelector();
      }
    });
  }

  // Settings panel events
  setupSettingsEvents();

  // Modal events
  setupModalEvents();

  // Search events
  setupSearchEvents();
}

function handleInputKeydown(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
}

function handleInputChange() {
  autoResizeTextarea.call(this);

  // Show/hide send button based on input
  const sendBtn = document.getElementById("sendBtn");
  const hasText = this.value.trim().length > 0;

  if (sendBtn) {
    sendBtn.disabled = !hasText || isAIResponding;
    if (hasText && !isAIResponding) {
      sendBtn.classList.add("active");
    } else {
      sendBtn.classList.remove("active");
    }
  }
}

async function handleSendMessage() {
  const chatInput = document.getElementById("chatInput");

  if (!chatInput || !chatInput.value.trim() || isAIResponding) {
    return;
  }

  const userMessage = chatInput.value.trim();
  chatInput.value = "";
  autoResizeTextarea.call(chatInput);

  // Switch to chat mode if not already
  if (!isChatMode) {
    switchToChatMode();
  }

  try {
    isAIResponding = true;

    // Add user message
    addMessage(userMessage, true);

    // Show typing indicator
    showTypingIndicator();

    // Get AI response
    const rawAIResponse = await getAIResponse(userMessage);

    // Clean up formatting in AI response
    const aiResponse = cleanResponseFormatting(rawAIResponse);

    // Remove typing indicator
    hideTypingIndicator();

    // Add AI response
    addMessage(aiResponse, false);

    // Save chat history
    saveChatHistory();
  } catch (error) {
    console.error("[NULL VOID AI] Error:", error);
    hideTypingIndicator();

    let errorMessage =
      "I apologize, but I encountered an error. Please try again.";

    if (error.message.includes("API Error: 429")) {
      errorMessage =
        "Rate limit exceeded. Please wait a moment before trying again.";
    } else if (error.message.includes("API Error: 403")) {
      errorMessage =
        "API access denied. Please check your API key configuration.";
    } else if (error.message.includes("API Error: 400")) {
      errorMessage = "Invalid request. Please try rephrasing your message.";
    } else if (error.message.includes("Failed to fetch")) {
      errorMessage = "Network error. Please check your internet connection.";
    } else if (error.message.includes("SAFETY")) {
      errorMessage =
        "Content was blocked by safety filters. Please try a different message.";
    }

    // Log the full error for debugging
    console.error("[NULL VOID AI] Full error details:", {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    addMessage(errorMessage, false, true);
    showNotification(errorMessage, "error");
  } finally {
    isAIResponding = false;
    chatInput.focus();

    // Update send button state
    const sendBtn = document.getElementById("sendBtn");
    if (sendBtn) {
      sendBtn.disabled = chatInput.value.trim().length === 0;
      if (chatInput.value.trim().length === 0) {
        sendBtn.classList.remove("active");
      }
    }
  }
}

async function getAIResponse(userMessage) {
  try {
    // Enhanced security-focused message processing
    const enhancedMessage = processSecurityContext(userMessage);

    // Prepare conversation history with security context
    const conversationHistory = chatHistory.slice(-8).map((msg) => ({
      role: msg.isUser ? "user" : "model",
      parts: [{ text: msg.text }],
    }));

    // Enhanced message structure with security context
    const messages = [
      {
        role: "user",
        parts: [{ text: SYSTEM_PROMPT }],
      },
      {
        role: "user",
        parts: [
          {
            text: `SECURITY CONTEXT: User is asking about: "${userMessage}". Analyze for security implications and provide NULL VOID-specific guidance.`,
          },
        ],
      },
      ...conversationHistory,
      {
        role: "user",
        parts: [{ text: enhancedMessage }],
      },
    ];

    const requestBody = {
      contents: messages,
      generationConfig: {
        temperature: 0.3, // Lower temperature for more precise security responses
        maxOutputTokens: settings.maxTokens,
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
          threshold: "BLOCK_ONLY_HIGH", // Less restrictive for security discussions
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
      throw new Error(`AI API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Enhanced response validation
    if (!data) {
      throw new Error("Empty response from AI API");
    }

    if (data.error) {
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
    console.error("[NULL VOID AI] API Error:", error);
    throw error;
  }
}

function addMessage(text, isUser = false, isError = false) {
  // Add to UI
  addMessageToUI(text, isUser, isError);

  // Add to history
  chatHistory.push({
    text: text,
    isUser: isUser,
    timestamp: Date.now(),
  });

  // Create chat ID if this is the first message
  if (!currentChatId && chatHistory.length === 1) {
    currentChatId = generateChatId();
  }
}

function formatAIResponse(text) {
  // Enhanced formatting for AI responses
  let formatted = text;

  // Convert markdown-style headers
  formatted = formatted.replace(/^### (.*$)/gm, "<h3>$1</h3>");
  formatted = formatted.replace(/^## (.*$)/gm, "<h2>$1</h2>");
  formatted = formatted.replace(/^# (.*$)/gm, "<h1>$1</h1>");

  // Convert bold text
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Convert italic text
  formatted = formatted.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Convert inline code
  formatted = formatted.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Convert code blocks
  formatted = formatted.replace(
    /```([\s\S]*?)```/g,
    "<pre><code>$1</code></pre>"
  );

  // Convert bullet points
  formatted = formatted.replace(/^- (.*$)/gm, "<li>$1</li>");
  formatted = formatted.replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>");

  // Convert numbered lists
  formatted = formatted.replace(/^\d+\. (.*$)/gm, "<li>$1</li>");

  // Convert paragraphs (split by double newlines)
  const paragraphs = formatted.split(/\n\s*\n/);
  formatted = paragraphs
    .map((p) => {
      p = p.trim();
      if (p && !p.startsWith("<")) {
        return `<p>${p}</p>`;
      }
      return p;
    })
    .join("\n");

  return formatted;
}

function showTypingIndicator() {
  const chatMessages = document.getElementById("chatMessages");
  if (!chatMessages) return;

  const typingDiv = document.createElement("div");
  typingDiv.id = "typingIndicator";
  typingDiv.className = "message";
  typingDiv.innerHTML = `
    <div class="message-avatar ai-avatar">AI</div>
    <div class="message-content">
      <div class="typing-indicator">
        <div class="typing-dots">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    </div>
  `;

  chatMessages.appendChild(typingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
  const indicator = document.getElementById("typingIndicator");
  if (indicator) {
    indicator.remove();
  }
}

function switchToChatMode() {
  isChatMode = true;
  document.body.classList.add("chat-mode");

  // Focus input
  const chatInput = document.getElementById("chatInput");
  if (chatInput) {
    chatInput.focus();
  }
}

function handleSuggestionClick(prompt) {
  const chatInput = document.getElementById("chatInput");
  if (chatInput) {
    chatInput.value = `Help me ${prompt.toLowerCase()}`;
    chatInput.focus();
    handleInputChange.call(chatInput);
  }
}

function handleNewChat() {
  // Save current chat if it has messages
  if (chatHistory.length > 0 && settings.autoSave) {
    saveCurrentChat();
  }

  // Create new chat
  currentChatId = generateChatId();
  chatHistory = [];
  isChatMode = false;
  document.body.classList.remove("chat-mode");

  // Clear chat display
  const chatMessages = document.getElementById("chatMessages");
  if (chatMessages) {
    chatMessages.innerHTML = "";
  }

  // Clear input
  const chatInput = document.getElementById("chatInput");
  if (chatInput) {
    chatInput.value = "";
    handleInputChange.call(chatInput);
  }

  // Update recent chats
  updateRecentChats();

  console.log("[NULL VOID AI] New chat started");
}

// UI Functions
function toggleSidebar() {
  const sidebar = document.querySelector(".sidebar");
  const mainContent = document.querySelector(".main-content");

  if (sidebar && mainContent) {
    const isVisible = sidebar.classList.contains("visible");

    if (isVisible) {
      // Hide sidebar
      sidebar.classList.remove("visible");
      mainContent.classList.remove("sidebar-visible");
    } else {
      // Show sidebar
      sidebar.classList.add("visible");
      mainContent.classList.add("sidebar-visible");
    }
  }
}

function toggleSearch() {
  const searchPanel = document.getElementById("searchPanel");
  const searchInput = document.getElementById("searchInput");

  if (searchPanel) {
    searchPanel.classList.toggle("open");
    if (searchPanel.classList.contains("open") && searchInput) {
      searchInput.focus();
    }
  }
}

function openSettings() {
  const settingsPanel = document.getElementById("settingsPanel");
  if (settingsPanel) {
    settingsPanel.classList.add("open");
    updateSettingsUI();
  }
}

function closeSettings() {
  const settingsPanel = document.getElementById("settingsPanel");
  if (settingsPanel) {
    settingsPanel.classList.remove("open");
  }
}

function openAbout() {
  const aboutModal = document.getElementById("aboutModal");
  if (aboutModal) {
    aboutModal.classList.add("open");
  }
}

function closeAbout() {
  const aboutModal = document.getElementById("aboutModal");
  if (aboutModal) {
    aboutModal.classList.remove("open");
  }
}

function handleModelSelector() {
  const dropdown = document.getElementById("modelDropdown");
  const selector = document.getElementById("modelSelector");

  if (dropdown && selector) {
    const isOpen = dropdown.classList.contains("open");

    if (isOpen) {
      dropdown.classList.remove("open");
      selector.classList.remove("open");
      selector.setAttribute("aria-expanded", "false");
    } else {
      dropdown.classList.add("open");
      selector.classList.add("open");
      selector.setAttribute("aria-expanded", "true");
    }
  }

  // Setup model option click handlers if not already done
  const modelOptions = document.querySelectorAll(".model-option");
  modelOptions.forEach((option) => {
    if (!option.hasAttribute("data-listener")) {
      option.setAttribute("data-listener", "true");
      option.addEventListener("click", () => {
        const modelId = option.dataset.model;
        const modelName = option.querySelector(".model-name").textContent;
        selectModel(modelId, modelName);
      });

      // Add keyboard support for options
      option.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const modelId = option.dataset.model;
          const modelName = option.querySelector(".model-name").textContent;
          selectModel(modelId, modelName);
        }
      });
    }
  });
}

function selectModel(modelId, modelName) {
  const selector = document.getElementById("modelSelector");

  // Show loading state
  if (selector) {
    selector.classList.add("loading");
  }

  // Small delay to show loading state
  setTimeout(() => {
    AI_CONFIG.model = modelId;

    // Update UI
    const currentModelSpan = document.getElementById("currentModel");
    const modelSubtitle = document.querySelector(".model-subtitle");

    if (currentModelSpan) {
      currentModelSpan.textContent = "NULL VOID AI";
    }

    if (modelSubtitle) {
      modelSubtitle.textContent = `Powered by ${modelName}`;
    }

    // Update dropdown selection
    const options = document.querySelectorAll(".model-option");
    options.forEach((option) => {
      option.classList.remove("selected");
      if (option.dataset.model === modelId) {
        option.classList.add("selected");
      }
    });

    // Close dropdown
    const dropdown = document.getElementById("modelDropdown");

    if (dropdown) {
      dropdown.classList.remove("open");
    }

    if (selector) {
      selector.classList.remove("open", "loading");
      selector.setAttribute("aria-expanded", "false");
    }

    // Save settings
    saveSettings();

    // Show notification with more friendly message
    const modelDisplayName =
      modelId === "gemini-1.5-flash" ? "Fast Mode" : "Pro Mode";
    showNotification(`AI model switched to ${modelDisplayName}`, "success");
  }, 300);
}

function autoResizeTextarea() {
  this.style.height = "auto";
  this.style.height = Math.min(this.scrollHeight, 200) + "px";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Settings Functions
function setupSettingsEvents() {
  const closeSettings = document.getElementById("closeSettings");
  if (closeSettings) {
    closeSettings.addEventListener("click", () => {
      document.getElementById("settingsPanel").classList.remove("open");
    });
  }

  const temperatureSlider = document.getElementById("temperatureSlider");
  if (temperatureSlider) {
    temperatureSlider.addEventListener("input", (e) => {
      settings.temperature = parseFloat(e.target.value);
      document.getElementById("temperatureValue").textContent = e.target.value;
      saveSettings();
    });
  }

  const maxTokens = document.getElementById("maxTokens");
  if (maxTokens) {
    maxTokens.addEventListener("change", (e) => {
      settings.maxTokens = parseInt(e.target.value);
      saveSettings();
    });
  }

  const autoSaveToggle = document.getElementById("autoSaveToggle");
  if (autoSaveToggle) {
    autoSaveToggle.addEventListener("click", () => {
      settings.autoSave = !settings.autoSave;
      updateSettingsUI();
      saveSettings();
    });
  }

  const darkModeToggle = document.getElementById("darkModeToggle");
  if (darkModeToggle) {
    darkModeToggle.addEventListener("click", () => {
      settings.darkMode = !settings.darkMode;
      updateSettingsUI();
      saveSettings();
      applyTheme();
    });
  }

  const clearAllData = document.getElementById("clearAllData");
  if (clearAllData) {
    clearAllData.addEventListener("click", handleClearAllData);
  }

  const exportData = document.getElementById("exportData");
  if (exportData) {
    exportData.addEventListener("click", handleExportData);
  }
}

function setupModalEvents() {
  const closeAbout = document.getElementById("closeAbout");
  if (closeAbout) {
    closeAbout.addEventListener("click", () => {
      document.getElementById("aboutModal").classList.remove("open");
    });
  }

  // Close modal when clicking overlay
  const aboutModal = document.getElementById("aboutModal");
  if (aboutModal) {
    aboutModal.addEventListener("click", (e) => {
      if (e.target === aboutModal) {
        aboutModal.classList.remove("open");
      }
    });
  }
}

function setupSearchEvents() {
  const searchClose = document.getElementById("searchClose");
  if (searchClose) {
    searchClose.addEventListener("click", () => {
      document.getElementById("searchPanel").classList.remove("open");
    });
  }

  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", handleSearch);
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.getElementById("searchPanel").classList.remove("open");
      }
    });
  }
}

function updateSettingsUI() {
  const temperatureSlider = document.getElementById("temperatureSlider");
  const temperatureValue = document.getElementById("temperatureValue");
  const maxTokens = document.getElementById("maxTokens");
  const autoSaveSwitch = document.getElementById("autoSaveSwitch");
  const darkModeSwitch = document.getElementById("darkModeSwitch");

  if (temperatureSlider) temperatureSlider.value = settings.temperature;
  if (temperatureValue) temperatureValue.textContent = settings.temperature;
  if (maxTokens) maxTokens.value = settings.maxTokens;

  if (autoSaveSwitch) {
    autoSaveSwitch.classList.toggle("active", settings.autoSave);
  }

  if (darkModeSwitch) {
    darkModeSwitch.classList.toggle("active", settings.darkMode);
  }
}

function handleClearAllData() {
  if (
    confirm("Are you sure you want to clear all data? This cannot be undone.")
  ) {
    if (confirm("This will delete all conversations and settings. Continue?")) {
      // Clear all data
      chatHistory = [];
      allChats = {};
      currentChatId = null;

      // Reset to defaults
      settings = {
        temperature: 0.7,
        maxTokens: 8000,
        autoSave: true,
        darkMode: true,
      };

      // Clear UI
      const chatMessages = document.getElementById("chatMessages");
      if (chatMessages) chatMessages.innerHTML = "";

      const chatInput = document.getElementById("chatInput");
      if (chatInput) {
        chatInput.value = "";
        handleInputChange.call(chatInput);
      }

      // Reset mode
      isChatMode = false;
      document.body.classList.remove("chat-mode");

      // Save and update
      saveAllData();
      updateRecentChats();
      updateSettingsUI();

      showNotification("All data cleared successfully.", "success");
    }
  }
}

function handleExportData() {
  const exportData = {
    chats: allChats,
    currentChat: {
      id: currentChatId,
      history: chatHistory,
    },
    settings: settings,
    exportDate: new Date().toISOString(),
  };

  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(dataBlob);
  link.download = `nullvoid-ai-export-${
    new Date().toISOString().split("T")[0]
  }.json`;
  link.click();

  URL.revokeObjectURL(link.href);
  showNotification("Data exported successfully!", "success");
}

function handleSearch(e) {
  const query = e.target.value.toLowerCase();
  const recentChats = document.getElementById("recentChats");

  if (!recentChats) return;

  const chatElements = recentChats.querySelectorAll(".recent-chat");

  chatElements.forEach((element) => {
    const text = element.textContent.toLowerCase();
    if (text.includes(query) || query === "") {
      element.style.display = "block";
    } else {
      element.style.display = "none";
    }
  });
}

// Chat Management Functions
function generateChatId() {
  return (
    "chat_" + Date.now() + "_" + Math.random().toString(36).substring(2, 11)
  );
}

function saveCurrentChat() {
  if (!currentChatId || chatHistory.length === 0) return;

  const firstMessage = chatHistory.find((msg) => msg.isUser);
  const title = firstMessage
    ? firstMessage.text.substring(0, 50) +
      (firstMessage.text.length > 50 ? "..." : "")
    : "New Chat";

  allChats[currentChatId] = {
    id: currentChatId,
    title: title,
    messages: [...chatHistory],
    lastUpdated: Date.now(),
    messageCount: chatHistory.length,
  };

  saveAllChats();
}

function loadChat(chatId) {
  if (!allChats[chatId]) return;

  // Save current chat first
  if (currentChatId && chatHistory.length > 0) {
    saveCurrentChat();
  }

  // Load selected chat
  const chat = allChats[chatId];
  currentChatId = chatId;
  chatHistory = [...chat.messages];

  // Clear and rebuild UI
  const chatMessages = document.getElementById("chatMessages");
  if (chatMessages) {
    chatMessages.innerHTML = "";
    chatHistory.forEach((msg) => {
      addMessageToUI(msg.text, msg.isUser);
    });
  }

  // Switch to chat mode if has messages
  if (chatHistory.length > 0) {
    switchToChatMode();
  }

  // Update recent chats display
  updateRecentChats();
}

function updateRecentChats() {
  const recentChats = document.getElementById("recentChats");
  if (!recentChats) return;

  // Sort chats by last updated
  const sortedChats = Object.values(allChats)
    .sort((a, b) => b.lastUpdated - a.lastUpdated)
    .slice(0, 10); // Show only last 10

  recentChats.innerHTML = "";

  sortedChats.forEach((chat) => {
    const chatElement = document.createElement("div");
    chatElement.className = "recent-chat";
    if (chat.id === currentChatId) {
      chatElement.classList.add("active");
    }

    chatElement.textContent = chat.title;
    chatElement.title = `${chat.messageCount} messages • ${new Date(
      chat.lastUpdated
    ).toLocaleDateString()}`;

    chatElement.addEventListener("click", () => {
      loadChat(chat.id);
    });

    recentChats.appendChild(chatElement);
  });
}

function addMessageToUI(text, isUser = false, isError = false) {
  const chatMessages = document.getElementById("chatMessages");
  if (!chatMessages) return;

  const messageDiv = document.createElement("div");
  messageDiv.className = "message";

  const avatarClass = isUser ? "user-avatar" : "ai-avatar";
  const avatarText = isUser ? "U" : "AI";
  const formattedText = isUser ? escapeHtml(text) : formatAIResponse(text);

  messageDiv.innerHTML = `
    <div class="message-avatar ${avatarClass}">${avatarText}</div>
    <div class="message-content">
      <div class="message-text ${isError ? "error" : ""}">${formattedText}</div>
    </div>
  `;

  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Animate message
  messageDiv.style.opacity = "0";
  messageDiv.style.transform = "translateY(20px)";
  setTimeout(() => {
    messageDiv.style.opacity = "1";
    messageDiv.style.transform = "translateY(0)";
    messageDiv.style.transition = "all 0.3s ease";
  }, 50);
}

function applyTheme() {
  // Theme switching functionality can be added here
  // For now, we'll keep the dark theme as default
}

// Storage Functions
async function saveSettings() {
  try {
    if (browserAPI && browserAPI.storage) {
      await browserAPI.storage.local.set({
        nullvoidAiSettings: settings,
      });
    } else {
      // Fallback to localStorage
      localStorage.setItem("nullvoidAiSettings", JSON.stringify(settings));
    }
  } catch (error) {
    console.error("[NULL VOID AI] Failed to save settings:", error);
  }
}

async function loadSettings() {
  try {
    if (browserAPI && browserAPI.storage) {
      const storage = await browserAPI.storage.local.get([
        "nullvoidAiSettings",
      ]);
      if (storage.nullvoidAiSettings) {
        settings = { ...settings, ...storage.nullvoidAiSettings };
      }
    } else {
      // Fallback to localStorage
      const stored = localStorage.getItem("nullvoidAiSettings");
      if (stored) {
        settings = { ...settings, ...JSON.parse(stored) };
      }
    }
  } catch (error) {
    console.error("[NULL VOID AI] Failed to load settings:", error);
  }
}

async function saveAllChats() {
  try {
    if (browserAPI && browserAPI.storage) {
      await browserAPI.storage.local.set({
        nullvoidAiAllChats: allChats,
      });
    } else {
      localStorage.setItem("nullvoidAiAllChats", JSON.stringify(allChats));
    }
  } catch (error) {
    console.error("[NULL VOID AI] Failed to save chats:", error);
  }
}

async function loadAllChats() {
  try {
    if (browserAPI && browserAPI.storage) {
      const storage = await browserAPI.storage.local.get([
        "nullvoidAiAllChats",
      ]);
      if (storage.nullvoidAiAllChats) {
        allChats = storage.nullvoidAiAllChats;
      }
    } else {
      const stored = localStorage.getItem("nullvoidAiAllChats");
      if (stored) {
        allChats = JSON.parse(stored);
      }
    }
  } catch (error) {
    console.error("[NULL VOID AI] Failed to load chats:", error);
  }
}

async function saveChatHistory() {
  try {
    const data = {
      nullvoidAiChatHistory: chatHistory,
      nullvoidAiChatMode: isChatMode,
      nullvoidAiCurrentChatId: currentChatId,
    };

    if (browserAPI && browserAPI.storage) {
      await browserAPI.storage.local.set(data);
    } else {
      Object.keys(data).forEach((key) => {
        localStorage.setItem(key, JSON.stringify(data[key]));
      });
    }

    // Auto-save current chat if enabled
    if (settings.autoSave && chatHistory.length > 0) {
      saveCurrentChat();
    }
  } catch (error) {
    console.error("[NULL VOID AI] Failed to save history:", error);
  }
}

async function saveAllData() {
  await Promise.all([saveSettings(), saveAllChats(), saveChatHistory()]);
}

async function loadChatHistory() {
  try {
    let storage = {};

    if (browserAPI && browserAPI.storage) {
      storage = await browserAPI.storage.local.get([
        "nullvoidAiChatHistory",
        "nullvoidAiChatMode",
        "nullvoidAiCurrentChatId",
      ]);
    } else {
      // Fallback to localStorage
      const keys = [
        "nullvoidAiChatHistory",
        "nullvoidAiChatMode",
        "nullvoidAiCurrentChatId",
      ];
      keys.forEach((key) => {
        const stored = localStorage.getItem(key);
        if (stored) {
          storage[key] = JSON.parse(stored);
        }
      });
    }

    if (storage.nullvoidAiCurrentChatId) {
      currentChatId = storage.nullvoidAiCurrentChatId;
    }

    if (storage.nullvoidAiChatHistory) {
      chatHistory = storage.nullvoidAiChatHistory;

      // Restore messages if any
      if (chatHistory.length > 0) {
        const chatMessages = document.getElementById("chatMessages");
        if (chatMessages) {
          chatHistory.forEach((msg) => {
            addMessageToUI(msg.text, msg.isUser);
          });
        }
      }
    }

    if (storage.nullvoidAiChatMode) {
      isChatMode = storage.nullvoidAiChatMode;
      if (isChatMode) {
        switchToChatMode();
      }
    }
  } catch (error) {
    console.error("[NULL VOID AI] Failed to load history:", error);
  }
}

// Notification system
function showNotification(message, type = "info") {
  // Remove existing notification
  const existingNotification = document.querySelector(".notification");
  if (existingNotification) {
    existingNotification.remove();
  }

  // Create new notification
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;

  document.body.appendChild(notification);

  // Show notification
  setTimeout(() => {
    notification.classList.add("show");
  }, 100);

  // Hide notification after 3 seconds
  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 300);
  }, 3000);
}

// Close dropdowns when clicking outside (only in browser environment)
if (typeof document !== "undefined") {
  document.addEventListener("click", (e) => {
    const modelDropdown = document.getElementById("modelDropdown");
    const modelSelector = document.getElementById("modelSelector");

    if (modelDropdown && modelSelector && !modelSelector.contains(e.target)) {
      modelDropdown.classList.remove("open");
      modelSelector.classList.remove("open");
    }
  });
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

// User-friendly context processing function
function processSecurityContext(userMessage) {
  const message = userMessage.toLowerCase();
  let userContext = "";
  let urgencyLevel = "NORMAL";

  // Detect what user needs help with
  const helpTopics = {
    threats: [
      "malware",
      "virus",
      "phishing",
      "scam",
      "hack",
      "suspicious",
      "unsafe",
    ],
    extension_issues: [
      "not working",
      "error",
      "broken",
      "fix",
      "problem",
      "help",
      "issue",
    ],
    features: [
      "disposable browser",
      "temporary email",
      "ai chat",
      "secure",
      "protection",
    ],
    browsing: ["safe browsing", "website", "download", "link", "url"],
  };

  // Analyze what the user is asking about
  Object.entries(helpTopics).forEach(([category, keywords]) => {
    keywords.forEach((keyword) => {
      if (message.includes(keyword)) {
        if (category === "threats") {
          userContext += "[SECURITY HELP NEEDED] ";
          urgencyLevel = "HIGH";
        } else if (category === "extension_issues") {
          userContext += "[TROUBLESHOOTING NEEDED] ";
          if (urgencyLevel === "NORMAL") urgencyLevel = "MEDIUM";
        } else if (category === "features") {
          userContext += "[FEATURE GUIDANCE] ";
        } else if (category === "browsing") {
          userContext += "[BROWSING SAFETY] ";
        }
      }
    });
  });

  // Detect common user issues (in user-friendly terms)
  const commonIssues = {
    "fallback mode": "User sees a warning message about fallback mode",
    "api error": "User experiencing AI chat problems",
    "not loading": "Extension isn't working properly",
    blocked: "Content is being blocked by protection",
  };

  Object.entries(commonIssues).forEach(([issue, description]) => {
    if (message.includes(issue)) {
      userContext += `${description}. `;
      urgencyLevel = "MEDIUM";
    }
  });

  // Create user-friendly context message
  const contextMessage = userContext
    ? `Context: ${userContext}User needs ${urgencyLevel.toLowerCase()} priority help.\n\n`
    : "";

  const enhancedMessage = `${contextMessage}User Question: ${userMessage}

CRITICAL FORMATTING REQUIREMENT: Your response must NEVER use asterisks (*), markdown formatting (**bold**, *italic*), headers (###), or any special characters for formatting. Write everything in plain, natural text only. Use simple hyphens (-) for bullet points when needed.

Provide simple, user-friendly guidance focusing on what the user can do in the NULL VOID extension interface.`;

  return enhancedMessage;
}

// User-friendly response validation system
function validateResponse(response) {
  const technicalTerms = [
    "manifest.json",
    "background.js",
    "browserless-config",
    "api key",
    "configuration",
    "file",
    "code",
    "script",
    "developer",
    "technical",
  ];

  let userFriendliness = 100;

  // Reduce score for technical terms
  technicalTerms.forEach((term) => {
    if (response.toLowerCase().includes(term)) {
      userFriendliness -= 10;
    }
  });

  // Check for user-friendly language
  const friendlyTerms = [
    "click",
    "button",
    "menu",
    "option",
    "setting",
    "tab",
    "icon",
    "open",
    "select",
  ];

  const hasFriendlyLanguage = friendlyTerms.some((term) =>
    response.toLowerCase().includes(term)
  );

  if (hasFriendlyLanguage) {
    userFriendliness += 15;
  }

  return {
    userFriendliness: Math.max(0, Math.min(100, userFriendliness)),
    isUserFriendly: userFriendliness >= 70,
  };
}

// Initialize interface
console.log("[NULL VOID AI] Free AI assistant interface loaded");

// Initialize interface
console.log("[NULL VOID AI] Free AI assistant interface loaded");
