// NULL VOID AI - Chrome Extension Compatible JavaScript
console.log("[NULL VOID AI] Loading extension-compatible AI assistant");

// AI Configuration and Functions
const AI_CONFIG = {
  apiKey: "AIzaSyB-j8iXAEg_W-I2l3PodnJMoO_wgai2VDU",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta",
  model: "gemini-2.5-flash",
  maxTokens: 8000,
  temperature: 0.7,
};

// Simple AI response generator for demo
async function generateAIResponse(userMessage) {
  console.log("[NULL VOID AI] Generating response for:", userMessage);

  // Simulate AI thinking time
  await new Promise((resolve) =>
    setTimeout(resolve, 1000 + Math.random() * 2000)
  );

  const responses = [
    `I understand your question about "${userMessage}". NULL VOID extension helps keep you safe online by providing secure browsing features and protection against malicious websites.`,

    `That's a great question about "${userMessage}". The NULL VOID extension offers several security features including disposable browsing, temporary email creation, and smart protection systems.`,

    `Thanks for asking about "${userMessage}". I'm here to help you understand how NULL VOID keeps you safe while browsing. Would you like to know about any specific security features?`,

    `Regarding "${userMessage}" - NULL VOID provides multiple layers of protection including secure file viewing, disposable browser sessions, and AI-powered threat detection.`,

    `I see you're interested in "${userMessage}". NULL VOID's mission is to provide comprehensive online security through innovative browser protection and smart threat prevention.`,
  ];

  return responses[Math.floor(Math.random() * responses.length)];
}

// Enhanced UI Controller for ChatGPT-like experience
class ChatGPTUI {
  constructor() {
    this.isSidebarOpen = window.innerWidth > 768;
    this.currentChatId = null;
    this.isTyping = false;

    this.initializeElements();
    this.setupEventListeners();
    this.setupResponsiveDesign();
    this.loadChatHistory();
  }

  initializeElements() {
    this.sidebar = document.getElementById("sidebar");
    this.sidebarToggle = document.getElementById("sidebarToggle");
    this.sidebarOverlay = document.getElementById("sidebarOverlay");
    this.mainContent = document.getElementById("mainContent");
    this.chatInput = document.getElementById("chatInput");
    this.sendBtn = document.getElementById("sendBtn");
    this.messagesArea = document.getElementById("messagesArea");
    this.chatMessages = document.getElementById("chatMessages");
    this.welcomeSection = document.getElementById("welcomeSection");
    this.typingIndicator = document.getElementById("typingIndicator");
    this.newChatBtn = document.getElementById("newChatBtn");
    this.chatHistory = document.getElementById("chatHistory");
    this.searchBtn = document.getElementById("searchBtn");
    this.searchPanel = document.getElementById("searchPanel");
    this.searchInput = document.getElementById("searchInput");
    this.searchClose = document.getElementById("searchClose");

    console.log("Elements initialized:", {
      sidebar: !!this.sidebar,
      sidebarToggle: !!this.sidebarToggle,
      chatInput: !!this.chatInput,
      sendBtn: !!this.sendBtn,
      searchBtn: !!this.searchBtn,
      searchPanel: !!this.searchPanel,
    });

    // Ensure input field is enabled and ready
    if (this.chatInput) {
      this.chatInput.disabled = false;
      this.chatInput.readOnly = false;
      this.chatInput.style.pointerEvents = "auto";
      console.log("[NULL VOID AI] Chat input enabled and ready");
    }

    // Ensure send button is properly initialized
    if (this.sendBtn) {
      this.sendBtn.disabled = true; // Initially disabled until user types
      console.log("[NULL VOID AI] Send button initialized");
    }

    // Initialize sidebar state
    this.updateSidebarState();
  }

