// Browserless.io Integration for NULL VOID RBI
// This service integrates with Browserless.io to provide true remote browser isolation

class BrowserlessRBIService {
  constructor(options = {}) {
    // Browserless API key
    this.apiKey = "2SgiPLlAtLyabl75ea63edb2fb15fcf000d866d90aa96ab13";

    // Browserless endpoints
    this.endpoints = {
      base: "https://chrome.browserless.io", // Start with the more reliable endpoint
      fallbackBase: "https://production-sfo.browserless.io",
      screenshot: "/screenshot",
      content: "/content",
      pdf: "/pdf",
      scrape: "/scrape",
      function: "/function", // Main endpoint for script execution
      json: "/json", // For API testing
      cdn: "https://cdn.browserless.io", // CDN endpoint for static assets
    };

    // Container element to display content
    this.containerElement = options.containerElement || null;

    // Callbacks
    this.onConnectionStatus = options.onConnectionStatus || (() => {});
    this.onNavigationChange = options.onNavigationChange || (() => {});
    this.onError = options.onError || (() => {});

    // Browser state
    this.currentUrl = "";
    this.sessionId = `nullvoid-session-${Date.now()}`;
    this.isConnected = false;
    this.isNavigating = false; // Prevent multiple simultaneous navigations
    this.liveUpdateInterval = null;
    this.refreshRate = options.refreshRate || 2000; // Slower refresh to reduce API calls

    // Set default viewport dimensions
    this.viewportWidth =
      options.width ||
      (this.containerElement ? this.containerElement.clientWidth : 1366);
    this.viewportHeight =
      options.height ||
      (this.containerElement ? this.containerElement.clientHeight : 768);

    // Live interaction parameters
    this.lastUpdateTime = 0;
    this.minTimeBetweenUpdates = 2000; // Increased to 2 seconds between updates
    this.retryDelay = 2000; // Increased initial retry delay
    this.maxRetryDelay = 30000; // Increased max retry delay
    this.isRetrying = false;
    this.isLiveMode = true; // Enable live interaction mode

    // Rate limiting parameters
    this.lastApiCall = 0;
    this.minApiCallInterval = 1500; // Minimum 1.5 seconds between API calls
    this.apiCallQueue = [];
    this.isProcessingApiQueue = false;

    // User interaction state
    this.lastClickTime = 0;
    this.clickCooldown = 1000; // Increased cooldown to 1 second
    this.pendingInteractions = []; // Queue for pending interactions
    this.isProcessingInteraction = false;

    // Browser session management
    this.browserSession = null;
    this.pageSession = null;

    // Region support
    this.region = options.region || "us";
    this.regionData = {
      name: this.getRegionName(this.region),
      flag: this.getRegionFlag(this.region),
    };

    console.log(
      `[Browserless RBI] Live interaction service initialized for region: ${this.regionData.name}`
    );
  }

