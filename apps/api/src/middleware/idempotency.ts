import { createHash } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { prisma } from '../db/client.js';
import { ApiError } from '../lib/errors.js';

/**
 * Stripe-compatible idempotency:
 *
 * - Only honored on POST.
 * - Key is scoped to (accountId, key).
 * - If a stored response exists for the same key:
 *     - same request body hash → replay the stored response byte-for-byte.
 *     - different body hash    → 409 idempotency_mismatch.
 * - TTL: 24h. Older keys are GC'd by a daily job.
 */
export const idempotencyPlugin: FastifyPluginAsync = fp(async (fastify) => {
  const TTL_HOURS = 24;

  fastify.addHook('preHandler', async (req, reply) => {
    if (req.method !== 'POST') return;
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || key.length === 0) return;
    if (key.length > 255) {
      throw new ApiError('parameter_invalid', 'Idempotency-Key exceeds 255 characters.');
    }
    if (!req.auth) return; // auth runs first; if it didn't, we're public

    const requestHash = hashRequest(req.method, req.url, req.body);
    const existing = await prisma.idempotencyKey.findUnique({
      where: { accountId_key: { accountId: req.auth.accountId, key } },
    });

    if (existing) {
      if (existing.expiresAt < new Date()) {
        await prisma.idempotencyKey.delete({
          where: { accountId_key: { accountId: req.auth.accountId, key } },
        });
      } else if (existing.requestHash !== requestHash) {
        throw new ApiError(
          'idempotency_mismatch',
          'This Idempotency-Key was previously used with a different request body.',
        );
      } else {
        const headers = existing.responseHeaders as Record<string, string>;
        for (const [k, v] of Object.entries(headers)) reply.header(k, v);
        reply.header('Idempotent-Replay', 'true');
        reply.status(existing.responseStatus).send(existing.responseBody);
        return;
      }
    }

    // Store the response after the route handler runs.
    reply.raw.once('finish', () => {
      void persist({
        accountId: req.auth!.accountId,
        key,
        requestHash,
        status: reply.statusCode,
        body: (reply as unknown as { _chipidBody?: Buffer })._chipidBody ?? Buffer.alloc(0),
        headers: filterHeaders(reply.getHeaders()),
        ttlHours: TTL_HOURS,
      });
    });
  });

  // Capture the response body so we can replay it. Fastify's `onSend` lets us
  // peek at the payload before it's serialized to the wire.
  fastify.addHook('onSend', async (req, reply, payload) => {
    if (req.method !== 'POST' || !req.headers['idempotency-key']) return payload;
    const buf =
      typeof payload === 'string' ? Buffer.from(payload) :
      Buffer.isBuffer(payload) ? payload :
      Buffer.from(JSON.stringify(payload));
    (reply as unknown as { _chipidBody?: Buffer })._chipidBody = buf;
    return payload;
  });
});

function hashRequest(method: string, url: string, body: unknown): string {
  return createHash('sha256')
    .update(method)
    .update('\n')
    .update(url)
    .update('\n')
    .update(typeof body === 'string' ? body : JSON.stringify(body ?? null))
    .digest('hex');
}

function filterHeaders(headers: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (k.startsWith('x-ratelimit-') || k === 'content-type') {
      if (typeof v === 'string' || typeof v === 'number') out[k] = String(v);
    }
  }
  return out;
}

async function persist(args: {
  accountId: string;
  key: string;
  requestHash: string;
  status: number;
  body: Buffer;
  headers: Record<string, string>;
  ttlHours: number;
}): Promise<void> {
  try {
    await prisma.idempotencyKey.create({
      data: {
        accountId: args.accountId,
        key: args.key,
        requestHash: args.requestHash,
        responseStatus: args.status,
        responseBody: args.body,
        responseHeaders: args.headers,
        expiresAt: new Date(Date.now() + args.ttlHours * 3600 * 1000),
      },
    });
  } catch {
    // Race: a concurrent request landed the same key first. That's fine —
    // the next replay will hit their row.
  }
}
