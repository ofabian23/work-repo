import { describe, expect, it } from "vitest";
import {
  conversionPromptDecision,
  type ConversionPromptContext,
} from "@/features/kiosk/conversion/conversion-policy";
import { appConfig } from "@/lib/config/app-config";

const config = appConfig.kiosk.conversionPrompt;
const NOW = 1_000_000;
const ctx = (overrides: Partial<ConversionPromptContext> = {}): ConversionPromptContext => ({
  now: NOW,
  ready: true,
  screenAllowed: true,
  modalOpen: false,
  dataEntry: false,
  lastSceneChangeAt: null,
  lastInterruptionEndAt: null,
  lastShownAt: null,
  ...overrides,
});

describe("conversion prompt policy", () => {
  it("shows once recommendations are ready and nothing else is going on", () => {
    expect(conversionPromptDecision(ctx(), config)).toEqual({ show: true });
  });

  it.each([
    ["not ready", { ready: false }, "not-ready"],
    ["another screen", { screenAllowed: false }, "screen"],
    ["a dialog is open", { modalOpen: true }, "modal-open"],
    ["the visitor is typing", { dataEntry: true }, "data-entry"],
  ] as const)("waits while %s", (_label, overrides, reason) => {
    expect(conversionPromptDecision(ctx(overrides), config)).toEqual({ show: false, reason, retryAt: null });
  });

  it("does not interrupt immediately after a scene transition", () => {
    const decision = conversionPromptDecision(ctx({ lastSceneChangeAt: NOW - 500 }), config);
    expect(decision).toEqual({
      show: false,
      reason: "scene-transition",
      retryAt: NOW - 500 + config.afterSceneChangeMs,
    });
    expect(
      conversionPromptDecision(ctx({ lastSceneChangeAt: NOW - config.afterSceneChangeMs }), config).show,
    ).toBe(true);
  });

  it("leaves a short quiet time after a dialog closes or data entry ends", () => {
    expect(conversionPromptDecision(ctx({ lastInterruptionEndAt: NOW - 100 }), config)).toMatchObject({
      show: false,
      reason: "just-interrupted",
    });
  });

  it("appears at most once per configured interval", () => {
    const shown = NOW - config.minIntervalMs + 1_000;
    expect(conversionPromptDecision(ctx({ lastShownAt: shown }), config)).toEqual({
      show: false,
      reason: "interval",
      retryAt: shown + config.minIntervalMs,
    });
    expect(conversionPromptDecision(ctx({ lastShownAt: NOW - config.minIntervalMs }), config).show).toBe(
      true,
    );
  });

  it("reports the latest time-based block so it checks again only once", () => {
    const decision = conversionPromptDecision(
      ctx({ lastSceneChangeAt: NOW - 100, lastShownAt: NOW - 10_000, lastInterruptionEndAt: NOW - 100 }),
      config,
    );
    expect(decision).toEqual({
      show: false,
      reason: "interval",
      retryAt: NOW - 10_000 + config.minIntervalMs,
    });
  });

  it("state-based blocks come before time-based ones", () => {
    expect(conversionPromptDecision(ctx({ modalOpen: true, lastSceneChangeAt: NOW }), config)).toMatchObject({
      reason: "modal-open",
    });
  });
});
