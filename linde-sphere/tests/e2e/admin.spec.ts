import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN_PASSPHRASE, E2E_ADMIN_PATH, GALLERY_PORT } from "../../playwright.config";
import { expectNoHorizontalOverflow } from "./helpers";

/**
 * Local administration utility (ADR-056). The main server has admin disabled; the second server enables
 * it at a custom path with a dummy passphrase.
 */
const ADMIN = `http://localhost:${GALLERY_PORT}${E2E_ADMIN_PATH}`;
const ADMIN_ORIGIN = `http://localhost:${GALLERY_PORT}`;

/** Letters only (names accept letters), unique per test run so parallel workers never share a lead. */
const uniqueName = () =>
  `Prueba${randomUUID()
    .replace(/[^a-f]/g, "")
    .slice(0, 8)}`;

async function createLead(page: Page, organization: string, lastName: string) {
  const email = `admin.${randomUUID().slice(0, 8)}@example.test`;
  const response = await page.request.post(`${ADMIN_ORIGIN}/api/leads`, {
    headers: { origin: ADMIN_ORIGIN },
    data: {
      sessionId: randomUUID(),
      sessionStartedAt: new Date(Date.now() - 60_000).toISOString(),
      idempotencyKey: randomUUID(),
      firstName: "Admin",
      lastName,
      organization,
      jobFunctionId: "procurement-supply",
      email,
      phone: "+1 787 555 0100",
      preferredLanguage: "es",
      selectedInterestIds: ["supply-continuity"],
      consents: { reportDelivery: true, salesFollowUp: true },
      consentVersion: "0.1.0",
      signals: {
        personaId: "procurement-supply",
        challengeIds: ["supply-continuity"],
        facilityTypeId: null,
        visitedSceneIds: ["campus"],
        openedHotspotIds: [],
        engagedHotspotIds: [],
        explicitInterestIds: [],
      },
      submittedAt: new Date().toISOString(),
    },
  });
  expect(response.status()).toBe(201);
  return email;
}

async function signIn(page: Page, passphrase = E2E_ADMIN_PASSPHRASE) {
  await page.goto(ADMIN);
  await expect(page).toHaveURL(`${ADMIN}/login`);
  await page.getByTestId("admin-passphrase").fill(passphrase);
  await page.getByTestId("admin-login-submit").click();
}

test.describe("admin security boundary", () => {
  test("is off on the kiosk server, hidden from visitors, and never serves raw data files", async ({
    page,
    request,
  }) => {
    for (const path of [
      "/admin-local",
      E2E_ADMIN_PATH,
      "/admin-console",
      "/admin-console/api/export",
      "/data/e2e.db",
      "/data/linde-sphere.db",
    ]) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
    await page.goto("/");
    const hrefs = await page.locator("a[href]").evaluateAll((els) => els.map((a) => a.getAttribute("href")));
    expect(hrefs.filter((h) => /admin|gestion/.test(h ?? ""))).toEqual([]);
    expect(await page.content()).not.toMatch(/admin-console|gestion-local|admin-local/);
  });

  test("the internal segment is never served directly, even when admin is enabled", async ({ request }) => {
    expect((await request.get(`${ADMIN_ORIGIN}/admin-console`)).status()).toBe(404);
    expect((await request.get(`${ADMIN_ORIGIN}/admin-console/login`)).status()).toBe(404);
    const login = await request.get(`${ADMIN}/login`);
    expect(login.status()).toBe(200);
    expect(login.headers()["cache-control"]).toContain("no-store");
    expect(login.headers()["x-robots-tag"]).toContain("noindex");
  });

  test("requires the passphrase; unauthenticated pages redirect and actions are refused", async ({
    page,
    request,
  }) => {
    for (const path of ["", "/exports", "/content", "/leads/anything"]) {
      await page.goto(`${ADMIN}${path}`);
      await expect(page).toHaveURL(`${ADMIN}/login`);
    }
    const unauthenticated = await request.post(`${ADMIN}/api/export`, {
      form: { kind: "leads", confirm: "yes" },
      headers: { origin: ADMIN_ORIGIN },
      maxRedirects: 0,
    });
    expect(unauthenticated.status()).toBe(303);
    expect(unauthenticated.headers()["content-disposition"]).toBeUndefined();

    await signIn(page, "frase equivocada de acceso");
    await expect(page.getByText("La frase de acceso no es correcta.")).toBeVisible();
    // A successful sign-in resets the failure counter (parallel workers share one server).
    await page.getByTestId("admin-passphrase").fill(E2E_ADMIN_PASSPHRASE);
    await page.getByTestId("admin-login-submit").click();
    await expect(page).toHaveURL(ADMIN);
  });
});

