# LogiQo MedTech — Wireframe Specifications

> **Last updated:** 2026-03-11
> **Format:** Component-level wireframe specs with ASCII layout sketches, component lists, data requirements, and interaction states.
> These specs define the target UI for design and frontend implementation. All screens assume dark theme (navy/slate background, as currently implemented).

---

## Screen 1 — Onboarding Flow

**Route:** `/onboarding` (3-step wizard)
**Access:** Any authenticated user who has not completed setup
**Purpose:** Guide a new user from raw registration through email verification, NPI submission, and subscription checkout.

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  LogiQo Logo                              Step X of 3   [?] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ●─────────●─────────○                                     │
│   Step 1    Step 2    Step 3                                │
│   Email     NPI       Subscribe                             │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                   STEP CONTENT                      │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│                          [← Back]   [Next / Submit →]       │
└─────────────────────────────────────────────────────────────┘
```

---

### Step 1 — Email Verification

**Components:**

| Component | Type | Detail |
|---|---|---|
| Step indicator | Progress bar | 3 steps, current highlighted, completed steps checkmarked |
| Heading | `h1` | "Verify your professional email" |
| Subheading | `p` | "We use your hospital or institution domain to confirm your professional status." |
| Email display | Read-only badge | Shows email from Auth0; not editable here |
| Domain status chip | Inline badge | `✓ Recognised institution domain` (green) or `⚠ Personal domain detected` (amber) |
| Resend button | Secondary CTA | "Resend verification email" — disabled for 60 s after send, shows countdown |
| Status polling | Auto | Page polls `/users/me` every 5 s; transitions to step 2 when `verificationTier >= 1` |
| Help text | Collapsible | "Using a personal email? Contact your IT department for an institutional address, or proceed and submit NPI to verify manually." |

**States:**
- `pending` — email sent, awaiting click
- `verified` — tier promoted, auto-advance after 1.5 s toast
- `error` — email provider bounce, show support link

---

### Step 2 — NPI Verification

**Components:**

| Component | Type | Detail |
|---|---|---|
| Heading | `h1` | "Confirm your NPI number" |
| Subheading | `p` | "Your NPI (National Provider Identifier) is verified against the NPPES public registry." |
| NPI input | `<input type="text" pattern="\d{10}">` | 10-digit numeric, label: "NPI Number", placeholder: `1234567890` |
| Inline validation | Client-side | Reject non-numeric, enforce exactly 10 digits before submit |
| Submit button | Primary CTA | "Verify NPI" — shows spinner during API call |
| NPPES result | Success card | Shows verified name + credential from NPPES response (`basic.first_name`, `basic.last_name`, `basic.credential`) — "Is this you?" confirmation |
| Confirm button | Primary CTA | "Yes, that's me — Confirm" |
| Mismatch help | Tertiary link | "Not the right person? Re-enter NPI" |
| Skip option | Tertiary link | "Skip for now" — stays at tier 1, shown subscription gate banner later |

**States:**
- `idle` — empty input
- `validating` — spinner, NPPES fetch in progress
- `npi_found` — shows NPPES result card for confirmation
- `npi_not_found` — inline error "NPI not found in NPPES registry. Check for typos."
- `confirmed` — tier 2 promoted, auto-advance after 1.5 s success toast

---

### Step 3 — Subscription Checkout

**Components:**

| Component | Type | Detail |
|---|---|---|
| Heading | `h1` | "Choose your plan" |
| Plan cards | 2-column grid | Individual and Org Starter shown; Enterprise has "Contact Sales" CTA |
| Individual plan card | Selectable card | Price · feature list bullets · "Most Popular" badge |
| Org Starter plan card | Selectable card | Per-seat or flat fee · team features · "Invite up to 25 staff" |
| Feature comparison table | Collapsible | Full feature diff below plan cards (collapsed by default) |
| Selected plan summary | Sticky sidebar (or bottom bar on mobile) | Plan name · billing cycle toggle (monthly / annual) · price total |
| Billing cycle toggle | Toggle | Monthly / Annual — annual shows "2 months free" badge |
| Checkout CTA | Primary button | "Continue to Payment" → Stripe Checkout (redirect or embedded) |
| Skip option | Tertiary link | "Start with free tier" — limited access, subscription CTA banner shown persistently |
| Security badges | Footer row | HIPAA compliant · GDPR · 256-bit SSL |

**States:**
- `plan_select` — no plan selected yet; CTA disabled
- `plan_selected` — CTA enabled, summary populated
- `redirecting` — spinner, Stripe session being created
- `success` — returned from Stripe with `?session_id=...`; show celebration screen
- `cancelled` — returned from Stripe with `?cancelled=true`; show "No worries, start free" prompt

---

## Screen 2 — Device Detail Page

**Route:** `/dashboard/devices/[deviceId]`
**Access:** All authenticated users (content gated by tier/subscription)
**Purpose:** Full profile of a single medical device — specs, regulatory status, compatibility data, IFU documents, and the device-specific annotation feed.

### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ ← Back to Hardware Index                                             │
│                                                                      │
│  [Category chip] [Regulatory badge] [Approval badge]                 │
│  Device Name (h1)                      [Request IFU] [+ Annotate]   │
│  Manufacturer · SKU · Model No.                                      │
│                                                                      │
├──────────────────┬───────────────────────────────────────────────────┤
│                  │                                                   │
│  LEFT PANEL      │  RIGHT / MAIN PANEL                               │
│  (sticky nav)    │                                                   │
│                  │  [Tabs: Specifications | Compatibility |          │
│  • Specifications│         Documents | Annotations]                  │
│  • Compatibility │                                                   │
│  • Documents     │  TAB CONTENT AREA                                 │
│  • Annotations   │                                                   │
│    (count badge) │                                                   │
│                  │                                                   │
└──────────────────┴───────────────────────────────────────────────────┘
```

