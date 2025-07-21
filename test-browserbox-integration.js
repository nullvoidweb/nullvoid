#!/usr/bin/env node

// Test script for BrowserBox integration with NULL VOID
// This verifies that the BrowserBox RBI implementation works correctly

const WebSocket = require('ws');
const http = require('http');

class BrowserBoxTester {
  constructor() {
    this.testResults = [];
    this.serverUrl = 'ws://localhost:8080';
    this.httpUrl = 'http://localhost:8080';
  }

  async runAllTests() {
    console.log('🧪 Starting BrowserBox Integration Tests...\n');

    try {
      await this.testServerHealth();
      await this.testWebSocketConnection();
      await this.testSessionCreation();
      await this.testNavigation();
      await this.testInteraction();
      await this.testSessionTermination();
      
      this.printResults();
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    }
  }

  async testServerHealth() {
    console.log('🏥 Testing server health...');
    
    try {
      const response = await this.httpRequest('/health');
      const data = JSON.parse(response);
      
      if (data.status === 'ok') {
        this.addResult('✅ Server Health Check', 'PASS', 'Server is responding correctly');
      } else {
        this.addResult('❌ Server Health Check', 'FAIL', 'Server returned invalid status');
      }
    } catch (error) {
      this.addResult('❌ Server Health Check', 'FAIL', `Server not responding: ${error.message}`);
    }
  }

  async testWebSocketConnection() {
    console.log('🔌 Testing WebSocket connection...');
    
    return new Promise((resolve) => {
      const ws = new WebSocket(this.serverUrl);
      let connected = false;
      
      const timeout = setTimeout(() => {
        if (!connected) {
          this.addResult('❌ WebSocket Connection', 'FAIL', 'Connection timeout');
          ws.close();
          resolve();
        }
      }, 5000);

      ws.on('open', () => {
        connected = true;
        clearTimeout(timeout);
        this.addResult('✅ WebSocket Connection', 'PASS', 'Successfully connected to WebSocket');
        ws.close();
        resolve();
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        this.addResult('❌ WebSocket Connection', 'FAIL', `Connection failed: ${error.message}`);
        resolve();
      });
    });
  }

