/**
 * The art box that hotspot percentages refer to. Every scene layer (background and foregrounds) is drawn
 * on this canvas, so `x`/`y` in 0–100 map to the same point on any screen size (ADR-049).
 */
export const SCENE_ART = { width: 1200, height: 1500 } as const;

/** Width ÷ height of the art box (4:5, portrait-friendly). */
export const SCENE_ART_RATIO = SCENE_ART.width / SCENE_ART.height;
