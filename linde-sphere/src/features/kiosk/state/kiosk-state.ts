import type { ContentMode } from "@/domain/content/primitives";
import type { RecommendationResult } from "@/domain/recommendations/recommendation-result";
import {
  EMPTY_SIGNALS,
  VisitorSessionSchema,
  type EntryPath,
  type SessionOutcome,
  type SessionSignals,
  type VisitorSession,
} from "@/domain/session/visitor-session";

/**
 * Kiosk session state machine (pure, ADR-004/ADR-005/ADR-047).
 * Holds NO personal information: only an opaque id, anonymous signals, a recommendation snapshot and
 * per-visitor accessibility preferences. Contact details live only in the lead form (Phase 7).
 */

export type KioskScreen = "attract" | "welcome" | "role" | "challenges" | "explore";
export type ResetReason = "explicit" | "timeout" | "completed";

export type AccessibilityPreferences = { largeText: boolean; reduceMotion: boolean };
export const DEFAULT_ACCESSIBILITY: AccessibilityPreferences = { largeText: false, reduceMotion: false };

export type ActiveSession = {
  id: string;
  startedAt: string;
  entryPath: EntryPath | null;
  signals: SessionSignals;
  /** Latest engine output shown to the visitor (recomputed by the server at lead time, ADR-025). */
  recommendations: RecommendationResult | null;
  accessibility: AccessibilityPreferences;
};

export type KioskState = {
  screen: KioskScreen;
  session: ActiveSession | null;
  /** Increments on every reset so screens remount in their initial visual state. */
  resetCount: number;
  lastResetReason: ResetReason | null;
};

export const INITIAL_KIOSK_STATE: KioskState = {
  screen: "attract",
  session: null,
  resetCount: 0,
  lastResetReason: null,
};

export const PATH_SCREENS: Record<EntryPath, KioskScreen> = {
  role: "role",
  challenge: "challenges",
  explore: "explore",
};

export type KioskAction =
  | { type: "START_SESSION"; id: string; startedAt: string }
  | { type: "CHOOSE_PATH"; path: EntryPath }
  | { type: "GO_TO_WELCOME" }
  | { type: "SELECT_PERSONA"; personaId: string | null }
  | { type: "TOGGLE_CHALLENGE"; challengeId: string; max: number }
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

function updateSignals(state: KioskState, update: (s: SessionSignals) => SessionSignals): KioskState {
  if (!state.session) return state;
  return { ...state, session: { ...state.session, signals: update(state.session.signals) } };
}

export function kioskReducer(state: KioskState, action: KioskAction): KioskState {
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
          recommendations: null,
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
        session: { ...state.session, entryPath: state.session.entryPath ?? action.path },
      };
    case "GO_TO_WELCOME":
      return { ...state, screen: "welcome" };
    case "SELECT_PERSONA":
      return updateSignals(state, (s) => ({ ...s, personaId: action.personaId }));
    case "TOGGLE_CHALLENGE":
      return updateSignals(state, (s) => {
        const selected = s.challengeIds.includes(action.challengeId);
        if (!selected && s.challengeIds.length >= action.max) return s;
        return { ...s, challengeIds: toggle(s.challengeIds, action.challengeId) };
      });
    case "SELECT_FACILITY":
      return updateSignals(state, (s) => ({ ...s, facilityTypeId: action.facilityTypeId }));
    case "VISIT_SCENE":
      return updateSignals(state, (s) => ({
        ...s,
        visitedSceneIds: appendUnique(s.visitedSceneIds, action.sceneId),
      }));
    case "OPEN_HOTSPOT":
      return updateSignals(state, (s) => ({
        ...s,
        openedHotspotIds: appendUnique(s.openedHotspotIds, action.hotspotId),
      }));
    case "ENGAGE_HOTSPOT":
      // Engagement only counts for hotspots that were opened (SessionSignals invariant).
      return updateSignals(state, (s) =>
        s.openedHotspotIds.includes(action.hotspotId)
          ? { ...s, engagedHotspotIds: appendUnique(s.engagedHotspotIds, action.hotspotId) }
          : s,
      );
    case "TOGGLE_INTEREST":
      return updateSignals(state, (s) => ({
        ...s,
        explicitInterestIds: toggle(s.explicitInterestIds, action.solutionId),
      }));
    case "SET_RECOMMENDATIONS":
      return { ...state, session: { ...state.session, recommendations: action.result } };
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
