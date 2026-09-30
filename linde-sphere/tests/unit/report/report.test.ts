import { describe, expect, it } from "vitest";
import type { ContentBundle } from "@/domain/content";
import { visibleContent } from "@/domain/content/visibility";
import { recommend } from "@/domain/recommendations/engine";
import { recommendationEvidence } from "@/domain/recommendations/recommendation-stability";
import { EMPTY_SIGNALS } from "@/domain/session/visitor-session";
import {
  buildReportPayload,
  ReportUnavailableError,
  type ReportInput,
} from "@/server/report/build-report-payload";
import { renderReport } from "@/server/report/render-report";
import { loadSeedBundle } from "../../helpers/schema";

const signals = {
  ...EMPTY_SIGNALS,
  personaId: "procurement-supply",
  challengeIds: ["supply-continuity"],
  visitedSceneIds: ["campus", "gas-plant"],
  openedHotspotIds: ["gas-plant-bulk-tank"],
};

function input(overrides: Partial<ReportInput> = {}, bundle: ContentBundle = loadSeedBundle()): ReportInput {
  const content = visibleContent(bundle, "demo");
  const evidence = recommendationEvidence(signals, content.scenes);
  return {
    leadId: "lead-1",
    generatedAt: new Date("2026-10-20T14:05:00Z"),
    language: "es",
    visitor: {
      firstName: "María José",
      lastName: "O'Neill-Rivera",
      organization: "Hospital San Juan (Metro)",
    },
    roleId: "procurement-supply",
    priorityIds: signals.challengeIds,
    exploredSceneIds: evidence.visitedSceneIds,
    result: recommend(evidence, content),
    content,
    ...overrides,
  };
}

describe("report payload", () => {
  it("contains the visitor's context, top recommendations with reasons, CTA, contact, disclaimer and footer", () => {
    const report = buildReportPayload(input());
    expect(report).toMatchObject({
      language: "es",
      contentMode: "demo",
      title: "Su resumen personalizado de Linde Sphere",
      visitor: { firstName: "María José", organization: "Hospital San Juan (Metro)" },
      role: { id: "procurement-supply", label: "Compras y cadena de suministro" },
      priorities: [{ id: "supply-continuity", label: expect.any(String) }],
      salesContact: { name: "Equipo comercial (ejemplo)", email: "ventas@example.com", phone: null },
    });
    expect(report.areasExplored.map((a) => a.id)).toEqual(["gas-plant"]);
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.recommendations.length).toBeLessThanOrEqual(3);
    report.recommendations.forEach((r) => expect(r.reasons[0]).toMatch(/^Aparece porque/));
    expect(report.callToAction.href).toBe(
      `mailto:ventas@example.com?subject=${encodeURIComponent("Su resumen personalizado de Linde Sphere")}`,
    );
    expect(report.disclaimer).toContain(
      "La aplicabilidad final requiere la consulta con un representante calificado",
    );
    // Demo content is assumed: every card is marked and the notice is present.
    expect(report.recommendations.every((r) => r.pendingValidation)).toBe(true);
    expect(report.pendingValidationNotice).toContain("pendiente de validación para Puerto Rico");
  });

  it("is built in English when the visitor asked for English", () => {
    const report = buildReportPayload(input({ language: "en" }));
    expect(report.title).toBe("Your personalized Linde Sphere summary");
    expect(report.role.label).toBe("Procurement and supply chain");
    report.recommendations.forEach((r) => expect(r.reasons[0]).toMatch(/^This appeared because/));
  });

  it("includes only approved resources: validated assets with public https links", () => {
    const bundle = loadSeedBundle();
    bundle.digitalAssets = bundle.digitalAssets.map((a) =>
      a.id === "asset-medical-gas-overview"
        ? {
            ...a,
            validationStatus: "validated",
            market: "puerto-rico",
            access: { kind: "url", url: "https://resources.hospital-approved.test/overview" },
            reviewedBy: "Marketing",
            lastReviewedAt: "2026-09-01",
            requiresSalesValidation: false,
          }
        : a,
    );
    const report = buildReportPayload(input({}, bundle));
    const resources = report.recommendations.flatMap((r) => r.resources);
    expect(resources.length).toBeGreaterThan(0);
    expect(resources.every((r) => r.url === "https://resources.hospital-approved.test/overview")).toBe(true);
    // The placeholder assets (example.com) never appear.
    expect(JSON.stringify(buildReportPayload(input()))).not.toContain("example.com/linde-sphere/placeholder");
  });

  it("refuses to build without any recommendation", () => {
    expect(() => buildReportPayload(input({ result: null }))).toThrow(ReportUnavailableError);
  });

  it("rejects demo (pending) content in a production report", () => {
    const content = { ...input().content, mode: "production" as const };
    expect(() => buildReportPayload(input({ content }))).toThrow(/production report must not contain/);
  });
});

