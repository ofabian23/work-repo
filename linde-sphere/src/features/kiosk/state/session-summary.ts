import type { ContentMode } from "@/domain/content/primitives";
import {
  VisitorSessionSchema,
  type SessionOutcome,
  type VisitorSession,
} from "@/domain/session/visitor-session";
import type { ActiveSession } from "./kiosk-state";

/*
 * Kept out of kiosk-state.ts so the schema (and zod) stay out of the kiosk's first-load bundle (ADR-058).
 */
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
