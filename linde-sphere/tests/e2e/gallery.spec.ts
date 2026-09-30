import { expect, test } from "@playwright/test";
import { GALLERY_PORT } from "../../playwright.config";
import { expectNoHorizontalOverflow, expectTouchTargets, gotoHydrated } from "./helpers";

const GALLERY_URL = `http://localhost:${GALLERY_PORT}/dev/components`;

test.describe("component gallery access", () => {
  test("is not available in a default production build", async ({ page }) => {
    const response = await page.goto("/dev/components");
    expect(response?.status()).toBe(404);
    await expect(page.getByTestId("component-gallery")).toHaveCount(0);
  });

  test("is available when ENABLE_COMPONENT_GALLERY=true and is not indexable", async ({ page }) => {
    const response = await page.goto(GALLERY_URL);
    expect(response?.status()).toBe(200);
    await expect(page.getByTestId("component-gallery")).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});

test.describe("design system in the gallery", () => {
  test.beforeEach(async ({ page }) => {
    await gotoHydrated(page, GALLERY_URL);
    await expect(page.locator('[data-testid="component-gallery"][data-ready="true"]')).toBeVisible();
  });

  test("renders every component section with large targets and no overflow", async ({ page }, testInfo) => {
    for (const id of [
      "tokens",
      "shell",
      "actions",
      "cards",
      "navigation",
      "explorer",
      "recommendations",
      "overlays",
      "forms",
      "banners",
      "states",
    ]) {
      await expect(page.getByTestId(`gallery-${id}`)).toBeVisible();
    }
    await expectTouchTargets(page);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath(`gallery-${testInfo.project.name}.png`),
      fullPage: true,
    });
  });

  test("hotspot sheet is keyboard operable and returns focus on Esc", async ({ page }, testInfo) => {
    const hotspot = page.getByTestId("hotspot-gas-plant-backup");
    await hotspot.focus();
    await page.keyboard.press("Enter");
    const sheet = page.getByTestId("hotspot-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId("solution-panel")).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`sheet-${testInfo.project.name}.png`),
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(hotspot).toBeFocused();
    await expect(hotspot).toHaveAttribute("data-visited", "true");
  });

  test("selecting a challenge updates the live recommendations", async ({ page }) => {
    await page.getByTestId("challenge-emergency-preparedness").click();
    await expect(page.getByTestId("recommendation-backup-emergency-supply")).toBeVisible();
    await expect(page.getByTestId("recommendation-backup-emergency-supply")).toContainText(
      "Por qué es relevante",
    );
  });

  test("reset requires confirmation", async ({ page }) => {
    await page.getByTestId("gallery-shell").getByTestId("reset-experience").click();
    const dialog = page.getByTestId("reset-confirmation");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Sí, empezar de nuevo" }).click();
    await expect(page.getByTestId("reset-count")).toHaveText("Resets confirmed: 1");
  });

  test("keyboard focus is clearly visible", async ({ page }) => {
    const button = page.getByTestId("open-modal");
    await button.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(button).toBeFocused();
    const outline = await button.evaluate((el) => {
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, width: s.outlineWidth };
    });
    expect(outline).toEqual({ style: "solid", width: "4px" });
  });

  test("hotspot pulse animates normally and stops with reduced motion", async ({ page }) => {
    const pulse = page.getByTestId("hotspot-gas-plant-bulk-tank").getByTestId("hotspot-pulse");
    expect(await pulse.evaluate((el) => getComputedStyle(el).animationName)).toBe("pulse-ring");
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await pulse.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  });

  test("inactivity warning counts down and continue closes it", async ({ page }, testInfo) => {
    await page.getByTestId("open-inactivity").click();
    const dialog = page.getByTestId("inactivity-warning");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Continuar" })).toBeFocused();
    await page.screenshot({
      path: testInfo.outputPath(`inactivity-${testInfo.project.name}.png`),
      animations: "disabled",
    });
    await expect(dialog).toContainText(/1[0-4]/, { timeout: 5_000 });
    await dialog.getByRole("button", { name: "Continuar" }).click();
    await expect(dialog).toBeHidden();
  });
});
