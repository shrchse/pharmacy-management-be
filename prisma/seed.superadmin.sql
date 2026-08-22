-- MVP 1 local seed data.
-- Run after migrations are applied:
--   npx prisma db execute --file prisma/seed.superadmin.sql
--
-- Demo login:
--   superadmin@apotek.local / Password123!

BEGIN;

SELECT set_config('app.tenant_id', '20000000-0000-4000-8000-000000000001', true);
SELECT set_config('app.branch_id', '20000000-0000-4000-8000-000000000011', true);

INSERT INTO "Plan" (
  "id", "code", "name", "description", "priceMonthly", "priceYearly",
  "maxBranches", "maxUsers", "features", "isActive", "createdAt", "updatedAt"
) VALUES (
  '10000000-0000-4000-8000-000000000001',
  'MVP1_LOCAL',
  'MVP 1 Local',
  'Local development plan with all MVP 1 modules enabled',
  0,
  0,
  5,
  50,
  '["inventory","purchasing","finance","multi_outlet","resep","crm","hrd","sop"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "features" = EXCLUDED."features",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Tenant" (
  "id", "planId", "name", "slug", "email", "phone", "address", "taxId",
  "timezone", "currency", "subscriptionStatus", "trialEndsAt", "subscriptionEndsAt",
  "isDemo", "createdAt", "updatedAt"
) VALUES (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Apotek MVP 1 Local',
  'apotek-mvp1-local',
  'superadmin@apotek.local',
  '021-555-0101',
  'Jl. Kesehatan No. 1, Jakarta',
  '09.123.456.7-001.000',
  'Asia/Jakarta',
  'IDR',
  'ACTIVE',
  CURRENT_TIMESTAMP + INTERVAL '14 days',
  CURRENT_TIMESTAMP + INTERVAL '365 days',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO UPDATE SET
  "planId" = EXCLUDED."planId",
  "name" = EXCLUDED."name",
  "email" = EXCLUDED."email",
  "phone" = EXCLUDED."phone",
  "address" = EXCLUDED."address",
  "taxId" = EXCLUDED."taxId",
  "subscriptionStatus" = EXCLUDED."subscriptionStatus",
  "subscriptionEndsAt" = EXCLUDED."subscriptionEndsAt",
  "isDemo" = EXCLUDED."isDemo",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "TenantFeature" ("id", "tenantId", "code", "enabled", "config", "createdAt", "updatedAt") VALUES
  ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'inventory', true, '{"minStockAlert":true}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('21000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'purchasing', true, '{"apjApproval":true}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('21000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'finance', true, '{"cashFlow":true}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('21000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', 'multi_outlet', true, '{"maxBranches":5}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('21000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', 'resep', true, '{"labelPrint":true}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('21000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000001', 'crm', true, '{"loyalty":true}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('21000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000001', 'hrd', true, '{"attendance":true}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('21000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000001', 'sop', true, '{"auditTrail":true}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("tenantId", "code") DO UPDATE SET
  "enabled" = EXCLUDED."enabled",
  "config" = EXCLUDED."config",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "TenantPolicy" ("id", "tenantId", "code", "value", "createdAt", "updatedAt") VALUES
  ('22000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'crm.tiers', '[{"name":"PLATINUM","minSpent":10000000},{"name":"GOLD","minSpent":5000000},{"name":"SILVER","minSpent":1000000},{"name":"BASIC","minSpent":0}]'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('22000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'inventory.expiryReminderDays', '90'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('22000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'pos.requireOpenShift', 'true'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("tenantId", "code") DO UPDATE SET
  "value" = EXCLUDED."value",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Branch" (
  "id", "tenantId", "code", "name", "businessCategory", "status", "phone",
  "address", "siaNumber", "apjName", "apjSipaNumber", "openingHours",
  "createdAt", "updatedAt"
) VALUES
  ('20000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000001', 'MAIN', 'Cabang Utama', 'APOTEK', 'ACTIVE', '021-555-0111', 'Jl. Kesehatan No. 1, Jakarta', 'SIA-MVP1-001', 'Apt. Andini Rahma', 'SIPA-MVP1-001', '{"mon_fri":"08:00-21:00","sat_sun":"09:00-18:00"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000001', 'WH', 'Gudang Pembantu', 'DISTRIBUTOR', 'ACTIVE', '021-555-0112', 'Jl. Logistik No. 2, Jakarta', 'SIA-MVP1-002', 'Apt. Bima Pratama', 'SIPA-MVP1-002', '{"mon_fri":"08:00-17:00"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("tenantId", "code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "businessCategory" = EXCLUDED."businessCategory",
  "status" = EXCLUDED."status",
  "phone" = EXCLUDED."phone",
  "address" = EXCLUDED."address",
  "siaNumber" = EXCLUDED."siaNumber",
  "apjName" = EXCLUDED."apjName",
  "apjSipaNumber" = EXCLUDED."apjSipaNumber",
  "openingHours" = EXCLUDED."openingHours",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Permission" ("id", "code", "name", "category") VALUES
  ('31000000-0000-4000-8000-000000000001', 'tenant.manage', 'Manage tenant', 'Tenant'),
  ('31000000-0000-4000-8000-000000000002', 'branch.manage', 'Manage branches', 'Tenant'),
  ('31000000-0000-4000-8000-000000000003', 'user.manage', 'Manage users', 'Access Control'),
  ('31000000-0000-4000-8000-000000000004', 'role.manage', 'Manage roles', 'Access Control'),
  ('31000000-0000-4000-8000-000000000005', 'product.manage', 'Manage products', 'Inventory'),
  ('31000000-0000-4000-8000-000000000017', 'prescription.manage', 'Manage prescriptions', 'Pharmacy'),
  ('31000000-0000-4000-8000-000000000006', 'stock.read', 'Read stock', 'Inventory'),
  ('31000000-0000-4000-8000-000000000007', 'stock.adjust', 'Adjust stock', 'Inventory'),
  ('31000000-0000-4000-8000-000000000008', 'pos.checkout', 'POS checkout', 'POS'),
  ('31000000-0000-4000-8000-000000000009', 'sale.return', 'Process sale returns', 'POS'),
  ('31000000-0000-4000-8000-000000000010', 'purchase.manage', 'Manage purchases', 'Purchasing'),
  ('31000000-0000-4000-8000-000000000011', 'finance.manage', 'Manage finance', 'Finance'),
  ('31000000-0000-4000-8000-000000000012', 'compliance.manage', 'Manage compliance and licenses', 'Compliance'),
  ('31000000-0000-4000-8000-000000000013', 'report.read', 'Read reports', 'Reporting'),
  ('31000000-0000-4000-8000-000000000014', 'audit.read', 'Read audit logs', 'Audit'),
  ('31000000-0000-4000-8000-000000000015', 'internal.tenant.manage', 'Manage tenants from internal console', 'Internal'),
  ('31000000-0000-4000-8000-000000000016', 'master-data.manage', 'Manage master data', 'Master Data')
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "category" = EXCLUDED."category";

INSERT INTO "Role" ("id", "tenantId", "name", "description", "isSystem", "createdAt", "updatedAt") VALUES
  ('32000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'OWNER', 'Tenant owner with full MVP 1 access', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('32000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'APJ', 'Apoteker penanggung jawab', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('32000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'CASHIER', 'Cashier and sales operator', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('32000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', 'ADMIN', 'Branch admin with operational MVP 1 access', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('32000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', 'SUPER_ADMIN', 'Internal super admin with all permissions', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("tenantId", "name") DO UPDATE SET
  "description" = EXCLUDED."description",
  "isSystem" = EXCLUDED."isSystem",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT '32000000-0000-4000-8000-000000000001', "id" FROM "Permission"
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT '32000000-0000-4000-8000-000000000002', "id" FROM "Permission"
WHERE "code" IN ('product.manage', 'prescription.manage', 'stock.read', 'stock.adjust', 'pos.checkout', 'sale.return', 'purchase.manage', 'compliance.manage', 'report.read')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT '32000000-0000-4000-8000-000000000003', "id" FROM "Permission"
WHERE "code" IN ('stock.read', 'pos.checkout', 'sale.return')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT '32000000-0000-4000-8000-000000000004', "id" FROM "Permission"
WHERE "code" IN (
  'branch.manage',
  'user.manage',
  'product.manage',
  'stock.read',
  'stock.adjust',
  'pos.checkout',
  'sale.return',
  'purchase.manage',
  'finance.manage',
  'compliance.manage',
  'report.read',
  'audit.read',
  'master-data.manage'
)
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT '32000000-0000-4000-8000-000000000005', "id" FROM "Permission"
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "User" (
  "id", "tenantId", "branchId", "roleId", "name", "email", "phone",
  "passwordHash", "apjPinHash", "sipaNumber", "status", "createdAt", "updatedAt"
) VALUES
  ('33000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', '32000000-0000-4000-8000-000000000005', 'Super Admin', 'superadmin@apotek.local', '081100000005', '$2b$10$93UIDoXKup.A8RyW1xgxsOOFP57sTgGfdQe53mLXguvueZctFCoHq', NULL, NULL, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("tenantId", "email") DO UPDATE SET
  "branchId" = EXCLUDED."branchId",
  "roleId" = EXCLUDED."roleId",
  "name" = EXCLUDED."name",
  "phone" = EXCLUDED."phone",
  "passwordHash" = EXCLUDED."passwordHash",
  "apjPinHash" = EXCLUDED."apjPinHash",
  "sipaNumber" = EXCLUDED."sipaNumber",
  "status" = EXCLUDED."status",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Category" ("id", "tenantId", "name", "type", "createdAt", "updatedAt") VALUES
  ('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Obat Bebas', 'OBAT_BEBAS', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'Obat Keras', 'OBAT_KERAS', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('40000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'Alat Kesehatan', 'ALKES', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('40000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', 'Racikan', 'UMUM', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("tenantId", "name", "type") DO UPDATE SET
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Unit" ("id", "tenantId", "name", "code", "createdAt", "updatedAt") VALUES
  ('41000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Tablet', 'TAB', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('41000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'Strip', 'STRIP', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('41000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'Botol', 'BTL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('41000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', 'Box', 'BOX', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('41000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', 'Paket', 'PKT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("tenantId", "code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Supplier" (
  "id", "tenantId", "code", "name", "type", "email", "phone", "address",
  "taxId", "contactPerson", "createdAt", "updatedAt"
) VALUES
  ('50000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'SUP-PBF-001', 'PBF Sehat Sentosa', 'PBF', 'sales@pbfsehat.local', '021-555-0201', 'Kawasan Farmasi Blok A1', '01.222.333.4-001.000', 'Rina', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('50000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'SUP-ALKES-001', 'Distributor Alkes Nusantara', 'DISTRIBUTOR', 'order@alkesnusantara.local', '021-555-0202', 'Jl. Alkes No. 8', '01.222.333.4-002.000', 'Dimas', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("tenantId", "code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "type" = EXCLUDED."type",
  "email" = EXCLUDED."email",
  "phone" = EXCLUDED."phone",
  "address" = EXCLUDED."address",
  "taxId" = EXCLUDED."taxId",
  "contactPerson" = EXCLUDED."contactPerson",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Product" (
  "id", "tenantId", "categoryId", "defaultSupplierId", "code", "barcode", "name",
  "genericName", "brandName", "registrationNumber", "dosageForm", "strength",
  "composition", "manufacturer", "principal", "productType", "controlledClass",
  "requiresPrescription", "minStock", "maxStock", "status", "createdAt", "updatedAt"
) VALUES
  ('60000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'PRD-PCT-500', '8997000000011', 'Paracetamol 500 mg', 'Paracetamol', 'Generik', 'DBL0000000010A1', 'Tablet', '500 mg', 'Paracetamol 500 mg', 'PT Farmasi Lokal', 'PT Farmasi Lokal', 'MEDICINE', 'NONE', false, 50, 500, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('60000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', 'PRD-AMX-500', '8997000000028', 'Amoxicillin 500 mg', 'Amoxicillin', 'Generik', 'DKL0000000020A1', 'Kapsul', '500 mg', 'Amoxicillin trihydrate 500 mg', 'PT Antibiotik Farma', 'PT Antibiotik Farma', 'MEDICINE', 'OBAT_KERAS', true, 30, 300, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('60000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000002', 'PRD-MSK-3PLY', '8997000000035', 'Masker Medis 3 Ply', 'Masker Medis', 'Nusamed', 'AKL0000000030A1', NULL, NULL, 'Disposable medical mask', 'PT Alkes Lokal', 'PT Alkes Lokal', 'MEDICAL_DEVICE', 'NONE', false, 20, 1000, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('60000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000004', NULL, 'PRD-RCK-BATUK', NULL, 'Racikan Batuk Dewasa', 'Racikan batuk', 'Formula Internal', NULL, 'Puyer', NULL, 'CTM, GG, dan bahan pendukung sesuai resep', 'Apotek MVP 1 Local', 'Apotek MVP 1 Local', 'COMPOUND', 'OBAT_KERAS', true, 0, NULL, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("tenantId", "code") DO UPDATE SET
  "categoryId" = EXCLUDED."categoryId",
  "defaultSupplierId" = EXCLUDED."defaultSupplierId",
  "barcode" = EXCLUDED."barcode",
  "name" = EXCLUDED."name",
  "genericName" = EXCLUDED."genericName",
  "brandName" = EXCLUDED."brandName",
  "registrationNumber" = EXCLUDED."registrationNumber",
  "dosageForm" = EXCLUDED."dosageForm",
  "strength" = EXCLUDED."strength",
  "composition" = EXCLUDED."composition",
  "manufacturer" = EXCLUDED."manufacturer",
  "principal" = EXCLUDED."principal",
  "productType" = EXCLUDED."productType",
  "controlledClass" = EXCLUDED."controlledClass",
  "requiresPrescription" = EXCLUDED."requiresPrescription",
  "minStock" = EXCLUDED."minStock",
  "maxStock" = EXCLUDED."maxStock",
  "status" = EXCLUDED."status",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "ProductUnit" (
  "id", "productId", "unitId", "barcode", "conversion", "isBaseUnit",
  "sellingPrice", "purchasePrice"
) VALUES
  ('61000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', '8997000000011', 1, true, 1500, 900),
  ('61000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000002', '8997000000012', 10, false, 14000, 9000),
  ('61000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000001', '8997000000028', 1, true, 2500, 1500),
  ('61000000-0000-4000-8000-000000000004', '60000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000002', '8997000000029', 10, false, 24000, 15000),
  ('61000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000003', '41000000-0000-4000-8000-000000000004', '8997000000035', 50, true, 35000, 21000),
  ('61000000-0000-4000-8000-000000000006', '60000000-0000-4000-8000-000000000004', '41000000-0000-4000-8000-000000000005', NULL, 1, true, 45000, 28000)
ON CONFLICT ("productId", "unitId") DO UPDATE SET
  "barcode" = EXCLUDED."barcode",
  "conversion" = EXCLUDED."conversion",
  "isBaseUnit" = EXCLUDED."isBaseUnit",
  "sellingPrice" = EXCLUDED."sellingPrice",
  "purchasePrice" = EXCLUDED."purchasePrice";

INSERT INTO "StockLocation" ("id", "tenantId", "branchId", "code", "name", "type", "createdAt", "updatedAt") VALUES
  ('62000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', 'RACK-A1', 'Rak Obat Bebas A1', 'RACK', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('62000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', 'RACK-RX', 'Rak Obat Resep', 'RACK', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('62000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000012', 'WH-FAST', 'Gudang Fast Moving', 'WAREHOUSE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("branchId", "code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "type" = EXCLUDED."type",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "ProductBatch" (
  "id", "tenantId", "branchId", "productId", "locationId", "batchNumber",
  "expiredDate", "buyPrice", "stock", "reservedStock", "status", "createdAt", "updatedAt"
) VALUES
  ('63000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', '60000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', 'PCT-SEED-2027A', TIMESTAMP '2027-12-31 00:00:00', 900, 120, 0, 'AVAILABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('63000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', '60000000-0000-4000-8000-000000000002', '62000000-0000-4000-8000-000000000002', 'AMX-SEED-2026B', TIMESTAMP '2026-10-31 00:00:00', 1500, 24, 0, 'AVAILABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('63000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', '60000000-0000-4000-8000-000000000003', '62000000-0000-4000-8000-000000000001', 'MSK-SEED-2028A', TIMESTAMP '2028-06-30 00:00:00', 21000, 18, 0, 'AVAILABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('63000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000012', '60000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000003', 'PCT-WH-2027A', TIMESTAMP '2027-12-31 00:00:00', 880, 300, 0, 'AVAILABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("branchId", "productId", "batchNumber", "expiredDate") DO UPDATE SET
  "locationId" = EXCLUDED."locationId",
  "buyPrice" = EXCLUDED."buyPrice",
  "stock" = EXCLUDED."stock",
  "reservedStock" = EXCLUDED."reservedStock",
  "status" = EXCLUDED."status",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Customer" (
  "id", "tenantId", "memberNo", "name", "phone", "email", "address",
  "birthDate", "gender", "points", "createdAt", "updatedAt"
) VALUES
  ('70000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'MBR-SEED-001', 'Budi Santoso', '081200000001', 'budi@example.local', 'Jl. Melati No. 7', DATE '1990-05-12', 'MALE', 120, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('70000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'MBR-SEED-002', 'Sari Wulandari', '081200000002', 'sari@example.local', 'Jl. Mawar No. 9', DATE '1988-11-03', 'FEMALE', 450, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("tenantId", "memberNo") DO UPDATE SET
  "name" = EXCLUDED."name",
  "phone" = EXCLUDED."phone",
  "email" = EXCLUDED."email",
  "address" = EXCLUDED."address",
  "birthDate" = EXCLUDED."birthDate",
  "gender" = EXCLUDED."gender",
  "points" = EXCLUDED."points",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Doctor" ("id", "tenantId", "name", "sipNumber", "phone", "address", "createdAt", "updatedAt") VALUES
  ('71000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'dr. Citra Dewi', 'SIP-DOKTER-MVP1-001', '081300000001', 'Klinik Sehat Bersama', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("tenantId", "sipNumber") DO UPDATE SET
  "name" = EXCLUDED."name",
  "phone" = EXCLUDED."phone",
  "address" = EXCLUDED."address",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "CashierSession" (
  "id", "tenantId", "branchId", "cashierId", "openedAt", "closedAt",
  "startingCash", "expectedCash", "actualCash", "difference", "status",
  "depositAmount", "depositedAt", "verifiedById", "verifiedAt",
  "verificationNotes", "notes"
) VALUES (
  '72000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000011',
  '33000000-0000-4000-8000-000000000005',
  CURRENT_TIMESTAMP - INTERVAL '1 day',
  CURRENT_TIMESTAMP - INTERVAL '20 hours',
  250000,
  338000,
  338000,
  0,
  'VERIFIED',
  338000,
  CURRENT_TIMESTAMP - INTERVAL '19 hours',
  '33000000-0000-4000-8000-000000000005',
  CURRENT_TIMESTAMP - INTERVAL '18 hours',
  'Seed shift verified',
  'Seeded closed shift for POS report'
)
ON CONFLICT ("id") DO UPDATE SET
  "expectedCash" = EXCLUDED."expectedCash",
  "actualCash" = EXCLUDED."actualCash",
  "difference" = EXCLUDED."difference",
  "status" = EXCLUDED."status",
  "depositAmount" = EXCLUDED."depositAmount",
  "depositedAt" = EXCLUDED."depositedAt",
  "verifiedById" = EXCLUDED."verifiedById",
  "verifiedAt" = EXCLUDED."verifiedAt",
  "verificationNotes" = EXCLUDED."verificationNotes",
  "notes" = EXCLUDED."notes";

INSERT INTO "Sale" (
  "id", "tenantId", "branchId", "invoiceNumber", "channel", "sessionId",
  "cashierId", "customerId", "saleType", "status", "paymentStatus",
  "totalAmount", "discountAmount", "taxAmount", "grandTotal", "paidAmount",
  "changeAmount", "receiptUrl", "receiptSentAt", "createdAt", "updatedAt"
) VALUES
  ('73000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', 'INV-SEED-REG-001', 'OFFLINE', '72000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000005', '70000000-0000-4000-8000-000000000001', 'REGULAR', 'COMPLETED', 'PAID', 80000, 2000, 0, 78000, 80000, 2000, '/receipts/INV-SEED-REG-001.pdf', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP),
  ('73000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', 'INV-SEED-CR-001', 'OFFLINE', '72000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000005', '70000000-0000-4000-8000-000000000002', 'REGULAR', 'COMPLETED', 'UNPAID', 150000, 0, 0, 150000, 0, 0, NULL, NULL, CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP),
  ('73000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', 'INV-SEED-RX-001', 'OFFLINE', '72000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000005', '70000000-0000-4000-8000-000000000001', 'PRESCRIPTION', 'COMPLETED', 'PAID', 49000, 0, 0, 49000, 50000, 1000, '/receipts/INV-SEED-RX-001.pdf', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP)
ON CONFLICT ("tenantId", "branchId", "invoiceNumber") DO UPDATE SET
  "sessionId" = EXCLUDED."sessionId",
  "cashierId" = EXCLUDED."cashierId",
  "customerId" = EXCLUDED."customerId",
  "saleType" = EXCLUDED."saleType",
  "status" = EXCLUDED."status",
  "paymentStatus" = EXCLUDED."paymentStatus",
  "totalAmount" = EXCLUDED."totalAmount",
  "discountAmount" = EXCLUDED."discountAmount",
  "taxAmount" = EXCLUDED."taxAmount",
  "grandTotal" = EXCLUDED."grandTotal",
  "paidAmount" = EXCLUDED."paidAmount",
  "changeAmount" = EXCLUDED."changeAmount",
  "receiptUrl" = EXCLUDED."receiptUrl",
  "receiptSentAt" = EXCLUDED."receiptSentAt",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "SaleItem" (
  "id", "tenantId", "saleId", "productId", "productUnitId", "batchId",
  "qty", "baseQty", "unitPrice", "discountAmount", "subtotal", "costAmount"
) VALUES
  ('73100000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000002', '63000000-0000-4000-8000-000000000001', 2, 20, 14000, 2000, 26000, 18000),
  ('73100000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000003', '61000000-0000-4000-8000-000000000005', '63000000-0000-4000-8000-000000000003', 2, 100, 27000, 0, 54000, 42000),
  ('73100000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000003', '61000000-0000-4000-8000-000000000005', '63000000-0000-4000-8000-000000000003', 5, 250, 30000, 0, 150000, 105000),
  ('73100000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000002', '61000000-0000-4000-8000-000000000003', '63000000-0000-4000-8000-000000000002', 10, 10, 2500, 0, 25000, 15000),
  ('73100000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000004', '61000000-0000-4000-8000-000000000006', NULL, 1, 1, 24000, 0, 24000, 15000)
ON CONFLICT ("id") DO UPDATE SET
  "qty" = EXCLUDED."qty",
  "baseQty" = EXCLUDED."baseQty",
  "unitPrice" = EXCLUDED."unitPrice",
  "discountAmount" = EXCLUDED."discountAmount",
  "subtotal" = EXCLUDED."subtotal",
  "costAmount" = EXCLUDED."costAmount";

INSERT INTO "SalePayment" ("id", "tenantId", "saleId", "method", "amount", "referenceNo", "paidAt") VALUES
  ('73200000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000001', 'CASH', 78000, 'CASH-SEED-001', CURRENT_TIMESTAMP - INTERVAL '1 day'),
  ('73200000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000003', 'QRIS', 49000, 'QRIS-SEED-RX-001', CURRENT_TIMESTAMP - INTERVAL '2 days')
ON CONFLICT ("id") DO UPDATE SET
  "method" = EXCLUDED."method",
  "amount" = EXCLUDED."amount",
  "referenceNo" = EXCLUDED."referenceNo",
  "paidAt" = EXCLUDED."paidAt";

INSERT INTO "Prescription" (
  "id", "tenantId", "branchId", "saleId", "prescriptionNumber", "source",
  "status", "repeatType", "repeatLimit", "redeemedCount", "doctorId",
  "customerId", "verifiedById", "attachmentUrl", "notes", "createdAt", "redeemedAt"
) VALUES
  ('74000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', NULL, 'RX-SEED-OPEN-001', 'MANUAL', 'RECEIVED', 'NONE', NULL, 0, '71000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000002', NULL, NULL, 'Seed prescription ready for verify/dispense test', CURRENT_TIMESTAMP - INTERVAL '3 hours', NULL),
  ('74000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', '73000000-0000-4000-8000-000000000003', 'RX-SEED-REDEEMED-001', 'MANUAL', 'REDEEMED', 'NONE', NULL, 1, '71000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000005', NULL, 'Seed prescription already dispensed', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days')
ON CONFLICT ("tenantId", "branchId", "prescriptionNumber") DO UPDATE SET
  "saleId" = EXCLUDED."saleId",
  "source" = EXCLUDED."source",
  "status" = EXCLUDED."status",
  "repeatType" = EXCLUDED."repeatType",
  "repeatLimit" = EXCLUDED."repeatLimit",
  "redeemedCount" = EXCLUDED."redeemedCount",
  "doctorId" = EXCLUDED."doctorId",
  "customerId" = EXCLUDED."customerId",
  "verifiedById" = EXCLUDED."verifiedById",
  "notes" = EXCLUDED."notes",
  "redeemedAt" = EXCLUDED."redeemedAt";

INSERT INTO "PrescriptionItem" (
  "id", "tenantId", "prescriptionId", "productId", "medicineName",
  "qtyRequired", "dosageInstruction", "labelText", "isCompounded"
) VALUES
  ('74100000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '74000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000002', 'Amoxicillin 500 mg', 15, '3 x sehari sesudah makan', 'Habiskan sesuai aturan pakai', false),
  ('74100000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '74000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000002', 'Amoxicillin 500 mg', 10, '3 x sehari sesudah makan', 'Habiskan sesuai aturan pakai', false),
  ('74100000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '74000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000004', 'Racikan Batuk Dewasa', 1, '1 bungkus malam hari', 'Kocok sebelum digunakan bila dilarutkan', true)
ON CONFLICT ("id") DO UPDATE SET
  "productId" = EXCLUDED."productId",
  "medicineName" = EXCLUDED."medicineName",
  "qtyRequired" = EXCLUDED."qtyRequired",
  "dosageInstruction" = EXCLUDED."dosageInstruction",
  "labelText" = EXCLUDED."labelText",
  "isCompounded" = EXCLUDED."isCompounded";

INSERT INTO "PrescriptionLabel" (
  "id", "tenantId", "prescriptionId", "patientName", "medicineName",
  "instruction", "quantityText", "printedAt", "createdAt"
) VALUES
  ('74200000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '74000000-0000-4000-8000-000000000001', 'Sari Wulandari', 'Amoxicillin 500 mg', '3 x sehari sesudah makan', '15 tablet', NULL, CURRENT_TIMESTAMP),
  ('74200000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '74000000-0000-4000-8000-000000000002', 'Budi Santoso', 'Racikan Batuk Dewasa', '1 bungkus malam hari', '1 paket', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days')
ON CONFLICT ("id") DO UPDATE SET
  "patientName" = EXCLUDED."patientName",
  "medicineName" = EXCLUDED."medicineName",
  "instruction" = EXCLUDED."instruction",
  "quantityText" = EXCLUDED."quantityText",
  "printedAt" = EXCLUDED."printedAt";

INSERT INTO "PrescriptionCopy" (
  "id", "tenantId", "prescriptionId", "copyNumber", "sourcePharmacyName",
  "destinationPharmacyName", "notes", "printedAt", "createdAt"
) VALUES (
  '74300000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '74000000-0000-4000-8000-000000000002',
  'COPY-RX-SEED-001',
  'Apotek MVP 1 Local',
  'Apotek Cabang Rujukan',
  'Copy resep seed',
  CURRENT_TIMESTAMP - INTERVAL '2 days',
  CURRENT_TIMESTAMP - INTERVAL '2 days'
)
ON CONFLICT ("tenantId", "copyNumber") DO UPDATE SET
  "sourcePharmacyName" = EXCLUDED."sourcePharmacyName",
  "destinationPharmacyName" = EXCLUDED."destinationPharmacyName",
  "notes" = EXCLUDED."notes",
  "printedAt" = EXCLUDED."printedAt";

INSERT INTO "MedicalRecord" (
  "id", "tenantId", "branchId", "customerId", "doctorId", "visitDate",
  "complaint", "diagnosisCode", "diagnosisText", "treatment", "notes"
) VALUES (
  '74400000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000011',
  '70000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000001',
  CURRENT_TIMESTAMP - INTERVAL '2 days',
  'Batuk dan demam',
  'J06.9',
  'ISPA ringan',
  'Terapi simptomatik dan antibiotik sesuai evaluasi dokter',
  'Seed RME'
)
ON CONFLICT ("id") DO UPDATE SET
  "complaint" = EXCLUDED."complaint",
  "diagnosisCode" = EXCLUDED."diagnosisCode",
  "diagnosisText" = EXCLUDED."diagnosisText",
  "treatment" = EXCLUDED."treatment",
  "notes" = EXCLUDED."notes";

INSERT INTO "SupplierProductPrice" (
  "id", "tenantId", "supplierId", "productId", "productUnitId", "price",
  "discount", "validFrom", "validUntil", "createdAt"
) VALUES
  ('75000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000002', 9000, 0, CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '90 days', CURRENT_TIMESTAMP),
  ('75000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000002', '61000000-0000-4000-8000-000000000004', 15000, 0, CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '90 days', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "price" = EXCLUDED."price",
  "discount" = EXCLUDED."discount",
  "validFrom" = EXCLUDED."validFrom",
  "validUntil" = EXCLUDED."validUntil";

INSERT INTO "Purchase" (
  "id", "tenantId", "branchId", "poNumber", "invoiceNo", "status", "supplierId",
  "staffId", "totalAmount", "discountAmount", "taxAmount", "grandTotal",
  "dueDate", "receivedAt", "createdAt", "updatedAt"
) VALUES
  ('76000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', 'PO-SEED-RECV-001', 'INV-PBF-SEED-001', 'RECEIVED', '50000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000005', 900000, 0, 99000, 999000, CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '20 days', CURRENT_TIMESTAMP - INTERVAL '21 days', CURRENT_TIMESTAMP),
  ('76000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', 'PO-SEED-DRAFT-001', NULL, 'DRAFT', '50000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000005', 150000, 0, 16500, 166500, CURRENT_TIMESTAMP + INTERVAL '14 days', NULL, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP)
ON CONFLICT ("tenantId", "branchId", "poNumber") DO UPDATE SET
  "invoiceNo" = EXCLUDED."invoiceNo",
  "status" = EXCLUDED."status",
  "supplierId" = EXCLUDED."supplierId",
  "staffId" = EXCLUDED."staffId",
  "totalAmount" = EXCLUDED."totalAmount",
  "discountAmount" = EXCLUDED."discountAmount",
  "taxAmount" = EXCLUDED."taxAmount",
  "grandTotal" = EXCLUDED."grandTotal",
  "dueDate" = EXCLUDED."dueDate",
  "receivedAt" = EXCLUDED."receivedAt",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "PurchaseItem" (
  "id", "tenantId", "purchaseId", "productId", "productUnitId", "batchId",
  "qty", "receivedQty", "baseQty", "buyPrice", "subtotal"
) VALUES
  ('76100000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '76000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000002', '63000000-0000-4000-8000-000000000001', 100, 100, 1000, 9000, 900000),
  ('76100000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '76000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000002', '61000000-0000-4000-8000-000000000004', NULL, 10, 0, 100, 15000, 150000)
ON CONFLICT ("id") DO UPDATE SET
  "batchId" = EXCLUDED."batchId",
  "qty" = EXCLUDED."qty",
  "receivedQty" = EXCLUDED."receivedQty",
  "baseQty" = EXCLUDED."baseQty",
  "buyPrice" = EXCLUDED."buyPrice",
  "subtotal" = EXCLUDED."subtotal";

INSERT INTO "PurchaseApproval" (
  "id", "tenantId", "branchId", "purchaseId", "requestedById", "approverId",
  "status", "notes", "approvedAt", "rejectedAt", "createdAt"
) VALUES
  ('76200000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', '76000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000005', '33000000-0000-4000-8000-000000000005', 'APPROVED', 'Seed received PO approval', CURRENT_TIMESTAMP - INTERVAL '20 days', NULL, CURRENT_TIMESTAMP - INTERVAL '21 days'),
  ('76200000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', '76000000-0000-4000-8000-000000000002', '33000000-0000-4000-8000-000000000005', NULL, 'PENDING', 'Seed pending approval', NULL, NULL, CURRENT_TIMESTAMP - INTERVAL '1 day')
ON CONFLICT ("id") DO UPDATE SET
  "approverId" = EXCLUDED."approverId",
  "status" = EXCLUDED."status",
  "notes" = EXCLUDED."notes",
  "approvedAt" = EXCLUDED."approvedAt",
  "rejectedAt" = EXCLUDED."rejectedAt";

INSERT INTO "Debt" (
  "id", "tenantId", "branchId", "supplierId", "purchaseId", "invoiceNo",
  "amount", "paidAmount", "status", "dueDate", "createdAt", "updatedAt"
) VALUES (
  '77000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000011',
  '50000000-0000-4000-8000-000000000001',
  '76000000-0000-4000-8000-000000000001',
  'INV-PBF-SEED-001',
  999000,
  250000,
  'PARTIAL',
  CURRENT_TIMESTAMP - INTERVAL '3 days',
  CURRENT_TIMESTAMP - INTERVAL '20 days',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("tenantId", "branchId", "invoiceNo") DO UPDATE SET
  "purchaseId" = EXCLUDED."purchaseId",
  "amount" = EXCLUDED."amount",
  "paidAmount" = EXCLUDED."paidAmount",
  "status" = EXCLUDED."status",
  "dueDate" = EXCLUDED."dueDate",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "DebtPayment" ("id", "tenantId", "debtId", "paymentMethod", "amount", "referenceNo", "paidAt") VALUES
  ('77100000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '77000000-0000-4000-8000-000000000001', 'TRANSFER', 250000, 'TRF-DEBT-SEED-001', CURRENT_TIMESTAMP - INTERVAL '4 days')
ON CONFLICT ("id") DO UPDATE SET
  "paymentMethod" = EXCLUDED."paymentMethod",
  "amount" = EXCLUDED."amount",
  "referenceNo" = EXCLUDED."referenceNo",
  "paidAt" = EXCLUDED."paidAt";

INSERT INTO "Receivable" (
  "id", "tenantId", "branchId", "customerId", "saleId", "invoiceNo",
  "amount", "paidAmount", "status", "dueDate", "createdAt", "updatedAt"
) VALUES (
  '78000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000011',
  '70000000-0000-4000-8000-000000000002',
  '73000000-0000-4000-8000-000000000002',
  'INV-SEED-CR-001',
  150000,
  50000,
  'PARTIAL',
  CURRENT_TIMESTAMP - INTERVAL '1 day',
  CURRENT_TIMESTAMP - INTERVAL '5 days',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("tenantId", "branchId", "invoiceNo") DO UPDATE SET
  "saleId" = EXCLUDED."saleId",
  "customerId" = EXCLUDED."customerId",
  "amount" = EXCLUDED."amount",
  "paidAmount" = EXCLUDED."paidAmount",
  "status" = EXCLUDED."status",
  "dueDate" = EXCLUDED."dueDate",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "ReceivablePayment" ("id", "tenantId", "receivableId", "paymentMethod", "amount", "referenceNo", "paidAt") VALUES
  ('78100000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '78000000-0000-4000-8000-000000000001', 'CASH', 50000, 'RCV-SEED-001', CURRENT_TIMESTAMP - INTERVAL '2 days')
ON CONFLICT ("id") DO UPDATE SET
  "paymentMethod" = EXCLUDED."paymentMethod",
  "amount" = EXCLUDED."amount",
  "referenceNo" = EXCLUDED."referenceNo",
  "paidAt" = EXCLUDED."paidAt";

INSERT INTO "CashAccount" (
  "id", "tenantId", "branchId", "code", "name", "balance", "isActive",
  "createdAt", "updatedAt"
) VALUES
  ('79000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', 'CASH-MAIN', 'Kas Cabang Utama', 1500000, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('79000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', NULL, 'BANK-BCA', 'Bank BCA Operasional', 8500000, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("tenantId", "code") DO UPDATE SET
  "branchId" = EXCLUDED."branchId",
  "name" = EXCLUDED."name",
  "balance" = EXCLUDED."balance",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "CashMutation" (
  "id", "tenantId", "branchId", "cashAccountId", "type", "amount",
  "refType", "refId", "notes", "createdById", "createdAt"
) VALUES
  ('79100000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', '79000000-0000-4000-8000-000000000001', 'OPENING_BALANCE', 1500000, 'Seed', NULL, 'Saldo awal seed', '33000000-0000-4000-8000-000000000005', CURRENT_TIMESTAMP),
  ('79100000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', '79000000-0000-4000-8000-000000000001', 'SALE_PAYMENT', 78000, 'Sale', '73000000-0000-4000-8000-000000000001', 'Pembayaran sale seed', '33000000-0000-4000-8000-000000000005', CURRENT_TIMESTAMP - INTERVAL '1 day'),
  ('79100000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', NULL, '79000000-0000-4000-8000-000000000002', 'DEBT_PAYMENT', 250000, 'Debt', '77000000-0000-4000-8000-000000000001', 'Pembayaran hutang supplier seed', '33000000-0000-4000-8000-000000000005', CURRENT_TIMESTAMP - INTERVAL '4 days')
ON CONFLICT ("id") DO UPDATE SET
  "amount" = EXCLUDED."amount",
  "refType" = EXCLUDED."refType",
  "refId" = EXCLUDED."refId",
  "notes" = EXCLUDED."notes",
  "createdById" = EXCLUDED."createdById";

INSERT INTO "Expense" (
  "id", "tenantId", "branchId", "cashAccountId", "category", "amount",
  "description", "spentAt", "createdById"
) VALUES (
  '79200000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000011',
  '79000000-0000-4000-8000-000000000001',
  'Operasional',
  125000,
  'Biaya kebersihan dan ATK seed',
  CURRENT_TIMESTAMP - INTERVAL '6 days',
  '33000000-0000-4000-8000-000000000005'
)
ON CONFLICT ("id") DO UPDATE SET
  "category" = EXCLUDED."category",
  "amount" = EXCLUDED."amount",
  "description" = EXCLUDED."description",
  "spentAt" = EXCLUDED."spentAt",
  "createdById" = EXCLUDED."createdById";

INSERT INTO "License" (
  "id", "tenantId", "branchId", "code", "type", "holderName", "number",
  "issuedAt", "expiredAt", "status", "notes", "createdAt", "updatedAt"
) VALUES (
  '80000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000011',
  'SIA-SEED-001',
  'SIA',
  'Apotek MVP 1 Local',
  'SIA-MVP1-001',
  DATE '2025-01-01',
  DATE '2027-01-01',
  'ACTIVE',
  'Seed izin apotek',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("tenantId", "code") DO UPDATE SET
  "number" = EXCLUDED."number",
  "expiredAt" = EXCLUDED."expiredAt",
  "status" = EXCLUDED."status",
  "notes" = EXCLUDED."notes",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "PractitionerLicense" (
  "id", "tenantId", "branchId", "practitionerName", "profession", "licenseType",
  "number", "issuedAt", "expiredAt", "status", "notes", "createdAt", "updatedAt"
) VALUES (
  '81000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000011',
  'Apt. Andini Rahma',
  'APOTEKER',
  'SIPA',
  'SIPA-MVP1-001',
  DATE '2025-01-01',
  DATE '2026-12-31',
  'ACTIVE',
  'Seed SIPA APJ',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("tenantId", "number") DO UPDATE SET
  "practitionerName" = EXCLUDED."practitionerName",
  "licenseType" = EXCLUDED."licenseType",
  "expiredAt" = EXCLUDED."expiredAt",
  "status" = EXCLUDED."status",
  "notes" = EXCLUDED."notes",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StockAlert" (
  "id", "tenantId", "branchId", "productId", "type", "status",
  "quantity", "threshold", "message", "createdAt", "resolvedAt"
) VALUES
  ('82000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', '60000000-0000-4000-8000-000000000003', 'LOW_STOCK', 'OPEN', 18, 20, 'Masker medis berada di bawah minimum stock', CURRENT_TIMESTAMP - INTERVAL '1 day', NULL),
  ('82000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', '60000000-0000-4000-8000-000000000002', 'EXPIRED_SOON', 'OPEN', 24, NULL, 'Batch Amoxicillin mendekati expired date', CURRENT_TIMESTAMP - INTERVAL '1 day', NULL)
ON CONFLICT ("id") DO UPDATE SET
  "status" = EXCLUDED."status",
  "quantity" = EXCLUDED."quantity",
  "threshold" = EXCLUDED."threshold",
  "message" = EXCLUDED."message",
  "resolvedAt" = EXCLUDED."resolvedAt";

INSERT INTO "StockLedger" (
  "id", "tenantId", "branchId", "productId", "batchId", "locationId",
  "userId", "type", "qtyChange", "finalStock", "refType", "refId",
  "sourceDocumentNo", "notes", "createdAt"
) VALUES
  ('83000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', '60000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000005', 'PURCHASE', 1000, 140, 'Purchase', '76000000-0000-4000-8000-000000000001', 'PO-SEED-RECV-001', 'Pembelian seed', CURRENT_TIMESTAMP - INTERVAL '20 days'),
  ('83000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', '60000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000005', 'SALE', -20, 120, 'Sale', '73000000-0000-4000-8000-000000000001', 'INV-SEED-REG-001', 'Penjualan seed', CURRENT_TIMESTAMP - INTERVAL '1 day'),
  ('83000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', '60000000-0000-4000-8000-000000000002', '63000000-0000-4000-8000-000000000002', '62000000-0000-4000-8000-000000000002', '33000000-0000-4000-8000-000000000005', 'SALE', -10, 24, 'Prescription', '74000000-0000-4000-8000-000000000002', 'INV-SEED-RX-001', 'Dispense resep seed', CURRENT_TIMESTAMP - INTERVAL '2 days')
ON CONFLICT ("id") DO UPDATE SET
  "qtyChange" = EXCLUDED."qtyChange",
  "finalStock" = EXCLUDED."finalStock",
  "refType" = EXCLUDED."refType",
  "refId" = EXCLUDED."refId",
  "sourceDocumentNo" = EXCLUDED."sourceDocumentNo",
  "notes" = EXCLUDED."notes";

INSERT INTO "StockOpname" (
  "id", "tenantId", "branchId", "staffId", "code", "status",
  "notes", "createdAt", "closedAt"
) VALUES (
  '84000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000011',
  '33000000-0000-4000-8000-000000000005',
  'OPN-SEED-001',
  'CLOSED',
  'Stock opname seed',
  CURRENT_TIMESTAMP - INTERVAL '7 days',
  CURRENT_TIMESTAMP - INTERVAL '7 days'
)
ON CONFLICT ("tenantId", "branchId", "code") DO UPDATE SET
  "status" = EXCLUDED."status",
  "notes" = EXCLUDED."notes",
  "closedAt" = EXCLUDED."closedAt";

INSERT INTO "StockOpnameItem" (
  "id", "tenantId", "opnameId", "batchId", "systemStock", "realStock", "difference"
) VALUES (
  '84100000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '84000000-0000-4000-8000-000000000001',
  '63000000-0000-4000-8000-000000000003',
  18,
  18,
  0
)
ON CONFLICT ("id") DO UPDATE SET
  "systemStock" = EXCLUDED."systemStock",
  "realStock" = EXCLUDED."realStock",
  "difference" = EXCLUDED."difference";

INSERT INTO "SaleReturn" (
  "id", "tenantId", "saleId", "returnNumber", "reason", "refundTotal",
  "approvedById", "createdAt"
) VALUES (
  '85000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '73000000-0000-4000-8000-000000000001',
  'SR-SEED-001',
  'Retur sebagian item seed',
  1500,
  '33000000-0000-4000-8000-000000000005',
  CURRENT_TIMESTAMP - INTERVAL '12 hours'
)
ON CONFLICT ("tenantId", "returnNumber") DO UPDATE SET
  "reason" = EXCLUDED."reason",
  "refundTotal" = EXCLUDED."refundTotal",
  "approvedById" = EXCLUDED."approvedById";

INSERT INTO "SaleReturnItem" (
  "id", "tenantId", "saleReturnId", "saleItemId", "batchId", "qty", "refundAmount"
) VALUES (
  '85100000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '85000000-0000-4000-8000-000000000001',
  '73100000-0000-4000-8000-000000000001',
  '63000000-0000-4000-8000-000000000001',
  1,
  1500
)
ON CONFLICT ("id") DO UPDATE SET
  "qty" = EXCLUDED."qty",
  "refundAmount" = EXCLUDED."refundAmount";

INSERT INTO "PurchaseReturn" (
  "id", "tenantId", "purchaseId", "returnNumber", "status", "reason",
  "totalAmount", "approvedById", "createdAt"
) VALUES (
  '86000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '76000000-0000-4000-8000-000000000001',
  'PR-SEED-001',
  'APPROVED',
  'Kemasan rusak saat sampling seed',
  9000,
  '33000000-0000-4000-8000-000000000005',
  CURRENT_TIMESTAMP - INTERVAL '10 days'
)
ON CONFLICT ("tenantId", "returnNumber") DO UPDATE SET
  "status" = EXCLUDED."status",
  "reason" = EXCLUDED."reason",
  "totalAmount" = EXCLUDED."totalAmount",
  "approvedById" = EXCLUDED."approvedById";

INSERT INTO "PurchaseReturnItem" (
  "id", "tenantId", "purchaseReturnId", "purchaseItemId", "batchId", "qty", "amount"
) VALUES (
  '86100000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '86000000-0000-4000-8000-000000000001',
  '76100000-0000-4000-8000-000000000001',
  '63000000-0000-4000-8000-000000000001',
  1,
  9000
)
ON CONFLICT ("id") DO UPDATE SET
  "qty" = EXCLUDED."qty",
  "amount" = EXCLUDED."amount";

INSERT INTO "ConsignmentAgreement" (
  "id", "tenantId", "branchId", "supplierId", "agreementNo", "status",
  "startedAt", "endedAt", "notes"
) VALUES (
  '87000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000011',
  '50000000-0000-4000-8000-000000000002',
  'CON-SEED-001',
  'ACTIVE',
  CURRENT_TIMESTAMP - INTERVAL '15 days',
  NULL,
  'Konsinyasi masker seed'
)
ON CONFLICT ("tenantId", "branchId", "agreementNo") DO UPDATE SET
  "status" = EXCLUDED."status",
  "notes" = EXCLUDED."notes";

INSERT INTO "ConsignmentItem" (
  "id", "tenantId", "agreementId", "productId", "qtyReceived", "qtySold",
  "qtyReturned", "settlementPrice"
) VALUES (
  '87100000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '87000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000003',
  20,
  2,
  0,
  21000
)
ON CONFLICT ("id") DO UPDATE SET
  "qtyReceived" = EXCLUDED."qtyReceived",
  "qtySold" = EXCLUDED."qtySold",
  "qtyReturned" = EXCLUDED."qtyReturned",
  "settlementPrice" = EXCLUDED."settlementPrice";

INSERT INTO "ConsignmentSettlement" (
  "id", "tenantId", "agreementId", "settlementNo", "amount", "settledAt", "notes"
) VALUES (
  '87200000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '87000000-0000-4000-8000-000000000001',
  'CONS-SETTLE-SEED-001',
  42000,
  CURRENT_TIMESTAMP - INTERVAL '1 day',
  'Settlement parsial seed'
)
ON CONFLICT ("tenantId", "settlementNo") DO UPDATE SET
  "amount" = EXCLUDED."amount",
  "settledAt" = EXCLUDED."settledAt",
  "notes" = EXCLUDED."notes";

INSERT INTO "ChartOfAccount" (
  "id", "tenantId", "code", "name", "type", "parentId", "isActive",
  "createdAt", "updatedAt"
) VALUES
  ('88000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '1000', 'Kas dan Bank', 'ASSET', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('88000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '1100', 'Piutang Usaha', 'ASSET', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('88000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '2000', 'Hutang Usaha', 'LIABILITY', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('88000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', '4000', 'Penjualan', 'REVENUE', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('88000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', '5000', 'Harga Pokok Penjualan', 'COST_OF_GOODS_SOLD', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('88000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000001', '6000', 'Beban Operasional', 'EXPENSE', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("tenantId", "code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "type" = EXCLUDED."type",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "JournalEntry" (
  "id", "tenantId", "branchId", "entryNo", "status", "date",
  "description", "refType", "refId", "createdAt", "updatedAt"
) VALUES (
  '88100000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000011',
  'JE-SEED-SALE-001',
  'POSTED',
  CURRENT_TIMESTAMP - INTERVAL '1 day',
  'Jurnal penjualan seed',
  'Sale',
  '73000000-0000-4000-8000-000000000001',
  CURRENT_TIMESTAMP - INTERVAL '1 day',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("tenantId", "entryNo") DO UPDATE SET
  "description" = EXCLUDED."description",
  "status" = EXCLUDED."status",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "JournalLine" ("id", "journalEntryId", "accountId", "debit", "credit", "memo") VALUES
  ('88200000-0000-4000-8000-000000000001', '88100000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-000000000001', 78000, 0, 'Kas penjualan seed'),
  ('88200000-0000-4000-8000-000000000002', '88100000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-000000000004', 0, 78000, 'Pendapatan penjualan seed')
ON CONFLICT ("id") DO UPDATE SET
  "debit" = EXCLUDED."debit",
  "credit" = EXCLUDED."credit",
  "memo" = EXCLUDED."memo";

INSERT INTO "EmployeeProfile" (
  "id", "tenantId", "userId", "employeeNo", "jobTitle", "joinedAt",
  "salary", "createdAt", "updatedAt"
) VALUES
  ('89000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000005', 'EMP-APJ-001', 'Apoteker Penanggung Jawab', DATE '2025-01-01', 7500000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("userId") DO UPDATE SET
  "employeeNo" = EXCLUDED."employeeNo",
  "jobTitle" = EXCLUDED."jobTitle",
  "salary" = EXCLUDED."salary",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "ShiftSchedule" (
  "id", "tenantId", "branchId", "userId", "title", "startsAt", "endsAt", "notes"
) VALUES (
  '89100000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000011',
  '33000000-0000-4000-8000-000000000005',
  'Shift Pagi',
  CURRENT_TIMESTAMP - INTERVAL '1 day',
  CURRENT_TIMESTAMP - INTERVAL '16 hours',
  'Jadwal seed'
)
ON CONFLICT ("id") DO UPDATE SET
  "title" = EXCLUDED."title",
  "startsAt" = EXCLUDED."startsAt",
  "endsAt" = EXCLUDED."endsAt",
  "notes" = EXCLUDED."notes";

INSERT INTO "Attendance" (
  "id", "tenantId", "branchId", "userId", "scheduleId", "status",
  "checkInAt", "checkOutAt", "checkInLat", "checkInLng", "photoUrl", "notes"
) VALUES (
  '89200000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000011',
  '33000000-0000-4000-8000-000000000005',
  '89100000-0000-4000-8000-000000000001',
  'PRESENT',
  CURRENT_TIMESTAMP - INTERVAL '1 day',
  CURRENT_TIMESTAMP - INTERVAL '16 hours',
  -6.2000000,
  106.8166667,
  NULL,
  'Absensi seed'
)
ON CONFLICT ("id") DO UPDATE SET
  "status" = EXCLUDED."status",
  "checkInAt" = EXCLUDED."checkInAt",
  "checkOutAt" = EXCLUDED."checkOutAt",
  "notes" = EXCLUDED."notes";

INSERT INTO "PurchasePlan" (
  "id", "tenantId", "branchId", "planNumber", "periodStart", "periodEnd",
  "status", "createdById", "createdAt"
) VALUES (
  '89300000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000011',
  'PLAN-SEED-001',
  DATE_TRUNC('month', CURRENT_TIMESTAMP),
  DATE_TRUNC('month', CURRENT_TIMESTAMP) + INTERVAL '1 month' - INTERVAL '1 day',
  'DRAFT',
  '33000000-0000-4000-8000-000000000005',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("tenantId", "branchId", "planNumber") DO UPDATE SET
  "status" = EXCLUDED."status",
  "createdById" = EXCLUDED."createdById";

INSERT INTO "PurchasePlanItem" (
  "id", "tenantId", "purchasePlanId", "productId", "suggestedQty", "reason"
) VALUES (
  '89400000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '89300000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000003',
  20,
  'Low stock seed'
)
ON CONFLICT ("id") DO UPDATE SET
  "suggestedQty" = EXCLUDED."suggestedQty",
  "reason" = EXCLUDED."reason";

INSERT INTO "AnalyticsSnapshot" (
  "id", "tenantId", "branchId", "scope", "period", "metrics", "createdAt"
) VALUES
  ('90000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', 'CRM_CAMPAIGN', DATE_TRUNC('day', CURRENT_TIMESTAMP), '{"name":"Promo Vitamin Local","type":"PROMO","channel":"WHATSAPP","status":"SCHEDULED","segment":"SILVER","message":"Promo local seed untuk member aktif"}'::jsonb, CURRENT_TIMESTAMP),
  ('90000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', 'OWNER_DAILY_BRIEF', DATE_TRUNC('day', CURRENT_TIMESTAMP), '{"sales":{"target":1000000},"inventory":{"lowStock":1},"finance":{"overdueDebt":1,"overdueReceivable":1}}'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT ("tenantId", "branchId", "scope", "period") DO UPDATE SET
  "metrics" = EXCLUDED."metrics",
  "createdAt" = CURRENT_TIMESTAMP;

INSERT INTO "SupervisorAuthorization" (
  "id", "tenantId", "branchId", "requestedById", "supervisorId", "action",
  "reason", "metadata", "approvedAt", "expiresAt", "usedAt"
) VALUES (
  '91000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000011',
  '33000000-0000-4000-8000-000000000005',
  '33000000-0000-4000-8000-000000000005',
  'DISCOUNT_OVERRIDE',
  'Seed supervisor approval',
  '{"discountPercent":10}'::jsonb,
  CURRENT_TIMESTAMP - INTERVAL '1 day',
  CURRENT_TIMESTAMP + INTERVAL '1 day',
  NULL
)
ON CONFLICT ("id") DO UPDATE SET
  "reason" = EXCLUDED."reason",
  "metadata" = EXCLUDED."metadata",
  "expiresAt" = EXCLUDED."expiresAt",
  "usedAt" = EXCLUDED."usedAt";

INSERT INTO "RejectedSale" (
  "id", "tenantId", "branchId", "cashierId", "payload", "reason", "channel", "createdAt"
) VALUES (
  '92000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000011',
  '33000000-0000-4000-8000-000000000005',
  '{"invoiceNumber":"INV-REJECT-SEED-001","items":[]}'::jsonb,
  'Insufficient stock seed',
  'OFFLINE',
  CURRENT_TIMESTAMP - INTERVAL '2 days'
)
ON CONFLICT ("id") DO UPDATE SET
  "payload" = EXCLUDED."payload",
  "reason" = EXCLUDED."reason";

INSERT INTO "OfflineDevice" (
  "id", "tenantId", "branchId", "userId", "deviceKey", "name", "platform",
  "lastSeenAt", "createdAt"
) VALUES (
  '93000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000011',
  '33000000-0000-4000-8000-000000000005',
  'DEVICE-SEED-POS-001',
  'POS Local Seed',
  'web',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("tenantId", "deviceKey") DO UPDATE SET
  "branchId" = EXCLUDED."branchId",
  "userId" = EXCLUDED."userId",
  "name" = EXCLUDED."name",
  "platform" = EXCLUDED."platform",
  "lastSeenAt" = EXCLUDED."lastSeenAt";

INSERT INTO "SyncQueue" (
  "id", "tenantId", "deviceId", "entity", "entityId", "operation",
  "payload", "status", "error", "createdAt", "appliedAt"
) VALUES (
  '93100000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000001',
  'Sale',
  '73000000-0000-4000-8000-000000000001',
  'UPDATE',
  '{"source":"seed"}'::jsonb,
  'APPLIED',
  NULL,
  CURRENT_TIMESTAMP - INTERVAL '1 day',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "payload" = EXCLUDED."payload",
  "status" = EXCLUDED."status",
  "error" = EXCLUDED."error",
  "appliedAt" = EXCLUDED."appliedAt";

INSERT INTO "SyncConflict" (
  "id", "tenantId", "syncQueueId", "entity", "entityId", "serverValue",
  "clientValue", "resolvedAt", "resolution", "createdAt"
) VALUES (
  '93200000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '93100000-0000-4000-8000-000000000001',
  'Stock',
  '63000000-0000-4000-8000-000000000001',
  '{"stock":120}'::jsonb,
  '{"stock":119}'::jsonb,
  CURRENT_TIMESTAMP,
  '{"winner":"server"}'::jsonb,
  CURRENT_TIMESTAMP - INTERVAL '1 day'
)
ON CONFLICT ("id") DO UPDATE SET
  "serverValue" = EXCLUDED."serverValue",
  "clientValue" = EXCLUDED."clientValue",
  "resolvedAt" = EXCLUDED."resolvedAt",
  "resolution" = EXCLUDED."resolution";

INSERT INTO "AuditLog" (
  "id", "tenantId", "branchId", "actorId", "action", "entity", "entityId",
  "before", "after", "metadata", "ipAddress", "userAgent", "createdAt"
) VALUES
  ('94000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', '33000000-0000-4000-8000-000000000005', 'CREATE', 'Seed', '20000000-0000-4000-8000-000000000001', NULL, '{"status":"seeded"}'::jsonb, '{"script":"prisma/seed.mvp1.sql"}'::jsonb, '127.0.0.1', 'SQL seed', CURRENT_TIMESTAMP),
  ('94000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', '33000000-0000-4000-8000-000000000005', 'LOGIN', 'User', '33000000-0000-4000-8000-000000000005', NULL, '{"email":"superadmin@apotek.local"}'::jsonb, '{"source":"seed"}'::jsonb, '127.0.0.1', 'SQL seed', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "after" = EXCLUDED."after",
  "metadata" = EXCLUDED."metadata",
  "createdAt" = EXCLUDED."createdAt";

COMMIT;

