import type { ContentMode } from "@/domain/content/primitives";
import type { RecommendationResult } from "@/domain/recommendations/recommendation-result";
import {
  appendSessionEvent,
  type NextStep,
  type SessionEvent,
  type SessionEventType,
} from "@/domain/session/session-event";
import {
  EMPTY_SIGNALS,
  VisitorSessionSchema,
  type EntryPath,
  type SessionOutcome,
  type SessionSignals,
  type VisitorSession,
} from "@/domain/session/visitor-session";

/**
 * Kiosk session state machine (pure, ADR-004/ADR-005/ADR-047/ADR-048).
 * Holds NO personal information: only an opaque id, anonymous signals and events, a recommendation
 * snapshot and per-visitor accessibility preferences. Contact details live only in the lead form (Phase 7).
 */

export type KioskScreen =
  | "attract"
  | "welcome"
  // Path A — "Trabajo en…"
  | "role"
  | "role-challenges"
  | "tailoring"
  | "next-steps"
  | "recommendations"
  | "refine-challenges"
  // Path B — "Necesito…" (Phase 5) and path C — explorer (Phase 6)
  | "challenges"
  | "explore";

/** Screens reachable with GO_TO once a session exists. */
export type JourneyScreen = Exclude<KioskScreen, "attract">;
export type ResetReason = "explicit" | "timeout" | "completed";

export type AccessibilityPreferences = { largeText: boolean; reduceMotion: boolean };
export const DEFAULT_ACCESSIBILITY: AccessibilityPreferences = { largeText: false, reduceMotion: false };

export type ActiveSession = {
  id: string;
  startedAt: string;
  entryPath: EntryPath | null;
  signals: SessionSignals;
  /** "Something else": the visitor's priority is not in the list (no free text is collected). */
  otherChallengeSelected: boolean;
  /** Latest engine output shown to the visitor (recomputed by the server at lead time, ADR-025). */
  recommendations: RecommendationResult | null;
  /** Anonymous, ordered interaction events (ADR-048). */
  events: SessionEvent[];
  /** Scene shown in the hospital explorer (null until the explorer is first opened). */
  currentSceneId: string | null;
  accessibility: AccessibilityPreferences;
};

export type KioskState = {
  screen: KioskScreen;
  session: ActiveSession | null;
  /** Increments on every reset so screens remount in their initial visual state. */
  resetCount: number;
  lastResetReason: ResetReason | null;
  /** The screen shown before the current one (for "Volver" on shared screens such as recommendations). */
  previousScreen: KioskScreen | null;
};

export const INITIAL_KIOSK_STATE: KioskState = {
  screen: "attract",
  session: null,
  resetCount: 0,
  lastResetReason: null,
  previousScreen: null,
};

export const PATH_SCREENS: Record<EntryPath, KioskScreen> = {
  role: "role",
  challenge: "challenges",
  explore: "explore",
};

/** Where each next-step option leads. */
export const NEXT_STEP_SCREENS: Record<NextStep, JourneyScreen> = {
  "view-recommendations": "recommendations",
  "refine-challenges": "refine-challenges",
  "explore-areas": "explore",
};

export type KioskAction =
  | { type: "START_SESSION"; id: string; startedAt: string }
  | { type: "CHOOSE_PATH"; path: EntryPath }
  | { type: "GO_TO_WELCOME" }
  | { type: "GO_TO"; screen: JourneyScreen }
  | { type: "CHOOSE_NEXT_STEP"; step: NextStep }
  | { type: "SELECT_PERSONA"; personaId: string | null }
  | { type: "TOGGLE_CHALLENGE"; challengeId: string; max: number }
  | { type: "TOGGLE_OTHER_CHALLENGE" }
  | { type: "SELECT_FACILITY"; facilityTypeId: string | null }
  | { type: "VISIT_SCENE"; sceneId: string }
  | { type: "OPEN_HOTSPOT"; hotspotId: string }
  | { type: "ENGAGE_HOTSPOT"; hotspotId: string }
  | { type: "TOGGLE_INTEREST"; solutionId: string }
  | { type: "SET_RECOMMENDATIONS"; result: RecommendationResult | null }
  | { type: "SET_ACCESSIBILITY"; preferences: Partial<AccessibilityPreferences> }
  | { type: "RESET"; reason: ResetReason };

