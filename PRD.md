# PRD Backend - Kelola Apotek SIM API

## Ringkasan

Kelola Apotek adalah aplikasi SIM Apotek berbasis React/Vite yang saat ini berjalan penuh di browser memakai mock deterministic, Zustand persist, dan localStorage collections. Backend yang dibangun dari PRD ini bertugas mengganti lapisan mock/localStorage menjadi API multi-tenant yang aman, transactional, dan tetap kompatibel dengan kontrak repository FE.

Dokumen ini ditulis dari analisis repo FE saat ini:

- `README.md`: 64 halaman, 3 tier produk, alur mock ke API.
- `src/services/`: repository layer async yang menjadi titik integrasi backend.
- `src/types/`: model TypeScript utama.
- `src/lib/rbac.ts`: role, permission, route gate, supervisor authorization.
- `src/stores/*.ts`: state lokal yang perlu dipindah sebagian ke backend.

## Tujuan Produk

1. Menyediakan REST API untuk operasional apotek: POS, transaksi, produk, stok, pembelian, mitra, keuangan, laporan, dan pengaturan.
2. Menjadi source of truth untuk auth, role, permission, tenant, entitlement, subscription, audit log, stok, transaksi, dan data finansial.
3. Mempertahankan pengalaman FE yang sudah ada dengan perubahan minimal di `src/services/repository/*`.
4. Mendukung 3 tier produk:
   - Tier 1: operasional outlet.
   - Tier 2: owner control dan analisis.
   - Tier 3: command center multi-cabang.
5. Menjamin operasi sensitif berjalan atomik dan auditable: checkout POS, update stok, pembayaran hutang/piutang, opname, mutasi, retur, dan override supervisor.

## Non-Goals

- Tidak membangun ulang UI.
- Tidak mengganti routing, desain, atau state UI FE.
- Tidak membangun integrasi pembayaran, WhatsApp, e-Faktur, BPOM, SSO enterprise, atau mobile app native pada MVP.
- Tidak memindahkan draft UI sementara seperti command palette state, toast, dan layout preference ke backend.

## Pengguna dan Role

Role harus mengikuti `src/types/index.ts` dan `src/lib/rbac.ts`.

| Role | Kebutuhan utama |
|---|---|
| `kasir` | POS, transaksi, shift, baca produk/stok/mitra |
| `apoteker` | Operasional outlet, produk/stok write, opname, pembelian |
| `owner_outlet` | Kontrol outlet, keuangan, owner hub, analisis |
| `owner_multi` | Semua outlet dalam grup, command center multi-cabang |
| `admin` | Akses penuh tenant, user management, audit |
| `superadmin` | Internal console SaaS untuk tenant, paket, subscription |

## Prinsip Integrasi FE

Backend tidak boleh memaksa refactor komponen FE. Semua integrasi dilakukan melalui repository layer:

```text
features/pages -> services/repository -> API client -> Backend
```

Kontrak method FE saat ini harus tetap:

- Collection generik: `list`, `getById`, `create`, `update`, `remove`, `replaceAll`.
- Custom domain: `pay`, `checkout`, `approveJual`, `listOpnameSessions`, `saveOpnamePhysical`, dan method read-only analitik.
- Semua return berupa `Promise<T>` atau `Promise<T[]>` sesuai tipe di `src/types`.

## Arsitektur Target

### API Style

- Base path: `/api/v1`.
- Transport: HTTPS JSON.
- Auth: short-lived access token plus refresh token httpOnly cookie, atau Bearer token bila backend dan FE berbeda domain.
- Response sukses:

```json
{
  "data": {},
  "meta": {}
}
```

