export type { CacheService } from './types';
export { NoOpCacheService } from './noop.cache';
export { LruCacheService } from './lru.cache';
export { RedisCacheService } from './redis.cache';

import { config } from '../config';
import { getRedis } from '../infra/redis';
import type { CacheService } from './types';
import { NoOpCacheService } from './noop.cache';
import { LruCacheService } from './lru.cache';
import { RedisCacheService } from './redis.cache';
import { MetricsCacheService } from '../metrics/cache';
import type { MetricsRegistry } from '../metrics/registry';

export type CacheImpl = 'none' | 'lru' | 'redis';

export interface BuildCacheOptions {
  metrics?: MetricsRegistry;
}

export function buildCache(options: BuildCacheOptions = {}): CacheService {

  let impl: CacheImpl;
  let inner: CacheService;

  if (!config.experiment.cacheEnabled) {
    impl = 'none';
    inner = new NoOpCacheService();
  } else {
    impl = (process.env.CACHE_IMPL ?? 'redis') as CacheImpl;
    switch (impl) {
      case 'none':
        inner = new NoOpCacheService();
        break;
      case 'lru':
        inner = new LruCacheService();
        break;
      case 'redis':
        inner = new RedisCacheService(getRedis());
        break;
      default:
        throw new Error(`Unknown CACHE_IMPL: ${impl}`);
    }
  }

  if (options.metrics) {
    options.metrics.setCacheImpl(impl);
    return new MetricsCacheService(inner, options.metrics, impl);
  }

  return inner;

}

export function getCurrentCacheImpl(): CacheImpl {
  if (!config.experiment.cacheEnabled) return 'none';
  return (process.env.CACHE_IMPL ?? 'redis') as CacheImpl;
}