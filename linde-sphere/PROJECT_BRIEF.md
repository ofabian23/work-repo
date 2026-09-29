# Linde Sphere — Project Brief

> **Product name:** Linde Sphere (internal codename: _Mockup Vision_)
> **Owner:** Orlando Rodríguez Nieto
> **Document status:** Living document — Foundational scope v1.0
> **Related documents:** [ARCHITECTURE.md](./ARCHITECTURE.md) · [DECISIONS.md](./DECISIONS.md) · [TASKS.md](./TASKS.md) · [CONTENT_VALIDATION.md](./CONTENT_VALIDATION.md)

---

## 1. Summary

Linde Sphere is an interactive, convention-focused healthcare discovery experience that runs on a
**portrait touchscreen kiosk (1080 × 1920)** at a healthcare convention in **Puerto Rico**.

It is **not a product catalog**. It is a short digital consultation that:

1. Attracts attention from convention traffic.
2. Identifies who the visitor is.
3. Discovers the visitor's challenges and priorities.
4. Guides exploration of illustrated healthcare environments.
5. Generates deterministic, explainable recommendations.
6. Demonstrates value.
7. Captures a business lead — **only after value has been shown**.
8. Emails a personalized report.
9. Resets cleanly for the next visitor.

Typical engagement is **2–5 minutes**. The primary business objective is **qualified lead generation**,
not content consumption.

### Core illusion

The visitor should feel like they are moving through a hospital. In reality the system is:

> **Scenes + Hotspots + Recommendations + Lead Capture**

No real-time 3D engine is used. The illusion is produced with layered 2D scenes, isometric-style
illustrations (placeholder SVGs until approved art exists), hotspot overlays, controlled zoom
transitions, subtle parallax, fades, and motion.

---

## 2. Business journey

```
ATTRACT → IDENTIFY THE VISITOR → DISCOVER NEEDS → GUIDE EXPLORATION → GENERATE RECOMMENDATIONS
       → DEMONSTRATE VALUE → CAPTURE THE LEAD → EMAIL A PERSONALIZED REPORT → RESET
```

| Stage             | Purpose                               | Visitor sees                                                                         | Exit condition                              |
| ----------------- | ------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------- |
| Attract           | Stop passers-by                       | Large healthcare visual, motion cue, minimal text, language toggle (ES default / EN) | First touch                                 |
| Identify          | Learn who the visitor is              | Three entry paths; role selection                                                    | Role chosen (or skipped via explore path)   |
| Discover          | Learn priorities                      | Challenge/objective selection, optional facility type                                | ≥ 1 challenge or enough exploration signals |
| Explore           | Educate and refine                    | Hospital campus → environment scenes → hotspots → panels                             | Visitor chooses to view recommendations     |
| Recommend         | Show relevance                        | Top solution categories, "why this appeared", related environments, next step        | Visitor requests the report                 |
| Demonstrate value | Motivate conversion                   | "We found opportunities relevant to your priorities." + what the report contains     | Visitor opens the lead form                 |
| Capture           | Collect minimum business contact data | Short form + two separate consent choices                                            | Valid submission stored                     |
| Follow-up         | Deliver value, enable sales           | Confirmation screen; report emailed (queued with retry)                              | Auto-reset                                  |
| Reset             | Protect privacy, maximize throughput  | Back to Attract                                                                      | Client state fully cleared                  |

---

## 3. Entry paths

All three paths converge on the same recommendation engine and the same lead flow.

| Path              | Label (ES / EN)                                 | Flow                                                                                                                                     |
| ----------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **A — Role**      | "Trabajo en…" / "I work in…"                    | Role → challenges (multi-select, max 3) → optional facility type → **preliminary recommendations** → optional exploration to refine      |
| **B — Challenge** | "Necesito…" / "I need to…"                      | Challenges → role → optional facility type → **preliminary recommendations** → optional exploration                                      |
| **C — Explore**   | "Explorar el hospital" / "Explore the hospital" | Hospital campus → scenes → hotspots; a light, skippable "help us tailor this" step (role + challenges) is offered before recommendations |

**Quick path:** Role + challenges → preliminary recommendations → report request. Target ≤ 90 s to first recommendations.
**Discovery path:** Any path + exploration of one or more environments, which refines recommendations.

The visitor is **never** required to explore every area.

---

## 4. Personas (roles)

Selectable in "I work in…" and reused as the lead form's job function.

