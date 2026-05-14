import { describe, it, expect } from 'vitest';
import { readTlv, iterTlvs, findTag } from '../src/asn1/tlv.js';

describe('readTlv', () => {
  it('reads short-form length', () => {
    const buf = Buffer.from([0x30, 0x03, 0x01, 0x02, 0x03]);
    const tlv = readTlv(buf);
    expect(tlv.tag).toBe(0x30);
    expect(tlv.length).toBe(3);
    expect(tlv.value).toEqual(Buffer.from([0x01, 0x02, 0x03]));
    expect(tlv.end).toBe(5);
  });

  it('reads long-form length (1 byte)', () => {
    const value = Buffer.alloc(200, 0xaa);
    const buf = Buffer.concat([Buffer.from([0x04, 0x81, 0xc8]), value]);
    const tlv = readTlv(buf);
    expect(tlv.length).toBe(200);
    expect(tlv.value.length).toBe(200);
  });

  it('reads multi-byte tag (0x5F1F)', () => {
    const buf = Buffer.from([0x5f, 0x1f, 0x02, 0xab, 0xcd]);
    const tlv = readTlv(buf);
    expect(tlv.tag).toBe(0x5f1f);
    expect(tlv.value).toEqual(Buffer.from([0xab, 0xcd]));
  });

  it('throws when length exceeds buffer', () => {
    const buf = Buffer.from([0x30, 0x10, 0x00]);
    expect(() => readTlv(buf)).toThrow(/length exceeds/);
  });
});

describe('iterTlvs / findTag', () => {
  it('iterates siblings and finds tags', () => {
    const buf = Buffer.from([0x80, 0x01, 0xaa, 0x81, 0x02, 0xbb, 0xcc]);
    const tags = [...iterTlvs(buf)].map((t) => t.tag);
    expect(tags).toEqual([0x80, 0x81]);
    expect(findTag(buf, 0x81)?.value).toEqual(Buffer.from([0xbb, 0xcc]));
    expect(findTag(buf, 0x99)).toBeNull();
  });
});
