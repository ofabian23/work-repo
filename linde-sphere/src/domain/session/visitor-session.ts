import { z } from "zod";
import {
  ContentModeSchema,
  IdSchema,
  IsoDateTimeSchema,
  LanguageSchema,
  MAX_SELECTED_CHALLENGES,
} from "../content/primitives";

/** Ordered list of unique ids. */
export const uniqueIds = (max: number) =>
  z
    .array(IdSchema)
    .max(max)
    .refine((ids) => new Set(ids).size === ids.length, { error: "Ids must be unique" });

/**
 * Anonymous (class C1) interaction signals. No personal information may ever be added here.
 * Raw timestamps and dwell times are deliberately absent. Dwell is reduced to `engagedHotspotIds`.
 */
export const SessionSignalsSchema = z
  .strictObject({
    personaId: IdSchema.nullable(),
    challengeIds: uniqueIds(MAX_SELECTED_CHALLENGES),
    facilityTypeId: IdSchema.nullable(),
    visitedSceneIds: uniqueIds(50),
    openedHotspotIds: uniqueIds(200),
    /** Hotspots whose panel stayed open past the engagement threshold; subset of opened. */
    engagedHotspotIds: uniqueIds(200),
    /** Solution ids the visitor explicitly marked as interesting. */
    explicitInterestIds: uniqueIds(20),
  })
  .superRefine((s, ctx) => {
    const opened = new Set(s.openedHotspotIds);
    s.engagedHotspotIds.forEach((id, i) => {
      if (!opened.has(id)) {
        ctx.addIssue({
          code: "custom",
          path: ["engagedHotspotIds", i],
          message: `Engaged hotspot '${id}' must also be in openedHotspotIds`,
        });
      }
    });
  });
export type SessionSignals = z.infer<typeof SessionSignalsSchema>;

export const EMPTY_SIGNALS: SessionSignals = {
  personaId: null,
  challengeIds: [],
  facilityTypeId: null,
  visitedSceneIds: [],
  openedHotspotIds: [],
  engagedHotspotIds: [],
  explicitInterestIds: [],
};

export const EntryPathSchema = z.enum(["role", "challenge", "explore"]);
export type EntryPath = z.infer<typeof EntryPathSchema>;

export const SessionOutcomeSchema = z.enum(["in-progress", "completed", "abandoned", "timeout"]);
export type SessionOutcome = z.infer<typeof SessionOutcomeSchema>;

export const VisitorSessionSchema = z
  .strictObject({
    id: z.uuid(),
    startedAt: IsoDateTimeSchema,
    endedAt: IsoDateTimeSchema.nullable(),
    language: LanguageSchema,
    entryPath: EntryPathSchema.nullable(),
    contentMode: ContentModeSchema,
    contentVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    outcome: SessionOutcomeSchema,
    signals: SessionSignalsSchema,
  })
  .superRefine((s, ctx) => {
    if (s.outcome === "in-progress" && s.endedAt !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["endedAt"],
        message: "An in-progress session cannot have endedAt",
      });
    }
    if (s.outcome !== "in-progress" && s.endedAt === null) {
      ctx.addIssue({
        code: "custom",
        path: ["endedAt"],
        message: `endedAt is required when outcome is '${s.outcome}'`,
      });
    }
    if (s.endedAt !== null && Date.parse(s.endedAt) < Date.parse(s.startedAt)) {
      ctx.addIssue({ code: "custom", path: ["endedAt"], message: "endedAt must not be before startedAt" });
    }
  });
export type VisitorSession = z.infer<typeof VisitorSessionSchema>;
