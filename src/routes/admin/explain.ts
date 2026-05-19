import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { ExplainProfiler } from '../../explain/profiler';

const explainBodySchema = {
  type: 'object',
  required: ['collection', 'filter'],
  properties: {
    collection: { type: 'string', enum: ['products', 'users', 'orders'] },
    filter: { type: 'object', additionalProperties: true },
    sort: { type: 'object', additionalProperties: { type: 'integer', enum: [1, -1] } },
    projection: { type: 'object', additionalProperties: { type: 'integer', enum: [0, 1] } },
    limit: { type: 'integer', minimum: 1, maximum: 10000 },
    label: { type: 'string', maxLength: 64 },
    includeRaw: { type: 'boolean', default: false },
  },
  additionalProperties: false,
} as const;

export function buildAdminExplainRoutes(profiler: ExplainProfiler): FastifyPluginAsync {
  return async (app: FastifyInstance) => {
    app.post('/explain', { schema: { body: explainBodySchema } }, async (request) => {
      const body = request.body as {
        collection: 'products' | 'users' | 'orders';
        filter: Record<string, unknown>;
        sort?: Record<string, 1 | -1>;
        projection?: Record<string, 0 | 1>;
        limit?: number;
        label?: string;
        includeRaw?: boolean;
      };

      const { summary, raw } = await profiler.profile({
        collection: body.collection,
        filter: body.filter,
        sort: body.sort,
        projection: body.projection,
        limit: body.limit,
        label: body.label,
      });

      return body.includeRaw ? { summary, raw } : { summary };
    });
  };
}