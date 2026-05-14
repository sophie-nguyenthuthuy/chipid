import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';
import underPressure from '@fastify/under-pressure';
import { Redis } from 'ioredis';

import { config } from './config.js';
import { logger } from './logger.js';
import { authPlugin } from './middleware/auth.js';
import { idempotencyPlugin } from './middleware/idempotency.js';
import { registerErrorHandler } from './middleware/errorHandler.js';
import { healthRoutes } from './routes/health.js';
import { verificationRoutes } from './routes/verifications.js';
import { webhookRoutes } from './routes/webhooks.js';

export async function buildApp() {
  const app = Fastify({
    loggerInstance: logger,
    genReqId: (req) => (req.headers['x-request-id'] as string | undefined) ?? `req_${randomUUID()}`,
    requestIdHeader: 'x-request-id',
    trustProxy: true,
    bodyLimit: 5 * 1024 * 1024, // 5MB — chip dumps are well under 100KB; this is plenty
    disableRequestLogging: false,
    ajv: { customOptions: { removeAdditional: false, useDefaults: true } },
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: true, credentials: false });
  await app.register(sensible);

  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    redis: new Redis(config.REDIS_URL),
    keyGenerator: (req) => req.auth?.accountId ?? req.ip,
    addHeadersOnExceeding: { 'x-ratelimit-limit': true, 'x-ratelimit-remaining': true },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
  });

  // 503 when the event loop or memory is under pressure. Cheap reliability win.
  await app.register(underPressure, {
    maxEventLoopDelay: 1000,
    maxHeapUsedBytes: 1_500_000_000,
    maxRssBytes: 2_000_000_000,
    retryAfter: 5,
    exposeStatusRoute: false,
  });

  registerErrorHandler(app);

  await app.register(authPlugin);
  await app.register(idempotencyPlugin);

  await app.register(healthRoutes);
  await app.register(verificationRoutes);
  await app.register(webhookRoutes);

  return app;
}
