import * as asn1js from 'asn1js';
import { ContentInfo, SignedData, Certificate } from 'pkijs';

export type HashAlg = 'sha256' | 'sha384' | 'sha512' | 'sha1';

export interface Sod {
  hashAlgorithm: HashAlg;
  /** DG number → expected digest bytes per the LdsSecurityObject. */
  dataGroupHashes: Record<number, Buffer>;
  /** The signed bytes (encapsulated content) that the SOD's signature covers. */
  signedContent: Buffer;
  /** The Document Signer Certificate that signed the SOD. */
  dsc: Certificate;
  /** The full PKCS#7 SignedData parsed from EF.SOD. */
  signedData: SignedData;
}

const OID_TO_HASH: Record<string, HashAlg> = {
  '2.16.840.1.101.3.4.2.1': 'sha256',
  '2.16.840.1.101.3.4.2.2': 'sha384',
  '2.16.840.1.101.3.4.2.3': 'sha512',
  '1.3.14.3.2.26': 'sha1',
};

export function parseSod(buf: Buffer): Sod {
  // EF.SOD is APPLICATION 23 (0x77) wrapping a PKCS#7 SignedData ContentInfo.
  let parseFrom: ArrayBuffer = toArrayBuffer(buf);
  if (buf[0] === 0x77) {
    // strip outer application tag
    const inner = stripTag(buf, 0x77);
    parseFrom = toArrayBuffer(inner);
  }

  const asn1 = asn1js.fromBER(parseFrom);
  if (asn1.offset === -1) throw new Error('SOD: failed to parse outer ASN.1');
  const contentInfo = new ContentInfo({ schema: asn1.result });
  const signedData = new SignedData({ schema: contentInfo.content });

  const encap = signedData.encapContentInfo.eContent;
  if (!encap) throw new Error('SOD: missing encapsulated content');
  const signedContent = Buffer.from(encap.getValue());

  // The encapsulated content is itself an LdsSecurityObject SEQUENCE:
  //   { version, hashAlgorithm, [hashes], ... }
  const ldsAsn1 = asn1js.fromBER(toArrayBuffer(signedContent));
  if (ldsAsn1.offset === -1) throw new Error('SOD: LdsSecurityObject parse failed');
  const lds = ldsAsn1.result.valueBlock as unknown as { value: asn1js.AsnType[] };

  const hashAlgSeq = lds.value[1] as asn1js.Sequence;
  const hashAlgOid = (hashAlgSeq.valueBlock.value[0] as asn1js.ObjectIdentifier).valueBlock.toString();
  const hashAlgorithm = OID_TO_HASH[hashAlgOid];
  if (!hashAlgorithm) throw new Error(`SOD: unsupported hash OID ${hashAlgOid}`);

  const hashSet = lds.value[2] as asn1js.Sequence;
  const dataGroupHashes: Record<number, Buffer> = {};
  for (const entry of hashSet.valueBlock.value as asn1js.Sequence[]) {
    const [numNode, hashNode] = entry.valueBlock.value as [asn1js.Integer, asn1js.OctetString];
    const dgNum = Number(numNode.valueBlock.valueDec);
    dataGroupHashes[dgNum] = Buffer.from(hashNode.valueBlock.valueHexView);
  }

  const certs = (signedData.certificates ?? []).filter(
    (c): c is Certificate => c instanceof Certificate,
  );
  if (certs.length === 0) throw new Error('SOD: no Document Signer Certificate present');

  return {
    hashAlgorithm,
    dataGroupHashes,
    signedContent,
    dsc: certs[0]!,
    signedData,
  };
}

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

function stripTag(buf: Buffer, expectedTag: number): Buffer {
  if (buf[0] !== expectedTag) throw new Error(`expected tag 0x${expectedTag.toString(16)}`);
  let i = 1;
  const first = buf[i]!;
  i += 1;
  let len: number;
  if (first < 0x80) len = first;
  else {
    const n = first & 0x7f;
    len = 0;
    for (let k = 0; k < n; k++) len = (len << 8) | buf[i + k]!;
    i += n;
  }
  return buf.subarray(i, i + len);
}
