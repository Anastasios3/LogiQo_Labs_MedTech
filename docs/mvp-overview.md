# LogiQo MedTech — MVP Overview

**Version:** 1.0 (Phase 1 — Pilot Hospital)
**Date:** March 2026
**Classification:** Internal / Investor-ready

---

## Executive Summary

LogiQo is a HIPAA-compliant SaaS platform that solves a critical gap in surgical device management: surgeons have no trusted, real-time way to share adverse experiences, compare device performance across institutions, or track FDA safety alerts in the context of their actual device inventory.

The MVP delivers three interconnected modules — Hardware Index, Peer Telemetry, and Safety Alerts — wrapped in an enterprise-grade RBAC and compliance shell designed for hospital procurement and safety teams.

**Market:** 6,200+ US hospitals × $149–$299/month/seat = **$1.1B TAM**

---

## Product Modules

### 1 · Hardware Index

**Problem:** Hospitals maintain device inventories in spreadsheets or siloed EHR modules. Cross-hospital comparison data does not exist.

**Solution:** A searchable, structured device registry with:

- Full-text search (pg_tsvector, sub-100ms) across name, SKU, manufacturer, category
- Advanced filters: status, category, manufacturer — all shareable via URL
- Device detail pages with tabbed views:
  - **Overview:** name, description, SKU, manufacturer, category
  - **Technical:** material composition, dimensions, compatibility matrix, extraction tooling
  - **Regulatory:** FDA 510(k) number, CE mark, regulatory status, approval workflow
  - **Peer Annotations:** embedded telemetry feed for that device
- IFU document access via S3 pre-signed URLs (15-minute TTL, download logged)
- Admin approval workflow: device submissions require Safety Officer review
- FDA GUDID lookup: auto-populate device fields from UDI barcode scan
- FDA 510(k) enrichment: automated batch import from OpenFDA API

**Key metrics:** 100 devices (MVP pilot), scales to 500k+ with OpenSearch (Phase 2).

---

### 2 · Peer Telemetry (Annotations)

**Problem:** Surgeons share experiences informally (hallway conversations, conferences). This knowledge is lost, unverifiable, and not actionable.

**Solution:** A structured peer annotation system with:

- **3-step annotation form:** device selection → clinical details → visibility/preview
- **Annotation types:** clinical note, safety alert, technique tip, case report, device comparison
- **Severity levels:** low / medium / high / critical
- **Visibility:** tenant-scoped (internal) or platform-wide (anonymized across hospitals)
- **Verification-weighted voting:** votes from NPI-validated surgeons (tier 2+) carry more weight; trusted contributors (tier 3) receive 1.5× multiplier
- **Endorsement system:** peers can endorse annotations, building a reputation score
- **Moderation pipeline:** 3+ flags → annotation moves to Safety Officer review queue
- **Immutability:** published annotations cannot be edited — versioned via `parent_id`

**Verification tiers (trust model):**

| Tier | Criteria | Capabilities |
|------|----------|-------------|
| 0 | Registered, email unverified | Read-only |
| 1 | Hospital-domain email verified | Read + flag |
| 2 | NPI number validated (NPPES API) | Full participation |
| 3 | Admin-reviewed (trusted contributor) | 1.5× vote weight |

---

### 3 · Safety Alerts

**Problem:** FDA recall notices arrive via email to device administrators. There is no automated way to match a recall to a hospital's actual device inventory.

**Solution:** An automated alert ingestion and distribution system:

- **Real-time alert feed** with Active / Acknowledged tabs
- **Alert cards** show: severity badge (critical/high/medium/low), source, affected device chips, FDA recall number
- **Acknowledgement workflow:** Safety Officers acknowledge alerts with free-text notes; acknowledgement is logged in the immutable audit trail
- **FDA MedWatch integration:** automated recall ingestion via OpenFDA API (configurable: manual / hourly / 6h / 24h sync)
- **Device matching:** incoming recalls are fuzzy-matched to existing devices (ILIKE on device name + SKU)
- **Severity mapping:** Class I → critical, Class II → high, Class III → medium, unknown → low

**Ingestion pipeline:**
```
OpenFDA API → ingest-fda-recalls.ts → Alerts table → AlertFeed (frontend)
```

