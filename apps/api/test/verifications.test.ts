import { describe, it, expect } from 'vitest';
import { id } from '../src/lib/ids.js';
import { signWebhook, constantTimeEqual } from '../src/lib/crypto.js';

describe('id generation', () => {
  it('mints prefixed IDs', () => {
    expect(id.verification()).toMatch(/^ver_[0-9A-HJ-NP-TV-Z]{20}$/);
    expect(id.clientSecret('test')).toMatch(/^cs_test_[0-9a-hj-np-tv-z]{40}$/);
    expect(id.clientSecret('live')).toMatch(/^cs_live_[0-9a-hj-np-tv-z]{40}$/);
  });

  it('does not collide across many draws', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(id.verification());
    expect(seen.size).toBe(5000);
  });
});

describe('webhook signature', () => {
  it('produces the documented t=...,v1=... format', () => {
    const sig = signWebhook('{}', 'whsec_xxx', 1_700_000_000_000);
    expect(sig).toMatch(/^t=1700000000,v1=[a-f0-9]{64}$/);
  });

  it('is deterministic for the same inputs', () => {
    const a = signWebhook('hello', 'k', 1_700_000_000_000);
    const b = signWebhook('hello', 'k', 1_700_000_000_000);
    expect(a).toBe(b);
  });
});

describe('constantTimeEqual', () => {
  it('matches equal strings', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
  });
  it('rejects different lengths', () => {
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });
  it('rejects same-length mismatches', () => {
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
  });
});
