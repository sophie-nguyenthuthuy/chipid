## What

<!-- One-paragraph summary of the change. -->

## Why

<!-- Link the issue / motivation. -->

## How

<!-- Notable design decisions. Skip if it's obvious from the diff. -->

## Verification

- [ ] Unit tests pass: `pnpm test`
- [ ] Lint + typecheck clean: `pnpm lint && pnpm typecheck`
- [ ] Touched a chip-data path? Verified against fixture in `packages/nfc-parser/test/`.
- [ ] Migration? Tested on a copy of staging Postgres.
- [ ] User-visible API change? Documented in `docs/` and added a changeset.

## Risk

<!-- What breaks if this goes wrong. Rollback plan if non-obvious. -->