| ID                      | Persona (EN)                                       | Persona (ES, draft)                            | Typical interests                                                                      |
| ----------------------- | -------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| `executive`             | Executive leadership                               | Alta gerencia                                  | Sustainability, growth, risk reduction, organizational performance, strategic planning |
| `operations-facilities` | Operations and facilities                          | Operaciones e instalaciones                    | Reliability, infrastructure, capacity planning, emergency preparedness, maintenance    |
| `procurement-supply`    | Procurement and supply chain                       | Compras y cadena de suministro                 | Continuity, inventory control, vendor management, standardization, cost control        |
| `clinical-respiratory`  | Clinical and respiratory care                      | Clínica y terapia respiratoria                 | Patient safety, care quality, clinical workflow, availability of critical resources    |
| `quality-compliance`    | Quality, safety, risk, and compliance              | Calidad, seguridad, riesgo y cumplimiento      | Safety, accreditation, risk mitigation, standards, documentation                       |
| `finance`               | Finance and reimbursement                          | Finanzas y reembolsos                          | Cost management, operational efficiency, financial sustainability                      |
| `technology-biomed`     | Technology, biomedical, and digital transformation | Tecnología, biomédica y transformación digital | Monitoring, automation, visibility, analytics, digital modernization                   |
| `ambulatory-homecare`   | Ambulatory care and homecare                       | Cuidado ambulatorio y en el hogar              | Care outside the hospital, patient continuity, logistics                               |
| `academia-research`     | Academia and research                              | Academia e investigación                       | Laboratory operations, research infrastructure, education                              |
| `government-system`     | Government or healthcare-system stakeholder        | Gobierno o sistema de salud                    | Public health preparedness, system-wide standardization, resilience                    |

Spanish labels are drafts and must be reviewed (see CONTENT_VALIDATION.md).

---

## 5. Challenges (objectives)

Customer-language challenges, **never product names**. Initial set (all `assumed` until approved):

1. Improve supply continuity
2. Prepare for emergencies
3. Modernize infrastructure
4. Improve monitoring visibility
5. Support facility expansion
6. Reduce operational complexity
7. Improve patient safety
8. Improve staff safety
9. Strengthen compliance readiness
10. Control lifecycle costs
11. Improve workflow efficiency
12. Support care outside the hospital

Visitors select up to **3** challenges (configurable).

## 6. Facility types (optional signal)

General / acute-care hospital · Academic medical center · Ambulatory / outpatient center · Homecare
organization · Clinical or research laboratory · Government / public health system · Other.

---

## 7. Healthcare environments (Hospital Explorer)

| ID               | Environment                     | Role in explorer                                  |
| ---------------- | ------------------------------- | ------------------------------------------------- |
| `campus`         | Hospital campus                 | **Hub scene** — entry point linking to all others |
| `emergency`      | Emergency department            | Environment scene                                 |
| `icu`            | Intensive care unit             | Environment scene                                 |
| `operating-room` | Operating room                  | Environment scene                                 |
| `patient-care`   | Patient-care area               | Environment scene                                 |
| `laboratory`     | Laboratory                      | Environment scene                                 |
| `gas-plant`      | Medical-gas plant               | Environment scene                                 |
| `utilities`      | Utility and infrastructure area | Environment scene                                 |

Each scene contains **hotspots** of three kinds:

- **Navigation** — moves to another scene with a controlled zoom transition.
- **Information** — opens a short, readable content panel about a challenge in that environment.
- **Solution** — opens a panel of related solution categories with an "Add to my interests" action.

Hotspot positions use coordinates from 0 to 100 (percent of the scene artwork), so artwork can be
replaced without code changes.

Opening hotspots and visiting scenes are recommendation signals.

---

## 8. Convention UX rules

1. A useful **preliminary recommendation** is available right after role + challenges are selected.
2. Exploration **improves and refines** recommendations.
3. A persistent but unobtrusive **"Ver mis recomendaciones / View my recommendations"** action appears once minimum information is collected (default: role + ≥ 1 challenge, **or** ≥ 3 hotspot interactions on the explore path — configurable).
4. After meaningful interaction, a contextual prompt appears once per session:
   _"Encontramos oportunidades relevantes para sus prioridades." / "We found opportunities relevant to your priorities."_
5. The visitor is never forced to explore every area.
6. Both a **quick path** and a **discovery path** are supported.
7. An **inactivity timer** resets the experience safely ("Are you still there?" countdown first).
8. Personal information is **cleared from client state** after completion or timeout.
9. A new visitor **never** sees the previous visitor's information.

---

