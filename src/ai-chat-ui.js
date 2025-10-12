// NULL VOID AI - AGGRESSIVE HAMBURGER FIX FOR CHROME EXTENSION
console.log("[NULL VOID AI] AGGRESSIVE FIX - Loading...");

// EMERGENCY GLOBAL FUNCTIONS
window.EMERGENCY_TOGGLE = function () {
  console.log("[EMERGENCY] Emergency toggle called!");
  const sidebar = document.getElementById("sidebar");
  const mainContent = document.getElementById("mainContent");

  if (sidebar && mainContent) {
    const isOpen = sidebar.classList.contains("open");
    if (isOpen) {
      sidebar.classList.remove("open");
      sidebar.classList.add("collapsed");
      mainContent.classList.remove("sidebar-visible");
      console.log("[EMERGENCY] Sidebar closed");
    } else {
      sidebar.classList.add("open");
      sidebar.classList.remove("collapsed");
      mainContent.classList.add("sidebar-visible");
      console.log("[EMERGENCY] Sidebar opened");
    }
  }
};

// MULTIPLE AGGRESSIVE INITIALIZATION ATTEMPTS
let attemptCount = 0;
let maxAttempts = 10;

function attemptHamburgerFix() {
  attemptCount++;
  console.log(`[HAMBURGER FIX] Attempt ${attemptCount}/${maxAttempts}`);

  const hamburgerBtn = document.getElementById("sidebarToggle");
  const sidebar = document.getElementById("sidebar");

  if (!hamburgerBtn) {
    console.log("[HAMBURGER FIX] Button not found yet, retrying...");
    if (attemptCount < maxAttempts) {
      setTimeout(attemptHamburgerFix, 200);
    }
    return;
  }

  console.log("[HAMBURGER FIX] Button found! Setting up handlers...");

  // METHOD 1: Remove all existing listeners and add new ones
  const newBtn = hamburgerBtn.cloneNode(true);
  hamburgerBtn.parentNode.replaceChild(newBtn, hamburgerBtn);

  // METHOD 2: Multiple event types
  ["click", "mousedown", "mouseup", "touchstart", "touchend"].forEach(
    (eventType) => {
      newBtn.addEventListener(eventType, function (e) {
        e.preventDefault();
        e.stopPropagation();
        console.log(`[HAMBURGER FIX] ${eventType} event fired!`);
        window.EMERGENCY_TOGGLE();
      });
    }
  );

  // METHOD 3: Direct property assignment
  newBtn.onclick = function (e) {
    e.preventDefault();
    e.stopPropagation();
    console.log("[HAMBURGER FIX] onclick property fired!");
    window.EMERGENCY_TOGGLE();
  };

  // METHOD 4: Event delegation on parent
  const header = newBtn.closest(".chat-header");
  if (header) {
    header.addEventListener("click", function (e) {
      if (e.target.closest("#sidebarToggle")) {
        e.preventDefault();
        e.stopPropagation();
        console.log("[HAMBURGER FIX] Parent delegation fired!");
        window.EMERGENCY_TOGGLE();
      }
    });
  }

  // METHOD 5: Global click handler
  document.addEventListener("click", function (e) {
    if (e.target.closest("#sidebarToggle")) {
      e.preventDefault();
      e.stopPropagation();
      console.log("[HAMBURGER FIX] Global handler fired!");
      window.EMERGENCY_TOGGLE();
    }
  });

  // METHOD 6: CSS pointer events fix
  newBtn.style.pointerEvents = "auto";
  newBtn.style.cursor = "pointer";
  newBtn.style.zIndex = "99999";
  newBtn.style.position = "relative";

  console.log("[HAMBURGER FIX] ALL METHODS APPLIED!");

  // Test click programmatically
  setTimeout(() => {
    console.log("[HAMBURGER FIX] Testing programmatic click...");
    newBtn.click();
  }, 1000);
}

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
    console.log("[ChatGPTUI] Constructor called");
    this.isSidebarOpen = window.innerWidth > 768;
    this.currentChatId = null;
    this.isTyping = false;

    this.initializeElements();
    this.setupEventListeners();
    this.setupResponsiveDesign();
    this.loadChatHistory();

    // AGGRESSIVE HAMBURGER FIX
    setTimeout(() => {
      attemptHamburgerFix();
    }, 100);
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

    console.log("Elements initialized:", {
      sidebar: !!this.sidebar,
      sidebarToggle: !!this.sidebarToggle,
      chatInput: !!this.chatInput,
      sendBtn: !!this.sendBtn,
    });

    // Initialize sidebar state
    this.updateSidebarState();
  }

  setupEventListeners() {
    console.log("[ChatGPTUI] Setting up event listeners...");

    // Store reference globally
    window.nullVoidUI = this;
    window.chatGPTUI = this;

    // Override the emergency toggle to use our method
    window.EMERGENCY_TOGGLE = () => {
      console.log("[ChatGPTUI] Emergency toggle override called");
      this.toggleSidebar();
    };

    this.sidebarOverlay?.addEventListener("click", () => this.closeSidebar());

    // Chat input
    this.chatInput?.addEventListener("input", () => this.handleInputChange());
    this.chatInput?.addEventListener("keydown", (e) => this.handleKeyDown(e));

    // Send button
    this.sendBtn?.addEventListener("click", () => this.sendMessage());

    // New chat
    this.newChatBtn?.addEventListener("click", () => this.startNewChat());

    // Suggestion cards
    document.addEventListener("click", (e) => {
      if (e.target.closest(".suggestion-card")) {
        this.handleSuggestionClick(e);
      }
    });

    // Chat delete buttons
    document.addEventListener("click", (e) => {
      if (e.target.closest(".chat-action-btn")) {
        const chatItem = e.target.closest(".chat-item");
        if (chatItem) {
          const chatId = parseInt(chatItem.dataset.chatId);
          this.deleteChat(chatId);
        }
      }
    });

    // Escape key
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
    const value = this.chatInput?.value.trim();
    this.sendBtn.disabled = !value;

    // Auto-resize textarea
    if (this.chatInput) {
      this.chatInput.style.height = "auto";
      this.chatInput.style.height =
        Math.min(this.chatInput.scrollHeight, 200) + "px";
    }
  }

  handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  }

  async sendMessage() {
    const message = this.chatInput?.value.trim();
    if (!message || this.isTyping) return;

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

    try {
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

  handleSuggestionClick(e) {
    const suggestionCard = e.target.closest(".suggestion-card");
    if (suggestionCard) {
      const prompt = suggestionCard.dataset.prompt;
      if (prompt) {
        this.chatInput.value = prompt;
        this.handleInputChange();
        this.sendMessage();
      }
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

  renderChatHistory() {
    if (!this.chatHistory) return;

    const chatHistory = JSON.parse(
      localStorage.getItem("nullvoid_chat_history") || "[]"
    );
    this.chatHistory.innerHTML = "";

    chatHistory.forEach((chat) => {
      const chatItem = document.createElement("div");
      chatItem.className = "chat-item";
      chatItem.dataset.chatId = chat.id;
      chatItem.style.cursor = "pointer"; // Make it clear it's clickable

      const title = document.createElement("div");
      title.className = "chat-item-title";
      title.textContent = chat.title;
      title.style.cursor = "pointer";

      const actions = document.createElement("div");
      actions.className = "chat-item-actions";

      // Create delete button
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "chat-action-btn";
      deleteBtn.title = "Delete";
      deleteBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
      `;

      // Add click handler to load the chat when clicking on title
      title.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('[CHAT HISTORY] Loading chat:', chat.title);
        this.loadChat(chat);
      });

      // Add hover effect
      chatItem.addEventListener('mouseenter', () => {
        chatItem.style.backgroundColor = 'rgba(255,255,255,0.1)';
      });
      
      chatItem.addEventListener('mouseleave', () => {
        chatItem.style.backgroundColor = '';
      });

      actions.appendChild(deleteBtn);
      chatItem.appendChild(title);
      chatItem.appendChild(actions);
      this.chatHistory.appendChild(chatItem);
    });
    });
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

  loadChat(chat) {
    console.log('[CHAT HISTORY] Loading chat:', chat);
    
    // Set current chat ID
    this.currentChatId = chat.id;
    
    // Hide welcome section
    if (this.welcomeSection) {
      this.welcomeSection.style.display = "none";
    }
    
    // Clear current messages
    if (this.chatMessages) {
      this.chatMessages.innerHTML = "";
    }
    
    // Load chat messages
    if (chat.messages && chat.messages.length > 0) {
      chat.messages.forEach(message => {
        this.addMessage(message.text, message.isUser);
      });
      
      // Scroll to bottom
      setTimeout(() => {
        this.scrollToBottom(true);
      }, 100);
    }
    
    // Focus on input
    if (this.chatInput) {
      this.chatInput.focus();
    }
    
    console.log('[CHAT HISTORY] Chat loaded successfully');
  }
}

// AGGRESSIVE INITIALIZATION WITH MULTIPLE ATTEMPTS
function aggressiveInitialization() {
  console.log("[AGGRESSIVE INIT] Starting aggressive initialization...");

  const init = () => {
    try {
      console.log("[AGGRESSIVE INIT] Creating ChatGPTUI instance...");
      window.chatGPTUI = new ChatGPTUI();
      window.nullVoidUI = window.chatGPTUI;

      console.log("[AGGRESSIVE INIT] Success! Interface ready.");

      // Additional hamburger fix attempt
      setTimeout(() => {
        console.log("[AGGRESSIVE INIT] Additional hamburger fix...");
        attemptHamburgerFix();
      }, 500);
    } catch (error) {
      console.error("[AGGRESSIVE INIT] Error:", error);
      setTimeout(() => {
        console.log("[AGGRESSIVE INIT] Retrying initialization...");
        init();
      }, 1000);
    }
  };

  init();
}

// MULTIPLE INITIALIZATION TRIGGERS
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", aggressiveInitialization);
} else {
  aggressiveInitialization();
}

window.addEventListener("load", aggressiveInitialization);

// Emergency fallback after 5 seconds
setTimeout(() => {
  if (!window.chatGPTUI) {
    console.log("[EMERGENCY] Final fallback initialization...");
    aggressiveInitialization();
  } else {
    console.log("[EMERGENCY] Attempting final hamburger fix...");
    attemptHamburgerFix();
  }
}, 5000);

console.log("[NULL VOID AI] Aggressive fix script loaded!");
