import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { PRODUCTION_CONTENT_PORT } from "../../playwright.config";
import { gotoKiosk } from "./helpers";

/**
 * Production content mode (ADR-060) against a real production server with CONTENT_MODE=production and the
 * committed content, where nothing is validated yet. Nothing assumed may reach the visitor: no names, no
 * pending badges, no demo notice, and the API refuses leads that name unvalidated content.
 */
const BASE = `http://localhost:${PRODUCTION_CONTENT_PORT}`;
const read = (file: string) => JSON.parse(fs.readFileSync(path.join("content", file), "utf8")) as unknown;
type Named = { label?: { es: string; en: string }; title?: { es: string; en: string } };
const names = (items: Named[]) => items.flatMap((i) => Object.values(i.label ?? i.title ?? {}));
const scenes = fs.readdirSync(path.join("content", "scenes")).map(
  (f) =>
    read(path.join("scenes", f)) as Named & {
      hotspots: Named[];
    },
);
const ASSUMED_NAMES = [
  ...names(read("personas.json") as Named[]),
  ...names(read("challenges.json") as Named[]),
  ...names(read("solutions.json") as Named[]),
  ...names(scenes),
  ...names(scenes.flatMap((s) => s.hotspots)),
];

test.describe("production content mode", () => {
  test("checks a meaningful list of content names", () => {
    expect(ASSUMED_NAMES.length).toBeGreaterThan(100);
  });

  test("the kiosk offers nothing unvalidated: a neutral message, no paths, no pending or demo labels", async ({
    page,
  }) => {
    const health = await (await page.request.get(`${BASE}/api/health`)).json();
    expect(health.app.contentMode).toBe("production");

    await gotoKiosk(page, BASE);
    await expect(page.getByTestId("demo-mode-indicator")).toHaveCount(0);
    await page.getByTestId("attract-start").click();
    await expect(page.getByTestId("welcome-unavailable")).toBeVisible();
    for (const p of ["role", "challenge", "explore"])
      await expect(page.getByTestId(`path-${p}`)).toHaveCount(0);

    const text = await page.locator("body").innerText();
    const leaked = ASSUMED_NAMES.filter((n) => text.includes(n));
    expect(leaked).toEqual([]);
    expect(text).not.toMatch(/pendiente de validación|pending local validation|modo demostración/i);

    // The same in English.
    await page.getByRole("button", { name: "English" }).click();
    const english = await page.locator("body").innerText();
    expect(ASSUMED_NAMES.filter((n) => english.includes(n))).toEqual([]);
    await expect(page.getByTestId("welcome-unavailable")).toContainText("being reviewed");
  });

  test("the page source sent to the browser contains no assumed content or internal review fields", async ({
    page,
  }) => {
    const html = await (await page.request.get(`${BASE}/`)).text();
    expect(ASSUMED_NAMES.filter((n) => html.includes(n))).toEqual([]);
    for (const key of ["salesReview", "approvalStatus", "internalNotes", "salesOwner"])
      expect(html).not.toContain(key);
    // Placeholder consent and report wording is withheld until legal/marketing validate it.
    const legalTexts = [read("consent.json"), read("report.json")]
      .flatMap((c) => JSON.stringify(c).match(/"(?:es|en)":"[^"]{25,}"/g) ?? [])
      .map((m) => JSON.parse(m.slice(5)) as string);
    expect(legalTexts.length).toBeGreaterThan(5);
    expect(legalTexts.filter((text) => html.includes(text))).toEqual([]);
  });

  test("a lead naming assumed content is refused", async ({ request }) => {
    const res = await request.post(`${BASE}/api/leads`, {
      headers: { origin: BASE },
      data: {
        sessionId: "5b0c6a8e-7a53-4a5e-9f3d-2f4b8a6d9c11",
        sessionStartedAt: new Date(Date.now() - 120_000).toISOString(),
        idempotencyKey: "0f8e2f52-8f0c-4d8a-a1b2-3c4d5e6f7a8c",
        firstName: "Prueba",
        lastName: "Produccion",
        organization: "Hospital de Pruebas (ficticio)",
        jobFunctionId: "procurement-supply",
        email: `produccion.${Date.now()}@example.test`,
        phone: "",
        preferredLanguage: "es",
        selectedInterestIds: ["supply-continuity"],
        consents: { reportDelivery: true, salesFollowUp: false },
        consentVersion: "0.1.0",
        signals: {
          personaId: "procurement-supply",
          challengeIds: ["supply-continuity"],
          facilityTypeId: null,
          visitedSceneIds: [],
          openedHotspotIds: [],
          engagedHotspotIds: [],
          explicitInterestIds: [],
        },
        submittedAt: new Date().toISOString(),
      },
    });
    expect(res.status()).toBe(422);
  });
});
