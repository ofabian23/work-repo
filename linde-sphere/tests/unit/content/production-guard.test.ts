import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { visibleContent, type ContentBundle } from "@/domain/content";
import { leadCaptureAvailable } from "@/domain/content/visibility";
import { APPROVAL_STATUSES, SALES_DECISIONS, type SalesReview } from "@/domain/content/sales-review";
import { VALIDATION_STATUSES } from "@/domain/content/constants";
import { recommend } from "@/domain/recommendations/engine";
import { EMPTY_SIGNALS } from "@/domain/session/session-log";
import { loadContentFromDirectory } from "@/server/content/load-content";
import { getPublicContent } from "@/server/content/public-content";
import { approveForProduction, confirmedReview } from "../../helpers/fixtures";
import { clone, loadSeedBundle, PROJECT_ROOT } from "../../helpers/schema";
import {
  createTestDatabase,
  createTestLeadService,
  validLead,
  type TestDatabase,
} from "../../helpers/test-database";

/**
 * Production-content guard (ADR-060): production mode shows only content that is validated AND approved by
 * the Puerto Rico sales team; demo mode may show assumed content (the kiosk marks it "pending local
 * validation"). These tests make sure unvalidated content cannot reach production by accident.
 */
const seed = loadSeedBundle();
const INTERNAL_KEYS = [
  "salesReview",
  "approvalStatus",
  "salesOwner",
  "requiredCorrection",
  "missingDigitalMaterial",
  "internalNotes",
  "reviewedBy",
  "sourceLabel",
  "requiresSalesValidation",
];

describe("production guard: the seed content", () => {
  it("shows nothing in production mode: every item is still assumed or a placeholder", () => {
    const pub = visibleContent(seed, "production");
    expect({
      personas: pub.personas.length,
      challenges: pub.challenges.length,
      facilityTypes: pub.facilityTypes.length,
      scenes: pub.scenes.length,
      solutions: pub.solutions.length,
      digitalAssets: pub.digitalAssets.length,
      recommendationRules: pub.recommendationRules.length,
    }).toEqual({
      personas: 0,
      challenges: 0,
      facilityTypes: 0,
      scenes: 0,
      solutions: 0,
      digitalAssets: 0,
      recommendationRules: 0,
    });
    expect(recommend({ ...EMPTY_SIGNALS, personaId: "executive" }, pub)).toBeNull();
    // Placeholder legal text is withheld too: no privacy notice from content, no lead capture.
    expect(pub.consent).toBeNull();
    expect(pub.report).toBeNull();
    expect(leadCaptureAvailable(pub)).toBe(false);
  });

  it("releases consent text and report copy in production only once they are validated", () => {
    const b = clone(seed);
    b.consent.validationStatus = "validated";
    expect(visibleContent(b, "production").consent?.version).toBe(b.consent.version);
    expect(leadCaptureAvailable(visibleContent(b, "production"))).toBe(false); // report copy still pending
    b.report.validationStatus = "validated";
    expect(leadCaptureAvailable(visibleContent(b, "production"))).toBe(true);
    expect(leadCaptureAvailable(visibleContent(seed, "demo"))).toBe(true);
  });

  it("shows assumed content in demo mode, keeping the status the kiosk uses for its pending indicator", () => {
    const demo = visibleContent(seed, "demo");
    expect(demo.solutions.length).toBe(seed.solutions.length);
    expect(demo.personas.length).toBe(seed.personas.length);
    expect(demo.solutions.every((s) => s.validationStatus !== "validated")).toBe(true);
    // Placeholder assets stay hidden even in demo mode (unless explicitly previewed in development).
    expect(demo.digitalAssets).toEqual([]);
  });

  it.each(["demo", "production"] as const)("never sends internal review fields to the kiosk (%s)", (mode) => {
    const b = clone(seed);
    approveForProduction(b.solutions[0]!);
    approveForProduction(b.personas[0]!);
    const json = JSON.stringify(visibleContent(b, mode));
    for (const key of INTERNAL_KEYS) expect(json, key).not.toContain(`"${key}"`);
  });
});