---

### 4 · Admin & Compliance

**Problem:** Hospitals are subject to HIPAA, MDR (EU), and internal SOPs. Compliance teams have no unified audit trail.

**Solution:**

- **Immutable audit log:** every API action writes an INSERT-only row. The DB app role has `INSERT + SELECT` only — `UPDATE`/`DELETE` are revoked at the PostgreSQL level.
- **HIPAA-compliant audit viewer:** filter by action, resource type, date range; expandable rows show old/new values (change data capture); CSV export (up to 100k rows)
- **Organization management:** invite members by email + role, change roles inline, remove members
- **Role-based access control:** 5 roles with explicit permission matrix (see `/docs/rbac-matrix.md`)

---

## Tech Stack

| Layer | Technology | Justification |
|-------|-----------|--------------|
| **Frontend** | Next.js 14 (App Router) + TypeScript | SSR for fast initial load in clinical networks; App Router enables server components + streaming |
| **UI** | Tailwind CSS + shadcn/ui | Zero-runtime CSS; accessible components; consistent design system |
| **State** | TanStack Query v5 + Zustand | TanStack Query for server state (background sync, stale-while-revalidate); Zustand for ephemeral UI state |
| **Backend** | Node.js + Fastify + TypeScript | 2–3× faster than Express; schema-based validation; structured logging via Pino |
| **Database** | PostgreSQL 16 (Prisma ORM) | HIPAA-eligible (RDS); Row-Level Security for multi-tenancy; JSONB for semi-structured device data |
| **Auth** | Auth0 Enterprise | HIPAA BAA; SAML/SSO for hospital AD/Okta/Azure AD; MFA enforcement |
| **Storage** | AWS S3 + KMS | HIPAA-eligible; pre-signed URLs (15-min TTL); SSE-KMS encryption; Object Lock for WORM audit exports |
| **Cache** | Redis (AWS ElastiCache) | Session data, rate limiting, hot device index entries |
| **Monorepo** | pnpm + Turborepo | Shared TypeScript types between frontend/backend; incremental builds |
| **IaC** | Terraform | All infra as code; state in S3 + DynamoDB lock |
| **CI/CD** | GitHub Actions | Typecheck + lint + E2E on every PR; Vercel preview deployments; ECS Fargate rolling deploy |

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Internet                         │
└──────────────────────────┬──────────────────────────────┘
                           │
           ┌───────────────┴──────────────┐
           │           AWS WAF            │  IP rate limit, SQLi/XSS rules
           └───────────────┬──────────────┘
                           │
           ┌───────────────┴──────────────┐
           │       CloudFront CDN         │  Static assets, edge caching
           └───────────────┬──────────────┘
                           │
        ┌──────────────────┴──────────────────┐
        │                                     │
┌───────┴────────┐                  ┌─────────┴────────┐
│  Vercel Edge   │                  │  AWS ALB          │
│  Next.js App   │                  │  (HTTPS :443)     │
│  (Frontend)    │                  └─────────┬─────────┘
└────────────────┘                            │
                                   ┌──────────┴──────────┐
                                   │  ECS Fargate         │
                                   │  Fastify API          │
                                   │  (port 8080)         │
                                   └──────────┬───────────┘
                                              │
               ┌──────────────────────────────┼──────────────────────┐
               │                              │                       │
     ┌─────────┴──────────┐       ┌──────────┴──────────┐  ┌────────┴───────┐
     │   RDS PostgreSQL   │       │  ElastiCache Redis   │  │   S3 Buckets   │
     │   (Primary + RR)   │       │   (session cache)    │  │  (documents,   │
     │   Multi-AZ         │       └─────────────────────┘  │   audit WORM)  │
     └────────────────────┘                                 └────────────────┘
