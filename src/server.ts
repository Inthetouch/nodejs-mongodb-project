import Fastify from "fastify";
import { config } from "./config";
import { connectMongo, disconnectMongo } from "./infra/mongo";
import { connectRedis, disconnectRedis } from "./infra/redis";
import { timeStamp } from "node:console";

async function buildServer() {
  const app = Fastify({
    logger: {
      transport: config.nodeEnv === 'development' ? {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      } : undefined,
    },
  });

  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  return app;
}

async function main() {
  await connectMongo();
  await connectRedis();

  const app = await buildServer();

  const shutdown = async (signal: string) => {
    app.log.info(`Получен ${signal}, процесс завершается...`);
    await app.close();
    await disconnectMongo();
    await disconnectRedis();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  await app.listen({ port: config.port, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error('Ошибка запуска сервера:', err);
  process.exit(1);
});