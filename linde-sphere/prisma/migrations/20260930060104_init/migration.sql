-- Initial Linde Sphere schema (ADR-052).
-- Hand-added CHECK constraints (marked "_check") back up the Prisma enums at the database level, because
-- SQLite stores enums as TEXT. Prisma does not model CHECK constraints: a future migration that redefines one
-- of these tables must re-add them (tests/unit/db/schema-constraints.test.ts fails if they disappear).

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "roleLabel" TEXT NOT NULL,
    "businessEmail" TEXT NOT NULL,
    "optionalPhone" TEXT,
    "preferredLanguage" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "reportConsent" BOOLEAN NOT NULL,
    "followUpConsent" BOOLEAN NOT NULL,
    "consentTextVersion" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'kiosk_lead_form',
    "status" TEXT NOT NULL DEFAULT 'active',
    "idempotencyKey" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "statusTokenHash" TEXT NOT NULL,
    "contentVersion" TEXT NOT NULL,
    CONSTRAINT "Lead_status_check" CHECK ("status" IN ('active', 'archived', 'erasure_requested')),
    CONSTRAINT "Lead_source_check" CHECK ("source" IN ('kiosk_lead_form')),
    CONSTRAINT "Lead_preferredLanguage_check" CHECK ("preferredLanguage" IN ('es', 'en')),
    CONSTRAINT "Lead_reportConsent_check" CHECK ("reportConsent" = 1),
    CONSTRAINT "Lead_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VisitorSessionSummary" ("sessionId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeadInterest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "relevance" TEXT,
    "sourceType" TEXT NOT NULL,
    CONSTRAINT "LeadInterest_category_check" CHECK ("category" IN ('role', 'challenge', 'solution')),
    CONSTRAINT "LeadInterest_relevance_check" CHECK ("relevance" IS NULL OR "relevance" IN ('high', 'medium', 'possible')),
    CONSTRAINT "LeadInterest_sourceType_check" CHECK ("sourceType" IN ('session_selection', 'explicit_interest', 'form_selection', 'recommendation')),
    CONSTRAINT "LeadInterest_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisitorSessionSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "selectedPersona" TEXT,
    "contentVersion" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SessionSummaryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "summaryId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "SessionSummaryItem_kind_check" CHECK ("kind" IN ('challenge', 'scene', 'hotspot', 'recommendation')),
    CONSTRAINT "SessionSummaryItem_position_check" CHECK ("position" >= 0),
    CONSTRAINT "SessionSummaryItem_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "VisitorSessionSummary" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "leadId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" DATETIME,
    "nextAttemptAt" DATETIME,
    "providerMessageId" TEXT,
    "errorCode" TEXT,
    CONSTRAINT "EmailDelivery_provider_check" CHECK ("provider" IN ('file', 'smtp', 'graph')),
    CONSTRAINT "EmailDelivery_status_check" CHECK ("status" IN ('pending', 'sent', 'failed', 'retrying')),
    CONSTRAINT "EmailDelivery_attempts_check" CHECK ("attempts" >= 0),
    CONSTRAINT "EmailDelivery_errorCode_check" CHECK ("errorCode" IS NULL OR ("errorCode" NOT GLOB '*[^A-Z0-9_]*' AND length("errorCode") BETWEEN 2 AND 40)),
    CONSTRAINT "EmailDelivery_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_idempotencyKey_key" ON "Lead"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_statusTokenHash_key" ON "Lead"("statusTokenHash");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE INDEX "Lead_sessionId_idx" ON "Lead"("sessionId");

-- CreateIndex
CREATE INDEX "Lead_businessEmail_idx" ON "Lead"("businessEmail");

-- CreateIndex
CREATE INDEX "LeadInterest_category_value_idx" ON "LeadInterest"("category", "value");

-- CreateIndex
CREATE UNIQUE INDEX "LeadInterest_leadId_category_value_sourceType_key" ON "LeadInterest"("leadId", "category", "value", "sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "VisitorSessionSummary_sessionId_key" ON "VisitorSessionSummary"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionSummaryItem_summaryId_kind_value_key" ON "SessionSummaryItem"("summaryId", "kind", "value");

-- CreateIndex
CREATE INDEX "EmailDelivery_status_nextAttemptAt_idx" ON "EmailDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "EmailDelivery_leadId_idx" ON "EmailDelivery"("leadId");
