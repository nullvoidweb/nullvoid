// Local "ephemeral" browsing mode — the fallback when no remote browser is
// configured. Prefers a private (incognito) window, whose storage the browser
// discards on close. Otherwise uses a dedicated window and wipes cookies,
// storage and cache for every origin it visited when the window closes.
import { api, isWebUrl, isFirefox } from "../lib/browser.js";
import { logEvent } from "../lib/events.js";
import { handle } from "./router.js";

const WINDOWS_KEY = "nv.ephemeralWindows"; // windowId -> { origins[], incognito, startedAt }

async function getWindows() {
  const { [WINDOWS_KEY]: map = {} } = await api.storage.session.get(WINDOWS_KEY);
  return map;
}

async function setWindows(map) {
  await api.storage.session.set({ [WINDOWS_KEY]: map });
}

handle("rbi:openLocal", async ({ url }) => {
  const target = isWebUrl(url) ? url : "https://duckduckgo.com/";
  let incognitoAllowed = false;
  try {
    incognitoAllowed = await api.extension.isAllowedIncognitoAccess();
  } catch { /* unsupported */ }

  if (incognitoAllowed) {
    try {
      const win = await api.windows.create({ url: target, incognito: true, focused: true });
      await logEvent({ type: "rbi-local", severity: "info", title: "Opened a private ephemeral window" });
      return { mode: "incognito", windowId: win.id };
    } catch { /* fall through to a temporary window */ }
  }
  const win = await api.windows.create({ url: target, focused: true });
  const map = await getWindows();
  map[win.id] = { origins: [new URL(target).origin], incognito: false, startedAt: Date.now() };
  await setWindows(map);
  await logEvent({ type: "rbi-local", severity: "info", title: "Opened a temporary window (site data is wiped on close)" });
  return { mode: "temporary", windowId: win.id, incognitoAllowed };
});

api.tabs.onUpdated.addListener(async (_tabId, change, tab) => {
  if (!change.url || !isWebUrl(change.url)) return;
  const map = await getWindows();
  const entry = map[tab.windowId];
  if (!entry) return;
  const origin = new URL(change.url).origin;
  if (!entry.origins.includes(origin)) {
    entry.origins.push(origin);
    await setWindows(map);
  }
});

api.windows.onRemoved.addListener(async (windowId) => {
  const map = await getWindows();
  const entry = map[windowId];
  if (!entry) return;
  delete map[windowId];
  await setWindows(map);
  try {
    // Chrome filters by `origins`; Firefox only understands `hostnames`.
    const filter = isFirefox
      ? { hostnames: [...new Set(entry.origins.map((o) => new URL(o).hostname))] }
      : { origins: entry.origins };
    const types = isFirefox
      ? { cookies: true, localStorage: true, indexedDB: true, serviceWorkers: true }
      : { cookies: true, localStorage: true, indexedDB: true, cacheStorage: true, serviceWorkers: true, fileSystems: true, cache: true };
    await api.browsingData.remove(filter, types);
    await logEvent({ type: "rbi-local-wipe", severity: "info", title: `Wiped data for ${entry.origins.length} site(s) from the temporary window` });
  } catch (err) {
    await logEvent({ type: "rbi-local-wipe", severity: "medium", title: "Could not wipe temporary window data", detail: err.message });
  }
});
