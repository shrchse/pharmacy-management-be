# Workflow Implementasi SIM Apotek Backend

Sumber utama: `PRD_Teknis_SIM_Apotek_Gabungan.md`, `plan.md`, `prisma/schema.prisma`, dan kondisi runtime backend saat ini.

Dokumen ini dipakai sebagai alur pengerjaan praktis. PRD adalah target produk; workflow ini memecahnya menjadi urutan implementasi agar MVP1 bisa selesai tanpa rewrite besar, lalu menyiapkan jalur MVP2.

## Prinsip Kerja

- Kerjakan backend sebagai modular monolith Express + TypeScript + Prisma.
- Anggap `src/modules/starter` sebagai prototype, bukan struktur final domain.
- Pecah fitur ke module produksi satu per satu: `auth`, `tenant`, `products`, `inventory`, `pos`, `cashier-shifts`, `purchases`, `finance`, `compliance`, `pharmacy`, `crm`, `owner`, `audit`.
- Gunakan `Branch` sebagai model database yang mewakili outlet. Jika API publik tetap memakai istilah outlet, lakukan mapping eksplisit di DTO/router.
- Gunakan `StockLocation` sebagai implementasi rak/lokasi stok, kecuali nanti diputuskan perlu model `Rack` terpisah.
- Semua write penting harus transactional, auditable, tenant-scoped, dan siap RLS.
- Jangan mulai MVP2 sebelum gate MVP1 terpenuhi.

## Kondisi Awal Repo

Sudah ada:

- Express + TypeScript backend di `/api/v1`.
- Prisma schema luas untuk tenant, branch, RBAC, product, batch, POS, purchase, finance, resep, HR, analytics, dan offline sync.
- Auth dasar: bootstrap, login, me, dev-token.
- Starter endpoint untuk tenant, branch, product, category, unit, batch, stock overview, dan POS checkout.
- Checkout awal sudah memakai DB transaction, memilih batch FEFO sederhana, menurunkan stok, membuat sale, payment, stock ledger, dan receivable.

Belum cukup untuk PRD:

- Permission dan entitlement enforcement.
- Refresh/logout lifecycle.
- RLS PostgreSQL.
- Idempotency key untuk checkout.
- Audit logging otomatis pada write.
- OpenAPI docs dan contract test.
- Module domain produksi di luar `starter`.
- Cashier shift endpoint dan blind close workflow.
- Purchase approval APJ, compliance/license, finance, owner dashboard, dan MVP2 command center.

## Urutan Implementasi MVP1

### Phase 0 - Contract and Foundation

Tujuan: menutup fondasi teknis sebelum fitur bisnis bertambah.

1. Tetapkan kontrak response API.
   - Sukses: `{ data, meta }`.
   - Error: `{ error: { code, message, details } }`.
   - Update `sendSuccess` dan `sendError`, lalu sesuaikan semua controller.

2. Tambahkan OpenAPI awal.
   - Dokumentasikan endpoint yang sudah ada.
   - Jadikan OpenAPI sebagai kontrak utama untuk FE.
   - Tambahkan script validasi OpenAPI.

3. Rapikan auth lifecycle.
   - `POST /auth/login`.
   - `POST /auth/logout`.
   - `POST /auth/refresh`.
   - `GET /auth/me` mengembalikan user, tenant, branch/outlet, role, permissions, entitlements, subscription.
   - Putuskan Bearer token atau httpOnly cookie; setelah dipilih, hapus open question dari PRD.

4. Tambahkan middleware akses.
   - `requireAuth`.
   - `requirePermission`.
   - `requireFeature`.
   - Tenant/branch resolver wajib dipakai oleh semua module domain.

5. Tambahkan audit helper.
   - Sediakan service `audit.log(...)`.
   - Semua write sensitif wajib memanggil helper ini.

6. Tambahkan idempotency foundation.
   - Tambahkan model/table untuk idempotency request.
   - Wajib untuk `POST /pos/checkout`.
   - Simpan key, request hash, response snapshot, status, tenantId, branchId, userId.

7. Tambahkan RLS PostgreSQL.
   - Tambahkan migration `ENABLE ROW LEVEL SECURITY` untuk tabel business-critical.
   - Tambahkan policy per `tenantId` dan bila perlu `branchId`.
   - Pastikan koneksi request mengatur session variable tenant/branch sebelum query domain.

