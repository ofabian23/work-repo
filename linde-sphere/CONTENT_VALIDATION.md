# Linde Sphere — Content Validation

> **Purpose:** Make sure no visitor is ever told that an unconfirmed capability is a local Puerto Rico
> offering, and give the sales, legal, and marketing teams a clear process for approving content.
> Technical enforcement: [ARCHITECTURE.md §6](./ARCHITECTURE.md#6-content-model) · ADR-007.

---

## 1. Status definitions

| Status | Meaning | Who may set it |
|---|---|---|
| `validated` | Reviewed and approved for the Puerto Rico market by the responsible approver (§2). Safe to show in production. | Approver for the item's `kind` |
| `assumed` | A reasonable working hypothesis (e.g., a typical healthcare offering) that has **not** been confirmed for Puerto Rico. | Content author |
| `placeholder` | Structural filler for layout and flow (lorem-style or generic). Not a real claim. | Content author |
| `unavailable` | Confirmed **not** offered or not approved for this market/event. Kept for traceability, never shown. | Approver for the item's `kind` |

Visual assets carry a separate `assetStatus`: `approved` | `placeholder`. Asset status does **not** gate
visibility. Placeholder illustrations may appear in any mode, but production readiness reports list them.

## 2. Content kinds and approvers

| Kind | Examples | Approver | Pending indicator in demo mode? |
|---|---|---|---|
| `taxonomy` | Personas, challenges, facility types, environment/scene descriptions, UI copy | Project owner | No (makes no offering claim) |
| `offering` | Solution categories, hotspot panels describing offerings, resources, next steps | **Puerto Rico sales team** | **Yes** |
| `legal` | Consent text, privacy notice, report disclaimer | Legal / compliance | No. Must be `validated` before real visitor data is collected in production. |
| `brand` | Product name, colors, logo, sales contacts | Marketing / sales leadership | No |

## 3. Visibility matrix

| Status ↓ / Mode → | `production` | `demo` | Dev preview (`CONTENT_PREVIEW_PLACEHOLDERS=true`, non-production builds only) |
|---|---|---|---|
| `validated` | Shown | Shown | Shown |
| `assumed` | **Hidden** | Shown; offering items carry the pending-validation indicator | Shown + indicator |
| `placeholder` | **Hidden** | **Hidden** | Shown + loud "PLACEHOLDER" badge |
| `unavailable` | **Hidden** | **Hidden** | **Hidden** (listed only in `content:check` / admin readiness) |

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

## 5. Required metadata per record

```jsonc
{
  "id": "supply-continuity-services",
  "governance": {
    "status": "assumed",
    "kind": "offering",
    "market": "PR",
    "validation": {            // required when status is "validated" or "unavailable"
      "by": "Name, Role",
      "at": "2026-10-15",
      "source": "Sales catalog v3 / meeting notes",
      "notes": "Approved wording; resource link pending"
    }
  }
}
```

`content:check` fails if a `validated` or `unavailable` record lacks `validation.by` and `validation.at`.

## 6. Validation workflow

```
author drafts (placeholder/assumed)
      │
      ▼
content:check passes (schema, translations, references, prohibited claims)
      │
      ▼
review packet generated (content:check --report → Markdown/CSV list per approver)
      │
      ▼
approver decides per record ──► validated (+ by/at/source)
                             ├─► unavailable (+ by/at/reason)
                             └─► changes requested → author edits → re-review
      │
      ▼
contentVersion bumped in settings.json → commit → redeploy to laptop
      │
      ▼
content:check --mode production shows readiness counts; owner signs off in §9
```

Rules:
- Changing the wording of a `validated` offering resets it to `assumed` until re-approved.
- ES and EN versions are approved together.
- Every redeploy of content bumps `contentVersion`, which is stored with every recommendation snapshot
  and report.

## 7. Prohibited content (all modes, all statuses)

Automatically flagged where possible (`content:check` pattern scan), and always checked in review:

- Testimonials, quotes, or customer names/logos not explicitly approved
- Performance metrics, percentages, savings, ROI, or uptime figures
- Regulatory or certification claims (e.g., "compliant with…", "certified…", "FDA/Joint Commission approved")
- Clinical outcome claims or patient-benefit guarantees
- Competitor names or comparisons
- Pricing
- Patient information, case stories with identifiable data, or any PHI
- Copyrighted images or text copied from reference websites

The scan looks for markers such as `%`, currency symbols, "garantiza/guarantee", "certificad*/certified",
"cumple con/compliant", "ahorr*/sav*", "ROI". A flagged record needs an explicit
`"claimsReviewed": true` from a `validated` approver to pass.

## 8. Content registers (initial state, 2026-09-29)

### 8.1 Taxonomy

| Area | Items | Status | Notes |
|---|---|---|---|
| Personas | 10 (PROJECT_BRIEF §4) | `assumed` | Spanish labels are drafts |
| Challenges | 12 (PROJECT_BRIEF §5) | `assumed` | Customer language. Confirm the Spanish phrasing. |
| Facility types | 7 (PROJECT_BRIEF §6) | `assumed` | |
| Environments / scenes | 8 (PROJECT_BRIEF §7) | `assumed` (text) · `placeholder` (art) | Generic educational descriptions only |
| UI strings | `messages/*.json` | `assumed` | Owner review of tone (formal "usted") |

### 8.2 Candidate solution categories (`offering`)

All start as **`assumed`**. These are **working hypotheses for sales review, not claims**. Titles are
phrased around capabilities; descriptions in content must stay generic ("support for…", "options to…")
with no metrics or guarantees.

| # | Proposed ID | Working title (EN) | Related challenges | Related environments | Status |
|---|---|---|---|---|---|
| S1 | `supply-continuity` | Medical gas supply continuity (bulk and cylinder) | Supply continuity, emergencies | Gas plant, campus | `assumed` |
| S2 | `supply-monitoring` | Supply level monitoring and visibility | Monitoring visibility, supply continuity | Gas plant, utilities | `assumed` |
| S3 | `cylinder-inventory` | Cylinder and inventory management support | Operational complexity, workflow efficiency | Patient care, utilities | `assumed` |
| S4 | `pipeline-infrastructure` | Medical gas pipeline and outlet infrastructure support | Modernize infrastructure, facility expansion | Utilities, OR, ICU | `assumed` |
| S5 | `emergency-backup` | Emergency and backup supply planning | Prepare for emergencies | Gas plant, emergency | `assumed` |
| S6 | `compliance-documentation` | Medical gas compliance, testing, and documentation support | Compliance readiness, patient safety | Utilities, gas plant | `assumed` |
| S7 | `clinical-gases-critical-care` | Clinical gases for critical care and surgical areas | Patient safety, workflow efficiency | ICU, OR, emergency | `assumed` |
| S8 | `laboratory-specialty-gases` | Laboratory and specialty gases | Workflow efficiency, supply continuity | Laboratory | `assumed` |
| S9 | `cryogenic-storage` | Cryogenic storage and sample preservation support | Supply continuity, facility expansion | Laboratory | `assumed` |
| S10 | `homecare-respiratory` | Homecare respiratory services | Support care outside the hospital | Patient care (discharge) | `assumed` |
| S11 | `gas-safety-training` | Gas handling safety and staff training | Staff safety, compliance readiness | Utilities, patient care | `assumed` |
| S12 | `lifecycle-cost-review` | Supply and infrastructure lifecycle review | Lifecycle costs, operational complexity | Campus, utilities | `assumed` |
| F0 | `talk-to-specialist` | Speak with a specialist (fallback) | — | — | `assumed` |

The sales team may rename, merge, split, mark `unavailable`, or add categories. Rules and weights are
tuned after the list is confirmed.

### 8.3 Resources (`offering`)

| Item | Status | Notes |
|---|---|---|
| Digital resources (brochures, videos, links) | none yet | Only approved, publicly shareable URLs or local files. Links in reports must be reachable by the visitor. |

### 8.4 Legal

| Item | Status | Notes |
|---|---|---|
| Report consent text (ES/EN) | `placeholder` | Needs legal approval (Q3) |
| Follow-up consent text (ES/EN) | `placeholder` | Needs legal approval (Q3) |
| Privacy notice (short, shown on form) | `placeholder` | Must state purpose, controller, and contact for data requests |
| Report disclaimer (ES/EN) | `assumed` | "Final applicability requires consultation with a qualified representative." |

### 8.5 Brand and contacts

| Item | Status | Notes |
|---|---|---|
| Product name "Linde Sphere" | `assumed` | Owner-chosen; marketing approval pending (Q1) |
| Color palette / typography | `placeholder` | Neutral healthcare palette until brand guidance is provided |
| Logo | not provided | Text wordmark used; no logo files in repository |
| Sales contact for report | `unavailable` | Until provided (Q4); report shows a generic CTA |

### 8.6 Scene illustrations

| Scene | Asset status | Notes |
|---|---|---|
| All 8 environments | `placeholder` | Original simple SVGs created for this project; to be replaced by approved art (Q6) |

## 9. Sign-off log

| Date | Content version | Scope | Approver (name, role) | Decision | Notes |
|---|---|---|---|---|---|
| — | — | — | — | — | No approvals recorded yet |
