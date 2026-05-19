import type { CacheService } from '../cache';
import type { MetricsRegistry } from './registry';

function extractKeyPrefix(key: string): string {
  const idx = key.indexOf(':');
  return idx === -1 ? key : key.slice(0, idx);
}

export class MetricsCacheService implements CacheService {
  constructor(
    private readonly inner: CacheService,
    private readonly metrics: MetricsRegistry,
    private readonly implName: string,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const end = this.metrics.cacheOperationDurationMs.startTimer({
      cache_impl: this.implName,
      op: 'get',
    });
    try {
      return await this.inner.get<T>(key);
    } finally {
      end();
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const end = this.metrics.cacheOperationDurationMs.startTimer({
      cache_impl: this.implName,
      op: 'set',
    });
    try {
      await this.inner.set(key, value, ttlSeconds);
    } finally {
      end();
    }
  }

  async delete(key: string): Promise<void> {
    const end = this.metrics.cacheOperationDurationMs.startTimer({
      cache_impl: this.implName,
      op: 'delete',
    });
    try {
      await this.inner.delete(key);
    } finally {
      end();
    }
  }

  async getOrLoad<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T | null>,
  ): Promise<T | null> {
    const keyPrefix = extractKeyPrefix(key);
    const cached = await this.get<T>(key);
    if (cached !== null) {
      this.metrics.cacheHitsTotal.inc({
        cache_impl: this.implName,
        key_prefix: keyPrefix,
      });
      return cached;
    }
    this.metrics.cacheMissesTotal.inc({
      cache_impl: this.implName,
      key_prefix: keyPrefix,
    });
    const value = await loader();
    if (value !== null) {
      await this.set(key, value, ttlSeconds);
    }
    return value;
  }
}