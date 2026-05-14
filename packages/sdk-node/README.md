# @chipid/node

Official Node.js SDK for [ChipID](https://chipid.vn) — modern eKYC for Vietnamese CCCD chip cards.

```bash
npm install @chipid/node
```

## Quick start

```ts
import { ChipID } from '@chipid/node';

const chipid = new ChipID(process.env.CHIPID_SECRET_KEY);

const v = await chipid.verifications.create({
  type: 'chip_nfc',
  return_url: 'https://example.vn/kyc/return',
  metadata: { user_id: 'usr_8f3a' },
});

// Hand v.client_secret to the mobile app. When the user completes the chip
// read, a webhook fires and v.status flips to 'verified'.
```

## Webhooks

```ts
import express from 'express';
import { verifyWebhookSignature, ChipIDError } from '@chipid/node';

const app = express();

app.post('/webhooks/chipid', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const event = verifyWebhookSignature({
      payload: req.body, // raw buffer
      header: req.header('ChipID-Signature')!,
      secret: process.env.CHIPID_WEBHOOK_SECRET!,
    });
    if (event.type === 'verification.verified') {
      // grant access, store outputs, etc.
    }
    res.status(204).end();
  } catch (err) {
    if (err instanceof ChipIDError) return res.status(400).send(err.message);
    throw err;
  }
});
```

## Configuration

| Option | Default | Description |
| --- | --- | --- |
| `apiKey` | `process.env.CHIPID_SECRET_KEY` | Secret key. `sk_test_…` or `sk_live_…`. |
| `baseUrl` | `https://api.chipid.vn` | Override for self-hosted deployments. |
| `timeout` | `30000` | Per-request timeout in ms. |
| `maxRetries` | `2` | Retries on 5xx + network errors. Backoff is decorrelated jitter. |

POST requests automatically get an `Idempotency-Key` header — safe to retry, never charged twice.

## Errors

All API errors raise a typed `ChipIDError` with `code`, `type`, `statusCode`, and `requestId`. See [docs/errors](https://chipid.vn/docs/errors) for the full code list.

## License

Apache-2.0