---

### Tab 1 — Specifications

| Section | Components |
|---|---|
| **Header summary** | Device image placeholder (or manufacturer logo) · Short description · Version number |
| **Regulatory status block** | FDA 510(k) number (linked to FDA database) · CE mark number · Status badge (`Approved` / `Recalled` / `Pending`) · `approvedAt` date |
| **Material composition** | Key-value table from `materialComposition` JSON — e.g. Titanium alloy 6Al-4V, PEEK, Cobalt-Chrome |
| **Dimensions** | Responsive table from `dimensionsMm` JSON — diameter, length, head size options |
| **Sterilisation method** | Chip badge — e.g. `ETO` · `Gamma` · `Steam` |
| **Recall / Safety alert banner** | Amber/red banner if any linked alert with `severity >= high` is active; links to safety alerts section |

---

### Tab 2 — Compatibility Matrix

| Section | Components |
|---|---|
| **Compatibility table** | From `compatibilityMatrix` JSON — rows = compatible systems / anatomical sites; columns = confirmed / conditional / contraindicated |
| **Extraction tooling** | Expandable section from `extractionTooling` JSON — tools required, part numbers, torque specs |
| **Warnings** | Red bordered callout box for any compatibility contraindications |
| **Data freshness note** | "Last updated by [Manufacturer] · Version [x]" |

---

### Tab 3 — Documents

| Section | Components |
|---|---|
| **Document list** | Sorted by `documentType` then date — `ifu` at top, then `technical_spec`, `safety_notice`, `image` |
| **Document row** | Icon (PDF/image) · Title · Version · Upload date · File size · [Download] button |
| **Download gate** | Clicking Download: if tier 0 → "Upgrade to access IFU documents"; if subscribed → API call generates pre-signed S3 URL (15 min TTL), opened in new tab |
| **Version history** | Collapsible — shows superseded document versions for audit trail |
| **Upload button** | Visible to `it_procurement` and `system_admin` only → opens upload modal |

---

### Tab 4 — Annotations (Peer Telemetry)