  // Initialize the RBI service with live interaction
  async initialize() {
    try {
      console.log(
        "[Browserless RBI] Connecting to live interaction service..."
      );

      if (!this.containerElement) {
        throw new Error("Container element is required for RBI initialization");
      }

      // Clear the container
      this.containerElement.innerHTML = "";

      // Set viewport dimensions based on container size
      this.viewportWidth = this.containerElement.clientWidth || 1366;
      this.viewportHeight = this.containerElement.clientHeight || 768;
      console.log(
        `[Browserless RBI] Setting viewport: ${this.viewportWidth}x${this.viewportHeight}`
      );

      // Show initial loading indicator
      this.showLoadingIndicator();

      // Verify the API connection with a simple endpoint test
      try {
        const testResponse = await fetch(
          `${this.endpoints.base}/json?token=${this.apiKey}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-cache",
            },
          }
        );

        if (!testResponse.ok) {
          console.log(
            `[Browserless RBI] API test failed with status: ${testResponse.status}`
          );

          // Try the fallback base if the main one fails
          if (this.endpoints.base !== this.endpoints.fallbackBase) {
            this.endpoints.base = this.endpoints.fallbackBase;
            console.log(
              `[Browserless RBI] Switching to fallback endpoint: ${this.endpoints.base}`
            );
          }
        }
      } catch (apiError) {
        console.warn(
          `[Browserless RBI] API test request failed: ${apiError.message}`
        );

        // Switch to fallback endpoint if API test fails
        if (this.endpoints.base !== this.endpoints.fallbackBase) {
          this.endpoints.base = this.endpoints.fallbackBase;
          console.log(
            `[Browserless RBI] Switching to fallback endpoint: ${this.endpoints.base}`
          );
        }
      }

      // Test connection by navigating to a simple page
      const testUrl = "https://example.com";
      await this.navigateToUrl(testUrl);

      this.isConnected = true;
      this.onConnectionStatus("connected");

      console.log(
        "[Browserless RBI] Live interaction service connected successfully"
      );
      return true;
    } catch (error) {
      console.error(
        "[Browserless RBI] Live interaction connection failed:",
        error
      );
      this.onConnectionStatus("disconnected");
      this.onError(
        "connection_failed",
        "Failed to connect to live interaction service"
      );
      this.hideLoadingIndicator();
      throw error;
    }
  }

  // Navigate to a URL with live interaction
  async navigate(url) {
    if (!this.isConnected) {
      throw new Error("RBI service not connected");
    }

    // Prevent multiple simultaneous navigations
    if (this.isNavigating) {
      console.log("[Browserless RBI] Navigation already in progress, skipping");
      return false;
    }

    this.isNavigating = true;

    try {
      console.log(`[Browserless RBI] Navigating to: ${url}`);

      // Format URL with http protocol if missing
      if (!/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
      }

      // Validate URL
      const urlObj = new URL(url);
      console.log(`[Browserless RBI] Validated URL: ${urlObj.href}`);

      this.currentUrl = url;
      this.onNavigationChange({ url: this.currentUrl, title: "" });

      // Reset interaction state
      this.isRetrying = false;
      this.retryDelay = 2000;
      this.lastUpdateTime = 0;
      this.pendingInteractions = [];

      // Navigate to the URL using live interaction
      await this.navigateToUrl(url);

      // Start live updates with a delay to prevent immediate rate limiting
      setTimeout(() => {
        this.startLiveUpdates();
      }, 2000);

      return true;
    } catch (error) {
      console.error("[Browserless RBI] Navigation failed:", error);

      // Handle rate limiting gracefully
      if (error.message && error.message.includes("429")) {
        this.onError(
          "rate_limited",
          "Navigation rate limited. Please wait before trying again."
        );
      } else {
        this.onError(
          "navigation_failed",
          `Failed to navigate to ${url}: ${error.message}`
        );
      }
      throw error;
    } finally {
      this.isNavigating = false;
    }
  }

  // Navigate to URL with live session
  async navigateToUrl(url) {
    try {
      console.log(`[Browserless RBI] Live navigation to: ${url}`);

      // Check rate limiting
      const now = Date.now();
      const timeSinceLastApiCall = now - this.lastApiCall;

      if (timeSinceLastApiCall < this.minApiCallInterval) {
        const waitTime = this.minApiCallInterval - timeSinceLastApiCall;
        console.log(
          `[Browserless RBI] Rate limiting: waiting ${waitTime}ms before API call`
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      // Use a simpler approach if this is the first navigation attempt
      if (!this.isConnected) {
        // For the first navigation, use the more reliable screenshot API
        try {
          await this.takeScreenshot(url);
          return true;
        } catch (screenshotError) {
          console.error(
            "[Browserless RBI] Initial screenshot failed, falling back to function API"
          );
        }
      }

      this.lastApiCall = Date.now();

      const navigationScript = `
        async function navigateToUrl() {
          const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
          });
          
          const page = await browser.newPage();
          
          // Set viewport
          await page.setViewport({ 
            width: ${this.viewportWidth}, 
            height: ${this.viewportHeight} 
          });
          
          // Navigate to URL
          await page.goto('${url}', { 
            waitUntil: ['load', 'networkidle2'],
            timeout: 30000 
          });
          
          // Wait for page to be fully loaded
          await page.waitForTimeout(1000);
          
          // Get page title
          const title = await page.title();
          
          // Take initial screenshot
          const screenshot = await page.screenshot({ 
            encoding: 'base64',
            fullPage: false,
            clip: { x: 0, y: 0, width: ${this.viewportWidth}, height: ${this.viewportHeight} }
          });
          
          await browser.close();
          
          return { 
            success: true, 
            title: title,
            screenshot: screenshot,
            url: '${url}',
            timestamp: Date.now()
          };
        }
      `;

      // Use the function endpoint instead of direct puppeteer access
      const response = await fetch(
        `${this.endpoints.base}${this.endpoints.function}?token=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
          },
          body: JSON.stringify({
            code: navigationScript,
            context: {
              url: url,
              gotoOptions: {
                waitUntil: "networkidle2",
                timeout: 30000,
              },
            },
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limit error - implement exponential backoff
          const waitTime = Math.min(this.retryDelay * 2, this.maxRetryDelay);
          console.log(
            `[Browserless RBI] Rate limited (429). Waiting ${waitTime}ms before retry...`
          );

          await new Promise((resolve) => setTimeout(resolve, waitTime));
          this.retryDelay = waitTime;

          // Try again with a fallback approach
          console.log(
            "[Browserless RBI] Retrying with screenshot API due to rate limit"
          );
          await this.takeScreenshot(url);
          return true;
        }
        throw new Error(`Navigation failed: ${response.status}`);
      }

      const result = await response.json();

      if (result && result.screenshot) {
        console.log("[Browserless RBI] Live navigation successful");

        // Update display with new screenshot
        const imageUrl = `data:image/png;base64,${result.screenshot}`;
        this.updateDisplay(imageUrl);

        // Update navigation info
        this.onNavigationChange({
          url: result.url,
          title: result.title || "",
        });
      } else {
        throw new Error("Navigation failed: No screenshot received");
      }
    } catch (error) {
      console.error("[Browserless RBI] Live navigation failed:", error);
      throw error;
    }
  }

  // Start live updates for real-time interaction
  startLiveUpdates() {
    // Clear any existing interval
    if (this.liveUpdateInterval) {
      clearInterval(this.liveUpdateInterval);
    }

    console.log("[Browserless RBI] Starting live updates...");

    // Set new interval for live updates with conservative timing
    this.liveUpdateInterval = setInterval(async () => {
      if (
        this.currentUrl &&
        this.isConnected &&
        !this.isProcessingInteraction &&
        !this.isNavigating
      ) {
        // Check if we need to respect rate limits
        const now = Date.now();
        const timeSinceLastUpdate = now - this.lastUpdateTime;
        const timeSinceLastApiCall = now - this.lastApiCall;

        // More conservative rate limiting
        if (
          timeSinceLastUpdate < this.minTimeBetweenUpdates ||
          timeSinceLastApiCall < this.minApiCallInterval
        ) {
          // Too soon since the last update or API call, skip this one
          return;
        }

        // If we're already in a retry backoff, skip this attempt
        if (this.isRetrying) {
          return;
        }

        try {
          this.lastUpdateTime = now;
          this.lastApiCall = now;

          // Skip live updates temporarily to avoid rate limiting
          // Only do updates if user is actively interacting
          if (this.pendingInteractions.length > 0) {
            await this.getLiveUpdate();
          }

          // Reset retry delay after successful update
          this.retryDelay = 2000;
        } catch (error) {
          console.error("[Browserless RBI] Live update failed:", error);

          // If this was a rate limit error (429), implement backoff
          if (error.message && error.message.includes("429")) {
            this.isRetrying = true;

            // Exponential backoff
            console.log(
              `[Browserless RBI] Rate limited: backing off for ${
                this.retryDelay / 1000
              }s`
            );

            setTimeout(() => {
              this.isRetrying = false;
              this.retryDelay = Math.min(
                this.retryDelay * 2,
                this.maxRetryDelay
              );
            }, this.retryDelay);
          }
        }
      }
    }, this.refreshRate);
  }

  // Stop live updates
  stopLiveUpdates() {
    if (this.liveUpdateInterval) {
      clearInterval(this.liveUpdateInterval);
      this.liveUpdateInterval = null;
      console.log("[Browserless RBI] Live updates stopped");
    }
  }

  // Get live update of current page state
  async getLiveUpdate() {
    if (!this.currentUrl) return;

    // Additional rate limiting check
    const now = Date.now();
    const timeSinceLastApiCall = now - this.lastApiCall;

    if (timeSinceLastApiCall < this.minApiCallInterval) {
      console.log(
        `[Browserless RBI] Skipping live update due to rate limiting`
      );
      return;
    }

    try {
      const updateScript = `
        async function getLiveUpdate() {
          const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
          });
          
          const page = await browser.newPage();
          
          // Set viewport
          await page.setViewport({ 
            width: ${this.viewportWidth}, 
            height: ${this.viewportHeight} 
          });
          
          // Navigate to current URL
          await page.goto('${this.currentUrl}', { 
            waitUntil: ['load', 'networkidle2'],
            timeout: 15000 
          });
          
          // Check for any dynamic content changes
          await page.waitForTimeout(500);
          
          // Get current page info
          const title = await page.title();
          const url = page.url();
          
          // Take screenshot
          const screenshot = await page.screenshot({ 
            encoding: 'base64',
            fullPage: false,
            clip: { x: 0, y: 0, width: ${this.viewportWidth}, height: ${this.viewportHeight} }
          });
          
          await browser.close();
          
          return { 
            success: true, 
            title: title,
            screenshot: screenshot,
            url: url,
            timestamp: Date.now()
          };
        }
      `;

      const response = await fetch(
        `${this.endpoints.base}${this.endpoints.function}?token=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
          },
          body: JSON.stringify({
            code: updateScript,
            context: {
              url: this.currentUrl,
              gotoOptions: {
                waitUntil: "networkidle2",
                timeout: 15000,
              },
            },
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();

        if (result && result.screenshot) {
          // Update display with new screenshot
          const imageUrl = `data:image/png;base64,${result.screenshot}`;
          this.updateDisplay(imageUrl);

          // Update navigation info if URL changed
          if (result.url !== this.currentUrl) {
            this.currentUrl = result.url;
            this.onNavigationChange({
              url: result.url,
              title: result.title || "",
            });
          }
        }
      } else if (response.status === 429) {
        // Rate limit - don't throw error, just log it
        console.log(
          `[Browserless RBI] Live update rate limited, skipping this update`
        );
        this.isRetrying = true;
        setTimeout(() => {
          this.isRetrying = false;
        }, this.retryDelay);
      }
    } catch (error) {
      console.error("[Browserless RBI] Live update failed:", error);
      // Don't throw error for live updates to avoid disrupting the service
    }
  }

  // Take screenshot of a URL
  async takeScreenshot(url) {
    if (!this.containerElement) {
      console.warn(
        "[Browserless RBI] No container element specified for screenshots"
      );
      return;
    }

    // Show loading indicator if no previous screenshot is available
    const imageElement =
      this.containerElement.querySelector("img.rbi-screenshot");
    if (!imageElement || !imageElement.src) {
      this.showLoadingIndicator();
    } else {
      // If we have a previous screenshot, just show a small loading indicator overlay
      this.showLoadingOverlay();
    }

    console.log(`[Browserless RBI] Taking screenshot of: ${url}`);

    // Updated API format for browserless.io - 2025 version
    // Use stored viewport dimensions
    const options = {
      url: url,
      // Use gotoOptions for additional settings
      gotoOptions: {
        waitUntil: "networkidle0",
        timeout: 30000, // Increase timeout for better reliability
      },
      // Use viewport for dimensions
      viewport: {
        width: this.viewportWidth,
        height: this.viewportHeight,
      },
      // Set userAgent as a string
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
    };

    console.log(`[Browserless RBI] Screenshot options:`, options);
    console.log(
      `[Browserless RBI] API endpoint: ${this.endpoints.base}${this.endpoints.screenshot}`
    );

    try {
      let response;

      try {
        // First try with the current API format
        response = await fetch(
          `${this.endpoints.base}${this.endpoints.screenshot}?token=${this.apiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-cache",
            },
            body: JSON.stringify(options),
          }
        );
      } catch (primaryError) {
        console.error(
          "[Browserless RBI] Primary API attempt failed:",
          primaryError
        );

        // If the first attempt fails, try a very basic format
        console.log("[Browserless RBI] Trying minimal API format...");
        const minimalOptions = {
          url: url,
        };

        // Try minimal format with original endpoint
        response = await fetch(
          `${this.endpoints.base}${this.endpoints.screenshot}?token=${this.apiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-cache",
            },
            body: JSON.stringify(minimalOptions),
          }
        );
      }

      console.log(`[Browserless RBI] API Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Browserless RBI] API Error Response:`, errorText);

        // If we get a 400 error, try with a minimal payload
        if (response.status === 400) {
          console.log(
            "[Browserless RBI] Trying minimal payload due to 400 error..."
          );
          const minimalResponse = await fetch(
            `${this.endpoints.base}${this.endpoints.screenshot}?token=${this.apiKey}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache",
              },
              body: JSON.stringify({ url: url }),
            }
          );

          if (minimalResponse.ok) {
            console.log("[Browserless RBI] Minimal payload succeeded!");
            response = minimalResponse;
          } else {
            // Try the fallback base URL if primary fails
            if (this.endpoints.base !== this.endpoints.fallbackBase) {
              console.log("[Browserless RBI] Trying fallback base URL...");
              // Use a simple options format for fallback
              const fallbackResponse = await fetch(
                `${this.endpoints.fallbackBase}${this.endpoints.screenshot}?token=${this.apiKey}`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "no-cache",
                  },
                  body: JSON.stringify({ url: url }),
                }
              );

              if (fallbackResponse.ok) {
                console.log("[Browserless RBI] Fallback endpoint succeeded!");
                response = fallbackResponse;
              } else {
                throw new Error(
                  `Screenshot API error: ${response.status} ${response.statusText} - ${errorText}`
                );
              }
            } else {
              throw new Error(
                `Screenshot API error: ${response.status} ${response.statusText} - ${errorText}`
              );
            }
          }
        } else {
          // Try the fallback base URL if primary fails
          if (this.endpoints.base !== this.endpoints.fallbackBase) {
            console.log("[Browserless RBI] Trying fallback base URL...");
            // Use a simple options format for fallback
            const fallbackResponse = await fetch(
              `${this.endpoints.fallbackBase}${this.endpoints.screenshot}?token=${this.apiKey}`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Cache-Control": "no-cache",
                },
                body: JSON.stringify({ url: url }),
              }
            );

            if (fallbackResponse.ok) {
              console.log("[Browserless RBI] Fallback endpoint succeeded!");
              response = fallbackResponse;
            } else {
              throw new Error(
                `Screenshot API error: ${response.status} ${response.statusText} - ${errorText}`
              );
            }
          } else {
            throw new Error(
              `Screenshot API error: ${response.status} ${response.statusText} - ${errorText}`
            );
          }
        }
      }

      // Get the blob
      const blob = await response.blob();
      console.log(`[Browserless RBI] Screenshot blob size: ${blob.size} bytes`);

      // Create an object URL for the blob
      const imageUrl = URL.createObjectURL(blob);

      // Update container with the new screenshot
      this.updateDisplay(imageUrl);

      return imageUrl;
    } catch (error) {
      console.error("[Browserless RBI] Screenshot failed:", error);

      // Show error message in container
      if (this.containerElement) {
        // Special handling for rate limit errors
        if (error.message && error.message.includes("429 Too Many Requests")) {
          console.log(
            "[Browserless RBI] Rate limit error detected, will retry shortly..."
          );

          // For rate limit errors, don't always show the error to the user if we have a previous image
          const imageElement =
            this.containerElement.querySelector("img.rbi-screenshot");
          if (!imageElement || !imageElement.src) {
            this.containerElement.innerHTML = `
              <div style="display: flex; justify-content: center; align-items: center; height: 100%; 
                          font-family: Arial, sans-serif; color: #e67e22; text-align: center;">
                <div>
                  <h3>Remote Browser Busy</h3>
                  <p>The remote browser service is currently busy. Reconnecting...</p>
                  <p style="font-size: 12px; color: #666;">This will automatically resolve in a few seconds.</p>
                </div>
              </div>
            `;
          }
        } else {
          // Regular error handling for other errors
          this.containerElement.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100%; 
                        font-family: Arial, sans-serif; color: #d32f2f; text-align: center;">
              <div>
                <h3>Remote Browser Error</h3>
                <p>Failed to load webpage: ${error.message}</p>
                <p style="font-size: 12px; color: #666;">Please check your internet connection and try again.</p>
              </div>
            </div>
          `;
        }
      }

      throw error;
    }
  }

  // Get content of a URL
  async getContent(url) {
    const options = {
      url: url,
      // Updated to match new Browserless API format
      gotoOptions: {
        waitUntil: "networkidle0",
      },
    };

    try {
      const response = await fetch(
        `${this.endpoints.base}${this.endpoints.content}?token=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(options),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Content API error: ${response.status} ${response.statusText}`
        );
      }

      const content = await response.text();
      return content;
    } catch (error) {
      console.error("[Browserless RBI] Content fetch failed:", error);
      throw error;
    }
  }

  // Run a function in the browser
  async runFunction(url, functionToRun) {
    // Updated to match new Browserless API format
    const options = {
      url: url,
      gotoOptions: {
        waitUntil: "networkidle0",
      },
      fn: functionToRun.toString(),
    };

    try {
      const response = await fetch(
        `${this.endpoints.base}${this.endpoints.function}?token=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(options),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Function API error: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("[Browserless RBI] Function execution failed:", error);
      throw error;
    }
  }

  // Update the container with a new screenshot
  updateDisplay(imageUrl) {
    if (!this.containerElement) return;

    // Remove any loading indicators
    this.hideLoadingIndicator();

    // Check if image element exists
    let imageElement =
      this.containerElement.querySelector("img.rbi-screenshot");

    if (!imageElement) {
      // Create a new image element
      imageElement = document.createElement("img");
      imageElement.className = "rbi-screenshot";
      imageElement.style.width = "100%";
      imageElement.style.height = "100%";
      imageElement.style.objectFit = "contain";
      imageElement.style.border = "none";
      imageElement.style.cursor = "pointer"; // Show pointer cursor to indicate interactivity
      this.containerElement.innerHTML = ""; // Clear container
      this.containerElement.appendChild(imageElement);

      // Add click event listener to the image
      const self = this;
      imageElement.addEventListener("click", function (event) {
        // Check for click rate limiting to prevent accidental double-clicks
        const now = Date.now();
        if (now - self.lastClickTime < self.clickCooldown) {
          console.log(
            "[Browserless RBI] Click ignored - too soon after previous click"
          );
          return;
        }

        // Update last click time
        self.lastClickTime = now;

        // Show a loading overlay to indicate the click is being processed
        self.showLoadingOverlay();

        // Forward the click event to the live interaction system
        self.sendMouseEvent(event);

        // Show a temporary visual feedback for the click
        const clickFeedback = document.createElement("div");
        clickFeedback.style.position = "absolute";
        clickFeedback.style.width = "20px";
        clickFeedback.style.height = "20px";
        clickFeedback.style.borderRadius = "50%";
        clickFeedback.style.backgroundColor = "rgba(0, 255, 0, 0.6)"; // Green for live interaction
        clickFeedback.style.transform = "translate(-50%, -50%)";
        clickFeedback.style.left = event.clientX + "px";
        clickFeedback.style.top = event.clientY + "px";
        clickFeedback.style.zIndex = "9999";
        clickFeedback.style.pointerEvents = "none";
        clickFeedback.style.animation = "pulse 0.5s ease-out forwards";

        // Add the animation style if it doesn't exist
        if (!document.getElementById("click-animation")) {
          const style = document.createElement("style");
          style.id = "click-animation";
          style.textContent = `
            @keyframes pulse {
              0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
              100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
            }
          `;
          document.head.appendChild(style);
        }

        document.body.appendChild(clickFeedback);

        // Remove the feedback element after animation completes
        setTimeout(() => {
          if (clickFeedback.parentNode) {
            clickFeedback.parentNode.removeChild(clickFeedback);
          }
        }, 500);
      });
    }

    // Set the src to the new image URL
    imageElement.src = imageUrl;
  }

  // Go back in history
  async goBack() {
    try {
      console.log("[Browserless RBI] Back navigation");

      // Use the function API to navigate back
      await this.runFunction(this.currentUrl, () => {
        window.history.back();
        return { url: window.location.href };
      }).then((result) => {
        if (result && result.url) {
          this.currentUrl = result.url;
          this.onNavigationChange({ url: result.url });
          this.takeScreenshot(this.currentUrl);
        }
      });
    } catch (error) {
      console.error("[Browserless RBI] Back navigation failed:", error);
    }
  }

  // Go forward in history
  async goForward() {
    try {
      console.log("[Browserless RBI] Forward navigation");

      // Use the function API to navigate forward
      await this.runFunction(this.currentUrl, () => {
        window.history.forward();
        return { url: window.location.href };
      }).then((result) => {
        if (result && result.url) {
          this.currentUrl = result.url;
          this.onNavigationChange({ url: result.url });
          this.takeScreenshot(this.currentUrl);
        }
      });
    } catch (error) {
      console.error("[Browserless RBI] Forward navigation failed:", error);
    }
  }

  // Refresh the current page
  async refresh() {
    try {
      console.log("[Browserless RBI] Refreshing page");
      if (this.currentUrl) {
        await this.navigate(this.currentUrl);
      }
    } catch (error) {
      console.error("[Browserless RBI] Refresh failed:", error);
    }
  }

  // Send keyboard input
  async sendKeyboard(event) {
    // This is not supported in the basic Browserless API
    console.log(
      "[Browserless RBI] Keyboard input not supported in basic integration"
    );
  }

  // Enhanced live mouse event handling
  async sendMouseEvent(event) {
    if (!this.currentUrl || !this.isConnected) {
      console.log("[Browserless RBI] Cannot send mouse event: no active page");
      return;
    }

    // Add to pending interactions queue
    const interaction = {
      type: "click",
      event: event,
      timestamp: Date.now(),
    };

    this.pendingInteractions.push(interaction);

    // Process interactions if not already processing
    if (!this.isProcessingInteraction) {
      this.processInteractions();
    }
  }

  // Process pending interactions
  async processInteractions() {
    if (this.isProcessingInteraction || this.pendingInteractions.length === 0) {
      return;
    }

    this.isProcessingInteraction = true;

    try {
      // Get the next interaction
      const interaction = this.pendingInteractions.shift();

      if (interaction.type === "click") {
        await this.processClickInteraction(interaction.event);
      }

      // Add small delay between interactions
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error("[Browserless RBI] Interaction processing failed:", error);
      this.hideLoadingIndicator();
    } finally {
      this.isProcessingInteraction = false;

      // Process next interaction if any
      if (this.pendingInteractions.length > 0) {
        setTimeout(() => this.processInteractions(), 50);
      }
    }
  }

  // Process click interaction with live response
  async processClickInteraction(event) {
    try {
      // Calculate relative coordinates from the event
      const rect = this.containerElement.getBoundingClientRect();
      const relX = (event.clientX - rect.left) / rect.width;
      const relY = (event.clientY - rect.top) / rect.height;

      console.log(
        `[Browserless RBI] Processing live click at: ${relX.toFixed(
          2
        )}, ${relY.toFixed(2)}`
      );

      // Calculate absolute coordinates
      const pageX = Math.floor(relX * this.viewportWidth);
      const pageY = Math.floor(relY * this.viewportHeight);

      console.log(
        `[Browserless RBI] Live click coordinates: ${pageX}, ${pageY}`
      );

      // Create live interaction script
      const liveClickScript = `
        async function processLiveClick() {
          const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
          });
          
          const page = await browser.newPage();
          
          // Set viewport
          await page.setViewport({ 
            width: ${this.viewportWidth}, 
            height: ${this.viewportHeight} 
          });
          
          // Navigate to current URL
          await page.goto('${this.currentUrl}', { 
            waitUntil: ['load', 'networkidle2'],
            timeout: 20000 
          });
          
          // Wait for page to be interactive
          await page.waitForTimeout(500);
          
          // Get element info at click position
          const elementInfo = await page.evaluate((x, y) => {
            const element = document.elementFromPoint(x, y);
            if (!element) return null;
            
            return {
              tagName: element.tagName,
              id: element.id || '',
              className: element.className || '',
              type: element.getAttribute('type') || '',
              isInput: ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName),
              isInteractive: ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName) ||
                            element.hasAttribute('onclick') || element.getAttribute('role') === 'button',
              text: element.textContent ? element.textContent.substring(0, 50) : ''
            };
          }, ${pageX}, ${pageY});
          
          console.log('Element at click position:', elementInfo);
          
          // Perform click with enhanced interaction
          await page.mouse.move(${pageX}, ${pageY});
          await page.mouse.click(${pageX}, ${pageY});
          
          // Wait for any changes to occur
          if (elementInfo && elementInfo.isInteractive) {
            // Wait longer for interactive elements
            await page.waitForTimeout(800);
          } else {
            await page.waitForTimeout(300);
          }
          
          // Wait for navigation or network activity
          try {
            await Promise.race([
              page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 3000 }),
              page.waitForTimeout(1000)
            ]);
          } catch (e) {
            // Continue if navigation doesn't occur
          }
          
          // Get updated page info
          const title = await page.title();
          const url = page.url();
          
          // Take screenshot of current state
          const screenshot = await page.screenshot({ 
            encoding: 'base64',
            fullPage: false,
            clip: { x: 0, y: 0, width: ${this.viewportWidth}, height: ${this.viewportHeight} }
          });
          
          await browser.close();
          
          return { 
            success: true, 
            elementInfo: elementInfo,
            title: title,
            url: url,
            screenshot: screenshot,
            timestamp: Date.now()
          };
        }
      `;

      const response = await fetch(
        `${this.endpoints.base}${this.endpoints.function}?token=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
          },
          body: JSON.stringify({
            code: liveClickScript,
            context: {
              url: this.currentUrl,
              gotoOptions: {
                waitUntil: "networkidle2",
                timeout: 15000,
              },
            },
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();

        if (result && result.screenshot) {
          console.log(
            "[Browserless RBI] Live click successful:",
            result.elementInfo
          );

          // Update display immediately with new screenshot
          const imageUrl = `data:image/png;base64,${result.screenshot}`;
          this.updateDisplay(imageUrl);

          // Update current URL if it changed
          if (result.url !== this.currentUrl) {
            this.currentUrl = result.url;
            this.onNavigationChange({
              url: result.url,
              title: result.title || "",
            });
          }

          return result;
        }
      } else {
        console.error("[Browserless RBI] Live click failed:", response.status);
      }
    } catch (error) {
      console.error("[Browserless RBI] Live click processing failed:", error);
      throw error;
    }
  }

  // Clean up resources
  async cleanup() {
    console.log("[Browserless RBI] Cleaning up live interaction resources");

    // Stop live updates
    this.stopLiveUpdates();

    // Clear pending interactions
    this.pendingInteractions = [];
    this.isProcessingInteraction = false;

    // Reset connection state
    this.isConnected = false;
    this.isNavigating = false;
    this.isRetrying = false;
    this.browserSession = null;
    this.pageSession = null;

    if (this.containerElement) {
      this.containerElement.innerHTML = "";
    }

    this.onConnectionStatus("disconnected");
  }

  // Get region name
  getRegionName(region) {
    const regions = {
      sg: "Singapore",
      us: "United States",
      uk: "United Kingdom",
      ca: "Canada",
    };

    return regions[region] || "United States";
  }

  // Get region flag emoji
  getRegionFlag(region) {
    const flags = {
      sg: "🇸🇬",
      us: "🇺🇸",
      uk: "🇬🇧",
      ca: "🇨🇦",
    };

    return flags[region] || "🇺🇸";
  }

  // Show full loading indicator when no screenshot is available
  showLoadingIndicator() {
    if (!this.containerElement) return;

    // Remove any existing loading indicators
    this.hideLoadingIndicator();

    // Create loading container
    const loadingContainer = document.createElement("div");
    loadingContainer.className = "rbi-loading-container";
    loadingContainer.style.position = "absolute";
    loadingContainer.style.top = "0";
    loadingContainer.style.left = "0";
    loadingContainer.style.width = "100%";
    loadingContainer.style.height = "100%";
    loadingContainer.style.display = "flex";
    loadingContainer.style.justifyContent = "center";
    loadingContainer.style.alignItems = "center";
    loadingContainer.style.backgroundColor = "#f0f0f0";
    loadingContainer.style.zIndex = "1000";

    // Create spinner
    const spinner = document.createElement("div");
    spinner.className = "rbi-spinner";
    spinner.style.width = "50px";
    spinner.style.height = "50px";
    spinner.style.border = "5px solid #ddd";
    spinner.style.borderTopColor = "#3498db";
    spinner.style.borderRadius = "50%";
    spinner.style.animation = "rbi-spin 1s linear infinite";

    // Add animation style if it doesn't exist
    if (!document.querySelector("#rbi-spinner-style")) {
      const style = document.createElement("style");
      style.id = "rbi-spinner-style";
      style.textContent = `
        @keyframes rbi-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }

    loadingContainer.appendChild(spinner);

    // Add loading text
    const loadingText = document.createElement("div");
    loadingText.textContent = "Loading...";
    loadingText.style.marginLeft = "15px";
    loadingText.style.fontFamily = "Arial, sans-serif";
    loadingText.style.color = "#333";

    loadingContainer.appendChild(loadingText);

    // Make container relative if it's not already
    if (getComputedStyle(this.containerElement).position === "static") {
      this.containerElement.style.position = "relative";
    }

    this.containerElement.appendChild(loadingContainer);
  }

  // Show a smaller loading overlay for clicks and updates
  showLoadingOverlay() {
    if (!this.containerElement) return;

    // Remove any existing loading overlays
    const existingOverlay = this.containerElement.querySelector(
      ".rbi-loading-overlay"
    );
    if (existingOverlay) return; // Don't create multiple overlays

    const overlay = document.createElement("div");
    overlay.className = "rbi-loading-overlay";
    overlay.style.position = "absolute";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(255, 255, 255, 0.5)";
    overlay.style.display = "flex";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.style.zIndex = "999";

    // Create small spinner
    const spinner = document.createElement("div");
    spinner.className = "rbi-spinner-small";
    spinner.style.width = "30px";
    spinner.style.height = "30px";
    spinner.style.border = "3px solid #ddd";
    spinner.style.borderTopColor = "#3498db";
    spinner.style.borderRadius = "50%";
    spinner.style.animation = "rbi-spin 1s linear infinite";

    overlay.appendChild(spinner);

    // Make container relative if it's not already
    if (getComputedStyle(this.containerElement).position === "static") {
      this.containerElement.style.position = "relative";
    }

    this.containerElement.appendChild(overlay);
  }

  // Hide all loading indicators
  hideLoadingIndicator() {
    if (!this.containerElement) return;

    const loadingElements = this.containerElement.querySelectorAll(
      ".rbi-loading-container, .rbi-loading-overlay"
    );
    loadingElements.forEach((element) => {
      if (element.parentNode === this.containerElement) {
        this.containerElement.removeChild(element);
      }
    });
  }
}

// Export the service
window.BrowserlessRBIService = BrowserlessRBIService;
