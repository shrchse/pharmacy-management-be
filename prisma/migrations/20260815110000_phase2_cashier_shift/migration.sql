ALTER TABLE "CashierSession"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'OPEN',
  ADD COLUMN IF NOT EXISTS "depositAmount" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "depositedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verifiedById" TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verificationNotes" TEXT;

CREATE INDEX IF NOT EXISTS "CashierSession_tenantId_branchId_status_idx"
  ON "CashierSession" ("tenantId", "branchId", "status");
