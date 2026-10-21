import { routeFunction } from '../../server/orders-runtime.mjs';
export default (request, context) => routeFunction(request, context, 'orders', '/api/orders');
export const config = { path: '/api/orders', rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
