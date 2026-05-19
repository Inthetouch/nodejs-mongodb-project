import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { config } from '../../config';
import type { MetricsRegistry } from '../../metrics/registry';
import type { IndexManager } from '../../indexes/manager';
import { getCurrentCacheImpl } from '../../cache';

interface CounterSnapshot {
  name: string;
  total: number;
  byLabel: Record<string, number>;
}

function summarizeCounter(json: any, name: string, labelKey?: string): CounterSnapshot {
  const entry = json.find((m: any) => m.name === name);
  if (!entry) return { name, total: 0, byLabel: {} };
  let total = 0;
  const byLabel: Record<string, number> = {};
  for (const v of entry.values ?? []) {
    total += v.value;
    if (labelKey) {
      const labelVal = v.labels?.[labelKey] ?? 'unknown';
      byLabel[labelVal] = (byLabel[labelVal] ?? 0) + v.value;
    }
  }
  return { name, total, byLabel };
}

export function buildAdminStatsRoutes(
  manager: IndexManager,
  metrics: MetricsRegistry,
): FastifyPluginAsync {
  return async (app: FastifyInstance) => {
    app.get('/stats', async () => {
      const json = await metrics.registry.getMetricsAsJSON();

      const httpRequests = summarizeCounter(json, 'http_requests_total', 'route');
      const cacheHits = summarizeCounter(json, 'cache_hits_total', 'key_prefix');
      const cacheMisses = summarizeCounter(json, 'cache_misses_total', 'key_prefix');
      const mongoQueries = summarizeCounter(json, 'mongo_queries_total', 'collection');

      const hitRate = cacheHits.total + cacheMisses.total > 0
        ? cacheHits.total / (cacheHits.total + cacheMisses.total)
        : null;

      return {
        env: config.nodeEnv,
        uptimeSeconds: Math.round(process.uptime()),
        indexProfile: manager.getLastAppliedProfile(),
        cache: {
          enabled: config.experiment.cacheEnabled,
          impl: getCurrentCacheImpl(),
          hits: cacheHits,
          misses: cacheMisses,
          hitRate,
        },
        http: {
          requests: httpRequests,
        },
        mongo: {
          queries: mongoQueries,
        },
        notes: [
          'Полные метрики доступны на GET /metrics (без X-Admin-Token).',
          'Native-репозитории не отслеживаются Mongoose-плагином (только collection.* через драйвер).',
        ],
      };
    });
  };
}