  async testSessionCreation() {
    console.log('🆔 Testing session creation...');
    
    return new Promise((resolve) => {
      const ws = new WebSocket(this.serverUrl);
      let sessionReceived = false;
      
      const timeout = setTimeout(() => {
        if (!sessionReceived) {
          this.addResult('❌ Session Creation', 'FAIL', 'No session ID received');
          ws.close();
          resolve();
        }
      }, 5000);

      ws.on('open', () => {
        // Wait for welcome message with session ID
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'connected' && message.sessionId) {
            sessionReceived = true;
            clearTimeout(timeout);
            this.addResult('✅ Session Creation', 'PASS', `Session ID: ${message.sessionId}`);
            ws.close();
            resolve();
          }
        } catch (error) {
          // Ignore parsing errors for other message types
        }
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        this.addResult('❌ Session Creation', 'FAIL', `Session creation failed: ${error.message}`);
        resolve();
      });
    });
  }

  async testNavigation() {
    console.log('🧭 Testing navigation...');
    
    return new Promise((resolve) => {
      const ws = new WebSocket(this.serverUrl);
      let navigationReceived = false;
      
      const timeout = setTimeout(() => {
        if (!navigationReceived) {
          this.addResult('❌ Navigation Test', 'FAIL', 'Navigation response timeout');
          ws.close();
          resolve();
        }
      }, 15000); // Longer timeout for navigation

      ws.on('open', () => {
        // Send navigation command
        ws.send(JSON.stringify({
          type: 'navigate',
          url: 'https://example.com',
          options: { waitUntil: 'networkidle0', timeout: 10000 }
        }));
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'navigation' && message.data && message.data.url) {
            navigationReceived = true;
            clearTimeout(timeout);
            this.addResult('✅ Navigation Test', 'PASS', `Navigated to: ${message.data.url}`);
            ws.close();
            resolve();
          } else if (message.type === 'error') {
            clearTimeout(timeout);
            this.addResult('❌ Navigation Test', 'FAIL', `Navigation error: ${message.message}`);
            ws.close();
            resolve();
          }
        } catch (error) {
          // Ignore parsing errors for other message types
        }
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        this.addResult('❌ Navigation Test', 'FAIL', `Navigation failed: ${error.message}`);
        resolve();
      });
    });
  }

  async testInteraction() {
    console.log('🖱️ Testing interaction...');
    
    return new Promise((resolve) => {
      const ws = new WebSocket(this.serverUrl);
      let interactionSent = false;
      
      const timeout = setTimeout(() => {
        if (interactionSent) {
          this.addResult('✅ Interaction Test', 'PASS', 'Click command sent successfully');
        } else {
          this.addResult('❌ Interaction Test', 'FAIL', 'Failed to send interaction');
        }
        ws.close();
        resolve();
      }, 5000);

      ws.on('open', () => {
        // Send click command
        ws.send(JSON.stringify({
          type: 'click',
          x: 100,
          y: 100
        }));
        interactionSent = true;
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        this.addResult('❌ Interaction Test', 'FAIL', `Interaction failed: ${error.message}`);
        resolve();
      });
    });
  }

  async testSessionTermination() {
    console.log('🛑 Testing session termination...');
    
    return new Promise((resolve) => {
      const ws = new WebSocket(this.serverUrl);
      let terminationSent = false;
      
      const timeout = setTimeout(() => {
        if (terminationSent) {
          this.addResult('✅ Session Termination', 'PASS', 'Termination command sent');
        } else {
          this.addResult('❌ Session Termination', 'FAIL', 'Failed to send termination');
        }
        resolve();
      }, 3000);

      ws.on('open', () => {
        // Send termination command
        ws.send(JSON.stringify({
          type: 'terminate'
        }));
        terminationSent = true;
      });

      ws.on('close', () => {
        clearTimeout(timeout);
        this.addResult('✅ Session Termination', 'PASS', 'Session terminated successfully');
        resolve();
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        this.addResult('❌ Session Termination', 'FAIL', `Termination failed: ${error.message}`);
        resolve();
      });
    });
  }

  httpRequest(path) {
    return new Promise((resolve, reject) => {
      const url = this.httpUrl + path;
      http.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve(data));
      }).on('error', reject);
    });
  }

  addResult(test, status, details) {
    this.testResults.push({ test, status, details });
    console.log(`  ${test}: ${status} - ${details}`);
  }

  printResults() {
    console.log('\n📊 Test Results Summary:');
    console.log('=' .repeat(60));
    
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    
    this.testResults.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : '❌';
      console.log(`${icon} ${result.test}`);
      if (result.details) {
        console.log(`   ${result.details}`);
      }
    });
    
    console.log('=' .repeat(60));
    console.log(`📈 Results: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
      console.log('🎉 All tests passed! BrowserBox integration is working correctly.');
      console.log('\n🚀 Next steps:');
      console.log('1. Load NULL VOID extension in Chrome');
      console.log('2. Click "Disposable Browser Start"');
      console.log('3. Test navigation and interaction');
    } else {
      console.log('⚠️  Some tests failed. Please check the BrowserBox server setup.');
      console.log('\n🔧 Troubleshooting:');
      console.log('1. Ensure BrowserBox server is running: node setup-browserbox.js');
      console.log('2. Check server logs for errors');
      console.log('3. Verify dependencies are installed: npm install');
    }
  }
}

// Run tests if script is executed directly
if (require.main === module) {
  const tester = new BrowserBoxTester();
  
  console.log('🧪 BrowserBox Integration Test Suite');
  console.log('====================================\n');
  
  // Check if server URL is provided
  if (process.argv[2]) {
    tester.serverUrl = process.argv[2];
    tester.httpUrl = process.argv[2].replace('ws://', 'http://').replace('wss://', 'https://');
  }
  
  console.log(`🎯 Testing server: ${tester.serverUrl}\n`);
  
  tester.runAllTests().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = BrowserBoxTester;