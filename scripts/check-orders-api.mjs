import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createOrdersAPI, createLocalLimiter } from '../server/orders-core.mjs';

const PASSWORD = 'a-real-test-password-with-32-chars';
const ORIGIN = 'https://kalops.example';
const FIXED_NOW = Date.parse('2026-10-21T21:00:00Z');
const data = () => ({ requestId: randomUUID(), customer: { name: 'Maria Silva', company: 'Barbearia Exemplo', phone: '(11) 99999-1234', email: 'maria@example.com', cep: '01001-000', city: 'São Paulo', state: 'SP', notes: 'Atendimento à tarde' }, items: [{ id: 'leave', quantity: 10 }], consent: true });

function fixture(options = {}) {
  const records = new Map();
  let storeReads = 0;
  const store = {
    async get(id) { return structuredClone(records.get(id) || null); },
    async create(record) { if (records.has(record.id)) return false; records.set(record.id, structuredClone(record)); return true; },
    async list({ limit, cursor }) {
      const keys = [...records.keys()].sort().filter(id => !cursor || id > cursor);
      return { orders: keys.slice(0, limit).map(id => structuredClone(records.get(id))), nextCursor: keys.length > limit ? keys[limit - 1] : null };
    },
    async updateStatus(id, status, updatedAt) {
      if (!records.has(id)) return null;
      const updated = { ...records.get(id), status, updatedAt };
      records.set(id, updated); return structuredClone(updated);
    },
  };
  const handle = createOrdersAPI({ getStore: () => { storeReads++; return store; }, env: { KALOPS_ADMIN_PASSWORD: PASSWORD }, now: () => FIXED_NOW, ...options });
  const request = async (path, method = 'GET', body, cookie, headers = {}) => {
    const response = await handle(new Request(`${ORIGIN}${path}`, { method, headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), { ip: '192.0.2.1' });
    return { response, body: await response.json() };
  };
  const login = async () => {
    const result = await request('/api/admin/session', 'POST', { password: PASSWORD });
    assert.equal(result.response.status, 200);
    return result.response.headers.get('set-cookie').split(';')[0];
  };
  return { request, login, records, storeReads: () => storeReads };
}

test('creates a persistent record with authoritative prices and no public PII', async () => {
  const f = fixture(); const payload = data();
  payload.totalCents = 1; payload.items[0].unitPriceCents = 1;
  const { response, body } = await f.request('/api/orders', 'POST', payload);
  assert.equal(response.status, 201);
  assert.equal(body.order.totalCents, 19000);
  assert.equal(body.order.items[0].unitPriceCents, 1900);
  assert.equal(body.order.status, 'novo');
  assert.equal(body.order.customer, undefined);
  assert.equal(body.order.consentAt, undefined);
  assert.equal(f.records.get(payload.requestId).customer.phone, '11999991234');
  assert.equal(f.records.get(payload.requestId).customer.cep, '01001000');
  assert.match(response.headers.get('cache-control'), /no-store/);
});

test('multiline observations are accepted without allowing control characters', async () => {
  const f = fixture(); const payload = data();
  payload.customer.notes = 'Primeira linha\nSegunda linha\r\nTerceira\tobservação';
  assert.equal((await f.request('/api/orders', 'POST', payload)).response.status, 201);
  assert.equal(f.records.get(payload.requestId).customer.notes, payload.customer.notes);
  payload.requestId = randomUUID(); payload.customer.notes = 'inválido\u0000';
  assert.equal((await f.request('/api/orders', 'POST', payload)).response.status, 400);
});

test('rejects invalid contact, consent, products and wholesale quantities', async () => {
  for (const change of [
    p => { p.items[0].quantity = 9; }, p => { p.items[0].quantity = 10.5; },
    p => { p.items[0].quantity = 10001; }, p => { p.items[0].id = 'fake'; },
    p => { p.items.push({ ...p.items[0] }); }, p => { p.consent = false; },
    p => { p.customer.email = 'invalid'; }, p => { p.customer.phone = '123'; },
    p => { p.customer.cep = 'invalid'; }, p => { p.customer.state = 'XX'; },
    p => { p.customer.name = ''; }, p => { p.requestId = '../escape'; },
    p => { p.customer.notes = 'x'.repeat(2001); },
  ]) {
    const f = fixture(); const payload = data(); change(payload);
    const { response } = await f.request('/api/orders', 'POST', payload);
    assert.equal(response.status, 400);
    assert.equal(f.records.size, 0);
  }
});

test('concurrent duplicate requests create exactly one order; conflicting replay is rejected', async () => {
  const f = fixture(); const payload = data();
  const results = await Promise.all(Array.from({ length: 5 }, () => f.request('/api/orders', 'POST', payload)));
  assert.equal(f.records.size, 1);
  assert.deepEqual(results.map(result => result.response.status).sort(), [200, 200, 200, 200, 201]);
  assert.ok(results.every(result => result.body.order.id === payload.requestId));
  payload.customer.email = 'another@example.com';
  assert.equal((await f.request('/api/orders', 'POST', payload)).response.status, 409);
});

test('JSON and same-origin enforcement blocks cross-site creation and login', async () => {
  const f = fixture();
  for (const path of ['/api/orders', '/api/admin/session']) {
    assert.equal((await f.request(path, 'POST', data(), null, { Origin: 'https://evil.example' })).response.status, 403);
    assert.equal((await f.request(path, 'POST', data(), null, { 'Content-Type': 'text/plain' })).response.status, 415);
    assert.equal((await f.request(path, 'POST', data(), null, { 'Content-Length': '17000' })).response.status, 413);
    assert.equal((await f.request(path, 'POST', data(), null, { 'Sec-Fetch-Site': 'cross-site' })).response.status, 403);
  }
  assert.equal(f.records.size, 0);
});

test('admin fails closed without configured password and does not touch storage', async () => {
  for (const password of [undefined, '', 'short']) {
    const f = fixture({ env: { KALOPS_ADMIN_PASSWORD: password } });
    assert.deepEqual((await f.request('/api/admin/session')).body, { configured: false, authenticated: false });
    assert.equal((await f.request('/api/admin/session', 'POST', { password: 'short' })).response.status, 503);
    assert.equal((await f.request('/api/admin/orders')).response.status, 503);
    assert.deepEqual((await f.request('/api/orders')).body, { available: false });
    assert.equal((await f.request('/api/orders', 'POST', data())).response.status, 503);
    assert.equal(f.storeReads(), 0);
  }
});

test('public availability only reports readiness, without credentials or customer data', async () => {
  const f = fixture();
  assert.deepEqual((await f.request('/api/orders')).body, { available: true });
  assert.equal(f.storeReads(), 0);
});

test('secure signed session authenticates, rejects forgery/expiry and logs out', async () => {
  const f = fixture();
  assert.equal((await f.request('/api/admin/orders')).response.status, 401);
  assert.equal((await f.request('/api/admin/session', 'POST', { password: 'wrong' })).response.status, 401);
  const login = await f.request('/api/admin/session', 'POST', { password: PASSWORD });
  const setCookie = login.response.headers.get('set-cookie');
  for (const flag of ['__Host-kalops_admin=', 'HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/', 'Max-Age=28800']) assert.ok(setCookie.includes(flag));
  const cookie = setCookie.split(';')[0];
  assert.equal((await f.request('/api/admin/session', 'GET', undefined, cookie)).body.authenticated, true);
  assert.equal((await f.request('/api/admin/orders', 'GET', undefined, `${cookie}x`)).response.status, 401);
  const expired = fixture({ now: () => FIXED_NOW + 8 * 3600000 + 1 });
  assert.equal((await expired.request('/api/admin/session', 'GET', undefined, cookie)).body.authenticated, false);
  const rotated = fixture({ env: { KALOPS_ADMIN_PASSWORD: 'different-secret-with-32-characters' } });
  assert.equal((await rotated.request('/api/admin/orders', 'GET', undefined, cookie)).response.status, 401);
  const logout = await f.request('/api/admin/session', 'DELETE', {}, cookie);
  assert.equal(logout.body.authenticated, false);
  assert.match(logout.response.headers.get('set-cookie'), /Max-Age=0/);
});

test('authenticated pagination exposes full records and updates valid statuses only', async () => {
  const f = fixture(); const cookie = await f.login();
  for (let i = 0; i < 3; i++) await f.request('/api/orders', 'POST', data());
  const first = await f.request('/api/admin/orders?limit=2', 'GET', undefined, cookie);
  assert.equal(first.body.orders.length, 2);
  assert.ok(first.body.orders[0].customer.email);
  assert.ok(first.body.nextCursor);
  const second = await f.request(`/api/admin/orders?limit=2&cursor=${first.body.nextCursor}`, 'GET', undefined, cookie);
  assert.equal(second.body.orders.length, 1);
  assert.equal(second.body.nextCursor, null);
  assert.equal(new Set([...first.body.orders, ...second.body.orders].map(o => o.id)).size, 3);
  const id = first.body.orders[0].id;
  const update = await f.request('/api/admin/orders', 'PATCH', { id, status: 'confirmado' }, cookie);
  assert.equal(update.response.status, 200);
  assert.equal(update.body.order.status, 'confirmado');
  assert.equal(f.records.get(id).status, 'confirmado');
  assert.equal((await f.request('/api/admin/orders', 'PATCH', { id, status: 'inventado' }, cookie)).response.status, 400);
  assert.equal((await f.request('/api/admin/orders', 'PATCH', { id: randomUUID(), status: 'novo' }, cookie)).response.status, 404);
  assert.equal((await f.request('/api/admin/orders', 'PATCH', { id, status: 'novo' })).response.status, 401);
  assert.equal((await f.request('/api/admin/orders?limit=51', 'GET', undefined, cookie)).response.status, 400);
  assert.equal((await f.request('/api/admin/orders?cursor=oops', 'GET', undefined, cookie)).response.status, 400);
});

test('rate limiter protects login and order creation', async () => {
  const f = fixture({ limiter: createLocalLimiter() });
  for (let i = 0; i < 5; i++) assert.equal((await f.request('/api/admin/session', 'POST', { password: 'wrong' })).response.status, 401);
  const limited = await f.request('/api/admin/session', 'POST', { password: PASSWORD });
  assert.equal(limited.response.status, 429);
  assert.equal(limited.response.headers.get('retry-after'), '60');
  for (let i = 0; i < 10; i++) assert.equal((await f.request('/api/orders', 'POST', data())).response.status, 201);
  assert.equal((await f.request('/api/orders', 'POST', data())).response.status, 429);
});

test('storage failures return recoverable error without exposing internals or PII', async () => {
  const f = fixture({ getStore: () => { throw new Error('provider-secret-value'); } });
  const result = await f.request('/api/orders', 'POST', data());
  assert.equal(result.response.status, 503);
  assert.ok(!JSON.stringify(result.body).includes('provider-secret-value'));
});

test('Netlify wrappers route public and native function paths, including request bodies', async () => {
  const { default: orders } = await import('../netlify/functions/orders.mjs');
  const { default: session } = await import('../netlify/functions/admin-session.mjs');
  const { default: admin } = await import('../netlify/functions/admin-orders.mjs');
  for (const path of ['/api/orders', '/.netlify/functions/orders']) {
    const response = await orders(new Request(`${ORIGIN}${path}`), {});
    assert.equal(response.status, 200);
    assert.equal(typeof (await response.json()).available, 'boolean');
  }
  assert.equal((await session(new Request(`${ORIGIN}/.netlify/functions/admin-session`), {})).status, 200);
  assert.notEqual((await admin(new Request(`${ORIGIN}/.netlify/functions/admin-orders?limit=2`), {})).status, 404);
  const response = await session(new Request(`${ORIGIN}/.netlify/functions/admin-session`, { method: 'DELETE', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: '{}' }), {});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).authenticated, false);
});

