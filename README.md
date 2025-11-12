# NULL VOID Browser Extension

![NULL VOID Banner](./docs/images/banner.png)
_Enterprise-grade security and privacy for your browsing experience_

---

> **DEVELOPMENT STATUS**: This extension is currently in active development. Features may change, and some functionality might be unstable. We welcome contributions from the community! If you'd like to help improve NULL VOID, please check out our [Contributing](#contributing) section below.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Usage Guide](#usage-guide)
- [Smart Prevention System](#smart-prevention-system)
- [Technologies Used](#technologies-used)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

**NULL VOID** is an enterprise-grade browser extension that provides comprehensive security and privacy protection through Remote Browser Isolation (RBI), smart threat prevention, disposable email services, and secure file viewing capabilities.

![Extension Popup](./docs/images/popup-interface.png)
_Main popup interface with all features_

### Why NULL VOID?

- **Zero Trust Browsing**: Isolate potentially dangerous websites in remote browser environments
- **Real-time Threat Detection**: Powered by VirusTotal API integration
- **Privacy First**: Generate disposable emails on-the-fly
- **Secure File Viewing**: View files without downloading them to your local machine
- **AI Assistant**: Built-in AI chat for assistance and support

---

## Key Features

### 1. Remote Browser Isolation (RBI)

![RBI Architecture](./docs/images/rbi-architecture.png)
_Remote Browser Isolation workflow_

Browse untrusted websites safely by rendering them in isolated cloud environments. NULL VOID supports multiple geographic regions:

- Singapore (`sg-rbi-api.nullvoid.com`)
- United States (`us-rbi-api.nullvoid.com`)
- United Kingdom (`uk-rbi-api.nullvoid.com`)
- Canada (`ca-rbi-api.nullvoid.com`)

**Benefits:**

- Protects your device from malware and exploits
- Isolates tracking cookies and scripts
- Prevents drive-by downloads
- Real-time streaming via WebSocket

### 2. Smart Prevention System

![Smart Prevention Dashboard](./docs/images/smart-prevention.png)
_Smart Prevention System in action_

Our intelligent threat detection system includes:

#### **Ad Blocking**

- Blocks intrusive advertisements
- Removes tracking pixels
- Filters sponsored content
- Improves page load times

#### **Malicious Website Detection**

- Pattern-based threat detection
- Known malicious domain blocking
- Phishing site identification
- Scam website prevention

#### **VirusTotal Integration**

- Real-time URL scanning
- Download verification before execution
- Detailed threat analysis reports
- Automatic polling for pending analyses

![VirusTotal Scan](./docs/images/virustotal-scan.png)
_VirusTotal scanning interface_

### 3. Disposable Email Service

![Disposable Email](./docs/images/disposable-email.png)
_Generate temporary email addresses_

- Generate temporary email addresses instantly
- Powered by mail.tm API
- Perfect for sign-ups and registrations
- Auto-generated secure passwords
- No personal information required

### 4. Secure File Viewer

![Secure File Viewer](./docs/images/file-viewer.png)
_View files securely without downloading_

- Preview files without downloading
- Supports multiple file formats
- Sandboxed viewing environment
- Prevents malicious file execution

### 5. AI Chat Assistant

![AI Chat](./docs/images/ai-chat.png)
_Built-in AI assistant_

- Integrated AI chat support
- Context-aware assistance
- Security recommendations
- Privacy-focused conversations

---

## Architecture

### Extension Components

```
NULL VOID Extension
│
├── Background Service Worker
│   ├── Event Listeners
│   ├── State Management
│   └── API Communication
│
├── Content Scripts
│   ├── Smart Prevention System
│   ├── Page Analysis
│   └── DOM Manipulation
│
├── Popup Interface
│   ├── Feature Controls
│   ├── Status Display
│   └── Settings Panel
│
└── Web Accessible Resources
    ├── RBI Browser
    ├── File Viewer
    └── AI Chat Interface
```

![Architecture Diagram](./docs/images/architecture-diagram.png)
_Detailed system architecture_

### Technology Stack

| Component                   | Technology                      |
| --------------------------- | ------------------------------- |
| **Extension Framework**     | Chrome Extension Manifest V3    |
| **Frontend**                | HTML5, CSS3, Vanilla JavaScript |
| **API Integration**         | VirusTotal API v3, Mail.tm API  |
| **Remote Isolation**        | Browserless.io, Custom RBI APIs |
| **Real-time Communication** | WebSocket (wss://)              |
| **State Management**        | Chrome Storage API              |
| **Testing**                 | Node.js, Custom Test Framework  |

---

## Usage Guide

### Getting Started

![Getting Started](./docs/images/getting-started.png)

1. **Open the Extension**: Click the NULL VOID icon in your browser toolbar
2. **Enable Smart Prevention**: Toggle the Smart Prevention System for automatic protection
3. **Browse Safely**: Visit any website with active protection

### Using Remote Browser Isolation

![RBI Usage](./docs/images/rbi-usage.png)

1. Click "Open RBI Browser" in the popup
2. Enter the URL you want to visit
3. Select your preferred region
4. The website will load in an isolated environment
5. Interact normally - all actions are streamed securely

### Generating Disposable Emails

![Email Generation](./docs/images/email-generation.png)

1. Click "Disposable Email" in the popup
2. Click "Generate New Email"
3. Copy the email address
4. Use it for registrations or sign-ups
5. Check inbox directly in the extension

### Viewing Files Securely

![File Viewing](./docs/images/file-viewing.png)

1. Click "Secure File Viewer"
2. Upload or drag-and-drop a file
3. View the file in a sandboxed environment
4. Close when done - file is not saved locally

---

## Smart Prevention System

### How It Works

The Smart Prevention System operates as a content script that runs on every webpage you visit. It performs three layers of protection:

![Smart Prevention Layers](./docs/images/prevention-layers.png)

#### Layer 1: Ad Blocking

- Identifies and removes ad elements using CSS selectors
- Blocks common ad network requests
- Improves page performance and privacy

#### Layer 2: Pattern-Based Detection

- Analyzes URLs and page content for suspicious patterns
- Matches against known malicious domain database
- Blocks access before page loads completely

#### Layer 3: VirusTotal Verification

```javascript
// Automatic URL scanning workflow
1. User navigates to new URL
2. System checks cache for previous scans
3. If not cached, submits URL to VirusTotal
4. Polls for analysis results (max 30 seconds)
5. Displays warning if threats detected
6. Blocks downloads from malicious sources
```

![VirusTotal Flow](./docs/images/virustotal-flow.png)

### Configuration

You can customize Smart Prevention behavior:

```javascript
// Toggle individual components
- Ad Blocking: ON/OFF
- Malicious Detection: ON/OFF
- VirusTotal Scanning: ON/OFF
```

### Warning Dialogs

![Warning Dialog](./docs/images/warning-dialog.png)
_Example warning for suspicious content_

When threats are detected, NULL VOID displays informative warnings:

- **Pending Analysis**: Yellow warning while VirusTotal analyzes the URL
- **Suspicious Content**: Orange warning for potential threats
- **Malicious Detected**: Red warning with detailed threat information
- **Safe Content**: Green indicator for verified safe URLs

---

## Technologies Used

### Core Technologies

- **JavaScript ES6+**: Modern JavaScript features and async/await
- **Chrome Extension APIs**:
  - `chrome.storage` - State persistence
  - `chrome.runtime` - Background communication
  - `chrome.scripting` - Dynamic script injection
  - `chrome.tabs` - Tab management
  - `chrome.declarativeNetRequest` - Network filtering

### External APIs

1. **VirusTotal API v3**

   - URL/File scanning
   - Threat intelligence
   - Real-time analysis
   - [API Documentation](https://developers.virustotal.com/reference)

2. **Mail.tm API**

   - Disposable email generation
   - Inbox management
   - [API Documentation](https://docs.mail.tm/)

3. **Browserless.io**
   - Remote browser rendering
   - Cloud-based isolation
   - [Service Documentation](https://www.browserless.io/docs/)

### Development Tools

- **Node.js**: Testing environment
- **Git**: Version control
- **VS Code**: Primary IDE

---

## Testing

### Running Tests

![Test Results](./docs/images/test-results.png)

The project includes automated tests for critical components:

```powershell
# Run VirusTotal integration tests
node tests\virus-total-api.test.js
```

### Test Coverage

- VirusTotal API integration
- URL scanning workflow
- Pending analysis handling
- Cache management
- Threat detection logic

### Manual Testing Checklist

- [ ] Extension loads without errors
- [ ] Smart Prevention toggle persists state
- [ ] VirusTotal scans complete successfully
- [ ] Warning dialogs display correctly
- [ ] RBI browser connects to remote instances
- [ ] Disposable email generation works
- [ ] Secure file viewer opens files
- [ ] AI chat interface responds

---

## Project Structure

```
NullVoid/
│
├── README.md                          # This file
├── src/                               # Extension source code
│   ├── manifest.json                  # Extension manifest
│   ├── background.js                  # Background service worker
│   ├── popup.html                     # Popup UI
│   ├── popup.css                      # Popup styles
│   ├── popup-fixed.js                 # Popup logic
│   ├── smart-prevention-system.js     # Core security module
│   ├── auth-service.js               # Authentication handling
│   ├── disposable-email.js           # Email service
│   ├── file-viewer-secure.html       # File viewer UI
│   ├── file-viewer-secure.js         # File viewer logic
│   ├── rbi-browser.html              # RBI interface
│   ├── rbi-browser-browserless.js    # RBI implementation
│   ├── ai-chat-full.html             # AI chat UI
│   ├── ai-chat-full.js               # AI chat logic
│   ├── ai-chat-ui.js                 # AI chat components
│   ├── ai-chat-extension.js          # AI chat integration
│   ├── debug-toggle.js               # Debug utilities
│   ├── browserless-config.js         # Browserless configuration
│   │
│   ├── icons/                        # Extension icons
│   │   ├── icon16.png
│   │   ├── icon48.png
│   │   └── icon128.png
│   │
│   ├── manifests/                    # Browser-specific manifests
│   │   ├── chrome.json
│   │   └── firefox.json
│   │
│   └── rules/                        # Blocking rules
│       ├── ad-blocking-rules.json
│       └── malicious-blocking-rules.json
│
├── tests/                            # Test suite
│   └── virus-total-api.test.js      # VirusTotal tests
│
└── docs/                             # Documentation & images
    └── images/                       # Screenshots & diagrams
        ├── banner.png
        ├── popup-interface.png
        ├── rbi-architecture.png
        ├── smart-prevention.png
        ├── virustotal-scan.png
        ├── disposable-email.png
        ├── file-viewer.png
        ├── ai-chat.png
        ├── architecture-diagram.png
        ├── load-extension.png
        ├── extension-loaded.png
        ├── getting-started.png
        ├── rbi-usage.png
        ├── email-generation.png
        ├── file-viewing.png
        ├── prevention-layers.png
        ├── virustotal-flow.png
        ├── warning-dialog.png
        └── test-results.png
```

---

## Contributing

**NULL VOID is under active development and we need your help!** Whether you're a developer, designer, security researcher, or just an enthusiast, there are many ways you can contribute to make this extension better.

We welcome all contributions to NULL VOID! Here's how you can help:

### Ways to Contribute

1. **Report Bugs**: Open an issue with detailed reproduction steps
2. **Suggest Features**: Share your ideas for new functionality
3. **Submit Pull Requests**: Fix bugs or implement new features
4. **Improve Documentation**: Help make our docs better
5. **Security Research**: Report vulnerabilities responsibly

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly
5. Commit with clear messages (`git commit -m 'Add amazing feature'`)
6. Push to your fork (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Style Guidelines

- Use meaningful variable names
- Comment complex logic
- Follow existing code structure
- Test your changes
- Update documentation as needed

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Security

### Reporting Vulnerabilities

If you discover a security vulnerability, please email security@nullvoid.com instead of using the issue tracker.

### Security Features

- All API keys are configurable
- HTTPS-only connections
- No data collection or tracking
- Local storage only
- Open source for transparency

---

## Support

### Get Help

- Email: support@nullvoid.com
- Issues: [GitHub Issues](https://github.com/anishalx/nullvoid/issues)
- Discussions: [GitHub Discussions](https://github.com/anishalx/nullvoid/discussions)

### FAQ

**Q: Is NULL VOID free to use?**  
A: Yes, NULL VOID is completely free and open source.

**Q: Does NULL VOID collect my data?**  
A: No, we don't collect any user data. All processing happens locally or through your direct API calls.

**Q: Can I use NULL VOID in Firefox?**  
A: Not yet, but Firefox support is planned for future releases.

**Q: How do I get a VirusTotal API key?**  
A: Sign up at [VirusTotal](https://www.virustotal.com/) for a free API key, then configure it in the extension settings.

---

## Acknowledgments

- **VirusTotal** for their comprehensive threat intelligence API
- **Mail.tm** for disposable email services
- **Browserless.io** for remote browser isolation technology
- The open-source community for inspiration and support

---

## Roadmap

### Upcoming Features

- [ ] Firefox browser support
- [ ] Custom rule editor for ad blocking
- [ ] Enhanced AI chat capabilities
- [ ] Multi-language support
- [ ] Cloud backup for settings
- [ ] Team/Enterprise features
- [ ] Advanced threat reporting
- [ ] Performance optimizations

---

## Stats

![GitHub stars](https://img.shields.io/github/stars/anishalx/nullvoid?style=social)
![GitHub forks](https://img.shields.io/github/forks/anishalx/nullvoid?style=social)
![GitHub issues](https://img.shields.io/github/issues/anishalx/nullvoid)
![GitHub license](https://img.shields.io/github/license/anishalx/nullvoid)

---

<div align="center">

**Made with love by the NULL VOID Team**

[Back to Top](#null-void-browser-extension)

</div>
