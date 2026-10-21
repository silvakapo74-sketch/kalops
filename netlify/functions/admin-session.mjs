import { routeFunction } from '../../server/orders-runtime.mjs';
export default (request, context) => routeFunction(request, context, 'admin-session', '/api/admin/session');
export const config = { path: '/api/admin/session', rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