test.describe("admin features", () => {
  test.describe.configure({ mode: "serial" });

  test("admin pages fit the screen without horizontal scrolling (browser zoom stays usable)", async ({
    page,
  }) => {
    await signIn(page);
    await expect(page).toHaveURL(ADMIN);
    for (const suffix of ["", "/exports", "/sales", "/content"]) {
      await page.goto(`${ADMIN}${suffix}`);
      await expectNoHorizontalOverflow(page);
    }
    // A lead detail page (its interests table scrolls inside its own region).
    await createLead(page, "Hospital de Pruebas (ficticio)", uniqueName());
    await page.goto(ADMIN);
    await page.getByTestId("admin-leads").getByRole("link").first().click();
    await expect(page).toHaveURL(/\/leads\//);
    await expectNoHorizontalOverflow(page);
  });

  test("sales validation: every item with its review fields, filters, and a confirmed CSV download", async ({
    page,
  }) => {
    await signIn(page);
    await expect(page).toHaveURL(ADMIN);
    await page.getByRole("link", { name: "Validación de ventas" }).click();
    await expect(page).toHaveURL(`${ADMIN}/sales`);
    await expect(page.getByTestId("sales-total").locator("span").last()).toHaveText("37");
    await expect(page.getByTestId("sales-ready").locator("span").last()).toHaveText("0");
    await expect(page.getByTestId("sales-item")).toHaveCount(37);
    const first = page.getByTestId("sales-item").first();
    for (const label of [
      "Nombre en español",
      "Nombre en inglés",
      "Descripción actual",
      "Estado de mercado",
      "Estado de validación",
      "Roles previstos",
      "Retos previstos",
      "Áreas de salud previstas",
      "Prioridad de recomendación",
      "Disponible en Puerto Rico",
      "Mantener / eliminar / renombrar",
      "Corrección requerida",
      "Material digital faltante",
      "Responsable de ventas",
    ]) {
      await expect(first.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(first.getByTestId("sales-approval")).toContainText("no se muestra en producción");

    await page.getByTestId("sales-filter-type").selectOption("solution");
    await page.getByTestId("sales-filter-approval").selectOption("not-started");
    await page.getByTestId("sales-filter-apply").click();
    await expect(page).toHaveURL(`${ADMIN}/sales?type=solution&approval=not-started`);
    await expect(page.getByTestId("sales-item")).toHaveCount(11);
    await expect(page.locator('[data-testid="sales-item"]:not([data-record-type="solution"])')).toHaveCount(
      0,
    );

    // Unconfirmed: back to the page with an error; confirmed: the worksheet downloads.
    await page.getByTestId("sales-export-submit").click();
    await expect(page).toHaveURL(`${ADMIN}/sales?error=confirm`);
    await expect(page.getByRole("alert").filter({ hasText: "Confirme la descarga" })).toBeVisible();
    await page.getByTestId("sales-export-confirm").check();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("sales-export-submit").click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^linde-sphere-sales-validation-.*\.csv$/);
    const csv = readFileSync((await download.path())!, "utf8");
    expect(csv).toContain("record_type,id,current_name,spanish_name,english_name,current_description");
    expect(csv.trim().split("\r\n")).toHaveLength(38);
  });

  test("overview, filters, lead detail, mark exported, confirmed exports and backup", async ({ page }) => {
    const lastName = uniqueName();
    const email = await createLead(page, "+Hospital de Pruebas (ficticio)", lastName);
    await signIn(page);
    await expect(page).toHaveURL(ADMIN);
    const cookies = await page.context().cookies();
    const session = cookies.find((c) => c.name === "ls_admin_session");
    expect(session).toMatchObject({ httpOnly: true, sameSite: "Strict", path: E2E_ADMIN_PATH });

    expect(Number(await page.getByTestId("stat-total").locator("span").last().textContent())).toBeGreaterThan(
      0,
    );
    await page.getByTestId("filter-delivery").selectOption("failed");
    await page.getByTestId("filter-apply").click();
    await expect(page).toHaveURL(/delivery=failed/);
    expect(page.url()).not.toMatch(/@|example\.test/);
    await page.goto(`${ADMIN}?exported=no`);

    await page.getByRole("link", { name: `Admin ${lastName}` }).click();
    await expect(page.getByTestId("admin-lead-contact")).toBeVisible();
    expect(page.url()).not.toContain(email);
    await expect(page.getByTestId("admin-lead-email")).toHaveText(email);
    await expect(page.getByTestId("admin-lead-interests")).toContainText("supply-continuity");
    await expect(page.getByTestId("admin-lead-delivery")).toBeVisible();
    await page.getByTestId("admin-mark-exported").click();
    await expect(page.getByText("El lead quedó marcado como exportado.")).toBeVisible();

    await page.goto(`${ADMIN}/exports`);
    await expect(page.getByTestId("export-leads-confirm")).toHaveAttribute("required", "");
    await page.getByTestId("export-leads-confirm").check();
    const [leadsCsv] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("export-leads-submit").click(),
    ]);
    expect(leadsCsv.suggestedFilename()).toMatch(/^linde-sphere-leads-.*\.csv$/);
    const csv = readFileSync((await leadsCsv.path())!, "utf8");
    expect(csv).toContain("lead_id,created_at,first_name");
    expect(csv).toContain(email);
    expect(csv).toContain("'+Hospital de Pruebas (ficticio)"); // formula-safe

    await page.getByTestId("export-content-confirm").check();
    const [contentCsv] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("export-content-submit").click(),
    ]);
    expect(readFileSync((await contentCsv.path())!, "utf8")).toContain("record_type,id,parent_id");

    await page.getByTestId("backup-confirm").check();
    const [backup] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("backup-submit").click(),
    ]);
    expect(
      readFileSync((await backup.path())!)
        .subarray(0, 15)
        .toString("latin1"),
    ).toBe("SQLite format 3");

    await page.goto(`${ADMIN}/content`);
    expect(await page.getByTestId("admin-pending-row").count()).toBeGreaterThan(0);

    await page.goto(ADMIN);
    await page.getByTestId("admin-logout").click();
    await expect(page).toHaveURL(`${ADMIN}/login`);
    await page.goto(ADMIN);
    await expect(page).toHaveURL(`${ADMIN}/login`);
  });
});
