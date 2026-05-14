import { randomBytes } from 'node:crypto';

// Stripe-style prefixed IDs. The body is Crockford base32 — case-insensitive,
// no I/L/O/U, so they're safer to read aloud than UUIDs.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function crockford(byteLen: number): string {
  const bytes = randomBytes(byteLen);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % 32];
  return out;
}

export const id = {
  verification: () => `ver_${crockford(20)}`,
  event: () => `evt_${crockford(20)}`,
  apiKey: () => `key_${crockford(20)}`,
  webhookEndpoint: () => `whe_${crockford(20)}`,
  webhookDelivery: () => `whd_${crockford(20)}`,
  account: () => `acct_${crockford(20)}`,
  // The client secret looks like cs_test_xxxx / cs_live_xxxx; never persisted
  // in plaintext — only its HMAC lookup hash lands in the DB.
  clientSecret: (env: 'test' | 'live') => `cs_${env}_${crockford(40).toLowerCase()}`,
};
