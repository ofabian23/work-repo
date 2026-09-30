import { expectNoHorizontalOverflow, expectTouchTargets, gotoKiosk } from "./helpers";
import { expect, test } from "@playwright/test";

test.describe("foundation shell", () => {
  test("opens on the attract screen in Spanish with visible product naming", async ({ page }, testInfo) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.getByRole("banner")).toContainText("Linde Sphere");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Linde Sphere");
    await expect(page.getByTestId("attract-screen")).toContainText("Toque para comenzar");
    await expect(page.getByTestId("demo-mode-indicator")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page);
    await page.screenshot({
      path: testInfo.outputPath(`attract-es-${testInfo.project.name}.png`),
      animations: "disabled",
    });
  });

  test("a new page load starts in Spanish again (no persisted language)", async ({ page }) => {
    await gotoKiosk(page);
    await page.getByTestId("language-en").click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    const storage = await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
      cookie: document.cookie,
    }));
    expect(storage).toEqual({ local: 0, session: 0, cookie: "" });
  });

  test("unknown routes show the localized not-found screen", async ({ page }) => {
    const response = await page.goto("/pagina-inexistente");
    expect(response?.status()).toBe(404);
    await expect(page.getByTestId("not-found-screen")).toContainText("Página no encontrada");
    await expectTouchTargets(page);
    await page.getByRole("button", { name: "Volver al inicio" }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("attract-screen")).toBeVisible();
  });
});

test.describe("portrait kiosk composition", () => {
  test("attract and welcome fit the 1080 × 1920 screen without scrolling", async ({ page }) => {
    test.skip(test.info().project.name !== "kiosk-portrait", "kiosk viewport only");
    await gotoKiosk(page);
    const overflowY = () => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    expect(await overflowY()).toBeLessThanOrEqual(0);
    expect(await page.locator("main").evaluate((el) => el.getBoundingClientRect().width)).toBe(1080);
    await page.getByTestId("attract-start").click();
    await expect(page.getByTestId("welcome-screen")).toBeVisible();
    expect(await overflowY()).toBeLessThanOrEqual(0);
  });
});

test.describe("health route", () => {
  test("reports readiness without secrets or caching", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toBe("no-store");
    const body = await response.json();
    expect(body).toMatchObject({
      app: { name: "Linde Sphere", contentMode: "demo" },
      configuration: { status: "valid", invalidVariables: [] },
      content: { status: "valid" },
      database: { engine: "sqlite" },
    });
    expect(["ok", "degraded"]).toContain(body.status);
    expect(JSON.stringify(body)).not.toMatch(/PASS|SECRET|file:|\/home\/|C:\\/i);
  });
});
