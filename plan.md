# Backend Implementation Plan - Kelola Apotek SIM API

Audit date: 2026-08-12  
Sources checked: `PRD.md`, `prisma/schema.prisma`, `src/**`, `package.json`, `README.md`, Prisma migrations.

## Status Legend

- `[x]` Done in this backend repo.
- `[ ]` Not done yet.
- `(Partial)` Foundation exists, but behavior/contract is still incomplete against PRD.
- `(External FE)` Work belongs in the frontend repository, but backend must support it.

## Current Project State

### Done

- [x] Express + TypeScript backend scaffold exists.
- [x] API is mounted under `/api/v1`.
- [x] Health endpoint exists: `GET /api/v1/health`.
- [x] Root welcome endpoint exists: `GET /`.
- [x] Environment validation exists for `PORT`, `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`.
- [x] Prisma 7 client is configured with PostgreSQL adapter.
- [x] Broad Prisma schema exists for SaaS, tenant, branch, auth/RBAC, product, stock, POS, purchase, finance, prescriptions, HR, analytics, and offline sync.
- [x] Prisma generated client exists under `src/generated/prisma`.
- [x] Two Prisma migrations exist: initial schema and expanded pharmacy platform schema.
- [x] Auth bootstrap exists: `POST /api/v1/auth/bootstrap`.
- [x] Login exists: `POST /api/v1/auth/login`.
- [x] Auth context endpoint exists: `GET /api/v1/auth/me`.
- [x] Bearer JWT middleware exists: `optionalAuth`, `requireAuth`.
- [x] Starter tenant endpoints exist: `GET /api/v1/tenants`, `POST /api/v1/tenants`.
- [x] Starter branch endpoints exist: `GET /api/v1/branches`, `GET /api/v1/tenants/:tenantId/branches`, `POST /api/v1/tenants/:tenantId/branches`.
- [x] Starter product endpoints exist: `GET /api/v1/products`, `GET /api/v1/tenants/:tenantId/products`, `POST /api/v1/products`.
- [x] Starter category create exists: `POST /api/v1/tenants/:tenantId/categories`.
- [x] Starter unit create exists: `POST /api/v1/units`.
- [x] Starter stock batch create exists: `POST /api/v1/branches/:branchId/stock/batches`.
- [x] Starter stock overview exists: `GET /api/v1/branches/:branchId/stock/overview`.
- [x] Starter POS checkout exists: `POST /api/v1/branches/:branchId/pos/checkout`.
- [x] Checkout currently runs inside `prisma.$transaction`.
- [x] Checkout currently decrements `ProductBatch.stock`.
- [x] Checkout currently creates `Sale`, `SaleItem`, `SalePayment`, `StockLedger`, and `Receivable` for underpaid sales.

### Partial or Mismatched

- [ ] (Partial) Response helper returns `{ success, message, data, error }`, while PRD requires success `{ data, meta }` and error `{ error: { code, message, details } }`.
- [ ] (Partial) `GET /auth/me` returns JWT context only, not full user, tenant, outlet list, permissions, entitlement, and subscription status.
- [ ] (Partial) Auth uses 8-hour access token only. PRD asks short-lived access token plus refresh token httpOnly cookie or Bearer flow.
- [ ] (Partial) Runtime has RBAC data models and default permissions, but no permission/entitlement enforcement middleware.
- [ ] (Partial) Current `/tenants` endpoints are public starter endpoints, not protected `/internal/tenants` superadmin endpoints.
- [ ] (Partial) Product create/list exists, but no full repository-compatible CRUD, search, delete guard, or supervisor gate.
- [ ] (Partial) Checkout handles basic stock decrement, but lacks row-level locking, supervisor authorization, audit log, cash ledger, receipt endpoint, transaction list/detail, cancellation, and PRD request contract.
- [ ] (Partial) Stock overview is calculated from batches, but PRD stock card must come from `StockLedger`; stock card endpoint is missing.
- [ ] (Partial) Schema uses `Branch` where PRD names `Outlet`; API naming must be normalized or mapped.
- [ ] (Partial) Schema uses `StockLocation` for physical stock locations/racks; PRD endpoint says `/racks`. Decide whether to expose it as racks or add a dedicated `Rack` model.
- [ ] (Partial) `dist/` is present, but source of truth remains `src/`; keep generated build artifacts out of manual planning decisions.

### Not Done

