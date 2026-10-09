// Background inbox watcher: polls every disposable mailbox with chrome.alarms
// (MV3 service workers cannot keep timers alive), notifies about new mail and
// surfaces one-time codes right in the notification.
import { api, extensionUrl } from "../lib/browser.js";
import { getSettings } from "../lib/settings.js";
import { extractCodes } from "../lib/otp.js";
import { getMeta, getMailbox, mailClient, updateBoxMeta, getSeen, setSeen, saveToken, ensureActiveMailbox, createMailbox, deleteMailbox, setActive } from "../lib/mailboxes.js";
import { broadcast } from "../lib/messaging.js";
import { handle } from "./router.js";

export const MAIL_ALARM = "nv-mail-poll";
const LATEST_KEY = "nv.email.latest";

export async function scheduleMailPolling() {
  const settings = await getSettings();
  const meta = await getMeta();
  if (!meta.boxes.length) {
    await api.alarms.clear(MAIL_ALARM);
    return;
  }
  const periodInMinutes = Math.max(0.5, settings.email.pollSeconds / 60);
  const existing = await api.alarms.get(MAIL_ALARM);
  if (!existing || existing.periodInMinutes !== periodInMinutes) {
    await api.alarms.create(MAIL_ALARM, { periodInMinutes, delayInMinutes: 0.1 });
  }
}

export async function pollMailboxes({ notify = true } = {}) {
  const settings = await getSettings();
  const meta = await getMeta();
  const client = await mailClient();
  let anyNew = false;
  for (const boxMeta of meta.boxes) {
    const box = await getMailbox(boxMeta.id);
    if (!box) continue;
    try {
      const before = box.token;
      const { items, total } = await client.listMessages(box);
      if (box.token !== before) await saveToken(box.id, box.token);
      const seen = await getSeen(box.id);
      const firstSync = seen.size === 0 && !boxMeta.lastChecked;
      const fresh = items.filter((m) => !seen.has(m.id));
      for (const m of items) seen.add(m.id);
      await setSeen(box.id, seen);
      await updateBoxMeta(box.id, { unread: items.filter((m) => !m.seen).length, total, lastChecked: Date.now(), error: null });
      if (!fresh.length || firstSync) continue;
      anyNew = true;
      for (const m of fresh.slice(0, 3)) {
        let codes = extractCodes(m.intro || "", m.subject || "");
        if (!codes.length) {
          try {
            const full = await client.getMessage(box, m.id);
            codes = extractCodes(full.text || "", m.subject || "");
          } catch { /* keep intro-only result */ }
        }
        await api.storage.local.set({ [LATEST_KEY]: { boxId: box.id, msgId: m.id, from: m.from?.address, subject: m.subject, code: codes[0] || null, ts: Date.now() } });
        if (notify && settings.email.notifications) {
          api.notifications.create(`nv-mail|${box.id}|${m.id}`, {
            type: "basic",
            iconUrl: extensionUrl("icons/icon128.png"),
            title: codes[0] ? `Code ${codes[0]} — ${m.from?.name || m.from?.address || "new e-mail"}` : `New e-mail: ${m.subject || "(no subject)"}`,
            message: `${m.from?.address || ""}\n${m.subject || ""}\nTo: ${box.address}`.slice(0, 250),
            priority: 1,
          });
        }
      }
    } catch (err) {
      await updateBoxMeta(box.id, { error: err.message, lastChecked: Date.now() });
    }
  }
  if (anyNew) broadcast("email:updated");
  return { ok: true };
}

api.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === MAIL_ALARM) pollMailboxes().catch(console.error);
});

api.notifications.onClicked.addListener((id) => {
  if (id.startsWith("nv-mail|")) {
    const [, box, msg] = id.split("|");
    api.tabs.create({ url: `${extensionUrl("inbox/inbox.html")}?box=${encodeURIComponent(box)}&msg=${encodeURIComponent(msg)}` });
    api.notifications.clear(id);
  }
});

handle("email:state", async () => {
  const meta = await getMeta();
  const { [LATEST_KEY]: latest = null } = await api.storage.local.get(LATEST_KEY);
  return { ...meta, latest };
});

handle("email:ensure", async () => {
  const box = await ensureActiveMailbox();
  await scheduleMailPolling();
  return box;
});

handle("email:create", async ({ domain, label } = {}) => {
  const box = await createMailbox({ domain, label });
  await scheduleMailPolling();
  broadcast("email:updated");
  return box;
});

handle("email:delete", async ({ id }) => {
  const meta = await deleteMailbox(id);
  await scheduleMailPolling();
  broadcast("email:updated");
  return meta;
});

handle("email:setActive", async ({ id }) => {
  const meta = await setActive(id);
  broadcast("email:updated");
  return meta;
});

handle("email:poll", () => pollMailboxes({ notify: false }));
