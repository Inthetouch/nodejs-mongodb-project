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

export type CacheImpl = 'none' | 'lru' | 'redis';

export function buildCache(): CacheService {
  if (!config.experiment.cacheEnabled) {
    return new NoOpCacheService();
  }

  const impl = (process.env.CACHE_IMPL ?? 'redis') as CacheImpl;

  switch (impl) {
    case 'none':
      return new NoOpCacheService();
    case 'lru':
      return new LruCacheService();
    case 'redis':
      return new RedisCacheService(getRedis());
    default:
      throw new Error(`Unknown CACHE_IMPL: ${impl}`);
  }
}