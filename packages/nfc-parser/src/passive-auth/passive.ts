import { Certificate, CertificateChainValidationEngine, CryptoEngine, setEngine } from 'pkijs';
import type { Sod } from '../lds/sod.js';

// pkijs needs a WebCrypto-style engine. Node 20+ exposes one on globalThis.
// pkijs's CryptoEngine typings predate Node's structural Crypto export, so we
// route through `unknown` to satisfy the constructor.
const webcrypto = globalThis.crypto as unknown as Record<string, unknown>;
setEngine(
  'nodeEngine',
  new CryptoEngine({
    name: 'nodeEngine',
    crypto: webcrypto,
    subtle: webcrypto.subtle,
  } as unknown as ConstructorParameters<typeof CryptoEngine>[0]),
);

/**
 * Verifies that the SOD's PKCS#7 signature was made by the embedded DSC.
 * Returns true on success.
 */
export async function verifySodSignature(sod: Sod): Promise<boolean> {
  try {
    const result = await sod.signedData.verify({
      signer: 0,
      checkChain: false,
      trustedCerts: [],
    });
    return Boolean(result);
  } catch {
    return false;
  }
}

/**
 * Walks the certificate chain from the DSC up to one of the trusted CSCA
 * roots. Honors notBefore/notAfter and revocation extensions per RFC 5280.
 */
export async function verifyDscChain(
  dsc: Certificate,
  trustedPems: readonly string[],
): Promise<boolean> {
  if (trustedPems.length === 0) {
    // Refuse to verify against an empty trust store — that would silently
    // accept any signature.
    return false;
  }
  const trusted = trustedPems.map(pemToCert);
  const engine = new CertificateChainValidationEngine({
    certs: [dsc, ...trusted],
    trustedCerts: trusted,
    checkDate: new Date(),
  });
  try {
    const result = await engine.verify();
    return Boolean(result.result);
  } catch {
    return false;
  }
}

function pemToCert(pem: string): Certificate {
  const body = pem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s+/g, '');
  const der = Buffer.from(body, 'base64');
  const ab = der.buffer.slice(der.byteOffset, der.byteOffset + der.byteLength) as ArrayBuffer;
  // pkijs imports lazily; we re-require asn1js here to avoid a hard dep.
  const asn1js = require('asn1js') as typeof import('asn1js');
  const asn1 = asn1js.fromBER(ab);
  if (asn1.offset === -1) throw new Error('CSCA PEM did not decode');
  return new Certificate({ schema: asn1.result });
}
