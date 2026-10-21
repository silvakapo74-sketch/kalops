import { routeFunction } from '../../server/orders-runtime.mjs';
export default (request, context) => routeFunction(request, context, 'admin-orders', '/api/admin/orders');
export const config = { path: '/api/admin/orders', rateLimit: { windowLimit: 120, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
