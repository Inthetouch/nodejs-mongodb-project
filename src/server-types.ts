import type { Services } from './services';
import type { IndexManager } from './indexes/manager';
import type { MetricsRegistry } from './metrics/registry';
import type { ExplainProfiler } from './explain/profiler';

declare module 'fastify' {
  interface FastifyInstance {
    services: Services;
    indexManager: IndexManager;
    metrics: MetricsRegistry;
    explainProfiler: ExplainProfiler;
  }
}