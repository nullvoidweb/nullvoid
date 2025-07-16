// Browserless.io Integration for NULL VOID RBI
// This service integrates with Browserless.io to provide true remote browser isolation

class BrowserlessRBIService {
  constructor(options = {}) {
    // Browserless API key
    this.apiKey = "2SgiPLlAtLyabl75ea63edb2fb15fcf000d866d90aa96ab13";

    // Browserless endpoints
    this.endpoints = {
      base: "https://production-sfo.browserless.io",
      fallbackBase: "https://chrome.browserless.io",
      screenshot: "/screenshot",
      content: "/content",
      pdf: "/pdf",
      scrape: "/scrape",
      function: "/function",
      puppeteer: "/puppeteer", // Direct puppeteer endpoint
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
    this.screenshotInterval = null;
    this.refreshRate = options.refreshRate || 4000; // Increased refresh rate to avoid rate limiting

    // Set default viewport dimensions
    this.viewportWidth =
      options.width ||
      (this.containerElement ? this.containerElement.clientWidth : 1366);
    this.viewportHeight =
      options.height ||
      (this.containerElement ? this.containerElement.clientHeight : 768);

    // Rate limiting parameters
    this.lastScreenshotTime = 0;
    this.minTimeBetweenRequests = 2000; // Minimum 2 seconds between API calls
    this.retryDelay = 2000; // Initial retry delay
    this.maxRetryDelay = 30000; // Max retry delay of 30 seconds
    this.isRetrying = false; // Flag to track if we're in a retry state

    // User interaction state
    this.lastClickTime = 0;
    this.clickCooldown = 1000; // Prevent multiple clicks within 1 second

    // Region support
    this.region = options.region || "us";
    this.regionData = {
      name: this.getRegionName(this.region),
      flag: this.getRegionFlag(this.region),
    };

    console.log(
      `[Browserless RBI] Service initialized for region: ${this.regionData.name}`
    );
  }

  // Initialize the RBI service
  async initialize() {
    try {
      console.log("[Browserless RBI] Connecting to service...");

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

      // Test connection by taking a simple screenshot
      const testUrl = "https://example.com";
      await this.takeScreenshot(testUrl);

      this.isConnected = true;
      this.onConnectionStatus("connected");

      console.log("[Browserless RBI] Connection established successfully");
      return true;
    } catch (error) {
      console.error("[Browserless RBI] Connection failed:", error);
      this.onConnectionStatus("disconnected");
      this.onError(
        "connection_failed",
        "Failed to connect to remote browser service"
      );
      this.hideLoadingIndicator();
      throw error;
    }
  }

  // Navigate to a URL
  async navigate(url) {
    if (!this.isConnected) {
      throw new Error("RBI service not connected");
    }

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

      // Reset any rate limiting state when navigating
      this.isRetrying = false;
      this.retryDelay = 2000;
      this.lastScreenshotTime = 0;

      // Take screenshot of the URL - this is the initial load
      await this.takeScreenshot(url);

      // Start screenshot refresh interval with a delay to avoid immediate rate limiting
      setTimeout(() => {
        this.startScreenshotRefresh();
      }, 1000);

      return true;
    } catch (error) {
      console.error("[Browserless RBI] Navigation failed:", error);
      this.onError(
        "navigation_failed",
        `Failed to navigate to ${url}: ${error.message}`
      );
      throw error;
    }
  }

