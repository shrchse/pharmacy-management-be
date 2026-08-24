# Dokumentasi Endpoint Phase 0 dan Phase 1

Base URL lokal: `http://localhost:5000/api/v1`

Dokumen ini hanya mencatat endpoint yang sudah tersedia setelah eksekusi Phase 0 dan Phase 1 dari `workflow.md`.

## Format Response

### Success

```json
{
  "data": {},
  "meta": {
    "message": "Operation successful"
  }
}
```

Untuk list, `data` berupa array.

```json
{
  "data": [],
  "meta": {
    "message": "Products retrieved",
    "count": 0
  }
}
```

### Error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation error",
    "details": []
  }
}
```

Kode umum:

- `BAD_REQUEST`
- `VALIDATION_ERROR`
- `UNAUTHENTICATED`
- `FORBIDDEN`
- `PERMISSION_DENIED`
- `FEATURE_LOCKED`
- `NOT_FOUND`
- `CONFLICT`
- `UNIQUE_CONSTRAINT`
- `DATABASE_ERROR`
- `INTERNAL_ERROR`

## Auth dan Header

Endpoint protected wajib memakai:

```http
Authorization: Bearer <accessToken>
```

Endpoint yang butuh scope outlet/branch bisa memakai salah satu:

```http
X-Branch-Id: <branchId>
X-Outlet-Id: <branchId>
```

`Idempotency-Key` sudah disiapkan sebagai fondasi Phase 0, tetapi penggunaan wajibnya akan masuk ke Phase 2 POS production.

## Phase 0 - Foundation

### Health

| Method | Endpoint | Auth | Keterangan |
|---|---|---|---|
| GET | `/health` | Tidak | Health check database/API |

Response:

```json
{
  "data": {
    "status": "healthy",
    "timestamp": "2026-08-15T00:00:00.000Z",
    "uptime": 10
  },
  "meta": {
    "message": "System health operational"
  }
}
```

### OpenAPI

| Method | Endpoint | Auth | Keterangan |
|---|---|---|---|
| GET | `/docs` | Tidak | Index dokumentasi |
| GET | `/docs/openapi.json` | Tidak | OpenAPI JSON awal |

Response `/docs`:

```json
{
  "data": {
    "openapi": "GET /api/v1/docs/openapi.json"
  },
  "meta": {
    "message": "API documentation endpoints"
  }
}
```

### Auth

| Method | Endpoint | Auth | Keterangan |
|---|---|---|---|
| POST | `/auth/bootstrap` | Tidak | Setup tenant, branch, owner, role, permission, unit, kategori, entitlement awal |
| POST | `/auth/login` | Tidak | Login dan ambil access token |
| POST | `/auth/logout` | Ya | Logout stateless; client membuang token |
| POST | `/auth/refresh` | Ya | Refresh access token dari token aktif |
| GET | `/auth/me` | Ya | Ambil session lengkap: user, tenant, role, permission, entitlement, branch list |
| POST | `/auth/dev-token` | Tidak di production | Buat token development |

Request `/auth/login`:

```json
{
  "email": "owner@example.com",
  "password": "password123"
}
```

Response `/auth/login`:

```json
{
  "data": {
    "accessToken": "<jwt>",
    "user": {
      "id": "<userId>",
      "name": "Owner",
      "email": "owner@example.com",
      "tenantId": "<tenantId>",
      "branchId": "<branchId>",
      "role": "OWNER",
      "permissions": ["product.manage", "stock.read"]
    },
    "tenant": {},
    "branch": {}
  },
  "meta": {
    "message": "Login successful"
  }
}
```

Response `/auth/me`:

```json
{
  "data": {
    "user": {
      "id": "<userId>",
      "name": "Owner",
      "email": "owner@example.com",
      "tenantId": "<tenantId>",
      "branchId": "<branchId>",
      "role": "OWNER",
      "permissions": []
    },
    "tenant": {
      "id": "<tenantId>",
      "name": "Apotek Demo",
      "slug": "apotek-demo",
      "subscriptionStatus": "TRIAL",
      "subscriptionEndsAt": null,
      "trialEndsAt": "2026-08-29T00:00:00.000Z",
      "plan": null,
      "entitlements": [
        {
          "code": "inventory",
          "enabled": true,
          "config": null
        }
      ]
    },
    "activeBranch": {},
    "branches": []
  },
  "meta": {
    "message": "Authenticated session retrieved"
  }
}
```

### Tenant

| Method | Endpoint | Auth | Permission | Keterangan |
|---|---|---|---|---|
| GET | `/tenants/active` | Ya | Login | Tenant aktif user |
| GET | `/internal/tenants` | Ya | `internal.tenant.manage` | List tenant internal |
| POST | `/internal/tenants` | Ya | `internal.tenant.manage` | Buat tenant dari console internal |

Request `/internal/tenants`:

```json
{
  "name": "Apotek Baru",
  "slug": "apotek-baru",
  "email": "admin@apotek.test",
  "phone": "08123456789",
  "address": "Jl. Contoh",
  "taxId": "01.234.567.8-999.000",
  "isDemo": false
}
```

## Phase 1 - Master Data

Semua endpoint Phase 1 wajib `Authorization: Bearer <accessToken>`.

### Branch / Outlet

`Branch` adalah model database. `/outlets` disediakan sebagai alias API untuk kebutuhan istilah produk.

| Method | Endpoint | Permission | Keterangan |
|---|---|---|---|
| GET | `/branches` | `branch.manage` | List branch/outlet tenant |
| POST | `/branches` | `branch.manage` | Buat branch/outlet |
| GET | `/outlets` | `branch.manage` | Alias list branch |
| POST | `/outlets` | `branch.manage` | Alias create branch |

Request:

```json
{
  "code": "MAIN",
  "name": "Cabang Utama",
  "businessCategory": "APOTEK",
  "phone": "021123456",
  "address": "Jl. Utama",
  "siaNumber": "SIA-001",
  "apjName": "Apt. Demo",
  "apjSipaNumber": "SIPA-001"
}
```

### Category

| Method | Endpoint | Permission | Keterangan |
|---|---|---|---|
| GET | `/categories` | `product.manage` | List kategori |
| POST | `/categories` | `product.manage` | Buat kategori |

Request:

```json
{
  "name": "Obat Bebas",
  "type": "OBAT_BEBAS"
}
```

### Unit

| Method | Endpoint | Permission | Keterangan |
|---|---|---|---|
| GET | `/units` | `product.manage` | List satuan |
| POST | `/units` | `product.manage` | Buat satuan |

Request:

```json
{
  "code": "TABLET",
  "name": "Tablet"
}
```

### Rack / Stock Location

`/racks` memakai model `StockLocation`.

| Method | Endpoint | Permission | Header Branch | Keterangan |
|---|---|---|---|---|
| GET | `/racks` | `stock.read` | Ya | List rak/lokasi stok |
| POST | `/racks` | `stock.adjust` | Ya, atau body `branchId` | Buat rak/lokasi stok |

Request:

```json
{
  "code": "R-A1",
  "name": "Rak A1",
  "type": "RACK"
}
```

### Supplier

| Method | Endpoint | Permission | Keterangan |
|---|---|---|---|
| GET | `/suppliers` | `purchase.manage` | List supplier |
| POST | `/suppliers` | `purchase.manage` | Buat supplier |

Request:

```json
{
  "code": "PBF-001",
  "name": "PBF Demo",
  "type": "PBF",
  "email": "sales@pbf.test",
  "phone": "08123456789",
  "address": "Jl. Supplier",
  "taxId": "01.234.567.8-999.000",
  "contactPerson": "Budi"
}
```

### Customer

| Method | Endpoint | Permission | Keterangan |
|---|---|---|---|
| GET | `/customers` | `product.manage` | List customer/member |
| POST | `/customers` | `product.manage` | Buat customer/member |

Request:

```json
{
  "memberNo": "MBR-001",
  "name": "Customer Demo",
  "phone": "08123456789",
  "email": "customer@example.com",
  "address": "Jl. Customer",
  "birthDate": "1990-01-01",
  "gender": "F"
}
```

### Doctor

| Method | Endpoint | Permission | Keterangan |
|---|---|---|---|
| GET | `/doctors` | `product.manage` | List dokter/practitioner awal |
| POST | `/doctors` | `product.manage` | Buat dokter/practitioner awal |

Request:

```json
{
  "name": "dr. Demo",
  "sipNumber": "SIP-001",
  "phone": "08123456789",
  "address": "Jl. Dokter"
}
```

### User

| Method | Endpoint | Permission | Keterangan |
|---|---|---|---|
| GET | `/users` | `user.manage` | List user tenant |
| POST | `/users` | `user.manage` | Buat user tenant |

Request:

```json
{
  "branchId": "<branchId>",
  "roleId": "<roleId>",
  "name": "Kasir Demo",
  "email": "kasir@example.com",
  "phone": "08123456789",
  "password": "password123",
  "sipaNumber": null
}
```

## Phase 1 - Products

### Product

| Method | Endpoint | Permission | Keterangan |
|---|---|---|---|
| GET | `/products` | `stock.read` | List produk |
| POST | `/products` | `product.manage` | Buat produk beserta base unit |
| GET | `/products/search?q=paracetamol` | `stock.read` | Search produk POS/master |
| GET | `/products/:id` | `stock.read` | Detail produk |
| PATCH | `/products/:id` | `product.manage` | Update produk dan harga base unit bila dikirim |
| DELETE | `/products/:id` | `product.manage` | Delete produk jika belum punya histori transaksi/stok |
| GET | `/products/:id/batches` | `stock.read` | List batch produk |

Request `POST /products`:

```json
{
  "categoryId": "<categoryId>",
  "defaultSupplierId": "<supplierId>",
  "code": "OBT-001",
  "barcode": "899000000001",
  "name": "Paracetamol 500mg",
  "genericName": "Paracetamol",
  "brandName": "DemoMed",
  "registrationNumber": "DBL000000001",
  "dosageForm": "Tablet",
  "strength": "500mg",
  "composition": "Paracetamol 500mg",
  "manufacturer": "Pabrik Demo",
  "principal": "Principal Demo",
  "productType": "MEDICINE",
  "controlledClass": "NONE",
  "requiresPrescription": false,
  "minStock": 10,
  "maxStock": 1000,
  "unitId": "<unitId>",
  "conversion": 1,
  "sellingPrice": 5000,
  "purchasePrice": 3000
}
```

Response list/detail:

```json
{
  "data": {
    "id": "<productId>",
    "tenantId": "<tenantId>",
    "categoryId": "<categoryId>",
    "code": "OBT-001",
    "name": "Paracetamol 500mg",
    "status": "ACTIVE",
    "category": {},
    "defaultSupplier": {},
    "units": []
  },
  "meta": {
    "message": "Product retrieved"
  }
}
```

## Phase 1 - Inventory

Semua endpoint inventory yang membaca/menulis branch stock butuh `X-Branch-Id` atau `X-Outlet-Id`.

### Stock Summary

| Method | Endpoint | Permission | Keterangan |
|---|---|---|---|
| GET | `/stock/overview` | `stock.read` | Ringkasan stok per produk dari batch |
| GET | `/stock/defekta` | `stock.read` | Produk dengan total stok <= minStock |
| GET | `/stock/reminder-ed?days=90` | `stock.read` | Batch aktif yang akan expired dalam N hari |
| GET | `/products/:id/stock-card` | `stock.read` | Kartu stok dari `StockLedger` |

Response `/stock/overview`:

```json
{
  "data": [
    {
      "productId": "<productId>",
      "code": "OBT-001",
      "name": "Paracetamol 500mg",
      "totalStock": 100,
      "reservedStock": 0,
      "availableStock": 100,
      "minStock": 10,
      "nearestExpiredDate": "2027-01-01T00:00:00.000Z",
      "locations": ["Rak A1"]
    }
  ],
  "meta": {
    "message": "Stock overview retrieved"
  }
}
```

### Batch

| Method | Endpoint | Permission | Keterangan |
|---|---|---|---|
| POST | `/stock/batches` | `stock.adjust` | Buat batch awal/manual dan stock ledger awal |

Request:

```json
{
  "productId": "<productId>",
  "batchNumber": "BATCH-001",
  "expiredDate": "2027-01-01",
  "buyPrice": 3000,
  "stock": 100,
  "locationId": "<stockLocationId>",
  "notes": "Initial stock"
}
```

### Stock Opname

| Method | Endpoint | Permission | Keterangan |
|---|---|---|---|
| GET | `/stock/opname` | `stock.read` | List opname |
| POST | `/stock/opname` | `stock.adjust` | Buat opname draft dari batch dan realStock |
| POST | `/stock/opname/:id/close` | `stock.adjust` | Close opname, adjust batch stock, dan buat stock ledger |

Request `POST /stock/opname`:

```json
{
  "code": "OPN-2026-001",
  "notes": "Opname bulanan",
  "items": [
    {
      "batchId": "<batchId>",
      "realStock": 95
    }
  ]
}
```

### Internal Mutation

| Method | Endpoint | Permission | Keterangan |
|---|---|---|---|
| POST | `/stock/internal-mutations` | `stock.adjust` | Pindah batch penuh ke rack/lokasi lain |

Request:

```json
{
  "batchId": "<batchId>",
  "toLocationId": "<stockLocationId>",
  "qty": 100,
  "notes": "Pindah ke rak display"
}
```

Catatan: mutasi sebagian batch belum didukung karena schema saat ini punya unique constraint batch tanpa `locationId`. Jika `qty` tidak sama dengan stok batch penuh, API mengembalikan `PARTIAL_MUTATION_NOT_SUPPORTED`.

## Phase 2 - Cashier Shift dan Blind Close

Semua endpoint cashier shift butuh `Authorization: Bearer <accessToken>` dan `X-Branch-Id` atau `X-Outlet-Id`.

### Cashier Shift

| Method | Endpoint | Permission | Keterangan |
|---|---|---|---|
| POST | `/cashier-shifts/open` | `pos.checkout` | Buka shift kasir |
| GET | `/cashier-shifts/:id` | `pos.checkout` | Detail shift dan sale dalam shift |
| POST | `/cashier-shifts/:id/close` | `pos.checkout` | Blind close; kasir hanya kirim actual cash |
| POST | `/cashier-shifts/:id/deposit` | `finance.manage` | Catat setoran kas |
| POST | `/cashier-shifts/:id/verify` | `stock.adjust` | Verifikasi leader/apoteker |

Request `POST /cashier-shifts/open`:

```json
{
  "cashierId": "<userId>",
  "startingCash": 200000,
  "notes": "Shift pagi"
}
```

Response:

```json
{
  "data": {
    "id": "<shiftId>",
    "tenantId": "<tenantId>",
    "branchId": "<branchId>",
    "cashierId": "<userId>",
    "openedAt": "2026-08-15T01:00:00.000Z",
    "closedAt": null,
    "startingCash": "200000",
    "expectedCash": null,
    "actualCash": null,
    "difference": null,
    "status": "OPEN"
  },
  "meta": {
    "message": "Cashier shift opened"
  }
}
```

Request `POST /cashier-shifts/:id/close`:

```json
{
  "actualCash": 750000,
  "notes": "Close shift pagi"
}
```

Catatan blind close: client tidak mengirim dan tidak perlu mengetahui `expectedCash` sebelum close. Server menghitung:

```text
expectedCash = startingCash + total CASH payment dari sale COMPLETED dalam shift
difference = actualCash - expectedCash
```

Response close:

```json
{
  "data": {
    "id": "<shiftId>",
    "status": "CLOSED",
    "expectedCash": "750000",
    "actualCash": "750000",
    "difference": "0",
    "closedAt": "2026-08-15T09:00:00.000Z"
  },
  "meta": {
    "message": "Cashier shift closed"
  }
}
```

Request `POST /cashier-shifts/:id/deposit`:

```json
{
  "depositAmount": 750000,
  "notes": "Setor ke brankas"
}
```

Request `POST /cashier-shifts/:id/verify`:

```json
{
  "approved": true,
  "notes": "Sesuai"
}
```

## Phase 2 - POS dan Transaksi

Semua endpoint POS/transaksi butuh `Authorization: Bearer <accessToken>` dan `X-Branch-Id` atau `X-Outlet-Id`.

### POS Checkout Production

| Method | Endpoint | Permission | Header Tambahan | Keterangan |
|---|---|---|---|---|
| POST | `/pos/checkout` | `pos.checkout` | `Idempotency-Key` wajib | Checkout atomik dengan FEFO, cash ledger, receivable, audit |

Request:

```http
Idempotency-Key: checkout-20260815-0001
```

```json
{
  "cashierId": "<userId>",
  "sessionId": "<shiftId>",
  "customerId": "<customerId>",
  "saleType": "REGULAR",
  "channel": "OFFLINE",
  "discountAmount": 0,
  "taxAmount": 0,
  "items": [
    {
      "productId": "<productId>",
      "productUnitId": "<productUnitId>",
      "qty": 2,
      "unitPrice": 5000,
      "discountAmount": 0
    }
  ],
  "payments": [
    {
      "method": "CASH",
      "amount": 10000,
      "referenceNo": "CASH"
    }
  ]
}
```

Response:

```json
{
  "data": {
    "id": "<saleId>",
    "invoiceNumber": "INV-20260815010000-ABCD",
    "status": "COMPLETED",
    "paymentStatus": "PAID",
    "totalAmount": "10000",
    "grandTotal": "10000",
    "paidAmount": "10000",
    "changeAmount": "0",
    "saleItems": [],
    "payments": [],
    "grossProfit": "4000"
  },
  "meta": {
    "message": "Checkout completed"
  }
}
```

Jika request yang sama dikirim ulang dengan `Idempotency-Key` dan body yang sama, API mengembalikan response cache:

```json
{
  "data": {
    "id": "<saleId>",
    "invoiceNumber": "INV-20260815010000-ABCD"
  },
  "meta": {
    "message": "Checkout replayed from idempotency cache"
  }
}
```

Error penting:

```json
{
  "error": {
    "code": "IDEMPOTENCY_KEY_REQUIRED",
    "message": "Idempotency-Key header is required"
  }
}
```

```json
{
  "error": {
    "code": "SHIFT_REQUIRED",
    "message": "Open cashier shift is required before checkout"
  }
}
```

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Insufficient stock for product: <productId>"
  }
}
```