const appendUnique = (list: string[], id: string) => (list.includes(id) ? list : [...list, id]);
const toggle = (list: string[], id: string) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

/**
 * Applies a signal change and records the matching event. `event` receives the previous and next
 * signals and returns the event to write, or null when nothing changed (no duplicate events).
 */
function updateSignals(
  state: KioskState,
  update: (s: SessionSignals) => SessionSignals,
  event: (prev: SessionSignals, next: SessionSignals) => [SessionEventType, string | null] | null,
): KioskState {
  if (!state.session) return state;
  const prev = state.session.signals;
  const next = update(prev);
  if (next === prev) return state;
  const recorded = event(prev, next);
  return {
    ...state,
    session: {
      ...state.session,
      signals: next,
      events: recorded ? appendSessionEvent(state.session.events, ...recorded) : state.session.events,
    },
  };
}

function withEvent(session: ActiveSession, type: SessionEventType, targetId: string | null = null) {
  return { ...session, events: appendSessionEvent(session.events, type, targetId) };
}

export function kioskReducer(state: KioskState, action: KioskAction): KioskState {
  const next = reduce(state, action);
  // Remember where the visitor came from whenever the screen changes within a session.
  if (next.session && next.screen !== state.screen) return { ...next, previousScreen: state.screen };
  return next;
}

