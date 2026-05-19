import type { CacheService } from './types';

export class NoOpCacheService implements CacheService {

  async get<T>(_key: string): Promise<T | null> {
    return null;
  }

  async set<T>(_key: string, _value: T, _ttlSeconds: number): Promise<void> {

  }

  async delete(_key: string): Promise<void> {

  }

  async getOrLoad<T>(
    _key: string,
    _ttlSeconds: number,
    loader: () => Promise<T | null>,
  ): Promise<T | null> {
    return loader();
  }
}