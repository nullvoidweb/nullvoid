// Secret storage (API keys, tokens, mailbox passwords).
//
// Secrets live in the extension origin's IndexedDB rather than
// chrome.storage.local: content scripts can read storage.local, but they run
// in the web page's origin and cannot open the extension's IndexedDB. Values
// are additionally encrypted with a non-extractable AES-GCM key so they are not
// stored as plain text on disk.

const DB_NAME = "nullvoid-vault";
const STORE = "kv";
const KEY_ID = "__vault_key__";

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    Promise.resolve(fn(store)).then((r) => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function rawGet(key) {
  return tx("readonly", (s) => reqToPromise(s.get(key)));
}

async function rawSet(key, value) {
  return tx("readwrite", (s) => { s.put(value, key); });
}

let keyPromise = null;

async function vaultKey() {
  if (keyPromise) return keyPromise;
  keyPromise = (async () => {
    const existing = await rawGet(KEY_ID);
    if (existing) return existing;
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    await rawSet(KEY_ID, key);
    return key;
  })();
  return keyPromise;
}

async function encrypt(value) {
  const key = await vaultKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(value));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return { iv, ct: new Uint8Array(ct) };
}

async function decrypt(box) {
  const key = await vaultKey();
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: box.iv }, key, box.ct);
  return JSON.parse(new TextDecoder().decode(pt));
}

export const SECRET_KEYS = Object.freeze([
  "anthropicKey",
  "openaiKey",
  "geminiKey",
  "safeBrowsingKey",
  "virusTotalKey",
  "abuseChKey",
  "rbiToken",
]);

export async function getSecret(name) {
  const box = await rawGet(`secret:${name}`);
  if (!box) return "";
  try {
    return await decrypt(box);
  } catch {
    return "";
  }
}

export async function setSecret(name, value) {
  if (value === "" || value == null) {
    await tx("readwrite", (s) => { s.delete(`secret:${name}`); });
    return;
  }
  await rawSet(`secret:${name}`, await encrypt(value));
}

export async function getSecrets(names = SECRET_KEYS) {
  const out = {};
  for (const n of names) out[n] = await getSecret(n);
  return out;
}

/** Which secrets are configured, without revealing them. */
export async function secretStatus(names = SECRET_KEYS) {
  const out = {};
  for (const n of names) out[n] = Boolean(await getSecret(n));
  return out;
}

/** Arbitrary encrypted JSON records (e.g. disposable mailbox credentials). */
export async function getRecord(name, fallback = null) {
  const box = await rawGet(`record:${name}`);
  if (!box) return fallback;
  try {
    return await decrypt(box);
  } catch {
    return fallback;
  }
}

export async function setRecord(name, value) {
  await rawSet(`record:${name}`, await encrypt(value));
}

export async function deleteRecord(name) {
  await tx("readwrite", (s) => { s.delete(`record:${name}`); });
}

export async function wipeVault() {
  await tx("readwrite", (s) => { s.clear(); });
  keyPromise = null;
}