### Transactions

| Method | Endpoint | Permission | Keterangan |
|---|---|---|---|
| GET | `/transactions` | `pos.checkout` | List transaksi branch aktif |
| GET | `/transactions?status=COMPLETED` | `pos.checkout` | Filter status transaksi |
| GET | `/transactions/:id` | `pos.checkout` | Detail transaksi |
| POST | `/transactions/:id/cancel` | `sale.return` | Cancel transaksi completed, restock batch, cash out, audit |
| GET | `/receipts/:transactionId` | `pos.checkout` | Data struk untuk print thermal |

Response `GET /transactions`:

```json
{
  "data": [
    {
      "id": "<saleId>",
      "invoiceNumber": "INV-20260815010000-ABCD",
      "status": "COMPLETED",
      "paymentStatus": "PAID",
      "grandTotal": "10000",
      "paidAmount": "10000",
      "createdAt": "2026-08-15T01:00:00.000Z",
      "payments": [],
      "customer": null,
      "cashier": {}
    }
  ],
  "meta": {
    "message": "Transactions retrieved",
    "count": 1
  }
}
```

Request `POST /transactions/:id/cancel`:

```json
{
  "reason": "Input transaksi salah"
}
```

Response:

```json
{
  "data": {
    "id": "<saleId>",
    "status": "CANCELLED",
    "paymentStatus": "CANCELLED",
    "cancelReason": "Input transaksi salah",
    "cancelledAt": "2026-08-15T02:00:00.000Z"
  },
  "meta": {
    "message": "Transaction cancelled"
  }
}
```