- [ ] OpenAPI schema/docs.
- [ ] Contract tests against FE repository contracts.
- [ ] Seed demo parity with mock FE.
- [ ] Audit logging on writes.
- [ ] Full auth logout/refresh/session lifecycle.
- [ ] Supervisor authorization endpoint and consumption flow.
- [ ] Tenant entitlement/subscription APIs.
- [ ] Master data CRUD beyond starter endpoints.
- [ ] Purchase, invoice, return, debt payment APIs.
- [ ] Finance cash book and financial reports.
- [ ] Owner dashboard and analytics endpoints.
- [ ] Multi-branch command center APIs.
- [ ] Add-on module APIs: resep, CRM, retail, HRD, SOP.
- [ ] Automated tests.
- [ ] CI/build verification config.
- [ ] MVP1 import/export file workflow (product master, opening stock, and operational reports).

## Schema Coverage Checklist

### Product Catalog Architecture Decision

- [x] Add `ProductCatalog` as the global platform master for reusable product identity.
- [x] Add `TenantProduct` as the tenant assortment/configuration mapping.
- [x] Keep selling price, HPP, minimum stock, prescription policy, custom name, and active status on `TenantProduct` (with legacy `Product` compatibility projection during MVP1).
- [x] Keep `ProductBatch` tenant/branch-scoped for stock, expiry, and buy price.
- [x] Allow tenant-local products for private label and compounding use cases at the mapping contract level.
- [x] Add RLS/read rules so global catalog is readable according to platform policy, while tenant mappings and all operational data remain tenant-scoped.
- [ ] Decide whether the existing `Product` model is migrated into `TenantProduct` or retained as a compatibility projection during MVP1.

### SaaS, Tenant, and Access Control

- [x] `Plan` model exists.
- [x] `Tenant` model exists.
- [x] `TenantFeature` model exists.
- [x] `TenantPolicy` model exists.
- [x] `Branch` model exists.
- [x] `User` model exists.
- [x] `Role` model exists.
- [x] `Permission` model exists.
- [x] `RolePermission` model exists.
- [x] `AuditLog` model exists.
- [x] `SupervisorAuthorization` model exists.
- [ ] Add refresh token/session persistence model if cookie refresh flow is chosen.
- [ ] Add multi-outlet user membership model if one user must belong to multiple branches at once. Current `User.branchId` supports one primary branch only.
- [ ] Add explicit entitlement/subscription response DTOs for `/auth/me` and tenant APIs.

### Product, Unit, Batch, and Stock

- [x] `Category` model exists.
- [x] `Unit` model exists.
- [x] `Product` model exists.
- [x] `ProductUnit` model exists.
- [x] `StockLocation` model exists.
- [x] `ProductBatch` model exists.
- [x] `StockLedger` model exists.
- [x] `StockAlert` model exists.
- [x] `ExpiredStockAction` model exists.
- [x] `StockTransfer` model exists.
- [x] `StockTransferItem` model exists.
- [x] `StockOpname` model exists.
- [x] `StockOpnameItem` model exists.
- [ ] Decide API alias for PRD `Rak`: expose `StockLocation` as `/racks` or add `Rack`.
- [ ] Add stock reservation strategy if parked carts or offline checkout can reserve stock.

### POS, Sales, Payment, Receipt, and Returns

- [x] `CashierSession` model exists.
- [x] `Customer` model exists.
- [x] `Sale` model exists.
- [x] `SaleItem` model exists.
- [x] `SalePayment` model exists.
- [x] `RejectedSale` model exists.
- [x] `SaleReturn` model exists.
- [x] `SaleReturnItem` model exists.
- [ ] Add parked cart model if PRD optional parked cart becomes server-backed.
- [ ] Add receipt projection/service. It can read from `Sale`, `SaleItem`, `SalePayment`, customer, cashier, branch, and tenant.

### Prescriptions and Medical Records

- [x] `Doctor` model exists.
- [x] `Prescription` model exists.
- [x] `PrescriptionItem` model exists.
- [x] `PrescriptionLabel` model exists.
- [x] `PrescriptionCopy` model exists.
- [x] `MedicalRecord` model exists.
- [ ] Confirm prescription API contracts with FE types before implementing add-on endpoints.

### Supplier, Purchase, Consignment, and Returns

- [x] `Supplier` model exists.
- [x] `SupplierProductPrice` model exists.
- [x] `Purchase` model exists.
- [x] `PurchaseItem` model exists.
- [x] `PurchaseReturn` model exists.
- [x] `PurchaseReturnItem` model exists.
- [x] `ConsignmentAgreement` model exists.
- [x] `ConsignmentItem` model exists.
- [x] `ConsignmentSettlement` model exists.
- [ ] PRD says purchase order and supplier invoice/faktur; current schema uses `Purchase` with `poNumber` and `invoiceNo`, not separate `PurchaseOrder` and `Invoice` models. Confirm whether this collapsed model is acceptable.

