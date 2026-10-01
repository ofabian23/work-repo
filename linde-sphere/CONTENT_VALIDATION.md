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

**Production guard (ADR-060).** Production has two independent conditions:

- **Sales approval:** a persona, challenge, solution or digital asset appears only if it is `validated`
  **and** its `salesReview.approvalStatus` is `approved` (not `remove`). The content check already
  refuses `validated` without approval; the filter enforces it again, so an unchecked file cannot leak.
- **Legal text:** consent text and report copy are sent to the kiosk only once `validated`. Until then the
  privacy sheet shows a neutral notice and the kiosk collects no leads (the "send me a summary" step is
  hidden and the API refuses submissions).
- **Visitor experience:** entry paths without visible content are hidden. With nothing approved,
  visitors see "we are preparing this experience".

Tests cover every status × approval × decision combination, the served page (a production-mode E2E
server), and the lead API.

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
  "id": "backup-emergency-supply",
  // …content fields…
  "validationStatus": "assumed", // validated | assumed | placeholder | unavailable
  "market": "global-reference", // puerto-rico | united-states-reference | global-reference | unknown
  "internalNotes": "PENDING PUERTO RICO VALIDATION - demonstrative assumption … requires Puerto Rico sales validation …",
  "lastReviewedAt": null, // YYYY-MM-DD, required once validated/unavailable
  "reviewedBy": null, // "Name, Role", required once validated/unavailable
  "sourceLabel": "Linde Sphere seed content - working hypothesis, not a sales catalog",
  "requiresSalesValidation": true,
  // Personas, challenges, solutions and digital assets: the sales-validation worksheet (ADR-060,
  // SALES_VALIDATION_GUIDE.md)
  "salesReview": {
    "availableInPuertoRico": "unknown", // yes | no | unknown
    "decision": "pending", // pending | keep | remove | rename
    "proposedName": null, // { es, en } when decision is "rename"
    "requiredCorrection": "", // what must change before approval; empty once applied
    "missingDigitalMaterial": "", // brochure, image, video or technical sheet still missing
    "salesOwner": null, // accountable sales team member (role or name)
    "approvalStatus": "not-started", // not-started | in-review | changes-requested | approved | rejected
    "conventionPriority": "high", // high | medium | low | unset
    "priorityConfirmedBySales": false,
    "notes": "Priority proposed by the project team; sales to confirm.",
  },
}
```

Schema-enforced rules (`npm run content:check` fails otherwise):

- `validated` or `unavailable` ⇒ `reviewedBy` and `lastReviewedAt` are required.
- `validated` ⇒ `market` must be `puerto-rico` and `requiresSalesValidation` must be `false`.
- `assumed` or `placeholder` ⇒ `requiresSalesValidation` must be `true`.
- A validated digital asset cannot point to a reserved `example.com/.org/.net` URL.
- Sales review and status must agree (personas, challenges, solutions and assets; ADR-060):
  - **Validated needs approval:** `validated` ⇔ `approvalStatus: "approved"` (unless the decision is
    `remove`).
  - **Approval needs complete answers:** a decision (`keep`, `rename` or `remove`), a `salesOwner`,
    Puerto Rico availability not `unknown`, and an empty `requiredCorrection`.
  - **Offerings:** a validated solution or asset needs `availableInPuertoRico: "yes"`.
  - **Removal:** `availableInPuertoRico: "no"` or decision `remove` ⇒ `validationStatus: "unavailable"`.
  - **Renames:** `rename` needs `proposedName`, and a validated rename must display exactly the
    `proposedName`.

`internalNotes`, `reviewedBy`, `sourceLabel`, `lastReviewedAt`, `requiresSalesValidation`, `market` and
`salesReview` are **internal**. The visibility filter strips them before content reaches the kiosk or a report.

Personas and challenges carry `validationStatus` and the same `salesReview` worksheet. Facility types,
scenes, hotspots, rules and consent text carry `validationStatus` (plus `internalNotes` on rules and
consent). Promoting any item to `validated` is recorded in the sign-off log (§9).

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

`content/engine-settings.json` holds the engine's whole-number caps and bonuses, the result sizes, the
relevance thresholds ("Muy relevante" ≥ 9, "Relevante" ≥ 5) and the readiness thresholds (ARCHITECTURE §7.4).
It is configuration approved by the project owner, not a claim, so it has no validation status. After
changing it, run `npm run content:export` so the coverage tables below stay current.

The check also warns when a scene lacks a navigation, information or solution hotspot, or when two hotspots
are closer than 8 % of the art box. The seed content currently produces no warnings (v0.4.0).

## 7. Validation workflow

```
author drafts (placeholder/assumed)
      │
      ▼