| Section | Components |
|---|---|
| **Feed header** | Annotation count · Sort bar (🔥 Top / 🕐 Newest / 💬 Most Discussed) · Tag filter chips |
| **Annotation cards** | Reuses `<AnnotationCard>` component — vote buttons, tier badge, tags, comment count |
| **Submit annotation CTA** | Sticky button at top-right (or fixed bottom bar on mobile); tier/subscription gated |
| **Empty state** | "No annotations yet for this device. Be the first to share your clinical experience." |

---

## Screen 3 — Annotation Creation Form

**Route:** `/dashboard/annotations/new?deviceId=...` (or modal overlay)
**Access:** Tier 2+ with active subscription
**Purpose:** Let a verified clinician submit a structured peer observation about a specific device.

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Submit Annotation                                         [✕]  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Device  [Micra AV Leadless Pacemaker ▼ ] (pre-filled if from  │
│          device detail page)                                    │
│                                                                 │
│  Type    [ Observation Type ▼ ]     Severity  [ Level ▼ ]      │
│                                                                 │
│  Title   [____________________________________________]         │
│                                                                 │
│  Observation                                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                                                          │  │
│  │  Rich text area — min 20 chars, max 10,000              │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ▼ Procedure Context (optional)                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Procedure type  [_______________________]               │  │
│  │  Date (date only) [  YYYY-MM-DD  ]  ⚠️ No exact times  │  │
│  │  Patient count   [  ___  ]  ⚠️ Aggregate only          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Tags  [ti-6al-4v ×] [cementless ×]  [+ Add tag]              │
│                                                                 │
│  Visibility   ○ My Organisation   ○ Platform-wide              │
│               ℹ️ Platform-wide makes this visible to           │
│                  all verified clinicians                        │
│                                                                 │
│  ☐ Post anonymously (hides your name; role/tier still shown)   │
│                                                                 │
│  ──────────────────────────────────────────────────────────    │
│  [Cancel]                         [Save Draft] [Submit →]      │
└─────────────────────────────────────────────────────────────────┘
```

### Components

| Component | Type | Validation |
|---|---|---|
| Device selector | Searchable dropdown | Required; pre-filled if `?deviceId` param present |
| Annotation type | Dropdown | Required; 5 options |
| Severity | Dropdown | Optional; `low · medium · high · critical` |
| Title | Text input | Required; 5–200 chars |
| Observation body | Textarea | Required; 20–10,000 chars; live char counter |
| Procedure type | Text input | Optional; max 200 chars |
| Procedure date | Date picker | Optional; date-only field; no time to prevent PHI leakage |
| Patient count | Number input | Optional; integer ≥ 1; labelled "Aggregate patient count only" |
| Tag picker | Combobox (multi) | Optional; max 10 tags; shows existing tags + allows new slug |
| Visibility radio | Radio group | Default: `tenant`; platform option adds confirmation dialog |
| Anonymise checkbox | Checkbox | Default unchecked; when checked shows "Your name will not be displayed" |
| Submit button | Primary CTA | Disabled until required fields valid; shows spinner on submit |
| Save Draft | Secondary CTA | Saves to `localStorage` with device+type key (Phase 2: server-side drafts) |

### PHI Warning Callout

> ⚠️ **Reminder: Do not include patient-identifiable information.** Observation body, procedure type, and any free-text fields are reviewed by your organisation's safety officer before publication. Procedure date is stored as date-only (no timestamp). Patient count must be an aggregate number — never an individual identifier.

---

## Screen 4 — Moderation Queue

**Route:** `/dashboard/admin/moderation`
**Access:** `hospital_safety_officer` (own tenant) · `system_admin` (all tenants)
**Purpose:** Review flagged annotations and pending submissions. Approve, reject, or escalate.

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Moderation Queue              [12 pending] [5 flagged]             │
│                                                                     │
│  Tabs:  [Pending Review (12)]  [Flagged (5)]  [Resolved (247)]     │
│                                                                     │
├──────────────────────────────────────────────────────────────────   │
│  Filter: [All Types ▼]  [All Severity ▼]  [Date range: ____]       │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  📄 ANNOTATION CARD                                          │  │
│  │  ─────────────────────────────────────────────────────────  │  │
│  │  [Failure Mode] [High] · Micra AV Leadless Pacemaker        │  │
│  │  Tether traction loss during delivery...                     │  │
│  │                                                              │  │
│  │  Submitted by: Dr. Hannah Nielsen (✓ Verified · Cardiology) │  │
│  │  Submitted: Mar 10, 2026  ·  Tenant: Rigshospitalet         │  │
│  │                                                              │  │
│  │  [📖 View Full]                                              │  │
│  │                                                              │  │
│  │  ── Moderation Actions ──────────────────────────────────── │  │
│  │  Review notes: [________________________________]            │  │
│  │                                                              │  │
│  │  [✅ Approve]   [❌ Reject]   [🔺 Escalate to Admin]       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  [ ... more cards ... ]                                             │
└─────────────────────────────────────────────────────────────────────┘
```

