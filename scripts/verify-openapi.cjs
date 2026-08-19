const assert = require('node:assert/strict');

const { openApiDocument } = require('../dist/modules/docs/openapi.controller.js');

const requiredPaths = [
  '/health',
  '/auth/login',
  '/auth/logout',
  '/auth/refresh',
  '/auth/me',
  '/tenants/active',
  '/products',
  '/products/search',
  '/products/{id}',
  '/products/{id}/batches',
  '/stock/overview',
  '/cashier-shifts/open',
  '/pos/checkout',
  '/transactions',
  '/purchase-orders',
  '/finance/pnl',
  '/licenses',
  '/prescriptions',
  '/prescriptions/history',
  '/crm/members',
  '/crm/campaigns',
  '/owner/dashboard',
  '/owner/daily-brief',
  '/owner/health-score',
  '/owner/warnings',
  '/owner/recommendations',
  '/owner/audit-control',
  '/analysis/inventory',
  '/analysis/pareto',
  '/analysis/product-margin',
  '/analysis/supplier-purchases',
];

assert.equal(openApiDocument.openapi, '3.0.3');
assert.ok(openApiDocument.components.securitySchemes.bearerAuth);
assert.ok(openApiDocument.components.schemas.SuccessResponse);
assert.ok(openApiDocument.components.schemas.ErrorResponse);

for (const path of requiredPaths) {
  assert.ok(openApiDocument.paths[path], `Missing OpenAPI path: ${path}`);
}

console.log(`OpenAPI contract smoke passed (${requiredPaths.length} required paths).`);