content:check passes (schema, translations, references, prohibited claims)
      │
      ▼
review packet per approver (sales: exports/sales-validation.csv or the admin page "Validación de ventas",
answered with SALES_VALIDATION_GUIDE.md)
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

- Claims that something is available or offered in Puerto Rico (only the sales review decides that, §11)
- Named products, trademarks (™ ®) and superlatives ("leading", "líder", "world-class")

`content:check` scans every localized string in solutions, digital assets, rules, scenes/hotspots, personas
and challenges for these markers: percentage figures, currency amounts, "garantiz*/guarant*",
"certificado(a)/certified", "cumple con/compliant", "ahorr*/savings/save", "ROI", "testimoni*",
"disponible/available/ofrecido/offered en/in Puerto Rico", regulatory references (NFPA, FDA, OSHA, CMS, USP,
Joint Commission, ISO numbers), cost-reduction wording ("reduce costos", "reduces costs", "cost
reduction"), performance wording ("24/7", "uptime", "tiempo de actividad", "sin interrupciones"),
™ ® © and superlatives. Any
match is an **error**. There is deliberately no override flag. If approved wording ever needs one of
these terms, it requires a documented decision (DECISIONS.md) and a code change.

## 9. Content registers (initial state, 2026-09-29)

### 9.1 Taxonomy

| Area                  | Items                                                    | Status                                 | Notes                                                                                                                                   |
| --------------------- | -------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Personas              | 10 (PROJECT_BRIEF §4) + "Mi función abarca varias áreas" | `assumed`                              | Spanish labels are drafts; descriptions shortened to ~2 lines for the kiosk (v0.3.0); `multiple-areas` must never be weighted by a rule |
| Challenges            | 12 (PROJECT_BRIEF §5)                                    | `assumed`                              | Customer language (v0.2.0 list). Confirm Spanish.                                                                                       |
| Facility types        | 7 (PROJECT_BRIEF §6)                                     | `assumed`                              |                                                                                                                                         |
| Environments / scenes | 8 (PROJECT_BRIEF §7)                                     | `assumed` (text) · `placeholder` (art) | Generic educational descriptions only                                                                                                   |
| UI strings            | `src/data/i18n/*.ts`                                     | `assumed`                              | Owner review of tone (formal "usted")                                                                                                   |

### 9.2 Sample solution categories (offering)

`content/solutions.json` (content v0.2.0) holds 10 assumed categories plus the "Talk with a specialist"
fallback. **All are demonstrative assumptions pending Puerto Rico validation, not confirmed Puerto Rico
offerings.** Each has `validationStatus: "assumed"`, `market: "global-reference"`,
`requiresSalesValidation: true`, `salesReview.availableInPuertoRico: "unknown"`, and
`internalNotes` beginning with "PENDING PUERTO RICO VALIDATION". In demo mode the kiosk and report show
the "Content pending local validation" indicator on each one; production mode hides them.

Medical gas supply planning · Bulk or centralized supply · Cylinder and inventory management · Backup and
emergency supply · Monitoring and telemetry · Medical gas infrastructure assessment · Preventive service
and maintenance · Clinical oxygen support · Ambulatory and homecare support · Training and operational
readiness.

Descriptions describe scope only ("options for…", "support for…", "a review of…") and relevance ("may be
relevant when…"). They make no claims about specific products, savings, compliance, performance or local
availability. The generated worksheet in §11 lists every category per decision, and the CSV export
contains every content item.

### 9.3 Digital assets (offering)

| Item                                                                                       | Status        | Notes                                                                                                                                                               |
| ------------------------------------------------------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `asset-medical-gas-overview`, `asset-emergency-planning-checklist`, `asset-homecare-guide` | `placeholder` | Point to `example.com` placeholders; hidden in every mode. Replace with approved, publicly shareable resources (links in reports must be reachable by the visitor). |

### 9.4 Legal

| Item                                           | Status        | Notes                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Report consent text (ES/EN)                    | `placeholder` | `content/consent.json` v0.1.0, marked [BORRADOR]/[DRAFT]; needs legal approval (Q3)                                                                                                                                                                                                                                                |
| Follow-up consent text (ES/EN)                 | `placeholder` | Needs legal approval (Q3)                                                                                                                                                                                                                                                                                                          |
| Privacy notice (short, shown on form)          | `placeholder` | Must state purpose, controller, and contact for data requests                                                                                                                                                                                                                                                                      |
| Report disclaimer (ES/EN)                      | `assumed`     | "Final applicability requires consultation with a qualified representative."                                                                                                                                                                                                                                                       |
| Privacy summary sheet (UI, ES/EN)              | `assumed`     | `src/data/i18n` `privacy.points.*`: four plain-language statements shown from the welcome screen before any data is collected; legal review pending together with the privacy notice                                                                                                                                               |
| Recommendation and summary screens (UI, ES/EN) | `assumed`     | `src/data/i18n` `recommendations.*`, `summary.*`, `tray.*`: heading, disclaimer (not a complete assessment or clinical advice), demo notice, "Solicitar mi resumen personalizado", summary contents and the consent sentence. Needs marketing and legal review; the wording is checked by `tests/unit/app/copy-principles.test.ts` |
| Role journey UI copy (ES/EN)                   | `assumed`     | `src/data/i18n` `role.*`, `roleChallenges.*`, `somethingElse.*`, `tailoring.*`, `nextSteps.*`, `recommendations.*`: states that recommendations are indicative and a specialist confirms what applies; no claims                                                                                                                   |
| Lead retention period                          | `placeholder` | Not decided (Q7). `LEAD_RETENTION_DAYS` is an empty placeholder; nothing is deleted automatically. Owner/compliance must approve a period before a purge command is added (ADR-052)                                                                                                                                                |
| Consent text version on stored leads           | `assumed`     | Each lead stores `consentTextVersion`; the server rejects submissions whose version differs from `content/consent.json`, so bump `version` whenever legal changes the wording                                                                                                                                                      |
| Lead form and confirmation copy (UI, ES/EN)    | `assumed`     | `src/data/i18n` `leadForm.*`: field labels, hints ("No incluya información de pacientes"), validation messages, the two-permissions explanation, failure and result messages (saved / sent / delayed, masked email). Needs marketing and legal review; checked by the copy-principles test                                         |
| Report copy (`content/report.json`, ES/EN)     | `placeholder` | Title, subject, introduction, consultation call to action, disclaimer, privacy footer and pending notice; disclaimer and footer marked [BORRADOR]/[DRAFT]. Needs marketing and legal approval (Q3); production requires `validated`                                                                                                |
| Report sales contact                           | `placeholder` | Dummy "Equipo comercial (ejemplo)" / `ventas@example.com`. Real name, email and phone come from sales (Q4); a validated report cannot use an example address                                                                                                                                                                       |
| Report section labels (ES/EN)                  | `assumed`     | `src/server/report/report-messages.ts` ("Sus prioridades", "Por qué apareció", …). Needs marketing review                                                                                                                                                                                                                          |

### 9.5 Brand and contacts

| Item                        | Status        | Notes                                                                                                                                             |
| --------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product name "Linde Sphere" | `assumed`     | Owner-chosen; marketing approval pending (Q1)                                                                                                     |
| Color palette / typography  | `placeholder` | Neutral healthcare palette until brand guidance is provided                                                                                       |
| Logo                        | not provided  | Text wordmark used in the UI; the gas-plant scene art shows a Linde wordmark (see §9.6, A12)                                                      |
| Sales contact for report    | `unavailable` | Until provided (Q4); report shows a generic CTA                                                                                                   |
| Persona icons (10 PNG)      | not used      | Delivered 2026-10-01 in `public/assets/brand/icons/personas/`; not referenced by the kiosk. Using them is a separate change (approval and layout) |

### 9.6 Scene illustrations

| Scene                      | Asset status           | Notes                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All 8 environments (art)   | `approved`             | Approved illustrations delivered by the project owner (commits `a88bd1e`, `440154a` on `main`; described as approved in the request of 2026-10-01). Originals unchanged in `art-source/scenes/prototype1/` (provenance, sizes and SHA-256 in `art-source/README.md`); optimized WebP copies at 640–1536 px in `public/assets/scenes/approved/` (`npm run art:scenes`, ADR-063). No written Linde Marketing sign-off on file (A12) |
| Scene → original mapping   | `approved`             | campus = Scene 2, emergency = Scene 3, icu = Scene 4, operating-room = Scene 5, patient-care = Scene 6, laboratory = Scene 7, gas-plant = Scene 8, utilities = Scene 9. Scene 1, Homecare Ecosystem and Scene 11 have no scene and are **not shown**                                                                                                                                                                              |
| Art box and hotspots       | `assumed`              | Art box changed from 1200 × 1500 (4:5) to the art's 1536 × 2752 proportions; every hotspot was checked against the new art and moved onto its feature (only emergency-critical-gases, icu-clinical-oxygen, gas-plant-to-utilities, utilities-maintenance and utilities-safety-training already sat on a matching feature). Labels and accessible labels unchanged. Alt texts rewritten (ES/EN) to describe the new images         |
| Campus laboratory route    | `assumed`              | The campus art has no explicit laboratory: `campus-to-laboratory` sits on the "Diagnostic Imaging" floor. Needs content review                                                                                                                                                                                                                                                                                                    |
| Text in the artwork        | needs review           | Baked-in English labels ("Ambulance Bay", "Critical Care", "Bulk oxygen tank", "IBER…") on a Spanish-first kiosk; misspellings ("Cryygenic", "Backup eais safety systems", "High-tech conduits it to…"); descriptive labels ("Digital remote monitoring array") to check against the no-unvalidated-claims rule. **[Linde Marketing]**                                                                                            |
| Brand marks in the artwork | needs review           | Gas plant: legible **Linde** wordmark on the bulk tank. Campus: stylized, illegible wordmark on the tank. **[Linde Marketing]** (A12)                                                                                                                                                                                                                                                                                             |
| Placeholder SVGs           | `placeholder` (unused) | The original generated 4:5 SVGs stay in `public/assets/scenes/placeholder/` but are no longer referenced; `content:check` refuses them for approved scenes because their proportions differ                                                                                                                                                                                                                                       |
| New hotspots (v0.4.0)      | `assumed`              | `campus-supply-network`, `gas-plant-perimeter`, and navigation hotspots between areas (`emergency-to-icu`, `icu-to-operating-room`, `operating-room-to-icu`, `patient-care-to-emergency`, `lab-to-gas-plant`, `utilities-to-gas-plant`); the perimeter text describes common practice without compliance claims                                                                                                                   |

## 10. Sign-off log

| Date | Content version | Scope | Approver (name, role) | Decision | Notes                     |
| ---- | --------------- | ----- | --------------------- | -------- | ------------------------- |
| —    | —               | —     | —                     | —        | No approvals recorded yet |

## 11. Sales review worksheet (generated)

Do not edit between the markers by hand. Run `npm run content:export` after changing `content/`.
`npm run check` fails if this section or the CSV is out of date.

<!-- BEGIN GENERATED: sales-review (npm run content:export) -->

### 11.1 How to use this worksheet

The tables below are generated from `content/` by `npm run content:export`, which also writes
[`exports/content-validation.csv`](./exports/content-validation.csv) (UTF-8, opens in Excel). Every sample
solution is a **demonstrative assumption pending Puerto Rico validation**. The sales team answers in the
sales-validation worksheet ([`exports/sales-validation.csv`](./exports/sales-validation.csv) or the admin page
"Validación de ventas"), following [SALES_VALIDATION_GUIDE.md](./SALES_VALIDATION_GUIDE.md). The project team
records the answers in each item's `salesReview` (personas, challenges, solutions and digital assets), then runs
`npm run content:export`. Removed or not-available items must also be set to `validationStatus: "unavailable"`
(the schema enforces this).

### 11.2 Keep

_None yet. Awaiting the Puerto Rico sales review._

### 11.3 Remove

_None yet. Awaiting the Puerto Rico sales review._

### 11.4 Rename

_None yet. Awaiting the Puerto Rico sales review._

### 11.5 Available in Puerto Rico

_None yet. Awaiting the Puerto Rico sales review._

### 11.6 Not available in Puerto Rico

_None yet. Awaiting the Puerto Rico sales review._

### 11.7 Requires verification

Confirm for each: whether it is offered in Puerto Rico, the approved name in both languages, and the scope
described in the summary.

| ID                               | Name (EN)                             | Name (ES)                                             | Summary shown to visitors (EN)                                                                                               |
| -------------------------------- | ------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `medical-gas-supply-planning`    | Medical gas supply planning           | Planificación del suministro de gases medicinales     | A joint review of how medical gases are supplied today and what your organization will need as it changes.                   |
| `bulk-centralized-supply`        | Bulk or centralized supply            | Suministro a granel o centralizado                    | Options for supplying medical gases from a central point, such as a tank or supply station, instead of individual cylinders. |
| `cylinder-inventory-management`  | Cylinder and inventory management     | Manejo de cilindros e inventario                      | Support for organizing, locating and replenishing cylinders across hospital areas.                                           |
| `backup-emergency-supply`        | Backup and emergency supply           | Suministro de respaldo y emergencias                  | Planning of backup sources and supply procedures for hurricanes, power outages or other disruptions.                         |
| `monitoring-telemetry`           | Monitoring and telemetry              | Monitoreo y telemetría                                | Tools to check the status of tanks, levels or supply systems remotely.                                                       |
| `infrastructure-assessment`      | Medical gas infrastructure assessment | Evaluación de la infraestructura de gases medicinales | A review of the condition of your facility's medical gas distribution network, outlets and equipment.                        |
| `preventive-service-maintenance` | Preventive service and maintenance    | Servicio preventivo y mantenimiento                   | Planned inspection and maintenance programs for medical gas systems.                                                         |
| `clinical-oxygen-support`        | Clinical oxygen support               | Apoyo en oxígeno clínico                              | Support related to supplying medical oxygen to clinical areas such as emergency, intensive care and inpatient floors.        |
| `ambulatory-homecare-support`    | Ambulatory and homecare support       | Apoyo para cuidado ambulatorio y en el hogar          | Support for patients who continue respiratory therapy outside the hospital, in outpatient centers or at home.                |
| `training-operational-readiness` | Training and operational readiness    | Capacitación y preparación operacional                | Training for staff on safe handling of medical gases and on the procedures your organization defines.                        |

### 11.8 Missing asset

**Solutions without an approved digital asset** (reports will show no resource links):

| ID                               | Name (EN)                             | Linked placeholder assets          |
| -------------------------------- | ------------------------------------- | ---------------------------------- |
| `medical-gas-supply-planning`    | Medical gas supply planning           | asset-medical-gas-overview         |
| `bulk-centralized-supply`        | Bulk or centralized supply            | asset-medical-gas-overview         |
| `cylinder-inventory-management`  | Cylinder and inventory management     | —                                  |
| `backup-emergency-supply`        | Backup and emergency supply           | asset-emergency-planning-checklist |
| `monitoring-telemetry`           | Monitoring and telemetry              | —                                  |
| `infrastructure-assessment`      | Medical gas infrastructure assessment | —                                  |
| `preventive-service-maintenance` | Preventive service and maintenance    | —                                  |
| `clinical-oxygen-support`        | Clinical oxygen support               | —                                  |
| `ambulatory-homecare-support`    | Ambulatory and homecare support       | asset-homecare-guide               |
| `training-operational-readiness` | Training and operational readiness    | —                                  |

**Digital assets not yet approved:**

| ID                                   | Title (EN)                   | Status      | Used by                                              |
| ------------------------------------ | ---------------------------- | ----------- | ---------------------------------------------------- |
| `asset-medical-gas-overview`         | Medical gas overview         | placeholder | medical-gas-supply-planning, bulk-centralized-supply |
| `asset-emergency-planning-checklist` | Emergency planning checklist | placeholder | backup-emergency-supply                              |
| `asset-homecare-guide`               | Home transition guide        | placeholder | ambulatory-homecare-support                          |

**Scenes using placeholder illustrations:**

_All scenes use approved art._

### 11.9 Priority at convention

Proposed by the project team; sales confirms or changes each priority.

| Priority | ID                               | Name (EN)                             | Confirmed by sales |
| -------- | -------------------------------- | ------------------------------------- | ------------------ |
| high     | `backup-emergency-supply`        | Backup and emergency supply           | no                 |
| high     | `clinical-oxygen-support`        | Clinical oxygen support               | no                 |
| high     | `medical-gas-supply-planning`    | Medical gas supply planning           | no                 |
| medium   | `ambulatory-homecare-support`    | Ambulatory and homecare support       | no                 |
| medium   | `bulk-centralized-supply`        | Bulk or centralized supply            | no                 |
| medium   | `cylinder-inventory-management`  | Cylinder and inventory management     | no                 |
| medium   | `infrastructure-assessment`      | Medical gas infrastructure assessment | no                 |
| medium   | `monitoring-telemetry`           | Monitoring and telemetry              | no                 |
| low      | `preventive-service-maintenance` | Preventive service and maintenance    | no                 |
| low      | `training-operational-readiness` | Training and operational readiness    | no                 |

### 11.10 What visitors would see (demo mode)

Top recommendations produced by the deterministic rules for single-signal journeys, so sales can judge
relevance. Order is the ranking shown to visitors.

**Persona only**

| Persona                                           | Recommendations                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Executive leadership                              | Backup and emergency supply → Medical gas supply planning                                         |
| Operations and facilities                         | Medical gas infrastructure assessment → Backup and emergency supply → Medical gas supply planning |
| Procurement and supply chain                      | Medical gas supply planning → Cylinder and inventory management → Bulk or centralized supply      |
| Clinical and respiratory care                     | Clinical oxygen support → Cylinder and inventory management                                       |
| Quality, safety, risk and compliance              | Training and operational readiness                                                                |
| Finance and reimbursement                         | Medical gas supply planning → Preventive service and maintenance                                  |
| Technology, biomedical and digital transformation | Monitoring and telemetry → Preventive service and maintenance                                     |
| Ambulatory care and homecare                      | Ambulatory and homecare support                                                                   |
| Academia and research                             | Medical gas supply planning → Training and operational readiness                                  |
| Government or healthcare-system stakeholder       | Backup and emergency supply → Medical gas supply planning                                         |
| My role spans several areas                       | Talk with a specialist                                                                            |

**Challenge only**

| Challenge                         | Recommendations                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| Improve supply continuity         | Medical gas supply planning → Bulk or centralized supply → Backup and emergency supply           |
| Prepare for emergencies           | Backup and emergency supply                                                                      |
| Modernize aging infrastructure    | Medical gas infrastructure assessment → Preventive service and maintenance                       |
| Support facility expansion        | Medical gas infrastructure assessment → Medical gas supply planning → Bulk or centralized supply |
| Improve visibility and monitoring | Monitoring and telemetry                                                                         |
| Manage cylinders and inventory    | Cylinder and inventory management                                                                |
| Reduce operational complexity     | Cylinder and inventory management                                                                |
| Improve patient and staff safety  | Training and operational readiness → Clinical oxygen support                                     |
| Improve clinical workflow         | Clinical oxygen support                                                                          |
| Strengthen compliance readiness   | Training and operational readiness → Preventive service and maintenance                          |
| Control lifecycle costs           | Preventive service and maintenance → Medical gas supply planning                                 |
| Support care outside the hospital | Ambulatory and homecare support                                                                  |

**Exploration only** (visiting the scene and opening one hotspot)

| Scene                           | Hotspot                  | Recommendations                                                                                                 |
| ------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Hospital campus                 | New areas                | Medical gas supply planning → Bulk or centralized supply                                                        |
| Hospital campus                 | Supply network           | Medical gas supply planning → Bulk or centralized supply                                                        |
| Emergency department            | Patient surges           | Backup and emergency supply → Medical gas supply planning                                                       |
| Emergency department            | Oxygen in emergency care | Backup and emergency supply → Clinical oxygen support → Training and operational readiness                      |
| Medical-gas plant               | Storage tank             | Bulk or centralized supply → Monitoring and telemetry → Medical gas supply planning                             |
| Medical-gas plant               | Backup supply            | Backup and emergency supply                                                                                     |
| Medical-gas plant               | Restricted area          | Training and operational readiness                                                                              |
| Intensive care unit             | Bedside oxygen           | Clinical oxygen support → Medical gas supply planning                                                           |
| Intensive care unit             | Clinical oxygen          | Clinical oxygen support → Training and operational readiness                                                    |
| Intensive care unit             | Supply monitoring        | Monitoring and telemetry                                                                                        |
| Laboratory                      | Laboratory supply        | Medical gas supply planning → Cylinder and inventory management → Bulk or centralized supply                    |
| Laboratory                      | Safe handling            | Training and operational readiness                                                                              |
| Operating room                  | Gas outlets              | Medical gas infrastructure assessment                                                                           |
| Operating room                  | Gas infrastructure       | Medical gas infrastructure assessment → Preventive service and maintenance                                      |
| Patient-care area               | Cylinder handling        | Cylinder and inventory management → Training and operational readiness                                          |
| Patient-care area               | Cylinder inventory       | Cylinder and inventory management → Clinical oxygen support                                                     |
| Patient-care area               | Hospital to home         | Ambulatory and homecare support                                                                                 |
| Utility and infrastructure area | Manifold room            | Medical gas infrastructure assessment → Preventive service and maintenance → Training and operational readiness |
| Utility and infrastructure area | Alarm panel              | Monitoring and telemetry                                                                                        |
| Utility and infrastructure area | Planned maintenance      | Preventive service and maintenance → Medical gas infrastructure assessment                                      |
| Utility and infrastructure area | Safety training          | Training and operational readiness → Medical gas infrastructure assessment                                      |

<!-- END GENERATED: sales-review -->