### Finance, Debts, Receivables, and Accounting

- [x] `Debt` model exists.
- [x] `DebtPayment` model exists.
- [x] `Receivable` model exists.
- [x] `ReceivablePayment` model exists.
- [x] `CashAccount` model exists.
- [x] `CashMutation` model exists.
- [x] `Expense` model exists.
- [x] `ChartOfAccount` model exists.
- [x] `JournalEntry` model exists.
- [x] `JournalLine` model exists.
- [ ] Connect sale payments, debt payments, receivable payments, and expenses to cash mutations consistently.
- [ ] Define double-entry accounting rules if journal reports are required in MVP.

### HR, Analytics, and Offline Sync

- [x] `EmployeeProfile` model exists.
- [x] `ShiftSchedule` model exists.
- [x] `Attendance` model exists.
- [x] `PurchasePlan` model exists.
- [x] `PurchasePlanItem` model exists.
- [x] `AnalyticsSnapshot` model exists.
- [x] `OfflineDevice` model exists.
- [x] `SyncQueue` model exists.
- [x] `SyncConflict` model exists.
- [ ] Define API contracts and entitlement checks for HRD, analytics snapshots, and offline sync.

## Phase 0 - Contract Foundation

Goal: make backend contract stable before adding more domain modules.

- [x] Express app exposes `/api/v1`.
- [x] Prisma client and PostgreSQL datasource are configured.
- [x] Zod is available for validation.
- [x] Basic success/error response helpers exist.
- [ ] Change response envelope to PRD shape:
  - success: `{ "data": ..., "meta": ... }`
  - error: `{ "error": { "code": "...", "message": "...", "details": ... } }`
- [ ] Add typed error codes: `VALIDATION_ERROR`, `AUTH_REQUIRED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INSUFFICIENT_STOCK`, `SUPERVISOR_REQUIRED`, `ENTITLEMENT_REQUIRED`, `INTERNAL_ERROR`.
- [ ] Add request context middleware:
  - request id
  - actor user id
  - tenant id
  - branch/outlet id
  - ip
  - user agent
- [ ] Normalize branch/outlet terminology:
  - DB model: keep `Branch` unless schema is changed.
  - API: expose `/outlets` if matching PRD/FE terminology is preferred.
  - Header: support `X-Outlet-Id` and map to `branchId`.
- [ ] Add OpenAPI generation:
  - route schemas from Zod
  - auth security scheme
  - common response/error schemas
  - schema tags by PRD module
  - docs endpoint, for example `/api/v1/docs` and `/api/v1/openapi.json`
- [ ] Add API versioning conventions and route module layout.
- [ ] Add contract test harness against OpenAPI.
- [ ] Add unit/integration test tooling.
- [ ] Add seed command for demo data parity with FE mocks.
- [ ] Add lint/format scripts if project standards require them.
- [ ] (External FE) Add `VITE_API_BASE_URL`.
- [ ] (External FE) Add `src/services/api.ts`.
- [ ] (External FE) Keep repository fallback to mock/localStorage when API env is empty.

## Cross-Cutting Backend Requirements

- [ ] Add `requirePermission(permissionCode)` middleware.
- [ ] Add `requireFeature(featureCode)` entitlement middleware.
- [ ] Add `requireTenantScope` and `requireBranchScope` middleware.
- [ ] Prevent cross-tenant reads/writes in every Prisma query.
- [ ] Add centralized audit service:
  - `tenantId`
  - `branchId`
  - `actorUserId`
  - `action`
  - `entity`
  - `entityId`
  - `before`
  - `after`
  - `ip`
  - `userAgent`
  - `supervisorAuthorizationId`
- [ ] Add transaction helper that accepts audit writes in the same DB transaction.
- [ ] Add pagination/sorting/filtering conventions for list endpoints.
- [ ] Add consistent soft-delete/status strategy for domain records with transaction history.
- [ ] Add data serialization for Decimal, DateTime, and enum values expected by FE.
- [ ] Add database indexes for common list/search paths after query design is fixed.
- [ ] Add concurrency strategy for stock mutations:
  - row-level lock or equivalent safe update
  - retry behavior
  - deterministic insufficient stock error

## Phase 1 - Core Operasional

### 1. Auth, RBAC, and Supervisor Authorization

- [x] `POST /api/v1/auth/bootstrap` creates first tenant, branch, owner role, permissions, categories, and units.
- [x] `POST /api/v1/auth/login` validates email/password.
- [x] `POST /api/v1/auth/login` signs Bearer access token.
- [x] `GET /api/v1/auth/me` requires auth.
- [x] `POST /api/v1/auth/dev-token` exists for non-production development.
- [x] Passwords are hashed with bcrypt during bootstrap.
- [ ] Replace hardcoded role names with PRD roles or map them explicitly:
  - `kasir`
  - `apoteker`
  - `owner_outlet`
  - `owner_multi`
  - `admin`
  - `superadmin`
