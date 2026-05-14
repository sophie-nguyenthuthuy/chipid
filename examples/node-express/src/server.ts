/**
 * Minimal Express server demonstrating the ChipID happy-path:
 *
 *   1. POST /api/start-kyc  → create a verification, return client_secret
 *   2. POST /webhooks/chipid → handle the verified/failed callback
 *   3. GET  /api/kyc/:id    → look up status after the fact
 *
 * Run with:
 *   CHIPID_SECRET_KEY=sk_test_... CHIPID_WEBHOOK_SECRET=whsec_... pnpm dev
 */
import express from 'express';
import { ChipID, ChipIDError, verifyWebhookSignature } from '@chipid/node';
import type { WebhookEvent } from '@chipid/node';

const chipid = new ChipID(process.env.CHIPID_SECRET_KEY);
const WEBHOOK_SECRET = process.env.CHIPID_WEBHOOK_SECRET ?? '';

const app = express();

// JSON for normal routes…
app.use((req, res, next) => {
  if (req.path === '/webhooks/chipid') return next();
  return express.json()(req, res, next);
});

app.post('/api/start-kyc', async (req, res) => {
  try {
    const userId = req.body?.user_id as string | undefined;
    if (!userId) return res.status(400).json({ error: 'user_id required' });

    const session = await chipid.verifications.create({
      type: 'chip_nfc',
      return_url: 'https://example.vn/kyc/return',
      metadata: { user_id: userId },
    });

    res.json({
      verification_id: session.id,
      client_secret: session.client_secret,
    });
  } catch (err) {
    if (err instanceof ChipIDError) {
      return res.status(err.statusCode).json({ error: err.code, message: err.message });
    }
    throw err;
  }
});

app.get('/api/kyc/:id', async (req, res) => {
  const v = await chipid.verifications.retrieve(req.params.id);
  res.json(v);
});

// …raw body for the webhook so we can verify the signature over the exact bytes.
app.post('/webhooks/chipid', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const event: WebhookEvent = verifyWebhookSignature({
      payload: req.body,
      header: req.header('ChipID-Signature') ?? '',
      secret: WEBHOOK_SECRET,
    });

    switch (event.type) {
      case 'verification.verified':
        console.log('verified', event.data);
        // grant access, set user.kyc_status = 'verified', etc.
        break;
      case 'verification.failed':
        console.log('failed', event.data);
        break;
      default:
        // ignore unknown event types; we may add more later
        break;
    }
    res.status(204).end();
  } catch (err) {
    if (err instanceof ChipIDError) {
      return res.status(400).send(err.message);
    }
    throw err;
  }
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`listening on :${port}`));
