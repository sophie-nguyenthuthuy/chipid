# @chipid/nfc-parser

Pure-TS implementation of the bits of ICAO Doc 9303 needed to verify a Vietnamese CCCD chip dump server-side:

- ASN.1 / BER-TLV decoding of the Logical Data Structure (LDS).
- DG1 (MRZ), DG2 (face), DG13 (CCCD-specific extension fields), DG14 (chip auth pubkey), DG15 (active auth pubkey) parsers.
- EF.SOD parsing → `SignedData` validation, hash-list comparison against the read DGs.
- Passive Authentication: verify the Document Signer Certificate chains to a trusted Country Signing CA (BCA root), and that its signature over the SOD verifies.
- Active Authentication: challenge/response verification using DG15's pubkey to defend against cloned chips.

The chip *reading* itself (BAC/PACE, APDU exchange) happens on the mobile side — see `@chipid/react-native`. This package only operates on the raw bytes produced by a successful read.

## Scope, deliberately

We do *not* implement EAC/Terminal Authentication, because CCCD does not protect DG2 with EAC — the portrait sits behind BAC/PACE only. If that changes in a future BCA spec, we'll add it.

We do *not* extract MRZ fields from the printed face of the card. That's an OCR concern handled elsewhere.

## API

```ts
import { verifyChipDump } from '@chipid/nfc-parser';

const result = await verifyChipDump({
  sod: sodBytes,                 // EF.SOD raw bytes
  dataGroups: { 1: dg1, 2: dg2, 13: dg13, 14: dg14, 15: dg15 },
  activeAuthResponse: aaResp,    // optional
  cscaTrustAnchors: [bcaRootPem],// PEM strings or already-loaded certs
});

if (result.ok) {
  console.log(result.subject.fullName, result.subject.idNumber);
} else {
  console.log(result.failureCode, result.message);
}
```

The result `failureCode` values are the same enum as the API surface — `passive_auth_failed`, `csca_chain_failed`, `data_group_hash_mismatch`, `chip_clone_suspected`, `document_expired`.
