import 'dotenv/config'

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Отсутствует обязательная переменная ${key}`);
  }
  return value;
}

function int(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (!raw) return defaultValue;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Переменная ${key} должна быть числом`);
  }
  return parsed;
}

function bool(key: string, defaultValue: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined) return defaultValue;
  return raw.toLowerCase() === 'true';
}

export const config = {

  port: int('PORT', 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  mongo: {
    uri: required('MONGO_URI'),
    poolMin: int('MONGO_POOL_MIN', 5),
    poolMax: int('MONGO_POOL_MAX', 10),
  },

  redis: {
    url: required('REDIS_URL'),
  },

  experiment: {
    cacheEnabled: bool('CACHE_ENABLED', false),
    cacheTtlSeconds: int('CACHE_TTL_SECONDS', 60),
    useLean: bool('USE_LEAN', false),
  },
} as const;