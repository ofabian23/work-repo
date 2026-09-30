import { describe, expect, it } from "vitest";
import {
  INITIAL_KIOSK_STATE,
  kioskReducer,
  type KioskAction,
  type KioskState,
} from "@/features/kiosk/state/kiosk-state";
import { createSessionId } from "@/features/kiosk/state/session-id";
import { toSessionSummary } from "@/features/kiosk/state/session-summary";
import { visibleContent } from "@/domain/content";
import { recommend } from "@/domain/recommendations/engine";
import { EMPTY_SIGNALS } from "@/domain/session/visitor-session";
import { loadSeedBundle } from "../../helpers/schema";

const ID_A = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const ID_B = "9b2f3c3e-1d4a-4b8e-8f6a-2c1d0e9f8a7b";
const start = (id = ID_A): KioskAction => ({
  type: "START_SESSION",
  id,
  startedAt: "2026-10-20T14:00:00.000Z",
});
const run = (actions: KioskAction[], state: KioskState = INITIAL_KIOSK_STATE) =>
  actions.reduce(kioskReducer, state);

describe("starting a session", () => {
  it("begins on the attract screen with no session", () => {
    expect(INITIAL_KIOSK_STATE).toMatchObject({ screen: "attract", session: null, resetCount: 0 });
  });

  it("creates a session with an opaque id and empty anonymous signals, then shows the welcome screen", () => {
    const state = run([start()]);
    expect(state.screen).toBe("welcome");
    expect(state.session).toMatchObject({
      id: ID_A,
      entryPath: null,
      recommendations: null,
      signals: EMPTY_SIGNALS,
    });
    expect(state.session!.accessibility).toEqual({ largeText: false, reduceMotion: false });
  });

  it("holds no personal-information fields", () => {
    const session = run([start()]).session!;
    expect(Object.keys(session).sort()).toEqual(
      [
        "accessibility",
        "currentSceneId",
        "entryPath",
        "events",
        "id",
        "otherChallengeSelected",
        "recommendations",
        "signals",
        "startedAt",
      ].sort(),
    );
    expect(JSON.stringify(session)).not.toMatch(/email|name|phone|organization/i);
  });

  it("does not replace an active session if start is triggered again", () => {
    const state = run([start(ID_A), start(ID_B)]);
    expect(state.session!.id).toBe(ID_A);
  });

  it("ignores visitor actions while no session is active", () => {
    const state = run([
      { type: "SELECT_PERSONA", personaId: "finance" },
      { type: "CHOOSE_PATH", path: "role" },
    ]);
    expect(state).toEqual(INITIAL_KIOSK_STATE);
  });
});

describe("entry paths and navigation", () => {
  it.each([
    ["role", "role"],
    ["challenge", "challenges"],
    ["explore", "explore"],
  ] as const)("choosing '%s' records the path and opens the '%s' screen", (path, screen) => {
    const state = run([start(), { type: "CHOOSE_PATH", path }]);
    expect(state.screen).toBe(screen);
    expect(state.session!.entryPath).toBe(path);
  });

  it("returns to the welcome screen keeping the session, and keeps the first entry path", () => {
    const state = run([
      start(),
      { type: "CHOOSE_PATH", path: "explore" },
      { type: "GO_TO_WELCOME" },
      { type: "CHOOSE_PATH", path: "role" },
    ]);
    expect(state.screen).toBe("role");
    expect(state.session!.entryPath).toBe("explore");
    expect(state.session!.id).toBe(ID_A);
  });
});

