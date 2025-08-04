// Authentication Service for NULL VOID Extension
// Integrates with hosted websites for profile management

class AuthService {
  constructor() {
    // Your hosted domains (nullvoid.zone.id as primary due to WiFi blocking issues)
    this.domains = [
      'https://nullvoid.zone.id',
      'https://nullvoids.live', 
      'https://nullvoidweb.vercel.app'
    ];
    
    this.currentDomain = this.domains[0]; // Primary domain (nullvoid.zone.id)
    this.isAuthenticated = false;
    this.userProfile = null;
    this.authToken = null;
    
    // Storage keys
    this.storageKeys = {
      token: 'nullvoid_auth_token',
      profile: 'nullvoid_user_profile',
      domain: 'nullvoid_current_domain',
      lastLogin: 'nullvoid_last_login'
    };

    console.log('[Auth] Authentication service initialized');
  }

  // Initialize authentication system
  async initialize() {
    try {
      console.log('[Auth] Initializing authentication...');
      
      // Load stored authentication data
      await this.loadStoredAuth();
      
      // Check if token is still valid
      if (this.authToken) {
        await this.validateToken();
      }
      
      console.log('[Auth] Authentication initialized, logged in:', this.isAuthenticated);
      return this.isAuthenticated;
      
    } catch (error) {
      console.error('[Auth] Initialization failed:', error);
      return false;
    }
  }

  // Load stored authentication data
  async loadStoredAuth() {
    try {
      const browserAPI = typeof browser !== "undefined" ? browser : chrome;
      const storage = await browserAPI.storage.local.get([
        this.storageKeys.token,
        this.storageKeys.profile,
        this.storageKeys.domain,
        this.storageKeys.lastLogin
      ]);

      if (storage[this.storageKeys.token]) {
        this.authToken = storage[this.storageKeys.token];
        this.userProfile = storage[this.storageKeys.profile];
        this.currentDomain = storage[this.storageKeys.domain] || this.domains[0];
        
        console.log('[Auth] Loaded stored authentication data');
      }
    } catch (error) {
      console.error('[Auth] Failed to load stored auth:', error);
    }
  }

  // Save authentication data
  async saveAuthData() {
    try {
      const browserAPI = typeof browser !== "undefined" ? browser : chrome;
      await browserAPI.storage.local.set({
        [this.storageKeys.token]: this.authToken,
        [this.storageKeys.profile]: this.userProfile,
        [this.storageKeys.domain]: this.currentDomain,
        [this.storageKeys.lastLogin]: Date.now()
      });
      
      console.log('[Auth] Authentication data saved');
    } catch (error) {
      console.error('[Auth] Failed to save auth data:', error);
    }
  }

  // Validate current token
  async validateToken() {
    if (!this.authToken) {
      this.isAuthenticated = false;
      return false;
    }

    try {
      console.log('[Auth] Validating token...');
      
      // Try each domain until one works
      for (const domain of this.domains) {
        try {
          const response = await fetch(`${domain}/api/auth/validate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.authToken}`
            }
          });

          if (response.ok) {
            const data = await response.json();
            this.userProfile = data.user;
            this.isAuthenticated = true;
            this.currentDomain = domain;
            
            console.log('[Auth] Token validated successfully');
            await this.saveAuthData();
            return true;
          }
        } catch (error) {
          console.warn(`[Auth] Token validation failed for ${domain}:`, error.message);
        }
      }

