// Request/response messaging between extension pages, content scripts and the
// background service worker. Every response is an envelope: { ok, data | error }.
import { api } from "./browser.js";

export class RemoteError extends Error {
  constructor(action, message) {
    super(message);
    this.name = "RemoteError";
    this.action = action;
  }
}

export async function call(action, payload = {}) {
  let res;
  try {
    res = await api.runtime.sendMessage({ action, payload });
  } catch (err) {
    throw new RemoteError(action, err?.message || String(err));
  }
  if (!res) throw new RemoteError(action, `No handler responded to "${action}"`);
  if (!res.ok) throw new RemoteError(action, res.error || `"${action}" failed`);
  return res.data;
}

/** Fire-and-forget broadcast to any open extension page. */
export function broadcast(event, data = {}) {
  return api.runtime.sendMessage({ event, data }).catch(() => {});
}

export function onBroadcast(event, handler) {
  const listener = (msg) => {
    if (msg && msg.event === event) handler(msg.data);
  };
  api.runtime.onMessage.addListener(listener);
  return () => api.runtime.onMessage.removeListener(listener);
}
