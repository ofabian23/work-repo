-- Follow-up strategies (ADR-062). Hand-written with ADD COLUMN so the hand-added CHECK constraints on
-- "Lead" are kept; new CHECKs back up the Prisma enums (SQLite stores enums as TEXT).
ALTER TABLE "Lead" ADD COLUMN "followUpMode" TEXT NOT NULL DEFAULT 'LOCAL_PACKAGE' CONSTRAINT "Lead_followUpMode_check" CHECK ("followUpMode" IN ('LOCAL_PACKAGE', 'SMTP_EMAIL', 'MICROSOFT_GRAPH', 'OUTLOOK_DRAFT', 'FUTURE_CRM'));
ALTER TABLE "Lead" ADD COLUMN "followUpStatus" TEXT NOT NULL DEFAULT 'follow_up_pending' CONSTRAINT "Lead_followUpStatus_check" CHECK ("followUpStatus" IN ('follow_up_pending', 'exported'));
ALTER TABLE "Report" ADD COLUMN "payloadJson" TEXT;

-- Existing leads were stored when every lead was emailed: keep that history accurate.
UPDATE "Lead" SET "followUpMode" = 'SMTP_EMAIL' WHERE "id" IN (SELECT "leadId" FROM "EmailDelivery");
UPDATE "Lead" SET "followUpStatus" = 'exported' WHERE "exportedAt" IS NOT NULL;
