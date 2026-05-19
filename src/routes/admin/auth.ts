import type { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../config';

export async function requireAdminToken(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const expected = config.admin.token;

  if (!expected) {
    reply.code(503);
    reply.send({
      error: 'Admin disabled',
      message: 'ADMIN_TOKEN не указан. Укажите его в .env чтобы включить /admin/* эндпоинты.',
    });
    return;
  }

  const provided = request.headers['x-admin-token'];
  if (provided === undefined) {
    reply.code(401);
    reply.send({ error: 'Unauthorized', message: 'Missing X-Admin-Token header.' });
    return;
  }

  if (Array.isArray(provided)) {
    reply.code(401);
    reply.send({ error: 'Unauthorized', message: 'X-Admin-Token must be a single header.' });
    return;
  }

  if (provided !== expected) {
    reply.code(403);
    reply.send({ error: 'Forbidden', message: 'Invalid X-Admin-Token.' });
    return;
  }
}