import type { FastifyError } from 'fastify';
import { ZodError } from 'zod';
import { ApiError } from '../lib/errors.js';

/**
 * Shape we need to register error / 404 handlers. We don't bind to a precise
 * Fastify generic — the instance's generic varies with each plugin or option,
 * and chasing it does not catch real bugs.
 */
interface ErrorHandlerHost {
  setErrorHandler(handler: (err: FastifyError, req: HandlerReq, reply: HandlerReply) => void): unknown;
  setNotFoundHandler(handler: (req: HandlerReq, reply: HandlerReply) => void): unknown;
}

interface HandlerReq {
  id: string;
  method: string;
  url: string;
  log: { error: (...args: unknown[]) => void };
}

interface HandlerReply {
  status(code: number): { send(payload: unknown): unknown };
}

export function registerErrorHandler(app: ErrorHandlerHost): void {
  app.setErrorHandler((err: FastifyError, req, reply) => {
    const requestId = req.id;

    if (err instanceof ApiError) {
      reply.status(err.statusCode).send(err.toJSON(requestId));
      return;
    }

    if (err instanceof ZodError) {
      const first = err.issues[0];
      const param = first?.path.join('.') || undefined;
      const apiErr = new ApiError(
        'parameter_invalid',
        first ? `${first.message} (at ${param ?? 'body'})` : 'Invalid request.',
        param ? { param } : {},
      );
      reply.status(apiErr.statusCode).send(apiErr.toJSON(requestId));
      return;
    }

    // Fastify's built-in 4xx (validation, malformed JSON, etc.)
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      const apiErr = new ApiError('parameter_invalid', err.message);
      reply.status(apiErr.statusCode).send(apiErr.toJSON(requestId));
      return;
    }

    req.log.error({ err, requestId }, 'unhandled error');
    const apiErr = new ApiError('api_error', 'An unexpected error occurred.');
    reply.status(apiErr.statusCode).send(apiErr.toJSON(requestId));
  });

  app.setNotFoundHandler((req, reply) => {
    const apiErr = new ApiError('resource_missing', `Unknown route: ${req.method} ${req.url}.`);
    reply.status(apiErr.statusCode).send(apiErr.toJSON(req.id));
  });
}
