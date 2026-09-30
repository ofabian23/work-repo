import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalOverflow, expectTouchTargets, gotoKiosk } from "./helpers";

/**
 * Lead form and consent experience against the real production server and database (ADR-053).
 * Email delivery is not wired yet (Phase 8), so a real submission ends "saved, will be sent"; the
 * email-failure and server-error paths are simulated by intercepting the API responses.
 */

const EMAIL_USER = `e2e.${Math.random().toString(36).slice(2, 8)}`;
const EMAIL = `${EMAIL_USER}@example.test`;

async function openForm(page: Page) {
  await page.getByTestId("attract-start").click();
  await page.getByTestId("path-role").click();
  await page.getByTestId("persona-operations-facilities").click();
  await page.getByTestId("persona-continue").click();
  await page.getByTestId("challenge-aging-infrastructure").click();
  await page.getByTestId("role-challenges-continue").click();
  await page.getByTestId("next-view-recommendations").click();
  await page.getByTestId("send-summary").click();
  await page.getByTestId("summary-continue").click();
  await expect(page.getByTestId("lead-step-contact")).toBeVisible();
}

/** Taps a consent row (its label is the touch target; the native checkbox is visually hidden). */
const tapConsent = (page: Page, testId: string) =>
  page.locator("label", { has: page.getByTestId(testId) }).click();

async function fillContact(page: Page, email = EMAIL) {
  await page.getByTestId("lead-firstName").fill("Prueba");
  await page.getByTestId("lead-lastName").fill("Automatizada");
  await page.getByTestId("lead-organization").fill("Hospital de Pruebas (ficticio)");
  await page.getByTestId("lead-email").fill(email);
}

async function toReview(page: Page) {
  await fillContact(page);
  await page.getByTestId("lead-continue").click();
  await tapConsent(page, "consent-report");
  await page.getByTestId("lead-continue").click();
  await expect(page.getByTestId("lead-step-review")).toBeVisible();
}

test.describe("lead form and consent", () => {
  test.beforeEach(async ({ page }) => {
    await gotoKiosk(page);
  });

  test("valid submission is stored by the server and shows only the masked email", async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await expectTouchTargets(page);
    await expectNoHorizontalOverflow(page);
    await expect(page.getByTestId("lead-email")).toHaveAttribute("inputmode", "email");

    await fillContact(page);
    await page.getByTestId("lead-email").press("Enter");
    await expect(page.getByTestId("lead-phone")).toBeFocused();
    await page.getByTestId("lead-phone").press("Enter");

    await expect(page.getByTestId("lead-step-preferences")).toBeVisible();
    await expect(page.getByTestId("lead-role")).toHaveValue("operations-facilities");
    await expect(page.getByTestId("consent-version")).toHaveText(
      "Versión del texto de consentimiento: 0.1.0",
    );
    await expect(page.getByTestId("consent-report")).not.toBeChecked();
    await expect(page.getByTestId("consent-follow-up")).not.toBeChecked();
    await tapConsent(page, "consent-report");
    await expect(page.getByTestId("consent-report")).toBeChecked();
    await expect(page.getByTestId("consent-follow-up")).not.toBeChecked();
    await expectTouchTargets(page);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath(`lead-consent-${testInfo.project.name}.png`),
      fullPage: true,
    });
    await page.getByTestId("lead-continue").click();

    await expect(page.getByTestId("review-email")).toHaveText(EMAIL);
    const leadRequests: string[] = [];
    page.on(
      "request",
      (r) => r.url().endsWith("/api/leads") && r.method() === "POST" && leadRequests.push(r.url()),
    );
    // A double tap sends a single request.
    await page.getByTestId("lead-submit").dblclick();

    const result = page.getByTestId("lead-result");
    await expect(result).toBeVisible();
    await expect(result).toContainText("Guardamos su solicitud");
    await expect(result).toContainText(`${EMAIL_USER.slice(0, 2)}•••@example.test`);
    await expect(page.locator("body")).not.toContainText(EMAIL);
    expect(leadRequests).toHaveLength(1);

    await page.getByTestId("lead-finish").click();
    await expect(page.getByTestId("attract-screen")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Automatizada");
    await expect(page.locator("body")).not.toContainText("@example.test");
  });

  test("inline validation blocks invalid and missing fields", async ({ page }) => {
    await openForm(page);
    await page.getByTestId("lead-continue").click();
    await expect(page.getByTestId("lead-step-contact").getByRole("alert")).toHaveText(
      "Revise los campos marcados.",
    );
    await expect(page.getByTestId("lead-firstName")).toBeFocused();
    await page.getByTestId("lead-email").fill("nombre@organizacion");
    await page.getByTestId("lead-email").blur();
    await expect(
      page.getByText("Revise el correo. Debe tener la forma nombre@organizacion.com."),
    ).toBeVisible();
    await expect(page.getByTestId("lead-email")).toHaveAttribute("aria-invalid", "true");
  });

  test("a server error keeps the details and a retry succeeds", async ({ page }) => {
    await openForm(page);
    await toReview(page);
    await page.route("**/api/leads", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"server_error"}' }),
    );
    await page.getByTestId("lead-submit").click();
    await expect(page.getByTestId("lead-failure")).toContainText("Sus datos siguen aquí");
    await expect(page.getByTestId("review-email")).toHaveText(EMAIL);
    await expect(page.locator("body")).not.toContainText("server_error");

    await page.unroute("**/api/leads");
    await page.getByTestId("lead-submit").click();
    await expect(page.getByTestId("lead-result")).toBeVisible();
  });

  test("when the email cannot be sent, the visitor is told the request was saved", async ({ page }) => {
    await page.route("**/api/leads/status/*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: '{"submission":"stored","report":"failed"}',
      }),
    );
    await openForm(page);
    await toReview(page);
    await page.getByTestId("lead-submit").click();
    const result = page.getByTestId("lead-result");
    await expect(result).toHaveAttribute("data-delivery", "delayed");
    await expect(result).toContainText("Lo intentaremos de nuevo automáticamente");
    await expect(result).not.toContainText(/SMTP|error/i);
  });

  test("cancel returns to the recommendations without the typed details", async ({ page }) => {
    await openForm(page);
    await fillContact(page);
    await page.getByTestId("lead-cancel").click();
    await page.getByTestId("lead-cancel-confirm").click();
    await expect(page.getByTestId("recommendations-screen")).toBeVisible();
    await page.getByTestId("send-summary").click();
    await page.getByTestId("summary-continue").click();
    await expect(page.getByTestId("lead-firstName")).toHaveValue("");
  });
});