- Response error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input tidak valid.",
    "details": {}
  }
}
```

FE repository boleh mengembalikan `json.data` agar komponen tetap menerima tipe lama.

### Multi-Tenant

Semua data operasional wajib terscope oleh `tenantId` dan, jika relevan, `outletId`.

- User bisa punya banyak `outlets`.
- Request outlet aktif dikirim via header `X-Outlet-Id` atau query `outletId`.
- Superadmin memakai endpoint `/internal/*` dan tidak bercampur dengan data outlet biasa.

### Data Store

Rekomendasi MVP:

- PostgreSQL untuk transaksi, master, stok, audit, subscription.
- Redis optional untuk cache dashboard dan refresh/session.
- Object storage optional untuk export laporan atau lampiran masa depan.

### Audit

Setiap write harus menghasilkan audit trail:

- `ts`
- `tenantId`
- `outletId`
- `actorUserId`
- `action`
- `entity`
- `entityId`
- `before`
- `after`
- `ip`
- `userAgent`
- `supervisorAuthorizationId` jika ada

## Modul dan Requirement

### 1. Auth, RBAC, dan Supervisor Authorization

Requirement:

- Login by email/password.
- `GET /auth/me` mengembalikan user, tenant aktif, outlet list, role, permissions, entitlement, subscription status.
- Backend melakukan permission check berdasarkan role dan entitlement.
- Supervisor authorization untuk aksi:
  - `cancel_paid_trx`
  - `discount_over_50`
  - `return_over_sell`
  - `sell_empty_stock`
  - `delete_product_with_history`
  - `edit_sell_price`

Endpoint:

| Method | Path | Fungsi |
|---|---|---|
| POST | `/auth/login` | Login |
| POST | `/auth/logout` | Logout |
| GET | `/auth/me` | Session current user |
| POST | `/auth/refresh` | Refresh session |
| POST | `/auth/supervisor-authorizations` | Verifikasi supervisor untuk aksi sensitif |

### 2. Tenant, Entitlement, dan Subscription

Mengganti `tenant.store.ts` sebagai source of truth server-side.

Endpoint:

| Method | Path | Fungsi |
|---|---|---|
| GET | `/internal/tenants` | List tenant untuk superadmin |
| POST | `/internal/tenants` | Buat tenant |
| GET | `/internal/tenants/:id` | Detail tenant |
| PATCH | `/internal/tenants/:id` | Update profil tenant |
| PATCH | `/internal/tenants/:id/entitlement` | Ubah paket/feature toggle |
| PATCH | `/internal/tenants/:id/subscription` | Ubah masa langganan |
| POST | `/internal/tenants/:id/reset-demo` | Reset seed tenant demo |
| GET | `/tenants/active` | Tenant aktif user |
| POST | `/tenants/active` | Switch tenant/outlet aktif |

Feature dan paket mengikuti `src/mocks/featureRegistry.ts`:

- Paket: `start`, `grow`, `scale`.
- Feature/module: `inventory`, `purchasing`, `finance`, `multi_outlet`, `resep`, `retail`, `crm`, `hrd`, `sop`.
- Add-on: `reminder_ed`, `loyalty`, `wa_broadcast`, `price_tag`.

### 3. Master Data

Endpoint CRUD:

| Resource | Endpoint |
|---|---|
| Produk | `/products` |
| Kategori | `/categories` |
| Satuan | `/units` |
| Rak | `/racks` |
| Supplier | `/suppliers` |
| Pelanggan | `/customers` |
| Dokter | `/doctors` |
| User tenant | `/users` |
| Outlet | `/outlets` |

Requirement khusus produk:

- Search by nama, kandungan/zat aktif, ID/SKU/barcode.
- Validasi harga jual, HPP, stok minimum, ED date, kategori, rak.
- Delete produk dengan riwayat transaksi wajib supervisor authorization.
- Update harga jual wajib supervisor authorization jika policy tenant mengaktifkan gate.

### 4. POS dan Transaksi

Checkout harus satu transaksi database:

1. Validasi cart dan stok.
2. Validasi supervisor override jika stok kosong atau diskon >50%.
3. Buat transaksi.
4. Buat transaction lines.
5. Kurangi stok.
6. Buat stock movement.
7. Jika metode `Piutang`, buat entry piutang.
8. Jika tunai/QRIS/transfer, buat cash ledger sesuai policy outlet.
9. Tulis audit.

Endpoint:

| Method | Path | Fungsi |
|---|---|---|
| GET | `/transactions` | List transaksi |
| GET | `/transactions/:id` | Detail transaksi |
| POST | `/pos/checkout` | Checkout atomik |
| POST | `/transactions/:id/cancel` | Batalkan transaksi paid, butuh supervisor |
| GET | `/receipts/:transactionId` | Data struk |
| GET | `/products/search` | Search produk POS |
| POST | `/parked-carts` | Optional: simpan transaksi tertunda lintas device |
| GET | `/parked-carts` | Optional: list transaksi tertunda |
| DELETE | `/parked-carts/:id` | Optional: hapus transaksi tertunda |

Minimal request checkout:

```json
{
  "customerId": "c001",
  "method": "Tunai",
  "trxType": "bebas",
  "doctorId": null,
  "discount": 0,
  "paid": 50000,
  "lines": [
    { "productId": "p001", "qty": 1, "price": 12000, "discount": 0 }
  ],
  "supervisorAuthorizationIds": []
}
```

### 5. Stok dan Inventory

Endpoint:

| Method | Path | Fungsi |
|---|---|---|
| GET | `/stock/overview` | Ringkasan stok |
| GET | `/products/:id/stock-card` | Kartu stok dari movement |
| GET | `/stock/defekta` | List defekta |
| DELETE | `/stock/defekta/:id` | Hapus item defekta |
| POST | `/stock/defekta/bulk-delete` | Hapus banyak defekta |
| GET | `/stock/opname` | List session opname |
| POST | `/stock/opname` | Buat session opname |
| GET | `/stock/opname/:id/items` | Item opname |
| PATCH | `/stock/opname/:id` | Update status session |
| PUT | `/stock/opname/:id/physical-counts` | Simpan hitungan fisik |
| POST | `/stock/opname/:id/close` | Tutup opname dan buat adjustment |
| GET | `/stock/internal-mutations` | List mutasi internal |
| POST | `/stock/internal-mutations` | Buat mutasi rak internal |
| GET | `/stock/reminder-ed` | Produk mendekati expired |

Business rules:

- Stock card harus berasal dari stock movement, bukan angka generate.
- Opname close menghasilkan movement `Opname`.
- Mutasi internal antar rak tidak mengubah total stok produk, tetapi mengubah lokasi stok/rak dan audit.
- Defekta otomatis dapat dihitung dari `stock <= min`, tetapi tetap boleh ada item manual.

### 6. Pembelian, Faktur, Retur, Hutang

Endpoint:

| Resource | Endpoint |
|---|---|
| Purchase order | `/purchase-orders` |
| Faktur supplier | `/invoices` |
| Retur beli | `/purchase-returns` |
| Retur jual | `/sales-returns` |
| Hutang supplier | `/debts` |

Endpoint khusus:

| Method | Path | Fungsi |
|---|---|---|
| POST | `/purchase-orders/:id/receive` | Terima PO, update stok dan faktur |
| POST | `/debts/:id/payments` | Bayar hutang |
| POST | `/sales-returns/:id/approve` | Approve retur jual |

Business rules:

- Receive PO harus menambah stok dan stock movement `Pembelian`.
- Faktur dengan `sisa <= 0` menjadi `lunas`.
- Retur beli bentuk `Pengurangan hutang` mengurangi hutang/faktur terkait.
- Retur jual dapat mengembalikan stok dan mencatat refund/saldo sesuai bentuk retur.

### 7. Keuangan

Endpoint:

| Method | Path | Fungsi |
|---|---|---|
| GET | `/cash` | Buku kas |
| POST | `/cash` | Tambah cash entry |
| GET | `/receivables` | List piutang |
| POST | `/receivables/:id/payments` | Bayar piutang |
| GET | `/finance/pnl` | Laba rugi |
| GET | `/finance/cash-flow` | Arus kas |
| GET | `/finance/balance-sheet` | Neraca |
| GET | `/finance/ratios` | Rasio |
| GET | `/finance/aging-debts` | Aging hutang |
| GET | `/finance/aging-receivables` | Aging piutang |

Business rules:

- Semua pembayaran hutang/piutang harus membuat cash entry dan audit.
- Saldo cash ledger dihitung server-side dan tidak boleh dipercaya dari client.
- Laporan finansial boleh cached, tetapi sumbernya tetap transaksi, cash, hutang, piutang, dan faktur.

### 8. Owner Hub dan Analisis

Endpoint read-only agregasi:

| Path | Fungsi |
|---|---|
| `/owner/dashboard` | KPI owner |
| `/owner/daily-brief` | Daily brief |
| `/owner/health-score` | Health score outlet |
| `/owner/warnings` | Warning center |
| `/owner/recommendations` | Rekomendasi bisnis |
| `/owner/audit-control` | Audit kontrol/anomali |
| `/analysis/inventory` | Inventory analysis |
| `/analysis/pareto` | Pareto produk |
| `/analysis/product-margin` | Margin produk |
| `/analysis/supplier-purchases` | Pembelian supplier |

### 9. Command Center Multi-Cabang

Endpoint:

| Path | Fungsi |
|---|---|
| `/branches` | List cabang |
| `/branches/summary` | Ringkasan health, omzet, laba, warning |
| `/branches/comparison` | Perbandingan cabang |
| `/branches/stock` | Stok lintas cabang |
| `/branches/product-sync` | Status sinkron produk pusat-cabang |
| `/branches/mutations` | Mutasi antar cabang |
| `/branches/mutation-recommendations` | Rekomendasi mutasi |
| `/branches/central-orders` | Pemesanan terpusat |
| `/branches/distribution` | Distribusi |
| `/branches/debts` | Hutang terpusat |
| `/branches/consolidated-finance` | Keuangan konsolidasi |
| `/branches/kpi` | KPI outlet |
| `/branches/warnings` | Warning multi-cabang |
| `/branches/notifications` | Notifikasi |

### 10. Modul Add-On

Endpoint awal:

| Modul | Endpoint |
|---|---|
| Resep | `/prescriptions`, `/prescriptions/history` |
| CRM | `/crm/members`, `/crm/campaigns` |
| Retail | `/retail/price-tags`, `/retail/promos` |
| HRD | `/hrd/shifts`, `/hrd/kpis` |
| SOP | `/sop/docs`, `/sop/tasks` |

Semua endpoint harus memeriksa entitlement feature terkait.

## Model Data Utama

Model harus dibuat setara dengan tipe FE:

- `User`, `Role`, `Permission`, `SupervisorAction`
- `Tenant`, `Entitlement`, `Subscription`
- `Outlet`, `BranchSummary`
- `Product`, `Category`, `Satuan`, `Rak`
- `Supplier`, `Customer`, `Doctor`
- `Transaction`, `TransactionItem`, `PaymentMethod`, `TxnStatus`
- `StockCardEntry`, `OpnameSession`, `OpnameItem`, `DefektaItem`, `InternalMutation`
- `PurchaseOrder`, `POItem`, `Faktur`, `ReturBeli`, `ReturJual`
- `Debt`, `Piutang`, `CashEntry`
- Finance/analytics types in `src/types/finance.ts` and related files

Backend harus menyediakan OpenAPI schema yang bisa digunakan FE untuk generate type di fase berikutnya. Selama MVP, tipe FE tetap menjadi referensi kontrak.

## Prioritas MVP

### Phase 0 - Contract Foundation

- Buat OpenAPI awal dari tipe FE.
- Buat API client FE di `src/services/api.ts`.
- Tambahkan env `VITE_API_BASE_URL`.
- Repository tetap fallback mock/localStorage saat env API kosong.

### Phase 1 - Core Operasional

- Auth/session/RBAC.
- Produk, kategori, satuan, rak.
- Supplier, pelanggan, dokter, outlet.
- POS checkout atomik.
- Transaksi dan receipt.
- Stock movement dan kartu stok.

### Phase 2 - Pembelian, Stok Lanjut, Keuangan

- PO, faktur, retur.
- Hutang/piutang dan pembayaran.
- Kas.
- Opname, defekta, mutasi internal, reminder ED.

### Phase 3 - SaaS dan Owner

- Tenant, entitlement, subscription.
- User management.
- Audit log.
- Owner dashboard, warning, recommendation.
- Finance analysis.

### Phase 4 - Multi-Cabang dan Modul Add-On

- Command center multi-cabang.
- Resep, CRM, retail, HRD, SOP.
- Cache dan optimasi agregasi.

## Acceptance Criteria

1. FE bisa login, melihat menu sesuai role, dan logout via API.
2. `productRepo.list()` dan repo CRUD inti bisa diarahkan ke API tanpa perubahan komponen page.
3. Checkout POS menghasilkan transaksi, menurunkan stok, membuat stock card, dan menampilkan receipt.
4. Pembayaran hutang/piutang mengubah status dan membuat cash ledger.
5. Permission dan entitlement dicek di backend dan FE mendapat error `403` yang bisa dipetakan ke halaman forbidden/module locked.
6. Semua write menghasilkan audit log.
7. Seed demo tersedia untuk parity dengan data mock FE.
8. Backend menyediakan health check dan OpenAPI docs.

## Risiko dan Mitigasi

| Risiko | Mitigasi |
|---|---|
| Race condition stok saat checkout paralel | Gunakan DB transaction dan row-level lock pada product stock |
| FE masih menyimpan sebagian state lokal | Pisahkan server-backed data dan local UI state; repository menjadi batas |
| Perbedaan tipe backend-FE | OpenAPI + contract tests terhadap `src/types` |
| Analytics berat | Materialized view/cache per tenant/outlet |
| Authorization ganda FE/backend | Backend menjadi final authority; FE hanya untuk UX gating |

## Open Questions

1. Backend stack final: NestJS, Fastify, Express, Laravel, atau framework lain?
2. Auth token akan same-origin cookie atau Bearer token cross-domain?
3. Apakah parked cart perlu lintas device, atau cukup tetap localStorage di MVP?
4. Apakah data demo perlu dipertahankan sebagai mode seed resmi di production staging?
5. Apakah ID format seperti `TRX-2026-0001` wajib dipertahankan atau boleh memakai UUID plus display number?
