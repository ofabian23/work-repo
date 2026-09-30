import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { GALLERY_PORT } from "../../playwright.config";
import { expectNoHorizontalOverflow, expectTouchTargets, gotoHydrated, gotoKiosk } from "./helpers";

type SceneJson = {
  id: string;
  parentSceneId: string | null;
  hotspots: { id: string; type: string; x: number; y: number; targetSceneId?: string }[];
};
const scenes: SceneJson[] = fs
  .readdirSync(path.join(process.cwd(), "content/scenes"))
  .map(
    (f) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "content/scenes", f), "utf8")) as SceneJson,
  );
const campus = scenes.find((s) => s.parentSceneId === null)!;

async function openExplorer(page: Page) {
  await page.getByTestId("attract-start").click();
  await page.getByTestId("path-explore").click();
  await expect(page.getByTestId("explorer-screen")).toHaveAttribute("data-scene", "campus");
  await waitForLayout(page, "campus");
}

async function waitForLayout(page: Page, sceneId: string) {
  const box = page.locator(`[data-testid="scene-art-box"][data-scene="${sceneId}"]`);
  await expect(box).toHaveAttribute("data-layout-ready", "true");
  // The incoming scene has finished its transition once the outgoing layer is gone and no finite
  // animation (zoom, pan, settle) is still running; the hotspot pulse is infinite and ignored.
  await expect(page.getByTestId("scene-layers-outgoing")).toHaveCount(0);
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((a) => a.playState !== "running" || a.effect?.getComputedTiming().iterations === Infinity),
  );
}

