# How chip verification works

A Vietnamese CCCD gắn chip embeds an ICAO 9303-compliant contactless smart card. Same standard, same protocols, same data structures as an EU biometric passport. Once you accept that frame, everything else falls out.

## What's on the chip

```
EF.COM                     – list of present DGs
EF.SOD                     – signed list of DG hashes + DSC
DG1                        – MRZ text (id number, name, DOB, sex, expiry)
DG2                        – portrait (JPEG / JPEG2000)
DG13                       – BCA-specific extension (Vietnamese name, address, ethnicity, religion)
DG14                       – Chip Authentication public key
DG15                       – Active Authentication public key
```

DG3 (fingerprints) and DG4 (iris) exist in the spec but require EAC / Terminal Authentication keys held only by the issuing state. CCCD doesn't expose them over NFC at all, so we don't try.

## Reading the chip (mobile)

1. **Establish a secure channel** — BAC (Basic Access Control) or PACE (Password-Authenticated Connection Establishment). Both derive a session key from data the user can demonstrate: either the MRZ (document number + DOB + expiry) for BAC, or the CAN (Card Access Number printed on the card) for PACE. CCCD supports both; PACE is preferred where available because it's resistant to offline brute-force.
2. **Read each Data Group** — straight `SELECT FILE` + `READ BINARY` APDUs over the secure channel.
3. **Active Authentication** — send the chip an 8-byte random challenge; the chip signs it with the DG15 private key. This is what stops chip-cloning attacks — the private key never leaves the silicon.

All of this is what `@chipid/react-native` does. It hands your code a structured blob and submits it directly to our API using the client_secret.

## Verifying the chip (server)

We never trust the mobile SDK. The server-side verification — Passive Authentication — is what actually makes a chip read trustworthy.

1. **SOD signature**. The EF.SOD is a PKCS#7 SignedData. Verify it was signed by the embedded Document Signer Certificate (DSC).
2. **DSC chains to a trusted CSCA**. The DSC must itself be signed by the Bộ Công An Country Signing CA, whose public key we ship as a trust anchor (and which is published in the ICAO PKD). Without this step, anyone with a passport-issuance-grade printer could forge a chip.
3. **Each DG hashes to the value in SOD**. The SOD declares `SHA256(DG1) = abc...`. Re-hash the bytes the chip handed us and compare. If they differ, somebody tampered.
4. **Active Auth response verifies**. The challenge-response signature must validate against DG15's public key.
5. **Document not expired**. DG1's expiration date is in the past → reject.

Only if all five pass do we publish `verification.verified`.

## What you don't get from us

We do not do **liveness detection** server-side. The mobile SDK handles face match between DG2 and a live selfie locally, and ships you the resulting confidence score. We considered moving this server-side; we don't because:

- The portrait is already cryptographically signed by the state. The interesting question is "is the person holding the phone the person on the card", which a 30KB DG2 JPEG can answer well enough with on-device CoreML / MLKit.
- Sending live faces to a third-party server is a PDPL problem most of our customers don't want to inherit.

If you want server-side liveness, plug in any provider — we don't lock you in. See [integrations/liveness.md](../guides/liveness.md).

## What about VNeID?

VNeID is the Bộ Công An mobile app that exposes a citizen's chip data via a government API. ChipID can also read VNeID via the official MISA / C06 connector — set `type: 'vneid'` instead of `chip_nfc`. We charge the same per-verification.
