import Fastify from "fastify";
import { config } from "./config";
import { connectToMongo, disconnectFromMongo } from "./infra/mongo";
import { connectToRedis, disconnectFromRedis } from "./infra/redis";

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

  app.get('/test/users/:id', async (req: any) => {
    const repos = buildRepositories();
    const user = await repos.users.findById(req.params.id);
    return { user };
  });

  app.get('/test/users/by-email/:email', async (req: any) => {
    const repos = buildRepositories();
    const user = await repos.users.findByEmail(req.params.email);
    return { user };
  });

  app.get('/test/orders/:id', async (req: any) => {
    const repos = buildRepositories();
    const order = await repos.orders.findById(req.params.id);
    return { order };
  });

  app.get('/test/orders/by-user/:userId', async (req: any) => {
    const repos = buildRepositories();
    const result = await repos.orders.findMany(
      { userId: req.params.userId },
      { skip: 0, limit: 10 }
    );
    return result;
  });

  return app;
}

async function main() {
  await connectToMongo();
  await connectToRedis();

  const app = await buildServer();

  const shutdown = async (signal: string) => {
    app.log.info(`Получен ${signal}, процесс завершается...`);
    await app.close();
    await disconnectFromMongo();
    await disconnectFromRedis();
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