/** Marker geometry measured in the browser, relative to the art box. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const box = document.querySelector('[data-testid="scene-art-box"]')!.getBoundingClientRect();
    const markers = [
      ...document.querySelectorAll<HTMLElement>('[data-testid="scene-layers"] [data-hotspot-type]'),
    ].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        id: el.dataset.testid!.replace("hotspot-", ""),
        cx: ((r.left + r.width / 2 - box.left) / box.width) * 100,
        cy: ((r.top + r.height / 2 - box.top) / box.height) * 100,
        x: Number(el.dataset.x),
        y: Number(el.dataset.y),
        left: r.left - box.left,
        top: r.top - box.top,
        right: r.right - box.left,
        bottom: r.bottom - box.top,
        radius: el.firstElementChild!.getBoundingClientRect().width / 2,
        centerPx: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
      };
    });
    return { box: { width: box.width, height: box.height }, markers };
  });
}

async function expectResponsiveHotspots(page: Page, scene: SceneJson) {
  const { box, markers } = await measure(page);
  // The art box keeps the 4:5 ratio of the illustrations.
  expect(box.width / box.height).toBeCloseTo(0.8, 2);
  expect(markers.map((m) => m.id).sort()).toEqual(scene.hotspots.map((h) => h.id).sort());
  for (const m of markers) {
    const authored = scene.hotspots.find((h) => h.id === m.id)!;
    // Rendered exactly where the layout says (percent of the art box, at any viewport size)…
    expect(Math.abs(m.cx - m.x), `${m.id} x`).toBeLessThan(0.6);
    expect(Math.abs(m.cy - m.y), `${m.id} y`).toBeLessThan(0.6);
    // …which is the authored point, or close to it when markers had to be nudged apart
    // (at most one and a half marker diameters).
    const movedPx = Math.hypot(
      ((m.x - authored.x) / 100) * box.width,
      ((m.y - authored.y) / 100) * box.height,
    );
    expect(movedPx, `${m.id} moved`).toBeLessThanOrEqual(3 * m.radius);
    // Markers stay inside the illustration.
    expect(m.left).toBeGreaterThanOrEqual(-1);
    expect(m.top).toBeGreaterThanOrEqual(-1);
    expect(m.right).toBeLessThanOrEqual(box.width + 1);
    expect(m.bottom).toBeLessThanOrEqual(box.height + 1);
  }
  // No two markers overlap.
  for (let i = 0; i < markers.length; i++) {
    for (let j = i + 1; j < markers.length; j++) {
      const a = markers[i]!;
      const b = markers[j]!;
      const distance = Math.hypot(a.centerPx.x - b.centerPx.x, a.centerPx.y - b.centerPx.y);
      expect(distance, `${a.id} overlaps ${b.id}`).toBeGreaterThanOrEqual(a.radius + b.radius - 1);
    }
  }
}

test.describe("hospital explorer", () => {
  test.beforeEach(async ({ page }) => {
    await gotoKiosk(page);
  });

  test("every scene positions its hotspots by percentage, inside the art and without overlap", async ({
    page,
  }, testInfo) => {
    await openExplorer(page);
    await expectResponsiveHotspots(page, campus);
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page);
    await page.screenshot({
      path: testInfo.outputPath(`explorer-campus-${testInfo.project.name}.png`),
      animations: "disabled",
    });

    for (const nav of campus.hotspots.filter((h) => h.type === "navigation")) {
      const target = scenes.find((s) => s.id === nav.targetSceneId)!;
      await page.getByTestId(`hotspot-${nav.id}`).click();
      await waitForLayout(page, target.id);
      await expectResponsiveHotspots(page, target);
      await page.screenshot({
        path: testInfo.outputPath(`explorer-${target.id}-${testInfo.project.name}.png`),
        animations: "disabled",
      });
      await page.getByTestId("explorer-back").click();
      await waitForLayout(page, "campus");
    }
  });

  test("navigates between scenes with breadcrumbs and back", async ({ page }) => {
    await openExplorer(page);
    await page.getByTestId("hotspot-campus-to-icu").click();
    await waitForLayout(page, "icu");
    const breadcrumb = page.getByTestId("scene-breadcrumb");
    await expect(breadcrumb).toContainText("Campus hospitalario");
    await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText("Unidad de cuidado intensivo");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Unidad de cuidado intensivo");

    // Sibling navigation (ICU → operating room), then the breadcrumb back to the campus.
    await page.getByTestId("hotspot-icu-to-operating-room").click();
    await waitForLayout(page, "operating-room");
    await breadcrumb.getByRole("button", { name: "Campus hospitalario" }).click();
    await waitForLayout(page, "campus");

    // "Volver" from a scene goes up one level; from the campus it leaves the explorer.
    await page.getByTestId("hotspot-campus-to-laboratory").click();
    await waitForLayout(page, "laboratory");
    await page.getByTestId("explorer-back").click();
    await waitForLayout(page, "campus");
    await page.getByTestId("explorer-back").click();
    await expect(page.getByTestId("welcome-screen")).toBeVisible();
  });

  test("information and solution hotspots open panels; labels show on focus", async ({ page }) => {
    await openExplorer(page);
    await page.getByTestId("hotspot-campus-to-gas-plant").click();
    await waitForLayout(page, "gas-plant");

    const info = page.getByTestId("hotspot-gas-plant-perimeter");
    const label = info.getByTestId("hotspot-label");
    await expect(label).toHaveCSS("opacity", "0");
    await info.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(label).toHaveCSS("opacity", "1");

    await info.click();
    const sheet = page.getByTestId("hotspot-sheet");
    await expect(sheet.getByRole("heading", { name: "Perímetro de la planta" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(info).toBeFocused();
    await expect(info).toHaveAttribute("data-visited", "true");

    await page.getByTestId("hotspot-gas-plant-bulk-tank").click();
    await expect(sheet.getByTestId("solution-panel")).toBeVisible();
    await expect(sheet).toContainText("Contenido pendiente de validación local");
    await sheet.getByTestId("interest-bulk-centralized-supply").click();
    await expect(sheet.getByTestId("interest-bulk-centralized-supply")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("“Ver mis recomendaciones” appears once the threshold is met and explains the results", async ({
    page,
  }) => {
    await openExplorer(page);
    const progress = page.getByTestId("explorer-progress");
    await expect(progress).toHaveText("Abra 3 puntos más para ver sus recomendaciones.");
    await expect(page.getByTestId("view-my-recommendations")).toHaveCount(0);

    await page.getByTestId("hotspot-campus-expansion").click();
    await page.keyboard.press("Escape");
    await expect(progress).toHaveText("Abra 2 puntos más para ver sus recomendaciones.");
    await page.getByTestId("hotspot-campus-to-emergency").click();
    await waitForLayout(page, "emergency");
    await page.getByTestId("hotspot-emergency-critical-gases").click();
    await page.keyboard.press("Escape");

    await expect(progress).toHaveText("Ya puede ver sus recomendaciones.");
    await page.getByTestId("view-my-recommendations").click();
    const first = page.getByTestId("recommendations-screen").getByRole("article").first();
    await expect(first.getByRole("region", { name: "Por qué aparece" })).toContainText("abrió «");
    await page.getByTestId("recommendations-back").click();
    await expect(page.getByTestId("explorer-screen")).toHaveAttribute("data-scene", "emergency");
  });

  test("scene changes animate, and switch instantly with reduced motion", async ({ page }) => {
    await openExplorer(page);
    await page.getByTestId("hotspot-campus-to-icu").click();
    await expect(page.getByTestId("scene-layers-outgoing")).toHaveCount(1);
    await waitForLayout(page, "icu");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByTestId("explorer-back").click();
    await expect(page.getByTestId("explorer-screen")).toHaveAttribute("data-scene", "campus");
    await expect(page.getByTestId("scene-layers-outgoing")).toHaveCount(0);
    await expect(page.getByTestId("hotspot-campus-to-laboratory").getByTestId("hotspot-pulse")).toHaveCSS(
      "animation-name",
      "none",
    );
  });
});

test.describe("scene calibration (developer tool)", () => {
  test("is not available in a default production build", async ({ page }) => {
    const response = await page.goto("/dev/scenes");
    expect(response?.status()).toBe(404);
  });

  test("reports normalized coordinates and copies them when enabled", async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name !== "laptop", "one viewport is enough for the developer tool");
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: `http://localhost:${GALLERY_PORT}`,
    });
    const response = await gotoHydrated(page, `http://localhost:${GALLERY_PORT}/dev/scenes`);
    expect(response?.status()).toBe(200);
    await expect(page.getByTestId("scene-calibrator")).toHaveAttribute("data-ready", "true");
    await page.getByTestId("calibrate-scene-icu").click();

    const overlay = page.getByTestId("calibration-overlay");
    const box = (await overlay.boundingBox())!;
    await overlay.click({ position: { x: box.width * 0.25, y: box.height * 0.4 } });
    await expect(page.getByTestId("calibration-readout")).toHaveText(
      /^x: 2[45](\.\d)? · y: (39\.\d|40(\.\d)?)$/,
    );
    await expect(page.getByTestId("calibration-marker")).toBeVisible();

    await page.getByTestId("calibration-copy").click();
    await expect(page.getByTestId("calibration-copy-status")).toHaveText("Copied");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(await page.getByTestId("calibration-snippet").inputValue());
    expect(copied).toMatch(/^"x": [\d.]+, "y": [\d.]+$/);
  });
});
