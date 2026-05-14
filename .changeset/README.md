# Changesets

We track release notes for `@chipid/node` and `@chipid/nfc-parser` here. Run `pnpm changeset`, pick the bump, write one sentence — that's it. The release workflow on `main` opens a "Version packages" PR; merging it publishes to npm.

Apps (`@chipid/api`, dashboard) aren't published — they're deployed from CI. They appear in `ignore` in `config.json` so changesets won't try to bump them.
