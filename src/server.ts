import { metricsSingleton } from './metrics/install';

import Fastify from "fastify";
import './server-types';
import { config } from "./config";
import { connectToMongo, disconnectFromMongo } from "./infra/mongo";
import { connectToRedis, disconnectFromRedis } from "./infra/redis";
import { attachHttpMetrics } from './metrics/http';
import { buildServices } from './services';
import { productsRoutes } from './routes/products';
import { ordersRoutes } from './routes/orders';
import { usersRoutes } from './routes/users';
import { buildAdminRoutes } from './routes/admin';
import { buildMetricsRoutes } from './routes/metrics';
import { IndexManager } from './indexes/manager';
import { ExplainProfiler } from './explain/profiler';
import { getCurrentCacheImpl } from './cache';
import type { MetricsRegistry } from './metrics/registry';

async function buildServer(metrics: MetricsRegistry, indexManager: IndexManager, explainProfiler: ExplainProfiler) {
  const app = Fastify({
    logger: {
      transport: config.nodeEnv === 'development' ? {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      } : undefined,
    },
  });

  if (config.metrics.enabled) {
    attachHttpMetrics(app, metrics);
  }

  const services = buildServices({ metrics: config.metrics.enabled ? metrics : undefined });
  app.decorate('services', services);
  app.decorate('indexManager', indexManager);
  app.decorate('metrics', metrics);
  app.decorate('explainProfiler', explainProfiler);

  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  await app.register(productsRoutes);
  await app.register(ordersRoutes);
  await app.register(usersRoutes);

  if (config.metrics.enabled) {
    await app.register(buildMetricsRoutes(metrics));
  }

  await app.register(
    buildAdminRoutes({ indexManager, metrics, explainProfiler }),
    { prefix: '/admin' },
  );

  return app;
}

async function main() {

  const metrics = metricsSingleton

  await connectToMongo();
  await connectToRedis();

  const indexManager = new IndexManager(config.experiment.initialIndexProfile);
  const explainProfiler = new ExplainProfiler();

  metrics.setIndexProfile(config.experiment.initialIndexProfile);
  metrics.setCacheImpl(getCurrentCacheImpl());

  const app = await buildServer(metrics, indexManager, explainProfiler);

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