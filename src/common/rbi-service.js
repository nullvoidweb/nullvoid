// Remote Browser Isolation Service - Core Implementation
// This handles the actual RBI backend integration

class RemoteBrowserIsolationService {
  constructor() {
    this.baseUrl = "https://rbi-api.nullvoid.com";
    this.websocketUrl = "wss://rbi-stream.nullvoid.com";
    this.sessionId = null;
    this.websocket = null;
    this.currentLocation = "singapore";
    this.isConnected = false;

    // RBI Endpoints by region
    this.endpoints = {
      singapore: {
        api: "https://sg-rbi-api.nullvoid.com",
        stream: "wss://sg-rbi-stream.nullvoid.com",
        region: "ap-southeast-1",
        flag: "🇸🇬",
      },
      usa: {
        api: "https://us-rbi-api.nullvoid.com",
        stream: "wss://us-rbi-stream.nullvoid.com",
        region: "us-east-1",
        flag: "🇺🇸",
      },
      uk: {
        api: "https://uk-rbi-api.nullvoid.com",
        stream: "wss://uk-rbi-stream.nullvoid.com",
        region: "eu-west-2",
        flag: "🇬🇧",
      },
      canada: {
        api: "https://ca-rbi-api.nullvoid.com",
        stream: "wss://ca-rbi-stream.nullvoid.com",
        region: "ca-central-1",
        flag: "🇨🇦",
      },
    };
  }

  // Initialize RBI session
  async initializeSession(location = "singapore") {
    try {
      this.currentLocation = location;
      const endpoint = this.endpoints[location];

      console.log(`[PRODUCTION] Initializing RBI session in ${location}...`);

      const response = await fetch(`${endpoint.api}/session/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-Type": "chrome-extension",
          "X-Client-Version": "1.0",
          "X-Environment": "production",
        },
        body: JSON.stringify({
          location: location,
          userAgent: navigator.userAgent,
          extensions: ["nullvoid"],
          security: {
            blockAds: true,
            blockTrackers: true,
            blockMalware: true,
            enforceHTTPS: true,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(
          `Failed to create RBI session: ${response.statusText} - ${errorData.error}`
        );
      }

      const sessionData = await response.json();
      this.sessionId = sessionData.sessionId;

      console.log(`[PRODUCTION] RBI session created: ${this.sessionId}`);

      // Initialize WebSocket connection for real-time streaming
      await this.initializeWebSocket();

      return {
        sessionId: this.sessionId,
        location: location,
        endpoint: endpoint,
        status: "connected",
      };
    } catch (error) {
      console.error("[PRODUCTION] RBI session initialization failed:", error);
      throw error;
    }
  }

  // Initialize WebSocket for real-time browser streaming
  async initializeWebSocket() {
    return new Promise((resolve, reject) => {
      const endpoint = this.endpoints[this.currentLocation];
      const wsUrl = `${endpoint.stream}/session/${this.sessionId}`;

      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = () => {
        console.log("RBI WebSocket connected");
        this.isConnected = true;

        // Send initial configuration
        this.sendCommand({
          type: "configure",
          config: {
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight,
            },
            userAgent: navigator.userAgent,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        });

        resolve();
      };

      this.websocket.onmessage = (event) => {
        this.handleWebSocketMessage(event);
      };

      this.websocket.onclose = () => {
        console.log("RBI WebSocket disconnected");
        this.isConnected = false;
      };

      this.websocket.onerror = (error) => {
        console.error("RBI WebSocket error:", error);
        reject(error);
      };
    });
  }

  // Handle incoming WebSocket messages
  handleWebSocketMessage(event) {
    try {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case "screen_update":
          this.updateBrowserDisplay(message.data);
          break;
        case "url_changed":
          this.updateUrlDisplay(message.data.url);
          break;
        case "page_loaded":
          this.handlePageLoaded(message.data);
          break;
        case "error":
          this.handleError(message.data);
          break;
        case "session_expired":
          this.handleSessionExpired();
          break;
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
    }
  }

  // Navigate to URL in remote browser
  async navigateToUrl(url) {
    if (!this.isConnected) {
      throw new Error("RBI session not connected");
    }

    try {
      const endpoint = this.endpoints[this.currentLocation];

      const response = await fetch(
        `${endpoint.api}/session/${this.sessionId}/navigate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: url,
            timeout: 30000,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Navigation failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("RBI navigation failed:", error);
      throw error;
    }
  }

  // Send command to remote browser
  sendCommand(command) {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(command));
    }
  }

  // Browser navigation commands
  goBack() {
    this.sendCommand({ type: "navigate", action: "back" });
  }

  goForward() {
    this.sendCommand({ type: "navigate", action: "forward" });
  }

  refresh() {
    this.sendCommand({ type: "navigate", action: "refresh" });
  }

  // Mouse and keyboard interaction
  sendMouseClick(x, y) {
    this.sendCommand({
      type: "mouse",
      action: "click",
      x: x,
      y: y,
    });
  }

  sendKeyboard(text) {
    this.sendCommand({
      type: "keyboard",
      action: "type",
      text: text,
    });
  }

  // Update browser display with remote screen data
  updateBrowserDisplay(screenData) {
    const browserFrame = document.getElementById("rbi-browser-frame");
    if (browserFrame) {
      // Update with base64 encoded screen data
      browserFrame.src = `data:image/png;base64,${screenData.screenshot}`;

      // Update interactive elements
      this.updateInteractiveElements(screenData.elements);
    }
  }

  // Update URL display
  updateUrlDisplay(url) {
    const urlDisplay = document.querySelector(".rbi-url");
    if (urlDisplay) {
      urlDisplay.textContent = url;
    }
  }

  // Handle page loaded event
  handlePageLoaded(data) {
    console.log("Page loaded in RBI:", data.url);

    // Update UI
    const loadingIndicator = document.getElementById("rbi-loading");
    if (loadingIndicator) {
      loadingIndicator.style.display = "none";
    }

    // Show success status
    if (window.showStatus) {
      window.showStatus(
        `🏢 Page loaded in remote browser: ${data.title}`,
        "success"
      );
    }
  }

  // Handle RBI errors
  handleError(error) {
    console.error("RBI Error:", error);

    if (window.showStatus) {
      window.showStatus(`❌ RBI Error: ${error.message}`, "error");
    }
  }

  // Handle session expiration
  handleSessionExpired() {
    console.log("RBI session expired");
    this.cleanup();

    if (window.showStatus) {
      window.showStatus("🔄 Session expired. Please reconnect.", "warning");
    }
  }

  // Cleanup RBI session
  async cleanup() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    if (this.sessionId) {
      try {
        const endpoint = this.endpoints[this.currentLocation];
        await fetch(`${endpoint.api}/session/${this.sessionId}/close`, {
          method: "POST",
        });
      } catch (error) {
        console.error("Error closing RBI session:", error);
      }
    }

    this.sessionId = null;
    this.isConnected = false;
  }

  // Get session status
  getStatus() {
    return {
      connected: this.isConnected,
      sessionId: this.sessionId,
      location: this.currentLocation,
      endpoint: this.endpoints[this.currentLocation],
    };
  }
}

// Export for use in other modules
window.RemoteBrowserIsolationService = RemoteBrowserIsolationService;
