import { pino } from 'pino';
import { config } from './config.js';

export const logger = pino({
  level: config.LOG_LEVEL,
  base: { service: 'chipid-api', env: config.NODE_ENV },
  redact: {
    // Never log these — bearer tokens, client secrets, raw chip dumps, PII.
    paths: [
      'req.headers.authorization',
      'req.headers["idempotency-key"]',
      '*.secret',
      '*.client_secret',
      '*.rawSod',
      '*.dataGroups',
      '*.idNumber',
      '*.fullName',
      '*.dateOfBirth',
    ],
    censor: '[REDACTED]',
  },
  ...(config.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty', options: { colorize: true, singleLine: false } } }
    : {}),
});
