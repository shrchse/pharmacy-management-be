-- Global reference masters and tenant product activation.
-- Product remains the MVP1 operational compatibility model. Product.catalogId
-- links each tenant's operational product projection to one global catalog item.

CREATE TABLE "CategoryCatalog" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CategoryType" NOT NULL DEFAULT 'OBAT_BEBAS',
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CategoryCatalog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CategoryCatalog_code_key" ON "CategoryCatalog"("code");

CREATE TABLE "UnitCatalog" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UnitCatalog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UnitCatalog_code_key" ON "UnitCatalog"("code");

CREATE TABLE "ProductCatalog" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "globalCode" TEXT NOT NULL,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "genericName" TEXT,
    "brandName" TEXT,
    "registrationNumber" TEXT,
    "dosageForm" TEXT,
    "strength" TEXT,
    "composition" TEXT,
    "manufacturer" TEXT,
    "principal" TEXT,
    "productType" "ProductType" NOT NULL DEFAULT 'MEDICINE',
    "controlledClass" "ControlledDrugClass" NOT NULL DEFAULT 'NONE',
    "categoryCatalogId" TEXT,
    "defaultUnitCatalogId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductCatalog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductCatalog_globalCode_key" ON "ProductCatalog"("globalCode");
CREATE INDEX "ProductCatalog_barcode_idx" ON "ProductCatalog"("barcode");
CREATE INDEX "ProductCatalog_name_idx" ON "ProductCatalog"("name");
CREATE INDEX "ProductCatalog_genericName_idx" ON "ProductCatalog"("genericName");

ALTER TABLE "Product" ADD COLUMN "catalogId" TEXT;
CREATE INDEX "Product_catalogId_idx" ON "Product"("catalogId");

CREATE TABLE "TenantProduct" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenantId" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "customName" TEXT,
    "minStock" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenantProduct_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TenantProduct_productId_key" ON "TenantProduct"("productId");
CREATE UNIQUE INDEX "TenantProduct_tenantId_catalogId_key" ON "TenantProduct"("tenantId", "catalogId");
CREATE INDEX "TenantProduct_tenantId_isActive_idx" ON "TenantProduct"("tenantId", "isActive");

CREATE TABLE "LicenseType" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LicenseType_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LicenseType_code_key" ON "LicenseType"("code");

INSERT INTO "CategoryCatalog" ("code", "name", "type") VALUES
    ('OBAT_BEBAS', 'Obat Bebas', 'OBAT_BEBAS'),
    ('OBAT_BEBAS_TERBATAS', 'Obat Bebas Terbatas', 'OBAT_BEBAS_TERBATAS'),
    ('OBAT_KERAS', 'Obat Keras', 'OBAT_KERAS'),
    ('PSIKOTROPIKA', 'Psikotropika', 'PSIKOTROPIKA'),
    ('NARKOTIKA', 'Narkotika', 'NARKOTIKA'),
    ('ALKES', 'Alat Kesehatan', 'ALKES'),
    ('BMHP', 'Bahan Medis Habis Pakai', 'BMHP'),
    ('KOSMETIK', 'Kosmetik', 'KOSMETIK'),
    ('UMUM', 'Umum', 'UMUM')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "UnitCatalog" ("code", "name") VALUES
    ('TAB', 'Tablet'),
    ('KAP', 'Kapsul'),
    ('STRIP', 'Strip'),
    ('BOX', 'Box'),
    ('BOTOL', 'Botol'),
    ('TUBE', 'Tube'),
    ('ML', 'Milliliter'),
    ('PCS', 'Pieces')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "LicenseType" ("code", "name") VALUES
    ('SIA', 'Surat Izin Apotek'),
    ('SIPA', 'Surat Izin Praktik Apoteker'),
    ('STR', 'Surat Tanda Registrasi'),
    ('OPERASIONAL', 'Izin Operasional')
ON CONFLICT ("code") DO NOTHING;

ALTER TABLE "License" ADD COLUMN "licenseTypeId" TEXT;

ALTER TABLE "ProductCatalog" ADD CONSTRAINT "ProductCatalog_categoryCatalogId_fkey"
    FOREIGN KEY ("categoryCatalogId") REFERENCES "CategoryCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductCatalog" ADD CONSTRAINT "ProductCatalog_defaultUnitCatalogId_fkey"
    FOREIGN KEY ("defaultUnitCatalogId") REFERENCES "UnitCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_catalogId_fkey"
    FOREIGN KEY ("catalogId") REFERENCES "ProductCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TenantProduct" ADD CONSTRAINT "TenantProduct_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantProduct" ADD CONSTRAINT "TenantProduct_catalogId_fkey"
    FOREIGN KEY ("catalogId") REFERENCES "ProductCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantProduct" ADD CONSTRAINT "TenantProduct_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "License" ADD CONSTRAINT "License_licenseTypeId_fkey"
    FOREIGN KEY ("licenseTypeId") REFERENCES "LicenseType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TenantProduct" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "TenantProduct"
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
