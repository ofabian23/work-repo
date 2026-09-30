import { expect, type Page } from "@playwright/test";

/**
 * Every visible interactive element must be at least 48 × 48 CSS px (PROJECT_BRIEF AC-08).
 * Visually hidden native inputs (sr-only) are measured by their label, which is the real tap target.
 */
export async function expectTouchTargets(page: Page) {
  const small = await page.$$eval("button, a[href], [role='button'], input, select", (els) =>
    els
      .map((el) => {
        const target = el.classList.contains("sr-only") ? (el.closest("label") ?? el) : el;
        const style = getComputedStyle(target);
        if (
          style.visibility === "hidden" ||
          style.display === "none" ||
          (target as HTMLElement).offsetParent === null
        ) {
          return null;
        }
        const r = target.getBoundingClientRect();
        return {
          text: (target.textContent ?? "").trim().slice(0, 40),
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      })
      .filter((r): r is { text: string; w: number; h: number } => r !== null && (r.w < 48 || r.h < 48)),
  );
  expect(small, `targets smaller than 48px: ${JSON.stringify(small)}`).toEqual([]);
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** Navigates and waits until React has hydrated (see LanguageProvider), so interactions are not lost. */
export async function gotoHydrated(page: Page, url: string) {
  const response = await page.goto(url);
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  return response;
}

/** Opens the kiosk route and waits until the experience (inside the root Suspense boundary) is interactive. */
export async function gotoKiosk(page: Page) {
  await gotoHydrated(page, "/");
  await expect(page.locator('[data-testid="kiosk-experience"][data-ready="true"]')).toBeVisible();
}