Response `GET /receipts/:transactionId`:

```json
{
  "data": {
    "transactionId": "<saleId>",
    "invoiceNumber": "INV-20260815010000-ABCD",
    "issuedAt": "2026-08-15T01:00:00.000Z",
    "branch": {
      "name": "Cabang Utama",
      "address": "Jl. Utama",
      "phone": "021123456",
      "siaNumber": "SIA-001"
    },
    "cashier": {
      "id": "<userId>",
      "name": "Kasir Demo",
      "email": "kasir@example.com"
    },
    "customer": null,
    "items": [],
    "totals": {
      "totalAmount": "10000",
      "discountAmount": "0",
      "taxAmount": "0",
      "grandTotal": "10000",
      "paidAmount": "10000",
      "changeAmount": "0"
    },
    "payments": [],
    "status": "COMPLETED"
  },
  "meta": {
    "message": "Receipt retrieved"
  }
}

```

## Phase 3 - Purchasing, Finance, dan Compliance

Semua endpoint Phase 3 wajib `Authorization: Bearer <accessToken>` dan umumnya butuh `X-Branch-Id` atau `X-Outlet-Id`.

### Purchase Order dan APJ Approval

| Method | Endpoint | Permission | Keterangan |
|---|---|---|---|
| POST | `/purchase-orders/apj-pin` | `purchase.manage` | Set APJ PIN user aktif |
| GET | `/purchase-orders` | `purchase.manage` | List purchase order branch aktif |
| POST | `/purchase-orders` | `purchase.manage` | Buat purchase order draft |
| GET | `/purchase-orders/:id` | `purchase.manage` | Detail purchase order + approval |
| POST | `/purchase-orders/:id/submit-approval` | `purchase.manage` | Submit PO untuk approval APJ |
| POST | `/purchase-orders/:id/approve-apj` | `purchase.manage` | Approve PO dengan APJ PIN |
| POST | `/purchase-orders/:id/receive` | `purchase.manage` | Receive PO menjadi batch, stock ledger, dan debt |
| GET | `/invoices` | `purchase.manage` | List purchase dengan invoice |
| GET | `/purchase-returns` | `purchase.manage` | List retur pembelian |
| POST | `/purchase-returns` | `purchase.manage` | Buat retur pembelian |

