import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeUrl, skeleton, editDistance, blockThreshold, levelForScore } from "../../src/lib/url-analysis.js";

const score = (u) => analyzeUrl(u).score;
const ids = (u) => analyzeUrl(u).signals.map((s) => s.id);

test("official brand domains are safe", () => {
  for (const u of [
    "https://www.paypal.com/signin", "https://login.microsoftonline.com/", "https://appleid.apple.com/",
    "https://www.amazon.co.uk/", "https://accounts.google.com/", "https://github.com/login", "https://www.chase.com/",
  ]) {
    assert.ok(score(u) <= 10, `${u} scored ${score(u)}`);
  }
});

test("ordinary sites are not flagged (false-positive regressions)", () => {
  for (const u of [
    "https://purchase.com/", "https://steak.com/", "https://www.bbc.co.uk/news", "https://en.wikipedia.org/wiki/Phishing",
    "https://www.metallica.com/", "https://zoomcar.com/", "https://examples.com/", "https://www.nytimes.com/",
    "https://stackoverflow.com/questions", "https://docs.python.org/3/", "http://localhost:8080/login",
  ]) {
    assert.ok(score(u) < 40, `${u} scored ${score(u)}: ${ids(u)}`);
  }
});

test("IDN homograph of a brand is dangerous", () => {
  const r = analyzeUrl("https://xn--80ak6aa92e.com/"); // аррӏе.com in Cyrillic
  assert.equal(r.level, "dangerous");
  assert.ok(r.signals.some((s) => s.id === "homograph-brand"));
  assert.equal(r.brand.key, "apple");
});

test("mixed-script punycode is flagged", () => {
  const r = analyzeUrl("https://xn--pypal-4ve.com/");
  assert.ok(r.signals.some((s) => s.id === "mixed-script"));
  assert.equal(r.level, "dangerous");
});

test("digit-substitution typosquat", () => {
  assert.ok(ids("https://paypa1.com/login").includes("homograph-brand"));
  assert.ok(ids("https://rnicrosoft.com/").includes("homograph-brand"));
});

test("combo-squatting with credential words", () => {
  const r = analyzeUrl("https://paypal-secure-login.xyz/verify");
  assert.equal(r.level, "dangerous");
  assert.ok(r.signals.some((s) => s.id === "combosquat"));
});

test("brand only in subdomain of an unrelated domain", () => {
  const r = analyzeUrl("https://secure.paypal.com.account-update.info/webscr");
  assert.ok(r.signals.some((s) => s.id === "brand-subdomain"));
  assert.ok(r.score >= 70);
});

test("userinfo trick", () => {
  const r = analyzeUrl("https://google.com@evil.example/");
  assert.ok(r.signals.some((s) => s.id === "userinfo"));
  assert.ok(r.signals.some((s) => s.id === "fake-host-userinfo"));
  assert.equal(r.host, "evil.example");
});

test("free hosting + brand", () => {
  assert.equal(analyzeUrl("https://netflix-billing-update.web.app/").level, "dangerous");
});

test("raw IP and executable links", () => {
  assert.ok(ids("http://203.0.113.9/bank/login.php").includes("ip-host"));
  assert.ok(ids("https://cdn.example.com/setup.exe").includes("executable-link"));
});

test("invalid URLs do not throw", () => {
  assert.equal(analyzeUrl("not a url").score, 0);
});

test("helpers", () => {
  assert.equal(skeleton("paypa1"), skeleton("paypal"));
  assert.equal(skeleton("rnicrosoft"), skeleton("microsoft"));
  assert.equal(editDistance("paypal", "paypl"), 1);
  assert.equal(editDistance("abcd", "abdc"), 1); // transposition
  assert.equal(blockThreshold("off"), Infinity);
  assert.ok(blockThreshold("strict") < blockThreshold("balanced"));
  assert.equal(levelForScore(0), "safe");
  assert.equal(levelForScore(100), "dangerous");
});
