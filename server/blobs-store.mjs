import { getStore } from '@netlify/blobs';

export function createBlobsOrderStore() {
  // Netlify supplies scoped runtime credentials. Never use a personal access token.
  const store = getStore({ name: 'kalops-wholesale-orders', consistency: 'strong' });
  const key = id => `orders/${id}`;
  return {
    get: id => store.get(key(id), { type: 'json', consistency: 'strong' }),
    async create(order) {
      const result = await store.setJSON(key(order.id), order, { onlyIfNew: true });
      // Do not acknowledge an unconfirmed write. The SDK may classify a
      // non-412 HTTP response as modified even after provider retries fail.
      if (result.modified && !result.etag) throw new Error('Unconfirmed order write');
      return result.modified;
    },
    async list({ limit, cursor }) {
      // The SDK exposes page iteration, not a resumable cursor. Page by stable
      // UUID keys, reading PII bodies only for the requested page.
      const keys = [];
      for await (const page of store.list({ prefix: 'orders/', paginate: true })) {
        for (const blob of page.blobs) {
          const id = blob.key.slice('orders/'.length);
          if (!cursor || id > cursor) keys.push(id);
        }
      }
      keys.sort();
      const selected = keys.slice(0, limit);
      const records = await Promise.all(selected.map(id => store.get(key(id), { type: 'json', consistency: 'strong' })));
      return { orders: records.filter(Boolean), nextCursor: keys.length > limit ? selected.at(-1) : null };
    },
    async updateStatus(id, status, updatedAt) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const result = await store.getWithMetadata(key(id), { type: 'json', consistency: 'strong' });
        if (!result) return null;
        if (!result.etag) throw new Error('Missing concurrency token');
        const order = { ...result.data, status, updatedAt };
        const write = await store.setJSON(key(id), order, { onlyIfMatch: result.etag });
        if (write.modified) {
          if (!write.etag) throw new Error('Unconfirmed status write');
          return order;
        }
      }
      throw new Error('Concurrent order update');
    },
  };
}
