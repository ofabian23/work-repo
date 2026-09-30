import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalOverflow, expectTouchTargets, gotoKiosk } from "./helpers";

/** Visitor-facing recommendation ("value") screen across the three journeys, end to end. */

const primaryIds = async (page: Page) =>
  await page
    .getByRole("list", { name: "Recomendaciones principales" })
    .getByRole("article")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-testid")!.replace("recommendation-", "")));

async function expectValueScreen(page: Page) {
  const valueScreen = page.getByTestId("recommendations-screen");
  await expect(valueScreen.getByRole("heading", { level: 1 })).toHaveText(
    "Identificamos oportunidades relevantes para usted",
  );
  await expect(page.getByTestId("recommendations-disclaimer")).toContainText(
    "no una evaluación completa ni un consejo clínico",
  );
  await expect(valueScreen).toContainText(
    "Contenido de demostración pendiente de validación para Puerto Rico.",
  );
  const cards = page.getByRole("list", { name: "Recomendaciones principales" }).getByRole("article");
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeLessThanOrEqual(3);
  for (let i = 0; i < (await cards.count()); i++) {
    await expect(cards.nth(i).getByRole("region", { name: "Por qué es relevante" })).toContainText(
      "Aparece porque",
    );
    await expect(cards.nth(i)).toContainText("Siguiente paso");
    await expect(cards.nth(i)).toContainText("Áreas relacionadas");
  }
  await expect(page.getByTestId("send-summary")).toHaveText("Enviarme mi resumen personalizado");
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expectTouchTargets(page);
  await expectNoHorizontalOverflow(page);
}

async function closeSheet(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
}

async function exploreTwoScenes(page: Page) {
  await page.getByTestId("attract-start").click();
  await page.getByTestId("path-explore").click();
  await page.getByTestId("hotspot-campus-expansion").click();
  await closeSheet(page);
  await page.getByTestId("hotspot-campus-to-gas-plant").click();
  await expect(page.getByTestId("explorer-screen")).toHaveAttribute("data-scene", "gas-plant");
  await page.getByTestId("hotspot-gas-plant-bulk-tank").click();
  await closeSheet(page);
}

test.describe("recommendation and value screen", () => {
  test.beforeEach(async ({ page }) => {
    await gotoKiosk(page);
  });

  test("short role-based journey leads to three recommendations and the summary request", async ({
    page,
  }, testInfo) => {
    await page.getByTestId("attract-start").click();
    await page.getByTestId("path-role").click();
    await page.getByTestId("persona-procurement-supply").click();
    await page.getByTestId("persona-continue").click();
    await page.getByTestId("role-challenges-continue").click();
    await page.getByTestId("next-view-recommendations").click();
    await expectValueScreen(page);
    await expect(page.getByTestId("recommendations-summary")).toContainText(
      "Su área: Compras y cadena de suministro",
    );
    expect(await primaryIds(page)).toHaveLength(3);
    await page.screenshot({
      path: testInfo.outputPath(`value-${testInfo.project.name}.png`),
      animations: "disabled",
    });

    await page.getByTestId("send-summary").click();
    await expect(page.getByTestId("summary-request-screen").getByRole("heading", { level: 1 })).toHaveText(
      "Su resumen personalizado",
    );
    await page.getByTestId("summary-back").click();
    await expect(page.getByTestId("recommendations-screen")).toBeVisible();
  });

  test("challenge-based journey (Necesito…) with the role skipped", async ({ page }) => {
    await page.getByTestId("attract-start").click();
    await page.getByTestId("path-challenge").click();
    await page.getByTestId("challenge-emergency-preparedness").click();
    await page.getByTestId("challenge-supply-continuity").click();
    await page.getByTestId("challenges-continue").click();
    await page.getByTestId("persona-continue").click();
    await expect(page.getByTestId("tailoring-screen")).toBeVisible();
    await expectValueScreen(page);
    await expect(page.getByTestId("recommendations-summary")).toContainText(
      "Sus prioridades: Prepararse para emergencias y Mejorar la continuidad del suministro",
    );
    expect((await primaryIds(page))[0]).toBe("backup-emergency-supply");
  });

  test("explorer-only journey", async ({ page }) => {
    await exploreTwoScenes(page);
    await page.getByTestId("view-my-recommendations").click();
    await expectValueScreen(page);
    await expect(page.getByTestId("recommendations-summary")).toContainText(
      "Lo que exploró: Campus hospitalario y Planta de gases medicinales",
    );
  });

  test("continuing exploration keeps progress; walking around does not reorder recommendations", async ({
    page,
  }) => {
    await exploreTwoScenes(page);
    await page.getByTestId("view-my-recommendations").click();
    const before = await primaryIds(page);
    await page.getByTestId("continue-exploring").click();
    await expect(page.getByTestId("explorer-screen")).toHaveAttribute("data-scene", "gas-plant");
    await expect(page.getByTestId("hotspot-gas-plant-bulk-tank")).toHaveAttribute("data-visited", "true");
    await page.getByTestId("explorer-back").click();
    await page.getByTestId("hotspot-campus-to-icu").click();
    await expect(page.getByTestId("explorer-screen")).toHaveAttribute("data-scene", "icu");

    await page.getByTestId("recommendation-tray-button").click();
    const tray = page.getByTestId("recommendation-tray");
    await expect(tray.getByRole("listitem")).toHaveCount(before.length);
    await page.getByTestId("recommendation-tray-view-all").click();
    expect(await primaryIds(page)).toEqual(before);
    await expect(page.getByTestId("recommendations-screen")).not.toContainText(
      "Actualizamos sus recomendaciones",
    );
  });

  test("new meaningful evidence updates the recommendations and says so", async ({ page }) => {
    await page.getByTestId("attract-start").click();
    await page.getByTestId("path-role").click();
    await page.getByTestId("persona-procurement-supply").click();
    await page.getByTestId("persona-continue").click();
    await page.getByTestId("role-challenges-continue").click();
    await page.getByTestId("next-view-recommendations").click();
    expect(await primaryIds(page)).toEqual([
      "medical-gas-supply-planning",
      "cylinder-inventory-management",
      "bulk-centralized-supply",
    ]);
    await page.getByTestId("continue-exploring").click();
    await page.getByTestId("hotspot-campus-to-laboratory").click();
    await expect(page.getByTestId("explorer-screen")).toHaveAttribute("data-scene", "laboratory");
    await page.getByTestId("hotspot-lab-safe-handling").click();
    await closeSheet(page);
    await expect(page.getByTestId("recommendation-tray-new")).toHaveText("1 nuevas");
    await page.getByTestId("view-my-recommendations").click();
    await expect(page.getByTestId("recommendations-screen")).toContainText(
      "Actualizamos sus recomendaciones con lo que exploró.",
    );
    expect(await primaryIds(page)).toEqual([
      "training-operational-readiness",
      "medical-gas-supply-planning",
      "cylinder-inventory-management",
    ]);
    await expect(page.getByTestId("new-badge")).toHaveCount(1);
  });
});
