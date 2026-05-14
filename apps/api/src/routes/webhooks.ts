import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { hashSecret, lookupHash, randomSecret } from '../lib/crypto.js';
import { ApiError } from '../lib/errors.js';

const CreateBody = z.object({
  url: z.string().url(),
  enabled_events: z.array(z.string()).min(1).default(['*']),
});

export const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/v1/webhook_endpoints', async (req, reply) => {
    const body = CreateBody.parse(req.body);
    const secret = `whsec_${randomSecret(32)}`;
    const row = await prisma.webhookEndpoint.create({
      data: {
        accountId: req.auth.accountId,
        url: body.url,
        secretHash: await hashSecret(secret),
        enabledEvents: body.enabled_events,
      },
    });
    reply.status(201).send({
      id: row.id,
      object: 'webhook_endpoint',
      url: row.url,
      enabled_events: row.enabledEvents,
      secret, // shown exactly once
      created: Math.floor(row.createdAt.getTime() / 1000),
    });
  });

  fastify.get('/v1/webhook_endpoints', async (req) => {
    const rows = await prisma.webhookEndpoint.findMany({
      where: { accountId: req.auth.accountId, disabledAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return {
      object: 'list',
      data: rows.map((r) => ({
        id: r.id,
        object: 'webhook_endpoint',
        url: r.url,
        enabled_events: r.enabledEvents,
        created: Math.floor(r.createdAt.getTime() / 1000),
      })),
    };
  });

  fastify.delete('/v1/webhook_endpoints/:id', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const row = await prisma.webhookEndpoint.findFirst({
      where: { id, accountId: req.auth.accountId },
    });
    if (!row) throw new ApiError('resource_missing', `No such webhook_endpoint: ${id}`);
    await prisma.webhookEndpoint.update({
      where: { id: row.id },
      data: { disabledAt: new Date() },
    });
    return { id: row.id, object: 'webhook_endpoint', deleted: true };
  });
  // referenced to satisfy noUnusedLocals on the helper; used by future
  // signature-verification endpoint
  void lookupHash;
};