Request `POST /purchase-orders/apj-pin`:

```json
{
  "pin": "123456"
}
```

Request `POST /purchase-orders`:

```json
{
  "supplierId": "<supplierId>",
  "poNumber": "PO-2026-001",
  "discountAmount": 0,
  "taxAmount": 0,
  "items": [
    {
      "productId": "<productId>",
      "productUnitId": "<productUnitId>",
      "qty": 10,
      "buyPrice": 3000
    }
  ]
}
```

Response:

```json
{
  "data": {
    "id": "<purchaseId>",
    "poNumber": "PO-2026-001",
    "status": "DRAFT",
    "totalAmount": "30000",
    "grandTotal": "30000",
    "purchaseItems": []
  },
  "meta": {
    "message": "Purchase order created"
  }
}
```

Request `POST /purchase-orders/:id/submit-approval`:

```json
{
  "notes": "Mohon approval APJ"
}
```

Request `POST /purchase-orders/:id/approve-apj`:

```json
{
  "pin": "123456",
  "notes": "Approved"
}
```

Response approve:

```json
{
  "data": {
    "purchase": {
      "id": "<purchaseId>",
      "status": "ORDERED"
    },
    "approval": {
      "id": "<approvalId>",
      "status": "APPROVED",
      "approvedAt": "2026-08-15T03:00:00.000Z"
    }
  },
  "meta": {
    "message": "Purchase order approved by APJ"
  }
}
```