- [ ] `GET /api/v1/auth/me` must return:
  - user profile
  - active tenant
  - outlet/branch list
  - active outlet/branch
  - role
  - permissions
  - entitlement/features
  - subscription status
- [ ] Add `POST /api/v1/auth/logout`.
- [ ] Add `POST /api/v1/auth/refresh`.
- [ ] Decide refresh implementation:
  - same-origin httpOnly cookie, or
  - Bearer refresh token for cross-domain.
- [ ] Persist refresh/session records if refresh tokens need revocation.
- [ ] Add permission enforcement on all protected routes.
- [ ] Add entitlement enforcement by feature/module.
- [ ] Add `POST /api/v1/auth/supervisor-authorizations`.
- [ ] Supervisor action validation must cover:
  - `cancel_paid_trx`
  - `discount_over_50`
  - `return_over_sell`
  - `sell_empty_stock`
  - `delete_product_with_history`
  - `edit_sell_price`
- [ ] Supervisor authorization must verify supervisor identity, role/permission, action, tenant, branch, expiry, and one-time usage.
- [ ] Write audit logs for login/logout and supervisor approvals.

### 2. Tenant, Entitlement, and Subscription

- [x] Schema includes `Plan`, `Tenant`, `TenantFeature`, `TenantPolicy`, and `Branch`.
- [x] Starter `GET /api/v1/tenants` exists.
- [x] Starter `POST /api/v1/tenants` exists.
- [x] Starter branch list/create exists.
- [ ] Protect tenant endpoints. Current starter endpoints are public through `optionalAuth`.
- [ ] Move superadmin tenant management to `/api/v1/internal/tenants`.
- [ ] Implement `GET /api/v1/internal/tenants`.
- [ ] Implement `POST /api/v1/internal/tenants`.
- [ ] Implement `GET /api/v1/internal/tenants/:id`.
- [ ] Implement `PATCH /api/v1/internal/tenants/:id`.
- [ ] Implement `PATCH /api/v1/internal/tenants/:id/entitlement`.
- [ ] Implement `PATCH /api/v1/internal/tenants/:id/subscription`.
- [ ] Implement `POST /api/v1/internal/tenants/:id/reset-demo`.
- [ ] Implement `GET /api/v1/tenants/active`.
- [ ] Implement `POST /api/v1/tenants/active`.
- [ ] Seed package codes:
  - `start`
  - `grow`
  - `scale`
- [ ] Seed feature/module codes:
  - `inventory`
  - `purchasing`
  - `finance`
  - `multi_outlet`
  - `resep`
  - `retail`
  - `crm`
  - `hrd`
  - `sop`
- [ ] Seed add-on codes:
  - `reminder_ed`
  - `loyalty`
  - `wa_broadcast`
  - `price_tag`
- [ ] Add audit for tenant/profile/entitlement/subscription changes.

### 3. Master Data

- [x] Schema includes products, categories, units, suppliers, customers, doctors, users, and branches.
- [x] Implement `ProductCatalog` global master and `TenantProduct` tenant mapping before extending product CRUD.
- [ ] Define which fields are global identity versus tenant-owned operational configuration.
- [x] Add product activation flow: select catalog item, configure tenant fields, then expose it to POS/purchasing/inventory.
- [x] Add tenant-local product compatibility flow for private label/racikan.
- [x] `POST /api/v1/tenants/:tenantId/categories` creates category.
- [x] `POST /api/v1/units` creates unit.
- [x] `GET /api/v1/products` lists products by tenant scope.
- [x] `GET /api/v1/tenants/:tenantId/products` lists products by tenant param.
- [x] `POST /api/v1/products` creates product and base product unit.
- [ ] Implement repository-compatible generic CRUD:
  - `GET /api/v1/product-catalog`
  - `POST /api/v1/product-catalog` (superadmin/platform)
  - `GET /api/v1/tenant-products`
  - `POST /api/v1/tenant-products`
  - `PATCH /api/v1/tenant-products/:id`
  - `DELETE /api/v1/tenant-products/:id`
  - `GET /api/v1/products`
  - `GET /api/v1/products/:id`
  - `POST /api/v1/products`
  - `PATCH /api/v1/products/:id`
  - `DELETE /api/v1/products/:id`
