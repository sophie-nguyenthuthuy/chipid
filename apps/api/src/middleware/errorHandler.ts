import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { ApiError } from '../lib/errors.js';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err, req, reply) => {
    const requestId = req.id;

    if (err instanceof ApiError) {
      reply.status(err.statusCode).send(err.toJSON(requestId));
      return;
    }

    if (err instanceof ZodError) {
      const first = err.issues[0];
      const apiErr = new ApiError(
        'parameter_invalid',
        first ? `${first.message} (at ${first.path.join('.') || 'body'})` : 'Invalid request.',
        first ? { param: first.path.join('.') || undefined } : {},
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
