import type { ContentBundle } from "../content/bundle";
import type { Solution } from "../content/offering";
import { visibleContent } from "../content/visibility";
import { recommend } from "../recommendations/engine";
import { EMPTY_SIGNALS, type SessionSignals } from "../session/visitor-session";

/**
 * Sales-review artifacts generated from the seed content (CONTENT_VALIDATION.md §11):
 * a CSV-compatible row set covering every content item, and Markdown sections grouped by the
 * decisions the Puerto Rico sales team must make. Pure: no I/O.
 */

export const REVIEW_COLUMNS = [
  "record_type",
  "id",
  "parent_id",
  "name_es",
  "name_en",
  "validation_status",
  "market",
  "requires_sales_validation",
  "pr_availability",
  "review_decision",
  "proposed_name_es",
  "proposed_name_en",
  "convention_priority",
  "priority_confirmed_by_sales",
  "missing_asset",
  "linked_assets",
  "related_challenges",
  "related_scenes",
  "reviewed_by",
  "last_reviewed_at",
  "source_label",
  "internal_notes",
  // Blank columns for the sales team to fill in and return.
  "sales_decision (keep/remove/rename)",
  "sales_new_name",
  "sales_available_in_pr (yes/no/verify)",
  "sales_priority (high/medium/low)",
  "sales_comments",
] as const;

export type ReviewColumn = (typeof REVIEW_COLUMNS)[number];
export type ReviewRow = Record<ReviewColumn, string>;

const blankRow = (): ReviewRow => Object.fromEntries(REVIEW_COLUMNS.map((c) => [c, ""])) as ReviewRow;

const yesNo = (value: boolean) => (value ? "yes" : "no");

/** A solution is missing an asset until at least one linked digital asset is validated. */
export function solutionMissingAsset(solution: Solution, bundle: ContentBundle): boolean {
  if (solution.isFallback) return false;
  const validated = new Set(
    bundle.digitalAssets.filter((a) => a.validationStatus === "validated").map((a) => a.id),
  );
  return !solution.digitalAssetIds.some((id) => validated.has(id));
}

export function buildReviewRows(bundle: ContentBundle): ReviewRow[] {
  const rows: ReviewRow[] = [];
  const taxonomy = (
    recordType: string,
    item: { id: string; label: { es: string; en: string }; validationStatus: string },
    extra: Partial<ReviewRow> = {},
  ) =>
    rows.push({
      ...blankRow(),
      record_type: recordType,
      id: item.id,
      name_es: item.label.es,
      name_en: item.label.en,
      validation_status: item.validationStatus,
      market: "n/a (taxonomy)",
      requires_sales_validation: "no",
      ...extra,
    });

  for (const s of bundle.solutions) {
    const r = s.salesReview;
    rows.push({
      ...blankRow(),
      record_type: s.isFallback ? "solution (fallback)" : "solution",
      id: s.id,
      name_es: s.title.es,
      name_en: s.title.en,
      validation_status: s.validationStatus,
      market: s.market,
      requires_sales_validation: yesNo(s.requiresSalesValidation),
      pr_availability: r.puertoRicoAvailability,
      review_decision: r.decision,
      proposed_name_es: r.proposedName?.es ?? "",
      proposed_name_en: r.proposedName?.en ?? "",
      convention_priority: r.conventionPriority,
      priority_confirmed_by_sales: yesNo(r.priorityConfirmedBySales),
      missing_asset: yesNo(solutionMissingAsset(s, bundle)),
      linked_assets: s.digitalAssetIds.join("; "),
      related_challenges: s.relatedChallengeIds.join("; "),
      related_scenes: s.relatedSceneIds.join("; "),
      reviewed_by: s.reviewedBy ?? "",
      last_reviewed_at: s.lastReviewedAt ?? "",
      source_label: s.sourceLabel,
      internal_notes: [s.internalNotes, r.notes].filter(Boolean).join(" | "),
    });
  }
  for (const a of bundle.digitalAssets) {
    rows.push({
      ...blankRow(),
      record_type: "digital-asset",
      id: a.id,
      parent_id: bundle.solutions
        .filter((s) => s.digitalAssetIds.includes(a.id))
        .map((s) => s.id)
        .join("; "),
      name_es: a.title.es,
      name_en: a.title.en,
      validation_status: a.validationStatus,
      market: a.market,
      requires_sales_validation: yesNo(a.requiresSalesValidation),
      missing_asset: yesNo(a.validationStatus !== "validated"),
      reviewed_by: a.reviewedBy ?? "",
      last_reviewed_at: a.lastReviewedAt ?? "",
      source_label: a.sourceLabel,
      internal_notes: a.internalNotes,
    });
  }
  for (const p of bundle.personas) {
    taxonomy("persona", p, { related_challenges: p.suggestedChallengeIds.join("; ") });
  }
  for (const c of bundle.challenges) taxonomy("challenge", c);
  for (const f of bundle.facilityTypes) taxonomy("facility-type", f);
  for (const scene of [...bundle.scenes].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const layers = [scene.background, ...scene.foregroundLayers];
    taxonomy(
      "scene",
      { id: scene.id, label: scene.title, validationStatus: scene.validationStatus },
      {
        parent_id: scene.parentSceneId ?? "",
        missing_asset: yesNo(layers.some((l) => l.assetStatus !== "approved")),
      },
    );
    for (const h of scene.hotspots) {
      taxonomy(
        `hotspot (${h.type})`,
        { id: h.id, label: h.label, validationStatus: h.validationStatus },
        {
          parent_id: scene.id,
          related_challenges: h.recommendationSignals.challengeIds.join("; "),
          related_scenes: h.type === "navigation" ? h.targetSceneId : "",
          linked_assets: h.type === "solution" ? h.targetSolutionIds.join("; ") : "",
        },
      );
    }
  }
  rows.push({
    ...blankRow(),
    record_type: "consent-text",
    id: `consent-${bundle.consent.version}`,
    name_es: "Textos de consentimiento y privacidad",
    name_en: "Consent and privacy text",
    validation_status: bundle.consent.validationStatus,
    market: "n/a (legal)",
    requires_sales_validation: "no",
    internal_notes: bundle.consent.internalNotes,
  });
  return rows;
}

