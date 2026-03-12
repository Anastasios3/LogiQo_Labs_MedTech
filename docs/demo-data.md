# LogiQo MedTech — Demo Data Guide

The platform ships with two seed modes:

| Command | Purpose | Data volume |
|---------|---------|------------|
| `pnpm db:seed` | Base seed (dev + CI) | 3 tenants, 50 devices, 30 annotations, 5 alerts, 10 users |
| `pnpm db:seed:demo` | Base + demo data (sales demos, load tests) | + 2 tenants, 5 users, 100 devices, 70 annotations, 5 alerts, 500 audit entries |

> **Prerequisite:** PostgreSQL must be running and migrations applied.
> ```bash
> docker compose up -d
> pnpm --filter @logiqo/db db:migrate
> pnpm --filter @logiqo/db db:seed          # base data
> pnpm --filter @logiqo/db db:seed:demo     # base + demo data
> ```

---

## Base Seed (`pnpm db:seed`)

Populates a minimal but realistic dataset for development and CI.

### Tenants

| Slug | Name | Plan | Region |
|------|------|------|--------|
| `rigshospitalet` | Rigshospitalet Copenhagen | Enterprise | DK |
| `dtu-skylab` | DTU Skylab Health | Standard | DK |
| `athens-general` | Athens General Hospital | Standard | GR |

### Users (10 total, spread across tenants)

| Email | Role | Verification tier |
|-------|------|-------------------|
| dr.andersen@rigshospitalet.dk | surgeon | 3 (Trusted) |
| safety@rigshospitalet.dk | hospital_safety_officer | 2 |
| dr.nkrumah@dtu-skylab.dk | surgeon | 2 |
| dr.papadopoulos@athens-general.gr | surgeon | 3 |
| procurement@rigshospitalet.dk | it_procurement | 1 |
| … (5 more) | various | 0–2 |

### Devices (50 total)

- 20 orthopaedic (hip, knee, spine, shoulder)
- 15 cardiac EP (mapping catheters, leads)
- 15 dental (implants, aligners, grafts)

All devices belong to `rigshospitalet` or `dtu-skylab` tenant scope.

### Alerts (5 total)

| Title | Severity | Type |
|-------|---------|------|
| Class I Recall — Hip Stem | critical | recall |
| Class II Recall — Cardiac Lead | high | recall |
| Advisory — Implant Fixation | medium | advisory |
| Safety Notice — Aligner Trim | medium | safety_notice |
| Field Correction — EP Catheter | medium | field_correction |

### Annotations (30 total)

30 peer-reviewed annotations with votes, comments, and specialty tags. Authors span verification tiers 2–3.

---

## Demo Data Seed (`pnpm db:seed:demo`)

Runs the full base seed, then adds high-volume data suited for:
- **Sales demos** — realistic patient-scale data in a presentable state
- **Load testing** — sufficient rows to test pagination and query performance
- **Scenario walkthroughs** — pre-seeded acknowledged alert, flagged annotation

### Additional Demo Tenants

| Slug | Name | Plan |
|------|------|------|
| `rigshospitalet-demo` | Rigshospitalet Demo | Enterprise |
| `aalborg-university-hospital-demo` | Aalborg University Hospital Demo | Standard |

### Additional Demo Users (5)

| Full Name | Email | Role | Tenant | Tier |
|-----------|-------|------|--------|------|
| Dr. Anna Larsen | anna.larsen@rigshospitalet-demo.dk | hospital_safety_officer | Rigshospitalet Demo | 3 |
| Dr. Mikkel Jensen | mikkel.jensen@rigshospitalet-demo.dk | surgeon | Rigshospitalet Demo | 2 |
| Søren Møller | it.procurement@rigshospitalet-demo.dk | it_procurement | Rigshospitalet Demo | 1 |
| Dr. Camilla Nielsen | camilla.nielsen@aau-demo.dk | surgeon | Aalborg Demo | 2 |
| Lars Christensen | lars.christensen@aau-demo.dk | hospital_safety_officer | Aalborg Demo | 1 |

> **Auth note:** Demo users use `demo|*` Auth0 subject prefixes. In dev mode (no `AUTH0_DOMAIN`), all API requests auto-authenticate as `system_admin` — demo user IDs are still created in the DB.

