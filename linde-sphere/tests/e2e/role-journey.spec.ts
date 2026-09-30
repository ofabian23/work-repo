import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalOverflow, expectTouchTargets, gotoKiosk } from "./helpers";

/**
 * "Trabajo en…" end to end, for the four roles the convention prioritizes. Recommendations are
 * deterministic, so each journey asserts the actual top results and that every card explains itself.
 */
const JOURNEYS = [
  {
    personaId: "operations-facilities",
    label: "Operaciones e instalaciones",
    challengeId: "aging-infrastructure",
    challengeLabel: "Modernizar infraestructura envejecida",
    top: "infrastructure-assessment",
  },
  {
    personaId: "procurement-supply",
    label: "Compras y cadena de suministro",
    challengeId: "cylinder-inventory",
    challengeLabel: "Manejar cilindros e inventario",
    top: "cylinder-inventory-management",
  },
  {
    personaId: "clinical-respiratory",
    label: "Clínica y terapia respiratoria",
    challengeId: "patient-staff-safety",
    challengeLabel: "Mejorar la seguridad de pacientes y personal",
    top: "clinical-oxygen-support",
  },
  {
    personaId: "executive",
    label: "Alta gerencia",
    challengeId: "supply-continuity",
    challengeLabel: "Mejorar la continuidad del suministro",
    top: "medical-gas-supply-planning",
  },
] as const;

async function openRolePath(page: Page) {
  await page.getByTestId("attract-start").click();
  await page.getByTestId("path-role").click();
  await expect(page.getByTestId("persona-screen").getByRole("heading", { level: 1 })).toHaveText(
    "¿En qué área trabaja?",
  );
}

test.describe("role-based journey", () => {
  test.beforeEach(async ({ page }) => {
    await gotoKiosk(page);
  });

  for (const j of JOURNEYS) {
    test(`${j.personaId}: persona → challenges → tailoring → recommendations with reasons`, async ({
      page,
    }) => {
      await openRolePath(page);
      await page.getByTestId(`persona-${j.personaId}`).click();
      await expect(page.getByTestId(`persona-${j.personaId}`)).toHaveAttribute("aria-pressed", "true");
      await page.getByTestId("persona-continue").click();

      const challenges = page.getByTestId("role-challenges-screen");
      await expect(challenges).toContainText(j.label);
      const options = challenges.getByRole("list").getByRole("button");
      expect(await options.count()).toBeLessThanOrEqual(5); // ≤ 4 suggestions + “Algo más”
      await expect(page.getByTestId("challenge-something-else")).toBeVisible();
      await page.getByTestId(`challenge-${j.challengeId}`).click();
      await page.getByTestId("role-challenges-continue").click();

      await expect(page.getByTestId("tailoring-screen")).toHaveText(
        "Estamos adaptando la experiencia a sus prioridades.",
      );
      const nextSteps = page.getByTestId("next-steps-screen");
      await expect(nextSteps).toBeVisible();
      await expect(page.getByTestId("next-steps-summary")).toContainText(j.challengeLabel);
      await expect(page.getByTestId("next-view-recommendations")).toBeVisible();
      await expect(page.getByTestId("next-refine-challenges")).toBeVisible();
      await expect(page.getByTestId("next-explore-areas")).toBeVisible();

      await page.getByTestId("next-view-recommendations").click();
      const cards = page.getByTestId("recommendations-screen").getByRole("article");
      await expect(cards.first()).toBeVisible();
      await expect(page.getByTestId(`recommendation-${j.top}`)).toHaveAttribute(
        "aria-label",
        /^Recomendación 1: /,
      );
      const count = await cards.count();
      for (let i = 0; i < count; i++) {
        await expect(cards.nth(i).getByRole("region", { name: "Por qué aparece" })).toContainText(
          "Aparece porque",
        );
      }
      await expect(cards.first()).toContainText(`«${j.challengeLabel}»`);
      await expect(page.getByRole("textbox")).toHaveCount(0);
      await expectTouchTargets(page);
      await expectNoHorizontalOverflow(page);
    });
  }

  test("“My role spans several areas” and “Something else” work without typing", async ({ page }) => {
    await openRolePath(page);
    await page.getByTestId("persona-multiple-areas").click();
    await page.getByTestId("persona-continue").click();
    await page.getByTestId("challenge-something-else").click();
    await expect(page.getByTestId("challenge-something-else")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("role-challenges-continue").click();
    await expect(page.getByTestId("next-steps-screen")).toBeVisible();
    await page.getByTestId("next-view-recommendations").click();
    await expect(page.getByTestId("recommendations-screen").getByRole("article")).toHaveCount(1);
    await expect(page.getByRole("textbox")).toHaveCount(0);
  });

  test("refining and exploring are available after the transition, in English too", async ({ page }) => {
    await page.getByTestId("language-en").click();
    await page.getByTestId("attract-start").click();
    await page.getByTestId("path-role").click();
    await page.getByTestId("persona-procurement-supply").click();
    await page.getByTestId("persona-continue").click();
    await page.getByTestId("role-challenges-continue").click();
    await expect(page.getByTestId("tailoring-screen")).toHaveText(
      "We are tailoring the experience to your priorities.",
    );
    await page.getByTestId("next-refine-challenges").click();
    await page.getByTestId("challenge-emergency-preparedness").click();
    await page.getByTestId("refine-continue").click();
    await expect(page.getByTestId("recommendations-screen").getByRole("article").first()).toContainText(
      "This appeared because",
    );
    await page.getByTestId("recommendations-explore").click();
    await expect(page.getByTestId("relevant-areas")).toBeVisible();
  });

  test("screens fit the portrait kiosk and look right", async ({ page }, testInfo) => {
    await openRolePath(page);
    const shot = (name: string) =>
      page.screenshot({
        path: testInfo.outputPath(`${name}-${testInfo.project.name}.png`),
        animations: "disabled",
      });
    await page.getByTestId("persona-operations-facilities").click();
    await expectTouchTargets(page);
    await expectNoHorizontalOverflow(page);
    await shot("persona");
    await page.getByTestId("persona-continue").click();
    await page.getByTestId("challenge-aging-infrastructure").click();
    await shot("role-challenges");
    await page.getByTestId("role-challenges-continue").click();
    await expect(page.getByTestId("next-steps-screen")).toBeVisible();
    await expectTouchTargets(page);
    await shot("next-steps");
    await page.getByTestId("next-view-recommendations").click();
    await expect(page.getByTestId("recommendations-screen")).toBeVisible();
    await shot("recommendations");
    if (testInfo.project.name === "kiosk-portrait") {
      // The persona list fits the 1080 × 1920 screen without scrolling.
      await page.getByTestId("recommendations-back").click();
      await page.getByTestId("next-steps-change-role").click();
      const fits = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight);
      expect(fits).toBe(true);
    }
  });
});
