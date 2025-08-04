// NULL VOID AI Chat - Free AI Assistant v2.0
// Advanced AI chat interface
console.log("[NULL VOID AI] Loading free AI assistant v2.0");

// Use browser-specific API namespace
const browserAPI = typeof browser !== "undefined" ? browser : (typeof chrome !== "undefined" ? chrome : null);

// Enhanced AI Configuration
const AI_CONFIG = {
  apiKey: "AIzaSyCU4UMlmR_6Y3TxVrZrgqDdFdFxnYFWSX4",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta",
  model: "gemini-1.5-flash",
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
  darkMode: true
};

// Enhanced system prompt for better responses
const SYSTEM_PROMPT = `You are NULL VOID AI, an advanced AI assistant integrated into the NULL VOID extension. You should provide helpful, accurate, and well-structured responses.

RESPONSE GUIDELINES:
- Be conversational and natural
- Provide comprehensive yet accessible explanations
- Use proper formatting with headings, lists, and paragraphs
- Include practical examples when relevant
- Be helpful and encouraging
- Maintain a professional but friendly tone
- Structure complex information clearly
- Always aim to be genuinely useful to the user

Remember: You are NULL VOID AI, a free and powerful AI assistant.`;

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  console.log("[NULL VOID AI] Interface loading...");
  initializeInterface();
  setupEventListeners();
  console.log("[NULL VOID AI] Interface ready");
});

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
  suggestionPills.forEach(pill => {
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
    const aiResponse = await getAIResponse(userMessage);

    // Remove typing indicator
    hideTypingIndicator();

    // Add AI response
    addMessage(aiResponse, false);

    // Save chat history
    saveChatHistory();

  } catch (error) {
    console.error("[NULL VOID AI] Error:", error);
    hideTypingIndicator();

    let errorMessage = "I apologize, but I encountered an error. Please try again.";
    if (error.message.includes("API Error: 429")) {
      errorMessage = "Rate limit exceeded. Please wait a moment before trying again.";
    } else if (error.message.includes("API Error: 403")) {
      errorMessage = "API access denied. Please check your connection.";
    } else if (error.message.includes("Failed to fetch")) {
      errorMessage = "Network error. Please check your internet connection.";
    }

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
    // Prepare conversation history
    const conversationHistory = chatHistory.slice(-10).map(msg => ({
      role: msg.isUser ? "user" : "model",
      parts: [{ text: msg.text }]
    }));

    // Add system prompt and current message
    const messages = [
      {
        role: "user",
        parts: [{ text: SYSTEM_PROMPT }]
      },
      ...conversationHistory,
      {
        role: "user",
        parts: [{ text: userMessage }]
      }
    ];

    const requestBody = {
      contents: messages,
      generationConfig: {
        temperature: settings.temperature,
        maxOutputTokens: settings.maxTokens,
        topP: 0.8,
        topK: 40
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    };

    const response = await fetch(
      `${AI_CONFIG.baseUrl}/models/${AI_CONFIG.model}:generateContent?key=${AI_CONFIG.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error("Invalid response from AI API");
    }

    return data.candidates[0].content.parts[0].text;
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
    timestamp: Date.now()
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
  formatted = formatted.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  formatted = formatted.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  formatted = formatted.replace(/^# (.*$)/gm, '<h1>$1</h1>');

  // Convert bold text
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Convert italic text
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Convert inline code
  formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Convert code blocks
  formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

  // Convert bullet points
  formatted = formatted.replace(/^- (.*$)/gm, '<li>$1</li>');
  formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

  // Convert numbered lists
  formatted = formatted.replace(/^\d+\. (.*$)/gm, '<li>$1</li>');

  // Convert paragraphs (split by double newlines)
  const paragraphs = formatted.split(/\n\s*\n/);
  formatted = paragraphs.map(p => {
    p = p.trim();
    if (p && !p.startsWith('<')) {
      return `<p>${p}</p>`;
    }
    return p;
  }).join('\n');

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
  if (dropdown) {
    dropdown.classList.toggle("open");
  }

  // Setup model option click handlers if not already done
  const modelOptions = document.querySelectorAll(".model-option");
  modelOptions.forEach(option => {
    if (!option.hasAttribute("data-listener")) {
      option.setAttribute("data-listener", "true");
      option.addEventListener("click", () => {
        const modelId = option.dataset.model;
        const modelName = option.querySelector(".model-name").textContent;
        selectModel(modelId, modelName);
      });
    }
  });
}

function selectModel(modelId, modelName) {
  AI_CONFIG.model = modelId;

  // Update UI
  const currentModelSpan = document.getElementById("currentModel");
  if (currentModelSpan) {
    currentModelSpan.textContent = modelName;
  }

  // Update dropdown selection
  const options = document.querySelectorAll(".model-option");
  options.forEach(option => {
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

  // Save settings
  saveSettings();

  // Show notification
  showNotification(`Model changed to ${modelName}`, "success");
}

function autoResizeTextarea() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 200) + 'px';
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
  if (confirm("Are you sure you want to clear all data? This cannot be undone.")) {
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
        darkMode: true
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
      history: chatHistory
    },
    settings: settings,
    exportDate: new Date().toISOString()
  };

  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });

  const link = document.createElement('a');
  link.href = URL.createObjectURL(dataBlob);
  link.download = `nullvoid-ai-export-${new Date().toISOString().split('T')[0]}.json`;
  link.click();

  URL.revokeObjectURL(link.href);
  showNotification("Data exported successfully!", "success");
}

function handleSearch(e) {
  const query = e.target.value.toLowerCase();
  const recentChats = document.getElementById("recentChats");

  if (!recentChats) return;

  const chatElements = recentChats.querySelectorAll(".recent-chat");

  chatElements.forEach(element => {
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
  return 'chat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
}

function saveCurrentChat() {
  if (!currentChatId || chatHistory.length === 0) return;

  const firstMessage = chatHistory.find(msg => msg.isUser);
  const title = firstMessage ?
    firstMessage.text.substring(0, 50) + (firstMessage.text.length > 50 ? "..." : "") :
    "New Chat";

  allChats[currentChatId] = {
    id: currentChatId,
    title: title,
    messages: [...chatHistory],
    lastUpdated: Date.now(),
    messageCount: chatHistory.length
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
    chatHistory.forEach(msg => {
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

  sortedChats.forEach(chat => {
    const chatElement = document.createElement("div");
    chatElement.className = "recent-chat";
    if (chat.id === currentChatId) {
      chatElement.classList.add("active");
    }

    chatElement.textContent = chat.title;
    chatElement.title = `${chat.messageCount} messages • ${new Date(chat.lastUpdated).toLocaleDateString()}`;

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
      <div class="message-text ${isError ? 'error' : ''}">${formattedText}</div>
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
        nullvoidAiSettings: settings
      });
    } else {
      // Fallback to localStorage
      localStorage.setItem('nullvoidAiSettings', JSON.stringify(settings));
    }
  } catch (error) {
    console.error("[NULL VOID AI] Failed to save settings:", error);
  }
}

async function loadSettings() {
  try {
    if (browserAPI && browserAPI.storage) {
      const storage = await browserAPI.storage.local.get(["nullvoidAiSettings"]);
      if (storage.nullvoidAiSettings) {
        settings = { ...settings, ...storage.nullvoidAiSettings };
      }
    } else {
      // Fallback to localStorage
      const stored = localStorage.getItem('nullvoidAiSettings');
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
        nullvoidAiAllChats: allChats
      });
    } else {
      localStorage.setItem('nullvoidAiAllChats', JSON.stringify(allChats));
    }
  } catch (error) {
    console.error("[NULL VOID AI] Failed to save chats:", error);
  }
}

async function loadAllChats() {
  try {
    if (browserAPI && browserAPI.storage) {
      const storage = await browserAPI.storage.local.get(["nullvoidAiAllChats"]);
      if (storage.nullvoidAiAllChats) {
        allChats = storage.nullvoidAiAllChats;
      }
    } else {
      const stored = localStorage.getItem('nullvoidAiAllChats');
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
      nullvoidAiCurrentChatId: currentChatId
    };

    if (browserAPI && browserAPI.storage) {
      await browserAPI.storage.local.set(data);
    } else {
      Object.keys(data).forEach(key => {
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
  await Promise.all([
    saveSettings(),
    saveAllChats(),
    saveChatHistory()
  ]);
}

async function loadChatHistory() {
  try {
    let storage = {};

    if (browserAPI && browserAPI.storage) {
      storage = await browserAPI.storage.local.get([
        "nullvoidAiChatHistory",
        "nullvoidAiChatMode",
        "nullvoidAiCurrentChatId"
      ]);
    } else {
      // Fallback to localStorage
      const keys = ["nullvoidAiChatHistory", "nullvoidAiChatMode", "nullvoidAiCurrentChatId"];
      keys.forEach(key => {
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
          chatHistory.forEach(msg => {
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

// Close dropdowns when clicking outside
document.addEventListener("click", (e) => {
  const modelDropdown = document.getElementById("modelDropdown");
  const modelSelector = document.getElementById("modelSelector");

  if (modelDropdown && !modelSelector.contains(e.target)) {
    modelDropdown.classList.remove("open");
  }
});

// Initialize interface
console.log("[NULL VOID AI] Free AI assistant interface loaded");

// Initialize interface
console.log("[NULL VOID AI] Free AI assistant interface loaded");