import { test } from "node:test";
import assert from "node:assert/strict";
import { registrableDomain, publicSuffix, domainLabel, subdomainPart, punycodeDecode, toUnicodeHost, isPrivateHost, isIP } from "../../src/lib/domain.js";

test("registrable domain", () => {
  assert.equal(registrableDomain("login.secure.paypal.co.uk"), "paypal.co.uk");
  assert.equal(registrableDomain("a.b.example.com"), "example.com");
  assert.equal(registrableDomain("user.github.io"), "user.github.io");
  assert.equal(registrableDomain("x.y.pages.dev"), "y.pages.dev");
  assert.equal(registrableDomain("192.168.1.1"), "192.168.1.1");
  assert.equal(publicSuffix("shop.example.com.au"), "com.au");
  assert.equal(domainLabel("www.amazon.co.jp"), "amazon");
  assert.equal(subdomainPart("a.b.example.org"), "a.b");
});

test("punycode", () => {
  assert.equal(punycodeDecode("80ak6aa92e"), "аррӏе");
  assert.equal(toUnicodeHost("xn--mnchen-3ya.de"), "münchen.de");
  assert.equal(toUnicodeHost("example.com"), "example.com");
});

test("private hosts and IPs", () => {
  for (const h of ["localhost", "127.0.0.1", "10.1.2.3", "192.168.0.10", "172.20.0.1", "printer.local", "::1"]) assert.ok(isPrivateHost(h), h);
  for (const h of ["8.8.8.8", "example.com", "172.32.0.1"]) assert.ok(!isPrivateHost(h), h);
  assert.ok(isIP("2001:db8::1"));
  assert.ok(!isIP("999.1.1.1"));
});
