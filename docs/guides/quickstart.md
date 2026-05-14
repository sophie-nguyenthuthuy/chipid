# Quickstart

End-to-end CCCD chip verification in three steps: create a session on your server, read the chip on the user's phone, handle the webhook.

## 0. Get an API key

Sign up at [dashboard.chipid.vn](https://dashboard.chipid.vn). Copy your **test** secret key — it looks like `sk_test_...`.

> No card on file. Test mode is free forever. You only pay when you flip to live mode and a real verification succeeds (`status=verified`).

## 1. Create a verification session (server-side)

```ts
import { ChipID } from '@chipid/node';

const chipid = new ChipID(process.env.CHIPID_SECRET_KEY!);

app.post('/api/start-kyc', async (req, res) => {
  const session = await chipid.verifications.create({
    type: 'chip_nfc',
    return_url: 'https://example.vn/kyc/return',
    metadata: { user_id: req.user.id },
  });
  // Return ONLY the client_secret to the mobile app. Never the secret key.
  res.json({ client_secret: session.client_secret });
});
```

The `client_secret` is single-use, scoped to this one verification, and expires in 30 minutes.

## 2. Read the chip (mobile)

### React Native

```ts
import { startChipScan } from '@chipid/react-native';

const result = await startChipScan({
  clientSecret,                 // from your backend
  mrz: { documentNumber, dateOfBirth, dateOfExpiry }, // BAC key material
  // Or: cardAccessNumber for PACE; the SDK auto-detects.
});

if (result.status === 'verified') {
  // navigate to success screen — the verified outputs are also delivered
  // to your server via webhook
}
```

The mobile SDK handles BAC/PACE, reads DG1/DG2/DG13/DG14, asks the chip to sign an Active Auth challenge, and submits the bundle directly to `api.chipid.vn`. Your servers are not in the hot path.

## 3. Handle the webhook (server-side)

```ts
import express from 'express';
import { verifyWebhookSignature } from '@chipid/node';

const app = express();
app.post('/webhooks/chipid', express.raw({ type: 'application/json' }), (req, res) => {
  const event = verifyWebhookSignature({
    payload: req.body,
    header: req.header('ChipID-Signature')!,
    secret: process.env.CHIPID_WEBHOOK_SECRET!,
  });

  switch (event.type) {
    case 'verification.verified': {
      const v = event.data as Verification;
      // grant access, mark KYC complete, store id_number
      break;
    }
    case 'verification.failed': {
      // surface event.data.last_error.code to the user
      break;
    }
  }
  res.status(204).end();
});
```

Webhook retries: 30s, 5m, 30m, 2h, 6h, 18h. Replay any delivery from the dashboard.

## What you get when status flips to verified

```json
{
  "id": "ver_01HXY...",
  "status": "verified",
  "verified_outputs": {
    "full_name": "Nguyễn Văn An",
    "date_of_birth": "1990-01-15",
    "sex": "M",
    "nationality": "VNM",
    "id_number": "001090123456",
    "id_expires_at": "2032-06-20",
    "portrait_url": "https://files.chipid.vn/..." 
  }
}
```

All fields come from the chip — cryptographically signed by Bộ Công An (BCA), not from OCR. The portrait URL is a 15-minute presigned link to DG2.

## Going live

1. Add a card in the dashboard.
2. Rotate the test key into a live key (`sk_live_...`).
3. Point your webhook endpoint at the live endpoints config.
4. Done. There is no certification process for sandbox-to-live, no minimum commit.

Next: [Concepts → How chip verification works](../concepts/how-it-works.md).