### Components

| Component | Type | Detail |
|---|---|---|
| Tab bar | Tabs | Pending Review · Flagged · Resolved — each with count badge |
| Filter bar | Dropdowns + date range | Type · Severity · Date range · Tenant (admin only) |
| Annotation card | Card component | Full annotation preview; author info; submission metadata |
| "View Full" link | Modal or slide-over | Full annotation body + all comments + vote tally |
| Review notes | Textarea | Optional note attached to approve/reject decision; saved to `reviewNotes` field |
| Approve button | Green CTA | Sets `isPublished = true`, `reviewedById`, `reviewedAt`; sends notification to author |
| Reject button | Red CTA | Sets `isPublished = false`, saves `reviewNotes`; sends rejection notification to author |
| Escalate button | Amber CTA | Available to HSO — notifies `system_admin`; tags annotation `escalated` |
| Bulk actions | Checkbox + action bar | Select multiple pending → bulk approve / bulk reject |
| Empty state (per tab) | Illustration + text | "No items pending — great work!" |

### Flagged Tab — Additional Components

| Component | Detail |
|---|---|
| Flag reason chip | `dangerous` · `inaccurate` · `spam` · `conflict_of_interest` — colour-coded |
| Flag reporter | Name + tier badge; timestamp |
| Flag notes | Reporter's notes field |
| Resolve actions | "Mark Safe" (dismiss flag) · "Remove Annotation" (unpublish) · "Escalate" |

---

## Screen 5 — Admin Dashboard

**Route:** `/dashboard/admin`
**Access:** `hospital_safety_officer` (tenant-scoped) · `system_admin` (platform-wide)
**Purpose:** Central hub for device approval workflows, user tier management, and audit log review.

### Layout

```
┌───────────────────────────────────────────────────────────────────────┐
│  Admin Dashboard                   [Tenant: Rigshospitalet ▼]        │
│                                    (system_admin sees all tenants)   │
├─────────────────────────────┬──────────────────────────────────────── │
│  LEFT SIDEBAR               │  MAIN CONTENT                          │
│  ─────────────────          │  ─────────────────                     │
│  Overview                   │                                        │
│  Device Approval Queue  [5] │  [Section selected in sidebar]        │
│  User Verification      [3] │                                        │
│  Moderation Queue      [12] │                                        │
│  Audit Log                  │                                        │
│  FDA Ingestion Runs         │                                        │
│  Tenant Settings            │                                        │
│  (system_admin only)        │                                        │
│  Tenant Management          │                                        │
└─────────────────────────────┴────────────────────────────────────────┘
```

---

### Section A — Device Approval Queue

| Component | Detail |
|---|---|
| Table | Device name · SKU · Manufacturer · Category · Submitted date · Submitted by |
| Row actions | [Approve] · [Reject] · [Request More Info] |
| Approve modal | Confirmation dialog: "Approve [Device Name]?" + optional note |
| Reject modal | Required rejection reason field + notification preview |
| Status filter | Tabs: `Pending (5)` · `Approved` · `Rejected` |
| Search | Filter by device name, SKU, manufacturer |
| Bulk select | Checkbox column + bulk approve / bulk reject action bar |

---

