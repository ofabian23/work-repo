import { z } from "zod";
import { IdSchema } from "../content/primitives";

/**
 * Anonymous (class C1) session events: what the visitor did, in order, never who they are.
 * An event holds only a sequence number, a fixed type and an optional content/option id — no
 * timestamps, no free text and no personal information (ADR-048). The schema is strict, so any extra
 * field is rejected.
 */

export const SESSION_EVENT_TYPES = [
  "session-started",
  /** targetId: the entry path (role · challenge · explore). */
  "path-chosen",
  /** targetId: persona id (including the "several areas" persona). */
  "persona-selected",
  "challenge-selected",
  "challenge-deselected",
  /** "Something else": the visitor's priority is not listed (no text is ever asked for). */
  "other-challenge-selected",
  "other-challenge-deselected",
  "facility-selected",
  "scene-visited",
  "hotspot-opened",
  "hotspot-engaged",
  "interest-added",
  "interest-removed",
  /** targetId: the top recommended solution id. */
  "recommendations-calculated",
  /** targetId: a NEXT_STEP option id. */
  "next-step-chosen",
  /** The contextual conversion prompt ("We found opportunities…") was shown, accepted or dismissed. */
  "conversion-prompt-shown",
  "conversion-prompt-accepted",
  "conversion-prompt-dismissed",
  /** "Enviarme mi resumen personalizado" was chosen (explains the summary before the form). */
  "summary-requested",
  /** The contact form was opened, cancelled, or a submission was stored (no contact data, ever). */
  "lead-form-opened",
  "lead-form-cancelled",
  "lead-submitted",
] as const;
export const SessionEventTypeSchema = z.enum(SESSION_EVENT_TYPES);
export type SessionEventType = z.infer<typeof SessionEventTypeSchema>;

/** Options offered after the role journey's tailoring transition. */
export const NEXT_STEPS = ["view-recommendations", "refine-challenges", "explore-areas"] as const;
export const NextStepSchema = z.enum(NEXT_STEPS);
export type NextStep = z.infer<typeof NextStepSchema>;

/** Upper bound per session; later events are dropped (a visit is a few minutes long). */
export const MAX_SESSION_EVENTS = 200;

/** A content/option id: kebab-case with at least one letter, so digit runs (e.g. phone numbers) never pass. */
export const EventTargetSchema = IdSchema.regex(/[a-z]/, { error: "An event target must contain a letter" });

export const SessionEventSchema = z.strictObject({
  seq: z
    .number()
    .int()
    .min(0)
    .max(MAX_SESSION_EVENTS - 1),
  type: SessionEventTypeSchema,
  targetId: EventTargetSchema.nullable(),
});
export type SessionEvent = z.infer<typeof SessionEventSchema>;

export const SessionEventListSchema = z
  .array(SessionEventSchema)
  .max(MAX_SESSION_EVENTS)
  .refine((events) => events.every((e, i) => e.seq === i), { error: "Events must be numbered 0, 1, 2…" });

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
  if (targetId !== null && !EventTargetSchema.safeParse(targetId).success) return events;
  return [...events, { seq: events.length, type, targetId }];
}