- [ ] Implement category CRUD at `/api/v1/categories`.
- [ ] Implement unit CRUD at `/api/v1/units`.
- [ ] Implement rack/location CRUD at `/api/v1/racks` or `/api/v1/stock-locations`.
- [ ] Implement supplier CRUD at `/api/v1/suppliers`.
- [ ] Implement customer CRUD at `/api/v1/customers`.
- [ ] Implement doctor CRUD at `/api/v1/doctors`.
- [ ] Implement tenant user CRUD at `/api/v1/users`.
- [ ] Implement outlet/branch CRUD at `/api/v1/outlets` or `/api/v1/branches`.
- [ ] Implement product search by:
  - name
  - generic/composition/active ingredient
  - SKU/code
  - barcode
- [ ] Validate product rules:
  - selling price
  - purchase price/HPP
  - min stock
  - expired date requirements through batch
  - category
  - rack/location
- [ ] Require supervisor authorization to delete product with transaction history.
- [ ] Require supervisor authorization to edit selling price when tenant policy enables gate.
- [ ] Write audit log for every master data write.

### 3.1 Import and Export (MVP1)

Import/export is part of MVP1. The backend schema and business rules remain the source of truth; Excel is a versioned transport format and must not become a direct database dump.

- [ ] Define and version the official Excel template, for example `product-import-v1.xlsx`.
- [ ] Provide template/reference-data download with valid category, unit, supplier, branch, and rack codes.
- [ ] Support product master import for catalog/product/tenant-product fields.
- [ ] Support product unit import with base-unit, conversion, barcode, selling price, and purchase price validation.
- [ ] Support opening-stock import as batch/opname/adjustment movements, not direct stock overwrites.
- [ ] Resolve references by business keys (`product_code`, `barcode`, `category_code`, `unit_code`, `supplier_code`, `branch_code`), never by database UUID supplied by users.
- [ ] Add import preview/dry-run endpoint before commit.
- [ ] Return row-level validation errors and downloadable error report.
- [ ] Make import atomic per file and idempotent/upsert-safe to prevent duplicate master data.
- [ ] Enforce tenant, branch, permission, entitlement, and supervisor rules during import.
- [ ] Write audit records for template download, preview, commit, and rejected rows.
- [ ] Add stock export endpoint for tenant/branch overview, batches, locations, and stock card.
- [ ] Add export endpoints for products, transactions, purchases, debts/receivables, cash, audit logs, and owner/analysis reports required by FE.
- [ ] Support the same filters as the corresponding list/report pages, including branch and date range.
- [ ] Define supported formats (`csv`, `xlsx`, and `pdf` only where layout requires it).
- [ ] Return correct file bytes, `Content-Type`, `Content-Disposition`, deterministic filename, and timezone metadata.
- [ ] Enforce export permission/entitlement and record `AuditAction.EXPORT` with tenant/branch/filter metadata.
- [ ] Decide synchronous versus asynchronous export jobs for large datasets and expose job status/download endpoints if needed.
- [ ] Add repository/API client contracts in FE for Blob download and multipart upload; pages must not implement business mapping themselves.
- [ ] Add integration tests for valid import, invalid rows, duplicate/upsert, tenant isolation, stock opening balance, filtered export, and permission denial.

### 4. POS and Transactions

- [x] Schema includes sale, sale item, sale payment, sale return, receivable, stock ledger, and cashier session.
- [x] Starter checkout exists at `POST /api/v1/branches/:branchId/pos/checkout`.
- [x] Checkout validates input with Zod.
- [x] Checkout creates `Sale`.
- [x] Checkout creates sale lines.
- [x] Checkout decrements selected or FEFO product batch stock.
- [x] Checkout creates `StockLedger` rows with type `SALE`.
- [x] Checkout creates `Receivable` when paid amount is below grand total.
- [ ] Add canonical PRD route `POST /api/v1/pos/checkout`.
- [ ] Align checkout request contract with PRD:
  - `customerId`
  - `method`
  - `trxType`
  - `doctorId`
  - `discount`
  - `paid`
  - `lines`
  - `supervisorAuthorizationIds`