```

**Regions:** `us-east-1` (primary) with read replica in `eu-west-1` for Danish hospital customers (GDPR data residency).

---

## HIPAA / GDPR / MDR Compliance Summary

### HIPAA Technical Safeguards

| Safeguard | Implementation | Status |
|-----------|---------------|--------|
| Access Control (§164.312(a)(1)) | Auth0 enterprise MFA + RBAC + PostgreSQL RLS | ✅ |
| Audit Controls (§164.312(b)) | Immutable `audit_logs` table, INSERT-only DB role | ✅ |
| Integrity Controls (§164.312(c)(1)) | HTTPS/TLS 1.2+, S3 KMS checksums | ✅ |
| Transmission Security (§164.312(e)(1)) | HSTS preload, TLS everywhere, no HTTP | ✅ |
| Encryption at Rest | RDS storage encryption + S3 SSE-KMS + ElastiCache in-transit | ✅ |
| PHI Minimization | Annotations store `procedure_date` (date only) + `patient_count` (aggregate). Zero individual patient identifiers. | ✅ |
| BAA Coverage | AWS (RDS, S3, ECS, ElastiCache, SQS) + Auth0 Enterprise | ✅ |
| Audit Log Retention | S3 Object Lock (WORM) on `audit-logs/` prefix, 7-year retention | ✅ |

### GDPR (EU) Compliance

- **Data residency:** EU hospital tenants routed to `eu-west-1` RDS read replica + S3 bucket
- **Right to erasure:** User records support soft-delete (`isActive: false`); audit log entries are exempt (legal obligation)
- **DPA:** Standard Contractual Clauses (SCCs) for data transfers to US processors (AWS, Auth0)
- **Consent:** Annotation submission explicitly shows data visibility (tenant/platform) before publishing
- **Data portability:** CSV export available for all tenant data via admin API

### EU MDR (Medical Device Regulation) — Regulation (EU) 2017/745

LogiQo operates as a **clinical decision-support platform** that is ancillary to regulated medical devices, not itself a regulated device under MDR Annex VIII Rule 11. The platform's architecture is designed to support the MDR obligations of its hospital and manufacturer customers across three specific articles.

| Article / Annex | Obligation | LogiQo Implementation |
|-----------------|------------|----------------------|
| **Article 10(9) — Technical documentation** | Manufacturers must maintain and update technical documentation and implement a QMS covering post-market surveillance | The Hardware Index stores device SKUs, regulatory status, CE/510(k) numbers, and version-controlled IFU documents; all changes are captured in the immutable audit trail |
| **Article 83 — Post-market surveillance (PMS)** | Manufacturers must systematically collect and analyse data from devices in service to update risk/benefit assessments on an ongoing basis | Peer Telemetry annotations (clinical notes, failure modes, material tolerance findings) provide a structured, verification-weighted PMS data stream; annotation immutability (versioned via `parent_id`) ensures the evidentiary chain is preserved |
| **Article 84 — PMS reports (PMSR) and PSUR** | Manufacturers of Class IIa/IIb/III devices must submit periodic PMS reports to Notified Bodies | The audit log CSV export (up to 100k rows, RFC 4180 format) and annotation export API are structured to provide the input data set for PMSR/PSUR compilation |
| **Annex XIV — Clinical evaluation** | Clinical evaluation must incorporate post-market clinical follow-up (PMCF) data including real-world performance and adverse event signals | Flagged annotations routed through the moderation queue serve as a formal adverse-signal collection channel; the moderation audit trail records Safety Officer review decisions |
| **Article 87 — Reporting of serious incidents** | Manufacturers and authorised representatives must report serious incidents to EUDAMED within defined timeframes | Safety Alerts ingested from FDA MedWatch / EUDAMED are surfaced to Safety Officers with acknowledgement timestamps; these records provide evidence of timely incident awareness for regulatory inspection |

**Classification note:** If LogiQo is determined to meet the definition of a SaMD under MDR Rule 11 (software intended to provide information for diagnostic or therapeutic decisions), it would likely fall in **Class IIa** (Article 51, Annex VIII). A formal MDR Article 10(2) classification review should be completed before the EU commercial launch. This review is scoped for Phase 2.

**EUDAMED integration:** The EUDAMED actor registration stub (Phase 1) enables Phase 2 full integration for UDI look-up and recall ingestion. Full EUDAMED write access (incident reporting) requires an EU Authorised Representative and EUDAMED actor ID — out of scope for the MVP.

---

## Pricing Tiers

See `/docs/pricing.md` for full Stripe configuration. Summary:

| Plan | Price | For |
|------|-------|-----|
| Individual Monthly | $49/month | Solo surgeons |
| Individual Annual | $470/year (~$39/mo) | Solo surgeons (save 20%) |
| Organization Monthly | $299/month | Hospital departments (unlimited seats) |
| Organization Annual | $2,870/year (~$239/mo) | Hospital departments (save 20%) |

**Enterprise (custom):** Multi-department, SAML SSO, dedicated support, SLA — contact sales.

**Pilot pricing:** First 3 pilot hospitals receive 90 days free (Organization tier) in exchange for case study rights.

---

## Roadmap

### Phase 1 — MVP (Q1 2026, single pilot hospital)

- [x] Hardware Index: 50 devices, search, filters, device detail pages
- [x] Peer Telemetry: annotation creation, voting, endorsement, moderation
- [x] Safety Alerts: active feed, acknowledgement workflow
- [x] Admin: device approval, audit log viewer, organization management
- [x] Auth: Auth0 enterprise, RBAC, NPI verification
- [x] Compliance: HIPAA audit trail, HSTS, CSP, rate limiting
- [x] External APIs: FDA OpenFDA (recalls + 510k), GUDID UDI lookup, EUDAMED stub
- [x] Billing: Stripe subscription management
- [x] Demo data: 100+ devices, 70 annotations, 500 audit entries

### Phase 2 — Scale (Q2–Q3 2026, 5+ hospitals)

- [ ] Multi-tenant SSO (SAML/OIDC per hospital Active Directory)
- [ ] OpenSearch migration (sub-second search at 500k+ devices)
- [ ] Peer telemetry moderation workflow (Safety Officer approval queue)
- [ ] SOP management module (S3-backed procedure documents)
- [ ] Mobile-responsive redesign (tablet-first for OR environments)
- [ ] Annotation endorsement notifications
- [ ] API access for hospital EHR integrations (HL7 FHIR R4)

### Phase 3 — Platform (Q4 2026+)

- [ ] Anonymized aggregate analytics (de-identified telemetry export pipeline)
- [ ] Manufacturer portal (respond to annotations, publish field corrections)
- [ ] AI-assisted adverse event detection (pattern recognition across annotations)
- [ ] EU EUDAMED full integration (requires EU registration credentials)
- [ ] Automated post-market surveillance reports (MDR Annex III)

---

## Key Differentiators

| Feature | LogiQo | Hospital EHR | Manufacturer Portal | Forum / LinkedIn |
|---------|--------|-------------|-------------------|-----------------|
| Verified surgeon identities | ✅ NPI | ✅ SSO | ❌ | ❌ |
| Device-linked annotations | ✅ | ❌ | Limited | ❌ |
| FDA recall matching to inventory | ✅ | ❌ | Self-reported | ❌ |
| HIPAA-compliant audit trail | ✅ | ✅ | ❌ | ❌ |
| Cross-institution data | ✅ | ❌ | ❌ | Informal |
| Trust-weighted annotation scoring | ✅ | ❌ | ❌ | ❌ |

---

## Getting Started

### Local Development

```bash
git clone https://github.com/Anastasios3/LogiQo_Labs_MedTech
cd logiqo-medtech
cp .env.example .env           # fill in Auth0 + AWS credentials
docker compose up -d           # start Postgres + Redis
pnpm install
pnpm --filter @logiqo/db db:migrate
pnpm --filter @logiqo/db db:seed:demo   # optional: full demo dataset
pnpm dev                       # starts both web (3000) and api (8080)
```

### Testing

```bash
pnpm typecheck                 # TypeScript — zero errors expected
pnpm --filter @logiqo/web test:e2e        # Playwright E2E (requires Next.js running)
pnpm --filter @logiqo/web test:e2e:ui     # Interactive Playwright UI mode
```

### Further Reading

| Document | Path |
|----------|------|
| Security audit (HIPAA controls) | `/docs/security-audit.md` |
| Demo data guide | `/docs/demo-data.md` |
| RBAC permission matrix | `/docs/rbac-matrix.md` |
| Pricing & Stripe setup | `/docs/pricing.md` |
| User journeys | `/docs/user-journeys.md` |
