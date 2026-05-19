import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from 'prom-client';

export class MetricsRegistry {
  readonly registry = new Registry();

  readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Общее число HTTP-запросов по маршрутам и статусам.',
    labelNames: ['route', 'method', 'status'] as const,
    registers: [this.registry],
  });

  readonly httpRequestDurationMs = new Histogram({
    name: 'http_request_duration_ms',
    help: 'Длительность обработки HTTP-запросов в миллисекундах.',
    labelNames: ['route', 'method', 'status'] as const,
    buckets: [0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500],
    registers: [this.registry],
  });

  readonly cacheHitsTotal = new Counter({
    name: 'cache_hits_total',
    help: 'Число попаданий в кэш.',
    labelNames: ['cache_impl', 'key_prefix'] as const,
    registers: [this.registry],
  });

  readonly cacheMissesTotal = new Counter({
    name: 'cache_misses_total',
    help: 'Число промахов кэша.',
    labelNames: ['cache_impl', 'key_prefix'] as const,
    registers: [this.registry],
  });

  readonly cacheOperationDurationMs = new Histogram({
    name: 'cache_operation_duration_ms',
    help: 'Длительность операций кэша (get/set/delete).',
    labelNames: ['cache_impl', 'op'] as const,
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 25],
    registers: [this.registry],
  });

  readonly mongoQueriesTotal = new Counter({
    name: 'mongo_queries_total',
    help: 'Число операций в MongoDB по коллекции и типу операции.',
    labelNames: ['collection', 'op'] as const,
    registers: [this.registry],
  });

  readonly mongoQueryDurationMs = new Histogram({
    name: 'mongo_query_duration_ms',
    help: 'Длительность операций MongoDB в миллисекундах.',
    labelNames: ['collection', 'op'] as const,
    buckets: [0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500],
    registers: [this.registry],
  });

  readonly currentIndexProfile = new Gauge({
    name: 'current_index_profile',
    help: 'Активный профиль индексов: 1 — текущий, 0 — остальные.',
    labelNames: ['profile'] as const,
    registers: [this.registry],
  });

  readonly currentCacheImpl = new Gauge({
    name: 'current_cache_impl',
    help: 'Активная реализация кэша: 1 — текущая, 0 — остальные.',
    labelNames: ['impl'] as const,
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry, prefix: 'node_' });
  }

  setIndexProfile(profile: string): void {
    for (const p of ['none', 'single', 'esr', 'text']) {
      this.currentIndexProfile.set({ profile: p }, p === profile ? 1 : 0);
    }
  }

  setCacheImpl(impl: string): void {
    for (const i of ['none', 'lru', 'redis']) {
      this.currentCacheImpl.set({ impl: i }, i === impl ? 1 : 0);
    }
  }

  async getPrometheusText(): Promise<string> {
    return this.registry.metrics();
  }
}