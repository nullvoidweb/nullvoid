// Pass a Blob from one extension page to another (e.g. an e-mail attachment
// to the Secure File Viewer) without routing megabytes through
// chrome.storage or runtime messaging. Entries are single-use and expire.
import { randomId } from "./crypto.js";

const DB = "nullvoid-handoff";
const STORE = "items";
const TTL_MS = 10 * 60 * 1000;

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run(mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const out = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(out?.result ?? out);
    tx.onerror = () => reject(tx.error);
  }));
}

export async function putHandoff(blob, meta = {}) {
  const id = randomId(20);
  await run("readwrite", (s) => s.put({ blob, meta, ts: Date.now() }, id));
  return id;
}

export async function takeHandoff(id) {
  const item = await run("readonly", (s) => s.get(id));
  await run("readwrite", (s) => {
    s.delete(id);
    // Opportunistic cleanup of stale entries.
    const cursorReq = s.openCursor();
    cursorReq.onsuccess = () => {
      const c = cursorReq.result;
      if (!c) return;
      if (Date.now() - (c.value?.ts || 0) > TTL_MS) c.delete();
      c.continue();
    };
  });
  if (!item || Date.now() - item.ts > TTL_MS) return null;
  return item;
}