test('real Blobs SDK preserves orders across emulator restart and enforces conditional writes', async () => {
  const { BlobsServer } = await import('@netlify/blobs/server');
  const { setEnvironmentContext } = await import('@netlify/blobs');
  const { createBlobsOrderStore } = await import('../server/blobs-store.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'kalops-blobs-test-'));
  const previousContext = globalThis.netlifyBlobsContext;
  const previousEnvironmentContext = process.env.NETLIFY_BLOBS_CONTEXT;
  let server;
  const start = async () => {
    server = new BlobsServer({ directory, token: 'local-test-only-not-a-real-credential', logger: () => {} });
    const { port } = await server.start();
    setEnvironmentContext({ siteID: 'kalops-local-test', token: 'local-test-only-not-a-real-credential', edgeURL: `http://127.0.0.1:${port}`, uncachedEdgeURL: `http://127.0.0.1:${port}` });
  };
  try {
    await start();
    const f = fixture({ getStore: createBlobsOrderStore });
    const payload = data();
    assert.equal((await f.request('/api/orders', 'POST', payload)).response.status, 201);
    assert.equal((await f.request('/api/orders', 'POST', payload)).response.status, 200);
    const cookie = await f.login();
    const update = await f.request('/api/admin/orders', 'PATCH', { id: payload.requestId, status: 'em_contato' }, cookie);
    // SDK 11.1.6's filesystem emulator omits ETag on GET. Production exposes
    // it. Fail closed on this emulator limitation instead of losing updates.
    assert.equal(update.response.status, 503);
    await server.stop();
    await start();
    const list = await f.request('/api/admin/orders', 'GET', undefined, cookie);
    assert.equal(list.response.status, 200);
    assert.equal(list.body.orders.length, 1);
    assert.equal(list.body.orders[0].id, payload.requestId);
    assert.equal(list.body.orders[0].status, 'novo');
    assert.equal(list.body.orders[0].totalCents, 19000);
    assert.equal(list.body.orders[0].customer.email, payload.customer.email);
    assert.equal(list.body.nextCursor, null);
  } finally {
    await server?.stop();
    globalThis.netlifyBlobsContext = previousContext;
    if (previousEnvironmentContext === undefined) delete process.env.NETLIFY_BLOBS_CONTEXT;
    else process.env.NETLIFY_BLOBS_CONTEXT = previousEnvironmentContext;
    await rm(directory, { recursive: true, force: true });
  }
});