## 9. Recommendations

Deterministic, explainable, rules-based. **No generative AI** drives recommendation logic.

**Inputs:** selected role · selected challenges · facility type · visited scenes · opened hotspots ·
dwell/engagement signals (bucketed and capped) · explicit interests.

**Outputs (visitor-facing):**

- Top recommended **solution categories** (default 3, max 5)
- **Why it appeared** — human-readable reasons derived from the matched rules
- Related healthcare environments
- Suggested next step
- Relevant **approved** digital resources

**Lead scoring is separate** from recommendations. An internal commercial score is computed server-side
and is **never** exposed to the visitor, the kiosk client, or the visitor's report.

---

## 10. Lead capture

Shown **only after** recommendations have been presented.

| Field                               | Required               | Notes                                                               |
| ----------------------------------- | ---------------------- | ------------------------------------------------------------------- |
| First name                          | Yes                    |                                                                     |
| Last name                           | Yes                    |                                                                     |
| Organization                        | Yes                    |                                                                     |
| Job role / function                 | Yes                    | Pre-filled from selected persona; selectable list, no free text     |
| Business email                      | Yes                    | Format-validated; free-mail domains accepted but flagged internally |
| Phone                               | No                     |                                                                     |
| Preferred language                  | Yes                    | Defaults to current UI language (ES / EN)                           |
| Selected interests                  | Yes (auto)             | Pre-filled from challenges + explicit interests; editable chips     |
| Consent: send the requested report  | Yes, to receive report | Separate checkbox, unchecked by default                             |
| Consent: additional sales follow-up | No                     | Separate checkbox, unchecked by default                             |

- Consent wording is **configurable** (ES + EN) and versioned; the exact text shown is stored with the lead.
- **No free-text comment fields** (reduces the risk of patient information being entered).
- **No patient information / PHI** is ever requested or stored.

---

## 11. Personalized report

A polished, responsive **HTML email** (plain-text alternative included). PDF is an optional future extension.

Contents:

1. Visitor name and organization
2. Role and selected priorities
3. Healthcare areas explored
4. Recommended solution categories
5. Concise reasons for each recommendation
6. Approved related resources
7. Call to action
8. Sales contact (from configuration)
9. Disclaimer: final applicability requires consultation with a qualified representative

The report is sent in the visitor's preferred language. It contains **only content visible under the active
content mode** and never the internal lead score.

---

## 12. Content governance (summary)

Every content record carries a status: **`validated` · `assumed` · `placeholder` · `unavailable`**.

- **Production mode:** only `validated` content is shown.
- **Demo mode:** `validated` + `assumed`; assumed offering content shows a discreet
  _"Contenido pendiente de validación local" / "Content pending local validation"_ indicator.
- An assumed capability is **never** presented as a confirmed local offering.
- No invented testimonials, metrics, savings, regulatory claims, or customer outcomes.

Full rules: [CONTENT_VALIDATION.md](./CONTENT_VALIDATION.md).

---

## 13. Data classifications and privacy boundaries (summary)

| Class                        | Data                                                                                | Where it may live                                                                   | Who may see it                                              |
| ---------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **C0 Public content**        | Brand config, scenes, taxonomy, solution categories, UI strings                     | Repository, client bundle                                                           | Anyone                                                      |
| **C1 Anonymous interaction** | Role, challenges, facility type, scenes, hotspots, dwell buckets, language, outcome | Client memory (session only); SQLite `VisitorSession`                               | Admin / exports                                             |
| **C2 Business contact PII**  | Name, organization, job function, email, phone, consents                            | Client memory **only while the form is open**; SQLite `Lead`; outgoing report email | Visitor (own report), admin / exports                       |
| **C3 Internal commercial**   | Lead score, tier, score factors                                                     | Server and SQLite only                                                              | Admin / exports only — **never** the kiosk client or report |
| **C4 Secrets**               | SMTP credentials, admin credentials                                                 | `.env` on the laptop only (never committed, never `NEXT_PUBLIC_`)                   | Operators                                                   |
| **Prohibited**               | Patient information / PHI, payment data, government IDs                             | Nowhere                                                                             | —                                                           |