      // If all domains failed, token is invalid
      console.log('[Auth] Token validation failed for all domains');
      await this.logout();
      return false;

    } catch (error) {
      console.error('[Auth] Token validation error:', error);
      this.isAuthenticated = false;
      return false;
    }
  }

  // Simple redirect to website login with extension authentication
  async redirectToLogin() {
    try {
      console.log('[Auth] Redirecting to website login with extension auth...');
      
      // Get extension ID
      const browserAPI = typeof browser !== "undefined" ? browser : chrome;
      const extensionId = browserAPI.runtime.id;
      
      // Build authentication URL with extension parameters
      const loginUrl = `${this.currentDomain}/?auth=extension&extension_id=${extensionId}`;
      
      console.log('[Auth] Extension ID:', extensionId);
      console.log('[Auth] Login URL:', loginUrl);
      
      // Create login tab
      const tab = await browserAPI.tabs.create({
        url: loginUrl,
        active: true
      });

      console.log('[Auth] Redirected to extension auth page:', loginUrl);
      return true;
      
    } catch (error) {
      console.error('[Auth] Failed to redirect to extension auth:', error);
      throw error;
    }
  }

  // Handle authentication completion
  async handleAuthComplete(token, user) {
    try {
      console.log('[Auth] Handling authentication completion...');
      
      this.authToken = token;
      this.userProfile = user;
      this.isAuthenticated = true;
      
      await this.saveAuthData();
      
      // Notify UI about login
      this.notifyAuthChange();
      
      console.log('[Auth] Authentication completed successfully');
    } catch (error) {
      console.error('[Auth] Failed to handle auth completion:', error);
      throw error;
    }
  }

  // Get token from website (alternative method)
  async getTokenFromWebsite() {
    try {
      console.log('[Auth] Attempting to get token from website...');
      
      for (const domain of this.domains) {
        try {
          // Check if user is logged in on the website
          const response = await fetch(`${domain}/api/auth/extension-token`, {
            method: 'GET',
            credentials: 'include', // Include cookies
            headers: {
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            if (data.token && data.user) {
              await this.handleAuthComplete(data.token, data.user);
              return true;
            }
          }
        } catch (error) {
          console.warn(`[Auth] Failed to get token from ${domain}:`, error.message);
        }
      }

      return false;
    } catch (error) {
      console.error('[Auth] Failed to get token from website:', error);
      return false;
    }
  }

  // Logout user
  async logout() {
    try {
      console.log('[Auth] Logging out...');
      
      // Notify server about logout
      if (this.authToken && this.currentDomain) {
        try {
          await fetch(`${this.currentDomain}/api/auth/logout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.authToken}`
            }
          });
        } catch (error) {
          console.warn('[Auth] Server logout failed:', error);
        }
      }

      // Clear local data
      this.authToken = null;
      this.userProfile = null;
      this.isAuthenticated = false;

      // Clear storage
      const browserAPI = typeof browser !== "undefined" ? browser : chrome;
      await browserAPI.storage.local.remove([
        this.storageKeys.token,
        this.storageKeys.profile,
        this.storageKeys.domain,
        this.storageKeys.lastLogin
      ]);

      // Notify UI about logout
      this.notifyAuthChange();
      
      console.log('[Auth] Logout completed');
    } catch (error) {
      console.error('[Auth] Logout failed:', error);
    }
  }

  // Get user profile
  getUserProfile() {
    return this.userProfile;
  }

  // Check if user is authenticated
  isUserAuthenticated() {
    return this.isAuthenticated;
  }

  // Get authentication token
  getAuthToken() {
    return this.authToken;
  }

  // Get current domain
  getCurrentDomain() {
    return this.currentDomain;
  }

  // Notify UI about authentication changes
  notifyAuthChange() {
    // Dispatch custom event
    const event = new CustomEvent('authStateChanged', {
      detail: {
        isAuthenticated: this.isAuthenticated,
        userProfile: this.userProfile
      }
    });
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(event);
    }

    // Also send message to popup if it's open
    try {
      const browserAPI = typeof browser !== "undefined" ? browser : chrome;
      browserAPI.runtime.sendMessage({
        action: 'authStateChanged',
        isAuthenticated: this.isAuthenticated,
        userProfile: this.userProfile
      }).catch(() => {
        // Ignore errors if popup is not open
      });
    } catch (error) {
      // Ignore errors
    }
  }

  // Refresh user profile
  async refreshProfile() {
    if (!this.isAuthenticated || !this.authToken) {
      return false;
    }

    try {
      const response = await fetch(`${this.currentDomain}/api/user/profile`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.userProfile = data.user;
        await this.saveAuthData();
        this.notifyAuthChange();
        return true;
      }
    } catch (error) {
      console.error('[Auth] Failed to refresh profile:', error);
    }

    return false;
  }

  // Check website login status
  async checkWebsiteLoginStatus() {
    try {
      console.log('[Auth] Checking website login status...');
      
      for (const domain of this.domains) {
        try {
          console.log(`[Auth] Checking ${domain}/api/auth/status`);
          
          const response = await fetch(`${domain}/api/auth/status`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json'
            }
          });

          console.log(`[Auth] Response from ${domain}:`, response.status, response.statusText);

          if (response.ok) {
            const data = await response.json();
            console.log(`[Auth] Response data from ${domain}:`, data);
            
            if (data.loggedIn && data.token && data.user) {
              console.log('[Auth] Login detected! Processing authentication...');
              await this.handleAuthComplete(data.token, data.user);
              return true;
            } else {
              console.log(`[Auth] ${domain} - User not logged in or missing data:`, {
                loggedIn: data.loggedIn,
                hasToken: !!data.token,
                hasUser: !!data.user
              });
            }
          } else {
            console.warn(`[Auth] ${domain} - HTTP ${response.status}: ${response.statusText}`);
          }
        } catch (error) {
          console.warn(`[Auth] Status check failed for ${domain}:`, error.message);
        }
      }
      
      console.log('[Auth] No active login found on any domain');
      return false;
    } catch (error) {
      console.error('[Auth] Website login status check failed:', error);
      return false;
    }
  }
}

// Create global auth service instance
window.authService = new AuthService();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthService;
}