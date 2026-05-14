import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import argon2 from 'argon2';
import { config } from '../config.js';

/**
 * HMAC lookup hash. Deterministic from the input, so we can index a secret
 * for O(1) DB lookup without ever storing the secret itself. Keyed off
 * ROOT_SECRET so a leaked database is not enough to brute-force the keys.
 */
export function lookupHash(input: string, scope: string): string {
  return createHmac('sha256', `${config.ROOT_SECRET}:${scope}`).update(input).digest('hex');
}

/**
 * Argon2id verification hash. Use for the "is this the real secret" check
 * after we've located the row by lookupHash.
 */
export async function hashSecret(secret: string): Promise<string> {
  return argon2.hash(secret, {
    type: argon2.argon2id,
    memoryCost: 19_456, // 19 MiB — OWASP 2023 recommendation
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifySecret(hash: string, secret: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, secret);
  } catch {
    return false;
  }
}

export function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Signs a webhook payload with a per-endpoint HMAC secret. Format mirrors
 * Stripe-Signature: `t=<unix>,v1=<hex>`. Verifying clients reject anything
 * with skew > 5 minutes.
 */
export function signWebhook(payload: string, secret: string, timestamp = Date.now()): string {
  const t = Math.floor(timestamp / 1000);
  const sig = createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
  return `t=${t},v1=${sig}`;
}

export function randomSecret(byteLen = 32): string {
  return randomBytes(byteLen).toString('base64url');
}