- [ ] Keep current richer schema support only if mapped cleanly from FE repository.
- [ ] Add database-safe stock lock/concurrency control.
- [ ] Validate cart product status and batch status.
- [ ] Validate branch/tenant consistency for product units, products, customer, doctor, cashier, and batches.
- [ ] Validate supervisor override for empty stock sale.
- [ ] Validate supervisor override for discount above 50 percent.
- [ ] Create cash mutation/ledger for cash, QRIS, transfer, card, and e-wallet payments.
- [ ] Ensure credit sales create receivable with correct amount and due date policy.
- [ ] Write audit log inside checkout transaction.
- [ ] Mark supervisor authorizations as used inside checkout transaction.
- [ ] Implement `GET /api/v1/transactions`.
- [ ] Implement `GET /api/v1/transactions/:id`.
- [ ] Implement `POST /api/v1/transactions/:id/cancel`.
- [ ] Cancellation must require supervisor authorization for paid transactions.
- [ ] Cancellation must reverse stock ledger/cash/receivable consistently.
- [ ] Implement `GET /api/v1/receipts/:transactionId`.
- [ ] Implement `GET /api/v1/products/search`.
- [ ] Decide parked cart scope.
- [ ] If server-backed parked cart is required, implement:
  - `POST /api/v1/parked-carts`
  - `GET /api/v1/parked-carts`
  - `DELETE /api/v1/parked-carts/:id`
- [ ] Add tests for successful checkout, insufficient stock, partial payment, credit sale, supervisor required, and concurrent checkout.

## Phase 2 - Pembelian, Stok Lanjut, Keuangan

### 5. Stock and Inventory

- [x] Schema includes batches, locations, ledger, alerts, transfers, opname, and expired stock actions.
- [x] Starter batch create exists.
- [x] Starter stock overview exists.
- [ ] Implement canonical `GET /api/v1/stock/overview`.
- [ ] Implement `GET /api/v1/products/:id/stock-card` from `StockLedger`.
- [ ] Implement `GET /api/v1/stock/defekta`.
- [ ] Implement `DELETE /api/v1/stock/defekta/:id`.
- [ ] Implement `POST /api/v1/stock/defekta/bulk-delete`.
- [ ] Implement `GET /api/v1/stock/opname`.
- [ ] Implement `POST /api/v1/stock/opname`.
- [ ] Implement `GET /api/v1/stock/opname/:id/items`.
- [ ] Implement `PATCH /api/v1/stock/opname/:id`.
- [ ] Implement `PUT /api/v1/stock/opname/:id/physical-counts`.
- [ ] Implement `POST /api/v1/stock/opname/:id/close`.
- [ ] Closing opname must create `StockLedger` movement type `OPNAME_ADJUST`.
- [ ] Implement `GET /api/v1/stock/internal-mutations`.
- [ ] Implement `POST /api/v1/stock/internal-mutations`.
- [ ] Internal rack/location mutation must preserve total product stock.
- [ ] Implement `GET /api/v1/stock/reminder-ed`.
- [ ] Generate or maintain stock alerts:
  - low stock
  - expired soon
  - expired
  - negative stock
- [ ] Write audit log for every stock write.

### 6. Purchasing, Invoice, Returns, and Debt

- [x] Schema includes supplier, supplier prices, purchase, purchase items, purchase returns, consignment, debt, and debt payments.
- [ ] Implement `/api/v1/purchase-orders` CRUD using `Purchase` or split schema.
- [ ] Implement `/api/v1/invoices` if invoices remain separate from `Purchase.invoiceNo`.
- [ ] Implement `/api/v1/purchase-returns` CRUD.
- [ ] Implement `/api/v1/sales-returns` CRUD.
- [ ] Implement `/api/v1/debts` list/detail.
- [ ] Implement `POST /api/v1/purchase-orders/:id/receive`.
- [ ] Receiving PO must:
  - update purchase status
  - create or update batches
  - increase stock
  - create `StockLedger` type `PURCHASE`
  - create debt/faktur when not fully paid
  - write audit
- [ ] Implement `POST /api/v1/debts/:id/payments`.
- [ ] Debt payment must:
  - create `DebtPayment`
  - update paid amount
  - update status to `PARTIAL` or `PAID`
  - create `CashMutation` type `DEBT_PAYMENT`
  - write audit
- [ ] Implement `POST /api/v1/sales-returns/:id/approve`.
- [ ] Sales return approval must:
  - validate original sale
  - validate return quantity
  - require supervisor for return over sell
  - restore stock when applicable
  - create refund/cash/receivable adjustment
  - write audit
- [ ] Purchase return must support debt/faktur reduction.
- [ ] Add tests for PO receive, debt payment, purchase return, sale return, and audit/cash side effects.

### 7. Finance

- [x] Schema includes cash accounts, cash mutations, expenses, receivables, debts, and accounting journal models.
- [x] Checkout creates receivable for underpaid sale.
- [ ] Checkout currently does not create cash mutation for paid amount. Add it.
- [ ] Implement `GET /api/v1/cash`.
- [ ] Implement `POST /api/v1/cash`.
- [ ] Implement `GET /api/v1/receivables`.
- [ ] Implement `POST /api/v1/receivables/:id/payments`.
- [ ] Receivable payment must:
  - create `ReceivablePayment`
  - update paid amount
  - update status
  - create `CashMutation` type `RECEIVABLE_PAYMENT`
  - write audit
