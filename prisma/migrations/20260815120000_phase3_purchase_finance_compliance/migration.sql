ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "apjPinHash" TEXT;

CREATE TABLE IF NOT EXISTS "PurchaseApproval" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "approverId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseApproval_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PurchaseApproval_tenantId_branchId_purchaseId_idx"
  ON "PurchaseApproval" ("tenantId", "branchId", "purchaseId");

CREATE INDEX IF NOT EXISTS "PurchaseApproval_tenantId_branchId_status_idx"
  ON "PurchaseApproval" ("tenantId", "branchId", "status");

CREATE TABLE IF NOT EXISTS "License" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "holderName" TEXT,
    "number" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "License_tenantId_code_key"
  ON "License" ("tenantId", "code");

CREATE INDEX IF NOT EXISTS "License_tenantId_branchId_type_expiredAt_idx"
  ON "License" ("tenantId", "branchId", "type", "expiredAt");

CREATE INDEX IF NOT EXISTS "License_tenantId_status_idx"
  ON "License" ("tenantId", "status");

CREATE TABLE IF NOT EXISTS "PractitionerLicense" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "practitionerName" TEXT NOT NULL,
    "profession" TEXT NOT NULL DEFAULT 'APOTEKER',
    "licenseType" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PractitionerLicense_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PractitionerLicense_tenantId_number_key"
  ON "PractitionerLicense" ("tenantId", "number");

CREATE INDEX IF NOT EXISTS "PractitionerLicense_tenantId_branchId_licenseType_expiredAt_idx"
  ON "PractitionerLicense" ("tenantId", "branchId", "licenseType", "expiredAt");

CREATE INDEX IF NOT EXISTS "PractitionerLicense_tenantId_status_idx"
  ON "PractitionerLicense" ("tenantId", "status");

DO $$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'PurchaseApproval',
        'License',
        'PractitionerLicense'
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
