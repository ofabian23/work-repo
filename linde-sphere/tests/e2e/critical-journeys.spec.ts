import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  E2E_ADMIN_PASSPHRASE,
  E2E_ADMIN_PATH,
  FAILING_EMAIL_PORT,
  GALLERY_PORT,
  PRODUCTION_CONTENT_PORT,
} from "../../playwright.config";
import { readZip } from "../helpers/zip";
import { gotoKiosk } from "./helpers";

/**
 * The ten critical visitor journeys (TESTING.md §3), end to end against production builds.
 *
 * - Selectors are data-testid attributes or accessible roles and names, never CSS structure.
 * - No fixed sleeps: every wait is a web-first assertion. The two inactivity journeys wait for the short
 *   kiosk timings of the second server (warning 10 s, countdown 5 s) with explicit timeouts.
 * - Servers: main (3100, default LOCAL_PACKAGE follow-up: no email), short timings + admin + SMTP_EMAIL
 *   with the preview provider (3101), production content (3102), and SMTP_EMAIL with a failing SMTP
 *   server + admin (3103). The first three share one database. See playwright.config.ts.
 */
const SHORT_TIMINGS = `http://localhost:${GALLERY_PORT}/`;
const PRODUCTION = `http://localhost:${PRODUCTION_CONTENT_PORT}/`;
const FAILING_EMAIL = `http://localhost:${FAILING_EMAIL_PORT}`;

const experience = (page: Page) => page.getByTestId("kiosk-experience");
const uniqueEmail = (tag: string) => `${tag}.${Math.random().toString(36).slice(2, 8)}@example.test`;
/** Letters only (the name field accepts letters), unique per run so parallel tests never collide. */
const uniqueName = () =>
  `Prueba${Math.random()
    .toString(36)
    .replace(/[^a-z]/g, "")
    .slice(0, 6)}`;

const primaryIds = (page: Page) =>
  page
    .getByRole("list", { name: "Recomendaciones principales" })
    .getByRole("article")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-testid")!.replace("recommendation-", "")));

async function closeSheet(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
}

async function openLeadForm(page: Page) {
  await page.getByTestId("send-summary").click();
  await page.getByTestId("summary-continue").click();
  await expect(page.getByTestId("lead-step-contact")).toBeVisible();
}

async function fillContact(
  page: Page,
  { email, lastName = "Automatizada" }: { email: string; lastName?: string },
) {
  await page.getByTestId("lead-firstName").fill("Visitante");
  await page.getByTestId("lead-lastName").fill(lastName);
  await page.getByTestId("lead-organization").fill("Hospital de Pruebas (ficticio)");
  await page.getByTestId("lead-email").fill(email);
}

/**
 * Contact → preferences (report consent) → review → submit, from the contact step. Visitors who never
 * chose a role in the journey pick one on the preferences step (it is required there).
 */
async function completeLead(page: Page, contact: { email: string; lastName?: string; role?: string }) {
  await fillContact(page, contact);
  await page.getByTestId("lead-continue").click();
  if (contact.role) await page.getByTestId("lead-role").selectOption(contact.role);
  await page.locator("label", { has: page.getByTestId("consent-report") }).click();
  await page.getByTestId("lead-continue").click();
  await expect(page.getByTestId("lead-step-review")).toBeVisible();
  await expect(page.getByTestId("review-email")).toHaveText(contact.email);
  await page.getByTestId("lead-submit").click();
  await expect(page.getByTestId("lead-result")).toBeVisible();
}

async function rolePathToRecommendations(page: Page) {
  await page.getByTestId("attract-start").click();
  await page.getByTestId("path-role").click();
  await page.getByTestId("persona-operations-facilities").click();
  await page.getByTestId("persona-continue").click();
  await page.getByTestId("challenge-aging-infrastructure").click();
  await page.getByTestId("role-challenges-continue").click();
  await page.getByTestId("next-view-recommendations").click();
  await expect(page.getByTestId("recommendations-screen")).toBeVisible();
  await expect(experience(page)).toHaveAttribute("data-session-phase", "recommendation-ready");
}

/** Preview provider output for one address (no E2E server ever sends real email). */
function previewMentions(email: string): boolean {
  const dir = path.join("data", "e2e-email-preview");
  const walk = (d: string): string[] =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)],
    );
  try {
    return walk(dir).some((f) => f.endsWith(".eml") && readFileSync(f, "utf8").includes(email));
  } catch {
    return false;
  }
}