  setupEventListeners() {
    console.log(
      "[NULL VOID AI] Setting up event listeners for Chrome extension..."
    );

    // CHROME EXTENSION COMPATIBLE HAMBURGER BUTTON
    if (this.sidebarToggle) {
      console.log(
        "[NULL VOID AI] Hamburger button found, setting up multiple handlers"
      );

      // Store reference to this class for global access
      window.nullVoidUI = this;

      // Method 1: Standard addEventListener with error handling
      try {
        this.sidebarToggle.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log("[NULL VOID AI] Hamburger clicked via addEventListener");
          this.toggleSidebar();
        });
        console.log("[NULL VOID AI] addEventListener attached successfully");
      } catch (error) {
        console.error("[NULL VOID AI] addEventListener failed:", error);
      }

      // Method 2: Direct onclick property as fallback
      this.sidebarToggle.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("[NULL VOID AI] Hamburger clicked via onclick property");
        this.toggleSidebar();
      };

      // Method 3: Create global function for inline onclick
      window.toggleSidebarExtension = () => {
        console.log("[NULL VOID AI] Hamburger clicked via global function");
        this.toggleSidebar();
      };

      // Global search functions for Chrome extension compatibility
      window.toggleSearchExtension = () => {
        console.log("[NULL VOID AI] Search button clicked via global function");
        this.toggleSearch();
      };

      window.EMERGENCY_SEARCH_TOGGLE = () => {
        console.log("[NULL VOID AI] Emergency search toggle activated!");
        this.toggleSearch();
      };

      // Emergency functions for testing input functionality
      window.EMERGENCY_SEND_MESSAGE = (message = "Test message") => {
        console.log("[NULL VOID AI] Emergency send message activated!");
        if (this.chatInput) {
          this.chatInput.value = message;
          this.handleInputChange();
          this.sendMessage();
        }
      };

      window.EMERGENCY_FOCUS_INPUT = () => {
        console.log("[NULL VOID AI] Emergency focus input activated!");
        if (this.chatInput) {
          this.chatInput.focus();
          this.chatInput.disabled = false;
          this.chatInput.readOnly = false;
        }
      };

      window.EMERGENCY_DEBUG_ELEMENTS = () => {
        console.log("[NULL VOID AI] Emergency debug elements:");
        console.log("chatInput:", this.chatInput);
        console.log("sendBtn:", this.sendBtn);
        console.log("chatInput disabled:", this.chatInput?.disabled);
        console.log("chatInput readOnly:", this.chatInput?.readOnly);
        console.log("sendBtn disabled:", this.sendBtn?.disabled);
      };

      console.log(
        "[NULL VOID AI] All hamburger methods set up for extension compatibility"
      );
    } else {
      console.error("[NULL VOID AI] Hamburger button not found!");
    }

    // CHROME EXTENSION COMPATIBLE SEARCH BUTTON
    if (this.searchBtn) {
      console.log(
        "[NULL VOID AI] Search button found, setting up multiple handlers"
      );

      // Method 1: Standard addEventListener with error handling
      try {
        this.searchBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log("[NULL VOID AI] Search clicked via addEventListener");
          this.toggleSearch();
        });
        console.log(
          "[NULL VOID AI] Search addEventListener attached successfully"
        );
      } catch (error) {
        console.error("[NULL VOID AI] Search addEventListener failed:", error);
      }

      // Method 2: Direct onclick property as fallback
      this.searchBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("[NULL VOID AI] Search clicked via onclick property");
        this.toggleSearch();
      };

      console.log(
        "[NULL VOID AI] All search methods set up for extension compatibility"
      );
    } else {
      console.error("[NULL VOID AI] Search button not found!");
    }

    this.sidebarOverlay?.addEventListener("click", () => this.closeSidebar());

    // Chat input
    this.chatInput?.addEventListener("input", () => this.handleInputChange());
    this.chatInput?.addEventListener("keydown", (e) => this.handleKeyDown(e));

    // Send button
    this.sendBtn?.addEventListener("click", () => this.sendMessage());

    // New chat
    this.newChatBtn?.addEventListener("click", () => this.startNewChat());

    // Search functionality
    this.searchClose?.addEventListener("click", () => this.closeSearch());
    this.searchInput?.addEventListener("input", (e) =>
      this.handleSearch(e.target.value)
    );
    this.searchInput?.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeSearch();
      }
    });

    // Suggestion cards
    document.querySelectorAll(".suggestion-card").forEach((card) => {
      card.addEventListener("click", (e) => this.handleSuggestionClick(e));
    });

    // Escape key handling
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeSidebar();
      }
    });
  }

  setupResponsiveDesign() {
    const mediaQuery = window.matchMedia("(max-width: 768px)");

    const handleResize = (e) => {
      if (e.matches) {
        // Mobile view
        this.isSidebarOpen = false;
      } else {
        // Desktop view
        this.isSidebarOpen = true;
      }
      this.updateSidebarState();
    };

    mediaQuery.addListener(handleResize);
    handleResize(mediaQuery);
  }

  updateSidebarState() {
    console.log("Updating sidebar state:", this.isSidebarOpen);

    if (this.isSidebarOpen) {
      this.sidebar?.classList.remove("collapsed");
      this.sidebar?.classList.add("open");
      this.mainContent?.classList.add("sidebar-visible");
      if (window.innerWidth <= 768) {
        this.sidebarOverlay.style.display = "block";
        setTimeout(() => {
          this.sidebarOverlay.style.opacity = "1";
        }, 10);
      }
    } else {
      this.sidebar?.classList.add("collapsed");
      this.sidebar?.classList.remove("open");
      this.mainContent?.classList.remove("sidebar-visible");
      this.sidebarOverlay.style.opacity = "0";
      setTimeout(() => {
        this.sidebarOverlay.style.display = "none";
      }, 300);
    }
  }

  toggleSidebar() {
    console.log("Toggle sidebar called, current state:", this.isSidebarOpen);
    this.isSidebarOpen = !this.isSidebarOpen;
    this.updateSidebarState();
  }

  closeSidebar() {
    if (window.innerWidth <= 768) {
      this.isSidebarOpen = false;
      this.updateSidebarState();
    }
  }

  handleInputChange() {
    try {
      const value = this.chatInput?.value.trim() || "";
      if (this.sendBtn) {
        this.sendBtn.disabled = !value;
      } else {
        console.error(
          "[NULL VOID AI] Send button not found during input change"
        );
      }

      // Auto-resize textarea
      if (this.chatInput) {
        this.chatInput.style.height = "auto";
        this.chatInput.style.height =
          Math.min(this.chatInput.scrollHeight, 200) + "px";
      }
    } catch (error) {
      console.error("[NULL VOID AI] Error in handleInputChange:", error);
    }
  }

  handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  }

  async sendMessage() {
    try {
      console.log("[NULL VOID AI] sendMessage called");

      const message = this.chatInput?.value.trim();
      console.log("[NULL VOID AI] Message content:", message);

      if (!message || this.isTyping) {
        console.log(
          "[NULL VOID AI] Message empty or already typing, returning"
        );
        return;
      }

      // Hide welcome section
      if (this.welcomeSection) {
        this.welcomeSection.style.display = "none";
      }

      // Add user message and scroll immediately
      this.addMessage(message, true);
      this.scrollToNewMessage(); // Use new scroll method for user messages too

      // Clear input
      this.chatInput.value = "";
      this.handleInputChange();

      // Show typing indicator and scroll
      this.showTyping();
      this.scrollToNewMessage(); // Scroll to show typing indicator

      // Get AI response (integrate with existing AI system)
      const response = await this.getAIResponse(message);

      // Hide typing indicator
      this.hideTyping();

      // Add AI response with immediate visibility
      this.addMessage(response, false);

      // Scroll to show the new AI response immediately
      this.scrollToNewMessage();

      // Update chat history
      this.updateChatHistory(message);
    } catch (error) {
      console.error("Error getting AI response:", error);
      this.hideTyping();
      this.addMessage(
        "I apologize, but I encountered an error. Please try again.",
        false,
        true
      );
      this.scrollToNewMessage();
    }
  }

  addMessage(text, isUser, isError = false) {
    const messageEl = document.createElement("div");
    messageEl.className = `message ${isUser ? "user-message" : "ai-message"}`;

    const avatarEl = document.createElement("div");
    avatarEl.className = `message-avatar ${
      isUser ? "user-avatar-msg" : "ai-avatar-msg"
    }`;
    avatarEl.textContent = isUser ? "U" : "🤖";

    const contentEl = document.createElement("div");
    contentEl.className = "message-content";

    const textEl = document.createElement("div");
    textEl.className = "message-text";
    textEl.textContent = text;

    if (isError) {
      textEl.style.color = "#ff6b6b";
    }

    contentEl.appendChild(textEl);
    messageEl.appendChild(avatarEl);
    messageEl.appendChild(contentEl);

    this.chatMessages?.appendChild(messageEl);

    // Enhanced auto-scroll
    this.scrollToBottom();
  }

  // Enhanced scroll function
  scrollToBottom(immediate = false) {
    if (!this.messagesArea) return;

    const scrollToEnd = () => {
      this.messagesArea.scrollTo({
        top: this.messagesArea.scrollHeight,
        behavior: immediate ? "auto" : "smooth",
      });
    };

    scrollToEnd();
    setTimeout(scrollToEnd, immediate ? 50 : 150);
  }

  // New function to scroll to new message like ChatGPT
  scrollToNewMessage() {
    if (!this.messagesArea) return;

    // Get the last message element
    const lastMessage = this.chatMessages?.lastElementChild;
    if (lastMessage) {
      // Scroll to bring the new message into view from the top
      lastMessage.scrollIntoView({
        behavior: "smooth",
        block: "start",
        inline: "nearest",
      });

      // Ensure we can see the full message
      setTimeout(() => {
        const messageRect = lastMessage.getBoundingClientRect();
        const containerRect = this.messagesArea.getBoundingClientRect();

        // If message is cut off at bottom, scroll a bit more
        if (messageRect.bottom > containerRect.bottom - 100) {
          this.messagesArea.scrollTo({
            top: this.messagesArea.scrollTop + 80,
            behavior: "smooth",
          });
        }
      }, 100);
    }
  }

  showTyping() {
    this.isTyping = true;
    this.typingIndicator?.classList.add("visible");
    this.sendBtn.disabled = true;

    setTimeout(() => {
      this.scrollToBottom();
    }, 50);
  }

  hideTyping() {
    this.isTyping = false;
    this.typingIndicator?.classList.remove("visible");
    this.handleInputChange();
  }

  async getAIResponse(message) {
    // Integration point with existing AI system
    try {
      if (typeof getAIResponse === "function") {
        const response = await getAIResponse(message);
        if (typeof cleanResponseFormatting === "function") {
          return cleanResponseFormatting(response);
        }
        return response;
      }

      return await this.directAPICall(message);
    } catch (error) {
      console.error("AI Response Error:", error);
      throw error;
    }
  }

  async directAPICall(message) {
    const AI_CONFIG = {
      apiKey: "AIzaSyB-j8iXAEg_W-I2l3PodnJMoO_wgai2VDU",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      model: "gemini-2.5-flash",
    };

    const response = await fetch(
      `${AI_CONFIG.baseUrl}/models/${AI_CONFIG.model}:generateContent?key=${AI_CONFIG.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: message }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1200,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`AI API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  startNewChat() {
    this.chatMessages.innerHTML = "";
    this.welcomeSection.style.display = "flex";
    this.currentChatId = null;
    this.chatInput?.focus();
  }

  toggleSearch() {
    console.log("[NULL VOID AI] Toggle search clicked");
    if (!this.searchPanel) {
      console.error("[NULL VOID AI] Search panel not found!");
      return;
    }

    const isOpen = this.searchPanel.classList.contains("open");
    if (isOpen) {
      this.closeSearch();
    } else {
      this.openSearch();
    }
  }

  openSearch() {
    console.log("[NULL VOID AI] Opening search panel");
    if (this.searchPanel) {
      this.searchPanel.classList.add("open");
      setTimeout(() => {
        this.searchInput?.focus();
      }, 100);
    }
  }

  closeSearch() {
    console.log("[NULL VOID AI] Closing search panel");
    if (this.searchPanel) {
      this.searchPanel.classList.remove("open");
      if (this.searchInput) {
        this.searchInput.value = "";
      }
      this.showAllChatHistory();
    }
  }

  handleSearch(query) {
    console.log("[NULL VOID AI] Searching for:", query);
    if (!query.trim()) {
      this.showAllChatHistory();
      return;
    }

    const chatHistory = JSON.parse(
      localStorage.getItem("nullvoid_chat_history") || "[]"
    );
    const filteredChats = chatHistory.filter((chat) => {
      const searchText = (
        chat.title +
        " " +
        chat.messages.map((m) => m.content).join(" ")
      ).toLowerCase();
      return searchText.includes(query.toLowerCase());
    });

    this.renderChatHistory(filteredChats);
  }

  showAllChatHistory() {
    const chatHistory = JSON.parse(
      localStorage.getItem("nullvoid_chat_history") || "[]"
    );
    this.renderChatHistory(chatHistory);
  }

  handleSuggestionClick(e) {
    const prompt = e.currentTarget.dataset.prompt;
    if (prompt) {
      this.chatInput.value = prompt;
      this.handleInputChange();
      this.sendMessage();
    }
  }

  updateChatHistory(lastMessage) {
    console.log("Updating chat history with message:", lastMessage);

    const chatHistory = JSON.parse(
      localStorage.getItem("nullvoid_chat_history") || "[]"
    );

    // Create or update current chat
    if (!this.currentChatId) {
      this.currentChatId = Date.now();
      const newChat = {
        id: this.currentChatId,
        title:
          lastMessage.length > 30
            ? lastMessage.substring(0, 30) + "..."
            : lastMessage,
        timestamp: new Date().toISOString(),
        messages: [{ text: lastMessage, isUser: true, timestamp: Date.now() }],
      };
      chatHistory.unshift(newChat);
    } else {
      // Find existing chat and add message
      const existingChat = chatHistory.find(
        (chat) => chat.id === this.currentChatId
      );
      if (existingChat) {
        existingChat.messages.push({
          text: lastMessage,
          isUser: true,
          timestamp: Date.now(),
        });
      }
    }

    if (chatHistory.length > 20) {
      chatHistory.splice(20);
    }

    localStorage.setItem("nullvoid_chat_history", JSON.stringify(chatHistory));

    console.log("Chat history saved:", chatHistory);
    this.renderChatHistory();
  }

  renderChatHistory(chatsToShow = null) {
    if (!this.chatHistory) return;

    const chatHistory =
      chatsToShow ||
      JSON.parse(localStorage.getItem("nullvoid_chat_history") || "[]");
    this.chatHistory.innerHTML = "";

    chatHistory.forEach((chat) => {
      const chatItem = document.createElement("div");
      chatItem.className = "chat-item";
      chatItem.dataset.chatId = chat.id;

      const title = document.createElement("div");
      title.className = "chat-item-title";
      title.textContent = chat.title;

      // Add click handler for loading chat
      title.addEventListener("click", () => {
        this.loadChat(chat);
      });

      // Add hover effects
      title.addEventListener("mouseenter", () => {
        title.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
      });

      title.addEventListener("mouseleave", () => {
        title.style.backgroundColor = "";
      });

      title.style.cursor = "pointer";

      const actions = document.createElement("div");
      actions.className = "chat-item-actions";

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "chat-action-btn";
      deleteBtn.title = "Delete";
      deleteBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
      `;

      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.deleteChat(chat.id);
      });

      actions.appendChild(deleteBtn);
      chatItem.appendChild(title);
      chatItem.appendChild(actions);
      this.chatHistory.appendChild(chatItem);
    });
  }

  loadChat(chat) {
    console.log("[NULL VOID AI] Loading chat:", chat.title);

    // Set current chat ID
    this.currentChatId = chat.id;

    // Hide welcome section
    if (this.welcomeSection) {
      this.welcomeSection.style.display = "none";
    }

    // Clear current messages
    this.chatMessages.innerHTML = "";

    // Load all messages from the chat
    chat.messages.forEach((message) => {
      this.addMessage(message.text, message.isUser);
    });

    // Scroll to bottom
    setTimeout(() => {
      this.scrollToBottom(true);
    }, 100);

    // Focus input
    this.chatInput?.focus();

    console.log("[NULL VOID AI] Chat loaded successfully");
  }

  deleteChat(chatId) {
    const chatHistory = JSON.parse(
      localStorage.getItem("nullvoid_chat_history") || "[]"
    );
    const updatedHistory = chatHistory.filter((chat) => chat.id !== chatId);
    localStorage.setItem(
      "nullvoid_chat_history",
      JSON.stringify(updatedHistory)
    );
    this.renderChatHistory();
  }

  loadChatHistory() {
    this.renderChatHistory();
  }
}

// CHROME EXTENSION COMPATIBLE INITIALIZATION
function initializeExtension() {
  console.log(
    "[NULL VOID AI] Chrome Extension Mode - DOM State:",
    document.readyState
  );
  console.log("[NULL VOID AI] Initializing extension-compatible interface...");
  console.log("[NULL VOID AI] URL:", window.location.href);

  // Check if we're in extension context
  const isExtension = window.location.protocol === "chrome-extension:";
  console.log("[NULL VOID AI] Extension context:", isExtension);

  // Enhanced delay for extension loading
  const initDelay = isExtension ? 300 : 100;

  setTimeout(() => {
    try {
      window.chatGPTUI = new ChatGPTUI();
      window.nullVoidUI = window.chatGPTUI; // Backup reference

      console.log("[NULL VOID AI] Interface ready!");
      console.log(
        "[NULL VOID AI] Sidebar:",
        !!document.getElementById("sidebar")
      );
      console.log(
        "[NULL VOID AI] Toggle button:",
        !!document.getElementById("sidebarToggle")
      );

      // Extension-specific setup
      if (isExtension) {
        console.log(
          "[NULL VOID AI] Applying extension-specific configurations..."
        );

        // Force hamburger button setup after a longer delay
        setTimeout(() => {
          const btn = document.getElementById("sidebarToggle");
          if (btn && window.nullVoidUI) {
            console.log(
              "[NULL VOID AI] Re-setting up hamburger for extension..."
            );
            btn.onclick = () => {
              console.log("[NULL VOID AI] Extension hamburger clicked!");
              window.nullVoidUI.toggleSidebar();
            };
          }
        }, 500);
      }
    } catch (error) {
      console.error("[NULL VOID AI] Initialization error:", error);

      // Fallback initialization attempt
      setTimeout(() => {
        try {
          console.log("[NULL VOID AI] Attempting fallback initialization...");
          window.chatGPTUI = new ChatGPTUI();
        } catch (fallbackError) {
          console.error(
            "[NULL VOID AI] Fallback initialization failed:",
            fallbackError
          );
        }
      }, 1000);
    }
  }, initDelay);
}

// Multiple initialization approaches for maximum compatibility
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeExtension);
} else {
  // DOM already ready
  initializeExtension();
}

// Global emergency functions for debugging
window.EMERGENCY_TOGGLE = () => {
  console.log("[NULL VOID AI] Emergency toggle activated!");
  if (window.nullVoidUI) {
    window.nullVoidUI.toggleSidebar();
  }
};

window.EMERGENCY_SEND_TEST = (message = "Emergency test message") => {
  console.log("[NULL VOID AI] Emergency send test activated!");
  if (window.nullVoidUI && window.nullVoidUI.chatInput) {
    window.nullVoidUI.chatInput.value = message;
    window.nullVoidUI.handleInputChange();
    window.nullVoidUI.sendMessage();
  }
};

window.EMERGENCY_DEBUG = () => {
  console.log("[NULL VOID AI] Emergency debug info:");
  console.log("nullVoidUI exists:", !!window.nullVoidUI);
  console.log("chatInput exists:", !!document.getElementById("chatInput"));
  console.log("sendBtn exists:", !!document.getElementById("sendBtn"));
  const input = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");
  if (input) {
    console.log("Input disabled:", input.disabled);
    console.log("Input readOnly:", input.readOnly);
    console.log("Input value:", input.value);
  }
  if (sendBtn) {
    console.log("Send button disabled:", sendBtn.disabled);
  }
};
