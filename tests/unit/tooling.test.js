import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseFeed, collapse, buildAdRules, buildMalwareRules, splitRules } from "../../scripts/update-blocklists.mjs";
import { firefoxManifest } from "../../scripts/build.mjs";
import { CdpConnection, browserlessEndpoint } from "../../src/lib/cdp-client.js";

test("feed parsing handles hosts and plain formats", () => {
  const hosts = parseFeed("# comment\n127.0.0.1 localhost\n0.0.0.0 ads.example.com # tracker\n127.0.0.1\tEvil.Example.\n::1 ip6-localhost\n", "hosts");
  assert.deepEqual(hosts, ["localhost".length > 3 ? null : null, "ads.example.com", "evil.example"].filter(Boolean));
  assert.deepEqual(parseFeed("*.bad.test\nnot a domain\n203.0.113.5\n", "domains"), ["bad.test", "203.0.113.5"]);
});

test("collapse removes subdomains covered by a parent", () => {
  assert.deepEqual(collapse(["a.evil.com", "evil.com", "b.c.evil.com", "other.org", "evil.com"]), ["evil.com", "other.org"]);
});

test("ad rules block third-party sub-resources only", () => {
  const rules = buildAdRules(Array.from({ length: 12000 }, (_, i) => `d${i}.example`));
  assert.equal(rules.length, 3);
  for (const r of rules) {
    assert.equal(r.condition.domainType, "thirdParty");
    assert.ok(!r.condition.resourceTypes.includes("main_frame"));
  }
  assert.deepEqual(rules.map((r) => r.id), [1, 2, 3]);
});

test("malware rules redirect navigations and block payload hosts", () => {
  const rules = buildMalwareRules(["a.test", "b.test"], new Set(["b.test"]));
  assert.equal(rules[0].action.type, "redirect");
  assert.equal(rules[0].action.redirect.extensionPath, "/blocked/blocked.html?mode=list&list=malware");
  assert.deepEqual(rules[0].condition.resourceTypes, ["main_frame", "sub_frame"]);
  assert.equal(rules[1].action.type, "block");
  assert.deepEqual(rules[1].condition.requestDomains, ["b.test"]);
  assert.equal(new Set(rules.map((r) => r.id)).size, rules.length);
});

test("generated rulesets are valid and within Chrome and AMO limits", () => {
  const manifest = JSON.parse(readFileSync(new URL("../../src/manifest.json", import.meta.url)));
  const resources = manifest.declarative_net_request.rule_resources;
  assert.ok(resources.some((r) => r.id.startsWith("nv_ads")));
  assert.ok(resources.some((r) => r.id.startsWith("nv_malware")));
  assert.ok(resources.length <= 50, "Chrome allows 50 enabled static rulesets");
  let total = 0;
  for (const res of resources) {
    const raw = readFileSync(new URL(`../../src/${res.path}`, import.meta.url));
    assert.ok(raw.length < 4 * 1024 * 1024, `${res.path} must stay under the 4 MB addons-linter parse limit`);
    const rules = JSON.parse(raw);
    total += rules.length;
    assert.ok(rules.length > 0, `${res.path} rule count`);
    assert.equal(new Set(rules.map((r) => r.id)).size, rules.length, `${res.path} unique ids`);
    for (const r of rules) {
      assert.ok(r.condition.requestDomains.length > 0);
      assert.ok(r.condition.requestDomains.every((d) => d === d.toLowerCase() && !d.includes("/")));
    }
  }
  assert.ok(total < 30000, "within the guaranteed static rule budget");
});

test("rules are split into size-bounded files", () => {
  const rules = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, condition: { requestDomains: ["x".repeat(100)] } }));
  const parts = splitRules(rules, 600);
  assert.ok(parts.length > 1);
  assert.deepEqual(parts.flat().map((r) => r.id), rules.map((r) => r.id));
  for (const p of parts) assert.ok(JSON.stringify(p).length <= 600);
});

test("Firefox manifest transform", () => {
  const src = JSON.parse(readFileSync(new URL("../../src/manifest.json", import.meta.url)));
  const ff = firefoxManifest(src);
  assert.deepEqual(ff.background, { scripts: ["background/index.js"], type: "module" });
  assert.equal(ff.side_panel, undefined);
  assert.ok(!ff.permissions.includes("sidePanel"));
  assert.equal(ff.sidebar_action.default_panel, "assistant/assistant.html");
  assert.deepEqual(ff.browser_specific_settings.gecko.data_collection_permissions.required, ["none"]);
  assert.equal(ff.minimum_chrome_version, undefined);
});

test("Chrome manifest declares every page and ruleset that exists", () => {
  const m = JSON.parse(readFileSync(new URL("../../src/manifest.json", import.meta.url)));
  const exists = (p) => { readFileSync(new URL(`../../src/${p}`, import.meta.url)); return true; };
  for (const p of [m.background.service_worker, m.action.default_popup, m.options_ui.page, m.side_panel.default_path, ...m.content_scripts.flatMap((c) => c.js), ...m.declarative_net_request.rule_resources.map((r) => r.path)]) {
    assert.ok(exists(p), p);
  }
  assert.ok(!/(^|\s)'unsafe-(eval|inline)'/.test(m.content_security_policy.extension_pages), "no unsafe-eval / unsafe-inline");
});

class FakeSocket {
  constructor() {
    this.sent = [];
    setTimeout(() => this.onopen?.(), 0);
  }
  send(data) {
    const msg = JSON.parse(data);
    this.sent.push(msg);
    setTimeout(() => {
      if (msg.method === "Fail.me") this.onmessage({ data: JSON.stringify({ id: msg.id, error: { code: -32000, message: "nope" } }) });
      else this.onmessage({ data: JSON.stringify({ id: msg.id, result: { echo: msg.params, sessionId: msg.sessionId } }) });
      this.onmessage({ data: JSON.stringify({ method: "Page.loadEventFired", params: { t: 1 }, sessionId: "S1" }) });
    }, 0);
  }
  close() {
    this.onclose?.({ code: 1000 });
  }
}

test("CDP client correlates responses, routes sessions and surfaces errors", async () => {
  const conn = await CdpConnection.connect("ws://fake", { WebSocketImpl: FakeSocket });
  const events = [];
  conn.on("Page.loadEventFired", (p, sid) => events.push(sid));
  const res = await conn.send("Page.navigate", { url: "https://x.test" }, "S1");
  assert.deepEqual(res, { echo: { url: "https://x.test" }, sessionId: "S1" });
  await assert.rejects(conn.send("Fail.me"), /nope/);
  await new Promise((r) => setTimeout(r, 5));
  assert.ok(events.includes("S1"));
  conn.close();
  await assert.rejects(conn.send("Page.reload"), /closed/);
});

test("Browserless endpoint builder", () => {
  const u = new URL(browserlessEndpoint({ region: "lon", token: "abc", timeoutMs: 60000, blockAds: true, stealth: true }));
  assert.equal(u.host, "production-lon.browserless.io");
  assert.equal(u.pathname, "/chromium/stealth");
  assert.equal(u.searchParams.get("token"), "abc");
  assert.equal(u.searchParams.get("timeout"), "60000");
  assert.equal(u.searchParams.get("blockAds"), "true");
  assert.equal(new URL(browserlessEndpoint({ region: "nope", token: "t" })).host, "production-sfo.browserless.io");
});
