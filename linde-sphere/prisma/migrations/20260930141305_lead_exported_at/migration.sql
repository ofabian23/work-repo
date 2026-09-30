-- Export marker for the local administration utility (ADR-056). A plain ADD COLUMN: the Lead table is not
-- redefined, so its hand-written "_check" constraints stay in place.

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "exportedAt" DATETIME;

-- CreateIndex
CREATE INDEX "Lead_exportedAt_idx" ON "Lead"("exportedAt");
