// Drives RemoteBrowserSession against a real headless Chromium over CDP —
// the same protocol Browserless and self-hosted pools speak.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { RemoteBrowserSession, normalizeUrl } from "../../src/lib/rbi-session.js";
import { resolveBrowserEndpoint } from "../../src/lib/cdp-client.js";

let proc, server, base, wsUrl, profile;

const PAGE = `<!doctype html><title>NV Test Page</title>
<input id="q" autofocus style="position:absolute;left:10px;top:10px;width:300px;height:30px">
<button id="b" style="position:absolute;left:10px;top:60px;width:120px;height:40px" onclick="document.title='clicked'">Click</button>
<a id="pop" href="/second" target="_blank" style="position:absolute;left:10px;top:120px">popup</a>
<button id="al" style="position:absolute;left:200px;top:60px;width:120px;height:40px" onclick="document.title=String(confirm('sure?'))">Confirm</button>`;

before(async () => {
  server = http.createServer((req, res) => {
    res.setHeader("content-type", "text/html");
    res.end(req.url === "/second" ? "<title>Second</title><h1>second</h1>" : PAGE);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;

  profile = mkdtempSync(path.join(tmpdir(), "nv-cdp-"));
  proc = spawn(chromium.executablePath(), [
    "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--disable-gpu", "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  wsUrl = await new Promise((resolve, reject) => {
    let buf = "";
    const timer = setTimeout(() => reject(new Error("Chromium did not start")), 30000);
    proc.stderr.on("data", (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) {
        clearTimeout(timer);
        resolve(m[1]);
      }
    });
  });
});

after(() => {
  proc?.kill();
  server?.close();
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* locked on Windows */ }
});

const within = (promise, ms = 10000, label = "event") => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), ms)),
]);

const waitFor = async (fn, ms = 10000) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, 100));
  }
};

test("normalizeUrl", () => {
  assert.equal(normalizeUrl("example.com"), "https://example.com");
  assert.equal(normalizeUrl("http://a.b/c"), "http://a.b/c");
  assert.match(normalizeUrl("how to stay safe"), /^https:\/\/duckduckgo\.com\/\?q=/);
  assert.throws(() => normalizeUrl("file:///etc/passwd"));
  assert.throws(() => normalizeUrl("javascript:alert(1)"));
});

test("resolveBrowserEndpoint discovers the websocket from an http DevTools URL", async () => {
  const port = new URL(wsUrl).port;
  const resolved = await resolveBrowserEndpoint(`http://127.0.0.1:${port}`);
  assert.match(resolved, /^ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\//);
});

test("streams frames, forwards input, handles dialogs, history and popups", async () => {
  const session = await RemoteBrowserSession.start({ wsUrl, width: 800, height: 600, quality: 50, startUrl: base, region: "lon" });
  try {
    const frames = [];
    session.on("frame", (f) => frames.push(f));
    const titles = [];
    session.on("title", (t) => titles.push(t.title));

    await waitFor(() => frames.length > 0);
    assert.ok(frames[0].data.length > 100, "frame has JPEG data");
    assert.ok(frames[0].metadata.deviceWidth > 0 && frames[0].metadata.deviceHeight > 0, "frame carries viewport metadata");

    // Evaluations can race a navigation ("Inspected target navigated"); treat as not-ready.
    const evalJs = async (expr) => {
      try {
        return (await session.send("Runtime.evaluate", { expression: expr, returnByValue: true })).result.value;
      } catch {
        return undefined;
      }
    };
    await waitFor(async () => (await evalJs("document.readyState")) === "complete");

    // Region-consistent timezone.
    assert.equal(await evalJs("Intl.DateTimeFormat().resolvedOptions().timeZone"), "Europe/London");

    // Click into the input and type.
    await session.mouse("mousePressed", 50, 25, { button: "left", clickCount: 1 });
    await session.mouse("mouseReleased", 50, 25, { button: "left", clickCount: 1 });
    for (const ch of "hi!") await session.key("keydown", { key: ch, code: "", location: 0 });
    await session.insertText(" there");
    assert.equal(await evalJs("document.getElementById('q').value"), "hi! there");
    await session.key("keydown", { key: "Backspace", code: "Backspace" });
    await session.key("keyup", { key: "Backspace", code: "Backspace" });
    assert.equal(await evalJs("document.getElementById('q').value"), "hi! ther");

    // Button click changes the title.
    await session.mouse("mousePressed", 60, 80, { button: "left", clickCount: 1 });
    await session.mouse("mouseReleased", 60, 80, { button: "left", clickCount: 1 });
    await waitFor(async () => (await evalJs("document.title")) === "clicked");

    // JavaScript dialogs surface as events and can be answered.
    const dialog = new Promise((r) => session.on("dialog", r));
    session.mouse("mousePressed", 250, 80, { button: "left", clickCount: 1 });
    session.mouse("mouseReleased", 250, 80, { button: "left", clickCount: 1 });
    const d = await within(dialog, 10000, "dialog");
    assert.equal(d.type, "confirm");
    assert.equal(d.message, "sure?");
    await session.handleDialog(true);
    await waitFor(async () => (await evalJs("document.title")) === "true");

    // target=_blank popups are folded back into the isolated tab.
    const popup = new Promise((r) => session.on("popup", r));
    session.send("Runtime.evaluate", { expression: "document.getElementById('pop').click()", userGesture: true }).catch(() => {});
    const p = await within(popup, 10000, "popup");
    assert.match(p.url, /\/second$/);
    await waitFor(async () => (await evalJs("location.pathname")) === "/second");

    // History navigation.
    await waitFor(() => session.history?.currentIndex > 0);
    await session.back();
    await waitFor(async () => (await evalJs("location.pathname")) === "/");
    assert.ok(session.stats.frames > 0);
  } finally {
    await session.close();
  }
});
