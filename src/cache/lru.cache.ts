import { LRUCache } from 'lru-cache';
import type { CacheService } from './types';

export class LruCacheService implements CacheService {
  private readonly store: LRUCache<string, unknown>;
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(maxSize: number = 10_000) {
    this.store = new LRUCache<string, unknown>({
      max: maxSize,
      ttlAutopurge: true,
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const value = this.store.get(key);
    if (value === undefined) return null;
    return value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, value, { ttl: ttlSeconds * 1000 });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async getOrLoad<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T | null>,
  ): Promise<T | null> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const inFlightPromise = this.inFlight.get(key);
    if (inFlightPromise !== undefined) {
      return inFlightPromise as Promise<T | null>;
    }

    const loadPromise = (async () => {
      try {
        const value = await loader();
        if (value !== null) {
          await this.set(key, value, ttlSeconds);
        }
        return value;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, loadPromise);
    return loadPromise;
  }
}