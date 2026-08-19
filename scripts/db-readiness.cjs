const assert = require('node:assert/strict');
const { Client } = require('pg');
require('dotenv').config();

const requiredTables = [
  'Tenant',
  'TenantFeature',
  'Branch',
  'User',
  'Role',
  'Permission',
  'AuditLog',
  'IdempotencyKey',
  'Category',
  'Unit',
  'Product',
  'ProductUnit',
  'ProductBatch',
  'StockLedger',
  'CashierSession',
  'Customer',
  'Sale',
  'SaleItem',
  'SalePayment',
  'Prescription',
  'PrescriptionItem',
  'Supplier',
  'Purchase',
  'PurchaseItem',
  'PurchaseApproval',
  'Debt',
  'Receivable',
  'CashAccount',
  'CashMutation',
  'License',
  'PractitionerLicense',
  'AnalyticsSnapshot',
];

const rlsTables = requiredTables.filter((table) => !['Tenant', 'Permission', 'ProductUnit'].includes(table));

const run = async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required');

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query('SELECT 1');

    const tables = await client.query(
      `SELECT relname, relrowsecurity
       FROM pg_class
       WHERE relkind = 'r' AND relname = ANY($1::text[])`,
      [requiredTables]
    );
    const tableByName = new Map(tables.rows.map((row) => [row.relname, row]));
    const missingTables = requiredTables.filter((table) => !tableByName.has(table));
    assert.deepEqual(missingTables, [], `Missing tables: ${missingTables.join(', ')}`);

    const disabledRls = rlsTables.filter((table) => !tableByName.get(table)?.relrowsecurity);
    assert.deepEqual(disabledRls, [], `RLS disabled tables: ${disabledRls.join(', ')}`);

    const policies = await client.query(
      `SELECT tablename
       FROM pg_policies
       WHERE schemaname = 'public' AND policyname = 'tenant_isolation' AND tablename = ANY($1::text[])`,
      [rlsTables]
    );
    const policyTables = new Set(policies.rows.map((row) => row.tablename));
    const missingPolicies = rlsTables.filter((table) => !policyTables.has(table));
    assert.deepEqual(missingPolicies, [], `Missing tenant_isolation policies: ${missingPolicies.join(', ')}`);

    const migrationTable = await client.query("SELECT to_regclass('public._prisma_migrations') AS table_name");
    if (migrationTable.rows[0].table_name) {
      const failed = await client.query(
        `SELECT migration_name, logs
         FROM "_prisma_migrations"
         WHERE finished_at IS NULL AND rolled_back_at IS NULL`
      );
      assert.equal(failed.rowCount, 0, `Unfinished Prisma migrations: ${failed.rows.map((row) => row.migration_name).join(', ')}`);
    }

    console.log(`Database readiness passed (${requiredTables.length} tables, ${rlsTables.length} RLS checks).`);
  } finally {
    await client.end();
  }
};

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
