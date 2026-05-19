import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { MetricsRegistry } from './registry';

declare module 'fastify' {
  interface FastifyRequest {
    metricsStartHrtime?: bigint;
  }
}

export function attachHttpMetrics(app: FastifyInstance, metrics: MetricsRegistry): void {
  app.addHook('onRequest', async (request: FastifyRequest) => {
    request.metricsStartHrtime = process.hrtime.bigint();
  });

  app.addHook('onResponse', async (request, reply) => {
    if (request.metricsStartHrtime === undefined) return;

    const durationNs = process.hrtime.bigint() - request.metricsStartHrtime;
    const durationMs = Number(durationNs) / 1e6;

    const route = (request.routeOptions as any)?.url ?? 'unknown';
    const method = request.method;
    const status = String(reply.statusCode);

    metrics.httpRequestsTotal.inc({ route, method, status });
    metrics.httpRequestDurationMs.observe({ route, method, status }, durationMs);
  });
}