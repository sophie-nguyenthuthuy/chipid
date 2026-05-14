# API Reference

Base URL: `https://api.chipid.vn`

All requests authenticated with `Authorization: Bearer sk_(test|live)_…`. All responses are JSON.

## Conventions

- **IDs** are prefixed and case-sensitive. `ver_…`, `evt_…`, `whe_…`, `acct_…`.
- **Timestamps** are integer Unix seconds.
- **Lists** paginate with `limit` (≤100) and `starting_after` (the last ID from the previous page). `has_more: true` means there's another page.
- **Idempotency**: include `Idempotency-Key: <your-uuid>` on any `POST`. Replays within 24h return the original response byte-for-byte. The `@chipid/node` SDK does this automatically.
- **Versioning**: pinned via `ChipID-Version: 2026-04-01` header. Omit → newest version your account has been opted into. Breaking changes always ship behind a new version date.

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/v1/verifications` | Create a new verification session. Returns `client_secret`. |
| `GET` | `/v1/verifications/:id` | Retrieve a verification. |
| `GET` | `/v1/verifications` | List verifications. Paginated. |
| `POST` | `/v1/verifications/submit` | (Mobile, authenticated by `client_secret`.) Submit chip bundle. |
| `POST` | `/v1/webhook_endpoints` | Register a webhook. |
| `GET` | `/v1/webhook_endpoints` | List webhooks. |
| `DELETE` | `/v1/webhook_endpoints/:id` | Revoke a webhook. |

The full OpenAPI 3.1 spec lives at [`/openapi.json`](https://api.chipid.vn/openapi.json) on the API itself; clients for Go / Python / PHP are generated from it nightly.

## Errors

```json
{
  "error": {
    "type": "invalid_request_error",
    "code": "parameter_invalid",
    "message": "return_url must be a valid URL (at return_url)",
    "param": "return_url",
    "doc_url": "https://chipid.vn/docs/errors#parameter_invalid",
    "request_id": "req_01HXYZ..."
  }
}
```

When opening a support ticket, always include `request_id`. We can pull the full trace in one query.

See [errors.md](./errors.md) for the full code list.
