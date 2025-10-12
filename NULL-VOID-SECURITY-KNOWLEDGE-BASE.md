# 🛡️ NULL VOID Extension - Complete Security Knowledge Base

## 📋 EXTENSION OVERVIEW

**NULL VOID** is a comprehensive browser security extension focused on:

- **Remote Browser Isolation (RBI)** - Disposable browsing environment
- **AI-Powered Security Assistant** - Cybersecurity guidance and troubleshooting
- **Smart Prevention System** - Real-time threat detection and blocking
- **Privacy Protection** - Disposable emails and secure file viewing
- **Malware Prevention** - Advanced threat detection and isolation

---

## 🔧 CORE COMPONENTS & TROUBLESHOOTING

### 1. **Disposable Browser (RBI System)**

**Files:**

- `rbi-browser.html` - Main disposable browser interface
- `rbi-browser-browserless.js` - Browserless.io API integration
- `browserless-config.js` - API configuration and credentials

**Common Issues:**

❌ **"Fallback Mode" Error (Yellow Warning)**

- **Symptoms:** Yellow banner showing "Fallback Mode" instead of isolated browser
- **Root Cause:** Browserless.io API returning 403/401/404 errors
- **Diagnosis:** Check browser console for "API Error" messages
- **Solution:**
  1. Open `browserless-config.js`
  2. Update API credentials: `apiKey: "YOUR_VALID_KEY"`
  3. Verify endpoint URL: `https://YOUR_INSTANCE.browserless.io`
  4. Test API connectivity: `curl -X GET "https://YOUR_INSTANCE.browserless.io/json/version"`
- **Verification:** Browser should load without fallback warning

❌ **Browser Won't Load Pages**

- **Cause:** Invalid Browserless configuration or network issues
- **Solution:** Check `isAuthFailure` flag in `rbi-browser-browserless.js`
- **Prevention:** Always verify API credentials before deployment

### 2. **AI Chat System**

**Files:**

- `ai-chat-full.html` - Full AI chat interface
- `ai-chat-full.js` - Main AI chat logic and API integration
- `popup-fixed.js` - Popup AI chat functionality

**Common Issues:**

❌ **"I apologize, but I encountered an error" Message**

- **Root Cause:** Wrong Gemini model name or API configuration
- **Symptoms:** Generic error messages instead of AI responses
- **Diagnosis:** Check browser console for API errors (404, 403)
- **Solution:**
  1. Open `ai-chat-full.js` and `popup-fixed.js`
  2. Update AI_CONFIG: `model: "gemini-2.5-flash"` (NOT "gemini-1.5-flash")
  3. Verify API key: `apiKey: "AIzaSyB-j8iXAEg_W-I2l3PodnJMoO_wgai2VDU"`
  4. Confirm base URL: `"https://generativelanguage.googleapis.com/v1beta"`
- **Verification:** AI should respond with proper security guidance

❌ **Node.js "document is not defined" Error**

- **Cause:** Running browser-specific JavaScript in Node.js environment
- **Solution:** Only run AI chat files in browser context, not terminal
- **Prevention:** Use proper testing environment (browser/extension)

### 3. **Smart Prevention System**

**Files:**

- `smart-prevention-system.js` - Core threat detection logic
- `malicious-blocking-rules.json` - Malicious URL/content rules
- `ad-blocking-rules.json` - Advertisement blocking configuration

**Configuration:**

- **Sensitivity Levels:** LOW, MEDIUM, HIGH, PARANOID
- **Default:** MEDIUM (balanced security and usability)
- **Adjustment:** Modify `sensitivityLevel` in smart-prevention-system.js

**Common Issues:**

❌ **Too Many False Positives**

- **Solution:** Lower sensitivity in configuration
- **File:** `smart-prevention-system.js` → `sensitivityLevel: "LOW"`

❌ **Threats Not Being Blocked**

- **Solution:** Increase sensitivity or update rule files
- **Action:** Update `malicious-blocking-rules.json` with new threat patterns

### 4. **Disposable Email Service**

**Files:**

- `disposable-email.js` - Temporary email generation and management

**Features:**