Request `POST /purchase-orders/:id/receive`:

```json
{
  "invoiceNo": "INV-PBF-001",
  "dueDate": "2026-09-15",
  "items": [
    {
      "purchaseItemId": "<purchaseItemId>",
      "receivedQty": 10,
      "batchNumber": "BATCH-PBF-001",
      "expiredDate": "2027-01-01",
      "locationId": "<stockLocationId>"
    }
  ]
}
```

Response receive:

```json
{
  "data": {
    "purchase": {
      "id": "<purchaseId>",
      "status": "RECEIVED",
      "invoiceNo": "INV-PBF-001"
    },
    "debt": {
      "id": "<debtId>",
      "invoiceNo": "INV-PBF-001",
      "amount": "30000",
      "status": "UNPAID"
    }
  },
  "meta": {
    "message": "Purchase order received"
  }
}
```

Request `POST /purchase-returns`:

```json
{
  "purchaseId": "<purchaseId>",
  "returnNumber": "RB-2026-001",
  "reason": "Barang rusak",
  "items": [
    {
      "purchaseItemId": "<purchaseItemId>",
      "batchId": "<batchId>",
      "qty": 2
    }
  ]
}
```

### Finance

| Method | Endpoint | Permission | Keterangan |
|---|---|---|---|
| GET | `/cash` | `finance.manage` | List cash account |
| POST | `/cash` | `finance.manage` | Buat cash account |
| GET | `/cash/mutations` | `finance.manage` | List cash ledger |
| POST | `/cash/mutations` | `finance.manage` | Cash in/out/manual |
| GET | `/debts` | `finance.manage` | List hutang supplier |
| POST | `/debts/:id/pay` | `finance.manage` | Bayar hutang dan catat cash mutation |
| GET | `/receivables` | `finance.manage` | List piutang customer |
| POST | `/receivables/:id/pay` | `finance.manage` | Terima pembayaran piutang dan catat cash mutation |
| POST | `/expenses` | `finance.manage` | Buat expense |
| GET | `/finance/pnl` | `finance.manage` | P&L ringkas |
| GET | `/finance/cash-flow` | `finance.manage` | Cash flow by mutation type |
| GET | `/finance/balance-sheet` | `finance.manage` | Balance sheet summary |
| GET | `/finance/ratios` | `finance.manage` | Rasio ringkas |
| GET | `/finance/aging-debts` | `finance.manage` | Aging hutang |
| GET | `/finance/aging-receivables` | `finance.manage` | Aging piutang |

