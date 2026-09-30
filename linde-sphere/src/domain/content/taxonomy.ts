import { z } from "zod";
import {
  IconKeySchema,
  IdSchema,
  LocalizedLabelSchema,
  LocalizedTextSchema,
  SortOrderSchema,
  ValidationStatusSchema,
} from "./primitives";
import { SalesReviewSchema, refineSalesReviewAgainstStatus } from "./sales-review";

/**
 * Taxonomy content: how visitors describe themselves and their problems. Makes no offering claim, but
 * the Puerto Rico sales team still confirms each role and problem (salesReview) before production use.
 */

export const PersonaSchema = z
  .strictObject({
    id: IdSchema,
    label: LocalizedLabelSchema,
    description: LocalizedTextSchema,
    icon: IconKeySchema,
    sortOrder: SortOrderSchema,
    /** Challenges shown first after this persona is selected (ordering hint only, not scoring). */
    suggestedChallengeIds: z.array(IdSchema).max(12),
    /**
     * "single" (default): one professional area. "multiple": the "My role spans several areas" option,
     * shown apart from the list and never weighted by a rule (it names no specific area).
     */
    scope: z.enum(["single", "multiple"]).default("single"),
    validationStatus: ValidationStatusSchema,
    /** Internal sales-validation worksheet (ADR-060); stripped before content reaches the kiosk. */
    salesReview: SalesReviewSchema,
  })
  .superRefine((persona, ctx) =>
    refineSalesReviewAgainstStatus({ ...persona, name: persona.label }, "taxonomy", ctx, "label"),
  );
export type Persona = z.infer<typeof PersonaSchema>;

export const ChallengeSchema = z
  .strictObject({
    id: IdSchema,
    label: LocalizedLabelSchema,
    description: LocalizedTextSchema,
    icon: IconKeySchema,
    sortOrder: SortOrderSchema,
    validationStatus: ValidationStatusSchema,
    /** Internal sales-validation worksheet (ADR-060); stripped before content reaches the kiosk. */
    salesReview: SalesReviewSchema,
  })
  .superRefine((challenge, ctx) =>
    refineSalesReviewAgainstStatus({ ...challenge, name: challenge.label }, "taxonomy", ctx, "label"),
  );
export type Challenge = z.infer<typeof ChallengeSchema>;

export const FacilityTypeSchema = z.strictObject({
  id: IdSchema,
  label: LocalizedLabelSchema,
  description: LocalizedTextSchema,
  sortOrder: SortOrderSchema,
  validationStatus: ValidationStatusSchema,
});
export type FacilityType = z.infer<typeof FacilityTypeSchema>;
