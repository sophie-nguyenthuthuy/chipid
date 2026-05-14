import { readTlv } from '../asn1/tlv.js';

/**
 * DG1 wraps the MRZ (Machine Readable Zone). For TD1-format documents
 * (3 lines × 30 chars, which is what CCCD uses), the layout is fixed.
 *
 *   Line 1: I<VNM<<<idNumber  (5 + 9 = 14, padded to 30)
 *   Line 2: YYMMDD<sex<YYMMDD<VNM<<<<<<<<<<<chk
 *   Line 3: holderName surname<<given<<...
 *
 * Reference: ICAO Doc 9303 Part 5.
 */
export interface Dg1 {
  documentCode: string;
  issuingState: string;
  documentNumber: string;
  dateOfBirth: Date;
  sex: string;
  expirationDate: Date | null;
  nationality: string;
  holderName: string;
  rawMrz: string;
}

export function parseDg1(buf: Buffer): Dg1 {
  // Outer tag is 0x61 (DG1); inner 0x5F1F holds the MRZ as ISO 8859-1 text.
  const outer = readTlv(buf);
  if (outer.tag !== 0x61) throw new Error(`DG1: unexpected outer tag 0x${outer.tag.toString(16)}`);

  // Inner 0x5F1F — long-form tag, so the parser yields 0x5F1F as a single int.
  let inner = readTlv(outer.value);
  if (inner.tag !== 0x5f1f) {
    // Some chips wrap inner content in an extra constructed TLV.
    inner = readTlv(inner.value);
    if (inner.tag !== 0x5f1f) throw new Error('DG1: missing 0x5F1F MRZ field');
  }

  const mrz = inner.value.toString('latin1');
  if (mrz.length !== 90) throw new Error(`DG1: expected 90 chars of TD1 MRZ, got ${mrz.length}`);

  const line1 = mrz.slice(0, 30);
  const line2 = mrz.slice(30, 60);
  const line3 = mrz.slice(60, 90);

  return {
    rawMrz: mrz,
    documentCode: line1.slice(0, 2).replace(/<+$/, ''),
    issuingState: line1.slice(2, 5),
    documentNumber: line1.slice(5, 14).replace(/<+$/, ''),
    dateOfBirth: parseMrzDate(line2.slice(0, 6))!,
    sex: line2.slice(7, 8),
    expirationDate: parseMrzDate(line2.slice(8, 14)),
    nationality: line2.slice(15, 18),
    holderName: line3.replace(/<+/g, ' ').trim(),
  };
}

function parseMrzDate(yymmdd: string): Date | null {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const yy = Number(yymmdd.slice(0, 2));
  const mm = Number(yymmdd.slice(2, 4));
  const dd = Number(yymmdd.slice(4, 6));
  // MRZ years are 2-digit; ICAO rule: <= current 2-digit year + 30 → 20xx,
  // else 19xx. Good enough through ~2055.
  const currentYY = new Date().getFullYear() % 100;
  const century = yy <= currentYY + 30 ? 2000 : 1900;
  return new Date(Date.UTC(century + yy, mm - 1, dd));
}
