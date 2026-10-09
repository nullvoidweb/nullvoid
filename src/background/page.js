// Handlers used by the in-page content script and the AI page analysis.
import { api, isRestrictedUrl } from "../lib/browser.js";
import { getSettings } from "../lib/settings.js";
import { analyzeUrl } from "../lib/url-analysis.js";
import { registrableDomain } from "../lib/domain.js";
import { logEvent, bumpStat } from "../lib/events.js";
import { isTrusted } from "./protection.js";
import { handle } from "./router.js";

const reported = new Map(); // tabId -> url, to log each warning once

/**
 * The content script reports what it found (password fields, form targets,
 * brand mentions) and gets back whether to show the in-page warning.
 */
handle("page:report", async (report, sender) => {
  const url = sender.tab?.url || sender.url;
  const settings = await getSettings();
  if (!settings.protection.enabled || !settings.protection.contentScan || (await isTrusted(url))) return { warn: false };
  const analysis = analyzeUrl(url, { hasPasswordField: report.hasPassword });
  const reasons = analysis.signals.filter((s) => s.weight >= 10).map((s) => s.message);
  let score = analysis.score;

  if (report.hasPassword) {
    if (url.startsWith("http:")) {
      score += 25;
      reasons.push("This page asks for a password over an unencrypted connection.");
    }
    const pageDomain = registrableDomain(new URL(url).hostname);
    const offsite = (report.formTargets || []).filter((t) => {
      try {
        const host = new URL(t, url).hostname;
        return host && registrableDomain(host) !== pageDomain;
      } catch {
        return false;
      }
    });
    if (offsite.length) {
      score += 20;
      reasons.push(`The login form sends your credentials to another site (${new URL(offsite[0], url).hostname}).`);
    }
    if (report.brand && !analysis.brand?.legit) {
      score += 30;
      reasons.push(`The page presents itself as ${report.brand} but this is not an official ${report.brand} domain.`);
    }
    if (report.dataUriForm) {
      score += 30;
      reasons.push("Credentials are submitted to a data: or javascript: URL.");
    }
  }
  score = Math.min(100, score);
  const warn = report.hasPassword ? score >= 45 : score >= 70;
  if (warn && reported.get(sender.tab?.id) !== url) {
    reported.set(sender.tab?.id, url);
    await bumpStat("pageWarnings");
    await logEvent({ type: "page-warning", severity: score >= 70 ? "high" : "medium", title: `Credential-phishing warning on ${analysis.host}`, url, detail: reasons.join(" ") });
  }
  return { warn, score, reasons: [...new Set(reasons)].slice(0, 5), host: analysis.host };
}, { contentScripts: true });

/** Collect a structured snapshot of a tab for AI analysis. */
handle("page:snapshot", async ({ tabId }) => {
  const tab = await api.tabs.get(tabId);
  if (isRestrictedUrl(tab.url)) throw new Error("This page cannot be analysed (browser or store page).");
  const [{ result }] = await api.scripting.executeScript({
    target: { tabId },
    func: () => {
      const text = (document.body?.innerText || "").replace(/\n{3,}/g, "\n\n").slice(0, 15000);
      const forms = [...document.forms].slice(0, 10).map((f) => ({
        action: f.getAttribute("action") || "",
        method: (f.method || "get").toLowerCase(),
        fields: [...f.elements].map((e) => e.type || e.tagName.toLowerCase()).filter((t) => !["submit", "button", "hidden", "fieldset"].includes(t)).slice(0, 12),
      }));
      return { url: location.href, title: document.title, text, forms };
    },
  });
  return { ...result, analysis: analyzeUrl(result.url) };
});
