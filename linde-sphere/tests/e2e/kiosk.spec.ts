import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, expectTouchTargets, gotoKiosk } from "./helpers";

test.describe("attract and welcome experience", () => {
  test.beforeEach(async ({ page }) => {
    await gotoKiosk(page);
  });

  test("touching the attract screen starts a session on the welcome screen", async ({ page }, testInfo) => {
    await page.getByTestId("attract-start").click();
    const welcome = page.getByTestId("welcome-screen");
    await expect(welcome.getByRole("heading", { level: 1 })).toHaveText("¿Cómo desea comenzar?");
    await expect(welcome.getByRole("heading", { level: 1 })).toBeFocused();
    // The new screen starts at the top with the header (brand and controls) in view.
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.getByTestId("brand-wordmark")).toBeInViewport();
    await expect(page.getByTestId("welcome-promises")).toContainText("Recomendaciones personalizadas");
    await expect(page.getByTestId("reset-experience")).toBeVisible();
    await expect(page.getByTestId("privacy-link")).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await expectTouchTargets(page);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath(`welcome-${testInfo.project.name}.png`),
      animations: "disabled",
    });
  });

  test("language switch works on attract and welcome", async ({ page }) => {
    await page.getByTestId("language-en").click();
    await expect(page.getByTestId("attract-phrase")).toHaveText("Explore a hospital in minutes");
    await page.getByTestId("attract-start").click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("How would you like to begin?");
    await page.getByTestId("language-es").click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("¿Cómo desea comenzar?");
  });

  for (const [path, screen, title, back] of [
    ["role", "persona-screen", "¿En qué área trabaja?", "persona-back"],
    ["challenge", "path-screen-challenge", "Necesito…", "back-to-welcome"],
    ["explore", "path-screen-explore", "Explorar el hospital", "back-to-welcome"],
  ] as const) {
    test(`entry path '${path}' opens and returns to the welcome screen`, async ({ page }) => {
      await page.getByTestId("attract-start").click();
      await page.getByTestId(`path-${path}`).click();
      await expect(page.getByTestId(screen).getByRole("heading", { level: 1 })).toHaveText(title);
      await page.getByTestId(back).click();
      await expect(page.getByTestId("welcome-screen")).toBeVisible();
    });
  }

  test("explicit reset reloads to a clean attract screen", async ({ page }) => {
    await page.getByTestId("attract-start").click();
    await page.getByTestId("language-en").click();
    await page.getByTestId("accessibility-button").click();
    await page.getByTestId("a11y-largeText").click();
    await expect(page.locator("html")).toHaveAttribute("data-text-size", "large");
    await page.getByTestId("accessibility-sheet").getByRole("button", { name: "Close" }).first().click();

    await page.getByTestId("reset-experience").click();
    await page.getByTestId("reset-confirmation").getByRole("button", { name: "Yes, start over" }).click();

    await expect(page.getByTestId("attract-screen")).toBeVisible();
    await expect(page.locator('[data-testid="kiosk-experience"][data-ready="true"]')).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.locator("html")).not.toHaveAttribute("data-text-size", "large");
    await expect(page.getByTestId("reset-experience")).toHaveCount(0);
    const storage = await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
      history: history.length,
    }));
    expect(storage.local + storage.session).toBe(0);
  });

  test("privacy sheet is reachable but not dominant", async ({ page }) => {
    await page.getByTestId("attract-start").click();
    await page.getByTestId("privacy-link").click();
    await expect(page.getByTestId("privacy-sheet")).toContainText("No le pedimos datos de contacto");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("privacy-sheet")).toBeHidden();
    await expect(page.getByTestId("privacy-link")).toBeFocused();
  });

  test("attract motion stops with reduced motion", async ({ page }) => {
    const floating = page.locator('[data-testid="attract-screen"] .motion-safe\\:animate-float');
    expect(await floating.evaluate((el) => getComputedStyle(el).animationName)).toBe("float");
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await floating.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  });
});