describe("report rendering", () => {
  it("renders every section in email-safe HTML and plain text", () => {
    const { subject, html, text } = renderReport(buildReportPayload(input()));
    expect(subject).toBe("Su resumen personalizado de Linde Sphere");
    for (const expected of [
      '<html lang="es">',
      "Linde Sphere",
      "Hola, María José:",
      "O&#39;Neill-Rivera",
      "Hospital San Juan (Metro)",
      "Compras y cadena de suministro",
      "Sus prioridades",
      "Áreas que exploró",
      "Recomendaciones principales",
      "Por qué apareció",
      "Converse con un especialista",
      'href="mailto:ventas@example.com?subject=',
      "Equipo comercial (ejemplo)",
      "La aplicabilidad final requiere",
      "Recibe este mensaje porque solicitó su resumen",
      "@media (max-width: 620px)",
      "@media print",
    ]) {
      expect(html).toContain(expected);
    }
    for (const expected of [
      "SUS PRIORIDADES",
      "Por qué apareció:",
      "María José O'Neill-Rivera",
      "ventas@example.com",
    ]) {
      expect(text).toContain(expected);
    }
  });

  it("renders the English report", () => {
    const { html, text } = renderReport(buildReportPayload(input({ language: "en" })));
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("Hello María José,");
    expect(html).toContain("Why it appeared");
    expect(text).toContain("TOP RECOMMENDATIONS");
  });

  it("escapes visitor-provided values", () => {
    const { html } = renderReport(
      buildReportPayload(
        input({ visitor: { firstName: "Ana", lastName: "Ruiz", organization: 'Clínica "Norte" & <Sur>' } }),
      ),
    );
    expect(html).toContain("Clínica &quot;Norte&quot; &amp; &lt;Sur&gt;");
    expect(html).not.toContain("<Sur>");
  });

  it("loads nothing remote: no scripts, images, stylesheets or tracking links", () => {
    const { html } = renderReport(buildReportPayload(input()));
    expect(html).not.toMatch(/<script|<img|<link|<iframe|url\(/i);
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);
    expect(hrefs.every((h) => h.startsWith("mailto:") || h.startsWith("https://"))).toBe(true);
  });
});

describe("report privacy boundaries", () => {
  it("never contains scores, internal notes, sales-review data or hidden session data", () => {
    const bundle = loadSeedBundle();
    const { html, text } = renderReport(buildReportPayload(input({}, bundle)));
    const both = html + text;
    expect(both).not.toMatch(/score|puntaje|puntuación|leadTier|lead score/i);
    // Internal notes and sales-review worksheets from content never leak.
    for (const solution of bundle.solutions) {
      if (solution.internalNotes) expect(both).not.toContain(solution.internalNotes.slice(0, 40));
      expect(both).not.toContain("salesReview");
    }
    expect(both).not.toContain(bundle.report.internalNotes.slice(0, 40));
    // No session internals: hotspot ids, event names, session or lead ids.
    expect(both).not.toContain("gas-plant-bulk-tank");
    expect(both).not.toMatch(/hotspot-opened|scene-visited|lead-1/);
  });

  it("each report contains only its own visitor", () => {
    const a = renderReport(buildReportPayload(input())).html;
    const b = renderReport(
      buildReportPayload(
        input({
          leadId: "lead-2",
          visitor: { firstName: "Luis", lastName: "Prueba", organization: "Clínica Modelo" },
        }),
      ),
    ).html;
    expect(a).not.toContain("Luis");
    expect(b).not.toContain("María");
    expect(b).not.toContain("Hospital San Juan");
  });
});
