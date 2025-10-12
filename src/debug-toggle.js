// Debug Smart Prevention Toggle
// Run this in the popup console to debug the toggle issue

console.log("🔧 Starting Smart Prevention Toggle Debug...");

async function debugToggle() {
  console.log("\n📋 Debug: Smart Prevention Toggle Issue");

  const toggle = document.getElementById("smartPrevention");
  if (!toggle) {
    console.log("❌ Toggle element not found!");
    return;
  }

  console.log("✅ Toggle element found");
  console.log("📊 Initial state:", toggle.checked);

  // Test 1: Storage communication
  console.log("\n🔍 Testing storage communication...");
  try {
    const initialStorage = await chrome.storage.local.get([
      "smartPreventionEnabled",
    ]);
    console.log("📦 Initial storage value:", initialStorage);

    // Test write
    await chrome.storage.local.set({ smartPreventionEnabled: true });
    console.log("✅ Storage write successful");

    // Test read
    const newStorage = await chrome.storage.local.get([
      "smartPreventionEnabled",
    ]);
    console.log("📦 New storage value:", newStorage);
  } catch (storageError) {
    console.log("❌ Storage error:", storageError);
  }

  // Test 2: Background communication
  console.log("\n🔍 Testing background communication...");
  try {
    const statusResponse = await chrome.runtime.sendMessage({
      action: "getSmartPreventionStatus",
    });
    console.log("✅ Status response:", statusResponse);

    const toggleResponse = await chrome.runtime.sendMessage({
      action: "toggleSmartPrevention",
      enabled: true,
    });
    console.log("✅ Toggle response:", toggleResponse);
  } catch (backgroundError) {
    console.log("❌ Background communication error:", backgroundError);
  }

  // Test 3: Manual toggle
  console.log("\n🔍 Testing manual toggle...");
  const originalState = toggle.checked;

  // Simulate the toggle handler manually
  toggle.checked = !originalState;
  console.log("📊 Manually changed toggle to:", toggle.checked);

  // Try calling the handler directly
  try {
    if (typeof handleSmartPreventionToggle === "function") {
      console.log("🎯 Calling handleSmartPreventionToggle directly...");
      await handleSmartPreventionToggle();
      console.log("✅ Handler completed successfully");
    } else {
      console.log("❌ handleSmartPreventionToggle function not found");
    }
  } catch (handlerError) {
    console.log("❌ Handler error:", handlerError);
  }

  console.log("📊 Final toggle state:", toggle.checked);
}

// Test the current state
async function testCurrentState() {
  console.log("\n📋 Current State Test");

  try {
    // Check storage
    const storage = await chrome.storage.local.get(["smartPreventionEnabled"]);
    console.log("📦 Storage state:", storage.smartPreventionEnabled);

    // Check background
    const background = await chrome.runtime.sendMessage({
      action: "getSmartPreventionStatus",
    });
    console.log("🏃 Background state:", background.enabled);

    // Check toggle
    const toggle = document.getElementById("smartPrevention");
    console.log("🎛️ Toggle state:", toggle?.checked);

    // Check if they match
    const states = [
      storage.smartPreventionEnabled,
      background.enabled,
      toggle?.checked,
    ];
    const allMatch = states.every((state) => state === states[0]);

    console.log("🔍 All states match:", allMatch);
    if (!allMatch) {
      console.log("⚠️ State mismatch detected!");
      console.log("📊 States:", {
        storage: storage.smartPreventionEnabled,
        background: background.enabled,
        toggle: toggle?.checked,
      });
    }
  } catch (error) {
    console.log("❌ State test error:", error);
  }
}

// Quick fix attempt
async function quickFix() {
  console.log("\n🔧 Attempting quick fix...");

  try {
    // Reset everything to false first
    const toggle = document.getElementById("smartPrevention");
    if (toggle) {
      toggle.checked = false;
    }

    await chrome.storage.local.set({ smartPreventionEnabled: false });

    await chrome.runtime.sendMessage({
      action: "toggleSmartPrevention",
      enabled: false,
    });

    console.log("✅ Reset to false completed");

    // Wait a moment
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Now try to enable
    if (toggle) {
      toggle.checked = true;
    }

    await chrome.storage.local.set({ smartPreventionEnabled: true });

    const response = await chrome.runtime.sendMessage({
      action: "toggleSmartPrevention",
      enabled: true,
    });

    console.log("✅ Enable attempt response:", response);
  } catch (error) {
    console.log("❌ Quick fix error:", error);
  }
}

// Make functions available
window.debugSmartPrevention = {
  debugToggle,
  testCurrentState,
  quickFix,
};

console.log("🔧 Debug tools loaded!");
console.log("💡 Run 'debugToggle()' to debug the toggle issue");
console.log("💡 Run 'testCurrentState()' to check current state");
console.log("💡 Run 'quickFix()' to attempt a reset and fix");

// Auto-run current state test
testCurrentState();
