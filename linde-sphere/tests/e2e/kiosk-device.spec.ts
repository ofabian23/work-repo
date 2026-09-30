import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN_PASSPHRASE, E2E_ADMIN_PATH, GALLERY_PORT } from "../../playwright.config";
import { expectNoHorizontalOverflow, gotoKiosk } from "./helpers";

/**
 * Kiosk-device behavior (ADR-058): zoom stays available but gestures cannot break the scene, images cannot
 * be dragged, decorative controls are not selectable while form text is, rotation keeps the visitor's state,
 * and the first screen stays within its performance budget.
 */
const style = (page: Page, testId: string, prop: string) =>
  page.getByTestId(testId).evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

async function expectSceneFits(page: Page) {
  const box = page.getByTestId("scene-art-box");
  await expect(box).toHaveAttribute("data-layout-ready", "true");
  const r = (await box.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(r.width).toBeGreaterThan(100);
  expect(r.width / r.height).toBeCloseTo(1200 / 1500, 2);
  expect(r.x).toBeGreaterThanOrEqual(0);
  expect(r.x + r.width).toBeLessThanOrEqual(viewport.width + 1);
  // Every marker stays inside the art box (percent positions recomputed for the new size).
  const outside = await page.$$eval('[data-testid^="hotspot-"][data-testid*="-to-"]', (els) => {
    const art = document.querySelector('[data-testid="scene-art-box"]')!.getBoundingClientRect();
    return els
      .map((el) => el.getBoundingClientRect())
      .filter((m) => m.width > 0)
      .filter((m) => {
        const cx = m.x + m.width / 2;
        const cy = m.y + m.height / 2;
        return cx < art.left || cx > art.right || cy < art.top || cy > art.bottom;
      }).length;
  });
  expect(outside).toBe(0);
  await expectNoHorizontalOverflow(page);
}

test.describe("zoom, gestures, dragging and selection", () => {
  test("browser zoom is allowed; pinch and double-tap zoom are suppressed where they break the layout", async ({
    page,
  }) => {
    await gotoKiosk(page);
    const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(viewport).toContain("width=device-width");
    expect(viewport).not.toMatch(/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\D|$)/);
    expect(await page.evaluate(() => getComputedStyle(document.body).touchAction)).toBe("manipulation");

    await page.getByTestId("attract-start").click();
    await page.getByTestId("path-explore").click();
    expect(await style(page, "scene-art-box", "touch-action")).toBe("pan-x pan-y");
    const images = page.getByTestId("scene-art-box").locator("img");
    expect(await images.count()).toBeGreaterThan(0);
    for (const img of await images.all()) {
      await expect(img).toHaveAttribute("draggable", "false");
      expect(await img.evaluate((el) => getComputedStyle(el).getPropertyValue("-webkit-user-drag"))).toBe(
        "none",
      );
      // Intrinsic size set, so the browser reserves the box before the file arrives.
      await expect(img).toHaveAttribute("width", "1200");
      await expect(img).toHaveAttribute("height", "1500");
    }
    await expect(images.first()).toHaveAttribute("fetchpriority", "high");
  });

  test("decorative controls are not selectable; form fields and the visitor's own entries are", async ({
    page,
  }) => {
    await gotoKiosk(page);
    expect(await style(page, "attract-start", "user-select")).toBe("none");
    await page.getByTestId("attract-start").click();
    await page.getByTestId("path-role").click();
    await page.getByTestId("persona-executive").click();
    await page.getByTestId("persona-continue").click();
    await page.getByTestId("role-challenges-continue").click();
    await page.getByTestId("next-view-recommendations").click();
    await page.getByTestId("send-summary").click();
    await page.getByTestId("summary-continue").click();
    expect(await style(page, "lead-email", "user-select")).toBe("text");
    await page.getByTestId("lead-firstName").fill("Ana");
    await page.getByTestId("lead-lastName").fill("López");
    await page.getByTestId("lead-organization").fill("Clínica Norte (ficticia)");
    await page.getByTestId("lead-email").fill("seleccion@example.test");
    await page.getByTestId("lead-continue").click();
    await page.locator("label", { has: page.getByTestId("consent-report") }).click();
    await page.getByTestId("lead-continue").click();
    expect(await style(page, "review-email", "user-select")).toBe("text");

    // Long-press / right-click menu: blocked on kiosk controls, kept in form fields and selectable text.
    const menuAllowed = (testId: string) =>
      page
        .getByTestId(testId)
        .evaluate((el) =>
          el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })),
        );
    expect(await menuAllowed("lead-submit")).toBe(false);
    expect(await menuAllowed("review-email")).toBe(true);
  });

  test("the admin utility behaves like a normal desktop page (text selectable)", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "admin is used on the laptop");
    await page.goto(`http://localhost:${GALLERY_PORT}${E2E_ADMIN_PATH}`);
    await page.getByTestId("admin-passphrase").fill(E2E_ADMIN_PASSPHRASE);
    await page.getByTestId("admin-login-submit").click();
    await expect(page.getByTestId("admin-overview")).toBeVisible();
    expect(await style(page, "admin-result-count", "user-select")).toBe("auto");
  });
});