export function reviewRowsAsTable(rows: ReviewRow[]): string[][] {
  return [[...REVIEW_COLUMNS], ...rows.map((r) => REVIEW_COLUMNS.map((c) => r[c]))];
}

// ---------------------------------------------------------------------------------------------
// Markdown

const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
function table(headers: string[], rows: string[][], empty: string): string {
  if (rows.length === 0) return `_${empty}_\n`;
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`),
  ].join("\n");
}

const NONE = "None yet. Awaiting the Puerto Rico sales review.";

function titleOf(bundle: ContentBundle, solutionId: string): string {
  return bundle.solutions.find((s) => s.id === solutionId)?.title.en ?? solutionId;
}

function coverage(bundle: ContentBundle, signals: Partial<SessionSignals>): string {
  // Coverage tables list the primary recommendations only.
  const result = recommend({ ...EMPTY_SIGNALS, ...signals }, visibleContent(bundle, "demo"), {
    secondary: 0,
  });
  if (!result) return "—";
  return result.items.map((i) => titleOf(bundle, i.solutionId)).join(" → ");
}

export function renderSalesReviewMarkdown(bundle: ContentBundle): string {
  const offers = bundle.solutions.filter((s) => !s.isFallback);
  const nameCells = (s: Solution) => [`\`${s.id}\``, s.title.en, s.title.es];
  const by = (pred: (s: Solution) => boolean) => offers.filter(pred);

  const priorityRank = { high: 0, medium: 1, low: 2, unset: 3 } as const;
  const prioritized = [...offers].sort(
    (a, b) =>
      priorityRank[a.salesReview.conventionPriority] - priorityRank[b.salesReview.conventionPriority] ||
      (a.id < b.id ? -1 : 1),
  );

  const missingSolutions = by((s) => solutionMissingAsset(s, bundle));
  const placeholderScenes = bundle.scenes.filter((sc) =>
    [sc.background, ...sc.foregroundLayers].some((l) => l.assetStatus !== "approved"),
  );
  const unapprovedAssets = bundle.digitalAssets.filter((a) => a.validationStatus !== "validated");

  const solutionHotspots = bundle.scenes.flatMap((sc) =>
    sc.hotspots.filter((h) => h.type !== "navigation").map((h) => ({ scene: sc, hotspot: h })),
  );

  return [
    "### 11.1 How to use this worksheet",
    "",
    "The tables below are generated from `content/` by `npm run content:export`, which also writes",
    "[`exports/content-validation.csv`](./exports/content-validation.csv) (UTF-8, opens in Excel). Every sample",
    "solution is a **demonstrative assumption pending Puerto Rico validation**. To record a decision, either fill in",
    "the `sales_*` columns of the CSV and return it, or edit `salesReview` in `content/solutions.json`",
    "(`decision`, `proposedName`, `puertoRicoAvailability`, `conventionPriority`, `priorityConfirmedBySales`), then run",
    '`npm run content:export`. Removed or not-available solutions must also be set to `validationStatus: "unavailable"`',
    "(the schema enforces this).",
    "",
    "### 11.2 Keep",
    "",
    table(
      ["ID", "Name (EN)", "Name (ES)"],
      by((s) => s.salesReview.decision === "keep").map(nameCells),
      NONE,
    ),
    "",
    "### 11.3 Remove",
    "",
    table(
      ["ID", "Name (EN)", "Name (ES)"],
      by((s) => s.salesReview.decision === "remove").map(nameCells),
      NONE,
    ),
    "",
    "### 11.4 Rename",
    "",
    table(
      ["ID", "Current name (EN)", "Proposed name (EN)", "Proposed name (ES)"],
      by((s) => s.salesReview.decision === "rename").map((s) => [
        `\`${s.id}\``,
        s.title.en,
        s.salesReview.proposedName?.en ?? "",
        s.salesReview.proposedName?.es ?? "",
      ]),
      NONE,
    ),
    "",
    "### 11.5 Available in Puerto Rico",
    "",
    table(
      ["ID", "Name (EN)", "Name (ES)"],
      by((s) => s.salesReview.puertoRicoAvailability === "available").map(nameCells),
      NONE,
    ),
    "",
    "### 11.6 Not available in Puerto Rico",
    "",
    table(
      ["ID", "Name (EN)", "Name (ES)"],
      by((s) => s.salesReview.puertoRicoAvailability === "not-available").map(nameCells),
      NONE,
    ),
    "",
    "### 11.7 Requires verification",
    "",
    "Confirm for each: whether it is offered in Puerto Rico, the approved name in both languages, and the scope",
    "described in the summary.",
    "",
    table(
      ["ID", "Name (EN)", "Name (ES)", "Summary shown to visitors (EN)"],
      by((s) => s.salesReview.puertoRicoAvailability === "requires-verification").map((s) => [
        ...nameCells(s),
        s.summary.en,
      ]),
      "Nothing requires verification.",
    ),
    "",
    "### 11.8 Missing asset",
    "",
    "**Solutions without an approved digital asset** (reports will show no resource links):",
    "",
    table(
      ["ID", "Name (EN)", "Linked placeholder assets"],
      missingSolutions.map((s) => [`\`${s.id}\``, s.title.en, s.digitalAssetIds.join(", ") || "—"]),
      "Every solution has an approved asset.",
    ),
    "",
    "**Digital assets not yet approved:**",
    "",
    table(
      ["ID", "Title (EN)", "Status", "Used by"],
      unapprovedAssets.map((a) => [
        `\`${a.id}\``,
        a.title.en,
        a.validationStatus,
        bundle.solutions
          .filter((s) => s.digitalAssetIds.includes(a.id))
          .map((s) => s.id)
          .join(", "),
      ]),
      "All digital assets are approved.",
    ),
    "",
    "**Scenes using placeholder illustrations:**",
    "",
    table(
      ["Scene", "Title (EN)"],
      placeholderScenes.map((sc) => [`\`${sc.id}\``, sc.title.en]),
      "All scenes use approved art.",
    ),
    "",
    "### 11.9 Priority at convention",
    "",
    "Proposed by the project team; sales confirms or changes each priority.",
    "",
    table(
      ["Priority", "ID", "Name (EN)", "Confirmed by sales"],
      prioritized.map((s) => [
        s.salesReview.conventionPriority,
        `\`${s.id}\``,
        s.title.en,
        yesNo(s.salesReview.priorityConfirmedBySales),
      ]),
      NONE,
    ),
    "",
    "### 11.10 What visitors would see (demo mode)",
    "",
    "Top recommendations produced by the deterministic rules for single-signal journeys, so sales can judge",
    "relevance. Order is the ranking shown to visitors.",
    "",
    "**Persona only**",
    "",
    table(
      ["Persona", "Recommendations"],
      bundle.personas.map((p) => [p.label.en, coverage(bundle, { personaId: p.id })]),
      "No personas.",
    ),
    "",
    "**Challenge only**",
    "",
    table(
      ["Challenge", "Recommendations"],
      bundle.challenges.map((c) => [c.label.en, coverage(bundle, { challengeIds: [c.id] })]),
      "No challenges.",
    ),
    "",
    "**Exploration only** (visiting the scene and opening one hotspot)",
    "",
    table(
      ["Scene", "Hotspot", "Recommendations"],
      solutionHotspots.map(({ scene, hotspot }) => [
        scene.title.en,
        hotspot.label.en,
        coverage(bundle, {
          visitedSceneIds: scene.parentSceneId ? [scene.parentSceneId, scene.id] : [scene.id],
          openedHotspotIds: [hotspot.id],
        }),
      ]),
      "No hotspots.",
    ),
    "",
  ].join("\n");
}
