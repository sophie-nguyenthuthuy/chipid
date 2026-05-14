import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  VerificationCreateBody,
  VerificationSubmitBody,
} from '../schemas/verification.js';
import {
  createVerification,
  getVerification,
  listVerifications,
  submitVerification,
} from '../services/verifications.js';

export const verificationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/v1/verifications', async (req, reply) => {
    const body = VerificationCreateBody.parse(req.body);
    const { resource, clientSecret } = await createVerification({
      accountId: req.auth.accountId,
      environment: req.auth.environment,
      body,
    });
    reply.status(201).send({ ...resource, client_secret: clientSecret });
  });

  fastify.get('/v1/verifications/:id', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    return await getVerification({ accountId: req.auth.accountId, id });
  });

  fastify.get('/v1/verifications', async (req) => {
    const q = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).default(10),
        starting_after: z.string().optional(),
      })
      .parse(req.query);
    const { data, has_more } = await listVerifications({
      accountId: req.auth.accountId,
      limit: q.limit,
      ...(q.starting_after ? { startingAfter: q.starting_after } : {}),
    });
    return { object: 'list', data, has_more, url: '/v1/verifications' };
  });

  // Submitted by the mobile client. Authenticated by client_secret in the
  // request body, so it bypasses the bearer-token auth hook.
  fastify.post(
    '/v1/verifications/submit',
    { config: { public: true } },
    async (req) => {
      const body = VerificationSubmitBody.parse(req.body);
      return await submitVerification(body);
    },
  );
};
