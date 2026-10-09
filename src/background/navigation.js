// Navigation guard: remembers each tab's pending URL (so the interstitial can
// show what DNR blocked), scores top-level navigations with the offline
// heuristics, and optionally consults threat-intel services.
//
// The redirect is issued before anything else is awaited: every storage
// round-trip before tabs.update() is time in which the phishing page renders.
import { api, extensionUrl, isWebUrl, isExtensionUrl } from "../lib/browser.js";
import { getSettings, onSettingsChanged } from "../lib/settings.js";
import { analyzeUrl, blockThreshold } from "../lib/url-analysis.js";
import { normalizeHost } from "../lib/domain.js";
import { logEvent, bumpStat } from "../lib/events.js";
import { isAllowedForSession } from "./protection.js";
import { checkUrlReputation, combineVerdict } from "./intel.js";
import { handle } from "./router.js";

const navKey = (tabId) => `nv.nav.${tabId}`;
const tabKey = (tabId) => `nv.tab.${tabId}`;

let settingsCache = null;
onSettingsChanged((next) => { settingsCache = next; });
async function settings() {
  if (!settingsCache) settingsCache = await getSettings();
  return settingsCache;
}

function interstitial(params) {
  return `${extensionUrl("blocked/blocked.html")}?${new URLSearchParams(params)}`;
}

function trustedBy(s, url) {
  const host = normalizeHost(new URL(url).hostname);
  return s.protection.trustedSites.some((d) => host === d || host.endsWith(`.${d}`));
}

async function shouldSkip(s, url) {
  if (!isWebUrl(url) || trustedBy(s, url)) return true;
  return isAllowedForSession(new URL(url).hostname);
}

api.webNavigation.onBeforeNavigate.addListener(async ({ tabId, frameId, url }) => {
  if (frameId !== 0 || tabId < 0 || !isWebUrl(url)) return;
  const s = await settings();
  const p = s.protection;
  let analysis = null;
  if (p.enabled && p.heuristics !== "off") {
    analysis = analyzeUrl(url);
    if (analysis.score >= blockThreshold(p.heuristics) && !(await shouldSkip(s, url))) {
      api.tabs.update(tabId, { url: interstitial({ mode: "heuristic", url }) }).catch(() => {});
      bumpStat("heuristicBlocks");
      logEvent({ type: "heuristic-block", severity: "high", title: `Blocked look-alike/phishing pattern: ${analysis.host}`, url, detail: analysis.signals.map((x) => x.message).join(" ") });
    }
  }
  const record = { [navKey(tabId)]: { url, ts: Date.now() } };
  if (analysis) record[tabKey(tabId)] = { url, analysis, intel: [], ts: Date.now() };
  api.storage.session.set(record).catch(() => {});
});

api.webNavigation.onCommitted.addListener(async ({ tabId, frameId, url }) => {
  if (frameId !== 0 || tabId < 0) return;
  if (isExtensionUrl(url) && url.includes("/blocked/blocked.html")) {
    // A static-ruleset redirect landed here; record what was blocked.
    const { [navKey(tabId)]: nav } = await api.storage.session.get(navKey(tabId));
    const list = new URL(url).searchParams.get("list");
    if (list && nav?.url && Date.now() - nav.ts < 30000) {
      bumpStat(list === "custom" ? "customBlocks" : "listBlocks");
      logEvent({ type: "list-block", severity: "high", title: `Blocked ${new URL(nav.url).hostname} (${list} list)`, url: nav.url });
    }
    return;
  }
  if (!isWebUrl(url)) return;
  const s = await settings();
  if (!s.protection.enabled) return;
  const { [tabKey(tabId)]: prev } = await api.storage.session.get(tabKey(tabId));
  const analysis = prev?.url === url ? prev.analysis : analyzeUrl(url);
  await api.storage.session.set({ [tabKey(tabId)]: { url, analysis, intel: [], ts: Date.now() } });

  if (!s.intel.checkOnNavigate || (await shouldSkip(s, url))) return;
  const intel = await checkUrlReputation(url);
  const verdict = combineVerdict(analysis, intel);
  await api.storage.session.set({ [tabKey(tabId)]: { url, analysis, intel, verdict, ts: Date.now() } });
  if (intel.some((r) => r.malicious)) {
    api.tabs.update(tabId, { url: interstitial({ mode: "intel", url }) }).catch(() => {});
    bumpStat("intelBlocks");
    logEvent({ type: "intel-block", severity: "critical", title: `Blocked ${new URL(url).hostname}: ${verdict.reason}`, url });
  }
});

api.tabs.onRemoved.addListener((tabId) => {
  api.storage.session.remove([navKey(tabId), tabKey(tabId)]).catch(() => {});
});

handle("nav:blockedUrl", async (_payload, sender) => {
  const tabId = sender.tab?.id;
  if (tabId == null) return null;
  const { [navKey(tabId)]: nav } = await api.storage.session.get(navKey(tabId));
  return nav?.url ?? null;
});

handle("nav:tabInfo", async ({ tabId }) => {
  const { [tabKey(tabId)]: info } = await api.storage.session.get(tabKey(tabId));
  return info ?? null;
});
