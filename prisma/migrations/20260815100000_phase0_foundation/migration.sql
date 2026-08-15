-- Phase 0 foundation: idempotency key storage and tenant-scoped RLS baseline.
-- The application must set app.tenant_id, and optionally app.branch_id, before
-- relying on these policies as a second layer of isolation.

CREATE TABLE IF NOT EXISTS "IdempotencyKey" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "userId" TEXT,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "responseBody" JSONB,
    "statusCode" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IdempotencyKey_tenantId_branchId_key_key"
    ON "IdempotencyKey" ("tenantId", "branchId", "key");

CREATE INDEX IF NOT EXISTS "IdempotencyKey_tenantId_status_createdAt_idx"
    ON "IdempotencyKey" ("tenantId", "status", "createdAt");

DO $$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'TenantFeature',
        'TenantPolicy',
        'Branch',
        'User',
        'Role',
        'AuditLog',
        'SupervisorAuthorization',
        'IdempotencyKey',
        'Category',
        'Unit',
        'Product',
        'StockLocation',
        'ProductBatch',
        'StockLedger',
        'StockAlert',
        'ExpiredStockAction',
        'StockOpname',
        'StockOpnameItem',
        'CashierSession',
        'Customer',
        'Sale',
        'SaleItem',
        'SalePayment',
        'RejectedSale',
        'SaleReturn',
        'SaleReturnItem',
        'Doctor',
        'Prescription',
        'PrescriptionItem',
        'PrescriptionLabel',
        'PrescriptionCopy',
        'MedicalRecord',
        'Supplier',
        'SupplierProductPrice',
        'Purchase',
        'PurchaseItem',
        'PurchaseReturn',
        'PurchaseReturnItem',
        'Debt',
        'DebtPayment',
        'Receivable',
        'ReceivablePayment',
        'CashAccount',
        'CashMutation',
        'Expense',
        'ChartOfAccount',
        'JournalEntry',
        'EmployeeProfile',
        'ShiftSchedule',
        'Attendance',
        'PurchasePlan',
        'PurchasePlanItem',
        'AnalyticsSnapshot',
        'OfflineDevice',
        'SyncQueue',
        'SyncConflict'
    ]
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_name);
        EXECUTE format(
            'CREATE POLICY tenant_isolation ON %I USING ("tenantId" = current_setting(''app.tenant_id'', true)) WITH CHECK ("tenantId" = current_setting(''app.tenant_id'', true))',
            table_name
        );
    END LOOP;
END $$;
