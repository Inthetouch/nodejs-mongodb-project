import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { IndexManager } from '../../indexes/manager';
import {
  INDEX_PROFILE_NAMES,
  INDEX_PROFILES,
  type IndexProfileName,
} from '../../indexes/profiles';
import type { MetricsRegistry } from '../../metrics/registry';

const applyBodySchema = {
  type: 'object',
  required: ['profile'],
  properties: {
    profile: { type: 'string', enum: [...INDEX_PROFILE_NAMES] },
  },
  additionalProperties: false,
} as const;

const stateQuerySchema = {
  type: 'object',
  properties: {
    profile: { type: 'string', enum: [...INDEX_PROFILE_NAMES] },
  },
  additionalProperties: false,
} as const;

export function buildAdminIndexesRoutes(
  manager: IndexManager,
  metrics: MetricsRegistry,
): FastifyPluginAsync {
  return async (app: FastifyInstance) => {

    app.get('/indexes/profiles', async () => ({
      profiles: Object.values(INDEX_PROFILES).map(p => ({
        name: p.name,
        description: p.description,
        collections: p.collections,
      })),
      lastApplied: manager.getLastAppliedProfile(),
    }));

    app.get('/indexes', { schema: { querystring: stateQuerySchema } }, async (request) => {
      const query = request.query as { profile?: IndexProfileName };
      const profileForMarking = query.profile ?? manager.getLastAppliedProfile();
      const state = await manager.getState(profileForMarking);
      const diff = await manager.diff(profileForMarking);

      return {
        lastApplied: manager.getLastAppliedProfile(),
        comparedWith: profileForMarking,
        state,
        diff,
      };
    });

    app.post('/indexes/dry-run', { schema: { body: applyBodySchema } }, async (request) => {
      const { profile } = request.body as { profile: IndexProfileName };
      const plan = await manager.diff(profile);
      return { dryRun: true, plan };
    });

    app.post('/indexes', { schema: { body: applyBodySchema } }, async (request, reply) => {
      const { profile } = request.body as { profile: IndexProfileName };
      const result = await manager.apply(profile);
      metrics.setIndexProfile(profile);
      if (result.errors.length > 0) {
        reply.code(207);
      }
      return result;
    });
  };
}