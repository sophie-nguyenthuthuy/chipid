import { createHash } from 'node:crypto';
import { parseDg1, type Dg1 } from './lds/dg1.js';
import { parseDg13, type Dg13 } from './lds/dg13.js';
import { parseSod, type Sod } from './lds/sod.js';
import { verifySodSignature, verifyDscChain } from './passive-auth/passive.js';
import { verifyActiveAuth } from './protocols/activeAuth.js';

export type FailureCode =
  | 'passive_auth_failed'
  | 'csca_chain_failed'
  | 'data_group_hash_mismatch'
  | 'chip_clone_suspected'
  | 'document_expired';

export interface Subject {
  fullName: string;
  dateOfBirth: Date;
  sex: string;
  nationality: string;
  idNumber: string;
  idExpiresAt: Date | null;
}

export interface VerifySuccess {
  ok: true;
  subject: Subject;
  // Each DG hash we matched, for audit log.
  matchedDataGroups: number[];
}

export interface VerifyFailure {
  ok: false;
  failureCode: FailureCode;
  message: string;
}

export type VerifyResult = VerifySuccess | VerifyFailure;

export interface VerifyInput {
  sod: Buffer;
  dataGroups: Record<number, Buffer>;
  /** DG15 active-auth response (8-byte challenge → signature). */
  activeAuthResponse?: Buffer;
  /** PEM-encoded CSCA roots. Defaults to the env-configured trust store. */
  cscaTrustAnchors?: readonly string[];
  /** Override "now" for testing. */
  now?: Date;
}

export async function verifyChipDump(input: VerifyInput): Promise<VerifyResult> {
  const sod: Sod = parseSod(input.sod);

  // 1. SOD signature must verify against the embedded Document Signer Cert.
  const sodOk = await verifySodSignature(sod);
  if (!sodOk) {
    return { ok: false, failureCode: 'passive_auth_failed', message: 'SOD signature did not verify.' };
  }

  // 2. The DSC itself must chain to a trusted CSCA root.
  const chainOk = await verifyDscChain(sod.dsc, input.cscaTrustAnchors ?? []);
  if (!chainOk) {
    return {
      ok: false,
      failureCode: 'csca_chain_failed',
      message: 'Document Signer Certificate did not chain to a trusted CSCA anchor.',
    };
  }

  // 3. Every DG we received must hash to the value listed in the SOD.
  for (const [num, bytes] of Object.entries(input.dataGroups)) {
    const dg = Number(num);
    const expected = sod.dataGroupHashes[dg];
    if (!expected) {
      return {
        ok: false,
        failureCode: 'data_group_hash_mismatch',
        message: `DG${dg} was supplied but not listed in the SOD.`,
      };
    }
    const actual = createHash(sod.hashAlgorithm).update(bytes).digest();
    if (!actual.equals(expected)) {
      return {
        ok: false,
        failureCode: 'data_group_hash_mismatch',
        message: `DG${dg} hash did not match SOD entry.`,
      };
    }
  }

  // 4. Active Authentication, if DG15 + response are present.
  const dg15 = input.dataGroups[15];
  if (dg15 && input.activeAuthResponse) {
    const aaOk = await verifyActiveAuth({ dg15, response: input.activeAuthResponse });
    if (!aaOk) {
      return {
        ok: false,
        failureCode: 'chip_clone_suspected',
        message: 'Active Authentication failed; chip may be cloned.',
      };
    }
  }

  // 5. Extract subject from DG1 + DG13.
  const dg1Bytes = input.dataGroups[1];
  if (!dg1Bytes) {
    return {
      ok: false,
      failureCode: 'data_group_hash_mismatch',
      message: 'DG1 is required to extract subject identity.',
    };
  }
  const dg1: Dg1 = parseDg1(dg1Bytes);
  const dg13Bytes = input.dataGroups[13];
  const dg13: Dg13 | null = dg13Bytes ? parseDg13(dg13Bytes) : null;

  const now = input.now ?? new Date();
  if (dg1.expirationDate && dg1.expirationDate < now) {
    return { ok: false, failureCode: 'document_expired', message: 'CCCD has expired.' };
  }

  const subject: Subject = {
    fullName: dg13?.fullName ?? dg1.holderName,
    dateOfBirth: dg1.dateOfBirth,
    sex: dg1.sex,
    nationality: dg1.nationality,
    idNumber: dg13?.idNumber ?? dg1.documentNumber,
    idExpiresAt: dg1.expirationDate,
  };

  return {
    ok: true,
    subject,
    matchedDataGroups: Object.keys(input.dataGroups).map(Number).sort((a, b) => a - b),
  };
}
