/**
 * Active Authentication defends against chip cloning: the terminal sends an
 * 8-byte challenge, the chip signs it with the private key paired to DG15's
 * public key. We just verify that signature.
 *
 * Vietnamese CCCD chips emit ECDSA over secp256r1 in practice; we accept any
 * algorithm declared in DG15's SubjectPublicKeyInfo.
 *
 * NOTE: the *challenge* the terminal sent must be re-supplied on the server
 * side. We accept it as the leading bytes of `response` (challenge || sig),
 * which is what `@chipid/react-native` serializes.
 */

export interface ActiveAuthInput {
  dg15: Buffer;
  response: Buffer; // challenge (8 bytes) || signature
}

export async function verifyActiveAuth(_: ActiveAuthInput): Promise<boolean> {
  // Real implementation: parse DG15 → SubjectPublicKeyInfo, import key
  // with crypto.subtle.importKey, verify(response.slice(8), challenge).
  // Stubbed until we wire fixtures; the verify() path returns `false` so
  // callers don't accidentally green-light an unverified chip in production.
  return false;
}
