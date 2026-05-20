import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { requireAdminToken } from './auth';
import { buildAdminIndexesRoutes } from './indexes';
import { buildAdminExplainRoutes } from './explain';
import { buildAdminStatsRoutes } from './stats';
import { adminCacheRoutes } from './cache';
import { adminCleanupRoutes } from './cleanup';
import type { IndexManager } from '../../indexes/manager';
import type { MetricsRegistry } from '../../metrics/registry';
import type { ExplainProfiler } from '../../explain/profiler';

export interface AdminDeps {
  indexManager: IndexManager;
  metrics: MetricsRegistry;
  explainProfiler: ExplainProfiler;
}

export function buildAdminRoutes(deps: AdminDeps): FastifyPluginAsync {
  return async (app: FastifyInstance) => {
    app.addHook('preHandler', requireAdminToken);

    app.get('/ping', async () => ({
      status: 'admin-ok',
      timestamp: new Date().toISOString(),
    }));

    await app.register(buildAdminIndexesRoutes(deps.indexManager, deps.metrics));
    await app.register(buildAdminExplainRoutes(deps.explainProfiler));
    await app.register(buildAdminStatsRoutes(deps.indexManager, deps.metrics));
    await app.register(adminCacheRoutes);
    await app.register(adminCleanupRoutes);
  };
}