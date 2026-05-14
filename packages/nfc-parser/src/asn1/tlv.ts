/**
 * Minimal BER-TLV walker. The full asn1js library handles the heavy lifting
 * for SOD / signed data; this helper is enough for the small fixed-shape
 * data groups (DG1, DG13).
 */

export interface Tlv {
  tag: number;
  length: number;
  value: Buffer;
  end: number;
}

export function readTlv(buf: Buffer, offset = 0): Tlv {
  if (offset >= buf.length) throw new Error('readTlv: offset past end of buffer');
  let i = offset;

  let tag = buf[i]!;
  i += 1;
  // Multi-byte tag: low 5 bits all 1 → tag continues in following bytes.
  if ((tag & 0x1f) === 0x1f) {
    let next: number;
    do {
      next = buf[i]!;
      tag = (tag << 8) | next;
      i += 1;
    } while ((next & 0x80) === 0x80);
  }

  // Length: short form (< 0x80) or long form (0x8N → N bytes of length).
  let len: number;
  const first = buf[i]!;
  i += 1;
  if (first < 0x80) {
    len = first;
  } else {
    const nBytes = first & 0x7f;
    if (nBytes === 0 || nBytes > 4) throw new Error('readTlv: unsupported length encoding');
    len = 0;
    for (let k = 0; k < nBytes; k++) {
      len = (len << 8) | buf[i + k]!;
    }
    i += nBytes;
  }

  if (i + len > buf.length) throw new Error('readTlv: length exceeds buffer');
  return { tag, length: len, value: buf.subarray(i, i + len), end: i + len };
}

/** Iterate the TLVs nested directly inside `value` (one level deep). */
export function* iterTlvs(value: Buffer): Generator<Tlv> {
  let offset = 0;
  while (offset < value.length) {
    const tlv = readTlv(value, offset);
    yield tlv;
    offset = tlv.end;
  }
}

/** First child TLV with a given tag, or null. */
export function findTag(value: Buffer, tag: number): Tlv | null {
  for (const tlv of iterTlvs(value)) {
    if (tlv.tag === tag) return tlv;
  }
  return null;
}
