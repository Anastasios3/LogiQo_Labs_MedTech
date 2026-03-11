# LogiQo MedTech — RBAC Permissions Matrix

> **Last updated:** 2026-03-11
> **Scope:** Platform v1 (Phase 2 — Peer Telemetry)
> **Enforcement layers:** Auth0 JWT claim (`role`, `verification_tier`) → Fastify middleware → PostgreSQL RLS policies

---

## 1. User Type Definitions

Permissions in LogiQo are determined by the intersection of two orthogonal axes:

| Axis | Values | Set by |
|---|---|---|
| **Verification Tier** | 0 · 1 · 2 · 3 | Automated (email/NPI) or manual admin promotion |
| **Role** | `surgeon` · `hospital_safety_officer` · `it_procurement` · `system_admin` | Assigned at registration or by org admin |

The 7 user types below map to specific tier + role combinations:

| # | User Type | Tier | Role | Typical persona |
|---|---|---|---|---|
| 1 | Unverified Professional | 0 | any | Newly registered, hasn't verified email |
| 2 | Email-Verified Professional | 1 | `surgeon` | Verified via hospital domain; NPI pending |
| 3 | NPI-Verified Professional | 2 | `surgeon` | Full clinician, NPI confirmed via NPPES |
| 4 | Trusted Contributor | 3 | `surgeon` | Senior clinician, manually promoted by admin |
| 5 | Hospital Safety Officer | 2 | `hospital_safety_officer` | Designated HSO within a tenant |
| 6 | IT Procurement | 2 | `it_procurement` | Procurement staff within a tenant |
| 7 | System Admin | 3 | `system_admin` | LogiQo platform-level staff |

---

## 2. Permissions Matrix

### Legend

| Symbol | Meaning |
|---|---|
| ✅ | Allowed |
| ❌ | Not allowed |
| ⚠️ | Allowed with restrictions (see notes) |
| 🔒 | Requires subscription gate |
| 🏢 | Own tenant only |
| 🌐 | Platform-wide (all tenants) |
| `1.0×` / `1.5×` | Vote weight multiplier in ranking algorithm |

---

### 2.1 Can View

| User Type | Approved Devices | Recalled / Pending Devices | IFU Documents (S3) | Tenant Annotations | Platform Annotations | Safety Alerts | Flagged Content Queue | Audit Logs | Other Tenants' Data |
|---|---|---|---|---|---|---|---|---|---|
| Unverified Professional (T0) | ✅ name, SKU, category only | ❌ | ❌ | ❌ | ✅ titles only (no body) | ✅ titles only | ❌ | ❌ | ❌ |
| Email-Verified Professional (T1) | ✅ full record | ✅ status label only | ✅ 🔒 | 🏢 ✅ | 🌐 ✅ | ✅ full | ❌ | ❌ | ❌ |
| NPI-Verified Professional (T2) | ✅ full record | ✅ full record | ✅ 🔒 | 🏢 ✅ | 🌐 ✅ | ✅ full | ⚠️ own flags only | ❌ | ❌ |
| Trusted Contributor (T3) | ✅ full record | ✅ full record | ✅ 🔒 | 🏢 ✅ | 🌐 ✅ | ✅ full | ⚠️ own tenant queue | ❌ | ❌ |
| Hospital Safety Officer (T2) | ✅ full record | ✅ full record | ✅ 🔒 | 🏢 ✅ | 🌐 ✅ | ✅ full | 🏢 ✅ full queue | 🏢 ✅ | ❌ |
| IT Procurement (T2) | ✅ full + pricing metadata | ✅ full record | ✅ 🔒 | 🏢 ✅ | 🌐 ✅ | ✅ full | ❌ | 🏢 ⚠️ device actions only | ❌ |
| System Admin (T3) | ✅ full record | ✅ full record | ✅ | 🌐 ✅ all tenants | 🌐 ✅ | ✅ full | 🌐 ✅ all tenants | 🌐 ✅ all tenants | ✅ |

> **IFU Documents 🔒** — S3 pre-signed URLs (15 min TTL) are gated behind subscription. Tier 0 cannot access S3 keys; they see document metadata only.

---

### 2.2 Can Vote / Comment

| User Type | Cast Vote | Vote Weight | Leave Comment | Flag Annotation | Flag Comment |
|---|---|---|---|---|---|
| Unverified Professional (T0) | ❌ | `0×` (not counted) | ❌ | ❌ | ❌ |
| Email-Verified Professional (T1) | ❌ | `0×` (not counted) | ✅ | ✅ | ✅ |
| NPI-Verified Professional (T2) | ✅ | `1.0×` | ✅ | ✅ | ✅ |
| Trusted Contributor (T3) | ✅ | `1.5×` | ✅ | ✅ | ✅ |
| Hospital Safety Officer (T2) | ✅ | `1.0×` | ✅ | ✅ | ✅ |
| IT Procurement (T2) | ✅ | `1.0×` | ✅ ⚠️ device-operational only | ✅ | ✅ |
| System Admin (T3) | ✅ | `1.5×` | ✅ | ✅ | ✅ |

> **Vote score formula:**
> `score = Σ (vote.value × vote.specialtyRelevanceScore × tierMultiplier(voter.tier))`
> where `specialtyRelevanceScore` = `1.5` (exact specialty match) · `1.0` (related) · `0.6` (unrelated)
> and `tierMultiplier` = `0` (T0–T1) · `1.0` (T2) · `1.5` (T3)

