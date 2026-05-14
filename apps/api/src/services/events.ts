import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { prisma } from '../db/client.js';
import { config } from '../config.js';

const connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });

export const webhookQueue = new Queue('webhook-delivery', { connection });

/**
 * Persist an event and enqueue webhook fan-out. Single transaction so we
 * never have an event row without a delivery attempt scheduled (or vice versa).
 */
export async function enqueueEvent(args: {
  accountId: string;
  verificationId?: string;
  type: string;
  data: unknown;
}): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      accountId: args.accountId,
      disabledAt: null,
    },
  });

  const matched = endpoints.filter(
    (e) => e.enabledEvents.includes('*') || e.enabledEvents.includes(args.type),
  );

  await prisma.$transaction(async (tx) => {
    const event = await tx.event.create({
      data: {
        accountId: args.accountId,
        ...(args.verificationId ? { verificationId: args.verificationId } : {}),
        type: args.type,
        data: args.data as object,
      },
    });
    if (matched.length === 0) return;
    await tx.webhookDelivery.createMany({
      data: matched.map((endpoint) => ({
        endpointId: endpoint.id,
        eventId: event.id,
        nextAttemptAt: new Date(),
      })),
    });
    for (const endpoint of matched) {
      await webhookQueue.add(
        'deliver',
        { endpointId: endpoint.id, eventId: event.id },
        {
          attempts: 1, // BullMQ retries are handled manually so we can store
                       // each attempt's response in `webhook_deliveries`.
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      );
    }
  });
}
