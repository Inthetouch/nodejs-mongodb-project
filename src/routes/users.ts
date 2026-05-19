import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

const userIdParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
  },
} as const;

export const usersRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {

  app.get('/users/:id', {
    schema: { params: userIdParamsSchema },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await app.services.users.getById(id);

    if (user === null) {
      reply.code(404);
      return { error: 'User not found', userId: id };
    }

    return user;
  });
};