### 100 Demo Devices

| Category | Count | Example names |
|----------|-------|---------------|
| Orthopaedic | 40 | TitanFlex Hip Stem 1.x, KneeAlign Total Knee System, SpineCore TLIF Cage |
| Cardiac EP | 35 | CardioMap EP Catheter, ElectraNav Mapping Catheter, PaceLead Atrial RA |
| Dentistry | 25 | OsseoFit Implant 4.1×12mm, AlignPro Clear Aligner System, PerioMend Membrane |

All 100 devices:
- `approvalStatus: "approved"`, `regulatoryStatus: "510k_cleared"`
- Assigned a synthetic FDA 510(k) number (`K200001–K200100`)
- Creation timestamps staggered over 100 days (for realistic time-series views)
- SKUs: `DEMO-0001` through `DEMO-0100`

### 70 Demo Annotations

70 annotations spread across the 100 demo devices:
- All `status: "published"`
- Visibility alternates: tenant (every 3rd) / platform (remainder)
- 10 rotating titles and detailed clinical bodies
- Annotation types: `clinical_note`, `safety_alert`, `technique_tip`, `case_report`
- Severities: low / medium / high cycling
- Publication dates staggered over 350 days

### 5 Demo Alerts

| Title | Severity | Source | Notes |
|-------|---------|--------|-------|
| Class I Recall — CardioMap Irrigated Ablation | **critical** | FDA MedWatch | Active |
| URGENT FSN — OsseoFit Implant 4.1 Series | **critical** | Manufacturer | Active |
| Advisory — TitanFlex Hip Stem 1.5 Taper | medium | EUDAMED | Active |
| Product Recall — PaceLead Atrial RA-2 | medium | FDA MedWatch | Active |
| Safety Communication — AlignPro Trim | medium | Manufacturer | **Acknowledged** by Dr. Anna Larsen |

Alert #5 is pre-acknowledged for the Rigshospitalet Demo tenant — useful for demonstrating the acknowledged alerts tab.

### 500 Audit Log Entries

- 500 structured audit entries spanning approximately **30 days** (present to ~30 days ago)
- 17 distinct action types: `device.viewed`, `annotation.created`, `alert.acknowledged`, `org.member_invited`, `admin.export`, etc.
- IP addresses rotating through 5 sample addresses
- All entries reference demo tenant users (so they are queryable via tenant filter in the audit log viewer)
- Inserted via `createMany` in batches of 100 for performance

---

## Resetting Demo Data

To wipe and re-seed:
```bash
# Option 1: Drop and recreate the database
docker compose down -v
docker compose up -d
pnpm --filter @logiqo/db db:migrate
pnpm --filter @logiqo/db db:seed:demo

# Option 2: Keep base data, only delete demo-specific rows
# (Tenants, users, devices, annotations, alerts with demo- prefix/slug)
psql $DATABASE_URL -c "DELETE FROM annotations   WHERE id LIKE '00000000-demo-ann0%';"
psql $DATABASE_URL -c "DELETE FROM alerts        WHERE id LIKE '00000000-demo-alt1%';"
psql $DATABASE_URL -c "DELETE FROM devices       WHERE sku LIKE 'DEMO-%';"
psql $DATABASE_URL -c "DELETE FROM users         WHERE auth0_user_id LIKE 'demo|%';"
psql $DATABASE_URL -c "DELETE FROM tenants       WHERE slug LIKE '%-demo' OR slug LIKE '%-demo';"
psql $DATABASE_URL -c "DELETE FROM audit_logs    WHERE user_agent = 'Mozilla/5.0 (Demo Seed Generator)';"
# Re-run demo seed
pnpm --filter @logiqo/db db:seed:demo
```

---

## Seed Architecture

```
packages/db/src/seed.ts
  └── main()            ← always runs (base data, idempotent upserts)
  └── seedDemoData()    ← only when --demo-data flag is present
```

Both functions use Prisma `upsert` — safe to run multiple times without duplicates. The `--demo-data` flag is passed via `process.argv`:

```bash
# Equivalent to pnpm db:seed:demo
tsx packages/db/src/seed.ts --demo-data
```