test.describe("orientation changes", () => {
  test("rotating mid-journey keeps the screen, scene, open sheet and choices; the scene re-fits", async ({
    page,
  }) => {
    await gotoKiosk(page);
    const portrait = page.viewportSize()!;
    const landscape = { width: portrait.height, height: portrait.width };
    const experience = page.getByTestId("kiosk-experience");

    await page.getByTestId("attract-start").click();
    await page.getByTestId("path-role").click();
    await page.getByTestId("persona-procurement-supply").click();
    await page.getByTestId("persona-continue").click();
    await page.getByTestId("role-challenges-continue").click();
    await page.getByTestId("next-explore-areas").click();
    await expect(page.getByTestId("explorer-screen")).toHaveAttribute("data-scene", "campus");
    await page.getByTestId("hotspot-campus-to-gas-plant").click();
    await expect(page.getByTestId("explorer-screen")).toHaveAttribute("data-scene", "gas-plant");
    await expectSceneFits(page);

    await page.setViewportSize(landscape);
    await expect(experience).toHaveAttribute("data-screen", "explore");
    await expect(page.getByTestId("explorer-screen")).toHaveAttribute("data-scene", "gas-plant");
    await expectSceneFits(page);

    // A sheet opened in landscape survives rotating back.
    await page.getByTestId("hotspot-gas-plant-bulk-tank").click();
    await expect(page.getByTestId("hotspot-sheet")).toBeVisible();
    await page.setViewportSize(portrait);
    await expect(page.getByTestId("hotspot-sheet")).toBeVisible();
    await page.keyboard.press("Escape");
    await expectSceneFits(page);

    // The role chosen before rotating still drives the recommendations.
    await page.getByTestId("view-my-recommendations").click();
    await expect(experience).toHaveAttribute("data-screen", "recommendations");
    await expect(page.getByText("Compras y cadena de suministro").first()).toBeVisible();
  });
});

test.describe("performance budget", () => {
  test.skip(({ isMobile }) => isMobile, "measured once on the kiosk and laptop profiles");

  test("the first screen's JavaScript stays small and excludes the validation library", () => {
    // The build's own list of scripts the kiosk route needs before it can render (lazy chunks excluded).
    const manifestFile = path.join(".next", "server", "app", "(kiosk)", "page_client-reference-manifest.js");
    const manifest = fs.readFileSync(manifestFile, "utf8");
    const jsEntries = manifest.slice(manifest.indexOf('"entryJSFiles"'));
    const entry = /"\[project\]\/src\/app\/\(kiosk\)\/page":\[([^\]]*)\]/.exec(jsEntries);
    expect(entry, "kiosk page entry in the client manifest").not.toBeNull();
    const appFiles = [...entry![1]!.matchAll(/"([^"]+\.js)"/g)].map((m) => m[1]!);
    expect(appFiles.length).toBeGreaterThan(0);
    // Plus the framework runtime (React, Next). Polyfills are `nomodule` and never loaded by Chrome.
    const buildManifest = JSON.parse(fs.readFileSync(path.join(".next", "build-manifest.json"), "utf8")) as {
      rootMainFiles: string[];
    };
    const files = [...new Set([...buildManifest.rootMainFiles, ...appFiles])].map((f) =>
      path.join(".next", f),
    );
    let gzipped = 0;
    let raw = 0;
    for (const file of files) {
      const code = fs.readFileSync(file);
      raw += code.length;
      gzipped += zlib.gzipSync(code).length;
      // zod belongs to the lazily loaded lead form (ADR-058), never to the first screen.
      expect(code.includes("ZodError"), `${file} must not contain zod`).toBe(false);
    }
    test
      .info()
      .annotations.push({ type: "perf", description: JSON.stringify({ files: files.length, raw, gzipped }) });
    expect(gzipped).toBeLessThan(250 * 1024);
    expect(raw).toBeLessThan(800 * 1024);
  });

  test("the first screen loads quickly with no third-party requests", async ({ page }) => {
    const started = Date.now();
    await gotoKiosk(page);
    const readyMs = Date.now() - started;
    const metrics = await page.evaluate(() => {
      const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      return {
        htmlTransfer: nav.transferSize,
        htmlDecoded: nav.decodedBodySize,
        external: resources.filter((r) => new URL(r.name).origin !== location.origin).length,
      };
    });
    test.info().annotations.push({ type: "perf", description: JSON.stringify({ readyMs, ...metrics }) });
    // Budgets for a local production server (ARCHITECTURE §18).
    expect(metrics.external).toBe(0);
    expect(metrics.htmlDecoded).toBeLessThan(400 * 1024);
    expect(readyMs).toBeLessThan(8_000);
  });

  test("the lead form's code is prefetched while idle, so opening it shows no loading state", async ({
    page,
  }) => {
    await gotoKiosk(page);
    // The idle prefetch shows up as a script requested after the page finished loading.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
          return (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).some(
            (r) =>
              r.name.includes("/_next/static/chunks/") &&
              r.startTime >= nav.loadEventEnd &&
              r.responseEnd > 0,
          );
        }),
      )
      .toBe(true);
    await page.waitForLoadState("networkidle");
    // From here on no more code can be downloaded: the form must already be in the browser.
    await page.route("**/_next/static/chunks/**", (route) => route.abort());
    await page.getByTestId("attract-start").click();
    await page.getByTestId("path-role").click();
    await page.getByTestId("persona-executive").click();
    await page.getByTestId("persona-continue").click();
    await page.getByTestId("role-challenges-continue").click();
    await page.getByTestId("next-view-recommendations").click();
    await page.getByTestId("send-summary").click();
    await page.getByTestId("summary-continue").click();
    await expect(page.getByTestId("lead-firstName")).toBeVisible();
  });
});