- [ ] Implement `GET /api/v1/finance/pnl`.
- [ ] Implement `GET /api/v1/finance/cash-flow`.
- [ ] Implement `GET /api/v1/finance/balance-sheet`.
- [ ] Implement `GET /api/v1/finance/ratios`.
- [ ] Implement `GET /api/v1/finance/aging-debts`.
- [ ] Implement `GET /api/v1/finance/aging-receivables`.
- [ ] Ensure cash account balance is calculated or updated server-side only.
- [ ] Decide whether financial reports use live SQL, materialized snapshots, or `AnalyticsSnapshot`.
- [ ] Add tests for cash mutation balance and financial report source consistency.

## Phase 3 - SaaS and Owner

### 8. Owner Hub and Analysis

- [x] Schema includes `AnalyticsSnapshot`, sales, purchase, stock, cash, debt, and receivable sources needed for analytics.
- [ ] Implement `GET /api/v1/owner/dashboard`.
- [ ] Implement `GET /api/v1/owner/daily-brief`.
- [ ] Implement `GET /api/v1/owner/health-score`.
- [ ] Implement `GET /api/v1/owner/warnings`.
- [ ] Implement `GET /api/v1/owner/recommendations`.
- [ ] Implement `GET /api/v1/owner/audit-control`.
- [ ] Implement `GET /api/v1/analysis/inventory`.
- [ ] Implement `GET /api/v1/analysis/pareto`.
- [ ] Implement `GET /api/v1/analysis/product-margin`.
- [ ] Implement `GET /api/v1/analysis/supplier-purchases`.
- [ ] Add caching/materialization where needed by tenant and branch.
- [ ] Enforce owner/admin permissions and package entitlements.

### 9. SaaS Admin and Audit Hardening

- [x] Schema includes audit logs.
- [x] Schema includes tenant features and policies.
- [ ] Ensure every write endpoint emits `AuditLog`.
- [ ] Implement audit list/search endpoint for admins.
- [ ] Implement owner audit-control anomaly queries.
- [ ] Add policy service for feature flags and supervisor gates.
- [ ] Add tenant lifecycle states and subscription expiry enforcement.
- [ ] Add demo reset seed flow.

## Phase 4 - Multi-Cabang and Add-On Modules

### 10. Command Center Multi-Cabang

- [x] Schema includes `Branch`, `StockTransfer`, `PurchasePlan`, `AnalyticsSnapshot`, centralized debts/finance sources.
- [ ] Implement `GET /api/v1/branches`.
- [ ] Implement `GET /api/v1/branches/summary`.
- [ ] Implement `GET /api/v1/branches/comparison`.
- [ ] Implement `GET /api/v1/branches/stock`.
- [ ] Implement `GET /api/v1/branches/product-sync`.
- [ ] Implement `GET /api/v1/branches/mutations`.
- [ ] Implement `GET /api/v1/branches/mutation-recommendations`.
- [ ] Implement `GET /api/v1/branches/central-orders`.
- [ ] Implement `GET /api/v1/branches/distribution`.
- [ ] Implement `GET /api/v1/branches/debts`.
- [ ] Implement `GET /api/v1/branches/consolidated-finance`.
- [ ] Implement `GET /api/v1/branches/kpi`.
- [ ] Implement `GET /api/v1/branches/warnings`.
- [ ] Implement `GET /api/v1/branches/notifications`.
- [ ] Enforce `multi_outlet` entitlement for multi-branch views.
- [ ] Add branch-level permission filters for users without owner_multi/admin access.

### 11. Add-On Modules

- [x] Schema exists for prescriptions, medical records, HR shifts, attendance, purchase planning, and analytics snapshots.
- [ ] Implement resep endpoints:
  - `GET /api/v1/prescriptions`
  - `POST /api/v1/prescriptions`
  - `GET /api/v1/prescriptions/:id`
  - `PATCH /api/v1/prescriptions/:id`
  - `GET /api/v1/prescriptions/history`
  - prescription labels/copies if required by FE
- [ ] Implement CRM endpoints:
  - `GET /api/v1/crm/members`
  - `POST /api/v1/crm/members`
  - `GET /api/v1/crm/campaigns`
  - `POST /api/v1/crm/campaigns`
- [ ] Add CRM campaign/member schema if not already covered by `Customer`.
- [ ] Implement retail endpoints:
  - `GET /api/v1/retail/price-tags`
  - `POST /api/v1/retail/price-tags`
  - `GET /api/v1/retail/promos`
  - `POST /api/v1/retail/promos`
