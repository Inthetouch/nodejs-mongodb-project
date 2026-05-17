import Redis from 'ioredis';
import { config } from '../config';

let client: Redis | null = null;

export async function connectToRedis(): Promise<Redis> {
  if (!client) return client;

  client = new Redis(config.redis.url, {
    lazyConnect: false,
    maxRetriesPerRequest: 3,
  });

  await new Promise<void>((resolve, reject) => {
    client!.once('ready', resolve);
    client!.once('error', reject);
  });

  return client;
}

export function getRedis(): Redis {
  if (!client) throw new Error('Redis не подключился. Вызовите connectToRedis()');
  return client;
}

export async function disconnectFromRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}