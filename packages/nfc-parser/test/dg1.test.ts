import { describe, it, expect } from 'vitest';
import { parseDg1 } from '../src/lds/dg1.js';

// Synthetic TD1 MRZ for a 1990-01-15 male, exp 2032-06-20, VN nationality.
// Real chips' DG1 wraps this in 0x61 / 0x5F1F TLVs.
function buildDg1(mrz: string): Buffer {
  if (mrz.length !== 90) throw new Error('test mrz must be 90 chars');
  const mrzBytes = Buffer.from(mrz, 'latin1');
  // 0x5F1F + length (90 = 0x5A)
  const inner = Buffer.concat([Buffer.from([0x5f, 0x1f, 90]), mrzBytes]);
  // 0x61 wraps inner; length is len(inner) which is 3 + 90 = 93
  return Buffer.concat([Buffer.from([0x61, inner.length]), inner]);
}

describe('parseDg1', () => {
  it('decodes a well-formed TD1 MRZ', () => {
    const mrz =
      'IDVNM123456789<<<<<<<<<<<<<<<' + '\n'.replace(/\n/, '<') +
      // wait — must be exactly 30/line. Let's compose precisely.
      '';
    const line1 = 'IDVNM123456789<<<<<<<<<<<<<<<<'; // 30
    const line2 = '9001151M3206207VNM<<<<<<<<<<<4'; // 30 (checksum filler)
    const line3 = 'NGUYEN<VAN<AN<<<<<<<<<<<<<<<<<'; // 30
    const full = line1 + line2 + line3;
    expect(full.length).toBe(90);

    const dg1 = parseDg1(buildDg1(full));
    expect(dg1.documentCode).toBe('ID');
    expect(dg1.issuingState).toBe('VNM');
    expect(dg1.documentNumber).toBe('123456789');
    expect(dg1.sex).toBe('M');
    expect(dg1.nationality).toBe('VNM');
    expect(dg1.dateOfBirth.toISOString().slice(0, 10)).toBe('1990-01-15');
    expect(dg1.expirationDate?.toISOString().slice(0, 10)).toBe('2032-06-20');
    expect(dg1.holderName).toBe('NGUYEN VAN AN');
  });

  it('rejects MRZ of the wrong length', () => {
    const short = 'A'.repeat(60);
    expect(() => parseDg1(buildDg1(short.padEnd(90, '<')))).not.toThrow();
    // wrong outer tag
    expect(() => parseDg1(Buffer.from([0x60, 0]))).toThrow(/DG1/);
  });
});