### Section B — User Verification Queue

| Component | Detail |
|---|---|
| Table | User name · Email · Role · Current tier · Specialty · NPI on file · Submitted date |
| Tier selector | Inline dropdown per row: `T0 · T1 · T2 · T3` with confirmation dialog |
| Tier badge | Colour-coded: `T0` grey · `T1` blue · `T2` green · `T3` purple |
| Reputation score | Inline display of `totalScore` from `user_reputations` |
| Tier filter tabs | All · T0 · T1 · T2 · T3 |
| Bulk promote | Select multiple T1 users → bulk promote to T2 |
| Promotion notes | Text field in confirmation modal — stored in `audit_logs` |

---

### Section C — Audit Log Viewer

```
┌──────────────────────────────────────────────────────────────────────┐
│  Audit Log                     [Export CSV]  [Date: last 7 days ▼]  │
├──────────────────────────────────────────────────────────────────────┤
│  Filter: [All Actions ▼]  [All Users ▼]  [Resource Type ▼]         │
├────────────┬──────────────────────┬─────────────┬────────────────── │
│  Timestamp │  Action              │  User       │  Resource          │
├────────────┼──────────────────────┼─────────────┼────────────────── │
│  14:23:01  │  annotation.approved │  ingrid.s   │  ann-uuid-123...  │
│  14:22:47  │  user.tier_changed   │  admin      │  user-uuid-456... │
│  14:21:10  │  annotation.vote.cast│  dr.nkrumah │  ann-uuid-789... │
│  ...       │  ...                 │  ...        │  ...              │
└────────────┴──────────────────────┴─────────────┴────────────────── │
```

| Component | Detail |
|---|---|
| Table | Timestamp · Action · User (email + role) · Resource type + ID · IP address |
| Row expand | Click row → slide-over showing `oldValues` and `newValues` JSON diff |
| Filters | Action category · User · Resource type · Date range |
| Export | CSV download of filtered results (system_admin only) |
| Immutability notice | Banner: "Audit log entries cannot be modified or deleted. INSERT only." |

---

### Section D — FDA Ingestion Runs (System Admin Only)

| Component | Detail |
|---|---|
| Runs table | Source · Status · Records ingested · Started at · Duration · Triggered by |
| Status chips | `running` (animated dot) · `completed` · `failed` |
| Error detail | Click failed run → shows `errorMessage` |
| Manual trigger | [Run Now] button per source — calls ingestion job |
| Schedule info | Next scheduled run timestamp |

---

## Screen 6 — Subscription Management

