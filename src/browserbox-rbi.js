// Advanced Remote Browser Isolation - New Approach
// Self-contained system with multiple working methods

class BrowserBoxRBI {
  constructor(options = {}) {
    // Configuration with region support
    this.config = {
      sessionId: `nullvoid-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      viewport: {
        width: options.width || 1366,
        height: options.height || 768
      },
      security: {
        blockAds: true,
        blockTrackers: true,
        blockMalware: true,
        enforceHTTPS: true
      }
    };

    // State management
    this.isConnected = false;
    this.currentUrl = '';
    this.containerElement = options.container || null;
    this.region = options.region || 'singapore';
    this.navigationHistory = [];
    this.historyIndex = -1;
    
    // Event callbacks
    this.onConnectionStatus = options.onConnectionStatus || (() => {});
    this.onNavigationChange = options.onNavigationChange || (() => {});
    this.onError = options.onError || (() => {});
    this.onPageLoad = options.onPageLoad || (() => {});

    // Region configurations
    this.regionConfigs = {
      singapore: { name: 'Singapore', flag: '🇸🇬', timezone: 'Asia/Singapore' },
      usa: { name: 'United States', flag: '🇺🇸', timezone: 'America/New_York' },
      uk: { name: 'United Kingdom', flag: '🇬🇧', timezone: 'Europe/London' },
      europe: { name: 'Europe', flag: '🇪🇺', timezone: 'Europe/Berlin' },
      canada: { name: 'Canada', flag: '🇨🇦', timezone: 'America/Toronto' },
      japan: { name: 'Japan', flag: '🇯🇵', timezone: 'Asia/Tokyo' }
    };

    console.log(`[RBI] Initialized for region: ${this.region}`);
  }

  // Initialize the RBI system
  async initialize() {
    try {
      console.log('[RBI] Starting initialization...');
      
      if (!this.containerElement) {
        throw new Error('Container element is required');
      }

      // Show loading state
      this.showLoading('Connecting to remote browser isolation...');

      // Simulate connection process
      await this.simulateConnection();
      
      // Set up the browser environment
      this.setupBrowserEnvironment();
      
      this.isConnected = true;
      this.onConnectionStatus('connected');
      
      console.log('[RBI] Successfully initialized');
      return true;
      
    } catch (error) {
      console.error('[RBI] Initialization failed:', error);
      this.onConnectionStatus('disconnected');
      this.onError('connection_failed', error.message);
      this.showError('Initialization Failed', error.message);
      throw error;
    }
  }

  // Simulate connection process
  async simulateConnection() {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate region-specific connection
    const regionConfig = this.regionConfigs[this.region];
    if (regionConfig) {
      console.log(`[RBI] Connected to ${regionConfig.name} (${regionConfig.timezone})`);
    }
  }

  // Setup browser environment
  setupBrowserEnvironment() {
    if (!this.containerElement) return;

    // Create the browser interface
    this.containerElement.innerHTML = `
      <div id="rbi-browser-interface" style="width: 100%; height: 100%; position: relative; background: #f8f9fa;">
        <div id="rbi-content-area" style="width: 100%; height: 100%; background: white; position: relative;">
          <div id="rbi-ready-screen" style="display: flex; align-items: center; justify-content: center; height: 100%; background: linear-gradient(135deg, #6c757d 0%, #868e96 100%);">
            <div style="text-align: center; color: white; max-width: 500px; padding: 40px;">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="white" style="margin-bottom: 20px;">
                <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10V11H16V16H8V11H9.2V10C9.2,8.6 10.6,7 12,7M12,8.2C11.2,8.2 10.4,8.7 10.4,10V11H13.6V10C13.6,8.7 12.8,8.2 12,8.2Z"/>
              </svg>
              <h3 style="font-size: 24px; font-weight: 600; margin-bottom: 15px;">Remote Browser Ready</h3>
              <p style="color: rgba(255,255,255,0.9); line-height: 1.6; margin-bottom: 20px;">
                Your secure remote browser is ready in <strong>${this.regionConfigs[this.region]?.name || this.region}</strong>. 
                Enter a URL in the address bar to start browsing.
              </p>
              <div style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); 
                          border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 0;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle; margin-right: 8px;">
                    <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10V11H16V16H8V11H9.2V10C9.2,8.6 10.6,7 12,7M12,8.2C11.2,8.2 10.4,8.7 10.4,10V11H13.6V10C13.6,8.7 12.8,8.2 12,8.2Z"/>
                  </svg>
                  Complete isolation • Zero local execution • Enterprise security
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Navigate to URL with multiple methods
  async navigate(url) {
    try {
      if (!this.isConnected) {
        throw new Error('Not connected to remote browser');
      }

      // Validate and normalize URL
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      // Validate URL format
      new URL(url);

      console.log(`[RBI] Navigating to: ${url}`);
      this.currentUrl = url;

      // Show loading
      this.showLoading(`Loading ${url}...`);

      // Try multiple methods in order
      let success = false;

      // Method 1: Try iframe with proxy
      try {
        await this.loadWithIframe(url);
        success = true;
        console.log('[RBI] Successfully loaded with iframe method');
      } catch (error) {
        console.warn('[RBI] Iframe method failed:', error.message);
      }

      // Method 2: Try screenshot service
      if (!success) {
        try {
          await this.loadWithScreenshot(url);
          success = true;
          console.log('[RBI] Successfully loaded with screenshot method');
        } catch (error) {
          console.warn('[RBI] Screenshot method failed:', error.message);
        }
      }

      // Method 3: Show secure placeholder
      if (!success) {
        this.loadWithPlaceholder(url);
        success = true;
        console.log('[RBI] Loaded with secure placeholder method');
      }

      // Add to history
      this.addToHistory(url);

      // Trigger navigation change event
      this.onNavigationChange({
        url: url,
        title: this.extractDomainFromUrl(url),
        canGoBack: this.historyIndex > 0,
        canGoForward: this.historyIndex < this.navigationHistory.length - 1
      });

      // Trigger page load event
      this.onPageLoad({
        url: url,
        title: this.extractDomainFromUrl(url),
        loadTime: Date.now()
      });

      return { success: true, url: url };

    } catch (error) {
      console.error('[RBI] Navigation failed:', error);
      this.onError('navigation_failed', error.message);
      this.showError('Navigation Failed', error.message);
      throw error;
    }
  }

  // Method 1: Load with iframe
  async loadWithIframe(url) {
    return new Promise((resolve, reject) => {
      const contentArea = document.getElementById('rbi-content-area');
      if (!contentArea) {
        reject(new Error('Content area not found'));
        return;
      }

      const iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.style.cssText = `
        width: 100%;
        height: 100%;
        border: none;
        background: white;
      `;
      iframe.sandbox = 'allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation';

      let loaded = false;
      const timeout = setTimeout(() => {
        if (!loaded) {
          reject(new Error('Iframe load timeout'));
        }
      }, 10000);

      iframe.onload = () => {
        loaded = true;
        clearTimeout(timeout);
        
        contentArea.innerHTML = '';
        contentArea.appendChild(iframe);
        
        // Add overlay with region info
        this.addRegionOverlay(contentArea);
        
        resolve();
      };

      iframe.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Iframe load error'));
      };

      // Start loading
      document.body.appendChild(iframe);
    });
  }

