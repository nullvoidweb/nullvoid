// Dangerous-download guard. Evaluates each download's file name and source
// URL; risky ones are paused (warn mode) for an explicit decision in a review
// window, or cancelled outright (block mode).
import { api, extensionUrl } from "../lib/browser.js";
import { getSettings } from "../lib/settings.js";
import { analyzeName, DANGEROUS_EXTENSIONS, MACRO_EXTENSIONS, SEVERITY_WEIGHT } from "../lib/file-analysis.js";
import { analyzeUrl } from "../lib/url-analysis.js";
import { logEvent, bumpStat } from "../lib/events.js";
import { checkUrlReputation } from "./intel.js";
import { handle } from "./router.js";

const PENDING_KEY = "nv.downloadReviews";
const DANGEROUS_MIME = /^(application\/(x-msdownload|x-msdos-program|x-msi|x-ms-installer|vnd\.microsoft\.portable-executable|x-sh|x-bat|hta|java-archive|vnd\.android\.package-archive|x-apple-diskimage)|text\/(vbscript|x-powershell))/i;

const evaluated = new Set();

function basename(path) {
  return String(path || "").split(/[\\/]/).pop();
}

function urlFileName(url) {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
  } catch {
    return "";
  }
}

/** Assess every name the file is known by and keep the riskiest reading. */
function assessNames(names) {
  let best = { name: names[0] || "download", ext: "", findings: [], weight: -1 };
  for (const name of names) {
    const { ext, findings } = analyzeName(name);
    const weight = findings.reduce((s, f) => s + (SEVERITY_WEIGHT[f.severity] ?? 0), 0);
    if (weight > best.weight) best = { name, ext, findings, weight };
  }
  return best;
}

export async function assessDownload(item) {
  // The saved file name can differ from what the server sent (renamed by the
  // user, the browser or automation), so check the URL's file name as well.
  const names = [...new Set([basename(item.filename), urlFileName(item.finalUrl || item.url)].filter(Boolean))];
  const { name, ext, findings } = assessNames(names);
  const reasons = findings.map((f) => ({ severity: f.severity, message: f.title + (f.detail ? ` — ${f.detail}` : "") }));
  if (item.mime && DANGEROUS_MIME.test(item.mime) && !DANGEROUS_EXTENSIONS.has(ext)) {
    reasons.push({ severity: "high", message: `Served as ${item.mime}, an executable content type.` });
  }
  const src = item.finalUrl || item.url;
  let urlAnalysis = null;
  if (/^https?:/i.test(src)) {
    urlAnalysis = analyzeUrl(src);
    if (urlAnalysis.score >= 40) reasons.push({ severity: urlAnalysis.score >= 70 ? "critical" : "high", message: `Downloaded from a risky address (${urlAnalysis.host}): ${urlAnalysis.signals[0]?.message || ""}` });
    else if (urlAnalysis.score >= 15 && (DANGEROUS_EXTENSIONS.has(ext) || MACRO_EXTENSIONS.has(ext))) {
      reasons.push({ severity: "medium", message: `Executable from a low-reputation address (${urlAnalysis.host}).` });
    }
    if (item.referrer === "" && /^http:/i.test(src) && DANGEROUS_EXTENSIONS.has(ext)) {
      reasons.push({ severity: "medium", message: "Executable delivered over unencrypted HTTP." });
    }
  }
  const intel = /^https?:/i.test(src) && (DANGEROUS_EXTENSIONS.has(ext) || MACRO_EXTENSIONS.has(ext)) ? await checkUrlReputation(src) : [];
  for (const r of intel) if (r.malicious) reasons.push({ severity: "critical", message: `${r.service} flags this source as malicious.` });
  const score = Math.min(100, reasons.reduce((s, r) => s + (SEVERITY_WEIGHT[r.severity] ?? 0), 0));
  return { name, ext, score, reasons, urlAnalysis, intel, source: src, mime: item.mime, size: item.fileSize ?? item.totalBytes ?? 0 };
}

async function review(item) {
  if (evaluated.has(item.id)) return;
  const settings = await getSettings();
  const mode = settings.protection.downloads;
  if (!settings.protection.enabled || mode === "off") return;
  evaluated.add(item.id);
  const verdict = await assessDownload(item);
  if (verdict.score < 35) return;

  await bumpStat("downloadsFlagged");
  if (mode === "block" || verdict.score >= 95) {
    await api.downloads.cancel(item.id).catch(() => {});
    await api.downloads.removeFile?.(item.id)?.catch(() => {});
    await api.downloads.erase({ id: item.id }).catch(() => {});
    await logEvent({ type: "download-blocked", severity: "critical", title: `Blocked download: ${verdict.name}`, url: verdict.source, detail: verdict.reasons.map((r) => r.message).join(" ") });
    if (settings.notifications.downloads) {
      api.notifications.create(`nv-dl-${item.id}`, {
        type: "basic", iconUrl: extensionUrl("icons/icon128.png"), title: "NULL VOID blocked a dangerous download",
        message: `${verdict.name}\n${verdict.reasons[0]?.message || ""}`.slice(0, 250), priority: 2,
      });
    }
    return;
  }
  // Warn mode: pause and ask.
  await api.downloads.pause(item.id).catch(() => {});
  const { [PENDING_KEY]: pending = {} } = await api.storage.session.get(PENDING_KEY);
  pending[item.id] = { ...verdict, id: item.id, ts: Date.now() };
  await api.storage.session.set({ [PENDING_KEY]: pending });
  await logEvent({ type: "download-flagged", severity: "high", title: `Paused risky download: ${verdict.name}`, url: verdict.source, detail: verdict.reasons.map((r) => r.message).join(" ") });
  await api.windows.create({ url: `${extensionUrl("blocked/blocked.html")}?mode=download&id=${item.id}`, type: "popup", width: 560, height: 680, focused: true }).catch(() =>
    api.tabs.create({ url: `${extensionUrl("blocked/blocked.html")}?mode=download&id=${item.id}` }));
}

api.downloads.onCreated.addListener((item) => {
  if (item.filename) review(item).catch(console.error);
});

api.downloads.onChanged.addListener(async (delta) => {
  if (!delta.filename?.current || evaluated.has(delta.id)) return;
  const [item] = await api.downloads.search({ id: delta.id });
  if (item) review(item).catch(console.error);
});

handle("downloads:review", async ({ id }) => {
  const { [PENDING_KEY]: pending = {} } = await api.storage.session.get(PENDING_KEY);
  const verdict = pending[id];
  if (!verdict) return null;
  const [item] = await api.downloads.search({ id: Number(id) });
  return { ...verdict, state: item?.state, exists: Boolean(item) };
});

handle("downloads:decide", async ({ id, keep }) => {
  id = Number(id);
  const { [PENDING_KEY]: pending = {} } = await api.storage.session.get(PENDING_KEY);
  const verdict = pending[id];
  delete pending[id];
  await api.storage.session.set({ [PENDING_KEY]: pending });
  if (keep) {
    await api.downloads.resume(id).catch(() => {});
    await logEvent({ type: "download-kept", severity: "medium", title: `Kept flagged download: ${verdict?.name || id}` });
  } else {
    await api.downloads.cancel(id).catch(() => {});
    await api.downloads.removeFile?.(id)?.catch(() => {});
    await api.downloads.erase({ id }).catch(() => {});
    await bumpStat("downloadsDiscarded");
    await logEvent({ type: "download-discarded", severity: "info", title: `Discarded download: ${verdict?.name || id}` });
  }
  return { ok: true };
});
