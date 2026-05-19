import type { Services } from './services';

declare module 'fastify' {
  interface FastifyInstance {
    services: Services;
  }
}