test.describe("critical journeys", () => {
  test("1. persona → challenge → recommendation → lead → follow-up package → reset", async ({ page }) => {
    await gotoKiosk(page);
    await rolePathToRecommendations(page);
    expect((await primaryIds(page)).length).toBeGreaterThan(0);

    await openLeadForm(page);
    const email = uniqueEmail("journey1");
    const lastName = uniqueName();
    await completeLead(page, { email, lastName });
    const result = page.getByTestId("lead-result");
    // Default LOCAL_PACKAGE mode (ADR-062): prepared for a representative, never "sent".
    await expect(result).toHaveAttribute("data-delivery", "packaged");
    await expect(result).toContainText("Su paquete personalizado de seguimiento está preparado");
    await expect(page.getByTestId("delivery-status")).toContainText(`${email.slice(0, 2)}•••@example.test`);
    expect(previewMentions(email), "no email attempt in LOCAL_PACKAGE").toBe(false);

    await page.getByTestId("lead-finish").click();
    await expect(page.getByTestId("attract-screen")).toBeVisible();
    await expect(experience(page)).toHaveAttribute("data-session-phase", "attracting");
    await expect(page.locator("body")).not.toContainText(email.split("@")[0]!);

    // The lead and its report are stored as "follow-up pending" and come out in the Convention Export
    // Package (the admin of the second server reads the same database).
    await page.goto(`http://localhost:${GALLERY_PORT}${E2E_ADMIN_PATH}`);
    await page.getByTestId("admin-passphrase").fill(E2E_ADMIN_PASSPHRASE);
    await page.getByTestId("admin-login-submit").click();
    await page.getByRole("link", { name: new RegExp(lastName) }).click();
    await expect(page.getByTestId("admin-lead-follow-up-mode")).toContainText("LOCAL_PACKAGE");
    await expect(page.getByTestId("admin-lead-follow-up-status")).toContainText("Seguimiento pendiente");
    await expect(page.getByTestId("admin-no-email")).toBeVisible();
    await page.goto(`http://localhost:${GALLERY_PORT}${E2E_ADMIN_PATH}/exports`);
    // Admin date filters are Puerto Rico dates (ADR-056), not UTC.
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Puerto_Rico" }).format(new Date());
    const form = page.getByTestId("export-package-form");
    await form.locator('input[name="from"]').fill(today);
    await page.getByTestId("export-package-confirm").check();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("export-package-submit").click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^linde-sphere-follow-up-package-[\d-]+\.zip$/);
    const files = readZip(readFileSync(await download.path()));
    const csv = files.get("leads.csv")!.toString("utf8");
    const row = csv.split("\r\n").find((line) => line.includes(email));
    expect(row).toContain("LOCAL_PACKAGE,follow_up_pending");
    const folder = /(reports\/[^,/]+\/)/.exec(row!)![1]!;
    expect(files.get(`${folder}report.html`)!.toString("utf8")).toContain("<html");
    expect(files.has(`${folder}report.json`)).toBe(true);
  });

  test("2. challenge → recommendation → continue exploring → updated result → lead", async ({ page }) => {
    await gotoKiosk(page);
    await page.getByTestId("attract-start").click();
    await page.getByTestId("path-challenge").click();
    await page.getByTestId("challenge-emergency-preparedness").click();
    await page.getByTestId("challenge-supply-continuity").click();
    await page.getByTestId("challenges-continue").click();
    await page.getByTestId("persona-continue").click();
    await expect(page.getByTestId("recommendations-screen")).toBeVisible();
    const before = await primaryIds(page);

    await page.getByTestId("continue-exploring").click();
    await expect(page.getByTestId("explorer-screen")).toBeVisible();
    await page.getByTestId("hotspot-campus-to-laboratory").click();
    await expect(page.getByTestId("explorer-screen")).toHaveAttribute("data-scene", "laboratory");
    await page.getByTestId("hotspot-lab-safe-handling").click();
    await closeSheet(page);
    await page.getByTestId("view-my-recommendations").click();
    await expect(page.getByTestId("recommendations-screen")).toContainText(
      "Actualizamos sus recomendaciones con lo que exploró.",
    );
    const after = await primaryIds(page);
    expect(after).not.toEqual(before);
    await expect(page.getByTestId("recommendations-summary")).toContainText("Laboratorio");

    await openLeadForm(page);
    await completeLead(page, { email: uniqueEmail("journey2"), role: "procurement-supply" });
    await expect(page.getByTestId("lead-result")).toHaveAttribute("data-delivery", "packaged");
  });

  test("3. explorer only → readiness prompt → recommendation → lead", async ({ page }) => {
    await gotoKiosk(page);
    await page.getByTestId("attract-start").click();
    await page.getByTestId("path-explore").click();
    await page.getByTestId("hotspot-campus-expansion").click();
    await closeSheet(page);
    // One meaningful point is not enough: the prompt says how many more, and there is no button yet.
    await expect(page.getByTestId("explorer-progress")).toContainText("para ver sus recomendaciones");
    await expect(page.getByTestId("view-my-recommendations")).toHaveCount(0);

    await page.getByTestId("hotspot-campus-to-gas-plant").click();
    await expect(page.getByTestId("explorer-screen")).toHaveAttribute("data-scene", "gas-plant");
    await page.getByTestId("hotspot-gas-plant-bulk-tank").click();
    await closeSheet(page);
    await expect(page.getByTestId("view-my-recommendations")).toBeVisible();
    await page.getByTestId("view-my-recommendations").click();
    await expect(page.getByTestId("recommendations-summary")).toContainText(
      "Lo que exploró: Campus hospitalario y Planta de gases medicinales",
    );

    await openLeadForm(page);
    await completeLead(page, { email: uniqueEmail("journey3"), role: "operations-facilities" });
    await expect(page.getByTestId("lead-result")).toHaveAttribute("data-delivery", "packaged");
  });

  test("4. invalid form → correction → successful submission", async ({ page }) => {
    await gotoKiosk(page);
    await rolePathToRecommendations(page);
    await openLeadForm(page);

    await page.getByTestId("lead-email").fill("no-es-un-correo");
    await page.getByTestId("lead-continue").click();
    const email = page.getByRole("textbox", { name: /Correo electrónico de trabajo/ });
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByTestId("lead-firstName")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByTestId("lead-step-contact")).toBeVisible();

    const valid = uniqueEmail("journey4");
    await fillContact(page, { email: valid });
    await page.getByTestId("lead-continue").click();
    // Consent is required: continuing without it shows an error and stays on the step.
    await page.getByTestId("lead-continue").click();
    await expect(page.getByTestId("consent-report")).toHaveAttribute("aria-invalid", "true");
    await page.locator("label", { has: page.getByTestId("consent-report") }).click();
    await page.getByTestId("lead-continue").click();
    await expect(page.getByTestId("review-email")).toHaveText(valid);
    await page.getByTestId("lead-submit").click();
    await expect(page.getByTestId("lead-result")).toHaveAttribute("data-delivery", "packaged");
  });

  test("5. email failure → lead stored → completion message → admin retry", async ({ page }) => {
    await gotoKiosk(page, `${FAILING_EMAIL}/`);
    await rolePathToRecommendations(page);
    await openLeadForm(page);
    const lastName = uniqueName();
    await completeLead(page, { email: uniqueEmail("journey5"), lastName });
    const result = page.getByTestId("lead-result");
    await expect(result).toHaveAttribute("data-delivery", "delayed");
    await expect(result).toContainText("Lo intentaremos de nuevo automáticamente");
    await expect(result).not.toContainText(/SMTP|ECONN|error/i);

    // The lead is stored and visible to the local admin, with a failed attempt that can be retried.
    await page.goto(`${FAILING_EMAIL}${E2E_ADMIN_PATH}`);
    await page.getByTestId("admin-passphrase").fill(E2E_ADMIN_PASSPHRASE);
    await page.getByTestId("admin-login-submit").click();
    await expect(page.getByTestId("admin-overview")).toBeVisible();
    await page.getByRole("link", { name: new RegExp(lastName) }).click();
    const status = page.getByTestId("admin-delivery-status");
    await expect(status).toHaveText("Reintentando");
    await expect(page.getByText(/intentos 1\b/)).toBeVisible();
    await expect(page.getByTestId("admin-delivery-error")).toHaveText("CONNECTION_FAILED");

    await page.getByTestId("admin-retry").click();
    await expect(page).toHaveURL(/result=retry-retrying/);
    await expect(page.getByText(/intentos 2\b/)).toBeVisible();
    await expect(status).toHaveText("Reintentando");
  });

  test("6. inactivity warning → continue keeps the session", async ({ page }) => {
    test.setTimeout(60_000);
    await gotoKiosk(page, SHORT_TIMINGS);
    await rolePathToRecommendations(page);
    const before = await primaryIds(page);

    const warning = page.getByTestId("inactivity-warning");
    await expect(warning).toBeVisible({ timeout: 20_000 });
    await warning.getByRole("button", { name: "Continuar mi sesión" }).click();
    await expect(warning).toBeHidden();
    await expect(page.getByTestId("recommendations-screen")).toBeVisible();
    expect(await primaryIds(page)).toEqual(before);
    await expect(experience(page)).toHaveAttribute("data-session-phase", "recommendation-ready");
  });

  test("7. inactivity warning → automatic reset to a fresh session", async ({ page }) => {
    test.setTimeout(60_000);
    await gotoKiosk(page, SHORT_TIMINGS);
    await rolePathToRecommendations(page);
    await expect(page.getByTestId("inactivity-warning")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("attract-screen")).toBeVisible({ timeout: 20_000 });
    await expect(experience(page)).toHaveAttribute("data-session-phase", "attracting");

    await page.getByTestId("attract-start").click();
    await page.getByTestId("path-role").click();
    await expect(page.getByTestId("persona-operations-facilities")).toHaveAttribute("aria-pressed", "false");
  });

  test("8. language change during a session keeps every choice", async ({ page }) => {
    await gotoKiosk(page);
    await rolePathToRecommendations(page);
    const ids = await primaryIds(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");

    await page.getByRole("button", { name: "English" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByTestId("send-summary")).toHaveText("Request my personalized summary");
    await expect(page.getByTestId("recommendations-summary")).toContainText("Operations and facilities");
    const english = await page
      .getByRole("list", { name: "Main recommendations" })
      .getByRole("article")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-testid")!.replace("recommendation-", "")));
    expect(english).toEqual(ids);

    await page.getByTestId("send-summary").click();
    await page.getByTestId("summary-continue").click();
    await expect(page.getByTestId("lead-step-contact")).toContainText("Work email");
    await page.getByRole("button", { name: "Español" }).click();
    await expect(page.getByTestId("lead-step-contact")).toContainText("Correo electrónico de trabajo");
  });

  test("9. a new visitor sees nothing from the previous visitor", async ({ page }) => {
    await gotoKiosk(page);
    await rolePathToRecommendations(page);
    await openLeadForm(page);
    const email = uniqueEmail("journey9");
    await completeLead(page, { email, lastName: "Anterior" });
    await page.getByTestId("lead-finish").click();
    await expect(page.getByTestId("attract-screen")).toBeVisible();

    // Browser back and forward never bring back the previous screens or data.
    await page.goBack().catch(() => undefined);
    await page.goForward().catch(() => undefined);
    await expect(experience(page)).toBeVisible();
    for (const text of [email.split("@")[0]!, "Anterior", "Hospital de Pruebas", "•••@example.test"]) {
      await expect(page.locator("body")).not.toContainText(text);
    }

    // The next visitor starts clean: no role, no recommendations, an empty form.
    await gotoKiosk(page);
    await page.getByTestId("attract-start").click();
    await page.getByTestId("path-role").click();
    await expect(page.getByTestId("persona-operations-facilities")).toHaveAttribute("aria-pressed", "false");
    await page.getByTestId("persona-operations-facilities").click();
    await page.getByTestId("persona-continue").click();
    await page.getByTestId("role-challenges-continue").click();
    await page.getByTestId("next-view-recommendations").click();
    await openLeadForm(page);
    for (const field of ["lead-firstName", "lead-lastName", "lead-organization", "lead-email"]) {
      await expect(page.getByTestId(field)).toHaveValue("");
    }
    expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  });

  test("10. production mode hides content that is not validated", async ({ page }) => {
    await gotoKiosk(page, PRODUCTION);
    await expect(page.getByTestId("demo-mode-indicator")).toHaveCount(0);
    await page.getByTestId("attract-start").click();
    await expect(page.getByTestId("welcome-unavailable")).toBeVisible();
    for (const p of ["role", "challenge", "explore"])
      await expect(page.getByTestId(`path-${p}`)).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(
      /pendiente de validación|Compras y cadena de suministro/i,
    );
    await page.getByTestId("privacy-link").click();
    await expect(page.getByTestId("privacy-notice")).toContainText("no solicita ningún dato personal");
  });
});
