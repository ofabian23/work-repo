/**
 * Persona illustrations on the role selection screen (ADR-064): 2:3 portraits (400 × 600 originals).
 * `npm run content:check` refuses illustrations with other proportions. Zod-free: the kiosk reads these.
 */
export const PERSONA_ART = { width: 400, height: 600 } as const;

export const PERSONA_ART_RATIO = PERSONA_ART.width / PERSONA_ART.height;

/** Widths written by `npm run art:personas` (the card shows the portrait about 50–75 CSS px wide). */
export const PERSONA_ART_WIDTHS = [160, 320] as const;

/**
 * `sizes` for the portrait. It is 3.5 rem wide (≈ 80 px on the kiosk, 56 px on a phone), and `sizes`
 * cannot use the page's rem, so this is a safe upper bound: the 160 px file at 1× density, 320 px above.
 */
export const PERSONA_ART_SIZES = "90px";
