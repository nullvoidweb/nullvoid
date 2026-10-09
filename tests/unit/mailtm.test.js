import { test } from "node:test";
import assert from "node:assert/strict";
import { MailTmClient } from "../../src/lib/mailtm.js";

function mockFetch(routes) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url, init });
    const key = `${init.method || "GET"} ${new URL(url).pathname}`;
    const handler = routes[key];
    if (!handler) return new Response(JSON.stringify({ detail: "not found" }), { status: 404 });
    const r = typeof handler === "function" ? handler(init, calls) : handler;
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status ?? 200, headers: r.headers });
  };
  fn.calls = calls;
  return fn;
}

test("creates a mailbox with a strong random password and logs in", async () => {
  const fetch = mockFetch({
    "GET /domains": { body: { "hydra:member": [{ domain: "maxxspace.com", isActive: true, isPrivate: false }] } },
    "POST /accounts": (init) => ({ status: 201, body: { id: "acc1", address: JSON.parse(init.body).address, quota: 40000000 } }),
    "POST /token": { body: { token: "jwt-1", id: "acc1" } },
  });
  const client = new MailTmClient({ fetch, minIntervalMs: 0 });
  const box = await client.createMailbox();
  assert.match(box.address, /@maxxspace\.com$/);
  assert.equal(box.token, "jwt-1");
  assert.ok(box.password.length >= 20);
  const created = JSON.parse(fetch.calls.find((c) => c.init.method === "POST" && c.url.endsWith("/accounts")).init.body);
  assert.equal(created.password, box.password);
});

test("retries with another address on 422", async () => {
  let attempts = 0;
  const fetch = mockFetch({
    "GET /domains": { body: { "hydra:member": [{ domain: "d.test", isActive: true, isPrivate: false }] } },
    "POST /accounts": (init) => (++attempts === 1 ? { status: 422, body: { "hydra:description": "address: This value is already used." } } : { status: 201, body: { id: "a2", address: JSON.parse(init.body).address } }),
    "POST /token": { body: { token: "t" } },
  });
  const box = await new MailTmClient({ fetch, minIntervalMs: 0 }).createMailbox();
  assert.equal(attempts, 2);
  assert.equal(box.id, "a2");
});

test("re-authenticates once on 401", async () => {
  let listCalls = 0;
  const fetch = mockFetch({
    "GET /messages": () => (++listCalls === 1 ? { status: 401, body: {} } : { body: { "hydra:member": [{ id: "m1" }], "hydra:totalItems": 1 } }),
    "POST /token": { body: { token: "fresh" } },
  });
  const box = { id: "a", address: "x@d.test", password: "pw", token: "stale" };
  const res = await new MailTmClient({ fetch, minIntervalMs: 0 }).listMessages(box);
  assert.equal(res.total, 1);
  assert.equal(box.token, "fresh");
  assert.equal(fetch.calls.at(-1).init.headers.Authorization, "Bearer fresh");
});

test("backs off and retries on 429", async () => {
  let n = 0;
  const fetch = mockFetch({
    "GET /domains": () => (++n < 2 ? { status: 429, body: {}, headers: { "retry-after": "0" } } : { body: { "hydra:member": [] } }),
  });
  const domains = await new MailTmClient({ fetch, minIntervalMs: 0 }).domains();
  assert.deepEqual(domains, []);
  assert.equal(n, 2);
});

test("marks messages seen with merge-patch", async () => {
  const fetch = mockFetch({ "PATCH /messages/m1": { body: { id: "m1", seen: true } } });
  await new MailTmClient({ fetch, minIntervalMs: 0 }).markSeen({ token: "t" }, "m1");
  const call = fetch.calls[0];
  assert.equal(call.init.headers["Content-Type"], "application/merge-patch+json");
  assert.deepEqual(JSON.parse(call.init.body), { seen: true });
});