Gate Phase 0:

- Build TypeScript lolos.
- Health, auth login, auth me, refresh/logout terdokumentasi di OpenAPI.
- Middleware permission/feature siap dipakai.
- Pola audit dan idempotency tersedia.
- RLS minimal aktif untuk tabel tenant-scoped utama.

### Phase 1 - Master Data and Inventory Core

Tujuan: mengganti starter CRUD menjadi module produksi.

1. Buat module `tenant`.
   - `/internal/tenants*` untuk superadmin.
   - `/tenants/active` untuk tenant dan outlet aktif user.
   - Entitlement dan subscription menjadi bagian response.

2. Buat module `products`.
   - `/products`.
   - `/products/:id`.
   - `/products/search`.
   - `/products/:id/batches`.
   - Delete product dengan histori wajib supervisor authorization.
   - Update harga jual mengikuti policy tenant.

3. Buat module `master-data`.
   - `/categories`.
   - `/units`.
   - `/racks` sebagai API alias untuk `StockLocation`.
   - `/suppliers`.
   - `/customers`.
   - `/doctors` atau `/practitioners` sesuai keputusan naming.
   - `/users`.
   - `/outlets` sebagai API alias untuk `Branch`, bila istilah outlet dipakai di FE.

4. Buat module `inventory`.
   - `/stock/overview`.
   - `/products/:id/stock-card`.
   - `/stock/defekta`.
   - `/stock/opname*`.
   - `/stock/internal-mutations`.
   - `/stock/reminder-ed`.
   - Semua movement stok berasal dari `StockLedger`.

5. Perkuat batch dan FEFO.
   - Checkout memilih batch `AVAILABLE`, stok cukup, expiry paling awal.
   - Hindari batch expired/quarantined/recalled.
   - Tambahkan locking agar checkout paralel tidak membuat stok negatif.

Gate Phase 1:

- Product, batch, stock overview, stock card, dan search bisa dipakai FE.
- Semua endpoint tenant-scoped dan permission-gated.
- Semua write master/inventory menghasilkan audit.
- Stock mutation tercatat di `StockLedger`.

### Phase 2 - POS, Cashier Shift, and Transaction Control

Tujuan: POS MVP1 aman untuk pilot.

1. Buat module `cashier-shifts`.
   - `POST /cashier-shifts/open`.
   - `GET /cashier-shifts/:id`.
   - `POST /cashier-shifts/:id/close`.
   - `POST /cashier-shifts/:id/deposit`.
   - `POST /cashier-shifts/:id/verify`.

2. Terapkan blind close.
   - Kasir input `actualCash` tanpa menerima `expectedCash`.
   - Server menghitung `expectedCash` dan `difference`.
   - Hasil close butuh verifikasi leader/apoteker.
   - Jika schema belum cukup, tambah field status, verifiedById, verifiedAt, depositedAt.

3. Buat module `pos` dan `transactions`.
   - `POST /pos/checkout`.
   - `GET /transactions`.
   - `GET /transactions/:id`.
   - `POST /transactions/:id/cancel`.
   - `GET /receipts/:transactionId`.
   - Optional: `/parked-carts*` tetap localStorage dulu kecuali diputuskan server-backed.

4. Perkuat checkout.
   - Wajib header `Idempotency-Key`.
   - Validasi cart, stok, harga, diskon, dan pembayaran.
   - Supervisor authorization untuk cancel paid transaction, diskon besar, sell empty stock, return over sell.
   - Create sale, sale items, payments, stock ledger, cash mutation, receivable bila piutang, audit log.
   - Receipt data tersedia untuk print thermal.

Gate Phase 2:

- Checkout tidak bisa dobel karena retry/tombol bayar ganda.
- Stok tidak negatif pada checkout paralel.
- Sale, payment, stock ledger, cash mutation, receivable, dan audit konsisten dalam satu transaksi DB.
- Blind close lolos acceptance criteria PRD.

### Phase 3 - Purchasing, Finance, Compliance

Tujuan: operasional pembelian, hutang/piutang, kas, dan kepatuhan MVP1.

1. Buat module `purchases`.
   - `/purchase-orders`.
   - `/purchase-orders/:id/submit-approval`.
   - `/purchase-orders/:id/approve-apj`.
   - `/purchase-orders/:id/receive`.
   - `/invoices`.
   - `/purchase-returns`.

