import { expect, test, type Page } from "@playwright/test";
import { GALLERY_PORT } from "../../playwright.config";
import { gotoKiosk } from "./helpers";

/**
 * Convention session management against the production build (ADR-055). The second server runs with
 * short kiosk timings (warning after 10 s, 5 s countdown, 5 s completion countdown).
 */
const SHORT_TIMINGS = `http://localhost:${GALLERY_PORT}/`;
const phase = (page: Page) => page.getByTestId("kiosk-experience");

async function toRecommendations(page: Page) {
  await page.getByTestId("attract-start").click();
  await page.getByTestId("path-role").click();
  await page.getByTestId("persona-procurement-supply").click();
  await page.getByTestId("persona-continue").click();
  await page.getByTestId("role-challenges-continue").click();
  await page.getByTestId("next-view-recommendations").click();
  await expect(phase(page)).toHaveAttribute("data-session-phase", "recommendation-ready");
}

async function submitLead(page: Page, email: string) {
  await page.getByTestId("send-summary").click();
  await page.getByTestId("summary-continue").click();
  await page.getByTestId("lead-firstName").fill("Sesión");
  await page.getByTestId("lead-lastName").fill("Prueba");
  await page.getByTestId("lead-organization").fill("Hospital de Pruebas (ficticio)");
  await page.getByTestId("lead-email").fill(email);
  await page.getByTestId("lead-continue").click();
  await page.locator("label", { has: page.getByTestId("consent-report") }).click();
  await page.getByTestId("lead-continue").click();
  await page.getByTestId("lead-submit").click();
  await expect(phase(page)).toHaveAttribute("data-session-phase", "complete");
}

const uniqueEmail = () => `sesion.${Math.random().toString(36).slice(2, 8)}@example.test`;

test.describe("convention session management", () => {
  test("inactivity: warning, “Continuar mi sesión”, then automatic reset to a fresh session", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await gotoKiosk(page, SHORT_TIMINGS);
    await toRecommendations(page);

    const warning = page.getByTestId("inactivity-warning");
    await expect(warning).toBeVisible({ timeout: 15_000 });
    await warning.getByRole("button", { name: "Continuar mi sesión" }).click();
    await expect(warning).toBeHidden();
    await expect(page.getByTestId("recommendations-screen")).toBeVisible();

    await expect(page.getByTestId("attract-screen")).toBeVisible({ timeout: 25_000 });
    await expect(phase(page)).toHaveAttribute("data-session-phase", "attracting");
    await page.getByTestId("attract-start").click();
    await expect(page.getByTestId("kiosk-experience")).toHaveAttribute("data-screen", "welcome");
    await expect(page.getByTestId("recommendations-screen")).toHaveCount(0);
  });

  test("completion: status, masked email, countdown, automatic return to attract", async ({ page }) => {
    test.setTimeout(60_000);
    await gotoKiosk(page, SHORT_TIMINGS);
    await toRecommendations(page);
    const email = uniqueEmail();
    await submitLead(page, email);
    await expect(page.getByTestId("delivery-status")).toContainText(`${email.slice(0, 2)}•••@example.test`);
    await expect(page.getByTestId("consultation-next-step")).toBeVisible();
    await expect(page.getByTestId("completion-countdown")).toContainText("Volveremos al inicio en");
    await expect(page.getByTestId("attract-screen")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("body")).not.toContainText(email.split("@")[0]!);
  });

  test("browser back and forward after a reset never show the previous visitor", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.headers()["cache-control"]).toContain("no-store");
    await gotoKiosk(page);
    await toRecommendations(page);
    const email = uniqueEmail();
    await submitLead(page, email);
    await page.getByTestId("lead-finish").click();
    await expect(page.getByTestId("attract-screen")).toBeVisible();

    const leaked = async () => {
      const text =
        (await page
          .locator("body")
          .textContent()
          .catch(() => "")) ?? "";
      return ["Sesión", "Prueba", "Hospital de Pruebas", email.split("@")[0]!, "•••@example.test"].filter(
        (v) => text.includes(v),
      );
    };
    expect(await leaked()).toEqual([]);
    await page.goBack().catch(() => null);
    expect(await leaked()).toEqual([]);
    await page.goForward().catch(() => null);
    expect(await leaked()).toEqual([]);
    // Nothing about the visitor is kept in browser storage either.
    const storage = await page.evaluate(() => {
      try {
        return localStorage.length + sessionStorage.length;
      } catch {
        return 0;
      }
    });
    expect(storage).toBe(0);
  });
});
