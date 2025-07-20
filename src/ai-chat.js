// NULL VOID AI Chat Assistant
// Secure AI interaction with multiple model support via OpenRouter API

const browserAPI = typeof browser !== "undefined" ? browser : chrome;

// OpenRouter API Configuration
const OPENROUTER_API_KEY =
  "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";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

// Model mappings for OpenRouter (Free Tier Only)
const MODEL_MAPPINGS = {
  "gpt-3.5-turbo": "openai/gpt-3.5-turbo",
  "llama-3.1-8b": "meta-llama/llama-3.1-8b-instruct:free",
  "gemma-7b": "google/gemma-7b-it:free",
};

let currentModel = "gpt-3.5-turbo";
let chatHistory = [];

// Initialize AI chat when page loads
document.addEventListener("DOMContentLoaded", async () => {
  console.log("[AI Chat] Initializing...");

  try {
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const initialQuery = urlParams.get("query");
    const modelParam = urlParams.get("model");

    // Load saved settings
    const storage = await browserAPI.storage.local.get([
      "selectedAIModel",
      "pendingAIQuery",
      "aiChatHistory",
    ]);

    // Set current model
    if (modelParam) {
      currentModel = modelParam;
    } else if (storage.selectedAIModel) {
      currentModel = storage.selectedAIModel;
    }

    // Update UI with current model
    updateModelDisplay();

    // Load chat history
    if (storage.aiChatHistory) {
      chatHistory = storage.aiChatHistory;
      displayChatHistory();
    }

    // Handle initial query if provided
    if (initialQuery || storage.pendingAIQuery) {
      const query = initialQuery || storage.pendingAIQuery;
      document.getElementById("chatInput").value = query;

      // Clear pending query
      if (storage.pendingAIQuery) {
        await browserAPI.storage.local.remove(["pendingAIQuery"]);
      }

      // Auto-send if it's from a search
      if (initialQuery) {
        setTimeout(() => sendMessage(), 500);
      }
    }

    // Initialize event listeners
    initializeEventListeners();

    // Test API connection
    const connected = await testAPIConnection();
    updateModelStatus(connected);
  } catch (error) {
    console.error("[AI Chat] Initialization error:", error);
    showError("Failed to initialize AI chat");
    updateModelStatus(false);
  }
});

function initializeEventListeners() {
  const chatInput = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");

  if (!chatInput || !sendBtn) {
    console.error("[AI Chat] Chat input or send button not found!");
    return;
  }

  // Auto-resize textarea
  chatInput.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 120) + "px";
  });

  // Send message on Enter (but allow Shift+Enter for new lines)
  chatInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Send button click
  sendBtn.addEventListener("click", sendMessage);

  console.log("[AI Chat] Event listeners initialized successfully");
}

function updateModelDisplay() {
  const modelDisplay = document.getElementById("currentModel");
  const modelNames = {
    "gpt-3.5-turbo": "GPT-3.5 Turbo (Free)",
    "llama-3.1-8b": "Llama 3.1 8B (Free)",
    "gemma-7b": "Gemma 7B (Free)",
  };

  if (modelDisplay) {
    modelDisplay.textContent = modelNames[currentModel] || currentModel;
  }
}

function displayChatHistory() {
  const chatMessages = document.getElementById("chatMessages");
  if (!chatMessages || chatHistory.length === 0) return;

  // Clear welcome message
  chatMessages.innerHTML = "";

  chatHistory.forEach((message) => {
    displayMessage(message.role, message.content, false);
  });

  scrollToBottom();
}

async function sendMessage() {
  console.log("[AI Chat] Send message triggered");

  const chatInput = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");
  const message = chatInput.value.trim();

  if (!message) {
    console.log("[AI Chat] No message to send");
    return;
  }

  console.log("[AI Chat] Sending message:", message);

  // Disable input and show loading
  chatInput.disabled = true;
  sendBtn.disabled = true;

  // Display user message
  displayMessage("user", message);
  chatInput.value = "";
  chatInput.style.height = "auto";

  // Add to chat history
  chatHistory.push({ role: "user", content: message });

  // Show typing indicator
  showTypingIndicator();

  try {
    // Call OpenRouter API
    const aiResponse = await generateAIResponse(message);

    // Hide typing indicator
    hideTypingIndicator();

    // Display AI response
    displayMessage("ai", aiResponse);

    // Add to chat history
    chatHistory.push({ role: "ai", content: aiResponse });

    // Save chat history
    await saveChatHistory();

    // Update model status to show successful connection
    updateModelStatus(true);
  } catch (error) {
    console.error("[AI Chat] Error generating response:", error);
    hideTypingIndicator();
    updateModelStatus(false);
    showError("Failed to generate AI response. Please try again.");
  } finally {
    // Re-enable input
    chatInput.disabled = false;
    sendBtn.disabled = false;
    chatInput.focus();
  }
}