2. Tambahkan APJ PIN flow.
   - PIN APJ terpisah dari password login.
   - Approval PO ke PBF wajib APJ PIN.
   - Tulis audit untuk submit, approve, reject, receive.
   - Jika perlu, tambah model `PurchaseApproval`.

3. Buat module `finance`.
   - `/cash`.
   - `/receivables`.
   - `/debts`.
   - `/finance/pnl`.
   - `/finance/cash-flow`.
   - `/finance/balance-sheet`.
   - `/finance/ratios`.
   - `/finance/aging-debts`.
   - `/finance/aging-receivables`.

4. Terapkan cash ledger authority.
   - Saldo cash dihitung server-side.
   - Pembayaran hutang/piutang membuat `CashMutation` dan audit.
   - Laporan boleh cache, tapi sumber tetap transaksi.

5. Buat module `compliance`.
   - Tambah schema bila belum ada: `License`, `LicenseType`, `LicenseAlert`, `Practitioner`, `PractitionerLicense`.
   - Endpoint CRUD license dan practitioner.
   - Background job atau scheduled check untuk alert 90/60/30/7 hari.

Gate Phase 3:

- Pembelian sampai receiving memperbarui stok batch dan hutang.
- APJ approval berjalan dengan PIN terpisah.
- Hutang/piutang dan cash ledger sinkron.
- License SIA/SIPA/APJ menghasilkan alert sesuai threshold.

### Phase 4 - Pharmacy, CRM, Owner Hub Single Outlet

Tujuan: melengkapi MVP1 lanjutan tanpa menunda core pilot.

1. Buat module `pharmacy`.
   - Tambah schema bila belum ada: `Patient`, `Practitioner`, `Dispensing`, `DispensingItem`.
   - Prescription -> verification -> dispensing -> sale.
   - Tetap sederhana, bukan EMR/klinik penuh.

2. Buat module `crm`.
   - `/crm/members`.
   - `/crm/campaigns`.
   - Tier default configurable per tenant.
   - Recalculate tier setelah transaksi selesai.

3. Buat module `owner`.
   - `/owner/dashboard`.
   - `/owner/daily-brief`.
   - `/owner/health-score`.
   - `/owner/warnings`.
   - `/owner/recommendations`.
   - `/owner/audit-control`.
   - `/analysis/inventory`.
   - `/analysis/pareto`.
   - `/analysis/product-margin`.
   - `/analysis/supplier-purchases`.

Gate Phase 4:

- Owner single outlet mendapat dashboard ringkas berbasis data transaksi nyata.
- Prescription dasar bisa diverifikasi dan masuk ke sale.
- CRM member dan tier berjalan minimal.

## Gate MVP1 Final

MVP1 dianggap siap pilot jika:

- FE bisa login, mendapat role/permission/entitlement, dan logout.
- Product repo dan CRUD inti bisa diarahkan ke API.
- POS checkout menghasilkan sale, memilih batch FEFO, menurunkan stok, membuat stock ledger, membuat receipt, dan idempotent.
- Blind close berjalan tanpa membocorkan expected cash ke kasir sebelum close.
- Hutang/piutang, cash ledger, dan status pembayaran konsisten.
- APJ PIN approval untuk purchase order tersedia.
- License SIA/SIPA/APJ alert berjalan.
- Permission dan entitlement dicek backend.
- Semua write sensitif punya audit log.
- RLS aktif untuk tabel tenant-scoped utama.
- Seed demo tersedia.
- OpenAPI docs tersedia dan cocok dengan endpoint runtime.

## Urutan Implementasi MVP2

MVP2 hanya dimulai setelah MVP1 stabil.

### Phase 5 - Multi-Outlet Foundation

1. Pastikan `Branch` mendukung banyak outlet dalam satu tenant.
2. Tambah model bila diperlukan:
   - `OutletGroup`.
   - Multi-branch user membership bila `User.branchId` tidak cukup.
   - Warehouse/gudang sebagai branch khusus atau model terpisah, sesuai keputusan PRD.
3. Tambah endpoint:
   - `/branches`.
   - `/branches/summary`.
   - `/branches/comparison`.
   - `/branches/stock`.
   - `/branches/product-sync`.

Gate Phase 5:

