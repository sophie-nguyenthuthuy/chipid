# Security Policy

## Reporting a vulnerability

Email **security@chipid.vn**. PGP key fingerprint: `4A7E 9B12 6F0D 8C3A 51F4  E2D8 9B1A 0C5F 7B3E 2D81`. Full key at https://chipid.vn/.well-known/pgp-key.asc.

Please do **not**:

- File a public GitHub issue.
- Test against production accounts other than your own.
- Run automated scanners against `api.chipid.vn` without prior agreement.

You will get:

- An acknowledgment within 1 business day.
- A triage decision within 3 business days.
- Public credit in the advisory unless you ask otherwise.
- Bounty: $250 – $10,000 depending on severity (see chipid.vn/bug-bounty for the full schedule).

## Supported versions

Only the latest `0.x` release of `@chipid/node` and `@chipid/nfc-parser` receives security patches. Once we hit `1.0`, we'll commit to the previous major for 12 months.

The API itself is versioned by date (`ChipID-Version: 2026-04-01`); older versions remain supported for at least 24 months after deprecation.

## Threat model (summary)

The full document lives at [docs/concepts/threat-model.md](docs/concepts/threat-model.md). Headline points:

- The mobile SDK is **untrusted**. The server-side Passive Authentication is the only thing that makes a chip read trustworthy.
- The chip's BAC/PACE secrets (MRZ / CAN) are **low-entropy and printed on the card**. We assume an attacker can read them. The defense is Passive Auth + Active Auth, not secrecy of the secure-channel key.
- API keys and webhook secrets are stored as Argon2id hashes with an HMAC lookup index. A database breach does not yield usable secrets.
- Chip dumps are encrypted at rest and never accessible via the public API.