- Generate temporary emails for registrations
- Automatic cleanup after specified time
- Privacy protection for user identity

### 5. **Secure File Viewer**

**Files:**

- `file-viewer-secure.html` - Safe document viewing interface
- `file-viewer-secure.js` - Secure file handling logic

**Security Features:**

- Sandboxed document viewing
- Malware prevention during file access
- Safe preview without execution

---

## ⚙️ EXTENSION MANAGEMENT

### **Installation & Setup**

1. **Chrome Installation:**

   ```
   1. Open Chrome → More Tools → Extensions
   2. Enable "Developer mode" (top right)
   3. Click "Load unpacked"
   4. Select the `src` folder
   5. Verify extension appears in toolbar
   ```

2. **Permissions Required:**
   - `activeTab` - Access current tab for security scanning
   - `storage` - Save user preferences and settings
   - `background` - Run security monitoring service
   - `webRequest` - Intercept and analyze network requests

### **Configuration Files**

**`manifest.json`** - Core extension configuration

```json
{
  "manifest_version": 3,
  "name": "NULL VOID",
  "version": "1.0",
  "permissions": ["activeTab", "storage", "background"],
  "background": {
    "service_worker": "background.js"
  }
}
```

**`background.js`** - Service worker for continuous protection

- Monitors web requests for threats
- Manages extension lifecycle
- Handles security event logging

---

## 🚨 SECURITY BEST PRACTICES

### **For Users:**

1. **Always Use Disposable Browser for:**

   - Suspicious links or emails
   - Unknown file downloads
   - Untrusted websites
   - Banking on public WiFi

2. **Enable All Protection Features:**

   - Smart Prevention: HIGH sensitivity
   - Real-time scanning: ENABLED
   - Privacy mode: ALWAYS ON

3. **Regular Maintenance:**
   - Update API credentials monthly
   - Review threat detection logs
   - Clear disposable data regularly

### **For Developers:**

1. **API Security:**

   - Never commit API keys to version control
   - Use environment variables for sensitive data
   - Rotate credentials regularly

2. **Error Handling:**

   - Implement comprehensive try-catch blocks
   - Provide specific error messages for debugging
   - Log security events for analysis

3. **Input Validation:**
   - Sanitize all user inputs
   - Validate API responses before processing
   - Implement rate limiting for API calls

---

## 🔍 DIAGNOSTIC COMMANDS

### **API Testing:**

```bash
# Test Gemini AI API
curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'

# Test Browserless API
curl -X GET "https://YOUR_INSTANCE.browserless.io/json/version"
```

### **Extension Debugging:**

```javascript
// Check extension status in browser console
chrome.runtime.getManifest();

// Verify storage data
chrome.storage.local.get(null, (data) => console.log(data));

// Test background script
chrome.runtime.sendMessage({ action: "test" });
```

---

## 📞 SUPPORT & ESCALATION

### **Common Resolution Steps:**

1. **First Aid:**

   - Reload extension (disable/enable)
   - Clear browser cache and cookies
   - Check console for error messages

2. **Advanced Troubleshooting:**

   - Verify API credentials and endpoints
   - Update configuration files
   - Test individual components

3. **Escalation Criteria:**
   - Security threats detected but not blocked
   - Data privacy concerns
   - Extension completely non-functional
   - Suspected compromise or breach

### **Log Collection:**

```javascript
// Export extension logs for support
const logs = {
  manifest: chrome.runtime.getManifest(),
  storage: await chrome.storage.local.get(null),
  errors: console.getErrors?.() || "Check browser console",
};
console.log("Extension Debug Info:", JSON.stringify(logs, null, 2));
```

---

## 🎯 SECURITY AI RESPONSE GUIDELINES

When providing support:

1. **Always prioritize user security and privacy**
2. **Provide exact file names and line numbers when possible**
3. **Include verification steps for every solution**
4. **Explain the security implications of each action**
5. **Offer alternative solutions when primary fails**
6. **Reference this knowledge base for accuracy**
7. **Never hallucinate features or capabilities**
8. **Always include step-by-step instructions**

---

_This knowledge base is maintained for the NULL VOID Security AI system to provide accurate, precise guidance to users._
