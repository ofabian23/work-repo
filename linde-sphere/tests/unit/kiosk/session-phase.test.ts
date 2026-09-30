import { describe, expect, it } from "vitest";
import {
  INITIAL_KIOSK_STATE,
  kioskReducer,
  sessionPhase,
  type KioskAction,
  type KioskState,
} from "@/features/kiosk/state/kiosk-state";

const run = (...actions: KioskAction[]) => actions.reduce(kioskReducer, INITIAL_KIOSK_STATE);
const start: KioskAction = {
  type: "START_SESSION",
  id: "00000000-0000-4000-8000-000000000001",
  startedAt: "2026-10-20T13:58:00Z",
};
const started = run(start);
const phaseOf = (state: KioskState, recommendationReady = false) =>
  sessionPhase(state, { recommendationReady });

describe("sessionPhase", () => {
  it("derives every session state", () => {
    expect(phaseOf(INITIAL_KIOSK_STATE)).toBe("attracting");
    expect(phaseOf(started)).toBe("active");
    expect(phaseOf(started, true)).toBe("recommendation-ready");
    expect(phaseOf(kioskReducer(started, { type: "REQUEST_SUMMARY" }))).toBe("recommendation-ready");
    const form = kioskReducer(started, { type: "OPEN_LEAD_FORM" });
    expect(phaseOf(form, true)).toBe("entering-contact");
    const submitting = kioskReducer(form, { type: "LEAD_SUBMISSION_STARTED" });
    expect(phaseOf(submitting, true)).toBe("submitting");
    expect(phaseOf(kioskReducer(submitting, { type: "LEAD_SUBMITTED" }), true)).toBe("submitting");
    expect(phaseOf(kioskReducer(submitting, { type: "LEAD_SUBMISSION_FAILED" }), true)).toBe(
      "entering-contact",
    );
    expect(phaseOf(kioskReducer(submitting, { type: "LEAD_COMPLETED" }), true)).toBe("complete");
    expect(phaseOf(kioskReducer(started, { type: "REQUEST_RESET", reason: "explicit" }))).toBe("resetting");
  });
});

describe("reset requests", () => {
  it("clear the session at once and are marked done afterwards", () => {
    const resetting = kioskReducer(started, { type: "REQUEST_RESET", reason: "timeout" });
    expect(resetting).toMatchObject({
      session: null,
      screen: "attract",
      resetting: "timeout",
      resetCount: 1,
    });
    expect(kioskReducer(resetting, { type: "RESET_DONE" }).resetting).toBeNull();
  });

  it("are deferred while a submission is completing", () => {
    const submitting = run(start, { type: "OPEN_LEAD_FORM" }, { type: "LEAD_SUBMISSION_STARTED" });
    const deferred = kioskReducer(submitting, { type: "REQUEST_RESET", reason: "timeout" });
    expect(deferred.session).not.toBeNull();
    expect(deferred.deferredReset).toBe("timeout");
    expect(deferred.resetting).toBeNull();
    // Cancelling the form is not possible mid-submission either.
    expect(kioskReducer(deferred, { type: "CANCEL_LEAD_FORM" }).screen).toBe("lead-form");
    const settled = kioskReducer(deferred, { type: "LEAD_COMPLETED" });
    expect(kioskReducer(settled, { type: "REQUEST_RESET", reason: "timeout" }).resetting).toBe("timeout");
  });

  it("leave nothing of the previous visitor", () => {
    const busy = run(start, { type: "SELECT_PERSONA", personaId: "executive" }, { type: "OPEN_LEAD_FORM" });
    const requested = kioskReducer(busy, { type: "REQUEST_RESET", reason: "completed" });
    const after = kioskReducer(requested, { type: "RESET_DONE" });
    expect(after).toEqual({ ...INITIAL_KIOSK_STATE, resetCount: 1, lastResetReason: "completed" });
  });
});
