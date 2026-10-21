import { createOrdersAPI, createLocalLimiter } from './orders-core.mjs';
import { createBlobsOrderStore } from './blobs-store.mjs';

export const handleOrders = createOrdersAPI({ getStore: createBlobsOrderStore, limiter: createLocalLimiter() });

// Netlify rewrites can expose either the original public path or the native
// function path. Preserve query parameters, origin, method, headers and body.
export function routeFunction(request, context, name, publicPath) {
  const url = new URL(request.url);
  if (url.pathname === `/.netlify/functions/${name}`) {
    url.pathname = publicPath;
    request = new Request(url, request);
  }
  return handleOrders(request, context);
}