describe("tracking selections", () => {
  it("tracks role, challenges (with limit), facility, scenes, hotspots, engagement and interests", () => {
    const state = run([
      start(),
      { type: "SELECT_PERSONA", personaId: "procurement-supply" },
      { type: "TOGGLE_CHALLENGE", challengeId: "supply-continuity", max: 3 },
      { type: "TOGGLE_CHALLENGE", challengeId: "emergency-preparedness", max: 3 },
      { type: "TOGGLE_CHALLENGE", challengeId: "lifecycle-costs", max: 3 },
      { type: "TOGGLE_CHALLENGE", challengeId: "facility-expansion", max: 3 }, // over the limit: ignored
      { type: "TOGGLE_CHALLENGE", challengeId: "emergency-preparedness", max: 3 }, // deselect
      { type: "SELECT_FACILITY", facilityTypeId: "acute-hospital" },
      { type: "VISIT_SCENE", sceneId: "campus" },
      { type: "VISIT_SCENE", sceneId: "gas-plant" },
      { type: "VISIT_SCENE", sceneId: "campus" }, // duplicate
      { type: "ENGAGE_HOTSPOT", hotspotId: "gas-plant-bulk-tank" }, // not opened yet: ignored
      { type: "OPEN_HOTSPOT", hotspotId: "gas-plant-bulk-tank" },
      { type: "ENGAGE_HOTSPOT", hotspotId: "gas-plant-bulk-tank" },
      { type: "TOGGLE_INTEREST", solutionId: "bulk-centralized-supply" },
    ]);
    expect(state.session!.signals).toEqual({
      personaId: "procurement-supply",
      challengeIds: ["supply-continuity", "lifecycle-costs"],
      facilityTypeId: "acute-hospital",
      visitedSceneIds: ["campus", "gas-plant"],
      openedHotspotIds: ["gas-plant-bulk-tank"],
      engagedHotspotIds: ["gas-plant-bulk-tank"],
      explicitInterestIds: ["bulk-centralized-supply"],
    });
  });

  it("stores the latest recommendation snapshot", () => {
    const content = visibleContent(loadSeedBundle(), "demo");
    const result = recommend({ ...EMPTY_SIGNALS, personaId: "finance" }, content);
    const state = run([start(), { type: "SET_RECOMMENDATIONS", result }]);
    expect(state.session!.recommendations).toBe(result);
  });

  it("stores per-visitor accessibility preferences", () => {
    const state = run([start(), { type: "SET_ACCESSIBILITY", preferences: { largeText: true } }]);
    expect(state.session!.accessibility).toEqual({ largeText: true, reduceMotion: false });
  });
});

describe("resetting a session", () => {
  const busy = () =>
    run([
      start(ID_A),
      { type: "CHOOSE_PATH", path: "challenge" },
      { type: "SELECT_PERSONA", personaId: "finance" },
      { type: "TOGGLE_CHALLENGE", challengeId: "lifecycle-costs", max: 3 },
      { type: "SET_ACCESSIBILITY", preferences: { reduceMotion: true } },
    ]);

  it.each(["explicit", "timeout", "completed"] as const)(
    "a %s reset returns to the attract screen with no session",
    (reason) => {
      const state = kioskReducer(busy(), { type: "RESET", reason });
      expect(state).toEqual({ ...INITIAL_KIOSK_STATE, resetCount: 1, lastResetReason: reason });
    },
  );

  it("never leaks the previous visitor's state into the next session", () => {
    const afterReset = kioskReducer(busy(), { type: "RESET", reason: "timeout" });
    const next = kioskReducer(afterReset, start(ID_B));
    expect(next.session).toMatchObject({
      id: ID_B,
      entryPath: null,
      signals: EMPTY_SIGNALS,
      recommendations: null,
    });
    expect(next.session!.accessibility).toEqual({ largeText: false, reduceMotion: false });
    expect(next.screen).toBe("welcome");
  });

  it("counts resets so screens remount in their initial visual state", () => {
    const state = run([
      start(),
      { type: "RESET", reason: "explicit" },
      start(ID_B),
      { type: "RESET", reason: "timeout" },
    ]);
    expect(state.resetCount).toBe(2);
  });
});

describe("session id", () => {
  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it("uses crypto.randomUUID when available", () => {
    expect(createSessionId()).toMatch(UUID_V4);
  });

  it("falls back to getRandomValues in insecure contexts (plain HTTP on the LAN)", () => {
    const insecure: Pick<Crypto, "getRandomValues"> = {
      getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
    };
    const ids = new Set(Array.from({ length: 50 }, () => createSessionId(insecure)));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(UUID_V4);
  });
});

describe("anonymous session summary", () => {
  it("produces a schema-valid VisitorSession with no extra fields", () => {
    const session = run([
      start(),
      { type: "CHOOSE_PATH", path: "role" },
      { type: "SELECT_PERSONA", personaId: "finance" },
    ]).session!;
    const summary = toSessionSummary(session, {
      language: "es",
      contentMode: "demo",
      contentVersion: "0.2.0",
      outcome: "timeout",
      endedAt: "2026-10-20T14:05:00.000Z",
    });
    expect(summary).toMatchObject({ id: ID_A, entryPath: "role", outcome: "timeout" });
    expect(Object.keys(summary)).not.toContain("accessibility");
    expect(Object.keys(summary)).not.toContain("recommendations");
  });
});
