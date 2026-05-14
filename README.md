<div align="center">

# ChipID

**Modern eKYC for Vietnamese CCCD chip cards. Stripe-grade developer experience.**

[![CI](https://github.com/chipid/chipid/actions/workflows/ci.yml/badge.svg)](https://github.com/chipid/chipid/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/@chipid/node)](https://www.npmjs.com/package/@chipid/node)
[![codecov](https://codecov.io/gh/chipid/chipid/branch/main/graph/badge.svg)](https://codecov.io/gh/chipid/chipid)

[Quickstart](docs/guides/quickstart.md) · [API Reference](docs/api-reference/README.md) · [Pricing](https://chipid.vn/pricing) · [Dashboard](https://dashboard.chipid.vn)

</div>

---

## Why ChipID

CCCD gắn chip ships with an ICAO 9303-compliant NFC chip — the same standard as biometric e-passports. But every existing Vietnamese eKYC SDK (VNPT SmartCA, FPT.AI, VNeID-Connect) lands like enterprise software from 2015: SOAP envelopes, signed contracts before sandbox access, opaque per-tenant pricing, and mobile SDKs that ship 40MB of dead weight.

ChipID is the SDK we wanted to use:

- **Sandbox in 30 seconds.** `npm i @chipid/node`, paste a test key, run a verification. No sales call.
- **Per-verification pricing.** 8,000₫ per successful chip verification. No minimums, no platform fee, no AOV negotiation.
- **Native NFC, not OCR + selfie theater.** We read the chip's signed Data Groups (DG1, DG2, DG13, DG14) and verify the Document Signer Certificate against the BCA CSCA root. OCR is a fallback, not the product.
- **Typed everything.** TypeScript SDK, OpenAPI 3.1 spec, generated clients for Go/Python/PHP. Zod schemas at the API boundary.
- **Webhooks that don't lie.** HMAC-signed, replay-protected, exponential backoff with jitter, replay from dashboard.
- **You can self-host.** OSS core (Apache 2.0). Managed cloud is for people who don't want to run Postgres.

## Quickstart

```bash
npm install @chipid/node
```

```ts
import { ChipID } from '@chipid/node';

const chipid = new ChipID(process.env.CHIPID_SECRET_KEY);

// Server: create a verification session, hand the client_secret to the mobile app.
const session = await chipid.verifications.create({
  type: 'chip_nfc',
  return_url: 'https://example.vn/kyc/return',
  metadata: { user_id: 'usr_8f3a...' },
});

// Mobile app reads the chip with @chipid/react-native, then redeems client_secret.
// Your server receives a webhook when verification.status flips to 'verified'.
```

The full integration — including the React Native NFC reader, webhook handler, and how to compare the chip's DG2 portrait against a selfie — is in the [quickstart guide](docs/guides/quickstart.md).

## How chip verification works

```
┌─────────────┐    1. BAC/PACE     ┌──────────────┐
│  Mobile NFC │ ◄────────────────► │  CCCD chip   │
│  (RN SDK)   │    2. Read DGs     │  (ICAO 9303) │
└──────┬──────┘                    └──────────────┘
       │ 3. Upload signed SOD + DGs (raw bytes)
       ▼
┌─────────────────────────────────────────────┐
│  ChipID API                                 │
│  • Passive Authentication (verify SOD sig)  │
│  • Validate against BCA CSCA trust anchor   │
│  • Parse LDS → structured fields            │
│  • (Optional) match DG2 portrait vs selfie  │
└──────┬──────────────────────────────────────┘
       │ 4. webhook: verification.verified
       ▼
┌──────────────┐
│  Your server │
└──────────────┘
```

The mobile SDK never touches your servers' secret key — it uses a short-lived `client_secret` scoped to one verification, exactly like Stripe PaymentIntents.

## Repository layout

```
chipid/
├── apps/
│   ├── api/              Fastify API service (verification, webhooks, billing)
│   └── dashboard/        Next.js dashboard (API keys, logs, webhook config)
├── packages/
│   ├── sdk-node/         @chipid/node — server SDK
│   ├── nfc-parser/       @chipid/nfc-parser — ICAO 9303 LDS / Passive Auth
│   ├── types/            @chipid/types — shared TS types
│   └── eslint-config/    @chipid/eslint-config
├── docs/                 Developer documentation
├── examples/             Integration examples (Express, Next.js, RN)
├── infra/                Terraform + k8s manifests
└── .github/workflows/    CI/CD
```

## Development

Requires Node 20+, pnpm 9+, Docker.

```bash
pnpm install
docker compose up -d              # postgres + redis
pnpm db:migrate
pnpm dev                          # all apps in watch mode
pnpm test                         # unit + integration
pnpm test:e2e                     # e2e against running stack
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow, including how to test against fixture CCCD chip dumps.

## Security

Vulnerability reports: **security@chipid.vn** (PGP key in [SECURITY.md](SECURITY.md)). Please do not file public issues for security bugs.

The chip data we process is regulated personal data under [Nghị định 13/2023/NĐ-CP](https://thuvienphapluat.vn/van-ban/Cong-nghe-thong-tin/Nghi-dinh-13-2023-ND-CP) (PDPL). See [docs/concepts/data-handling.md](docs/concepts/data-handling.md) for our retention, encryption, and DPA story.

## License

Apache 2.0 — see [LICENSE](LICENSE).