Request `POST /cash`:

```json
{
  "branchId": "<branchId>",
  "code": "KAS-UTAMA",
  "name": "Kas Utama",
  "openingBalance": 1000000
}
```

Request `POST /debts/:id/pay`:

```json
{
  "cashAccountId": "<cashAccountId>",
  "paymentMethod": "TRANSFER",
  "amount": 30000,
  "referenceNo": "TRF-001"
}
```

Response payment:

```json
{
  "data": {
    "debt": {
      "id": "<debtId>",
      "paidAmount": "30000",
      "status": "PAID"
    },
    "payment": {
      "id": "<paymentId>",
      "amount": "30000"
    }
  },
  "meta": {
    "message": "Debt payment recorded"
  }
}
```

Response `GET /finance/pnl`:

```json
{
  "data": {
    "revenue": "100000",
    "cogs": "60000",
    "grossProfit": "40000",
    "expenses": "10000",
    "netProfit": "30000"
  },
  "meta": {
    "message": "P&L report retrieved"
  }
}
```

### Compliance / License

| Method | Endpoint | Permission | Keterangan |
|---|---|---|---|
| GET | `/licenses` | `compliance.manage` atau `finance.manage` | List izin outlet/tenant |
| POST | `/licenses` | `compliance.manage` atau `finance.manage` | Buat license SIA/izin lain |
| PATCH | `/licenses/:id` | `compliance.manage` atau `finance.manage` | Update license |
| GET | `/practitioner-licenses` | `compliance.manage` atau `finance.manage` | List SIPA/practitioner license |
| POST | `/practitioner-licenses` | `compliance.manage` atau `finance.manage` | Buat practitioner license |
| PATCH | `/practitioner-licenses/:id` | `compliance.manage` atau `finance.manage` | Update practitioner license |
| GET | `/licenses/alerts` | `compliance.manage` atau `finance.manage` | Alert expiry 90/60/30/7 hari |

