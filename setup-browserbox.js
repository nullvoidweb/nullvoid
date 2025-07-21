#!/usr/bin/env node

// Simple BrowserBox Server Setup for NULL VOID RBI
// This creates a local BrowserBox-compatible server for testing

const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const cors = require('cors');

// Check if puppeteer is available
let puppeteer = null;
try {
  puppeteer = require('puppeteer');
} catch (error) {
  console.log('⚠️  Puppeteer not found. Install with: npm install puppeteer');
  console.log('📦 For now, server will run in mock mode');
}

class SimpleBrowserBoxServer {
  constructor(options = {}) {
    this.port = options.port || 8080;
    this.host = options.host || 'localhost';
    this.sessions = new Map();
    this.browsers = new Map();
    
    console.log('🚀 Starting Simple BrowserBox Server...');
    console.log(`📍 Server will run on: ws://${this.host}:${this.port}`);
  }

  async start() {
    try {
      // Create HTTP server
      const app = express();
      app.use(cors());
      
      // Health check endpoint
      app.get('/health', (req, res) => {
        res.json({ 
          status: 'ok', 
          sessions: this.sessions.size,
          timestamp: new Date().toISOString()
        });
      });

      // Create HTTP server
      const server = http.createServer(app);
      
      // Create WebSocket server
      const wss = new WebSocket.Server({ 
        server,
        path: '/',
        verifyClient: (info) => {
          console.log('🔗 New WebSocket connection attempt from:', info.origin);
          return true; // Allow all connections for testing
        }
      });

      // Handle WebSocket connections
      wss.on('connection', (ws, req) => {
        this.handleConnection(ws, req);
      });

      // Start server
      server.listen(this.port, this.host, () => {
        console.log('✅ Simple BrowserBox Server started successfully!');
        console.log(`🌐 WebSocket URL: ws://${this.host}:${this.port}`);
        console.log(`🏥 Health Check: http://${this.host}:${this.port}/health`);
        console.log('');
        console.log('📋 To use with NULL VOID:');
        console.log('1. Update browserbox-rbi.js endpoints to include:');
        console.log(`   local: 'ws://${this.host}:${this.port}'`);
        console.log('2. Launch NULL VOID extension');
        console.log('3. Click "Disposable Browser Start"');
        console.log('');
        console.log('🛑 Press Ctrl+C to stop the server');
      });

    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  async handleConnection(ws, req) {
    const sessionId = this.generateSessionId();
    console.log(`🔌 New session connected: ${sessionId}`);

    // Store session
    this.sessions.set(sessionId, {
      ws: ws,
      browser: null,
      page: null,
      startTime: Date.now()
    });

    // Send welcome message
    this.sendMessage(ws, {
      type: 'connected',
      sessionId: sessionId,
      message: 'Connected to Simple BrowserBox Server'
    });

    // Handle messages
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleMessage(sessionId, message);
      } catch (error) {
        console.error('❌ Error handling message:', error);
        this.sendMessage(ws, {
          type: 'error',
          message: error.message
        });
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      console.log(`🔌 Session disconnected: ${sessionId}`);
      this.cleanupSession(sessionId);
    });

    // Initialize browser for this session
    await this.initializeBrowser(sessionId);
  }

  async handleMessage(sessionId, message) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    console.log(`📨 Message from ${sessionId}:`, message.type);