Details and enforcement: [ARCHITECTURE.md §10](./ARCHITECTURE.md#10-privacy-and-security-boundaries).

---

## 14. Deployment context

- A **Windows laptop** runs the app and the SQLite database, generates reports, and sends email.
- An **Android touchscreen kiosk** opens the app in **Chrome** at `http://<laptop-IPv4>:3000`.
- The two share the laptop's Wi-Fi hotspot or the same local network.
- No cloud hosting for the MVP. Internet is needed **only** for email delivery; leads are captured offline
  and emails are queued for retry.

---

## 15. Design principles

- Portrait-first (1080 × 1920); responsive on tablets and laptops
- Touch-first; minimum **48 × 48 CSS px** targets (kiosk default **≥ 64 px**)
- No hover-only interactions; no free camera; no complex navigation; no tiny controls; no walls of text
- High contrast (WCAG 2.2 AA minimum), large readable type
- Spanish-first, English supported
- Calm, premium healthcare visual language
- Configurable branding — no hard-coded corporate logos
- Local placeholder SVG illustrations until approved assets are supplied
- Never copy proprietary code or copyrighted visual assets from reference sites
- `prefers-reduced-motion` respected

---

## 16. MVP scope

### In MVP

| #   | Capability                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------ |
| M1  | Attract screen with ES/EN toggle                                                                       |
| M2  | Three entry paths (role, challenge, explore)                                                           |
| M3  | Persona selection (10 personas)                                                                        |
| M4  | Challenge selection (12 challenges, multi-select)                                                      |
| M5  | Optional facility-type selection                                                                       |
| M6  | Hospital Explorer: campus hub + 7 environment scenes with placeholder SVG art                          |
| M7  | Hotspots (navigation / information / solution), zoom transitions, parallax, fades                      |
| M8  | Deterministic, explainable recommendation engine (shared client/server)                                |
| M9  | Preliminary recommendations, persistent "View my recommendations", contextual prompt                   |
| M10 | Recommendations screen with reasons, environments, next step, resources                                |
| M11 | Lead form with separate, configurable, versioned consents                                              |
| M12 | Internal lead scoring (server-only)                                                                    |
| M13 | SQLite persistence via Prisma                                                                          |
| M14 | Personalized HTML report (ES/EN) + plain-text alternative                                              |
| M15 | Email delivery via provider abstraction (file/dev provider + SMTP) with transactional outbox and retry |
| M16 | Inactivity timer and safe session reset; hard client reset after completion                            |
| M17 | Content status model with production / demo modes and validation indicator                             |
| M18 | Content validation check script (`content:check`)                                                      |
| M19 | CSV export of leads (CLI; optional protected admin page)                                               |
| M20 | Minimal protected admin: outbox status, resend, export — disabled by default                           |
| M21 | Configurable branding (name, colors, optional logo path)                                               |
| M22 | Windows laptop + Android kiosk deployment runbook                                                      |
| M23 | Unit, integration, and end-to-end tests for critical flows                                             |

### Not in MVP

Real 3D · CRM integration · advanced analytics dashboards · PDF generation · generative AI
recommendations · cloud hosting · multi-tenant architecture · Microsoft Graph email provider (interface
prepared only) · in-app content editor / CMS · multi-kiosk synchronization · badge scanning · QR
hand-off to phone · installable PWA / offline service worker · voice interaction.

---

## 17. Acceptance criteria

Each criterion must be demonstrated by an automated test or a documented manual check before MVP sign-off.

### Experience

- **AC-01** At 1080 × 1920 the Attract screen renders full-bleed with no scrollbars and a clear invitation to touch.
- **AC-02** Spanish is the default language on every fresh session; switching to English updates all UI and content strings; reset returns to Spanish.
- **AC-03** All three entry paths are reachable from the entry screen in one touch.
- **AC-04** Selecting a role and ≥ 1 challenge produces a preliminary recommendation list without requiring exploration.
- **AC-05** Visiting scenes / opening hotspots / adding interests changes recommendation ranking or reasons deterministically (verified by unit tests on the engine).
- **AC-06** "View my recommendations" appears once minimum information is collected and is reachable from every explorer scene.
- **AC-07** The contextual "We found opportunities…" prompt appears at most once per session and is dismissible.
- **AC-08** Every interactive element is ≥ 48 × 48 CSS px; primary actions are ≥ 64 px tall.
- **AC-09** No interaction depends on hover.
- **AC-10** Text/background contrast meets WCAG 2.2 AA; with `prefers-reduced-motion`, zoom/parallax are replaced by fades.
- **AC-11** Scene transitions animate only `transform` / `opacity` and use no 3D library.

### Recommendations

- **AC-12** Same inputs + same content version ⇒ identical ordered output (determinism test).
- **AC-13** Every recommendation shows ≥ 1 human-readable reason traceable to a matched rule.
- **AC-14** The server recomputes recommendations from submitted signals; the stored snapshot equals what the client displayed for the same inputs.
- **AC-15** With no matching rules, a configurable fallback ("talk to a specialist") recommendation is shown.
- **AC-16** Lead score / tier never appears in any API response to the kiosk, in client bundles, or in the report.

### Content governance

- **AC-17** In production mode, no `assumed`, `placeholder`, or `unavailable` item appears in the UI or the report.
- **AC-18** In demo mode, assumed offering content shows the "pending local validation" indicator in both UI and report.
- **AC-19** `unavailable` content never appears to visitors in any mode.
- **AC-20** `content:check` fails on schema errors, missing translations, dangling references, or prohibited-claim markers.

### Lead capture and reporting

- **AC-21** The lead form is not reachable before recommendations have been shown.
- **AC-22** Report consent and follow-up consent are separate, unchecked by default, and stored with the consent text version and snapshot.
- **AC-23** Invalid input is rejected client-side and server-side (Zod) with localized messages.
- **AC-24** A successful submission persists the lead, recommendation snapshot, rendered report, and outbox entry in one transaction.
- **AC-25** If the email provider fails, the lead remains stored, the outbox entry is retried with backoff, and the visitor still sees a success confirmation that does not claim the email was already delivered.
- **AC-26** Report contains all nine sections from §11 in the visitor's preferred language.

### Privacy, reset, and security

- **AC-27** After completion, the confirmation screen auto-resets; after inactivity, a countdown precedes reset.
- **AC-28** After reset, no previous visitor's name, email, selections, or recommendations are present in the DOM, React state, browser history, `localStorage`, `sessionStorage`, IndexedDB, or cookies.
- **AC-29** Admin pages and APIs are not linked from the visitor UI, are disabled by default, and require credentials when enabled.
- **AC-30** No PII is written to application logs (lead IDs only).
- **AC-31** The kiosk makes no requests to external hosts at runtime (fonts, scripts, images are local).
- **AC-32** Secrets live only in `.env` (git-ignored); `.env.example` documents every variable without values.

### Operations

- **AC-33** `npm run start:network` serves the app on all interfaces (`npm run start` stays localhost-only); an Android Chrome device on the same network can complete a full journey.
- **AC-34** CSV export produces one row per lead with consents, interests, recommendations, and internal score, UTF-8 with BOM (Excel-safe Spanish characters).
- **AC-35** Lint, type check, unit, integration, and E2E suites pass on a clean checkout.
- **AC-36** A full journey completes with the laptop disconnected from the internet; the queued email sends automatically once connectivity returns.

---

## 18. Success criteria (business)

Linde Sphere succeeds when:

1. Visitors start interacting quickly.
2. Visitors understand potential opportunities.
3. Visitors discover solutions they did not know existed.
4. Recommendations feel personalized.
5. Leads are captured efficiently.
6. Reports are delivered automatically.
7. Sales receives qualified opportunities.
8. The system resets cleanly for the next visitor.

**Proposed operational targets** (to be confirmed by the owner):
median time to first recommendation ≤ 90 s (quick path) · lead form completion ≤ 60 s ·
reset to Attract ≤ 2 s · report queued within 5 s of submission · zero leads lost to email failure.

---

## 19. Open questions

| #   | Question                                                                    | Owner              | Blocking phase         |
| --- | --------------------------------------------------------------------------- | ------------------ | ---------------------- |
| Q1  | Approval to use the "Linde Sphere" name and brand colors/fonts at the event | Marketing / owner  | Phase 10 (production)  |
| Q2  | SMTP account and sender address for report delivery                         | Owner / IT         | Phase 8 (real sending) |
| Q3  | Final consent wording (ES/EN)                                               | Legal / compliance | Production mode        |
| Q4  | Sales contact details for the report CTA                                    | Sales              | Production mode        |
| Q5  | Validated Puerto Rico solution catalog                                      | PR sales team      | Production mode        |
| Q6  | Illustration supplier and delivery format for scene art                     | Owner / marketing  | Replacing placeholders |
| Q7  | Lead data retention period and post-event handling                          | Owner / compliance | Phase 9                |
| Q8  | Number of kiosks per booth (MVP assumes one; SQLite supports a few)         | Owner              | Phase 10               |
| Q9  | Will the convention run in production mode or demo mode?                    | Owner              | Phase 10               |
| Q10 | Exact kiosk model, Android and Chrome versions                              | Owner              | Phase 10               |