> **Self-vote prevention:** Users cannot vote on their own annotations or comments.

---

### 2.3 Can Submit Annotation

| User Type | Submit Annotation | Auto-Publish | Allowed Types | Visibility Options |
|---|---|---|---|---|
| Unverified Professional (T0) | ❌ | — | — | — |
| Email-Verified Professional (T1) | ❌ | — | — | — |
| NPI-Verified Professional (T2) | ✅ 🔒 | ❌ (requires review) | All 5 types | `tenant` or `platform` |
| Trusted Contributor (T3) | ✅ 🔒 | ⚠️ opt-in (HSO approval still recommended) | All 5 types | `tenant` or `platform` |
| Hospital Safety Officer (T2) | ✅ 🔒 | ❌ | All 5 types + formal safety notices | `tenant` or `platform` |
| IT Procurement (T2) | ✅ 🔒 | ❌ | `operational_friction`, `tooling_anomaly` only | `tenant` only |
| System Admin (T3) | ✅ | ✅ (bypass review) | All 5 types | `tenant` or `platform` |

> **Annotation types:** `operational_friction` · `failure_mode` · `material_tolerance` · `tooling_anomaly` · `general_observation`
> **🔒 Subscription gate:** Annotation submission requires an active paid plan (individual or org-level).

---

### 2.4 Can Moderate

| User Type | Approve / Reject Annotations | Resolve Flags | Anonymize Content | Suspend Users | Scope |
|---|---|---|---|---|---|
| Unverified Professional (T0) | ❌ | ❌ | ❌ | ❌ | — |
| Email-Verified Professional (T1) | ❌ | ❌ | ❌ | ❌ | — |
| NPI-Verified Professional (T2) | ❌ | ❌ | ❌ | ❌ | — |
| Trusted Contributor (T3) | ⚠️ own tenant (approve only) | ❌ | ❌ | ❌ | 🏢 Own tenant |
| Hospital Safety Officer (T2) | ✅ own tenant | ✅ own tenant | ✅ own tenant | ✅ own tenant (non-admin users) | 🏢 Own tenant |
| IT Procurement (T2) | ❌ | ❌ | ❌ | ❌ | — |
| System Admin (T3) | ✅ all tenants | ✅ all tenants | ✅ all tenants | ✅ all users | 🌐 Platform-wide |

---

### 2.5 Can Admin

| User Type | Promote Verification Tier | Device Approval Workflow | Tenant Management | Subscription Management | Ingest FDA MedWatch | View Full Audit Log | Manage SOPs |
|---|---|---|---|---|---|---|---|
| Unverified Professional (T0) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Email-Verified Professional (T1) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| NPI-Verified Professional (T2) | ❌ | ❌ | ❌ | ⚠️ own subscription | ❌ | ❌ | ❌ |
| Trusted Contributor (T3) | ❌ | ❌ | ❌ | ⚠️ own subscription | ❌ | ❌ | ❌ |
| Hospital Safety Officer (T2) | ❌ | ❌ | ⚠️ invite/remove own tenant users | 🏢 org plan (if org admin) | ❌ | 🏢 own tenant | 🏢 own tenant |
| IT Procurement (T2) | ❌ | 🏢 approve devices for own tenant | ❌ | 🏢 org plan procurement actions | ❌ | ❌ | ❌ |
| System Admin (T3) | ✅ promote any user to any tier | ✅ approve / reject / recall globally | ✅ create / disable tenants | ✅ all plans | ✅ | ✅ all tenants | ✅ all tenants |

---

## 3. Verification Tier Promotion Paths

```
Registration (T0)
     │
     ▼  Automated: hospital-domain email confirmed
  Tier 1 — Email Verified
     │
     ▼  Automated: NPI number validated via NPPES API
  Tier 2 — NPI Verified
     │
     ▼  Manual: System Admin reviews contributor quality
  Tier 3 — Trusted Contributor
```

> **Demotion:** System Admins can demote any user to a lower tier (e.g., if NPI lapses or contribution quality declines). Tier demotion writes an immutable `user.tier_changed` audit log entry.

---

## 4. JWT Claims

Each authenticated request carries the following claims, set by the Auth0 Post Login Action:

```json
{
  "sub": "auth0|...",
  "email": "dr.andersen@rigshospitalet.dk",
  "https://logiqo.io/role": "surgeon",
  "https://logiqo.io/tenant_id": "9c7f75b0-...",
  "https://logiqo.io/verification_tier": 3
}
```

The Fastify auth plugin maps these to `request.user.role`, `request.user.tenantId`, and `request.user.verificationTier` for use in route handlers and PostgreSQL RLS (`SET LOCAL app.current_tenant_id`).

---

## 5. Enforcement Checklist

| Check | Layer | Mechanism |
|---|---|---|
| Unauthenticated access blocked | Fastify middleware | `fastify.authenticate` pre-handler |
| Cross-tenant data access blocked | PostgreSQL | RLS policies + `withTenant()` helper |
| Tier-gated actions (vote, submit) | API route handler | `if (user.verificationTier < 2) return 403` |
| Role-gated actions (moderate, admin) | API route handler | `if (user.role !== 'hospital_safety_officer') return 403` |
| Subscription gate | API route handler | Stripe entitlement check (Phase 2) |
| Audit trail | API route (post-action) | `fastify.audit()` → immutable `audit_logs` insert |
| S3 key never exposed | API response serialisation | Pre-signed URL generation only (15 min TTL) |
