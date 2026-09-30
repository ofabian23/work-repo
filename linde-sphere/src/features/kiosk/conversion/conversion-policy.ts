/**
 * When the contextual conversion prompt ("We found opportunities relevant to your priorities") may appear
 * (ADR-050). Pure and time-injected so every rule is unit-tested; the hook only gathers the inputs.
 */

export type ConversionPromptConfig = {
  minIntervalMs: number;
  afterSceneChangeMs: number;
  afterInterruptionMs: number;
  visibleMs: number;
};

export type ConversionPromptContext = {
  now: number;
  /** RecommendationReadiness says recommendations are ready. */
  ready: boolean;
  /** The current screen allows the prompt (e.g. the explorer; never forms or results). */
  screenAllowed: boolean;
  /** Any dialog (hotspot panel, privacy, accessibility, reset, inactivity) is open. */
  modalOpen: boolean;
  /** A form field has focus. */
  dataEntry: boolean;
  lastSceneChangeAt: number | null;
  /** When the last dialog closed or form field lost focus. */
  lastInterruptionEndAt: number | null;
  lastShownAt: number | null;
};

export type ConversionPromptBlock =
  "not-ready" | "screen" | "modal-open" | "data-entry" | "scene-transition" | "just-interrupted" | "interval";

export type ConversionPromptDecision =
  | { show: true }
  /** `retryAt`: when a time-based block ends (null when it waits for a state change instead). */
  | { show: false; reason: ConversionPromptBlock; retryAt: number | null };

export function conversionPromptDecision(
  ctx: ConversionPromptContext,
  config: ConversionPromptConfig,
): ConversionPromptDecision {
  if (!ctx.ready) return { show: false, reason: "not-ready", retryAt: null };
  if (!ctx.screenAllowed) return { show: false, reason: "screen", retryAt: null };
  if (ctx.modalOpen) return { show: false, reason: "modal-open", retryAt: null };
  if (ctx.dataEntry) return { show: false, reason: "data-entry", retryAt: null };

  // Time-based blocks: report the latest moment any of them ends so the caller can check again then.
  const waits: [ConversionPromptBlock, number | null, number][] = [
    ["interval", ctx.lastShownAt, config.minIntervalMs],
    ["scene-transition", ctx.lastSceneChangeAt, config.afterSceneChangeMs],
    ["just-interrupted", ctx.lastInterruptionEndAt, config.afterInterruptionMs],
  ];
  let block: { reason: ConversionPromptBlock; until: number } | null = null;
  for (const [reason, since, duration] of waits) {
    if (since === null) continue;
    const until = since + duration;
    if (ctx.now < until && (!block || until > block.until)) block = { reason, until };
  }
  return block ? { show: false, reason: block.reason, retryAt: block.until } : { show: true };
}
