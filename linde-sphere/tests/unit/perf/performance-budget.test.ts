import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { visibleContent } from "@/domain/content/visibility";
import { recommend } from "@/domain/recommendations/engine";
import { recommendationEvidence } from "@/domain/recommendations/recommendation-stability";
import { EMPTY_SIGNALS } from "@/domain/session/visitor-session";
import { ASSET_SIZE_BUDGET_BYTES, scanPublicAssets } from "@/server/content/asset-safety";
import { buildReportPayload } from "@/server/report/build-report-payload";
import { renderReport } from "@/server/report/render-report";
import { loadSeedBundle } from "../../helpers/schema";

/** Performance budgets that can be checked without a browser (ADR-058); page budgets are in the E2E suite. */
describe("static asset size budget", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "linde-assets-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("flags an oversized scene image and accepts one within budget", () => {
    const publicDir = path.join(dir, "public");
    mkdirSync(path.join(publicDir, "assets"), { recursive: true });
    writeFileSync(path.join(publicDir, "assets", "ok.webp"), Buffer.alloc(200 * 1024));
    writeFileSync(
      path.join(publicDir, "assets", "huge.png"),
      Buffer.alloc(ASSET_SIZE_BUDGET_BYTES[".png"]! + 1),
    );
    const issues = scanPublicAssets(publicDir, dir);
    expect(issues).toEqual([
      { file: "public/assets/huge.png", message: expect.stringMatching(/budget for \.png/) },
    ]);
  });
});

describe("report generation cost", () => {
  it("builds and renders a report in a few milliseconds (it runs inside the lead request)", () => {
    const content = visibleContent(loadSeedBundle(), "demo");
    const signals = {
      ...EMPTY_SIGNALS,
      personaId: "clinical-respiratory",
      challengeIds: ["supply-continuity"],
      visitedSceneIds: content.scenes.map((s) => s.id),
      openedHotspotIds: content.scenes.flatMap((s) => s.hotspots.map((h) => h.id)),
    };
    const evidence = recommendationEvidence(signals, content.scenes);
    const run = () =>
      renderReport(
        buildReportPayload({
          leadId: "lead-perf",
          generatedAt: new Date("2026-10-20T14:05:00Z"),
          language: "es",
          visitor: { firstName: "Ana", lastName: "López", organization: "Clínica Norte (ficticia)" },
          roleId: "clinical-respiratory",
          priorityIds: signals.challengeIds,
          exploredSceneIds: evidence.visitedSceneIds,
          result: recommend(evidence, content),
          content,
        }),
      );
    run(); // warm-up (JIT)
    const started = performance.now();
    const runs = 20;
    let rendered = run();
    for (let i = 1; i < runs; i++) rendered = run();
    const perReportMs = (performance.now() - started) / runs;
    // Generous bound so slow CI machines pass; a regression to a heavy template engine or PDF would not.
    expect(perReportMs).toBeLessThan(25);
    // The email stays small: well under Gmail's ~100 KB clipping threshold.
    expect(Buffer.byteLength(rendered.html)).toBeLessThan(60 * 1024);
  });
});

describe("zod-free client helpers match the schemas they mirror", () => {
  it("isEventTarget accepts exactly what EventTargetSchema accepts", async () => {
    const { EventTargetSchema } = await import("@/domain/session/session-event");
    const { isEventTarget } = await import("@/domain/session/session-log");
    const samples = [
      "gas-plant",
      "a1",
      "x",
      "787-555-0100",
      "7875550100",
      "Gas-Plant",
      "gas--plant",
      "-gas",
      "gas-",
      "ana@example.com",
      "a".repeat(64),
      "a".repeat(65),
      "icu-2",
      "2-icu",
      "",
      "gas plant",
    ];
    for (const value of samples)
      expect(isEventTarget(value), value).toBe(EventTargetSchema.safeParse(value).success);
  });

  it("EMPTY_SIGNALS is a valid SessionSignals value", async () => {
    const { SessionSignalsSchema, EMPTY_SIGNALS } = await import("@/domain/session/visitor-session");
    expect(SessionSignalsSchema.parse(EMPTY_SIGNALS)).toEqual(EMPTY_SIGNALS);
  });
});
