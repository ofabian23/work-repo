import { z } from "zod";
import { LocalizedLabelSchema, type LocalizedLabel, type ValidationStatus } from "./primitives";

/**
 * Internal sales-validation worksheet (ADR-060, SALES_VALIDATION_GUIDE.md), attached to every persona,
 * challenge, solution and digital asset. Filled in from the Puerto Rico sales team's answers; never sent to
 * the kiosk (stripped by the visibility filter) and never shown to visitors.
 */

export const PR_AVAILABILITY = ["yes", "no", "unknown"] as const;
export const SALES_DECISIONS = ["pending", "keep", "remove", "rename"] as const;
export const APPROVAL_STATUSES = [
  "not-started",
  "in-review",
  "changes-requested",
  "approved",
  "rejected",
] as const;
export const CONVENTION_PRIORITIES = ["high", "medium", "low", "unset"] as const;

export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const SalesReviewSchema = z
  .strictObject({
    /** Q1: does Linde offer (or, for roles and problems, encounter) this in Puerto Rico? */
    availableInPuertoRico: z.enum(PR_AVAILABILITY),
    /** Keep as is, remove, or rename (to `proposedName`). */
    decision: z.enum(SALES_DECISIONS),
    /** Q2: the correct local name. Required when decision is "rename". */
    proposedName: LocalizedLabelSchema.nullable(),
    /** What must change before approval (wording, scope, claims). Empty once applied. */
    requiredCorrection: z.string().trim().max(1000),
    /** Q7: brochure, image, video or technical sheet still missing or not yet approved. */
    missingDigitalMaterial: z.string().trim().max(1000),
    /** Sales team member accountable for this item's answers (a role or name, never a visitor). */
    salesOwner: z.string().trim().min(1).max(200).nullable(),
    approvalStatus: z.enum(APPROVAL_STATUSES),
    /** Q9: how important this opportunity is for the convention. */
    conventionPriority: z.enum(CONVENTION_PRIORITIES),
    /** False while the priority is only a project-team proposal. */
    priorityConfirmedBySales: z.boolean(),
    notes: z.string().max(1000),
  })
  .superRefine((review, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (review.decision === "rename" && review.proposedName === null) {
      issue("proposedName", "proposedName is required to rename");
    }
    if (review.decision !== "rename" && review.proposedName !== null) {
      issue("proposedName", "proposedName is only used when decision is 'rename'");
    }
    if (review.priorityConfirmedBySales && review.conventionPriority === "unset") {
      issue("conventionPriority", "A confirmed priority cannot be 'unset'");
    }
    if (review.approvalStatus === "approved") {
      if (review.decision === "pending")
        issue("decision", "An approved item needs a decision (keep, remove or rename)");
      if (review.salesOwner === null) issue("salesOwner", "An approved item needs a sales owner");
      if (review.availableInPuertoRico === "unknown") {
        issue("availableInPuertoRico", "An approved item cannot have unknown Puerto Rico availability");
      }
      if (review.requiredCorrection !== "") {
        issue("requiredCorrection", "Apply the required correction (and clear it) before approving");
      }
    }
  });
export type SalesReview = z.infer<typeof SalesReviewSchema>;

/** Starting point for a new item: nothing answered yet. */
export const pendingSalesReview = (): SalesReview => ({
  availableInPuertoRico: "unknown",
  decision: "pending",
  proposedName: null,
  requiredCorrection: "",
  missingDigitalMaterial: "",
  salesOwner: null,
  approvalStatus: "not-started",
  conventionPriority: "unset",
  priorityConfirmedBySales: false,
  notes: "",
});

/**
 * The worksheet and the validation status must tell the same story (production guard, ADR-060):
 * - validated ⇔ approved (and not removed): nothing reaches production without a sales approval, and an
 *   approval is not left unapplied;
 * - offerings (solutions, assets) need "yes" for Puerto Rico before they can be validated;
 * - "not in Puerto Rico" or "remove" ⇒ unavailable, so it can never be shown;
 * - once a rename is validated, the displayed name must be the approved local name.
 */
export function refineSalesReviewAgainstStatus(
  item: { validationStatus: ValidationStatus; salesReview: SalesReview; name: LocalizedLabel },
  kind: "offering" | "taxonomy",
  ctx: z.RefinementCtx,
  namePath: string,
): void {
  const { validationStatus: status, salesReview: review } = item;
  const issue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: "custom", path, message });
  const approvedToShow = review.approvalStatus === "approved" && review.decision !== "remove";

  if (status === "validated" && review.approvalStatus !== "approved") {
    issue(["salesReview", "approvalStatus"], "Validated content needs sales approval ('approved')");
  }
  if (approvedToShow && status !== "validated") {
    issue(["validationStatus"], "Approved by sales: set validationStatus to 'validated' (or record why not)");
  }
  if (kind === "offering" && status === "validated" && review.availableInPuertoRico !== "yes") {
    issue(
      ["salesReview", "availableInPuertoRico"],
      "Validated offerings must be available in Puerto Rico ('yes')",
    );
  }
  if (review.availableInPuertoRico === "no" && status !== "unavailable") {
    issue(["validationStatus"], "Items not available in Puerto Rico must be marked 'unavailable'");
  }
  if (review.decision === "remove" && status !== "unavailable") {
    issue(["validationStatus"], "Items the sales team removed must be marked 'unavailable'");
  }
  if (
    status === "validated" &&
    review.decision === "rename" &&
    review.proposedName !== null &&
    (review.proposedName.es !== item.name.es || review.proposedName.en !== item.name.en)
  ) {
    issue([namePath], "Validated rename: the displayed name must match salesReview.proposedName");
  }
}
