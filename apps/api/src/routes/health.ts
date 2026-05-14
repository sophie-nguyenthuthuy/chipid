import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../db/client.js';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/healthz', { config: { public: true } }, async () => ({ status: 'ok' }));

  fastify.get('/readyz', { config: { public: true } }, async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch (err) {
      reply.status(503);
      return { status: 'error', message: (err as Error).message };
    }
  });
};
