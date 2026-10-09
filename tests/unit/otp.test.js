import { test } from "node:test";
import assert from "node:assert/strict";
import { extractCodes, extractLinks } from "../../src/lib/otp.js";

test("finds a 6-digit verification code", () => {
  assert.deepEqual(extractCodes("Your verification code is 482913. It expires in 10 minutes.").slice(0, 1), ["482913"]);
});

test("finds spaced and dashed codes", () => {
  assert.equal(extractCodes("Use code 123 456 to sign in")[0], "123456");
  assert.equal(extractCodes("Your one-time passcode: 778-901")[0], "778901");
});

test("finds alphanumeric codes near keywords", () => {
  assert.equal(extractCodes("Your security code: K7P2QX")[0], "K7P2QX");
});

test("ignores years, prices and phone-like numbers", () => {
  assert.deepEqual(extractCodes("© 2026 Example Inc. Total: $1499.00. Call 555-0100."), []);
  assert.deepEqual(extractCodes("Thanks for joining in 2025!"), []);
});

test("uses the subject line", () => {
  assert.equal(extractCodes("Hello there", "Your Steam login code 59321")[0], "59321");
});

test("extracts verification links but not unsubscribe or images", () => {
  const html = `<a href="https://example.com/verify?token=abc&amp;u=1">Confirm your email</a>
    <a href="https://example.com/unsubscribe">Unsubscribe</a><img src="https://example.com/logo.png">
    <a href="https://example.com/about">About us</a>`;
  const links = extractLinks(html);
  assert.equal(links.length, 1);
  assert.equal(links[0].url, "https://example.com/verify?token=abc&u=1");
  assert.equal(links[0].label, "Confirm your email");
});
