import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { MetricsRegistry } from '../metrics/registry';

export function buildMetricsRoutes(metrics: MetricsRegistry): FastifyPluginAsync {
  return async (app: FastifyInstance) => {
    app.get('/metrics', async (_request, reply) => {
      reply.header('Content-Type', metrics.registry.contentType);
      return metrics.getPrometheusText();
    });
  };
}