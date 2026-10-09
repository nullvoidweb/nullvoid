// Security activity log + counters (storage.local, bounded ring buffer).
import { api } from "./browser.js";

const LOG_KEY = "nv.events";
const STATS_KEY = "nv.stats";
const MAX_EVENTS = 500;

let queue = Promise.resolve();
const serial = (fn) => (queue = queue.then(fn, fn));

/**
 * @param {{ type: string, severity?: "info"|"low"|"medium"|"high"|"critical", title: string, url?: string, detail?: string }} evt
 */
export function logEvent(evt) {
  return serial(async () => {
    const { [LOG_KEY]: log = [] } = await api.storage.local.get(LOG_KEY);
    log.unshift({ id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, ts: Date.now(), severity: "info", ...evt });
    if (log.length > MAX_EVENTS) log.length = MAX_EVENTS;
    await api.storage.local.set({ [LOG_KEY]: log });
  });
}

export async function getEvents(limit = MAX_EVENTS) {
  const { [LOG_KEY]: log = [] } = await api.storage.local.get(LOG_KEY);
  return log.slice(0, limit);
}

export function clearEvents() {
  return serial(() => api.storage.local.remove([LOG_KEY, STATS_KEY]));
}

export function bumpStat(name, n = 1) {
  return serial(async () => {
    const { [STATS_KEY]: stats = {} } = await api.storage.local.get(STATS_KEY);
    stats[name] = (stats[name] || 0) + n;
    stats.since = stats.since || Date.now();
    await api.storage.local.set({ [STATS_KEY]: stats });
  });
}

export async function getStats() {
  const { [STATS_KEY]: stats = {} } = await api.storage.local.get(STATS_KEY);
  return stats;
}