type Reviewed = { id: string; validationStatus: string; salesReview: SalesReview };
const TYPES: {
  name: string;
  pick: (b: ContentBundle) => Reviewed;
  shown: (b: ContentBundle, id: string) => boolean;
}[] = [
  {
    name: "persona",
    pick: (b) => b.personas[0]!,
    shown: (b, id) => visibleContent(b, "production").personas.some((p) => p.id === id),
  },
  {
    name: "challenge",
    pick: (b) => b.challenges[0]!,
    shown: (b, id) => visibleContent(b, "production").challenges.some((c) => c.id === id),
  },
  {
    name: "solution",
    pick: (b) => b.solutions[0]!,
    shown: (b, id) => visibleContent(b, "production").solutions.some((s) => s.id === id),
  },
  {
    name: "digital asset",
    pick: (b) => b.digitalAssets[0]!,
    shown: (b, id) => visibleContent(b, "production").digitalAssets.some((a) => a.id === id),
  },
];

describe.each(TYPES)(
  "production guard: every status × approval × decision for a $name",
  ({ pick, shown }) => {
    // The visibility filter is tested directly, including combinations the schema would reject, so a
    // hand-edited or unchecked file still cannot leak into production.
    const cases = VALIDATION_STATUSES.flatMap((status) =>
      APPROVAL_STATUSES.flatMap((approval) =>
        SALES_DECISIONS.map((decision) => ({ status, approval, decision })),
      ),
    );

    it(`appears only when validated, approved and not removed (${cases.length} combinations)`, () => {
      const leaks: string[] = [];
      for (const { status, approval, decision } of cases) {
        const b = clone(seed);
        const item = pick(b);
        item.validationStatus = status;
        item.salesReview = { ...confirmedReview(), approvalStatus: approval, decision } as SalesReview;
        const expected = status === "validated" && approval === "approved" && decision !== "remove";
        if (shown(b, item.id) !== expected) leaks.push(`${status}/${approval}/${decision}`);
      }
      expect(leaks).toEqual([]);
    });
  },
);

describe("production guard: loading and serving", () => {
  let t: TestDatabase | undefined;
  afterEach(async () => t?.cleanup());

  it("content files that mark an item validated without a sales approval are refused at load time", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "linde-content-"));
    try {
      cpSync(path.join(PROJECT_ROOT, "content"), dir, { recursive: true });
      const file = path.join(dir, "solutions.json");
      const solutions = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>[];
      Object.assign(solutions[0]!, {
        validationStatus: "validated",
        market: "puerto-rico",
        reviewedBy: "Someone",
        lastReviewedAt: "2026-10-15",
        requiresSalesValidation: false,
      });
      writeFileSync(file, JSON.stringify(solutions));
      const loaded = loadContentFromDirectory(dir);
      const errors = loaded.issues.filter((i) => i.severity === "error");
      expect(errors.map((e) => e.message).join("\n")).toMatch(/needs sales approval/);
      expect(() => visibleContent(loaded.bundle ?? seed, "production")).not.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the server's production content from the committed files is empty", () => {
    const pub = getPublicContent("production", { cacheEnabled: false });
    expect(pub.mode).toBe("production");
    expect(
      [pub.personas, pub.challenges, pub.solutions, pub.scenes, pub.digitalAssets].every(
        (l) => l.length === 0,
      ),
    ).toBe(true);
  });

  it("a lead naming assumed content is refused in production (nothing unvalidated is stored or reported)", async () => {
    t = createTestDatabase();
    const { service } = createTestLeadService(t.db, { content: () => visibleContent(seed, "production") });
    const result = await service.submitLead(validLead());
    expect(result.outcome).toBe("invalid");
    const codes = result.outcome === "invalid" ? result.issues.map((i) => i.code) : [];
    expect(codes).toEqual(expect.arrayContaining(["lead_capture_unavailable", "unknown_option"]));
    expect(await t.db.lead.count()).toBe(0);
  });
});
