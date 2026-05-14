# Data handling, retention, and PDPL

Chip data is regulated personal data under [Nghị định 13/2023/NĐ-CP](https://thuvienphapluat.vn/van-ban/Cong-nghe-thong-tin/Nghi-dinh-13-2023-ND-CP) (Personal Data Protection Law, "PDPL"). This page is the developer-facing summary of how ChipID handles it. Our full DPA is at [chipid.vn/legal/dpa](https://chipid.vn/legal/dpa).

## What we store

| Data | Storage | Default retention | Override |
| --- | --- | --- | --- |
| Verified outputs (name, DOB, ID number, …) | Postgres, AES-256-GCM column encryption, KMS-wrapped per-tenant DEK | 90 days from `verified_at` | `retention=indefinite` or `retention=24h` at create time |
| Portrait (DG2) | S3 with SSE-KMS, presigned URLs only (15-min TTL) | 90 days | Same as above |
| Raw chip dump (SOD + DGs) | S3, encrypted, **not** accessible via API | 30 days for fraud investigation | `disable_raw_storage=true` to opt out at create time |
| Webhook payloads + responses | Postgres | 30 days | Not configurable |

Anything older is hard-deleted, not soft-deleted. The deletion job runs hourly and is verified by a daily reconciliation report.

## What we don't store

- We never store API secret keys in plaintext. They're hashed with Argon2id; we hold an HMAC-derived lookup index to find the row.
- We never store webhook secrets in plaintext. Same scheme.
- We never see the user's BAC/PACE key material — that's derived on-device from data the user enters into your app.

## Where we run

Production data is processed in **VNG Cloud Ho Chi Minh** (region `hcm-1`), per PDPL data-residency rules for Vietnamese citizen data. Backups stay in-region. Our DR site is **CMC Telecom Hanoi** (`han-1`).

## Subprocessor list

| Vendor | Purpose | Data |
| --- | --- | --- |
| VNG Cloud | Compute, network, KMS | All |
| Datadog (EU) | APM + logs | Aggregated metrics; logs are PII-redacted via Pino redaction |
| Stripe | Metered billing | Account-level usage counts only — no verification payloads |
| Cloudflare | Edge / WAF | Request headers; bodies are not cached |

Adding a subprocessor is a 30-day-notice change.

## Subject access requests

End users can request access / deletion of their data. The request must come through *you* (the controller — we're the processor). Use:

```bash
curl -X DELETE https://api.chipid.vn/v1/verifications/ver_xxx \
  -H "Authorization: Bearer $CHIPID_SECRET_KEY"
```

This triggers immediate hard-deletion of all artifacts associated with the verification, returns a deletion receipt, and emits a `verification.deleted` webhook for your audit log.