- [ ] Add promo/price tag schema if server-backed retail module is required.
- [ ] Implement HRD endpoints:
  - `GET /api/v1/hrd/shifts`
  - `POST /api/v1/hrd/shifts`
  - `GET /api/v1/hrd/kpis`
- [ ] Implement SOP endpoints:
  - `GET /api/v1/sop/docs`
  - `POST /api/v1/sop/docs`
  - `GET /api/v1/sop/tasks`
  - `POST /api/v1/sop/tasks`
- [ ] Add SOP schema if server-backed SOP docs/tasks are required.
- [ ] Enforce feature entitlement per add-on:
  - `resep`
  - `crm`
  - `retail`
  - `hrd`
  - `sop`
  - `price_tag`
  - `loyalty`
  - `wa_broadcast`

## Acceptance Criteria Mapping

- [ ] AC1: FE can login, see menu by role, and logout via API.
  - Done: login exists.
  - Missing: logout, full `/auth/me`, backend role/permission/entitlement enforcement.
- [ ] AC2: `productRepo.list()` and core CRUD repositories can point to API without page changes.
  - Done: product list exists.
  - Missing: response envelope alignment, full CRUD, FE contract tests.
- [ ] AC3: POS checkout creates transaction, decreases stock, creates stock card, and displays receipt.
  - Done: sale, sale items, payments, batch decrement, stock ledger.
  - Missing: receipt endpoint, canonical route, supervisor gates, cash ledger, stock lock, audit.
- [ ] AC4: Debt/receivable payment changes status and creates cash ledger.
  - Done: debt/receivable/payment/cash models exist.
  - Missing: payment endpoints and cash mutation side effects.
- [ ] AC5: Backend checks permission and entitlement and returns mappable `403`.
  - Done: JWT auth context can carry permissions.
  - Missing: enforcement middleware and standard error shape.
- [ ] AC6: All writes generate audit log.
  - Done: `AuditLog` model exists.
  - Missing: audit service and integration into write endpoints.
- [ ] AC7: Demo seed is available for parity with FE mock data.
  - Done: bootstrap seeds basic categories/units only.
  - Missing: full demo seed parity.
- [x] AC8: Backend provides health check.
- [ ] AC8: Backend provides OpenAPI docs.
- [ ] AC9: MVP1 import/export works through versioned templates and protected file endpoints.
  - Import: product master, units, and opening stock support preview, validation, atomic commit, idempotency, and row-level errors.
  - Export: stock tenant/branch data and required operational reports support filters, CSV/XLSX/PDF contract, download headers, authorization, and audit.
  - FE consumes repository methods for upload/download without page-level data-layer logic.

## Suggested Implementation Order

### Immediate Cleanup Before More Features

- [ ] Remove public access from starter write endpoints or clearly mark them development-only.
- [ ] Add permission and feature middleware before adding module routes.
- [ ] Convert response helpers to PRD envelope before FE integration starts.
- [ ] Add OpenAPI scaffolding while API surface is still small.
- [ ] Add test harness and first integration tests for auth, tenant scope, and checkout.

### Next 10 Concrete Tasks

- [ ] Implement standard API response/error envelope.
- [ ] Implement `requirePermission`, `requireFeature`, `requireTenantScope`, and `requireBranchScope`.
- [ ] Expand `/auth/me` to return full FE session contract.
- [ ] Add `/auth/logout` and `/auth/refresh`.
- [ ] Add supervisor authorization endpoint and consumption logic.
- [ ] Convert starter product/category/unit/branch endpoints into protected module endpoints.
- [ ] Add canonical `POST /pos/checkout` with PRD-compatible request mapping.
- [ ] Add cash mutation and audit side effects to checkout.
- [ ] Add transaction list/detail and receipt endpoints.
- [ ] Add OpenAPI docs and contract tests.

## Risk Notes

- [ ] Stock checkout currently decrements batch stock inside a transaction, but no explicit row-level lock is visible. Parallel checkout can still race depending on database isolation and generated SQL.
- [ ] Public starter endpoints can create tenant/product/stock data without required auth if deployed as-is.
- [ ] Current response format will require FE adapter changes unless fixed to PRD shape.
- [ ] `User.branchId` may be insufficient for "user bisa punya banyak outlets"; add a membership table or clarify that one user has one active/default branch only.
- [ ] `Purchase` currently represents both PO and invoice fields. This may be fine for MVP, but PRD endpoint naming must be mapped carefully.
- [ ] Several schema areas exist without API routes; do not treat schema presence as feature completion.
- [ ] No git repository was detected from this working directory during audit, so change tracking should rely on filesystem review unless repo metadata is restored.