function reduce(state: KioskState, action: KioskAction): KioskState {
  switch (action.type) {
    case "START_SESSION":
      // A new session only starts from the attract screen with no active session.
      if (state.session) return state;
      return {
        ...state,
        screen: "welcome",
        session: {
          id: action.id,
          startedAt: action.startedAt,
          entryPath: null,
          signals: { ...EMPTY_SIGNALS },
          otherChallengeSelected: false,
          recommendations: null,
          events: appendSessionEvent([], "session-started"),
          currentSceneId: null,
          accessibility: { ...DEFAULT_ACCESSIBILITY },
        },
      };

    case "RESET":
      // Nothing from the previous visitor survives: a brand-new state object, only the counter carries over.
      return { ...INITIAL_KIOSK_STATE, resetCount: state.resetCount + 1, lastResetReason: action.reason };
  }

  // Every other action requires an active session; on the attract screen they are ignored.
  if (!state.session) return state;

  switch (action.type) {
    case "CHOOSE_PATH":
      return {
        ...state,
        screen: PATH_SCREENS[action.path],
        session: withEvent(
          { ...state.session, entryPath: state.session.entryPath ?? action.path },
          "path-chosen",
          action.path,
        ),
      };
    case "GO_TO_WELCOME":
      return { ...state, screen: "welcome" };
    case "GO_TO":
      // The role's challenge step needs a role to tailor the list to.
      if (action.screen === "role-challenges" && !state.session.signals.personaId) return state;
      return { ...state, screen: action.screen };
    case "CHOOSE_NEXT_STEP":
      return {
        ...state,
        screen: NEXT_STEP_SCREENS[action.step],
        session: withEvent(state.session, "next-step-chosen", action.step),
      };
    case "SELECT_PERSONA":
      return updateSignals(
        state,
        (s) => (s.personaId === action.personaId ? s : { ...s, personaId: action.personaId }),
        (_, next) => (next.personaId ? ["persona-selected", next.personaId] : null),
      );
    case "TOGGLE_CHALLENGE":
      return updateSignals(
        state,
        (s) => {
          const selected = s.challengeIds.includes(action.challengeId);
          if (!selected && s.challengeIds.length >= action.max) return s;
          return { ...s, challengeIds: toggle(s.challengeIds, action.challengeId) };
        },
        (prev) => [
          prev.challengeIds.includes(action.challengeId) ? "challenge-deselected" : "challenge-selected",
          action.challengeId,
        ],
      );
    case "TOGGLE_OTHER_CHALLENGE": {
      const selected = !state.session.otherChallengeSelected;
      return {
        ...state,
        session: withEvent(
          { ...state.session, otherChallengeSelected: selected },
          selected ? "other-challenge-selected" : "other-challenge-deselected",
        ),
      };
    }
    case "SELECT_FACILITY":
      return updateSignals(
        state,
        (s) =>
          s.facilityTypeId === action.facilityTypeId ? s : { ...s, facilityTypeId: action.facilityTypeId },
        (_, next) => (next.facilityTypeId ? ["facility-selected", next.facilityTypeId] : null),
      );
    case "VISIT_SCENE": {
      // Entering a scene: it becomes the current one; the signal lists each scene once, while the event
      // log records every entry (the visitor's path through the hospital).
      const session = state.session;
      if (session.currentSceneId === action.sceneId) return state;
      return {
        ...state,
        session: withEvent(
          {
            ...session,
            currentSceneId: action.sceneId,
            signals: {
              ...session.signals,
              visitedSceneIds: appendUnique(session.signals.visitedSceneIds, action.sceneId),
            },
          },
          "scene-visited",
          action.sceneId,
        ),
      };
    }
    case "OPEN_HOTSPOT":
      return updateSignals(
        state,
        (s) =>
          s.openedHotspotIds.includes(action.hotspotId)
            ? s
            : { ...s, openedHotspotIds: appendUnique(s.openedHotspotIds, action.hotspotId) },
        () => ["hotspot-opened", action.hotspotId],
      );
    case "ENGAGE_HOTSPOT":
      // Engagement only counts for hotspots that were opened (SessionSignals invariant).
      return updateSignals(
        state,
        (s) =>
          s.openedHotspotIds.includes(action.hotspotId) && !s.engagedHotspotIds.includes(action.hotspotId)
            ? { ...s, engagedHotspotIds: [...s.engagedHotspotIds, action.hotspotId] }
            : s,
        () => ["hotspot-engaged", action.hotspotId],
      );
    case "TOGGLE_INTEREST":
      return updateSignals(
        state,
        (s) => ({ ...s, explicitInterestIds: toggle(s.explicitInterestIds, action.solutionId) }),
        (prev) => [
          prev.explicitInterestIds.includes(action.solutionId) ? "interest-removed" : "interest-added",
          action.solutionId,
        ],
      );
    case "SET_RECOMMENDATIONS": {
      const session = { ...state.session, recommendations: action.result };
      return {
        ...state,
        session: action.result
          ? withEvent(session, "recommendations-calculated", action.result.items[0]?.solutionId ?? null)
          : session,
      };
    }
    case "SET_ACCESSIBILITY":
      return {
        ...state,
        session: {
          ...state.session,
          accessibility: { ...state.session.accessibility, ...action.preferences },
        },
      };
  }
}

/**
 * Anonymous (class C1) summary for booth metrics (sent on reset from Phase 7, ADR-026).
 * Validated against VisitorSessionSchema, which rejects any extra field.
 */
export function toSessionSummary(
  session: ActiveSession,
  meta: {
    language: "es" | "en";
    contentMode: ContentMode;
    contentVersion: string;
    outcome: SessionOutcome;
    endedAt: string | null;
  },
): VisitorSession {
  return VisitorSessionSchema.parse({
    id: session.id,
    startedAt: session.startedAt,
    endedAt: meta.endedAt,
    language: meta.language,
    entryPath: session.entryPath,
    contentMode: meta.contentMode,
    contentVersion: meta.contentVersion,
    outcome: meta.outcome,
    signals: session.signals,
  });
}
