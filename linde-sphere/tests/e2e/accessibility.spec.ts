import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN_PASSPHRASE, E2E_ADMIN_PATH, GALLERY_PORT } from "../../playwright.config";
import { expectTouchTargets, gotoKiosk } from "./helpers";

/**
 * Automated accessibility checks (ADR-058): axe-core against WCAG 2.2 A/AA on every screen and dialog, at
 * kiosk, laptop and phone sizes, plus keyboard, focus, heading and language checks that axe cannot cover.
 */
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoViolations(page: Page, label: string) {
  // Let entrance animations settle so contrast is measured on final colors.
  await page.waitForTimeout(400);
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  const summary = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.nodes
        .map((n) => n.target.join(" "))
        .slice(0, 3)
        .join(" | ")}`,
  );
  expect(summary, `${label}: axe violations`).toEqual([]);
}

async function expectOneH1(page: Page, label: string) {
  const h1 = page.locator("h1:visible");
  expect(await h1.count(), `${label}: exactly one visible h1`).toBe(1);
}

async function check(page: Page, label: string) {
  await expectNoViolations(page, label);
  await expectOneH1(page, label);
  await expectTouchTargets(page);
}

test.describe("accessibility — visitor screens", () => {
  test("every screen of the role journey, explorer and lead form passes axe", async ({ page }) => {
    test.setTimeout(120_000);
    await gotoKiosk(page);
    await check(page, "attract");
    await page.getByTestId("attract-start").click();
    await check(page, "welcome");

    await page.getByTestId("path-role").click();
    await check(page, "role");
    await page.getByTestId("persona-procurement-supply").click();
    await page.getByTestId("persona-continue").click();
    await check(page, "role challenges");
    await page.getByTestId("role-challenges-continue").click();
    await expect(page.getByTestId("next-steps-screen")).toBeVisible();
    await check(page, "next steps");

    await page.getByTestId("next-explore-areas").click();
    await expect(page.getByTestId("explorer-screen")).toBeVisible();
    await check(page, "explorer");
    await page.getByTestId("hotspot-campus-expansion").click();
    await expect(page.getByTestId("hotspot-sheet")).toBeVisible();
    await expectNoViolations(page, "explorer — information sheet");
    await page.keyboard.press("Escape");

    await page.getByTestId("view-my-recommendations").click();
    await check(page, "recommendations");
    await page.getByTestId("send-summary").click();
    await check(page, "summary request");
    await page.getByTestId("summary-continue").click();
    await page.getByTestId("lead-continue").click(); // empty → errors
    await check(page, "contact details with errors");
    await page.getByTestId("lead-firstName").fill("Ana");
    await page.getByTestId("lead-lastName").fill("López");
    await page.getByTestId("lead-organization").fill("Clínica Norte (ficticia)");
    await page.getByTestId("lead-email").fill(`a11y.${Date.now()}@example.test`);
    await page.getByTestId("lead-continue").click();
    await page.getByTestId("lead-continue").click(); // missing consent → error
    await check(page, "preferences with consent error");
    await page.locator("label", { has: page.getByTestId("consent-report") }).click();
    await page.getByTestId("lead-continue").click();
    await check(page, "review");
    await page.getByTestId("lead-submit").click();
    await expect(page.getByTestId("lead-result")).toBeVisible();
    await check(page, "completion");
  });

  test("dialogs and the English interface pass axe; lang follows the language", async ({ page }) => {
    await gotoKiosk(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await page.getByRole("button", { name: "English" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.getByTestId("attract-start").click();
    await check(page, "welcome (English)");

    await page.getByTestId("accessibility-button").click();
    await expectNoViolations(page, "accessibility sheet");
    await page.keyboard.press("Escape");
    await page.getByTestId("reset-experience").click();
    await expectNoViolations(page, "reset confirmation");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Privacy" }).click();
    await expectNoViolations(page, "privacy sheet");
  });
});

test.describe("keyboard, focus and screen-reader support", () => {
  test.skip(({ isMobile }) => isMobile, "keyboard checks run on the kiosk and laptop profiles");

  test("the journey works with the keyboard alone, with a visible focus indicator", async ({ page }) => {
    await gotoKiosk(page);
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus-visible");
    await expect(focused).toHaveCount(1);
    // Keep tabbing until the start control is focused, then activate it with Enter.
    for (
      let i = 0;
      i < 8 && !(await page.getByTestId("attract-start").evaluate((el) => el === document.activeElement));
      i++
    ) {
      await page.keyboard.press("Tab");
    }
    const outline = await page.getByTestId("attract-start").evaluate((el) => {
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), shadow: s.boxShadow };
    });
    expect(outline.style !== "none" && outline.width >= 2).toBe(true);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("kiosk-experience")).toHaveAttribute("data-screen", "welcome");
    // The new screen's heading receives focus (announced by screen readers).
    await expect(page.locator("h1")).toBeFocused();
    await page.getByTestId("path-explore").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("explorer-screen")).toBeVisible();

    const hotspot = page.getByTestId("hotspot-campus-expansion");
    await hotspot.focus();
    await page.keyboard.press("Enter");
    const sheet = page.getByTestId("hotspot-sheet");
    await expect(sheet).toBeVisible();
    // Focus is trapped in the dialog and returns to the hotspot when it closes.
    for (let i = 0; i < 6; i++) await page.keyboard.press("Tab");
    expect(await sheet.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(hotspot).toBeFocused();
  });

  test("form fields have labels and errors are associated with their fields", async ({ page }) => {
    await gotoKiosk(page);
    await page.getByTestId("attract-start").click();
    await page.getByTestId("path-role").click();
    await page.getByTestId("persona-executive").click();
    await page.getByTestId("persona-continue").click();
    await page.getByTestId("role-challenges-continue").click();
    await page.getByTestId("next-view-recommendations").click();
    await page.getByTestId("send-summary").click();
    await page.getByTestId("summary-continue").click();
    await page.getByTestId("lead-email").fill("no-es-correo");
    await page.getByTestId("lead-continue").click();

    const email = page.getByRole("textbox", { name: /Correo electrónico de trabajo/ });
    await expect(email).toHaveAttribute("aria-invalid", "true");
    const describedBy = (await email.getAttribute("aria-describedby")) ?? "";
    const descriptions = await Promise.all(
      describedBy.split(" ").map((id) => page.locator(`[id="${id}"]`).textContent()),
    );
    expect(descriptions.join(" ")).toContain("Revise el correo");
    // Errors are shown with text and an icon, never by color alone.
    await expect(
      page.getByText("Revise el correo. Debe tener la forma nombre@organizacion.com."),
    ).toBeVisible();
  });
});

test.describe("accessibility — admin utility", () => {
  test.skip(({ isMobile }) => isMobile, "admin is used on the laptop");
  const ADMIN = `http://localhost:${GALLERY_PORT}${E2E_ADMIN_PATH}`;

  test("sign-in and lead list pass axe", async ({ page }) => {
    await page.goto(ADMIN);
    await expectNoViolations(page, "admin sign-in");
    await page.getByTestId("admin-passphrase").fill(E2E_ADMIN_PASSPHRASE);
    await page.getByTestId("admin-login-submit").click();
    await expect(page.getByTestId("admin-overview")).toBeVisible();
    await expectNoViolations(page, "admin leads");
    await page.goto(`${ADMIN}/exports`);
    await expectNoViolations(page, "admin exports");
    await page.goto(`${ADMIN}/content`);
    await expectNoViolations(page, "admin pending content");
  });
});
