# 🔧 Disposable Browser Troubleshooting Guide

## ❌ Issue: Start Button Not Working

The disposable browser start button is not responding when clicked. This guide will help you diagnose and fix the issue.

## ✅ Recent Fixes Applied

### 1. **Fixed Syntax Errors**

- ❌ **popup.js**: Fixed `document.document` syntax error
- ❌ **background.js**: Fixed truncated comment syntax error
- ✅ Both files now have clean syntax

### 2. **Improved Button Selection**

- ❌ **Old**: `document.querySelector(".service-section")` (selected first section)
- ✅ **New**: Find section with "Disposable Browser" heading specifically

### 3. **Enhanced Error Handling & Debugging**

- ✅ Added comprehensive console logging
- ✅ Better error messages and notifications
- ✅ Improved async error handling

## 🔍 Step-by-Step Debugging

### **Step 1: Check Console Logs**

1. **Open the extension popup**
2. **Right-click** → **Inspect** (or F12)
3. **Go to Console tab**
4. **Look for these log messages:**

```
[Popup] DOM loaded, initializing...
[Popup] Looking for disposable browser section...
[Popup] Browser section found: true
[Popup] Start button found: true
[Popup] Start button text: start
[Popup] Adding click event listener to start button
```

**❌ If you see `Browser section found: false`:**

- The HTML structure might be different
- Check if popup.html has the correct structure

**❌ If you see `Start button found: false`:**

- The button selector is not working
- Check if the button exists and has class `btn-primary`

### **Step 2: Test Button Click**

1. **Click the "start" button**
2. **Check console for:**

```
[Popup] Start button clicked!
[Popup] Selected region: singapore
[RBI] Launching disposable browser in region: singapore
[Background] Received initializeRBISession request for region: singapore
[Background] RBI session init result: {success: true, sessionId: "...", ...}
[RBI] Background response: {success: true, ...}
[RBI] Creating tab with URL: chrome-extension://...rbi-browser.html?...
[RBI] Browser launched in tab ... with session ...
```

**❌ If missing any of these logs:**

- Follow the specific troubleshooting steps below

### **Step 3: Check Background Script**

1. **Go to Extensions page** (`chrome://extensions/`)
2. **Click "service worker" link** next to NULL VOID extension
3. **Check console for background logs**

## 🚨 Common Issues & Solutions

### **Issue 1: Button Not Found**

**Symptoms:**

```
[Popup] Browser section found: false
```

**Solution:**
Check popup.html structure:

```html
<div class="service-section">
  <div class="service-header">
    <h3>Disposable Browser</h3>
    <div class="service-controls">
      <button class="btn btn-primary">start</button>
      <button class="btn btn-secondary">singapore</button>
    </div>
  </div>
</div>
```

### **Issue 2: Background Script Not Responding**

**Symptoms:**

```
[Popup] Start button clicked!
[RBI] Launching disposable browser in region: singapore
// No background response logs
```

**Solutions:**

1. **Reload Extension:**

   - Go to `chrome://extensions/`
   - Click reload button on NULL VOID extension

2. **Check Service Worker:**
   - Click "service worker" link
   - If it says "inactive", click it to activate
   - Check for any error messages

### **Issue 3: Permission Errors**

**Symptoms:**

```
Error: Could not establish connection
```

**Solution:**
Check manifest.json permissions:

```json
{
  "permissions": ["activeTab", "storage", "scripting", "tabs", "browsingData"],
  "host_permissions": ["<all_urls>"]
}
```

### **Issue 4: Tab Creation Fails**

**Symptoms:**

```
[RBI] Background response: {success: true, ...}
Error: Cannot access chrome://extensions/
```

**Solution:**
Check the RBI URL generation:

- Should be: `chrome-extension://[id]/rbi-browser.html`
- Not: `chrome://extensions/...`

## 🔧 Manual Testing Steps

### **Test 1: Direct Function Call**

1. **Open popup console**
2. **Run this command:**

```javascript
launchDisposableBrowser("singapore").then(console.log).catch(console.error);
```

3. **Check if function executes properly**

### **Test 2: Message Passing Test**

1. **Open popup console**
2. **Run this command:**

```javascript
chrome.runtime
  .sendMessage({ action: "initializeRBISession", region: "singapore" })
  .then(console.log)
  .catch(console.error);
```

3. **Should return:** `{success: true, sessionId: "...", ...}`

### **Test 3: Direct Tab Creation**

1. **Open popup console**
2. **Run this command:**

```javascript
chrome.tabs
  .create({
    url: chrome.runtime.getURL("rbi-browser.html"),
    active: true,
  })
  .then(console.log)
  .catch(console.error);
```

3. **Should open new tab with RBI interface**

## 📋 Quick Fix Checklist

- [ ] **Extension reloaded** after file changes
- [ ] **No console errors** in popup
- [ ] **No console errors** in background script
- [ ] **Button found** in DOM with correct text
- [ ] **Event listener attached** to button
- [ ] **Background script responding** to messages
- [ ] **rbi-browser.html exists** in src folder
- [ ] **Permissions granted** for tabs and storage
- [ ] **Service worker active** (not inactive)

## 🛠️ Advanced Debugging

### **Enable Verbose Logging**

Add this to popup.js (after line 1):

```javascript
// Enable verbose debugging
window.DEBUG_RBI = true;
console.log("[DEBUG] RBI debugging enabled");
```

### **Check File Existence**

Run in popup console:

```javascript
fetch(chrome.runtime.getURL("rbi-browser.html"))
  .then((r) => console.log("File exists:", r.ok))
  .catch((e) => console.error("File missing:", e));
```

### **Test Background Script Directly**

In background script console:

```javascript
handleRBISessionInit("singapore").then(console.log).catch(console.error);
```

## 🎯 Expected Working Flow

1. **User clicks "start" button**
2. **Event listener fires**
3. **Message sent to background script**
4. **Background creates session**
5. **New tab opens with RBI interface**
6. **Success notification shows**
7. **Button changes to "Active" with green color**

## 📞 If Issue Persists

If none of these steps resolve the issue:

1. **Copy all console logs** from both popup and background
2. **Check browser version** (Chrome/Edge 88+)
3. **Try in incognito mode** to rule out conflicts
4. **Disable other extensions** temporarily
5. **Clear extension storage**: `chrome.storage.local.clear()`

The debugging logs will show exactly where the process is failing and help identify the root cause.