**Route:** `/dashboard/settings/subscription`
**Access:** Any authenticated user (content varies by current plan status)
**Purpose:** View current plan, upgrade/downgrade, manage billing, and handle org-level seat management.

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Subscription & Billing                                             │
├──────────────────────────────────┬──────────────────────────────── │
│  CURRENT PLAN CARD               │  PLAN OPTIONS                   │
│  ─────────────────               │  ─────────────                  │
│  ✅ Individual Pro               │  [Free Tier]                    │
│  Renews Mar 11, 2027             │  [Individual Pro]  ← current   │
│  $49 / month                     │  [Org Starter]                  │
│                                  │  [Enterprise → Contact Sales]   │
│  [Manage Billing]                │                                 │
│  (→ Stripe Customer Portal)      │  [Billing cycle: Monthly/Annual]│
│                                  │                                 │
│  Usage this period:              │  [Upgrade / Change Plan]        │
│  • Annotations: 8 / unlimited    │                                 │
│  • IFU downloads: 23             │                                 │
│  • Votes cast: 47                │                                 │
└──────────────────────────────────┴──────────────────────────────── │
│                                                                     │
│  BILLING HISTORY                                                    │
│  ─────────────────────────────────────────────────────────────────  │
│  Mar 11 2026  Individual Pro  $49.00  ✅ Paid  [Invoice PDF]        │
│  Feb 11 2026  Individual Pro  $49.00  ✅ Paid  [Invoice PDF]        │
│  ...                                                                │
│                                                                     │
│  ORG SEATS (if on org plan)                                         │
│  ─────────────────────────────────────────────────────────────────  │
│  12 / 25 seats used    [Invite Member]   [View All Members]         │
└─────────────────────────────────────────────────────────────────────┘
```

### Components

| Component | Type | Detail |
|---|---|---|
| Current plan card | Summary card | Plan name · renewal date · price · status badge |
| Manage Billing button | External link | Opens Stripe Customer Portal in new tab — handles card update, invoice download, cancellation |
| Usage meters | Progress bars | Annotations submitted · IFU downloads · API calls (Phase 2) |
| Plan option cards | Selectable cards | Free · Individual Pro · Org Starter · Enterprise |
| Billing cycle toggle | Toggle | Monthly / Annual — annual shows "Save 17%" |
| Upgrade CTA | Primary button | "Upgrade to [Plan]" — creates Stripe Checkout session |
| Downgrade CTA | Tertiary link | "Downgrade to Free" — shows consequences modal ("You will lose: annotation submit, IFU access, voting") |
| Billing history table | Table | Date · Plan · Amount · Status · Invoice link |
| Org seats section | Visible on org plans only | Seat count · progress bar · invite + manage members links |
| Cancellation flow | Destructive action | Multi-step: reason survey → "Are you sure?" → confirmation; managed via Stripe portal |

### Plan Feature Comparison

| Feature | Free | Individual Pro | Org Starter | Enterprise |
|---|---|---|---|---|
| Browse device catalog | ✅ | ✅ | ✅ | ✅ |
| View annotations (read) | ✅ limited | ✅ | ✅ | ✅ |
| Cast votes | ❌ | ✅ | ✅ | ✅ |
| Leave comments | ❌ | ✅ | ✅ | ✅ |
| Submit annotations | ❌ | ✅ | ✅ | ✅ |
| Access IFU documents | ❌ | ✅ | ✅ | ✅ |
| Organisation tenant | ❌ | ❌ | ✅ up to 25 users | ✅ unlimited |
| Audit log export | ❌ | ❌ | ✅ | ✅ |
| SLA / dedicated support | ❌ | ❌ | ❌ | ✅ |
| FDA MedWatch ingestion | ❌ | ❌ | ✅ | ✅ |
| Custom SSO / SAML | ❌ | ❌ | ❌ | ✅ |

### States

| State | Shown content |
|---|---|
| `free` | Upgrade prompts on all gated features; usage locked at zero |
| `individual_active` | Full individual feature set; no org seat section |
| `org_active` | Full feature set + seat management section |
| `past_due` | Amber banner: "Payment overdue — update card to restore access"; features read-only |
| `cancelled` | Red banner: "Subscription ended on [date]"; all gated features locked; resubscribe CTA |
| `trialling` | Green banner: "Trial ends in X days"; upgrade prompt in plan card |

---

## Design System Notes

All 6 screens use the existing design tokens:

| Token | Value | Usage |
|---|---|---|
| Background primary | `#0a0f1e` (navy) | Page background |
| Background secondary | `#111827` (dark slate) | Cards, sidebars |
| Background tertiary | `#1f2937` | Input fields, table rows |
| Border | `#374151` | Card borders, dividers |
| Text primary | `#f9fafb` | Headings, body |
| Text secondary | `#9ca3af` | Subtext, labels |
| Accent purple | `#7c3aed` | Primary CTAs, active nav |
| Success green | `#10b981` | Approved badges, success states |
| Warning amber | `#f59e0b` | Pending, warnings |
| Danger red | `#ef4444` | Recalled badges, errors, destructive actions |
| Tier 2 green | `#16a34a` | "Verified" badge |
| Tier 3 purple | `#9333ea` | "Trusted" badge |

**Typography:** Geist (headings) + Inter (body) — both loaded via `next/font`.

**Component library:** shadcn/ui + Tailwind CSS — all custom components should extend existing shadcn primitives (`Card`, `Button`, `Badge`, `Dialog`, `Select`, `Tabs`) before introducing new patterns.
