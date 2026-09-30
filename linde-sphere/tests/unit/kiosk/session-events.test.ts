import { describe, expect, it } from "vitest";
import { visibleContent } from "@/domain/content";
import { recommend } from "@/domain/recommendations/engine";
import {
  MAX_SESSION_EVENTS,
  SessionEventListSchema,
  SessionEventSchema,
  appendSessionEvent,
  type SessionEvent,
} from "@/domain/session/session-event";
import { EMPTY_SIGNALS } from "@/domain/session/visitor-session";
import {
  INITIAL_KIOSK_STATE,
  kioskReducer,
  type KioskAction,
  type KioskState,
} from "@/features/kiosk/state/kiosk-state";
import { loadSeedBundle } from "../../helpers/schema";

const demo = visibleContent(loadSeedBundle(), "demo");
const start: KioskAction = {
  type: "START_SESSION",
  id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  startedAt: "2026-10-20T14:00:00.000Z",
};
const run = (actions: KioskAction[], state: KioskState = INITIAL_KIOSK_STATE) =>
  actions.reduce(kioskReducer, state);
const events = (state: KioskState) => state.session!.events.map((e) => [e.type, e.targetId]);

describe("appendSessionEvent", () => {
  it("numbers events in order", () => {
    let list: SessionEvent[] = [];
    list = appendSessionEvent(list, "session-started");
    list = appendSessionEvent(list, "persona-selected", "finance");
    expect(list).toEqual([
      { seq: 0, type: "session-started", targetId: null },
      { seq: 1, type: "persona-selected", targetId: "finance" },
    ]);
    expect(SessionEventListSchema.safeParse(list).success).toBe(true);
  });

  it.each(["María Pérez", "maria@example.com", "787-555-0100", "Hospital San Juan", ""])(
    "never records free text as a target (%j)",
    (text) => {
      expect(appendSessionEvent([], "persona-selected", text)).toEqual([]);
    },
  );

  it("stops at the per-session cap", () => {
    let list: SessionEvent[] = [];
    for (let i = 0; i < MAX_SESSION_EVENTS + 20; i++)
      list = appendSessionEvent(list, "challenge-selected", "c-1");
    expect(list).toHaveLength(MAX_SESSION_EVENTS);
    expect(SessionEventListSchema.safeParse(list).success).toBe(true);
  });

  it("the event schema rejects any extra field, such as a timestamp or a name", () => {
    const base = { seq: 0, type: "persona-selected", targetId: "finance" };
    expect(SessionEventSchema.safeParse(base).success).toBe(true);
    expect(SessionEventSchema.safeParse({ ...base, at: "2026-10-20T14:00:00Z" }).success).toBe(false);
    expect(SessionEventSchema.safeParse({ ...base, name: "Ana" }).success).toBe(false);
    expect(SessionEventSchema.safeParse({ ...base, type: "email-entered" }).success).toBe(false);
  });
});