- Owner multi bisa melihat ringkasan lintas cabang.
- Data tetap terisolasi per tenant.
- User multi-branch tidak bergantung pada bypass filter manual.

### Phase 6 - Stock Transfer State Machine and BAST

1. Formalisasi `StockTransfer.status`.
   - Ganti `String` menjadi enum bila memungkinkan.
   - Status minimal: `DRAFT`, `APPROVED`, `IN_TRANSIT`, `RECEIVED`, `CANCELLED`.

2. Tambah transfer approval.
   - Approval mutasi antar outlet oleh role yang berwenang.
   - Audit setiap perubahan status.

3. Terapkan stok transfer aman.
   - Draft tidak mengubah stok.
   - Approved boleh reserve stok.
   - In transit mencatat barang keluar.
   - Received mencatat barang masuk.
   - Cancel mengembalikan reserve bila ada.

4. Tambah BAST digital.
   - Sender, receiver, item, qty, batch, timestamp, approver, konfirmasi penerima.
   - PDF/export tersedia setelah transfer diterima atau sesuai aturan bisnis.

5. Tambah endpoint:
   - `/branches/mutations`.
   - `/branches/mutation-recommendations`.
   - `/branches/central-orders`.
   - `/branches/distribution`.

Gate Phase 6:

- Tidak ada stok hilang di tengah transfer.
- Transfer lintas cabang hanya berpindah stok lewat state machine.
- BAST tersedia sebelum stok dianggap final di tujuan, sesuai acceptance criteria PRD.

### Phase 7 - Consolidated Finance, KPI, and Add-ons

1. Tambah KPI dan target.
   - Model `SalesTarget`, `SalesTargetPeriod`, `KPI`, `KPIValue` bila belum ada.
   - Target revenue, transaction, gross profit, margin.

2. Tambah consolidated finance.
   - `/branches/debts`.
   - `/branches/consolidated-finance`.
   - `/branches/kpi`.
   - `/branches/warnings`.
   - `/branches/notifications`.

3. Tambah cache dashboard bila diperlukan.
   - Redis hanya dipasang setelah profiling menunjukkan kebutuhan.
   - Target dashboard konsolidasi kurang dari 1 detik setelah cache.

4. Entitlement-gated add-ons.
   - Retail: `/retail/price-tags`, `/retail/promos`.
   - HRD: `/hrd/shifts`, `/hrd/kpis`.
   - SOP: `/sop/docs`, `/sop/tasks`.

Gate Phase 7:

- Owner multi mendapat dashboard konsolidasi lintas cabang.
- KPI/target bisa ditampilkan FE.
- Add-on hanya bisa diakses jika entitlement aktif.

## Kontrol Perubahan

- Jangan ubah semua module sekaligus. Selesaikan satu module sampai route, service, schema, audit, permission, OpenAPI, dan test minimalnya selesai.
- Jika schema berubah, buat migration eksplisit dan regenerate Prisma client.
- Jika endpoint berubah, update OpenAPI pada commit yang sama.
- Jika endpoint menyentuh stok, kas, hutang/piutang, purchase, sale, atau audit, gunakan DB transaction.
- Jika endpoint tenant-scoped, wajib tes data tenant lain tidak terbaca.
- Jika fitur masih belum diputuskan di PRD, tandai sebagai `deferred` dan jangan bangun setengah matang.

## Test Minimum per Fase

- Unit test untuk service rule yang punya branching bisnis.
- Integration test untuk endpoint utama per module.
- Transaction test untuk checkout, receiving, payment, close shift, stock transfer.
- Permission test untuk role dan entitlement.
- RLS/tenant isolation test untuk query lintas tenant.
- Idempotency test untuk retry request.
- OpenAPI contract test agar response runtime tidak drift dari kontrak.

## Keputusan yang Perlu Ditutup

- API public memakai istilah `outlet` atau `branch`.
- `StockLocation` cukup untuk rak/gudang atau perlu `Rack`/`Warehouse` model terpisah.
- Bearer token atau httpOnly cookie untuk refresh flow.
- Parked cart cukup localStorage MVP1 atau server-backed.
- `Customer` cukup sebagai patient ringan atau perlu `Patient` first-class.
- `Doctor` akan diganti/di-alias sebagai `Practitioner`.
- Konsinyasi dan accounting penuh tetap future/feature-gated atau dikeluarkan dari scope MVP.