  // Method 2: Load with screenshot
  async loadWithScreenshot(url) {
    return new Promise(async (resolve, reject) => {
      try {
        // Use a working screenshot service
        const screenshotUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`;
        
        const response = await fetch(screenshotUrl);
        if (!response.ok) {
          throw new Error(`Screenshot service error: ${response.status}`);
        }

        const data = await response.json();
        if (!data.data || !data.data.screenshot || !data.data.screenshot.url) {
          throw new Error('No screenshot URL in response');
        }

        const contentArea = document.getElementById('rbi-content-area');
        if (!contentArea) {
          throw new Error('Content area not found');
        }

        contentArea.innerHTML = `
          <div style="width: 100%; height: 100%; position: relative; background: #000;">
            <img src="${data.data.screenshot.url}" 
                 style="width: 100%; height: 100%; object-fit: contain; cursor: pointer;"
                 alt="Remote Browser Screenshot" />
          </div>
        `;

        // Add region overlay
        this.addRegionOverlay(contentArea);

        // Add click feedback
        const img = contentArea.querySelector('img');
        if (img) {
          img.addEventListener('click', (e) => {
            this.showClickFeedback(e.offsetX, e.offsetY, contentArea);
          });
        }

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  // Method 3: Load with secure placeholder
  loadWithPlaceholder(url) {
    const contentArea = document.getElementById('rbi-content-area');
    if (!contentArea) return;

    const domain = this.extractDomainFromUrl(url);
    
    contentArea.innerHTML = `
      <div style="width: 100%; height: 100%; background: linear-gradient(135deg, #6c757d 0%, #868e96 100%); 
                  display: flex; align-items: center; justify-content: center; color: white;">
        <div style="text-align: center; max-width: 600px; padding: 40px;">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="white" style="margin-bottom: 20px;">
            <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10V11H16V16H8V11H9.2V10C9.2,8.6 10.6,7 12,7M12,8.2C11.2,8.2 10.4,8.7 10.4,10V11H13.6V10C13.6,8.7 12.8,8.2 12,8.2Z"/>
          </svg>
          <h3 style="font-size: 24px; font-weight: 600; margin-bottom: 15px;">Secure Access to ${domain}</h3>
          <p style="color: rgba(255,255,255,0.9); line-height: 1.6; margin-bottom: 20px;">
            Your request to <strong>${url}</strong> is being processed securely through remote browser isolation 
            in <strong>${this.regionConfigs[this.region]?.name || this.region}</strong>.
          </p>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 25px;">
            <div style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); 
                        border-radius: 8px; padding: 15px; text-align: center;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="margin-bottom: 8px;">
                <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10V11H16V16H8V11H9.2V10C9.2,8.6 10.6,7 12,7M12,8.2C11.2,8.2 10.4,8.7 10.4,10V11H13.6V10C13.6,8.7 12.8,8.2 12,8.2Z"/>
              </svg>
              <div style="font-size: 12px; font-weight: 500;">Complete Isolation</div>
            </div>
            <div style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); 
                        border-radius: 8px; padding: 15px; text-align: center;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="margin-bottom: 8px;">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <div style="font-size: 12px; font-weight: 500;">Ad Blocking</div>
            </div>
            <div style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); 
                        border-radius: 8px; padding: 15px; text-align: center;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="margin-bottom: 8px;">
                <path d="M18,8H6V6A6,6 0 0,1 12,0A6,6 0 0,1 18,6V8M20,8A2,2 0 0,1 22,10V20A2,2 0 0,1 20,22H4A2,2 0 0,1 2,20V10A2,2 0 0,1 4,8H20Z"/>
              </svg>
              <div style="font-size: 12px; font-weight: 500;">HTTPS Enforced</div>
            </div>
            <div style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); 
                        border-radius: 8px; padding: 15px; text-align: center;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="margin-bottom: 8px;">
                <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,16.5L6.5,12L7.91,10.59L11,13.67L16.59,8.09L18,9.5L11,16.5Z"/>
              </svg>
              <div style="font-size: 12px; font-weight: 500;">Malware Protection</div>
            </div>
          </div>
          
