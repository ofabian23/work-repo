import { expect, test, type Page } from "@playwright/test";
import { E2E_ORIGIN } from "../../playwright.config";
import { gotoKiosk } from "./helpers";

/** Security headers, privacy and graceful behavior against the production build (ADR-057). */

async function toReview(page: Page, email: string) {
  await page.getByTestId("attract-start").click();
  await page.getByTestId("path-role").click();
  await page.getByTestId("persona-procurement-supply").click();
  await page.getByTestId("persona-continue").click();
  await page.getByTestId("role-challenges-continue").click();
  await page.getByTestId("next-view-recommendations").click();
  await page.getByTestId("send-summary").click();
  await page.getByTestId("summary-continue").click();
  await page.getByTestId("lead-firstName").fill("Resiliencia");
  await page.getByTestId("lead-lastName").fill("Prueba");
  await page.getByTestId("lead-organization").fill("Hospital de Pruebas (ficticio)");
  await page.getByTestId("lead-email").fill(email);
  await page.getByTestId("lead-continue").click();
  await page.locator("label", { has: page.getByTestId("consent-report") }).click();
  await page.getByTestId("lead-continue").click();
  await expect(page.getByTestId("lead-step-review")).toBeVisible();
}

const uniqueEmail = () => `res.${Math.random().toString(36).slice(2, 8)}@example.test`;
const storageSize = (page: Page) =>
  page.evaluate(() => localStorage.length + sessionStorage.length + document.cookie.length);

test.describe("security and privacy in the browser", () => {
  test("strict headers, no CSP violations, same-origin traffic only, nothing stored in the browser", async ({
    page,
  }) => {
    const response = await page.goto("/");
    const headers = response!.headers();
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin");

    const violations: string[] = [];
    page.on("console", (m) => {
      if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
    });
    const foreign: string[] = [];
    page.on("request", (r) => {
      if (!r.url().startsWith(E2E_ORIGIN) && !r.url().startsWith("data:")) foreign.push(r.url());
    });

    await gotoKiosk(page);
    await toReview(page, uniqueEmail());
    expect(await storageSize(page)).toBe(0); // contact data typed, nothing persisted in the browser
    await page.getByTestId("lead-submit").click();
    await expect(page.getByTestId("lead-result")).toBeVisible();
    await page.getByTestId("lead-finish").click();
    await expect(page.getByTestId("attract-screen")).toBeVisible();

    expect(await storageSize(page)).toBe(0);
    expect(foreign).toEqual([]);
    expect(violations).toEqual([]);
  });

  test("scene art is served with a sandboxing policy", async ({ request }) => {
    const res = await request.get("/assets/scenes/placeholder/campus-background.svg");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-security-policy"]).toContain("sandbox");
  });

  test("unknown host names are refused (DNS rebinding)", async ({ request }) => {
    const res = await request.get("/", { headers: { host: "attacker.example" } });
    expect(res.status()).toBe(421);
  });

  test("error responses never contain stack traces or internals", async ({ request }) => {
    const bad = await request.post("/api/leads", {
      headers: { "content-type": "application/json", origin: E2E_ORIGIN },
      data: Buffer.from("{not json"), // a Buffer is sent as-is (a string would be JSON-encoded)
    });
    expect(bad.status()).toBe(400);
    const cross = await request.post("/api/leads", { headers: { origin: "http://evil.test" }, data: {} });
    expect(cross.status()).toBe(403);
    const missing = await request.get("/does-not-exist");
    expect(missing.status()).toBe(404);
    for (const body of [await bad.text(), await cross.text(), await missing.text()]) {
      expect(body).not.toMatch(/\n\s+at |node_modules|\.tsx?:\d+|Error: /);
    }
  });
});

test.describe("graceful behavior", () => {
  test("a network drop keeps the details; after reconnecting the same request succeeds", async ({
    page,
    context,
  }) => {
    await gotoKiosk(page);
    const email = uniqueEmail();
    await toReview(page, email);
    await context.setOffline(true);
    await page.getByTestId("lead-submit").click();
    await expect(page.getByTestId("lead-failure")).toContainText("Sus datos siguen aquí");
    await expect(page.getByTestId("review-email")).toHaveText(email);

    await context.setOffline(false);
    await page.getByTestId("lead-submit").click();
    await expect(page.getByTestId("lead-result")).toBeVisible();
  });

  test("a browser refresh starts a clean visit, with no previous choices or contact data", async ({
    page,
  }) => {
    await gotoKiosk(page);
    const email = uniqueEmail();
    await toReview(page, email);
    await page.reload();
    await expect(page.locator('[data-testid="kiosk-experience"][data-ready="true"]')).toBeVisible();
    await expect(page.getByTestId("attract-screen")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(email);
    await expect(page.locator("body")).not.toContainText("Resiliencia");
    await page.getByTestId("attract-start").click();
    await expect(page.getByTestId("kiosk-experience")).toHaveAttribute("data-screen", "welcome");
  });
});
