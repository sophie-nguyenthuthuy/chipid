# Next.js example

Server-side ChipID integration in a Next.js App Router project. Useful if you're embedding the mobile flow via a web view, or rendering a "verification complete" page after the redirect.

```bash
pnpm install
CHIPID_SECRET_KEY=sk_test_... pnpm dev
```

The interesting bits:

- `app/api/kyc/start/route.ts` — `POST` handler that calls `chipid.verifications.create`.
- `app/api/webhooks/chipid/route.ts` — webhook handler. Uses the *raw* request body (`await req.text()`) for signature verification.
- `app/kyc/[id]/page.tsx` — server component that retrieves a verification and renders status.

See [docs/guides/quickstart.md](../../docs/guides/quickstart.md) for the full flow.
