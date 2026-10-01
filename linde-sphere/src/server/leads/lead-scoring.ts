import "server-only";

/**
 * Internal commercial lead score (PROJECT_BRIEF M12, ARCHITECTURE §8, ADR-009). Server-only: stored on the
 * lead, shown only in the local admin utility and the CSV export. Never returned to the kiosk, rendered in
 * the kiosk or included in the visitor's report (AC-16).
 *
 * The weights below are a PROJECT-TEAM ASSUMPTION pending Puerto Rico sales validation
 * (SALES_VALIDATION_GUIDE.md, RELEASE_READINESS.md). The score only orders follow-up work; it is never a
 * statement about the visitor. Changing a weight bumps LEAD_SCORING_VERSION, which is stored with each lead.
 */
export const LEAD_SCORING_VERSION = "0.1.0-assumed";

/** Buying influence usually associated with each role (points). Unknown roles get `default`. */
const ROLE_POINTS: Record<string, number> & { default: number } = {
  executive: 20,
  "procurement-supply": 18,
  "operations-facilities": 15,
  "government-system": 15,
  finance: 12,
  "quality-compliance": 10,
  "clinical-respiratory": 10,
  "technology-biomed": 10,
  "ambulatory-homecare": 10,
  "multiple-areas": 8,
  "academia-research": 6,
  default: 5,
};

export const LEAD_SCORING = {
  rolePoints: ROLE_POINTS,
  perChallenge: 5,
  maxChallenges: 15,
  perExplicitInterest: 5,
  maxExplicitInterests: 15,
  perMeaningfulHotspot: 2,
  maxEngagement: 15,
  facilityTypeKnown: 5,
  followUpConsent: 20,
  /** Personal mailbox instead of an organization address: follow-up is less likely to reach a buyer. */
  personalEmailDomain: -10,
  tiers: { A: 60, B: 35 },
} as const;

const PERSONAL_DOMAINS = new Set([
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
]);

export type LeadTier = "A" | "B" | "C";
export type LeadScoreFactor = { code: string; points: number };
export type LeadScore = { score: number; tier: LeadTier; factors: LeadScoreFactor[]; version: string };

export type LeadScoreInput = {
  /** Role chosen on the form (always present). */
  roleId: string;
  challengeCount: number;
  explicitInterestCount: number;
  /** Distinct information/solution hotspots opened (navigation excluded, repeats counted once). */
  meaningfulHotspots: number;
  facilityTypeKnown: boolean;
  followUpConsent: boolean;
  email: string;
};

export function scoreLead(input: LeadScoreInput): LeadScore {
  const w = LEAD_SCORING;
  const factors: LeadScoreFactor[] = [];
  const add = (code: string, points: number) => {
    if (points !== 0) factors.push({ code, points });
  };
  add(`role:${input.roleId}`, w.rolePoints[input.roleId] ?? ROLE_POINTS.default);
  add("challenges", Math.min(Math.max(input.challengeCount, 0) * w.perChallenge, w.maxChallenges));
  add(
    "explicit_interests",
    Math.min(Math.max(input.explicitInterestCount, 0) * w.perExplicitInterest, w.maxExplicitInterests),
  );
  add(
    "engagement",
    Math.min(Math.max(input.meaningfulHotspots, 0) * w.perMeaningfulHotspot, w.maxEngagement),
  );
  if (input.facilityTypeKnown) add("facility_type", w.facilityTypeKnown);
  if (input.followUpConsent) add("follow_up_consent", w.followUpConsent);
  const domain = input.email.split("@")[1]?.trim().toLowerCase() ?? "";
  if (PERSONAL_DOMAINS.has(domain)) add("personal_email_domain", w.personalEmailDomain);

  const raw = factors.reduce((sum, f) => sum + f.points, 0);
  const score = Math.min(100, Math.max(0, raw));
  const tier: LeadTier = score >= w.tiers.A ? "A" : score >= w.tiers.B ? "B" : "C";
  return { score, tier, factors, version: LEAD_SCORING_VERSION };
}
