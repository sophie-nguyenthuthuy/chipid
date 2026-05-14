import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { prisma } from '../db/client.js';
import { ApiError } from '../lib/errors.js';
import { lookupHash, verifySecret } from '../lib/crypto.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth: {
      accountId: string;
      keyId: string;
      environment: 'test' | 'live';
    };
  }
}

/**
 * Parses `Authorization: Bearer sk_(test|live)_xxxx` and resolves it to an
 * (accountId, environment) pair. Two-step lookup: HMAC index to find the row,
 * Argon2 to verify the secret half. Constant work regardless of which step
 * fails so we don't leak whether the prefix exists.
 */
async function authenticate(req: FastifyRequest): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new ApiError('authentication_required', 'Missing or malformed Authorization header.');
  }
  const presented = header.slice('Bearer '.length).trim();

  // Accept sk_test_... and sk_live_...
  const m = /^sk_(test|live)_([A-Za-z0-9]+)$/.exec(presented);
  if (!m) throw new ApiError('invalid_api_key', 'API key is malformed.');
  const environment = m[1] as 'test' | 'live';

  const hash = lookupHash(presented, 'api_key');
  const key = await prisma.apiKey.findUnique({ where: { lookupHash: hash } });

  // Run the Argon2 verify even when we didn't find a row, to flatten timing.
  const ok = key
    ? await verifySecret(key.secretHash, presented)
    : await verifySecret('$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAA', presented);

  if (!key || !ok || key.revokedAt) {
    throw new ApiError('invalid_api_key', 'Invalid API key provided.');
  }
  if (key.environment !== environment) {
    throw new ApiError('invalid_api_key', 'API key prefix and environment do not match.');
  }

  // Best-effort last-used touch. We don't await — a slow DB shouldn't slow
  // every request, and losing a write here is fine.
  void prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  req.auth = { accountId: key.accountId, keyId: key.id, environment };
}

export const authPlugin: FastifyPluginAsync = fp(async (fastify) => {
  fastify.decorateRequest('auth', null as never);
  fastify.addHook('onRequest', async (req) => {
    // Public endpoints opt out via routeOptions.config.public.
    if (req.routeOptions.config && (req.routeOptions.config as { public?: boolean }).public) return;
    await authenticate(req);
  });
});
