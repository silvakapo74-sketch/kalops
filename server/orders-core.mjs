import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { products } from '../src/products.js';

const COOKIE = '__Host-kalops_admin';
const SESSION_SECONDS = 8 * 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATES = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
const STATUSES = new Set(['novo', 'em_contato', 'confirmado', 'enviado', 'cancelado']);
const catalog = new Map(products.map(product => [product.id, product]));
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };
const digest = value => createHash('sha256').update(value).digest();
const equal = (a, b) => timingSafeEqual(digest(a), digest(b));
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: {
  'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, private',
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...headers,
} });
const clearCookie = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

function passwordFrom(env) {
  const password = env.KALOPS_ADMIN_PASSWORD;
  return typeof password === 'string' && password.length >= 16 ? password : null;
}
function signature(data, password) { return createHmac('sha256', digest(password)).update(data).digest('base64url'); }
function authenticated(request, password, now) {
  if (!password) return false;
  const token = (request.headers.get('cookie') || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!token || token.length > 512) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || !/^\d{10}$/.test(parts[0]) || !/^[a-f0-9]{32}$/.test(parts[1])) return false;
  const expires = Number(parts[0]);
  return expires > Math.floor(now / 1000) && expires <= Math.floor(now / 1000) + SESSION_SECONDS && equal(signature(`${parts[0]}.${parts[1]}`, password), parts[2]);
}
function requireAuth(request, password, now) {
  if (!password) fail(503, 'A área administrativa ainda não foi configurada.');
  if (!authenticated(request, password, now)) fail(401, 'Entre novamente para acessar os pedidos.');
}
async function bodyJSON(request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) fail(403, 'Origem da solicitação não permitida.');
  if (request.headers.get('sec-fetch-site') === 'cross-site') fail(403, 'Origem da solicitação não permitida.');
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) fail(415, 'Envie os dados em JSON.');
  if (Number(request.headers.get('content-length')) > 16384) fail(413, 'Solicitação muito grande.');
  const text = await request.text();
  if (Buffer.byteLength(text) > 16384) fail(413, 'Solicitação muito grande.');
  let value;
  try { value = JSON.parse(text); } catch { fail(400, 'JSON inválido.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'Dados inválidos.');
  return value;
}
function field(value, label, max, required = true, multiline = false) {
  if (value == null && !required) return '';
  if (typeof value !== 'string') fail(400, `Informe ${label}.`);
  const result = value.trim();
  const controls = multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/;
  if ((required && !result) || result.length > max || controls.test(result)) fail(400, `Informe ${label} válido.`);
  return result;
}
function validateOrder(data) {
  if (typeof data.requestId !== 'string' || !UUID.test(data.requestId)) fail(400, 'Identificador do pedido inválido.');
  if (data.consent !== true) fail(400, 'Autorize o uso dos dados para atendimento do pedido.');
  if (!data.customer || typeof data.customer !== 'object' || Array.isArray(data.customer)) fail(400, 'Informe os dados de contato.');
  const c = data.customer;
  const customer = {
    name: field(c.name, 'seu nome', 100), company: field(c.company, 'a empresa', 120, false),
    phone: field(c.phone, 'um telefone', 22), email: field(c.email, 'um e-mail', 160).toLowerCase(),
    cep: field(c.cep, 'um CEP', 9), city: field(c.city, 'a cidade', 100),
    state: field(c.state, 'o estado', 2).toUpperCase(), notes: field(c.notes, 'as observações', 1000, false, true),
  };
  if (!/^[+\d\s().-]+$/.test(customer.phone)) fail(400, 'Telefone inválido.');
  customer.phone = customer.phone.replace(/\D/g, '');
  if (!/^(?:55)?\d{10,11}$/.test(customer.phone)) fail(400, 'Informe um telefone brasileiro com DDD.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) fail(400, 'E-mail inválido.');
  if (!/^\d{5}-?\d{3}$/.test(customer.cep)) fail(400, 'CEP inválido.');
  customer.cep = customer.cep.replace('-', '');
  if (!STATES.has(customer.state)) fail(400, 'Estado inválido.');
  if (!Array.isArray(data.items) || !data.items.length || data.items.length > catalog.size) fail(400, 'Selecione os produtos do pedido.');
  const seen = new Set();
  const items = data.items.map(item => {
    const product = item && catalog.get(item.id);
    if (!product || seen.has(item.id)) fail(400, 'Produto inválido ou repetido.');
    seen.add(item.id);
    if (!Number.isInteger(item.quantity) || item.quantity < 10 || item.quantity > 10000) fail(400, 'A quantidade deve ser de 10 a 10.000 unidades por produto.');
    const unitPriceCents = Math.round(product.price * 100);
    return { id: product.id, name: product.name, quantity: item.quantity, unitPriceCents, lineTotalCents: unitPriceCents * item.quantity };
  }).sort((a, b) => a.id.localeCompare(b.id));
  return { id: data.requestId.toLowerCase(), customer, items, totalCents: items.reduce((sum, item) => sum + item.lineTotalCents, 0) };
}
function publicOrder(order) {
  const { id, createdAt, totalCents, items, status } = order;
  return { id, createdAt, totalCents, items, status };
}
function fingerprint(order) { return digest(JSON.stringify({ customer: order.customer, items: order.items })).toString('hex'); }

// Inject storage, environment and clock so tests exercise the production handlers.
// Store interface: get(id), create(record)->boolean, list({limit,cursor}), updateStatus(id,status,updatedAt).
export function createOrdersAPI({ getStore, env = process.env, now = Date.now, limiter = () => true }) {
  return async function handle(request, context = {}) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const password = passwordFrom(env);
      const timestamp = now();
      if (path === '/api/admin/session') {
        if (request.method === 'GET') return json({ authenticated: authenticated(request, password, timestamp), configured: !!password });
        if (request.method === 'DELETE') { await bodyJSON(request); return json({ authenticated: false, configured: !!password }, 200, { 'Set-Cookie': clearCookie }); }
        if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405, { Allow: 'GET, POST, DELETE' });
        const data = await bodyJSON(request);
        if (!password) fail(503, 'Configure uma senha administrativa com pelo menos 16 caracteres.');
        if (!await limiter('login', context.ip || 'unknown', timestamp)) fail(429, 'Muitas tentativas. Aguarde antes de tentar novamente.');
        if (typeof data.password !== 'string' || !equal(data.password, password)) fail(401, 'Senha incorreta.');
        const payload = `${Math.floor(timestamp / 1000) + SESSION_SECONDS}.${randomBytes(16).toString('hex')}`;
        return json({ authenticated: true, configured: true }, 200, { 'Set-Cookie': `${COOKIE}=${payload}.${signature(payload, password)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}` });
      }
      if (path === '/api/orders') {
        if (request.method === 'GET') return json({ available: !!password });
        if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405, { Allow: 'GET, POST' });
        const data = await bodyJSON(request);
        if (!password) fail(503, 'O recebimento de pedidos ainda não foi ativado. Entre em contato com a Kalops.');
        if (!await limiter('create', context.ip || 'unknown', timestamp)) fail(429, 'Muitos pedidos. Aguarde antes de tentar novamente.');
        const normalized = validateOrder(data);
        const store = getStore();
        const order = { ...normalized, createdAt: new Date(timestamp).toISOString(), status: 'novo', consentAt: new Date(timestamp).toISOString() };
        const created = await store.create(order);
        if (created) return json({ order: publicOrder(order) }, 201);
        const existing = await store.get(order.id);
        if (!existing) fail(503, 'Não foi possível confirmar o pedido. Tente novamente com o mesmo identificador.');
        if (!equal(fingerprint(existing), fingerprint(order))) fail(409, 'Esse identificador já foi usado em outro pedido.');
        return json({ order: publicOrder(existing) });
      }
      if (path === '/api/admin/orders') {
        requireAuth(request, password, timestamp);
        if (request.method === 'GET') {
          const limit = Number(url.searchParams.get('limit') || 20);
          const cursor = url.searchParams.get('cursor') || null;
          if (!Number.isInteger(limit) || limit < 1 || limit > 50 || (cursor && (cursor.length > 100 || !UUID.test(cursor)))) fail(400, 'Paginação inválida.');
          return json(await getStore().list({ limit, cursor }));
        }
        if (request.method === 'PATCH') {
          const data = await bodyJSON(request);
          if (typeof data.id !== 'string' || !UUID.test(data.id) || !STATUSES.has(data.status)) fail(400, 'Pedido ou status inválido.');
          const order = await getStore().updateStatus(data.id.toLowerCase(), data.status, new Date(timestamp).toISOString());
          if (!order) fail(404, 'Pedido não encontrado.');
          return json({ order });
        }
        return json({ error: 'Método não permitido.' }, 405, { Allow: 'GET, PATCH' });
      }
      return json({ error: 'Não encontrado.' }, 404);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status, error.status === 429 ? { 'Retry-After': '60' } : {});
      // Avoid logging personal data or provider error details containing credentials.
      return json({ error: 'Serviço de pedidos temporariamente indisponível. Tente novamente.' }, 503);
    }
  };
}

// Defense in depth per warm instance. Deployment rate limits cover all instances.
export function createLocalLimiter() {
  const buckets = new Map();
  return (kind, ip, timestamp) => {
    const window = Math.floor(timestamp / 60000);
    const key = `${kind}:${ip}`;
    if (buckets.size > 5000) for (const [oldKey, bucket] of buckets) if (bucket.window !== window) buckets.delete(oldKey);
    const bucket = buckets.get(key);
    const count = bucket?.window === window ? bucket.count + 1 : 1;
    buckets.set(key, { window, count });
    return count <= (kind === 'login' ? 5 : 10);
  };
}
