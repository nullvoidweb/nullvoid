// Cross-browser WebExtension namespace. Firefox exposes the promise-based
// `browser` object; Chromium exposes `chrome` (promise-capable in MV3).
export const api = globalThis.browser ?? globalThis.chrome;

export const isFirefox = typeof globalThis.browser !== "undefined" &&
  typeof globalThis.browser.runtime?.getBrowserInfo === "function";

export function extensionUrl(path = "") {
  return api.runtime.getURL(path);
}

/** True when `url` points at one of this extension's own pages. */
export function isExtensionUrl(url) {
  return typeof url === "string" && url.startsWith(api.runtime.getURL(""));
}

/** Pages the extension can never script (browser UI, stores, other extensions). */
export function isRestrictedUrl(url) {
  if (!url) return true;
  return /^(chrome|edge|brave|opera|vivaldi|about|moz-extension|chrome-extension|devtools|view-source|resource|chrome-search|file):/i.test(url) ||
    /^https:\/\/(chrome\.google\.com\/webstore|chromewebstore\.google\.com|addons\.mozilla\.org|microsoftedge\.microsoft\.com\/addons)/i.test(url);
}

export function isWebUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

/**
 * Firefox 140+ asks users to consent to optional data transmission declared in
 * `data_collection_permissions`. Chrome has no equivalent, so this resolves true.
 */
export async function ensureDataConsent(category) {
  if (!isFirefox || !api.permissions?.request) return true;
  try {
    const has = await api.permissions.contains({ data_collection: [category] });
    if (has) return true;
    return await api.permissions.request({ data_collection: [category] });
  } catch {
    // Older Firefox builds without the data-collection framework.
    return true;
  }
}
