import { iterTlvs, readTlv } from '../asn1/tlv.js';

/**
 * DG13 is "optional details", and on the Vietnamese CCCD this is where the
 * locally-meaningful Vietnamese name (with diacritics), the 12-digit CCCD
 * number, place of origin, and place of residence live — none of which fit
 * cleanly in the latin-only MRZ.
 *
 * The Bộ Công An / C06 layout uses a constructed sequence of context-specific
 * tags inside the outer 0x6D wrapper. We map the documented tags; unknown
 * tags are surfaced under `extras` so future schema changes don't silently
 * lose data.
 */
export interface Dg13 {
  idNumber?: string;
  oldIdNumber?: string;
  fullName?: string;
  dateOfBirth?: string; // dd/MM/yyyy as printed
  sex?: string;
  nationality?: string;
  ethnicity?: string;
  religion?: string;
  placeOfOrigin?: string;
  placeOfResidence?: string;
  personalIdentification?: string;
  extras: Record<string, string>;
}

const TAGS: Record<number, keyof Omit<Dg13, 'extras'>> = {
  0xc0: 'idNumber',
  0xc1: 'oldIdNumber',
  0xc2: 'fullName',
  0xc3: 'dateOfBirth',
  0xc4: 'sex',
  0xc5: 'nationality',
  0xc6: 'ethnicity',
  0xc7: 'religion',
  0xc8: 'placeOfOrigin',
  0xc9: 'placeOfResidence',
  0xca: 'personalIdentification',
};

export function parseDg13(buf: Buffer): Dg13 {
  const outer = readTlv(buf);
  if (outer.tag !== 0x6d) throw new Error(`DG13: unexpected outer tag 0x${outer.tag.toString(16)}`);

  const out: Dg13 = { extras: {} };
  for (const tlv of iterTlvs(outer.value)) {
    const decoded = tlv.value.toString('utf8');
    const key = TAGS[tlv.tag];
    if (key) (out as unknown as Record<string, string>)[key] = decoded;
    else out.extras[`0x${tlv.tag.toString(16)}`] = decoded;
  }
  return out;
}
