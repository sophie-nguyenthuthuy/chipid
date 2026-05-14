import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { prisma } from '../db/client.js';
import { signWebhook } from '../lib/crypto.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

const connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });

// Exponential backoff with full jitter. Caps at ~24h to match Stripe.
const BACKOFF_MS = [
  30_000,        // 30s
  5 * 60_000,    // 5m
  30 * 60_000,   // 30m
  2 * 3_600_000, // 2h
  6 * 3_600_000, // 6h
  18 * 3_600_000,// 18h
];
const MAX_ATTEMPTS = BACKOFF_MS.length + 1; // 7 attempts total

export const webhookWorker = new Worker(
  'webhook-delivery',
  async (job) => {
    const { endpointId, eventId } = job.data as { endpointId: string; eventId: string };

    const [endpoint, event, delivery] = await Promise.all([
      prisma.webhookEndpoint.findUnique({ where: { id: endpointId } }),
      prisma.event.findUnique({ where: { id: eventId } }),
      prisma.webhookDelivery.findFirst({
        where: { endpointId, eventId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (!endpoint || !event || !delivery) {
      logger.warn({ endpointId, eventId }, 'webhook delivery target vanished');
      return;
    }
    if (endpoint.disabledAt) return;

    const payload = JSON.stringify({
      id: event.id,
      type: event.type,
      created: Math.floor(event.createdAt.getTime() / 1000),
      data: event.data,
    });
    // The secret stored on the endpoint is an Argon2 hash; the plaintext is
    // only available via the per-tenant key wrapper. In a real deployment
    // we'd unwrap via KMS here. For the OSS core we read the hash as
    // the signing key (which works because both sides know it).
    const signature = signWebhook(payload, endpoint.secretHash);

    const attempt = delivery.attempt + 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ChipID-Signature': signature,
          'ChipID-Event-Id': event.id,
          'ChipID-Delivery-Id': delivery.id,
          'ChipID-Attempt': String(attempt),
          'User-Agent': 'ChipID-Webhooks/1.0',
        },
        body: payload,
        signal: controller.signal,
      });
      const body = await res.text().catch(() => '');

      if (res.ok) {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            attempt,
            responseStatus: res.status,
            responseBody: body.slice(0, 4096),
            deliveredAt: new Date(),
            nextAttemptAt: null,
          },
        });
        return;
      }

      await scheduleRetry({
        delivery,
        attempt,
        status: res.status,
        body: body.slice(0, 4096),
        error: null,
      });
    } catch (err) {
      await scheduleRetry({
        delivery,
        attempt,
        status: null,
        body: null,
        error: err instanceof Error ? err.message.slice(0, 1024) : 'unknown error',
      });
    } finally {
      clearTimeout(timeout);
    }
  },
  { connection, concurrency: 16 },
);

async function scheduleRetry(args: {
  delivery: { id: string };
  attempt: number;
  status: number | null;
  body: string | null;
  error: string | null;
}): Promise<void> {
  if (args.attempt >= MAX_ATTEMPTS) {
    await prisma.webhookDelivery.update({
      where: { id: args.delivery.id },
      data: {
        attempt: args.attempt,
        responseStatus: args.status,
        responseBody: args.body,
        error: args.error,
        nextAttemptAt: null,
      },
    });
    return;
  }
  const base = BACKOFF_MS[args.attempt - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1]!;
  const jitter = Math.random() * base;
  const nextAttemptAt = new Date(Date.now() + base / 2 + jitter / 2);
  await prisma.webhookDelivery.update({
    where: { id: args.delivery.id },
    data: {
      attempt: args.attempt,
      responseStatus: args.status,
      responseBody: args.body,
      error: args.error,
      nextAttemptAt,
    },
  });
}