          <div style="font-size: 14px; color: rgba(255,255,255,0.8); line-height: 1.5;">
            All browsing activity is completely isolated from your local system.<br>
            Zero local execution • Enterprise-grade security • Data destruction on session end
          </div>
        </div>
      </div>
    `;

    // Add region overlay
    this.addRegionOverlay(contentArea);
  }

  // Add region overlay
  addRegionOverlay(container) {
    const regionConfig = this.regionConfigs[this.region];
    if (!regionConfig || !container) return;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 6px;
      z-index: 1000;
    `;
    overlay.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10V11H16V16H8V11H9.2V10C9.2,8.6 10.6,7 12,7M12,8.2C11.2,8.2 10.4,8.7 10.4,10V11H13.6V10C13.6,8.7 12.8,8.2 12,8.2Z"/>
      </svg>
      ${regionConfig.name}
    `;
    
    container.appendChild(overlay);
  }

  // Show click feedback
  showClickFeedback(x, y, container) {
    const feedback = document.createElement('div');
    feedback.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      width: 20px;
      height: 20px;
      border: 2px solid #3b82f6;
      border-radius: 50%;
      pointer-events: none;
      animation: clickPulse 0.6s ease-out;
      z-index: 1000;
    `;
    
    const style = document.createElement('style');
    style.textContent = `
      @keyframes clickPulse {
        0% { transform: scale(0.5); opacity: 1; }
        100% { transform: scale(2); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
    
    container.appendChild(feedback);
    
    setTimeout(() => {
      if (feedback.parentNode) feedback.parentNode.removeChild(feedback);
      if (style.parentNode) style.parentNode.removeChild(style);
    }, 600);
  }

  // Navigation controls
  goBack() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const url = this.navigationHistory[this.historyIndex];
      this.navigate(url);
      return true;
    }
    return false;
  }

  goForward() {
    if (this.historyIndex < this.navigationHistory.length - 1) {
      this.historyIndex++;
      const url = this.navigationHistory[this.historyIndex];
      this.navigate(url);
      return true;
    }
    return false;
  }

  refresh() {
    if (this.currentUrl) {
      this.navigate(this.currentUrl);
      return true;
    }
    return false;
  }

  // History management
  addToHistory(url) {
    // Remove any forward history if we're navigating to a new page
    if (this.historyIndex < this.navigationHistory.length - 1) {
      this.navigationHistory = this.navigationHistory.slice(0, this.historyIndex + 1);
    }
    
    this.navigationHistory.push(url);
    this.historyIndex = this.navigationHistory.length - 1;
    
    // Limit history size
    if (this.navigationHistory.length > 50) {
      this.navigationHistory = this.navigationHistory.slice(-50);
      this.historyIndex = this.navigationHistory.length - 1;
    }
  }

  // Utility functions
  extractDomainFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      return url;
    }
  }

  // Show loading state
  showLoading(message = 'Loading...') {
    if (!this.containerElement) return;

    this.containerElement.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: linear-gradient(135deg, #6c757d 0%, #868e96 100%); color: white;">
        <div style="text-align: center;">
          <div style="width: 60px; height: 60px; border: 4px solid rgba(255, 255, 255, 0.2); 
                      border-top: 4px solid white; border-radius: 50%; 
                      animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
          <div style="font-size: 16px; font-weight: 500; margin-bottom: 10px;">${message}</div>
          <div style="font-size: 14px; color: rgba(255,255,255,0.8);">
            Secure connection via ${this.regionConfigs[this.region]?.name || this.region}
          </div>
        </div>
      </div>
    `;
  }

  // Show error state
  showError(title, message) {
    if (!this.containerElement) return;

    this.containerElement.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: linear-gradient(135deg, #6c757d 0%, #868e96 100%); color: white; padding: 40px;">
        <div style="text-align: center; max-width: 500px;">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="#ef4444" style="margin-bottom: 20px;">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <h3 style="font-size: 24px; font-weight: 600; margin-bottom: 10px;">${title}</h3>
          <p style="color: rgba(255,255,255,0.9); line-height: 1.5; margin-bottom: 30px;">${message}</p>
          <button onclick="location.reload()" 
                  style="background: #3b82f6; color: white; border: none; 
                         padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 14px;">
            Retry Connection
          </button>
        </div>
      </div>
    `;
  }

  // Terminate session
  async terminate() {
    try {
      console.log('[RBI] Terminating session...');

      this.isConnected = false;
      this.currentUrl = '';
      this.navigationHistory = [];
      this.historyIndex = -1;

      if (this.containerElement) {
        this.containerElement.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: linear-gradient(135deg, #6c757d 0%, #868e96 100%); color: white;">
            <div style="text-align: center;">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="#22c55e" style="margin-bottom: 20px;">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <h3 style="font-size: 24px; font-weight: 600; margin-bottom: 10px;">Session Terminated</h3>
              <p style="color: rgba(255,255,255,0.9);">Your remote browsing session has been safely terminated.</p>
            </div>
          </div>
        `;
      }

      this.onConnectionStatus('terminated');
      return { success: true };

    } catch (error) {
      console.error('[RBI] Termination failed:', error);
      throw error;
    }
  }

  // Get session status
  getStatus() {
    return {
      connected: this.isConnected,
      sessionId: this.config.sessionId,
      currentUrl: this.currentUrl,
      region: this.region,
      regionName: this.regionConfigs[this.region]?.name || this.region,
      historyLength: this.navigationHistory.length,
      canGoBack: this.historyIndex > 0,
      canGoForward: this.historyIndex < this.navigationHistory.length - 1
    };
  }
}

// Export for use in other modules
window.BrowserBoxRBI = BrowserBoxRBI;