async function generateAIResponse(userMessage) {
  try {
    // Get the OpenRouter model name
    const openRouterModel =
      MODEL_MAPPINGS[currentModel] || MODEL_MAPPINGS["gpt-3.5-turbo"];

    console.log("[AI Chat] Using model:", openRouterModel);

    // Prepare the messages array for the API
    const messages = [
      {
        role: "system",
        content:
          "You are a helpful AI assistant integrated into the NULL VOID security extension. Provide accurate, helpful, and concise responses. You can help with cybersecurity, coding, research, and general questions.",
      },
      ...chatHistory.slice(-10), // Include last 10 messages for context
      {
        role: "user",
        content: userMessage,
      },
    ];

    console.log("[AI Chat] Sending request to OpenRouter API:", {
      model: openRouterModel,
      messageCount: messages.length,
    });

    // Make API request to OpenRouter
    const response = await fetch(OPENROUTER_BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nullvoid.extension",
        "X-Title": "NULL VOID Extension",
      },
      body: JSON.stringify({
        model: openRouterModel,
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[AI Chat] API Error:", response.status, errorData);
      throw new Error(`API Error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error("Invalid response format from API");
    }

    const aiResponse = data.choices[0].message.content;
    console.log("[AI Chat] Received response from API");

    return aiResponse;
  } catch (error) {
    console.error("[AI Chat] Error calling OpenRouter API:", error);

    // Fallback to mock response if API fails
    return `I apologize, but I'm currently unable to connect to the AI service. This might be due to network connectivity or API limitations. Please try again in a moment.\n\nError: ${error.message}`;
  }
}

function displayMessage(role, content, animate = true) {
  const chatMessages = document.getElementById("chatMessages");

  // Clear welcome message if it exists
  const welcomeMessage = chatMessages.querySelector(".welcome-message");
  if (welcomeMessage) {
    welcomeMessage.remove();
  }

  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = role === "user" ? "👤" : "🤖";

  const contentDiv = document.createElement("div");
  contentDiv.className = "message-content";

  // Format code blocks and other formatting
  const formattedContent = formatMessageContent(content);
  contentDiv.innerHTML = formattedContent;

  messageDiv.appendChild(avatar);
  messageDiv.appendChild(contentDiv);

  if (animate) {
    messageDiv.style.opacity = "0";
    messageDiv.style.transform = "translateY(20px)";
  }

  chatMessages.appendChild(messageDiv);

  if (animate) {
    setTimeout(() => {
      messageDiv.style.transition = "all 0.3s ease";
      messageDiv.style.opacity = "1";
      messageDiv.style.transform = "translateY(0)";
    }, 50);
  }

  scrollToBottom();
}

function formatMessageContent(content) {
  // Convert markdown-style code blocks to HTML
  content = content.replace(
    /```(\w+)?\n([\s\S]*?)```/g,
    "<pre><code>$2</code></pre>"
  );

  // Convert inline code
  content = content.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Convert line breaks
  content = content.replace(/\n/g, "<br>");

  // Convert **bold** text
  content = content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  return content;
}

function showTypingIndicator() {
  const typingIndicator = document.getElementById("typingIndicator");
  if (typingIndicator) {
    typingIndicator.style.display = "flex";
    scrollToBottom();
  }
}

function hideTypingIndicator() {
  const typingIndicator = document.getElementById("typingIndicator");
  if (typingIndicator) {
    typingIndicator.style.display = "none";
  }
}

function scrollToBottom() {
  const chatMessages = document.getElementById("chatMessages");
  if (chatMessages) {
    setTimeout(() => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 100);
  }
}

function showError(message) {
  const errorDiv = document.getElementById("errorMessage");
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = "block";

    setTimeout(() => {
      errorDiv.style.display = "none";
    }, 5000);
  } else {
    // Fallback: display error in chat
    displayMessage("ai", `❌ Error: ${message}`);
  }
}

async function saveChatHistory() {
  try {
    // Only save last 50 messages to prevent storage bloat
    const trimmedHistory = chatHistory.slice(-50);
    await browserAPI.storage.local.set({ aiChatHistory: trimmedHistory });
  } catch (error) {
    console.error("[AI Chat] Failed to save chat history:", error);
  }
}

// Quick action functions
function sendQuickMessage(message) {
  const chatInput = document.getElementById("chatInput");
  if (chatInput) {
    chatInput.value = message;
    sendMessage();
  }
}

// Clear chat function
async function clearChat() {
  chatHistory = [];
  await browserAPI.storage.local.remove(["aiChatHistory"]);
  location.reload();
}

// Model status management
function updateModelStatus(connected) {
  const modelStatus = document.querySelector(".model-status");
  if (modelStatus) {
    if (connected) {
      modelStatus.style.background = "#10b981"; // Green for connected
      modelStatus.style.animation = "pulse 2s infinite";
    } else {
      modelStatus.style.background = "#ef4444"; // Red for error
      modelStatus.style.animation = "none";
    }
  }
}

// Test API connection
async function testAPIConnection() {
  try {
    const response = await fetch(OPENROUTER_BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nullvoid.extension",
        "X-Title": "NULL VOID Extension",
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo",
        messages: [{ role: "user", content: "test" }],
        max_tokens: 10,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("[AI Chat] API test failed:", error);
    return false;
  }
}

// Export functions for potential external use
window.aiChat = {
  sendMessage,
  clearChat,
  sendQuickMessage,
};
