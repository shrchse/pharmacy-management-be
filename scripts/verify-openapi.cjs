const assert = require('node:assert/strict');

const { openApiDocument } = require('../dist/modules/docs/openapi.controller.js');

const requiredPaths = [
  '/health',
  '/auth/login',
  '/auth/logout',
  '/auth/refresh',
  '/auth/me',
  '/auth/supervisor-authorizations',
  '/tenants/active',
  '/internal/tenants/{tenantId}/users/{userId}/password',
  '/products',
  '/products/search',
  '/products/{id}',
  '/products/{id}/batches',
  '/stock/overview',
  '/stock/opname/{id}/items',
  '/stock/opname/{id}',
  '/stock/opname/{id}/physical-counts',
  '/cashier-shifts/open',
  '/pos/checkout',
  '/transactions',
  '/debts/{id}/payments',
  '/receivables/{id}/payments',
  '/purchase-orders',
  '/finance/pnl',
  '/licenses',
  '/prescriptions',
  '/prescriptions/history',
  '/permissions',
  '/categories/{id}',
  '/units/{id}',
  '/branches/{id}',
  '/outlets/{id}',
  '/racks/{id}',
  '/stock/internal-mutations',
  '/suppliers/{id}',
  '/customers/{id}',
  '/doctors/{id}',
  '/users/{id}',
  '/roles',
  '/roles/{id}',
  '/audit-logs',
  '/sales-returns',
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
