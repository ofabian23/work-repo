/**
 * The art box that hotspot percentages refer to. Every scene layer (background and foregrounds) is drawn
 * on this canvas, so `x`/`y` in 0–100 map to the same point on any screen size (ADR-049).
 *
 * Sized to the approved scene illustrations (ADR-063): 1536 × 2752 originals, a tall portrait ratio of
 * about 9:16 that fills the kiosk's portrait screen. `npm run content:check` refuses scene art whose real
 * proportions differ from this box, because the hotspots would no longer sit on their features.
 */
export const SCENE_ART = { width: 1536, height: 2752 } as const;

/** Width ÷ height of the art box (≈ 0.558, portrait). */
export const SCENE_ART_RATIO = SCENE_ART.width / SCENE_ART.height;

/** Largest accepted difference between an image's proportions and the art box (1 %). */
export const SCENE_ART_RATIO_TOLERANCE = 0.01;

/**
 * `sizes` for responsive scene images: the art box is at most the screen width minus the gutters, and in
 * practice limited by the height left under the header (about 42 % of the viewport height × the ratio).
 * The browser picks the smallest `srcset` candidate that covers this width at the device's pixel density.
 */
export const SCENE_ART_SIZES = "min(92vw, 42vh)";

/** Widths generated for each approved scene image by `npm run art:scenes` (never above the original). */
export const SCENE_ART_WIDTHS = [640, 960, 1280, 1536] as const;
