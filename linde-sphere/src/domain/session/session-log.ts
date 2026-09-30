import { ID_MAX_LENGTH, ID_MIN_LENGTH, ID_PATTERN } from "../content/constants";
import type { SessionEvent, SessionEventType } from "./session-event";
import type { SessionSignals } from "./visitor-session";

/**
 * Runtime helpers the kiosk client uses on every interaction. Zod-free (ADR-058): the schemas in
 * session-event.ts / visitor-session.ts describe the same shapes and are the source of truth for validation;
 * tests check that `isEventTarget` accepts exactly what EventTargetSchema accepts.
 */

/** Upper bound per session; later events are dropped (a visit is a few minutes long). */
export const MAX_SESSION_EVENTS = 200;

/** A content/option id: kebab-case with at least one letter, so digit runs (e.g. phone numbers) never pass. */
export function isEventTarget(value: string): boolean {
  return (
    value.length >= ID_MIN_LENGTH &&
    value.length <= ID_MAX_LENGTH &&
    ID_PATTERN.test(value) &&
    /[a-z]/.test(value)
  );
}

/**
 * Appends an event, or returns the list unchanged when the cap is reached or the target is not a
 * well-formed id (so free text can never be recorded, even by mistake).
 */
export function appendSessionEvent(
  events: SessionEvent[],
  type: SessionEventType,
  targetId: string | null = null,
): SessionEvent[] {
  if (events.length >= MAX_SESSION_EVENTS) return events;
  if (targetId !== null && !isEventTarget(targetId)) return events;
  return [...events, { seq: events.length, type, targetId }];
}

export const EMPTY_SIGNALS: SessionSignals = {
  personaId: null,
  challengeIds: [],
  facilityTypeId: null,
  visitedSceneIds: [],
  openedHotspotIds: [],
  engagedHotspotIds: [],
  explicitInterestIds: [],
};
