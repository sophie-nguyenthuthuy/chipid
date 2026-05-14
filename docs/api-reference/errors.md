# Error codes

Every error response has a stable `code`. New codes may be added; existing codes are never renamed. Switch on `code`, not on `message`.

| Code | HTTP | Type | Meaning |
| --- | --- | --- | --- |
| `authentication_required` | 401 | authentication_error | No or malformed `Authorization` header. |
| `invalid_api_key` | 401 | authentication_error | Key doesn't exist, was revoked, or wrong env (test key on live URL). |
| `permission_denied` | 403 | permission_error | Key is real but lacks the required scope. |
| `resource_missing` | 404 | invalid_request_error | The ID doesn't exist *for this account*. |
| `parameter_invalid` | 400 | invalid_request_error | Field present but wrong shape. See `param`. |
| `parameter_missing` | 400 | invalid_request_error | Required field absent. |
| `idempotency_key_in_use` | 409 | idempotency_error | Two requests with the same key are in flight. Retry shortly. |
| `idempotency_mismatch` | 409 | idempotency_error | Same key, different body. Pick a new key. |
| `rate_limited` | 429 | rate_limit_error | Account exceeded its per-minute quota. Honor `Retry-After`. |
| `verification_failed` | 402 | verification_error | Submission was processed but verification did not pass. Inspect `verification.last_error.code`. |
| `client_secret_invalid` | 401 | verification_error | The mobile-supplied `client_secret` is unknown. |
| `client_secret_expired` | 401 | verification_error | `client_secret` was valid but is past its 30-minute TTL. |
| `api_error` | 500 | api_error | Server-side error. Always retryable. Include `request_id` in support tickets. |

## Verification-specific failure codes

When `verification.status` is `failed`, `verification.last_error.code` is one of:

| Code | Meaning |
| --- | --- |
| `passive_auth_failed` | EF.SOD signature did not verify against the embedded DSC. |
| `csca_chain_failed` | DSC is real, but does not chain to a trusted BCA CSCA root. |
| `data_group_hash_mismatch` | One of the DGs read from the chip does not match the SOD hash list. |
| `chip_clone_suspected` | Active Authentication challenge response did not verify. |
| `document_expired` | DG1 expiration date is in the past. |
| `face_mismatch` | Selfie did not match DG2 within the configured threshold. |
| `liveness_failed` | Selfie failed liveness checks (presentation attack detection). |
| `user_canceled` | User backed out of the mobile flow. |
| `internal_error` | We crashed processing your bundle. Retry; if it keeps failing, file a ticket. |

`face_mismatch` and `liveness_failed` only appear when face match is enabled on the verification — they don't fire for pure chip-only verifications.
