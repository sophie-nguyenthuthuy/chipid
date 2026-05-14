import { createHmac, timingSafeEqual } from 'node:crypto';
import { ChipIDError } from './error.js';
import type { WebhookEvent } from './types.js';

export interface VerifyWebhookOptions {
  /** Raw request body bytes (NOT the parsed JSON). */
  payload: string | Buffer;
  /** Value of the `ChipID-Signature` header. */
  header: string;
  /** Webhook secret (whsec_…) from the dashboard. */
  secret: string;
  /** Allowed clock skew in seconds. Default 300 (5 minutes). */
  toleranceSeconds?: number;
}

/**
 * Verifies a ChipID webhook signature. Throws ChipIDError on mismatch.
 * Returns the parsed event on success.
 *
 * Signature header format: `t=<unix>,v1=<hex>`
 */
export function verifyWebhookSignature<T = unknown>(opts: VerifyWebhookOptions): WebhookEvent<T> {
  const parsed = parseHeader(opts.header);
  const tolerance = opts.toleranceSeconds ?? 300;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - parsed.t) > tolerance) {
    throw new ChipIDError(400, {
      type: 'invalid_request_error',
      code: 'webhook_signature_expired',
      message: `Webhook timestamp outside tolerance window (${tolerance}s).`,
    });
  }

  const payload = typeof opts.payload === 'string' ? opts.payload : opts.payload.toString('utf8');
  const expected = createHmac('sha256', opts.secret).update(`${parsed.t}.${payload}`).digest('hex');

  const expectedBuf = Buffer.from(expected);
  const presentedBuf = Buffer.from(parsed.v1);
  if (expectedBuf.length !== presentedBuf.length || !timingSafeEqual(expectedBuf, presentedBuf)) {
    throw new ChipIDError(400, {
      type: 'invalid_request_error',
      code: 'webhook_signature_mismatch',
      message: 'Webhook signature did not match expected value.',
    });
  }
  return JSON.parse(payload) as WebhookEvent<T>;
}

function parseHeader(header: string): { t: number; v1: string } {
  const parts = header.split(',').map((s) => s.trim());
  let t = 0;
  let v1 = '';
  for (const p of parts) {
    const [k, v] = p.split('=', 2);
    if (k === 't' && v) t = Number(v);
    else if (k === 'v1' && v) v1 = v;
  }
  if (!t || !v1) {
    throw new ChipIDError(400, {
      type: 'invalid_request_error',
      code: 'webhook_signature_malformed',
      message: 'Malformed ChipID-Signature header.',
    });
  }
  return { t, v1 };
}
