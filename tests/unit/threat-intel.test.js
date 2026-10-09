import { test } from "node:test";
import assert from "node:assert/strict";
import { sbExpressions, sbCanonicalize, safeBrowsingLookup, virusTotalUrl } from "../../src/lib/threat-intel.js";

test("Safe Browsing expressions match the spec examples", () => {
  assert.deepEqual(new Set(sbExpressions("http://a.b.com/1/2.html?param=1")), new Set([
    "a.b.com/1/2.html?param=1", "a.b.com/1/2.html", "a.b.com/", "a.b.com/1/",
    "b.com/1/2.html?param=1", "b.com/1/2.html", "b.com/", "b.com/1/",
  ]));
  assert.deepEqual(new Set(sbExpressions("http://1.2.3.4/1/")), new Set(["1.2.3.4/1/", "1.2.3.4/"]));
  assert.deepEqual(new Set(sbExpressions("http://example.co.uk/1")), new Set(["example.co.uk/1", "example.co.uk/"]));
  const deep = sbExpressions("http://a.b.c.d.e.f.com/1.html");
  assert.ok(deep.includes("a.b.c.d.e.f.com/1.html"));
  assert.ok(deep.includes("c.d.e.f.com/"));
  assert.ok(deep.includes("f.com/1.html"));
  assert.ok(!deep.some((e) => e.startsWith("b.c.d.e.f.com")));
});

test("canonicalisation", () => {
  const c = sbCanonicalize("http://www.GOOgle.com/a/../b/./c//d#frag");
  assert.equal(c.host, "www.google.com");
  assert.equal(c.path, "/b/c/d");
  assert.equal(sbCanonicalize("http://host/%25%32%35").path, "/%25");
});

test("lookup sends only 4-byte hash prefixes, never the URL", async () => {
  let requested;
  const fetch = async (url) => {
    requested = new URL(url);
    return new Response(JSON.stringify({ fullHashes: [], cacheDuration: "300s" }), { status: 200 });
  };
  const res = await safeBrowsingLookup("https://evil.example/login?user=me", "KEY", fetch);
  assert.equal(res.malicious, false);
  assert.equal(requested.searchParams.get("key"), "KEY");
  const prefixes = requested.searchParams.getAll("hashPrefixes");
  assert.ok(prefixes.length >= 2 && prefixes.length <= 30);
  for (const p of prefixes) assert.equal(Buffer.from(p, "base64").length, 4);
  assert.ok(!requested.href.includes("evil.example"));
});

test("lookup matches a returned full hash", async () => {
  const target = "evil.example/";
  const full = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(target))).toString("base64");
  const fetch = async () => new Response(JSON.stringify({ fullHashes: [{ fullHash: full, fullHashDetails: [{ threatType: "SOCIAL_ENGINEERING" }] }] }), { status: 200 });
  const res = await safeBrowsingLookup("https://evil.example/", "KEY", fetch);
  assert.equal(res.malicious, true);
  assert.deepEqual(res.threats, ["SOCIAL_ENGINEERING"]);
});

test("VirusTotal uses unpadded base64url URL identifiers", async () => {
  let path;
  const fetch = async (url) => {
    path = new URL(url).pathname;
    return new Response(JSON.stringify({ data: { id: "x", attributes: { last_analysis_stats: { malicious: 5, suspicious: 0, harmless: 60, undetected: 5 } } } }), { status: 200 });
  };
  const res = await virusTotalUrl("http://example.com/?a=b", "K", fetch);
  assert.equal(path, `/api/v3/urls/${Buffer.from("http://example.com/?a=b").toString("base64url")}`);
  assert.equal(res.malicious, true);
  assert.equal(res.engines, 70);
});
