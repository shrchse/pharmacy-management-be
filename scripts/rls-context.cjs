const assert = require('node:assert/strict');
const crypto = require('node:crypto');
require('dotenv').config();

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || '0';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pharmacy_db?schema=public';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-at-least-32-characters-long';

const { prisma, runWithPrismaContext } = require('../dist/lib/prisma.js');

const run = async () => {
  const tenantId = crypto.randomUUID();
  const branchId = crypto.randomUUID();

  await runWithPrismaContext({ tenantId, branchId }, async () => {
    const rows = await prisma.$transaction(async (tx) => {
      return tx.$queryRaw`SELECT current_setting('app.tenant_id', true) AS tenant_id, current_setting('app.branch_id', true) AS branch_id`;
    });

    assert.equal(rows[0].tenant_id, tenantId);
    assert.equal(rows[0].branch_id, branchId);
  });

  await prisma.$disconnect();
  console.log('RLS runtime context smoke passed.');
};

run().catch(async (error) => {
  console.error(error.message || error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
