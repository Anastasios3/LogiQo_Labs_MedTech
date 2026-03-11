# LogiQo MedTech — User Journey Flowcharts

> **Last updated:** 2026-03-11
> Diagrams are written in [Mermaid](https://mermaid.js.org/). Render in any Mermaid-compatible viewer (GitHub, Notion, VS Code extension, `mermaid.live`).

---

## Journey 1 — Individual Professional Path

A solo clinician (surgeon, safety officer, or specialist) discovers LogiQo independently and subscribes on a personal plan.

```mermaid
flowchart TD
    A([🌐 Discovery\nWeb / referral / conference]) --> B

    B[Visit logiqo.io\nLanding page] --> C

    C{Has hospital\nSSO?} -->|Yes| D1[Auth0 SSO\nHospital IdP]
    C -->|No| D2[Sign up\nEmail + password]

    D1 --> E
    D2 --> E

    E[Auth0 creates account\nPost-registration action fires:\nUser provisioned in DB at Tier 0]

    E --> F[📧 Verification email sent\nClick link to confirm hospital domain]

    F --> G{Email\nverified?}
    G -->|No — resend| F
    G -->|Yes| H

    H[🎉 Tier 1 unlocked\nEmail-Verified Professional\nCan: browse, comment, flag]

    H --> I[Dashboard access\nRead-only view of:\n• Device catalog\n• Platform annotations\n• Safety alerts]

    I --> J[💊 Submit NPI\nProfile → Verification → Enter NPI number]

    J --> K[API calls NPPES registry\nhttps://npiregistry.cms.hhs.gov/api/]

    K --> L{NPI\nvalid?}
    L -->|No — invalid NPI| M[❌ Error: NPI not found\nPrompt to re-enter or contact support]
    M --> J
    L -->|Yes| N

    N[🎉 Tier 2 unlocked\nNPI-Verified Professional\nCan: vote · comment · submit annotations]

    N --> O{Subscribe\nfor full access?}
    O -->|Not yet| P[Continue browsing\nAnnotation submission gated\nSubscribe CTA shown]
    O -->|Yes| Q

    P --> O

    Q[💳 Subscription checkout\nIndividual plan\nStripe / payment provider]

    Q --> R{Payment\nsucceeded?}
    R -->|Failed| S[Payment error\nRetry or use different card]
    S --> Q
    R -->|Yes| T

    T[✅ Active individual subscriber\nFull platform access]

    T --> U[Browse Device Catalog\nSearch · filter · compare specs]
    T --> V[Cast Votes on Annotations\n±1 weighted by specialty relevance]
    T --> W[Leave Comments\nThreaded · anonymized option]
    T --> X[Submit Annotation\nSeverity · procedure context · observation]

    X --> Y[Annotation enters moderation queue\nHSO or admin reviews]
    Y --> Z{Moderation\ndecision}
    Z -->|Approved| AA[📢 Annotation published\nAppears in peer feed]
    Z -->|Rejected| AB[Notification sent\nReason provided]

    AA --> AC{Trusted\nContributor?}
    AC -->|Consistent quality contributions| AD[🏆 Admin promotes to Tier 3\nTrusted Contributor\n1.5× vote weight]
    AD --> T
```

---

## Journey 2 — Organizational Path

An organisation (hospital system, health network, or medtech company) onboards as a tenant. An org admin creates the tenant, subscribes at org level, and invites staff who inherit the subscription.

```mermaid
flowchart TD
    A([🏥 Org Discovery\nProcurement evaluation / demo request]) --> B

    B[Contact sales or self-serve\nlogiqo.io/enterprise] --> C

    C[Org Admin signs up\nPersonal Auth0 account\nTier 0 initially]

    C --> D[Email verification\nTier 1 unlocked]

    D --> E[🏢 Create Organisation\nDashboard → Settings → Create Tenant\nEnter: org name · slug · BAA acknowledgement]

    E --> F{BAA signed?\nHIPAA / GDPR data\nprocessing agreement}
    F -->|No| G[⛔ Tenant creation blocked\nBAA required for PHI handling]
    G --> F
    F -->|Yes| H

    H[Tenant provisioned in DB\nOrg Admin set as system_admin\nwithin tenant]

    H --> I[💳 Org Subscription checkout\nSelect plan tier:\n• Starter — up to 25 users\n• Professional — up to 100 users\n• Enterprise — unlimited + SLA]

    I --> J{Payment / PO\napproved?}
    J -->|No| K[Billing issue\nContact finance / retry]
    K --> I
    J -->|Yes| L

    L[✅ Tenant active + subscribed\nAll invited users inherit subscription\nNo per-seat payment flow for staff]

    L --> M[👥 Invite Staff\nAdmin → Users → Invite\nEnter email + assign role]

    M --> N{Role assigned\nfor each invitee}
    N --> N1[surgeon\nor specialist]
    N --> N2[hospital_safety_officer]
    N --> N3[it_procurement]

    N1 & N2 & N3 --> O[Invite email sent via Auth0\nMagic link / password setup]

    O --> P[Staff registers\nAuth0 account created\nPost-registration: user linked to tenant at Tier 0]

    P --> Q[Staff email verified\nTier 1 → can browse, comment, flag]

    Q --> R{Staff completes\nNPI verification?}
    R -->|Yes, clinician| S1[Tier 2 — NPI Verified\n1.0× vote weight\nFull annotation participation]
    R -->|Non-clinical role| S2[Remains Tier 1–2\nbased on role capabilities\ne.g. IT Procurement at T2 via admin promotion]

    S1 & S2 --> T[Staff active within tenant\nAll data scoped to tenant via RLS]

    T --> U{Role-specific\nworkflows}

    U --> U1[🔬 Surgeon / Clinician\nBrowse devices · vote · comment\nSubmit annotations · peer review]
    U --> U2[🛡️ Safety Officer\nMonitor flagged annotations\nResolve flags · manage moderation queue\nView tenant audit log]
    U --> U3[🛒 IT Procurement\nCompare device specs\nManage device approval workflow\nTrack IFU document versions]

    U1 & U2 & U3 --> V[All activity recorded in\nimmutable audit_logs\nTenant-scoped RLS enforced\non every query]

    V --> W{Org subscription\nrenews?}
    W -->|Yes| T
    W -->|No — lapsed| X[⚠️ Access suspended\nRead-only downgrade\nSubscription renewal prompt]
    X --> I

    T --> Y{Admin promotes\nhigh-quality contributors?}
    Y -->|Yes| Z[Admin → Users → Set Tier 3\nTrusted Contributor\n1.5× vote weight within tenant]
    Z --> T
```

---

## Journey 3 — Verification Tier Lifecycle (Supplemental)

A focused view of how a user's verification tier changes over their lifetime on the platform.

```mermaid
stateDiagram-v2
    [*] --> Tier0 : Registration\n(Auth0 Post-Registration Action)

    Tier0 : Tier 0 — Unverified\n─────────────────\nCan: browse approved devices\nCannot: vote · comment · annotate

    Tier0 --> Tier1 : Hospital domain\nemail confirmed

    Tier1 : Tier 1 — Email Verified\n─────────────────\nCan: browse · comment · flag\nCannot: vote · annotate

    Tier1 --> Tier2_NPI : NPI validated\nvia NPPES API\n(PATCH /users/me/verification)

    Tier1 --> Tier2_Admin : Admin manual promotion\n(PATCH /admin/users/:id/tier)

    Tier2_NPI : Tier 2 — NPI Verified\n─────────────────\nVote weight: 1.0×\nCan: vote · comment · flag · annotate

    Tier2_Admin : Tier 2 — Admin Promoted\n─────────────────\nFor non-clinical roles\n(HSO · IT Procurement)

    Tier2_NPI --> Tier3 : Admin reviews contribution\nhistory and promotes

    Tier2_Admin --> Tier3 : Admin reviews contribution\nhistory and promotes

    Tier3 : Tier 3 — Trusted Contributor\n─────────────────\nVote weight: 1.5×\nCan: approve annotations (own tenant)\n+ all Tier 2 capabilities

    Tier3 --> Tier2_NPI : Admin demotion\n(quality declined)
    Tier2_NPI --> Tier1 : Admin demotion\n(e.g. NPI lapsed)
    Tier1 --> Tier0 : Admin demotion\n(account suspension)

    Tier0 --> [*] : Account deleted
    Tier1 --> [*] : Account deleted
    Tier2_NPI --> [*] : Account deleted
    Tier2_Admin --> [*] : Account deleted
    Tier3 --> [*] : Account deleted
```

---

## Journey 4 — Annotation Lifecycle (Supplemental)

How a single annotation moves through the platform from submission to archival.

```mermaid
flowchart LR
    A([Clinician T2+\nSubmits annotation]) --> B

    B[Created in DB\nisPublished = false\nversion = 1]

    B --> C{Platform\nvisibility?}
    C -->|tenant| D[Visible only to\nown tenant moderators]
    C -->|platform| E[Visible to HSO\nand system_admin\nacross platform]

    D & E --> F{Moderation\nreview}

    F -->|Approved\nHSO / Admin| G[isPublished = true\nAppears in peer feed\nRanked by score]

    F -->|Rejected| H[Notification to author\nReason attached\nisPublished remains false]

    H --> I{Author creates\ncorrection?}
    I -->|Yes| J[New annotation created\nparentId = original.id\nversion = n+1]
    J --> F
    I -->|No| K([Annotation archived\nnot deleted — audit trail])

    G --> L{Community\ninteraction}
    L --> L1[Votes cast\nscore recomputed]
    L --> L2[Comments added\nthreaded replies]
    L --> L3[Tags applied\nby author or HSO]
    L --> L4[Flags raised\nby any T1+ user]

    L4 --> M{Flag severity}
    M -->|dangerous / inaccurate| N[HSO + Admin notified\nAnnotation pending review]
    M -->|spam / conflict| O[Added to moderation queue\nno immediate action]

    N --> P{Resolution}
    P -->|Validated — keep| G
    P -->|Removed — safety risk| Q[isPublished = false\nreason logged in audit_log\nAuthor notified]
    P -->|Disputed — needs expert| R[Escalated to System Admin\nor clinical review committee]

    G --> S{New version\ncreated?}
    S -->|Yes — correction| J
    S -->|No| G
```

---

## Notes

- All state transitions are written to the **immutable `audit_logs` table** — every tier change, annotation publish/reject, and flag resolution has a tamper-proof record.
- **Subscription gates** (marked 🔒 in the RBAC matrix) apply at the API layer before DB queries are executed.
- The `withTenant()` Prisma helper ensures every DB query in these flows carries the correct RLS tenant context, so cross-tenant data leakage is impossible at the database level.
