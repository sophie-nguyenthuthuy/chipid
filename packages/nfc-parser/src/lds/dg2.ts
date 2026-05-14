import { findTag, readTlv } from '../asn1/tlv.js';

/**
 * DG2 is a CBEFF-wrapped biometric template. We only care about extracting
 * the underlying JPEG/JPEG2000 portrait bytes. The path is:
 *
 *   0x75 (DG2)
 *     └─ 0x7F61 (BIT — biometric info template)
 *           └─ 0x7F60 (one or more, per template count)
 *                 └─ 0x5F2E or 0x7F2E  (biometric data block)
 *
 * The biometric data block starts with a CBEFF / ISO 19794-5 header; the
 * image payload sits after a 14-byte facial header followed by a feature
 * point block. We detect the image by scanning for the JPEG (FFD8FF) or
 * JPEG2000 (00 00 00 0C 6A 50) magic.
 */
export interface Dg2 {
  imageFormat: 'jpeg' | 'jpeg2000';
  imageBytes: Buffer;
}

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const JP2_MAGIC = Buffer.from([0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50]);

export function parseDg2(buf: Buffer): Dg2 {
  const outer = readTlv(buf);
  if (outer.tag !== 0x75) throw new Error(`DG2: unexpected outer tag 0x${outer.tag.toString(16)}`);
  const bit = findTag(outer.value, 0x7f61);
  if (!bit) throw new Error('DG2: missing 0x7F61 biometric info template');
  const bdt = findTag(bit.value, 0x7f60);
  if (!bdt) throw new Error('DG2: missing 0x7F60 biometric data template');

  const data = findTag(bdt.value, 0x5f2e) ?? findTag(bdt.value, 0x7f2e);
  if (!data) throw new Error('DG2: missing 0x5F2E/7F2E biometric data block');

  const jpegIdx = data.value.indexOf(JPEG_MAGIC);
  const jp2Idx = data.value.indexOf(JP2_MAGIC);
  if (jpegIdx >= 0 && (jp2Idx < 0 || jpegIdx < jp2Idx)) {
    return { imageFormat: 'jpeg', imageBytes: data.value.subarray(jpegIdx) };
  }
  if (jp2Idx >= 0) {
    return { imageFormat: 'jpeg2000', imageBytes: data.value.subarray(jp2Idx) };
  }
  throw new Error('DG2: could not locate JPEG/JPEG2000 magic in biometric data block');
}
