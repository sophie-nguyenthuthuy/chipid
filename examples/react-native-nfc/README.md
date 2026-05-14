# React Native NFC example

Reads a CCCD chip and completes a ChipID verification end-to-end.

```bash
pnpm install
# iOS: open ios/ in Xcode, set the NFC entitlement, set Team
pnpm ios          # or `pnpm android`
```

## What this app does

1. Calls *your* backend at `POST /api/start-kyc` to mint a `client_secret`.
2. Asks the user to enter their CCCD number, DOB, and expiry (the BAC seed).
3. Holds the phone against the back of the card.
4. Reads DG1, DG2, DG13, DG14, DG15. Runs Active Auth.
5. Submits the bundle to `api.chipid.vn/v1/verifications/submit` with the `client_secret`.
6. Polls until status is no longer `processing`, then routes the user.

The full hot path stays on-device + ChipID — your servers are out of the data plane until the webhook lands.

## File layout

```
src/
├── App.tsx                      navigation root
├── screens/
│   ├── StartScreen.tsx          POST /api/start-kyc, hand off to scan
│   ├── ScanScreen.tsx           orchestrates @chipid/react-native
│   └── ResultScreen.tsx         renders verified outputs (or error)
├── lib/
│   └── api.ts                   thin client for your own backend
```

For the production setup notes (Info.plist entries, AndroidManifest permissions, NFC entitlement files), see [docs/guides/mobile-setup.md](../../docs/guides/mobile-setup.md).
