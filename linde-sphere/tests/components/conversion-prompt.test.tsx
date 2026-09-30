import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appConfig } from "@/lib/config/app-config";
import { renderKiosk, session, startSession } from "./kiosk-harness";

const config = appConfig.kiosk.conversionPrompt;
/** Both quiet times (scene change and closed dialog) have passed. */
const SETTLE = Math.max(config.afterSceneChangeMs, config.afterInterruptionMs) + 100;
const events = () => session().events.map((e: { type: string }) => e.type);
/** Async act: also flushes microtasks, where MutationObserver (dialog open/close) callbacks run. */
const advance = (ms: number) =>
  act(async () => {
    vi.advanceTimersByTime(ms);
  });
const prompt = () => screen.queryByTestId("conversion-prompt");
/** Closes the panel and lets the dialog observer see it (a microtask, as in the browser). */
async function closeSheet() {
  fireEvent.click(within(screen.getByTestId("hotspot-sheet")).getByRole("button", { name: "Cerrar" }));
  await act(async () => undefined);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Explore two scenes meaningfully (campus → gas plant): recommendations become ready. */
async function becomeReadyInExplorer() {
  renderKiosk({ idle: { warningAfterMs: 3_600_000, countdownMs: 15_000 } });
  startSession();
  fireEvent.click(screen.getByTestId("path-explore"));
  fireEvent.click(screen.getByTestId("hotspot-campus-expansion"));
  await closeSheet();
  fireEvent.click(screen.getByTestId("hotspot-campus-to-gas-plant"));
  fireEvent.click(screen.getByTestId("hotspot-gas-plant-bulk-tank"));
}

describe("conversion prompt", () => {
  it("appears after readiness, but never while a panel is open or right after it closes", async () => {
    await becomeReadyInExplorer();
    await advance(10_000);
    expect(prompt()).toBeNull(); // the solution panel is still open
    await closeSheet();
    await advance(config.afterInterruptionMs - 100);
    expect(prompt()).toBeNull(); // quiet time after the dialog closed
    await advance(200);
    expect(prompt()).toHaveTextContent("Encontramos oportunidades relevantes para sus prioridades.");
    expect(events()).toContain("conversion-prompt-shown");
    // It never takes focus from the visitor.
    expect(prompt()!.contains(document.activeElement)).toBe(false);
  });

  it("waits after a scene transition", async () => {
    await becomeReadyInExplorer();
    await closeSheet();
    await advance(SETTLE);
    expect(prompt()).not.toBeNull();
    fireEvent.click(screen.getByTestId("conversion-prompt-dismiss"));
    // Readiness already met; after the interval, a scene change still delays the prompt.
    await advance(config.minIntervalMs - 1_000);
    fireEvent.click(screen.getByTestId("explorer-back"));
    await advance(1_500);
    expect(prompt()).toBeNull();
    await advance(config.afterSceneChangeMs);
    expect(prompt()).not.toBeNull();
  });

  it("shows at most once per interval and records the dismissal", async () => {
    await becomeReadyInExplorer();
    await closeSheet();
    await advance(SETTLE);
    fireEvent.click(screen.getByTestId("conversion-prompt-dismiss"));
    expect(prompt()).toBeNull();
    expect(events()).toContain("conversion-prompt-dismissed");
    await advance(config.minIntervalMs - 5_000);
    expect(prompt()).toBeNull();
    await advance(6_000);
    expect(prompt()).not.toBeNull();
    expect(events().filter((e: string) => e === "conversion-prompt-shown")).toHaveLength(2);
  });

  it("hides itself after a while without an answer", async () => {
    await becomeReadyInExplorer();
    await closeSheet();
    await advance(SETTLE);
    expect(prompt()).not.toBeNull();
    await advance(config.visibleMs + 100);
    expect(prompt()).toBeNull();
  });

  it("accepting opens the recommendations", async () => {
    await becomeReadyInExplorer();
    await closeSheet();
    await advance(SETTLE);
    fireEvent.click(screen.getByTestId("conversion-prompt-accept"));
    expect(screen.getByTestId("recommendations-screen")).toBeInTheDocument();
    expect(events().slice(-2)).toEqual(["conversion-prompt-accepted", "recommendations-calculated"]);
    await advance(config.minIntervalMs * 2);
    expect(prompt()).toBeNull(); // not on the results screen
  });

  it("does not appear before readiness or on screens outside its context", async () => {
    renderKiosk({ idle: { warningAfterMs: 3_600_000, countdownMs: 15_000 }, tailoringMs: 10 });
    startSession();
    fireEvent.click(screen.getByTestId("path-explore"));
    fireEvent.click(screen.getByTestId("hotspot-campus-expansion"));
    await closeSheet();
    await advance(60_000);
    expect(prompt()).toBeNull(); // one hotspot is not enough

    fireEvent.click(screen.getByTestId("explorer-back"));
    fireEvent.click(screen.getByTestId("path-role"));
    fireEvent.click(screen.getByTestId("persona-finance"));
    fireEvent.click(screen.getByTestId("persona-continue"));
    fireEvent.click(screen.getByTestId("challenge-lifecycle-costs"));
    await advance(60_000);
    expect(prompt()).toBeNull(); // ready (role + challenge), but the visitor is still choosing
  });
});