Request `POST /licenses`:

```json
{
  "branchId": "<branchId>",
  "code": "SIA-MAIN",
  "type": "SIA",
  "holderName": "Apotek Demo",
  "number": "SIA-001",
  "issuedAt": "2026-01-01",
  "expiredAt": "2027-01-01",
  "status": "ACTIVE",
  "notes": "Izin apotek cabang utama"
}
```

Request `POST /practitioner-licenses`:

```json
{
  "branchId": "<branchId>",
  "practitionerName": "Apt. Demo",
  "profession": "APOTEKER",
  "licenseType": "SIPA",
  "number": "SIPA-001",
  "issuedAt": "2026-01-01",
  "expiredAt": "2027-01-01",
  "status": "ACTIVE"
}
```

Response `GET /licenses/alerts`:

```json
{
  "data": [
    {
      "source": "License",
      "id": "<licenseId>",
      "branchId": "<branchId>",
      "type": "SIA",
      "number": "SIA-001",
      "holderName": "Apotek Demo",
      "expiredAt": "2027-01-01T00:00:00.000Z",
      "daysUntilExpiry": 30,
      "level": 30
    }
  ],
  "meta": {
    "message": "License alerts retrieved",
    "count": 1,
    "windows": [90, 60, 30, 7]
  }
}

```

