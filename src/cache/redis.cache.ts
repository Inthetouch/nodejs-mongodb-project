import type Redis from 'ioredis';
import type { CacheService } from './types';

export class RedisCacheService implements CacheService {
  private readonly inFlight = new Map<string, Promise<unknown>>();
  constructor(private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const raw = JSON.stringify(value);
    await this.redis.set(key, raw, 'EX', ttlSeconds);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async getOrLoad<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T | null>,
  ): Promise<T | null> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

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