# Terraform

Modules for provisioning ChipID on VNG Cloud (primary) and AWS (mirror). Not auto-applied; we like `plan` reviewed by a human.

```
infra/terraform/
├── envs/
│   ├── staging/
│   └── production/
└── modules/
    ├── vng-postgres/     managed Postgres with PITR, in-region backups
    ├── vng-redis/        managed Redis with HA
    ├── vng-k8s/          managed Kubernetes cluster + node pools
    ├── csca-trust-store/ KMS-encrypted secret with the BCA CSCA roots
    └── observability/    Datadog + Grafana wiring
```

State lives in `gs://chipid-tfstate-{env}` with per-env locks. Don't `terraform apply` without an open PR linking the plan.
