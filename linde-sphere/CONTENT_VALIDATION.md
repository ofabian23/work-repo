# Linde Sphere — Content Validation

> **Purpose:** Make sure no visitor is ever told that an unconfirmed capability is a local Puerto Rico
> offering, and give the sales, legal, and marketing teams a clear process for approving content.
> Technical enforcement: [ARCHITECTURE.md §6](./ARCHITECTURE.md#6-content-model) · ADR-007, ADR-027.

---

## 1. Status definitions

| Status        | Meaning                                                                                                                | Who may set it                     |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `validated`   | Reviewed and approved for the Puerto Rico market by the responsible approver (§2). Safe to show in production.         | Approver for the content type (§2) |
| `assumed`     | A reasonable working hypothesis (e.g., a typical healthcare offering) that has **not** been confirmed for Puerto Rico. | Content author                     |
| `placeholder` | Structural filler for layout and flow (lorem-style or generic). Not a real claim.                                      | Content author                     |
| `unavailable` | Confirmed **not** offered or not approved for this market/event. Kept for traceability, never shown.                   | Approver for the content type (§2) |

Visual assets carry a separate `assetStatus`: `approved` | `placeholder`. Asset status does **not** gate
visibility. Placeholder illustrations may appear in any mode, but production readiness reports list them.

## 2. Content types and approvers

The content type follows from the file an item lives in; there is no separate `kind` field (ADR-027).

| Content type | Files / entities                                                                                          | Approver                     | Pending indicator in demo mode?                                              |
| ------------ | --------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------- |
| Taxonomy     | `personas.json`, `challenges.json`, `facility-types.json`, `scenes/*.json` (scene text, hotspots)         | Project owner                | No (makes no offering claim)                                                 |
| Offering     | `solutions.json`, `digital-assets.json` (full governance metadata), solution hotspots via their solutions | **Puerto Rico sales team**   | **Yes**, on every non-validated solution and asset                           |
| Rules        | `recommendation-rules.json`                                                                               | Project owner + sales        | No (rules are never shown directly)                                          |
| Legal        | `consent.json`; report disclaimer (planned `report.json`)                                                 | Legal / compliance           | No. Must be `validated` before real visitor data is collected in production. |
| Brand        | Planned `brand.json`, `sales-contacts.json`                                                               | Marketing / sales leadership | No                                                                           |

## 3. Visibility matrix

| Status ↓ / Mode → | `production` | `demo`                                                       | Dev preview (`CONTENT_PREVIEW_PLACEHOLDERS=true`, non-production builds only) |
| ----------------- | ------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `validated`       | Shown        | Shown                                                        | Shown                                                                         |
| `assumed`         | **Hidden**   | Shown; offering items carry the pending-validation indicator | Shown + indicator                                                             |
| `placeholder`     | **Hidden**   | **Hidden**                                                   | Shown + loud "PLACEHOLDER" badge                                              |
| `unavailable`     | **Hidden**   | **Hidden**                                                   | **Hidden** (listed only in `content:check` / admin readiness)                 |

The same filter is applied to the **kiosk UI, the server-side recommendation recomputation, and the
emailed report**. The report can never contain content the visitor could not see.

**Reference pruning:** if a visible item references a hidden one (e.g., a solution links to an unvalidated
resource), the reference is dropped silently. It is never rendered as a broken or empty element.

**Fallbacks:** if filtering leaves a list empty (e.g., no validated solutions match), the configured
fallback recommendation ("Speak with a specialist") is used. The fallback must itself be visible in the
active mode; `content:check --mode production` fails if it is not.

## 4. Pending-validation indicator

- **Text (ES):** "Contenido pendiente de validación local"
- **Text (EN):** "Content pending local validation"
- **UI:** small, low-emphasis label (icon + text) on each assumed offering card/panel. Readable (≥ 16 px,
  AA contrast) but not alarming.
- **Report:** same note beside each assumed item. In demo mode, a footer line reads: "Parte del
  contenido de este informe está pendiente de validación para Puerto Rico." / "Some content in this
  report is pending validation for Puerto Rico."
- The indicator text itself is `taxonomy` content and can be reworded by the owner.

## 5. Required metadata

Every **solution** and **digital asset** carries these governance fields (flat, next to the content):

```jsonc
{
  "id": "medical-gas-supply-continuity",
  // …content fields…
  "validationStatus": "assumed", // validated | assumed | placeholder | unavailable
  "market": "global-reference", // puerto-rico | united-states-reference | global-reference | unknown
  "internalNotes": "DEMONSTRATIVE ASSUMPTION - … requires Puerto Rico sales validation …",
  "lastReviewedAt": null, // YYYY-MM-DD, required once validated/unavailable
  "reviewedBy": null, // "Name, Role", required once validated/unavailable
  "sourceLabel": "Linde Sphere seed content - working hypothesis, not a sales catalog",
  "requiresSalesValidation": true,
}
```

Schema-enforced rules (`npm run content:check` fails otherwise):

- `validated` or `unavailable` ⇒ `reviewedBy` and `lastReviewedAt` are required.
- `validated` ⇒ `market` must be `puerto-rico` and `requiresSalesValidation` must be `false`.
- `assumed` or `placeholder` ⇒ `requiresSalesValidation` must be `true`.
- A validated digital asset cannot point to a reserved `example.com/.org/.net` URL.

`internalNotes`, `reviewedBy`, `sourceLabel`, `lastReviewedAt`, `requiresSalesValidation` and `market` are
**internal**. The visibility filter strips them before content reaches the kiosk or a report.

Taxonomy items, scenes, hotspots, rules and consent text carry `validationStatus` (plus `internalNotes`
on rules and consent). Promoting them to `validated` is recorded in the sign-off log (§9).

## 6. Running the content check

```bash
npm run content:check                       # demo mode: schema + cross-reference + claims scan
npm run content:check -- --mode production  # also fails unless production-ready (see below)
npm run content:check -- --strict           # warnings also fail
```

Output lists every issue as `file → path: message`, followed by a validation-status summary and how many
items are visible in the chosen mode. Exit code `0` means valid; `1` means errors.

Checks run in two stages: **per-file schema validation** first, then **cross-record checks** (dangling
references, duplicate ids, scene tree/breadcrumbs, one rule per solution, reachable thresholds, the
prohibited-claim scan). Cross-record checks run only once every file passes its schema.

Production readiness requires validated personas, challenges, scenes, a validated fallback solution, at
least one validated rule for a validated solution, and validated consent text.

Current known warnings: the 8 scenes reference placeholder SVG files that are created in Phase 6.

## 7. Validation workflow

```
author drafts (placeholder/assumed)
      │
      ▼
content:check passes (schema, translations, references, prohibited claims)
      │
      ▼
review packet per approver (content:check summary today; a --report export is planned)
      │
      ▼
approver decides per record ──► validated (+ reviewedBy/lastReviewedAt/sourceLabel, market puerto-rico)
                             ├─► unavailable (+ reviewedBy/lastReviewedAt, reason in internalNotes)
                             └─► changes requested → author edits → re-review
      │
      ▼
contentVersion bumped in content/manifest.json → commit → redeploy to laptop
      │
      ▼
content:check --mode production shows readiness counts; owner signs off in §10
```

Rules:

- Changing the wording of a `validated` offering resets it to `assumed` until re-approved.
- ES and EN versions are approved together.
- Every redeploy of content bumps `contentVersion`, which is stored with every recommendation snapshot
  and report.

## 8. Prohibited content (all modes, all statuses)

Automatically flagged where possible (`content:check` pattern scan), and always checked in review:

- Testimonials, quotes, or customer names/logos not explicitly approved
- Performance metrics, percentages, savings, ROI, or uptime figures
- Regulatory or certification claims (e.g., "compliant with…", "certified…", "FDA/Joint Commission approved")
- Clinical outcome claims or patient-benefit guarantees
- Competitor names or comparisons
- Pricing
- Patient information, case stories with identifiable data, or any PHI
- Copyrighted images or text copied from reference websites

`content:check` scans every localized string in solutions, digital assets, rules, scenes/hotspots, personas
and challenges for these markers: percentage figures, currency amounts, "garantiz*/guarant*",
"certificado(a)/certified", "cumple con/compliant", "ahorr*/savings/save", "ROI" and "testimoni*". Any
match is an **error**. There is deliberately no override flag. If approved wording ever needs one of
these terms, it requires a documented decision (DECISIONS.md) and a code change.

## 9. Content registers (initial state, 2026-09-29)

### 9.1 Taxonomy

| Area                  | Items                 | Status                                 | Notes                                            |
| --------------------- | --------------------- | -------------------------------------- | ------------------------------------------------ |
| Personas              | 10 (PROJECT_BRIEF §4) | `assumed`                              | Spanish labels are drafts                        |
| Challenges            | 12 (PROJECT_BRIEF §5) | `assumed`                              | Customer language. Confirm the Spanish phrasing. |
| Facility types        | 7 (PROJECT_BRIEF §6)  | `assumed`                              |                                                  |
| Environments / scenes | 8 (PROJECT_BRIEF §7)  | `assumed` (text) · `placeholder` (art) | Generic educational descriptions only            |
| UI strings            | `messages/*.json`     | `assumed`                              | Owner review of tone (formal "usted")            |

### 9.2 Sample solution categories (offering)

All 13 seed solutions in `content/solutions.json` are **demonstrative assumptions, not confirmed Puerto
Rico offerings**. Each is `validationStatus: "assumed"`, `market: "global-reference"`,
`requiresSalesValidation: true`, and its `internalNotes` states that it requires Puerto Rico sales
validation. Descriptions stay generic ("support for…", "options…", "may be relevant") with no metrics or
guarantees.

| #   | ID                              | Working title (EN)                                         | Related challenges                           | Related environments     | Status    |
| --- | ------------------------------- | ---------------------------------------------------------- | -------------------------------------------- | ------------------------ | --------- |
| S1  | `medical-gas-supply-continuity` | Medical gas supply continuity (bulk and cylinder)          | Supply continuity, emergencies               | Gas plant, campus        | `assumed` |
| S2  | `supply-level-monitoring`       | Supply level monitoring and visibility                     | Monitoring visibility, supply continuity     | Gas plant, utilities     | `assumed` |
| S3  | `cylinder-inventory-management` | Cylinder and inventory management support                  | Operational complexity, workflow efficiency  | Patient care, utilities  | `assumed` |
| S4  | `pipeline-infrastructure`       | Medical gas pipeline and outlet infrastructure support     | Modernize infrastructure, facility expansion | Utilities, OR, ICU       | `assumed` |
| S5  | `emergency-backup-planning`     | Emergency and backup supply planning                       | Prepare for emergencies                      | Gas plant, emergency     | `assumed` |
| S6  | `compliance-documentation`      | Medical gas compliance, testing, and documentation support | Compliance readiness, patient safety         | Utilities, gas plant     | `assumed` |
| S7  | `clinical-gases-critical-care`  | Clinical gases for critical care and surgical areas        | Patient safety, workflow efficiency          | ICU, OR, emergency       | `assumed` |
| S8  | `laboratory-specialty-gases`    | Laboratory and specialty gases                             | Workflow efficiency, supply continuity       | Laboratory               | `assumed` |
| S9  | `cryogenic-storage`             | Cryogenic storage and sample preservation support          | Supply continuity, facility expansion        | Laboratory               | `assumed` |
| S10 | `homecare-respiratory-services` | Homecare respiratory services                              | Support care outside the hospital            | Patient care (discharge) | `assumed` |
| S11 | `gas-safety-training`           | Gas handling safety and staff training                     | Staff safety, compliance readiness           | Utilities, patient care  | `assumed` |
| S12 | `lifecycle-cost-review`         | Supply and infrastructure lifecycle review                 | Lifecycle costs, operational complexity      | Campus, utilities        | `assumed` |
| F0  | `talk-to-specialist`            | Speak with a specialist (fallback)                         | —                                            | —                        | `assumed` |

The sales team may rename, merge, split, mark `unavailable`, or add categories. Rules and weights are
tuned after the list is confirmed.

### 9.3 Digital assets (offering)

| Item                                                                                       | Status        | Notes                                                                                                                                                               |
| ------------------------------------------------------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `asset-medical-gas-overview`, `asset-emergency-planning-checklist`, `asset-homecare-guide` | `placeholder` | Point to `example.com` placeholders; hidden in every mode. Replace with approved, publicly shareable resources (links in reports must be reachable by the visitor). |

### 9.4 Legal

| Item                                  | Status        | Notes                                                                               |
| ------------------------------------- | ------------- | ----------------------------------------------------------------------------------- |
| Report consent text (ES/EN)           | `placeholder` | `content/consent.json` v0.1.0, marked [BORRADOR]/[DRAFT]; needs legal approval (Q3) |
| Follow-up consent text (ES/EN)        | `placeholder` | Needs legal approval (Q3)                                                           |
| Privacy notice (short, shown on form) | `placeholder` | Must state purpose, controller, and contact for data requests                       |
| Report disclaimer (ES/EN)             | `assumed`     | "Final applicability requires consultation with a qualified representative."        |

### 9.5 Brand and contacts

| Item                        | Status        | Notes                                                       |
| --------------------------- | ------------- | ----------------------------------------------------------- |
| Product name "Linde Sphere" | `assumed`     | Owner-chosen; marketing approval pending (Q1)               |
| Color palette / typography  | `placeholder` | Neutral healthcare palette until brand guidance is provided |
| Logo                        | not provided  | Text wordmark used; no logo files in repository             |
| Sales contact for report    | `unavailable` | Until provided (Q4); report shows a generic CTA             |

### 9.6 Scene illustrations

| Scene              | Asset status  | Notes                                                                                                           |
| ------------------ | ------------- | --------------------------------------------------------------------------------------------------------------- |
| All 8 environments | `placeholder` | Paths defined in scene files; original simple SVGs are drawn in Phase 6 and later replaced by approved art (Q6) |

## 10. Sign-off log

| Date | Content version | Scope | Approver (name, role) | Decision | Notes                     |
| ---- | --------------- | ----- | --------------------- | -------- | ------------------------- |
| —    | —               | —     | —                     | —        | No approvals recorded yet |