  // Start refreshing screenshots regularly with rate limiting
  startScreenshotRefresh() {
    // Clear any existing interval
    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval);
    }

    // Set new interval with rate limiting
    this.screenshotInterval = setInterval(async () => {
      if (this.currentUrl && this.isConnected) {
        // Check if we need to respect rate limits
        const now = Date.now();
        const timeSinceLastScreenshot = now - this.lastScreenshotTime;

        if (timeSinceLastScreenshot < this.minTimeBetweenRequests) {
          // Too soon since the last request, skip this one
          console.log(
            `[Browserless RBI] Rate limiting: skipping screenshot (${timeSinceLastScreenshot}ms since last)`
          );
          return;
        }

        // If we're already in a retry backoff, skip this attempt
        if (this.isRetrying) {
          return;
        }

        try {
          this.lastScreenshotTime = now;
          await this.takeScreenshot(this.currentUrl);

          // Reset retry delay after successful request
          this.retryDelay = 2000;
        } catch (error) {
          console.error("[Browserless RBI] Screenshot refresh failed:", error);

          // If this was a rate limit error (429), implement backoff
          if (
            error.message &&
            error.message.includes("429 Too Many Requests")
          ) {
            this.isRetrying = true;

            // Exponential backoff
            console.log(
              `[Browserless RBI] Rate limited: backing off for ${
                this.retryDelay / 1000
              }s`
            );

            // Schedule a single retry after the backoff period
            setTimeout(() => {
              this.isRetrying = false;
              this.retryDelay = Math.min(
                this.retryDelay * 2,
                this.maxRetryDelay
              );
            }, this.retryDelay);
          }
          // Don't throw here to keep interval running
        }
      }
    }, this.refreshRate);
  }

  // Stop screenshot refresh
  stopScreenshotRefresh() {
    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval);
      this.screenshotInterval = null;
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

        // Forward the click event to the remote browser
        self.sendMouseEvent(event);

        // Show a temporary visual feedback for the click
        const clickFeedback = document.createElement("div");
        clickFeedback.style.position = "absolute";
        clickFeedback.style.width = "20px";
        clickFeedback.style.height = "20px";
        clickFeedback.style.borderRadius = "50%";
        clickFeedback.style.backgroundColor = "rgba(66, 133, 244, 0.5)";
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

  // Send mouse event
  async sendMouseEvent(event) {
    if (!this.currentUrl || !this.isConnected) {
      console.log("[Browserless RBI] Cannot send mouse event: no active page");
      return;
    }

    try {
      // Calculate relative coordinates from the event
      const rect = this.containerElement.getBoundingClientRect();
      const relX = (event.clientX - rect.left) / rect.width;
      const relY = (event.clientY - rect.top) / rect.height;

      console.log(
        `[Browserless RBI] Mouse event at relative position: ${relX.toFixed(
          2
        )}, ${relY.toFixed(2)}`
      );

      // Try a faster approach using direct Puppeteer API for clicks
      // This bypasses the function API which can be slower
      try {
        const viewportWidth = this.containerElement.clientWidth || 1366;
        const viewportHeight = this.containerElement.clientHeight || 768;

        // Calculate absolute coordinates
        const pageX = Math.floor(relX * viewportWidth);
        const pageY = Math.floor(relY * viewportHeight);

        console.log(
          `[Browserless RBI] Sending direct click at: ${pageX}, ${pageY}`
        );

        // Construct a puppeteer script to perform the click
        const apiUrl = `${this.endpoints.base}/puppeteer?token=${this.apiKey}`;

        const puppeteerScript = `
          async function browserlessFunc() {
            const browser = await puppeteer.launch();
            const page = await browser.newPage();
            
            // Set a reasonable timeout for actions
            await page.setDefaultNavigationTimeout(20000);
            await page.setDefaultTimeout(10000);
            
            // Set viewport to match the container
            await page.setViewport({ width: ${viewportWidth}, height: ${viewportHeight} });
            
            // Navigate to URL and wait for network to be idle
            await page.goto('${this.currentUrl}', { 
              waitUntil: ['load', 'networkidle2']
            });
            
            // First identify what element is at the click position
            const elementInfo = await page.evaluate((x, y) => {
              const element = document.elementFromPoint(x, y);
              if (!element) return null;
              
              // Get useful information about the element
              return {
                tagName: element.tagName,
                id: element.id || '',
                className: element.className || '',
                type: element.getAttribute('type') || '',
                isInput: ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName),
                isInteractive: ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName) ||
                              element.hasAttribute('onclick') || element.hasAttribute('role') === 'button'
              };
            }, ${pageX}, ${pageY});
            
            console.log('Element at click position:', elementInfo);
            
            // For interactive elements, wait for them to be ready
            if (elementInfo && elementInfo.isInteractive) {
              try {
                // Wait for element to be visible and ready for interaction
                await page.waitForFunction((x, y) => {
                  const element = document.elementFromPoint(x, y);
                  return element && 
                         !element.disabled && 
                         element.offsetParent !== null &&
                         window.getComputedStyle(element).visibility !== 'hidden';
                }, { timeout: 3000 }, ${pageX}, ${pageY});
              } catch (e) {
                console.log('Wait for interactive element timed out, proceeding anyway');
              }
            }
            
            // Perform a click at the specified coordinates
            await page.mouse.move(${pageX}, ${pageY});
            await page.mouse.click(${pageX}, ${pageY});
            
            // For input elements, wait for potential focus effects
            if (elementInfo && elementInfo.isInput) {
              await page.waitForTimeout(200);
            }
            
            // Wait for any navigation or Ajax requests to complete
            try {
              await Promise.race([
                page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 2000 }).catch(() => {}),
                page.waitForTimeout(1000)
              ]);
            } catch (e) {
              // Ignore timeout errors, we'll take a screenshot anyway
            }
            
            // Take a screenshot to return the updated state
            const screenshot = await page.screenshot({ encoding: 'base64' });
            
            await browser.close();
            return { success: true, screenshot: screenshot, elementInfo };
          }
        `;

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
          },
          body: JSON.stringify({ code: puppeteerScript }),
        });

        if (response.ok) {
          const result = await response.json();

          if (result && result.screenshot) {
            console.log(
              "[Browserless RBI] Direct click successful, updating display"
            );
            // Update the display with the new screenshot
            const imageUrl = `data:image/png;base64,${result.screenshot}`;
            this.updateDisplay(imageUrl);
            return; // Early return if successful
          }
        }

        // If we get here, the direct approach failed, fall back to the function API
        console.log(
          "[Browserless RBI] Direct click failed, falling back to function API"
        );
      } catch (directError) {
        console.warn(
          "[Browserless RBI] Direct click method failed:",
          directError
        );
        // Continue to fallback method
      }

      // Fallback to the original function API method
      await this.runFunction(
        this.currentUrl,
        (x, y) => {
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;

          // Calculate page coordinates
          const pageX = Math.floor(x * viewportWidth);
          const pageY = Math.floor(y * viewportHeight);

          console.log(`Clicking at coordinates: ${pageX}, ${pageY}`);

          // Create and dispatch a mouse click event
          try {
            // Find element at position
            const element = document.elementFromPoint(pageX, pageY);
            if (element) {
              // Focus the element first if it's an input
              if (
                element.tagName === "INPUT" ||
                element.tagName === "TEXTAREA"
              ) {
                element.focus();
              }
              // Click the element
              element.click();
              return {
                success: true,
                element: element.tagName,
                id: element.id,
              };
            } else {
              return { success: false, error: "No element found at position" };
            }
          } catch (err) {
            return { success: false, error: err.toString() };
          }
        },
        relX,
        relY
      ).then((result) => {
        console.log("[Browserless RBI] Click result:", result);

        // Take a new screenshot immediately to show the result of the click
        setTimeout(() => this.takeScreenshot(this.currentUrl), 300);
      });
    } catch (error) {
      console.error("[Browserless RBI] Mouse event failed:", error);
      // Hide loading indicator on error
      this.hideLoadingIndicator();
    }
  }

  // Clean up resources
  async cleanup() {
    console.log("[Browserless RBI] Cleaning up resources");
    this.stopScreenshotRefresh();
    this.isConnected = false;

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