    switch (message.type) {
      case 'configure':
        await this.handleConfigure(sessionId, message.config);
        break;
      
      case 'navigate':
        await this.handleNavigate(sessionId, message.url, message.options);
        break;
      
      case 'click':
        await this.handleClick(sessionId, message.x, message.y);
        break;
      
      case 'type':
        await this.handleType(sessionId, message.text);
        break;
      
      case 'keypress':
        await this.handleKeyPress(sessionId, message.key);
        break;
      
      case 'back':
        await this.handleBack(sessionId);
        break;
      
      case 'forward':
        await this.handleForward(sessionId);
        break;
      
      case 'refresh':
        await this.handleRefresh(sessionId);
        break;
      
      case 'terminate':
        await this.handleTerminate(sessionId);
        break;
      
      default:
        console.log(`❓ Unknown message type: ${message.type}`);
    }
  }

  async initializeBrowser(sessionId) {
    try {
      console.log(`🌐 Initializing browser for session: ${sessionId}`);
      
      if (!puppeteer) {
        // Mock mode - send a demo screenshot
        console.log(`📸 Running in mock mode for session: ${sessionId}`);
        
        const session = this.sessions.get(sessionId);
        session.mockMode = true;
        
        // Send mock navigation update
        this.sendMessage(session.ws, {
          type: 'navigation',
          data: {
            url: 'https://example.com',
            title: 'Example Domain',
            canGoBack: false,
            canGoForward: false
          }
        });
        
        // Send mock screen (base64 encoded 1x1 pixel PNG)
        this.sendMessage(session.ws, {
          type: 'screen',
          data: {
            type: 'image',
            data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
          }
        });
        
        console.log(`✅ Mock browser initialized for session: ${sessionId}`);
        return;
      }
      
      const browser = await puppeteer.launch({
        headless: false, // Set to true for production
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1366, height: 768 });

      // Store browser and page
      const session = this.sessions.get(sessionId);
      session.browser = browser;
      session.page = page;

      // Set up page event listeners
      page.on('load', () => {
        this.sendMessage(session.ws, {
          type: 'load',
          data: {
            url: page.url(),
            title: page.title()
          }
        });
      });

      console.log(`✅ Browser initialized for session: ${sessionId}`);
      
      // Send initial screen
      await this.captureAndSendScreen(sessionId);

    } catch (error) {
      console.error(`❌ Failed to initialize browser for ${sessionId}:`, error);
      this.sendMessage(this.sessions.get(sessionId).ws, {
        type: 'error',
        message: 'Failed to initialize browser'
      });
    }
  }

  async handleNavigate(sessionId, url, options = {}) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.page) return;

    try {
      console.log(`🧭 Navigating to: ${url}`);
      
      await session.page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 30000,
        ...options
      });

      // Send navigation update
      this.sendMessage(session.ws, {
        type: 'navigation',
        data: {
          url: session.page.url(),
          title: await session.page.title(),
          canGoBack: true, // Simplified for demo
          canGoForward: false
        }
      });

      // Capture and send screen
      await this.captureAndSendScreen(sessionId);

    } catch (error) {
      console.error(`❌ Navigation failed for ${sessionId}:`, error);
      this.sendMessage(session.ws, {
        type: 'error',
        message: `Navigation failed: ${error.message}`
      });
    }
  }

  async handleClick(sessionId, x, y) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.page) return;

    try {
      await session.page.mouse.click(x, y);
      await this.captureAndSendScreen(sessionId);
    } catch (error) {
      console.error(`❌ Click failed for ${sessionId}:`, error);
    }
  }

  async handleType(sessionId, text) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.page) return;

    try {
      await session.page.keyboard.type(text);
      await this.captureAndSendScreen(sessionId);
    } catch (error) {
      console.error(`❌ Type failed for ${sessionId}:`, error);
    }
  }

  async handleKeyPress(sessionId, key) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.page) return;

    try {
      await session.page.keyboard.press(key);
      await this.captureAndSendScreen(sessionId);
    } catch (error) {
      console.error(`❌ Key press failed for ${sessionId}:`, error);
    }
  }

  async handleBack(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.page) return;

    try {
      await session.page.goBack();
      await this.captureAndSendScreen(sessionId);
    } catch (error) {
      console.error(`❌ Back navigation failed for ${sessionId}:`, error);
    }
  }

  async handleForward(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.page) return;

    try {
      await session.page.goForward();
      await this.captureAndSendScreen(sessionId);
    } catch (error) {
      console.error(`❌ Forward navigation failed for ${sessionId}:`, error);
    }
  }

  async handleRefresh(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.page) return;

    try {
      await session.page.reload();
      await this.captureAndSendScreen(sessionId);
    } catch (error) {
      console.error(`❌ Refresh failed for ${sessionId}:`, error);
    }
  }

  async captureAndSendScreen(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.page) return;

    try {
      const screenshot = await session.page.screenshot({
        encoding: 'base64',
        type: 'png'
      });

      this.sendMessage(session.ws, {
        type: 'screen',
        data: {
          type: 'image',
          data: screenshot
        }
      });

    } catch (error) {
      console.error(`❌ Screen capture failed for ${sessionId}:`, error);
    }
  }

  async handleConfigure(sessionId, config) {
    console.log(`⚙️ Configuring session ${sessionId}:`, config);
    // Configuration handled during browser initialization
  }

  async handleTerminate(sessionId) {
    console.log(`🛑 Terminating session: ${sessionId}`);
    await this.cleanupSession(sessionId);
  }

  async cleanupSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      if (session.browser) {
        await session.browser.close();
      }
    } catch (error) {
      console.error(`❌ Error cleaning up session ${sessionId}:`, error);
    }

    this.sessions.delete(sessionId);
    console.log(`🧹 Session ${sessionId} cleaned up`);
  }

  sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  generateSessionId() {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new SimpleBrowserBoxServer({
    port: process.env.PORT || 8080,
    host: process.env.HOST || 'localhost'
  });

  server.start().catch(error => {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    process.exit(0);
  });
}

module.exports = SimpleBrowserBoxServer;