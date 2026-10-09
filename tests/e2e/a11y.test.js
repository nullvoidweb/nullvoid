// Accessibility regression test: runs axe-core (WCAG 2.1 A/AA + best
// practices) on every extension page in light and dark mode and fails on any
// violation. Also checks the popup fits Chrome's 600px popup height limit.
//
//   npm run test:e2e
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EXT = path.join(root, "dist", "chrome");
if (!existsSync(path.join(EXT, "manifest.json"))) throw new Error("Run `npm run build:chrome` first");
const AXE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

const MESSAGE = {
  id: "m1", from: { address: "no-reply@github.com", name: "GitHub" }, to: [{ address: "tester@maxxspace.com" }],
  subject: "Please verify your device", intro: "Verification code: 482913", seen: false, hasAttachments: true,
  createdAt: new Date().toISOString(), text: "Verification code: 482913",
  html: ["<p>Verification code: <b>482913</b></p><img src='https://t.example/p.gif' width='1' height='1'><p><a href='https://github.com/'>Verify</a></p>"],
  attachments: [{ id: "a1", filename: "report.pdf", contentType: "application/pdf", size: 2048, downloadUrl: "/a" }],
};

const stubActiveTab = (url) => `(() => {
  const query = chrome.tabs.query.bind(chrome.tabs);
  chrome.tabs.query = async (q) => (q && q.active) ? [{ id: 987654, windowId: 1, url: ${JSON.stringify(url)}, active: true }] : query(q);
})();`;

async function launch(colorScheme) {
  const profile = mkdtempSync(path.join(tmpdir(), "nv-a11y-"));
  const ctx = await chromium.launchPersistentContext(profile, {
    channel: "chromium", headless: true, colorScheme, viewport: { width: 1280, height: 820 },
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  let sw;
  for (let i = 0; i < 80 && !(sw = ctx.serviceWorkers()[0]); i++) await new Promise((r) => setTimeout(r, 250));
  for (let i = 0; i < 40 && !ctx.pages().some((p) => p.url().includes("#welcome")); i++) await new Promise((r) => setTimeout(r, 250));
  const id = new URL(sw.url()).host;
  const ext = (p) => `chrome-extension://${id}/${p}`;

  // Seed an inbox and mock mail.tm so the inbox renders real content.
  const seed = await ctx.newPage();
  await seed.goto(ext("options/options.html"));
  await seed.evaluate(async () => {
    const { setRecord } = await import(chrome.runtime.getURL("lib/vault.js"));
    await setRecord("mailboxes", [{ id: "acc1", address: "tester@maxxspace.com", password: "pw", token: "tok", createdAt: Date.now() }]);
    await chrome.storage.local.set({
      "nv.email.meta": { active: "acc1", boxes: [{ id: "acc1", address: "tester@maxxspace.com", createdAt: Date.now(), unread: 1, total: 1, lastChecked: Date.now() }] },
      "nv.email.latest": { boxId: "acc1", msgId: "m1", from: "no-reply@github.com", code: "482913", ts: Date.now() },
      "nv.events": [{ id: "1", ts: Date.now(), type: "heuristic-block", severity: "high", title: "Blocked look-alike/phishing pattern", url: "http://paypa1.example/" }],
      "nv.ai.chats": [{ id: "c1", title: "Is this page safe?", updated: Date.now(), messages: [
        { role: "user", content: "x", display: "Is this page safe?", context: { icon: "globe", label: "example.com" } },
        { role: "assistant", content: "## Verdict\n\nLikely **phishing**.\n\n- Look-alike domain\n- Off-site form\n\nSee https://www.paypal.com" }] }],
    });
  });
  await seed.close();
  await ctx.route("https://api.mail.tm/**", (r) => {
    const p = new URL(r.request().url()).pathname;
    const json = (b) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    if (p === "/messages") return json({ "hydra:member": [MESSAGE], "hydra:totalItems": 1 });
    if (p === "/messages/m1") return json(MESSAGE);
    if (p === "/sources/m1") return json({ data: "Authentication-Results: mx; spf=pass; dkim=pass; dmarc=pass\r\nFrom: GitHub <no-reply@github.com>\r\n\r\nx" });
    return r.fulfill({ status: 404, body: "{}" });
  });
  await ctx.route("https://mercure.mail.tm/**", (r) => r.fulfill({ status: 200, contentType: "text/event-stream", body: ": ok\n\n" }));
  return { ctx, ext, profile };
}

async function axe(page) {
  await page.evaluate(AXE);
  return page.evaluate(async () => (await window.axe.run(document, {
    resultTypes: ["violations"],
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] },
  })).violations.map((v) => `${v.impact} ${v.id}: ${v.help} → ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(", ")}`));
}

const PAGES = [
  ["popup (safe site)", "popup/popup.html", { width: 380, height: 600, init: stubActiveTab("https://en.wikipedia.org/wiki/Phishing") }],
  ["popup (dangerous site)", "popup/popup.html", { width: 380, height: 600, init: stubActiveTab("https://paypa1-login.xyz/verify") }],
  ...["welcome", "protection", "intel", "rbi", "email", "ai", "activity", "data"].map((s) => [`settings: ${s}`, `options/options.html#${s}`, {}]),
  ["inbox (message open)", "inbox/inbox.html", { after: async (p) => { await p.click(".msg"); await p.waitForSelector(".code-btn"); } }],
  ["file viewer", "viewer/viewer.html", {}],
  ["interstitial", "blocked/blocked.html?mode=heuristic&url=https%3A%2F%2Fpaypal-secure-login.xyz%2F", {}],
  ["link checker", "blocked/blocked.html?mode=link&url=https%3A%2F%2Fwww.wikipedia.org%2F", {}],
  ["disposable browser (setup)", "rbi/rbi.html", {}],
  ["assistant", "assistant/assistant.html", { width: 400, height: 760 }],
  ["assistant (chat)", "assistant/assistant.html", { width: 400, height: 760, after: async (p) => { await p.click("#historyBtn"); await p.click(".history .item-main"); } }],
];

for (const scheme of ["light", "dark"]) {
  test(`no accessibility violations on any page (${scheme} mode)`, async () => {
    const { ctx, ext, profile } = await launch(scheme);
    const failures = [];
    try {
      for (const [name, url, opts] of PAGES) {
        const page = await ctx.newPage();
        await page.setViewportSize({ width: opts.width ?? 1280, height: opts.height ?? 820 });
        if (opts.init) await page.addInitScript(opts.init);
        await page.goto(ext(url));
        await page.waitForTimeout(900);
        if (opts.after) {
          await opts.after(page);
          await page.waitForTimeout(500);
        }
        for (const v of await axe(page)) failures.push(`[${name}] ${v}`);
        await page.close();
      }
    } finally {
      await ctx.close();
      try { rmSync(profile, { recursive: true, force: true }); } catch { /* locked on Windows */ }
    }
    assert.deepEqual(failures, []);
  });
}

test("popup fits within Chrome's 600px popup height", async () => {
  const { ctx, ext, profile } = await launch("light");
  try {
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 380, height: 600 });
    await page.addInitScript(stubActiveTab("https://paypa1-login.xyz/verify"));
    await page.goto(ext("popup/popup.html"));
    await page.waitForSelector("#latestCode:not([hidden])");
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    assert.ok(height <= 600, `popup is ${height}px tall`);
  } finally {
    await ctx.close();
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* locked on Windows */ }
  }
});
