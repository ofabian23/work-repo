-- Report storage and delivery history (ADR-054).
-- EmailDelivery is redefined (SQLite cannot alter a CHECK constraint): the provider value 'file' is renamed
-- to 'preview' (DevelopmentPreviewProvider) and the claimedAt column is added. All hand-written "_check"
-- constraints are re-created; tests/unit/db/schema-constraints.test.ts fails if any disappears.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- RedefineTable
CREATE TABLE "new_EmailDelivery" (
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
    "claimedAt" DATETIME,
    CONSTRAINT "EmailDelivery_provider_check" CHECK ("provider" IN ('preview', 'smtp', 'graph')),
    CONSTRAINT "EmailDelivery_status_check" CHECK ("status" IN ('pending', 'sent', 'failed', 'retrying')),
    CONSTRAINT "EmailDelivery_attempts_check" CHECK ("attempts" >= 0),
    CONSTRAINT "EmailDelivery_errorCode_check" CHECK ("errorCode" IS NULL OR ("errorCode" NOT GLOB '*[^A-Z0-9_]*' AND length("errorCode") BETWEEN 2 AND 40)),
    CONSTRAINT "EmailDelivery_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EmailDelivery" ("id", "createdAt", "updatedAt", "leadId", "provider", "status", "attempts", "lastAttemptAt", "nextAttemptAt", "providerMessageId", "errorCode")
SELECT "id", "createdAt", "updatedAt", "leadId", CASE "provider" WHEN 'file' THEN 'preview' ELSE "provider" END, "status", "attempts", "lastAttemptAt", "nextAttemptAt", "providerMessageId", "errorCode" FROM "EmailDelivery";
DROP TABLE "EmailDelivery";
ALTER TABLE "new_EmailDelivery" RENAME TO "EmailDelivery";
CREATE INDEX "EmailDelivery_status_nextAttemptAt_idx" ON "EmailDelivery"("status", "nextAttemptAt");
CREATE INDEX "EmailDelivery_leadId_idx" ON "EmailDelivery"("leadId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateTable
CREATE TABLE "EmailDeliveryEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deliveryId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorCode" TEXT,
    "providerMessageId" TEXT,
    CONSTRAINT "EmailDeliveryEvent_eventType_check" CHECK ("eventType" IN ('queued', 'attempt_started', 'sent', 'attempt_failed', 'retry_scheduled', 'gave_up', 'manual_retry')),
    CONSTRAINT "EmailDeliveryEvent_attempt_check" CHECK ("attempt" >= 0),
    CONSTRAINT "EmailDeliveryEvent_errorCode_check" CHECK ("errorCode" IS NULL OR ("errorCode" NOT GLOB '*[^A-Z0-9_]*' AND length("errorCode") BETWEEN 2 AND 40)),
    CONSTRAINT "EmailDeliveryEvent_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "EmailDelivery" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "language" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "contentVersion" TEXT NOT NULL,
    "copyVersion" TEXT NOT NULL,
    CONSTRAINT "Report_language_check" CHECK ("language" IN ('es', 'en')),
    CONSTRAINT "Report_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EmailDeliveryEvent_deliveryId_occurredAt_idx" ON "EmailDeliveryEvent"("deliveryId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Report_leadId_key" ON "Report"("leadId");