## Endpoint Prototype Lama yang Masih Ada

Endpoint `src/modules/starter` masih dipertahankan untuk compatibility dan eksperimen awal. Route produksi Phase 1 dimount sebelum `starter`, jadi jika path sama, route produksi akan dipakai lebih dulu.

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/starter` | Index endpoint starter |
| GET | `/tenants` | Starter list tenant |
| POST | `/tenants` | Starter create tenant |
| GET | `/tenants/:tenantId/branches` | Starter list branches |
| POST | `/tenants/:tenantId/branches` | Starter create branch |
| POST | `/tenants/:tenantId/categories` | Starter create category |
| GET | `/tenants/:tenantId/products` | Starter list products |
| POST | `/branches/:branchId/stock/batches` | Starter create batch |
| GET | `/branches/:branchId/stock/overview` | Starter stock overview |
| POST | `/branches/:branchId/pos/checkout` | Starter checkout prototype |

## Catatan Implementasi

- Semua write baru Phase 1 memanggil `auditLog`.
- Permission middleware sudah tersedia: `requirePermission`, `requireAnyPermission`.
- Entitlement middleware sudah tersedia: `requireFeature`.
- Migration `20260815100000_phase0_foundation` menambahkan `IdempotencyKey` dan RLS baseline.
- RLS membutuhkan session variable database `app.tenant_id` agar efektif sebagai second layer isolation.
- POS production dan cashier shift belum masuk dokumen ini karena berada di Phase 2.
