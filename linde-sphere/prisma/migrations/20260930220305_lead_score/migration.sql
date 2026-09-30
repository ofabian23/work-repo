-- Internal lead score (PROJECT_BRIEF M12, ARCHITECTURE §8). Server-only; never sent to the kiosk or report.
-- Hand-written with ADD COLUMN instead of Prisma's table redefinition, so the hand-added CHECK constraints
-- on "Lead" (status, source, language, report consent) are kept. New CHECKs back up the score's range.
ALTER TABLE "Lead" ADD COLUMN "leadScore" INTEGER NOT NULL DEFAULT 0 CONSTRAINT "Lead_leadScore_check" CHECK ("leadScore" BETWEEN 0 AND 100);
ALTER TABLE "Lead" ADD COLUMN "leadTier" TEXT NOT NULL DEFAULT 'C' CONSTRAINT "Lead_leadTier_check" CHECK ("leadTier" IN ('A', 'B', 'C'));
ALTER TABLE "Lead" ADD COLUMN "leadScoreFactors" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Lead" ADD COLUMN "leadScoringVersion" TEXT NOT NULL DEFAULT 'none';
