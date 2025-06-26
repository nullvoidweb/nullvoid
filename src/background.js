// Use browser-specific API namespace
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Listen for when the extension is installed or updated
browserAPI.runtime.onInstalled.addListener(() => {
    console.log('Simplified Secure Browser Extension Installed');
});

// --- Ephemeral Tab Cleanup ---
// Listen for when a tab is closed
browserAPI.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    const result = await browserAPI.storage.local.get('ephemeralTabId');
    if (result.ephemeralTabId === tabId) {
        console.log(`Ephemeral tab ${tabId} closed. Attempting to clear Browse data.`);

        // In a real scenario, you'd want to clear data *only for the origin*
        // visited in that ephemeral tab. This is complex as browsers don't
        // expose the history of a closed tab easily to extensions.
        // For simplicity, we'll try to clear general data types.
        // CAUTION: browserAPI.BrowseData.remove() can be broad.
        // For production, you'd need a more sophisticated method, potentially
        // by listening to webNavigation events within the ephemeral tab
        // to collect origins.

        try {
            await browserAPI.BrowseData.remove({
                since: 0 // Clear all time
            }, {
                cookies: true,
                history: true,
                localStorage: true,
                cache: true
            });
            console.log(`Browse data for tab ${tabId} (potentially) cleared.`);
        } catch (e) {
            console.error(`Failed to clear Browse data for ephemeral tab ${tabId}:`, e);
        }

        // Clear the stored ephemeral tab ID
        await browserAPI.storage.local.remove('ephemeralTabId');
    }
});

// --- Content Script for Auto-Fill (Optional for Disposable Email) ---
// You could add a context menu item to auto-fill an email,
// or let the user copy/paste manually.
// This example doesn't include auto-fill content script for simplicity,
// as the primary function of the email is to display and copy.
// If you wanted auto-fill, you'd need a content.js and inject it
// using chrome.scripting.executeScript.