describe("session events written by the reducer", () => {
  it("records the role journey as anonymous events", () => {
    const state = run([
      start,
      { type: "CHOOSE_PATH", path: "role" },
      { type: "SELECT_PERSONA", personaId: "operations-facilities" },
      { type: "GO_TO", screen: "role-challenges" },
      { type: "TOGGLE_CHALLENGE", challengeId: "aging-infrastructure", max: 3 },
      { type: "TOGGLE_OTHER_CHALLENGE" },
      { type: "GO_TO", screen: "tailoring" },
      { type: "GO_TO", screen: "next-steps" },
      { type: "CHOOSE_NEXT_STEP", step: "view-recommendations" },
    ]);
    expect(events(state)).toEqual([
      ["session-started", null],
      ["path-chosen", "role"],
      ["persona-selected", "operations-facilities"],
      ["challenge-selected", "aging-infrastructure"],
      ["other-challenge-selected", null],
      ["next-step-chosen", "view-recommendations"],
    ]);
    expect(state.screen).toBe("recommendations");
    expect(SessionEventListSchema.safeParse(state.session!.events).success).toBe(true);
  });

  it("records every scene entry, keeps the current scene and lists each visited scene once", () => {
    const state = run([
      start,
      { type: "VISIT_SCENE", sceneId: "campus" },
      { type: "VISIT_SCENE", sceneId: "icu" },
      { type: "VISIT_SCENE", sceneId: "campus" },
      { type: "OPEN_HOTSPOT", hotspotId: "campus-expansion" },
      { type: "ENGAGE_HOTSPOT", hotspotId: "campus-expansion" },
      { type: "TOGGLE_INTEREST", solutionId: "medical-gas-supply-planning" },
    ]);
    expect(state.session!.currentSceneId).toBe("campus");
    expect(state.session!.signals.visitedSceneIds).toEqual(["campus", "icu"]);
    expect(events(state).slice(1)).toEqual([
      ["scene-visited", "campus"],
      ["scene-visited", "icu"],
      ["scene-visited", "campus"],
      ["hotspot-opened", "campus-expansion"],
      ["hotspot-engaged", "campus-expansion"],
      ["interest-added", "medical-gas-supply-planning"],
    ]);
  });

  it("remembers the previous screen for shared screens' back navigation", () => {
    const state = run([
      start,
      { type: "CHOOSE_PATH", path: "explore" },
      { type: "GO_TO", screen: "recommendations" },
    ]);
    expect(state.previousScreen).toBe("explore");
    expect(run([{ type: "RESET", reason: "explicit" }], state).previousScreen).toBeNull();
  });

  it("does not repeat an event when nothing changed", () => {
    const state = run([
      start,
      { type: "SELECT_PERSONA", personaId: "finance" },
      { type: "SELECT_PERSONA", personaId: "finance" },
      { type: "VISIT_SCENE", sceneId: "icu" },
      { type: "VISIT_SCENE", sceneId: "icu" },
      { type: "ENGAGE_HOTSPOT", hotspotId: "never-opened" },
    ]);
    expect(events(state)).toEqual([
      ["session-started", null],
      ["persona-selected", "finance"],
      ["scene-visited", "icu"],
    ]);
  });

  it("records a change of role and a deselected challenge", () => {
    const state = run([
      start,
      { type: "SELECT_PERSONA", personaId: "finance" },
      { type: "SELECT_PERSONA", personaId: "executive" },
      { type: "TOGGLE_CHALLENGE", challengeId: "lifecycle-costs", max: 3 },
      { type: "TOGGLE_CHALLENGE", challengeId: "lifecycle-costs", max: 3 },
    ]);
    expect(events(state).slice(1)).toEqual([
      ["persona-selected", "finance"],
      ["persona-selected", "executive"],
      ["challenge-selected", "lifecycle-costs"],
      ["challenge-deselected", "lifecycle-costs"],
    ]);
  });

  it("writes nothing when a fourth challenge is refused", () => {
    const three = run([
      start,
      ...["a-1", "b-2", "c-3"].map((id): KioskAction => ({
        type: "TOGGLE_CHALLENGE",
        challengeId: id,
        max: 3,
      })),
    ]);
    const after = kioskReducer(three, { type: "TOGGLE_CHALLENGE", challengeId: "d-4", max: 3 });
    expect(after).toBe(three);
  });

  it("records the calculated recommendations by their top solution id", () => {
    const signals = { ...EMPTY_SIGNALS, personaId: "procurement-supply" };
    const result = recommend(signals, demo);
    const state = run([
      start,
      { type: "SELECT_PERSONA", personaId: "procurement-supply" },
      { type: "SET_RECOMMENDATIONS", result },
    ]);
    expect(state.session!.recommendations).toBe(result);
    expect(events(state).at(-1)).toEqual(["recommendations-calculated", "medical-gas-supply-planning"]);
  });

  it("the role's challenge step requires a role", () => {
    const state = run([
      start,
      { type: "CHOOSE_PATH", path: "role" },
      { type: "GO_TO", screen: "role-challenges" },
    ]);
    expect(state.screen).toBe("role");
  });

  it("session state never contains personal-information keys", () => {
    const state = run([
      start,
      { type: "SELECT_PERSONA", personaId: "executive" },
      { type: "TOGGLE_OTHER_CHALLENGE" },
      { type: "CHOOSE_NEXT_STEP", step: "explore-areas" },
    ]);
    expect(JSON.stringify(state.session)).not.toMatch(/email|phone|"name"|organization|firstName|lastName/i);
  });

  it("a reset discards every event", () => {
    const state = run([
      start,
      { type: "SELECT_PERSONA", personaId: "executive" },
      { type: "RESET", reason: "timeout" },
    ]);
    expect(state.session).toBeNull();
    const next = run([start], state);
    expect(events(next)).toEqual([["session-started", null]]);
  });
});
