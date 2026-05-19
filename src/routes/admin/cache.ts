import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getRedis } from '../../infra/redis';
import { getCurrentCacheImpl } from '../../cache';

export const adminCacheRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/cache/flush', async () => {
    const impl = getCurrentCacheImpl();
    if (impl === 'none') {
      return { ok: true, impl, action: 'noop', message: 'Cache is disabled.' };
    }

    if (impl === 'redis') {
      const redis = getRedis();
      await redis.flushdb();
      return { ok: true, impl, action: 'flushdb' };
    }

    return {
      ok: false,
      impl,
      action: 'unsupported',
      message: 'LRU full flush is not exposed via API. Restart the server to fully reset LRU cache.',
    };
  });
};