// Disposable mailbox registry shared by the service worker and extension
// pages. Credentials (password + token) are kept in the encrypted vault;
// non-secret metadata lives in storage.local so the popup can render quickly.
import { api } from "./browser.js";
import { getRecord, setRecord } from "./vault.js";
import { MailTmClient } from "./mailtm.js";
import { getSettings } from "./settings.js";

const META_KEY = "nv.email.meta";
const CRED_RECORD = "mailboxes";
export const MAX_MAILBOXES = 10;

let queue = Promise.resolve();
const serial = (fn) => (queue = queue.then(fn, fn));

export async function mailClient() {
  const s = await getSettings();
  return new MailTmClient({ baseUrl: s.email.baseUrl, mercureUrl: s.email.mercureUrl });
}

export async function getMeta() {
  const { [META_KEY]: meta } = await api.storage.local.get(META_KEY);
  return meta ?? { active: null, boxes: [] };
}

async function setMeta(meta) {
  await api.storage.local.set({ [META_KEY]: meta });
  return meta;
}

async function getCreds() {
  return (await getRecord(CRED_RECORD, [])) ?? [];
}

/** Full mailbox (with credentials) by id; defaults to the active one. */
export async function getMailbox(id) {
  const meta = await getMeta();
  const target = id ?? meta.active;
  const creds = await getCreds();
  return creds.find((c) => c.id === target) ?? null;
}

export async function saveToken(id, token) {
  return serial(async () => {
    const creds = await getCreds();
    const c = creds.find((x) => x.id === id);
    if (c && c.token !== token) {
      c.token = token;
      await setRecord(CRED_RECORD, creds);
    }
  });
}

export function createMailbox({ domain, label } = {}) {
  return serial(async () => {
    const meta = await getMeta();
    if (meta.boxes.length >= MAX_MAILBOXES) throw new Error(`You can keep up to ${MAX_MAILBOXES} disposable inboxes. Delete one first.`);
    const client = await mailClient();
    const box = await client.createMailbox({ domain });
    const creds = await getCreds();
    creds.push({ ...box, label: label || "" });
    await setRecord(CRED_RECORD, creds);
    meta.boxes.unshift({ id: box.id, address: box.address, createdAt: box.createdAt, label: label || "", unread: 0, total: 0, lastChecked: 0 });
    meta.active = box.id;
    await setMeta(meta);
    return meta.boxes[0];
  });
}

export function setActive(id) {
  return serial(async () => {
    const meta = await getMeta();
    if (!meta.boxes.some((b) => b.id === id)) throw new Error("Unknown mailbox");
    meta.active = id;
    return setMeta(meta);
  });
}

export function updateBoxMeta(id, patch) {
  return serial(async () => {
    const meta = await getMeta();
    const b = meta.boxes.find((x) => x.id === id);
    if (b) Object.assign(b, patch);
    return setMeta(meta);
  });
}

/** Delete a mailbox remotely (best effort) and locally. */
export function deleteMailbox(id, { remote = true } = {}) {
  return serial(async () => {
    const creds = await getCreds();
    const c = creds.find((x) => x.id === id);
    if (c && remote) {
      try {
        await (await mailClient()).deleteMailbox(c);
      } catch { /* already gone or offline — remove locally anyway */ }
    }
    await setRecord(CRED_RECORD, creds.filter((x) => x.id !== id));
    const meta = await getMeta();
    meta.boxes = meta.boxes.filter((b) => b.id !== id);
    if (meta.active === id) meta.active = meta.boxes[0]?.id ?? null;
    await api.storage.local.remove(`nv.email.seen.${id}`);
    return setMeta(meta);
  });
}

/** Ensure there is an active mailbox, creating one when needed. */
export async function ensureActiveMailbox() {
  const meta = await getMeta();
  if (meta.active && meta.boxes.some((b) => b.id === meta.active)) return meta.boxes.find((b) => b.id === meta.active);
  if (meta.boxes.length) {
    await setActive(meta.boxes[0].id);
    return meta.boxes[0];
  }
  return createMailbox();
}

export async function getSeen(id) {
  const key = `nv.email.seen.${id}`;
  const { [key]: seen = [] } = await api.storage.local.get(key);
  return new Set(seen);
}

export async function setSeen(id, ids) {
  await api.storage.local.set({ [`nv.email.seen.${id}`]: [...ids].slice(-300) });
}
