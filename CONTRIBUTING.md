# Contributing

Thanks for considering a contribution. This is an OSS project; we'd rather merge your PR than write it ourselves.

## Setup

```bash
git clone https://github.com/chipid/chipid.git
cd chipid
nvm use            # picks up .nvmrc
corepack enable
pnpm install
docker compose up -d
pnpm db:migrate
pnpm dev
```

The API will be on `http://localhost:4000`. Hit `/healthz`. If it 200s you're set up.

## Development workflow

- **Branch naming**: `feat/...`, `fix/...`, `chore/...`, `docs/...`. Anything goes against `main`; we squash on merge.
- **Commits**: Conventional Commits. The release workflow uses commit messages to compute SemVer bumps.
- **Changesets**: any PR that touches a publishable package (`packages/sdk-node`, `packages/nfc-parser`) needs a changeset. Run `pnpm changeset` — pick the bump type, write one sentence about what changed.
- **Tests**: every bug fix gets a regression test. Every new feature gets at least one happy-path + one failure-path test. We aim for ≥70% coverage; the CI gate blocks below that.
- **Lint + types must be clean.** `pnpm lint && pnpm typecheck` before pushing.

## Working on the NFC parser

We can't ship real CCCD fixtures (PII). Test fixtures in `packages/nfc-parser/test/` are either:

- Synthesized from the ICAO test PKD (the publicly available example chips), or
- Synthetic blobs built in-test from known structures.

If you're working on a real-chip-only edge case, ping us — we have a small set of opt-in employee dumps under NDA in a private fixtures bucket.

## Working on the API

- Schema changes ship as **expand-then-contract migrations**: add the new column nullable, deploy, backfill, deploy a second migration that flips the constraint. Never `ALTER TABLE … DROP COLUMN` in the same release that the column was last read.
- New endpoints are gated behind the `ChipID-Version` header. See [docs/concepts/api-versioning.md](docs/concepts/api-versioning.md).
- Logs must redact PII. The Pino redaction config in `apps/api/src/logger.ts` is the canonical list; add to it before logging anything new that smells like PII.

## Code of Conduct

We follow the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) v2.1. Conduct concerns: conduct@chipid.vn.
