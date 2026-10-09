// Message router for the service worker. Handlers are registered by feature
// modules; each declares whether content scripts (which run inside untrusted
// web pages) may call it. Everything else is restricted to extension pages.
import { api, isExtensionUrl } from "../lib/browser.js";

const handlers = new Map();

/**
 * @param {string} action
 * @param {(payload: any, sender: chrome.runtime.MessageSender) => any} fn
 * @param {{ contentScripts?: boolean }} [opts]
 */
export function handle(action, fn, { contentScripts = false } = {}) {
  if (handlers.has(action)) throw new Error(`Duplicate handler for ${action}`);
  handlers.set(action, { fn, contentScripts });
}

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.action !== "string") return false;
  if (sender.id !== api.runtime.id) return false;
  const h = handlers.get(msg.action);
  if (!h) return false;
  const fromExtensionPage = isExtensionUrl(sender.url) && !sender.tab?.url?.startsWith("http");
  const allowed = fromExtensionPage || (h.contentScripts && sender.tab);
  if (!allowed) {
    sendResponse({ ok: false, error: "Not permitted from this context" });
    return false;
  }
  Promise.resolve()
    .then(() => h.fn(msg.payload ?? {}, sender))
    .then(
      (data) => sendResponse({ ok: true, data }),
      (err) => {
        console.warn(`[NULL VOID] ${msg.action} failed:`, err);
        sendResponse({ ok: false, error: err?.message || String(err) });
      },
    );
  return true; // keep the channel open for the async response
});
