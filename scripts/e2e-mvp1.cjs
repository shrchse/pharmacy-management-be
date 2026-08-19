const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Client } = require('pg');
const jwt = require('jsonwebtoken');
require('dotenv').config();

process.on('warning', (warning) => {
  if (warning.name !== 'DeprecationWarning') {
    console.warn(warning);
  }
});

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_E2E !== 'true') {
  console.error('Refusing to run write-heavy E2E against production without ALLOW_PRODUCTION_E2E=true.');
  process.exit(1);
}

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || '0';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-at-least-32-characters-long';

const app = require('../dist/app.js').default;

const jsonRequest = async (baseUrl, method, path, body, token, branchId, extraHeaders = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(branchId ? { 'X-Branch-Id': branchId } : {}),
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`${method} ${path} failed ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload.data;
};

const rawJsonRequest = async (baseUrl, method, path, body, token, branchId, extraHeaders = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(branchId ? { 'X-Branch-Id': branchId } : {}),
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
};

const getUsersCount = async (client) => {
  const result = await client.query('SELECT COUNT(*)::int AS count FROM "User"');
  return result.rows[0].count;
};

const getBestAuthContext = async (client) => {
  const users = await client.query(
    `SELECT u.id, u."tenantId", u."branchId", u."roleId"
     FROM "User" u
     JOIN "Role" r ON r.id = u."roleId"
     LEFT JOIN "RolePermission" rp ON rp."roleId" = r.id
     WHERE u.status = 'ACTIVE'
     GROUP BY u.id
     ORDER BY COUNT(rp."permissionId") DESC
     LIMIT 1`
  );
  assert.equal(users.rowCount, 1, 'No active user available for E2E auth');
  const user = users.rows[0];
  const branchId = user.branchId || (await client.query('SELECT id FROM "Branch" WHERE "tenantId" = $1 LIMIT 1', [user.tenantId])).rows[0]?.id;
  assert.ok(branchId, 'No branch available for E2E auth');

  const permissions = await client.query(
    `SELECT p.code
     FROM "RolePermission" rp
     JOIN "Permission" p ON p.id = rp."permissionId"
     WHERE rp."roleId" = $1`,
    [user.roleId]
  );

  return {
    userId: user.id,
    tenantId: user.tenantId,
    branchId,
    roleId: user.roleId,
    permissions: permissions.rows.map((row) => row.code),
  };
};

const signToken = (context) => {
  return jwt.sign({
    sub: context.userId,
    tenantId: context.tenantId,
    branchId: context.branchId,
    roleId: context.roleId,
    permissions: context.permissions,
  }, process.env.JWT_SECRET, { expiresIn: '15m' });
};

const ensureFeature = async (client, tenantId, code) => {
  await client.query(
    `INSERT INTO "TenantFeature" ("id", "tenantId", "code", "enabled", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT ("tenantId", "code")
     DO UPDATE SET "enabled" = true, "updatedAt" = CURRENT_TIMESTAMP`,
    [crypto.randomUUID(), tenantId, code]
  );
};

const ensureBootstrapOrContext = async (baseUrl, client, stamp) => {
  if ((await getUsersCount(client)) === 0) {
    const data = await jsonRequest(baseUrl, 'POST', '/api/v1/auth/bootstrap', {
      tenant: {
        name: `E2E Tenant ${stamp}`,
        slug: `e2e-${stamp.toLowerCase()}`,
        email: `tenant-${stamp.toLowerCase()}@example.test`,
      },
      branch: {
        code: 'MAIN',
        name: 'Main Branch',
      },
      owner: {
        name: 'E2E Owner',
        email: `owner-${stamp.toLowerCase()}@example.test`,
        password: 'Password123!',
      },
    });
    return {
      ownerToken: data.accessToken,
      tenantId: data.tenant.id,
      branchId: data.branch.id,
      roleId: data.owner.roleId,
    };
  }

  const context = await getBestAuthContext(client);
  return {
    ownerToken: signToken(context),
    tenantId: context.tenantId,
    branchId: context.branchId,
    roleId: context.roleId,
  };
};

const run = async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required');
  assert.ok(process.env.JWT_SECRET.length >= 32, 'JWT_SECRET must be at least 32 characters');

  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const boot = await ensureBootstrapOrContext(baseUrl, client, stamp);
    for (const feature of ['inventory', 'purchasing', 'finance', 'crm', 'resep']) {
      await ensureFeature(client, boot.tenantId, feature);
    }

    const e2eUser = await jsonRequest(baseUrl, 'POST', '/api/v1/users', {
      branchId: boot.branchId,
      roleId: boot.roleId,
      name: `E2E Cashier ${stamp}`,
      email: `cashier-${stamp.toLowerCase()}@example.test`,
      password: 'Password123!',
    }, boot.ownerToken, boot.branchId);

    const login = await jsonRequest(baseUrl, 'POST', '/api/v1/auth/login', {
      email: e2eUser.email,
      password: 'Password123!',
    });
    const token = login.accessToken;
    const branchId = login.branch.id;

    const me = await jsonRequest(baseUrl, 'GET', '/api/v1/auth/me', undefined, token, branchId);
    assert.equal(me.user.email, e2eUser.email);

    const member = await jsonRequest(baseUrl, 'POST', '/api/v1/crm/members', {
      memberNo: `MEM-${stamp}`,
      name: `E2E Member ${stamp}`,
      phone: `08${stamp.slice(0, 10)}`,
    }, token, branchId);

    const category = await jsonRequest(baseUrl, 'POST', '/api/v1/categories', {
      name: `E2E Category ${stamp}`,
      type: 'UMUM',
    }, token, branchId);
    const unit = await jsonRequest(baseUrl, 'POST', '/api/v1/units', {
      code: `U${stamp}`,
      name: `Unit ${stamp}`,
    }, token, branchId);
    const product = await jsonRequest(baseUrl, 'POST', '/api/v1/products', {
      categoryId: category.id,
      unitId: unit.id,
      code: `P${stamp}`,
      name: `E2E Product ${stamp}`,
      requiresPrescription: true,
      minStock: 1,
      sellingPrice: 15000,
      purchasePrice: 8000,
    }, token, branchId);
    const productUnit = product.units[0];

    await jsonRequest(baseUrl, 'POST', '/api/v1/stock/batches', {
      productId: product.id,
      batchNumber: `B${stamp}`,
      expiredDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      buyPrice: 8000,
      stock: 10,
    }, token, branchId);

    const shift = await jsonRequest(baseUrl, 'POST', '/api/v1/cashier-shifts/open', {
      startingCash: 100000,
      notes: `E2E ${stamp}`,
    }, token, branchId);

    const checkoutBody = {
      cashierId: e2eUser.id,
      customerId: member.id,
      sessionId: shift.id,
      saleType: 'PRESCRIPTION',
      items: [{
        productId: product.id,
        productUnitId: productUnit.id,
        qty: 1,
      }],
      payments: [{
        method: 'CASH',
        amount: 15000,
      }],
    };
    const idempotencyKey = `e2e-${stamp}`;
    const sale = await jsonRequest(baseUrl, 'POST', '/api/v1/pos/checkout', checkoutBody, token, branchId, { 'Idempotency-Key': idempotencyKey });
    const replay = await jsonRequest(baseUrl, 'POST', '/api/v1/pos/checkout', checkoutBody, token, branchId, { 'Idempotency-Key': idempotencyKey });
    assert.equal(replay.id, sale.id);

    const receipt = await jsonRequest(baseUrl, 'GET', `/api/v1/receipts/${sale.id}`, undefined, token, branchId);
    assert.equal(receipt.invoiceNumber, sale.invoiceNumber);

    const raceProduct = await jsonRequest(baseUrl, 'POST', '/api/v1/products', {
      categoryId: category.id,
      unitId: unit.id,
      code: `R${stamp}`,
      name: `E2E Race Product ${stamp}`,
      minStock: 1,
      sellingPrice: 5000,
      purchasePrice: 3000,
    }, token, branchId);
    await jsonRequest(baseUrl, 'POST', '/api/v1/stock/batches', {
      productId: raceProduct.id,
      batchNumber: `RB${stamp}`,
      expiredDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      buyPrice: 3000,
      stock: 1,
    }, token, branchId);
    const raceBody = {
      cashierId: e2eUser.id,
      customerId: member.id,
      sessionId: shift.id,
      items: [{
        productId: raceProduct.id,
        productUnitId: raceProduct.units[0].id,
        qty: 1,
      }],
      payments: [{
        method: 'CASH',
        amount: 5000,
      }],
    };
    const raceResults = await Promise.all([
      rawJsonRequest(baseUrl, 'POST', '/api/v1/pos/checkout', raceBody, token, branchId, { 'Idempotency-Key': `race-a-${stamp}` }),
      rawJsonRequest(baseUrl, 'POST', '/api/v1/pos/checkout', raceBody, token, branchId, { 'Idempotency-Key': `race-b-${stamp}` }),
    ]);
    assert.deepEqual(raceResults.map((result) => result.status).sort(), [201, 409]);
    const raceBatches = await jsonRequest(baseUrl, 'GET', `/api/v1/products/${raceProduct.id}/batches`, undefined, token, branchId);
    assert.ok(raceBatches.every((batch) => batch.stock >= 0), 'Concurrent checkout produced negative stock');
    assert.equal(raceBatches.reduce((sum, batch) => sum + batch.stock, 0), 0);

    const prescription = await jsonRequest(baseUrl, 'POST', '/api/v1/prescriptions', {
      prescriptionNumber: `RX-${stamp}`,
      customerId: member.id,
      items: [{
        productId: product.id,
        medicineName: product.name,
        qtyRequired: 1,
        dosageInstruction: '1 x sehari',
      }],
    }, token, branchId);
    await jsonRequest(baseUrl, 'POST', `/api/v1/prescriptions/${prescription.id}/verify`, {}, token, branchId);
    const dispensed = await jsonRequest(baseUrl, 'POST', `/api/v1/prescriptions/${prescription.id}/dispense`, {
      saleId: sale.id,
    }, token, branchId);
    assert.equal(dispensed.status, 'REDEEMED');

    const supplier = await jsonRequest(baseUrl, 'POST', '/api/v1/suppliers', {
      code: `S${stamp}`,
      name: `E2E Supplier ${stamp}`,
      type: 'PBF',
    }, token, branchId);
    await jsonRequest(baseUrl, 'POST', '/api/v1/purchase-orders/apj-pin', {
      pin: '123456',
    }, token, branchId);
    const po = await jsonRequest(baseUrl, 'POST', '/api/v1/purchase-orders', {
      supplierId: supplier.id,
      poNumber: `PO-${stamp}`,
      items: [{
        productId: product.id,
        productUnitId: productUnit.id,
        qty: 2,
        buyPrice: 8000,
      }],
    }, token, branchId);
    await jsonRequest(baseUrl, 'POST', `/api/v1/purchase-orders/${po.id}/submit-approval`, {
      notes: `E2E approval ${stamp}`,
    }, token, branchId);
    await jsonRequest(baseUrl, 'POST', `/api/v1/purchase-orders/${po.id}/approve-apj`, {
      pin: '123456',
      notes: `E2E approve ${stamp}`,
    }, token, branchId);
    const received = await jsonRequest(baseUrl, 'POST', `/api/v1/purchase-orders/${po.id}/receive`, {
      invoiceNo: `INV-${stamp}`,
      items: [{
        purchaseItemId: po.purchaseItems[0].id,
        receivedQty: 2,
        batchNumber: `PB${stamp}`,
        expiredDate: new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString(),
      }],
    }, token, branchId);
    assert.ok(received.debt.id);

    const pnl = await jsonRequest(baseUrl, 'GET', '/api/v1/finance/pnl', undefined, token, branchId);
    assert.ok(pnl.revenue);
    const ownerDashboard = await jsonRequest(baseUrl, 'GET', '/api/v1/owner/dashboard', undefined, token, branchId);
    assert.ok(ownerDashboard.sales);

    const closedShift = await jsonRequest(baseUrl, 'POST', `/api/v1/cashier-shifts/${shift.id}/close`, {
      actualCash: 120000,
    }, token, branchId);
    assert.equal(closedShift.status, 'CLOSED');
    const verifiedShift = await jsonRequest(baseUrl, 'POST', `/api/v1/cashier-shifts/${shift.id}/verify`, {
      approved: true,
    }, token, branchId);
    assert.equal(verifiedShift.status, 'VERIFIED');

    console.log(`MVP1 DB E2E passed (stamp ${stamp}).`);
  } finally {
    await client.end();
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
};

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
