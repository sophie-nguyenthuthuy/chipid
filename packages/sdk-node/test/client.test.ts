import { describe, it, expect, vi } from 'vitest';
import { ChipID, ChipIDError, verifyWebhookSignature } from '../src/index.js';
import { createHmac } from 'node:crypto';

function mockOk(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function mockErr(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('ChipID client', () => {
  it('requires an API key', () => {
    expect(() => new ChipID(undefined, { apiKey: '' })).toThrow(/API key/);
  });

  it('creates a verification with bearer auth and idempotency key', async () => {
    const fetcher = vi.fn(async (_url, init) => {
      const headers = init?.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer sk_test_xxx');
      expect(headers['Idempotency-Key']).toMatch(/^chipid-node:/);
      return mockOk({ id: 'ver_1', object: 'verification', type: 'chip_nfc', status: 'requires_input' });
    }) as unknown as typeof fetch;

    const chipid = new ChipID('sk_test_xxx', { fetch: fetcher });
    const v = await chipid.verifications.create({ type: 'chip_nfc' });
    expect(v.id).toBe('ver_1');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('throws a typed ChipIDError on 4xx', async () => {
    const fetcher = (async () =>
      mockErr(401, {
        error: {
          type: 'authentication_error',
          code: 'invalid_api_key',
          message: 'Invalid API key.',
          request_id: 'req_abc',
        },
      })) as unknown as typeof fetch;

    const chipid = new ChipID('sk_test_xxx', { fetch: fetcher });
    await expect(chipid.verifications.retrieve('ver_x')).rejects.toMatchObject({
      name: 'ChipIDError',
      code: 'invalid_api_key',
      statusCode: 401,
      requestId: 'req_abc',
    });
  });

  it('retries 5xx responses', async () => {
    let calls = 0;
    const fetcher = (async () => {
      calls += 1;
      if (calls < 3) return mockErr(503, { error: { type: 'api_error', code: 'api_error', message: '' } });
      return mockOk({ id: 'ver_2', object: 'verification', type: 'chip_nfc', status: 'requires_input' });
    }) as unknown as typeof fetch;

    const chipid = new ChipID('sk_test_xxx', { fetch: fetcher, maxRetries: 2 });
    const v = await chipid.verifications.create({ type: 'chip_nfc' });
    expect(v.id).toBe('ver_2');
    expect(calls).toBe(3);
  });
});

describe('verifyWebhookSignature', () => {
  const secret = 'whsec_test';
  const event = { id: 'evt_1', type: 'verification.verified', created: 1, data: {} };

  it('accepts a valid signature', () => {
    const payload = JSON.stringify(event);
    const t = Math.floor(Date.now() / 1000);
    const v1 = createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
    const header = `t=${t},v1=${v1}`;
    expect(verifyWebhookSignature({ payload, header, secret })).toEqual(event);
  });

  it('rejects a tampered payload', () => {
    const payload = JSON.stringify(event);
    const t = Math.floor(Date.now() / 1000);
    const v1 = createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
    const header = `t=${t},v1=${v1}`;
    expect(() =>
      verifyWebhookSignature({ payload: payload.replace('verified', 'failed'), header, secret }),
    ).toThrow(ChipIDError);
  });

  it('rejects a too-old timestamp', () => {
    const payload = JSON.stringify(event);
    const t = Math.floor(Date.now() / 1000) - 10_000;
    const v1 = createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
    const header = `t=${t},v1=${v1}`;
    expect(() => verifyWebhookSignature({ payload, header, secret })).toThrow(/outside tolerance/);
  });
});
