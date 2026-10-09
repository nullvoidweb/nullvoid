// NULL VOID service worker entry point. Every listener is registered at module
// top level (synchronously) so Chrome can wake the worker for any event.
import { api, extensionUrl } from "../lib/browser.js";
import { getSettings, saveSettings, onSettingsChanged } from "../lib/settings.js";
import { wipeVault } from "../lib/vault.js";
import { getEvents, clearEvents, getStats, logEvent } from "../lib/events.js";
import { getMeta, deleteMailbox } from "../lib/mailboxes.js";
import { handle } from "./router.js";
import { applyProtection } from "./protection.js";
import "./navigation.js";
import "./intel.js";
import "./downloads.js";
import { scheduleMailPolling, MAIL_ALARM } from "./email.js";
import { createMenus } from "./menus.js";
import "./rbi.js";
import "./page.js";
import "./auth.js";

async function boot(reason) {
  const settings = await getSettings();
  await saveSettings(settings); // persists migrations/defaults
  await applyProtection(settings);
  await scheduleMailPolling();
  if (reason) console.info(`[NULL VOID] ready (${reason})`);
}

api.runtime.onInstalled.addListener(async ({ reason, previousVersion }) => {
  createMenus();
  await boot(reason);
  if (reason === "install") {
    await logEvent({ type: "install", severity: "info", title: "NULL VOID installed — protection is on" });
    api.tabs.create({ url: `${extensionUrl("options/options.html")}#welcome` });
  } else if (reason === "update") {
    await logEvent({ type: "update", severity: "info", title: `Updated from ${previousVersion} to ${api.runtime.getManifest().version}` });
  }
});

api.runtime.onStartup.addListener(() => boot("startup"));

onSettingsChanged((next, prev) => {
  if (next.email.pollSeconds !== prev.email.pollSeconds) scheduleMailPolling();
});

api.commands?.onCommand.addListener(async (command) => {
  if (command === "open-disposable-browser") api.tabs.create({ url: extensionUrl("rbi/rbi.html") });
  if (command === "open-inbox") api.tabs.create({ url: extensionUrl("inbox/inbox.html") });
  if (command === "open-file-viewer") api.tabs.create({ url: extensionUrl("viewer/viewer.html") });
});

// --- Generic data handlers -------------------------------------------------------

handle("events:list", ({ limit }) => getEvents(limit));
handle("events:clear", () => clearEvents());
handle("stats:get", () => getStats());

handle("data:wipe", async ({ deleteRemoteMailboxes = true } = {}) => {
  const meta = await getMeta();
  for (const b of meta.boxes) await deleteMailbox(b.id, { remote: deleteRemoteMailboxes });
  await api.alarms.clear(MAIL_ALARM);
  await wipeVault();
  await api.storage.local.clear();
  await api.storage.session.clear();
  const dyn = await api.declarativeNetRequest.getDynamicRules();
  await api.declarativeNetRequest.updateDynamicRules({ removeRuleIds: dyn.map((r) => r.id) });
  const ses = await api.declarativeNetRequest.getSessionRules();
  await api.declarativeNetRequest.updateSessionRules({ removeRuleIds: ses.map((r) => r.id) });
  await boot("wipe");
  return { ok: true };
});
