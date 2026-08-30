# PRD Teknis — SIM Apotek (Dokumen Gabungan)
**Untuk: Engineering, Tech Lead, Backend/Frontend Developer**
**Status:** Merged Final Draft — MVP1 & MVP2
**Sumber:** (1) `PRD_SIM_Apotek.pdf` — blueprint produk berbasis riset kompetitor blind, (2) `PRD.md` — PRD backend berdasarkan kondisi nyata repo FE (React/Vite/Zustand) yang sudah berjalan dengan mock/localStorage, (3) `Analisis_Kompetitor__Apotek_Digital_.pdf` — hasil survei langsung menu & fitur kompetitor "Apotek Digital" beserta catatan kritik dari tim.

---

## 0. Cara Membaca Dokumen Ini

Tiga dokumen sumber ternyata berada di tiga level yang berbeda tapi saling melengkapi:

| Dokumen | Level | Isi |
|---|---|---|
| `PRD_SIM_Apotek.pdf` | Visi & blueprint arsitektur | Prinsip produk, FEFO, blind close, RLS, modular monolith, roadmap MVP1→MVP2→Future |
| `PRD.md` | Kontrak teknis nyata | Endpoint REST, tipe data, RBAC, entitlement/paket SaaS — ditulis dari kode FE yang **sudah berjalan** dengan mock data |
| `Analisis_Kompetitor.pdf` | Benchmark eksternal | Struktur menu kompetitor riil + kritik apa yang perlu ditiru/dihindari |

**Temuan penting:** produk kita (FE di `PRD.md`) ternyata **sudah lebih maju** dari asumsi "MVP1 harus sederhana" di `PRD_SIM_Apotek.pdf`. FE sudah punya mock untuk Owner Hub (health score, daily brief, rekomendasi), Command Center multi-cabang, dan modul add-on (CRM, Retail, HRD, SOP) — yang di blueprint awal masih diposisikan sebagai "Future/MVP2". Sebaliknya, ada beberapa fondasi kritis di blueprint yang **belum ada** di kontrak backend saat ini. Bagian 2 merangkum gap ini secara eksplisit karena inilah nilai utama proses merge.

---

## 1. Ringkasan & Tujuan Produk

SIM Apotek adalah sistem operasi bisnis apotek berbasis web (React/Vite di FE), dibangun **single-outlet dulu (MVP1)** dengan arsitektur yang sejak awal siap **multi-outlet (MVP2)**. Backend menggantikan lapisan mock/localStorage FE yang sudah ada menjadi API multi-tenant yang aman, transactional, dan auditable — tanpa memaksa refactor UI.

**Tujuan:**
1. Menyediakan REST API untuk seluruh siklus operasional apotek: master data, pembelian, inventory/batch, POS, kas, keuangan, kepatuhan (SIA/SIPA/APJ), CRM, dan pelaporan.
2. Menjadi source of truth untuk auth, role, permission, tenant, entitlement/paket, audit log, stok, dan data finansial.
3. Mempertahankan kontrak repository FE yang sudah ada (`src/services/repository/*`) agar migrasi mock→API berbiaya rendah.
4. Mendukung 3 tier komersial produk:
   - **Tier 1** — operasional satu outlet (≈ MVP1).
   - **Tier 2** — owner control & analisis satu outlet (≈ MVP1 lanjutan/MVP1.5).
   - **Tier 3** — command center multi-cabang (≈ MVP2).
5. Menjamin operasi sensitif (checkout, stok, kas, hutang/piutang, opname, mutasi, override supervisor) berjalan atomik (ACID) dan auditable.

**Non-Goals (semua fase MVP):**
- Rebuild UI/routing FE.
- Integrasi payment gateway, WhatsApp Business API, e-Faktur, BPOM, SSO enterprise, native mobile app.
- Full general ledger / accounting (buku besar, aktiva tetap, chart of account penuh).
- Payroll penuh, e-commerce/marketplace, integrasi SATUSEHAT operasional penuh.
- Modul klinik (rekam medis, pemeriksaan dokter/lab) — di luar cakupan SIM apotek.

---

## 2. Gap Analysis (Hasil Merge)

### 2.1 Sudah lebih maju dari rencana awal — pertahankan
Fitur berikut sudah punya kontrak FE (mock) di `PRD.md` walau blueprint awal menempatkannya di "Future":
- **Owner Hub**: `/owner/daily-brief`, `/owner/health-score`, `/owner/warnings`, `/owner/recommendations`, `/owner/audit-control` — ini sebenarnya elemen *Business Intelligence* yang di `PRD_SIM_Apotek.pdf` baru direncanakan setelah MVP2 stabil.
- **Entitlement/Subscription per paket** (`start`/`grow`/`scale`) dengan feature toggle granular — model komersial SaaS yang tidak dibahas sama sekali di blueprint awal.
- **Supervisor Authorization** untuk aksi sensitif (`cancel_paid_trx`, `discount_over_50`, `return_over_sell`, `sell_empty_stock`, `delete_product_with_history`, `edit_sell_price`) — lebih granular dari sekadar "PIN APJ".
- **Command Center multi-cabang** sudah punya kontrak endpoint lengkap (mutation recommendation, central order, distribution, consolidated finance).

**Keputusan:** fitur-fitur ini tetap dipertahankan di roadmap, tapi kompleksitasnya perlu di-*downgrade* di UI untuk MVP1 (dashboard versi ringkas), lalu di-*upgrade* penuh di MVP2 — bukan dihapus.

### 2.2 Gap kritis — harus ditambahkan sebelum MVP1 selesai
Elemen ini ditegaskan sebagai P0 di `PRD_SIM_Apotek.pdf` tapi **tidak ada** di kontrak endpoint `PRD.md` saat ini:

| Gap | Risiko jika diabaikan | Rekomendasi |
|---|---|---|
| **Batch & Expiry (FEFO) sebagai entitas eksplisit** | `PRD.md` hanya punya `reminder-ed` dan stock card umum; tidak ada `ProductBatch` per-batch qty/expiry. Tanpa ini FEFO tidak bisa dijalankan otomatis saat checkout. | Tambahkan entitas `ProductBatch`, ubah `StockCardEntry`/stock movement agar selalu mereferensikan `batchId`. Checkout POS wajib pilih batch FEFO otomatis. |
| **Cashier Shift + Blind Close** | Tidak ada endpoint shift open/close di `PRD.md`, padahal ini differentiator inti (kasir tidak boleh lihat expected cash sebelum input actual cash). | Tambahkan modul `CashierShift` (lihat 6.5) sebagai P0 MVP1. |
| **License/Compliance (SIA/SIPA/APJ expiry alert)** | Tidak disebut sama sekali di `PRD.md`. Ini business-safety mechanism, bukan sekadar analytics. | Tambahkan `License`, `LicenseAlert` (90/60/30/7 hari) sebagai P0 MVP1. |
| **APJ PIN untuk approval Purchase Order** | `PRD.md` hanya punya Supervisor Authorization umum untuk POS; tidak ada approval kefarmasian khusus untuk PO ke PBF. | Tambahkan `PurchaseApproval` dengan PIN APJ terpisah dari login password. |
| **Patient/Practitioner sebagai entitas terpisah dari `Doctor`** | `PRD.md` hanya punya `Doctor`, resep diperlakukan ringan sebagai add-on. | Perluas modul resep: `Patient`, `Practitioner`, `Prescription`, `PrescriptionItem`, `Dispensing`, `DispensingItem` — tetap sederhana (bukan EMR penuh). |
| **PostgreSQL Row-Level Security (RLS)** | `PRD.md` hanya mengandalkan `tenantId`/`outletId` di level aplikasi. Human error programmer bisa bocorkan data lintas tenant. | Tambahkan RLS sebagai lapisan kedua — non-negotiable untuk SaaS multi-tenant. |
| **Idempotency key untuk POS checkout** | `PRD.md` tidak menyebut proteksi transaksi ganda saat tombol bayar ditekan berulang/jaringan lambat. | Wajibkan `Idempotency-Key` header di `POST /pos/checkout`. |
| **State machine untuk Stock Transfer + BAST (MVP2)** | `branches/mutations` sudah ada sebagai endpoint tapi tanpa state eksplisit (`DRAFT→APPROVED→IN_TRANSIT→RECEIVED`). Tanpa ini rawan stok "hilang" di tengah perjalanan. | Formalkan state machine + dokumen BAST digital PDF. |

### 2.3 Fitur kompetitor yang sengaja TIDAK diadopsi
Dari `Analisis_Kompetitor.pdf`, berikut fitur yang ada di kompetitor tapi **sengaja tidak** dimasukkan ke MVP1/MVP2 kita, dengan alasan:

| Fitur kompetitor | Alasan tidak diadopsi |
|---|---|
| Dashboard terpisah per modul (Penjualan/Pembelian/Persediaan/Keuangan) | Kritik internal: dashboard sebaiknya **role-based, component-based** (1 halaman ringkas per role), bukan item-based yang membuat menu membengkak. Sudah selaras dengan `/owner/dashboard` kita yang agregat. |
| Menu "Analisis" terpisah (Pareto/Pembelian/Harga) | Catatan tim: seharusnya menyatu ke dashboard, bukan menu sendiri. `/analysis/*` di `PRD.md` sudah benar sebagai data source untuk dashboard, bukan halaman menu independen. |
| Pelayanan Klinik penuh (rekam medis, pemeriksaan dokter/lab, antrian) | Di luar cakupan SIM apotek; cukup modul resep dasar (verifikasi → dispensing). |
| Konsinyasi (masuk/retur/status/stok mitra) | Kompleksitas rantai pasok tambahan yang tidak esensial untuk MVP; taruh di Future jika ada demand nyata. |
| Accounting penuh (Buku Besar, Aktiva Tetap, Daftar Akun) | Explicit non-goal di `PRD_SIM_Apotek.pdf`. Modul Finance kita (P&L, cash flow, balance sheet, rasio, aging) sudah cukup untuk kebutuhan owner tanpa jadi software akuntansi penuh. |
| Payroll penuh (gaji pokok, tunjangan, potongan, perhitungan, pembayaran) | Non-goal; cukup modul HRD ringan (shift, KPI) sebagai add-on nanti. |
| Jualan Online/Website/Katalog/WA Tools/Saldo Digikes | Explicit non-goal (tidak ada integrasi e-commerce/WA di MVP). |
| Multi Outlet "Mitra" (partner/franchise network lintas tenant) | Di luar scope MVP2 kita, yang fokus pada outlet **milik satu owner**, bukan jejaring mitra lintas pemilik. |
| Program Promo lengkap (bundel, voucher, member pro) | Turunkan jadi bagian dari add-on **Retail** (price-tag & promo dasar), bukan prioritas P0/P1. |

**Catatan lapangan tim:** *"Punya iwan perlu penyesuaian kasir, masih ada yg beda."* — POS internal saat ini masih perlu disesuaikan dibanding benchmark kompetitor. Item ini dicatat sebagai **open item UX POS** yang perlu direview terpisah sebelum MVP1 sign-off (lihat Open Questions §10).

---

## 3. Role & Permission Model (Final)

Menyatukan role blueprint (Owner/Apoteker-APJ/Kasir/Superadmin) dengan role kode aktual (`src/lib/rbac.ts`):

| Role kode | Nama bisnis | Cakupan | Fase |
|---|---|---|---|
| `kasir` | Kasir/Asisten | POS, transaksi, shift, baca produk/stok/mitra | MVP1 |
| `apoteker` | Apoteker/APJ | Operasional outlet, write produk/stok, opname, pembelian, approval PO (PIN APJ), verifikasi resep | MVP1 |
| `owner_outlet` | Owner (1 apotek) | Kontrol outlet tunggal: keuangan, dashboard, laporan, health score | MVP1 |
| `admin` | Admin tenant | User management, RBAC config, audit log, settings tenant | MVP1 |
| `owner_multi` | Owner (multi-apotek) | Command center, konsolidasi, KPI/target lintas outlet, approval mutasi antar outlet | MVP2 |
| `superadmin` | Superadmin IT/Platform | Console internal SaaS: tenant, paket, subscription, system health | Semua fase (platform-level) |

Role "Manajemen" dari blueprint awal **tidak dibuat first-class role terpisah di MVP1** — permission set-nya mendekati `owner_outlet`/`apoteker`, sebagaimana direkomendasikan `PRD_SIM_Apotek.pdf` §6. Baru menjadi first-class di MVP2 seiring kebutuhan `owner_multi`.

---

## 4. Arsitektur Target

### 4.1 API Style
- Base path `/api/v1`, transport HTTPS JSON.
- Auth: short-lived access token + refresh token (httpOnly cookie same-origin, atau Bearer token bila cross-domain — keputusan final di Open Questions).
- Format sukses: `{ "data": {}, "meta": {} }`
- Format error: `{ "error": { "code", "message", "details" } }`
- Backend menyediakan OpenAPI schema sebagai kontrak; tipe FE (`src/types`) tetap jadi referensi selama migrasi.

### 4.2 Multi-Tenant & Outlet Scoping + RLS
- Semua tabel business-critical wajib punya `tenant_id`, dan bila relevan `outlet_id`.
- Outlet aktif dikirim via header `X-Outlet-Id` atau query `outletId`.
- Superadmin memakai endpoint `/internal/*`, terpisah dari data outlet biasa.
- **Tambahan wajib (gap 2.2):** PostgreSQL **Row-Level Security** sebagai lapisan kedua di atas filter aplikasi — mencegah kebocoran data lintas tenant walau ada bug/lupa filter di query.

### 4.3 Backend Structure — Modular Monolith
```
backend/
  auth/        tenant/      outlet/
  product/     inventory/   procurement/
  sales/       pharmacy/    crm/
  finance/     compliance/  audit/
  notification/
```
Stack rekomendasi: Node.js + TypeScript, PostgreSQL, Drizzle ORM/Prisma (pilih sesuai kompetensi tim), Redis (opsional, cache dashboard & session), background worker untuk event async (mis. recalculate customer tier).

### 4.4 Data Store
- PostgreSQL: transaksi, master, stok, audit, subscription — single source of truth.
- Redis: opsional untuk cache dashboard konsolidasi (MVP2) dan refresh/session; **jangan dipasang di MVP1 kecuali profiling menunjukkan bottleneck nyata.**
- Object storage opsional: export laporan, PDF surat pesanan/BAST.

### 4.5 Frontend Architecture (sudah berjalan, dipertahankan)
- React + Vite + TypeScript + Zustand.
- POS wajib pakai **client-side state** (cart, customer, discount, payment, UI state) — tidak boleh re-render seluruh halaman tiap perubahan qty.
- **POS Offline Resilience (gap tambahan):** retain cart lokal, avoid UI blocking saat request lambat, retry request yang aman, dan **wajib idempotency key** pada `POST /pos/checkout` agar tombol bayar ganda tidak membuat transaksi duplikat.
- **Printer:** target alur `Browser POS → Print Adapter/Browser Printing → Thermal Printer` tanpa dialog print standar OS; detail implementasi menyesuaikan printer & environment deployment aktual.

### 4.6 Audit Trail (schema final, dari `PRD.md`, lebih lengkap dari blueprint)
Setiap write menghasilkan record dengan field:
`ts, tenantId, outletId, actorUserId, action, entity, entityId, before, after, ip, userAgent, supervisorAuthorizationId?`

### 4.7 Approval Framework — dua jalur berbeda, jangan digabung
1. **Supervisor Authorization** (dari `PRD.md`) — untuk override operasional kasir/POS: `cancel_paid_trx`, `discount_over_50`, `return_over_sell`, `sell_empty_stock`, `delete_product_with_history`, `edit_sell_price`. Endpoint: `POST /auth/supervisor-authorizations`.
2. **APJ PIN Approval** (dari blueprint, gap 2.2) — khusus kefarmasian: approval Purchase Order/Surat Pesanan ke PBF, dan otorisasi tindakan yang secara regulasi wajib melibatkan Apoteker Penanggung Jawab. PIN ini **bukan** password login biasa.

---

## 5. Model Data (Object Model Final)

```
Platform        Tenant, Organization, Outlet
Identity        User, Role, Permission, RolePermission, SupervisorAction
Commercial      Entitlement, Subscription
MasterData      ProductCatalog(global), TenantProduct(assortment/config tenant),
                ProductUnit, ProductCategory, Unit(Satuan), Rack(Rak), ProductBarcode,
                Supplier, Customer, Doctor/Practitioner
Inventory       ProductBatch, StockBalance, StockLedger(movement), StockOpname,
                StockOpnameItem, StockAdjustment, DefektaItem, InternalMutation
Procurement     PurchaseOrder, PurchaseOrderItem, PurchaseApproval(APJ PIN),
                GoodsReceipt, GoodsReceiptItem, Invoice(Faktur), PurchaseReturn
Sales           SalesTransaction, SalesItem, Payment, SalesReturn, SalesReturnItem,
                ParkedCart
CashierOps      CashierShift, CashMovement, CashReconciliation(BlindClose)
Finance         CashEntry, Debt, Receivable(Piutang), FinanceSnapshot(P&L/CashFlow/
                BalanceSheet/Ratio/Aging)
Pharmacy        Patient, Practitioner, Prescription, PrescriptionItem,
                Dispensing, DispensingItem
Compliance      License, LicenseType, LicenseAlert, PractitionerLicense
CRM             Customer(extended), CustomerTier, CustomerTierHistory, Campaign
Governance      AuditLog, Notification, ApprovalRequest
MultiOutlet(MVP2) OutletGroup, SalesTarget, SalesTargetPeriod, KPI, KPIValue,
                StockTransfer, StockTransferItem, TransferApproval, BAST,
                CashDeposit, CashVerification, BranchSummary
AddOns          Retail(PriceTag, Promo), HRD(Shift, KPIEmployee), SOP(Doc, Task)
```
`ProductCatalog` adalah source of truth global untuk identitas produk yang dapat digunakan lintas tenant. `TenantProduct` adalah mapping/assortment tenant yang menyimpan konfigurasi bisnis seperti harga jual, HPP, minimum stok, status aktif, dan nama tampilan lokal. `ProductBatch` tetap menyimpan stok aktual per tenant dan cabang; stok, harga, batch, dan supplier tidak pernah dibagi lintas tenant.

Total inti berada di kisaran **47–52 object** setelah penambahan katalog global dan mapping tenant.

---

## 6. Modul & Endpoint (per domain, ditandai fase)

### 6.1 Auth, RBAC, Tenant, Entitlement — MVP1 P0
| Method | Path | Fungsi |
|---|---|---|
| POST | `/auth/login` | Login |
| POST | `/auth/logout` | Logout |
| GET | `/auth/me` | Session: user, tenant aktif, outlet list, role, permission, entitlement, subscription |
| POST | `/auth/refresh` | Refresh session |
| POST | `/auth/supervisor-authorizations` | Verifikasi supervisor untuk aksi sensitif |
| GET/POST | `/internal/tenants*` | Superadmin: kelola tenant, entitlement, subscription, reset demo |
| GET/POST | `/tenants/active` | Tenant/outlet aktif user |

Paket: `start`/`grow`/`scale`. Feature toggle: `inventory, purchasing, finance, multi_outlet, resep, retail, crm, hrd, sop`. Add-on: `reminder_ed, loyalty, wa_broadcast, price_tag`.

### 6.2 Master Data — MVP1 P0
CRUD tenant: `/products, /categories, /units, /racks, /suppliers, /customers, /doctors(→practitioners), /users, /outlets`.
Katalog global platform: `/product-catalog` untuk superadmin/platform dan `/tenant-products` untuk mengaktifkan atau menonaktifkan item katalog pada tenant aktif.

`ProductCatalog` hanya berisi atribut identitas yang bersifat umum, misalnya nama generik, komposisi, barcode, manufacturer, dan klasifikasi. `TenantProduct` menyimpan atribut operasional tenant, misalnya harga jual, HPP, minimum stok, policy resep, status aktif, dan custom name. Produk tenant dapat berasal dari katalog global atau dibuat sebagai produk lokal tenant untuk private label/racikan.

Aturan khusus produk: search by nama/kandungan/SKU/barcode; validasi harga jual/HPP/stok minimum/ED/kategori/rak; **delete produk dengan riwayat wajib supervisor authorization**; **update harga jual wajib supervisor authorization** jika policy tenant mengaktifkan gate. Target akhirnya semua endpoint membaca `TenantProduct`, bukan langsung menganggap `ProductCatalog` sebagai stok atau harga. Selama MVP1, `Product` lama dipertahankan sebagai compatibility projection dan ditautkan melalui `Product.catalogId`; migrasi foreign key operasional ke `TenantProduct` dilakukan setelah kontrak FE stabil.

### 6.3 Inventory, Batch & FEFO — MVP1 P0 (gap ditambahkan)
| Method | Path | Fungsi |
|---|---|---|
| GET | `/stock/overview` | Ringkasan stok |
| GET | `/products/:id/stock-card` | Kartu stok dari movement |
| GET | `/products/:id/batches` | **[baru]** List batch aktif + qty + expiry per produk |
| GET | `/stock/defekta` | List defekta (auto dari `stock <= min`, boleh manual) |
| GET/POST | `/stock/opname*` | Session opname, hitungan fisik, close → adjustment |
| GET/POST | `/stock/internal-mutations` | Mutasi antar rak (tidak ubah total stok, ubah lokasi) |
| GET | `/stock/reminder-ed` | Near-expiry (threshold configurable, default <30/60/90 hari) |

FEFO rule: `SELECT available batch ORDER BY expiry_date ASC` dengan mempertimbangkan status batch (quarantine/expired/reserved). Checkout POS **wajib** memilih batch otomatis via rule ini, bukan manual per transaksi.

### 6.4 POS & Transaksi — MVP1 P0
Checkout = satu transaksi DB (ACID), langkah: validasi cart & stok → validasi supervisor override bila perlu → create transaction + lines → kurangi stok (pilih batch FEFO) → create stock movement → bila `Piutang` buat entry piutang → bila tunai/QRIS/transfer buat cash ledger → tulis audit.

| Method | Path | Fungsi |
|---|---|---|
| GET | `/transactions`, `/transactions/:id` | List/detail |
| POST | `/pos/checkout` | Checkout atomik — **wajib header `Idempotency-Key`** |
| POST | `/transactions/:id/cancel` | Batalkan trx paid, butuh supervisor |
| GET | `/receipts/:transactionId` | Data struk (untuk print thermal) |
| GET | `/products/search` | Search produk POS (target <500ms) |
| GET/POST/DELETE | `/parked-carts*` | Hold/resume transaksi (opsional lintas device di MVP1) |

### 6.5 Cashier Shift & Blind Close — MVP1 P0 **(gap, endpoint baru)**
| Method | Path | Fungsi |
|---|---|---|
| POST | `/cashier-shifts/open` | Buka shift, catat opening cash |
| GET | `/cashier-shifts/:id` | Detail shift berjalan |
| POST | `/cashier-shifts/:id/close` | Blind close: kasir input actual cash **tanpa melihat expected cash**; server hitung expected & variance |
| POST | `/cashier-shifts/:id/deposit` | Setor kas hasil closing |
| POST | `/cashier-shifts/:id/verify` | Verifikasi leader/apoteker atas hasil closing |

### 6.6 Purchasing, Faktur, Retur, Hutang — MVP1 P0/P1
| Resource | Endpoint |
|---|---|
| Purchase order | `/purchase-orders` |
| Faktur supplier | `/invoices` |
| Retur beli/jual | `/purchase-returns`, `/sales-returns` |
| Hutang supplier | `/debts` |

Khusus: `POST /purchase-orders/:id/submit-approval` → `POST /purchase-orders/:id/approve-apj` (PIN APJ, **gap 2.2**) → export PDF Surat Pesanan → `POST /purchase-orders/:id/receive` (update stok + batch + faktur). Faktur `sisa <= 0` → status `lunas`. Retur beli bentuk "pengurangan hutang" mengurangi hutang terkait. Retur jual bisa kembalikan stok + refund/saldo sesuai bentuk retur, butuh approval leader.

### 6.7 Keuangan — MVP1 P0/P1
`/cash, /receivables, /finance/pnl, /finance/cash-flow, /finance/balance-sheet, /finance/ratios, /finance/aging-debts, /finance/aging-receivables`. Semua pembayaran hutang/piutang wajib membuat cash entry + audit. Saldo cash ledger dihitung server-side (tidak dipercaya dari client). Laporan boleh cached tapi sumber tetap transaksi/cash/hutang/piutang/faktur.

### 6.8 Compliance / License — MVP1 P0 **(gap, modul baru)**
Objek: `License, LicenseType, LicenseExpiry, Practitioner, PractitionerLicense`. Notifikasi otomatis 90/60/30/7 hari sebelum expiry SIA/SIPA/APJ. Ini business-safety mechanism, bukan analytics — jangan turunkan prioritas.

### 6.9 Pharmacy (Resep) — MVP1 P0/P1 (diperluas dari `PRD.md`)
Objek: `Patient, Practitioner, Prescription, PrescriptionItem, Dispensing, DispensingItem`. Alur: Prescription → Verification (apoteker) → Dispensing → Sales. Tetap sederhana untuk kebutuhan pilot; struktur data disiapkan agar bisa diperluas ke integrasi eksternal (mis. SATUSEHAT) di fase mendatang — **bukan dibangun penuh sekarang**.

### 6.10 CRM — MVP1 P1
`/crm/members, /crm/campaigns`. Auto-tiering via internal domain event (`TransactionCompleted → Background Worker → Recalculate Spending → Update Tier`), bukan event-driven microservices penuh. Tier default: Bronze (<2jt), Silver (≥2jt), Gold (≥5jt) — threshold **configurable per tenant**.

### 6.11 Owner Hub & Analytics — MVP1 P2 (versi ringkas single-outlet)
`/owner/dashboard, /owner/daily-brief, /owner/health-score, /owner/warnings, /owner/recommendations, /owner/audit-control, /analysis/inventory, /analysis/pareto, /analysis/product-margin, /analysis/supplier-purchases`. Di MVP1, tampilkan sebagai **satu halaman dashboard per role** (component-based), bukan menu terpisah per laporan — selaras kritik kompetitor §2.3.

### 6.12 Audit — MVP1 P0
Modul `audit/` mencatat semua write sensitif (lihat schema §4.6): perubahan harga, adjustment stok, void, refund, approval pembelian, perubahan permission, login, perubahan data sensitif.

### 6.13 MVP2 — Multi-Outlet Command Center
| Path | Fungsi |
|---|---|
| `/branches, /branches/summary, /branches/comparison` | List, health/omzet/laba/warning, perbandingan cabang |
| `/branches/stock, /branches/product-sync` | Stok lintas cabang, status sinkron produk pusat-cabang |
| `/branches/mutations` | Mutasi antar cabang — **wajib state machine**: `DRAFT → APPROVED → IN_TRANSIT → RECEIVED`, tidak boleh langsung minus/plus stok tanpa status |
| `/branches/mutation-recommendations` | Rekomendasi mutasi otomatis |
| `/branches/central-orders, /branches/distribution` | Pemesanan & distribusi terpusat |
| `/branches/debts, /branches/consolidated-finance` | Hutang & keuangan konsolidasi |
| `/branches/kpi, /branches/warnings, /branches/notifications` | KPI, warning, notifikasi lintas outlet |

Tambahan: **Digital BAST** (PDF) untuk tiap transfer — sender, receiver, item, qty, batch, timestamp, approver, konfirmasi penerima. **SalesTarget/KPI**: target revenue/transaction/gross profit/margin per periode (daily/weekly/monthly) dengan visual progress bar. **Redis caching** untuk dashboard konsolidasi (target <1 detik setelah cache) — dipasang saat MVP2, bukan lebih awal.

### 6.14 Add-on Modules (entitlement-gated, di luar jalur kritis MVP1)
`Retail` (`/retail/price-tags, /retail/promos`), `HRD` (`/hrd/shifts, /hrd/kpis`), `SOP` (`/sop/docs, /sop/tasks`). Semua endpoint wajib cek entitlement feature terkait sebelum dieksekusi.

---

## 7. Development Phasing (Gabungan)

| Phase | Isi | Setara |
|---|---|---|
| **Phase 0 — Contract Foundation** | OpenAPI awal dari tipe FE; API client `src/services/api.ts`; `VITE_API_BASE_URL`; repository fallback mock saat env kosong | — |
| **Phase 1 — Core Operasional** | Auth/RBAC/RLS; ProductCatalog global + TenantProduct assortment; Category/Unit/Rack/Batch; Supplier/Customer/Doctor/Outlet; POS checkout atomik + idempotency; Transaksi + receipt + print; Stock movement + FEFO; **Cashier Shift + Blind Close** | Blueprint P0 Foundation + P1 Operational Core |
| **Phase 2 — Pembelian, Stok Lanjut, Keuangan, Compliance** | PO + APJ approval, faktur, retur; Hutang/piutang; Kas; Opname/defekta/mutasi internal/reminder ED; **License/Compliance alert** | Blueprint P1–P2 |
| **Phase 3 — Pharmacy, CRM, SaaS & Owner (single outlet)** | Patient/Prescription/Dispensing dasar; CRM tiering; Tenant/entitlement/subscription; User management; Audit log; Owner dashboard ringkas, warning, rekomendasi; Finance analysis | Blueprint P2–P3 |
| **Phase 4 — Multi-Cabang & Add-On** | Command center multi-cabang + state machine transfer + BAST; KPI/Target; Redis cache dashboard konsolidasi; Resep lanjutan, CRM campaign, Retail, HRD, SOP | Blueprint P4 (MVP2) |
| **Phase 5 — Business Intelligence & AI** | Anomaly detection, forecast, rekomendasi otomatis lanjutan, integrasi SATUSEHAT operasional, AI Owner Copilot | Blueprint P5 (Future) |

---

## 8. Acceptance Criteria

1. FE bisa login, melihat menu sesuai role, dan logout via API.
2. `productRepo.list()` dan repo CRUD inti bisa diarahkan ke API tanpa perubahan komponen page.
3. Produk umum dapat dikelola sekali di `ProductCatalog`, diaktifkan per tenant melalui `TenantProduct`, dan tidak membuat stok/harga lintas tenant menjadi shared.
4. Checkout POS: menghasilkan transaksi, memilih batch via FEFO, menurunkan stok, membuat stock card, menampilkan & mencetak struk, dan **anti-duplikasi via idempotency key**.
5. Blind Close: kasir tidak melihat expected cash sebelum input actual cash; variance dihitung server-side dan butuh approval leader.
6. Pembayaran hutang/piutang mengubah status dan membuat cash ledger.
7. Approval Purchase Order ke PBF wajib PIN APJ, terpisah dari password login.
8. License SIA/SIPA/APJ mengeluarkan notifikasi otomatis 90/60/30/7 hari sebelum expiry.
9. Permission dan entitlement dicek di backend; FE mendapat error `403` yang bisa dipetakan ke halaman forbidden/module locked.
10. Semua write menghasilkan audit log dengan schema lengkap (§4.6).
11. Row-Level Security aktif: query lintas tenant tanpa filter eksplisit tetap tidak mengembalikan data tenant lain.
12. Seed demo tersedia untuk parity dengan data mock FE.
13. Backend menyediakan health check dan OpenAPI docs.
14. (MVP2) Mutasi antar outlet mengikuti state machine penuh dan menghasilkan BAST PDF sebelum stok dianggap berpindah.

---

## 9. Risiko dan Mitigasi

| Risiko | Mitigasi |
|---|---|
| Race condition stok saat checkout paralel | DB transaction + row-level lock pada stock balance per batch |
| FE masih menyimpan sebagian state lokal | Pisahkan server-backed data vs local UI state; repository jadi batas tegas |
| Perbedaan tipe backend-FE | OpenAPI + contract test terhadap `src/types` |
| Analytics/dashboard berat (terutama MVP2 konsolidasi) | Materialized view/cache per tenant/outlet; Redis dipasang saat diperlukan, bukan default |
| Otorisasi ganda FE/backend | Backend jadi final authority; FE hanya untuk UX gating |
| Kebocoran data lintas tenant akibat lupa filter | RLS sebagai lapisan kedua wajib, bukan opsional |
| Katalog global mengubah data operasional tenant secara tidak sengaja | Pisahkan `ProductCatalog` dari `TenantProduct`; perubahan katalog global hanya memengaruhi atribut identitas, sedangkan harga, HPP, stok, batch, dan status jual tetap tenant-scoped |
| Stok "hilang" saat mutasi antar outlet tanpa status jelas | State machine wajib untuk `StockTransfer`, tidak boleh direct write |
| Kompleksitas menu membengkak seperti kompetitor | Dashboard role-based/component-based, bukan 1 menu per laporan; review UX secara berkala terhadap prinsip ini |

---

## 10. Open Questions

1. Backend stack final: NestJS, Fastify, Express, atau lainnya?
2. Auth token: same-origin cookie atau Bearer token cross-domain?
3. Apakah parked cart perlu lintas device, atau cukup localStorage di MVP1?
4. Apakah data demo perlu dipertahankan sebagai mode seed resmi di production staging?
5. Format ID transaksi: tetap `TRX-2026-0001` atau UUID + display number?
6. **[baru]** Review UX POS kasir dibanding benchmark kompetitor — catatan tim menyebut "masih ada yang beda", perlu sesi review terpisah sebelum MVP1 sign-off.
7. **[baru]** Apakah `Gudang`/warehouse perlu jadi entitas terpisah dari `Outlet` untuk kebutuhan gudang pusat di MVP2, atau cukup diperlakukan sebagai outlet khusus?
8. **[baru]** Threshold near-expiry (30/60/90 hari) dan tier CRM (2jt/5jt) — perlu konfirmasi apakah default ini final atau hanya starting point yang configurable per tenant.

---

## 11. Prioritized Backlog Final

**P0 — Foundation:** PostgreSQL, Tenant/Organization/Outlet, Auth, RBAC, RLS, Audit, ACID transaction architecture, Idempotency layer.

**P1 — Operational Core:** ProductCatalog/TenantProduct, ProductBatch/FEFO, Supplier, Purchase+APJ approval, Receiving, Inventory, Stock Opname, POS, Payment, **Cashier Shift + Blind Close**, Receipt/Print.

**P2 — Pharmacy & Control:** Patient/Practitioner/Prescription/Dispensing dasar, License/Compliance (SIA/SIPA/APJ alert), Expense, CRM basic.

**P3 — Management:** Owner Dashboard (ringkas, role-based), Reports, Low-stock/Expiry alert, Gross profit, Cash variance.

**P4 — MVP2:** Multi-outlet, Consolidated dashboard, Sales Target/KPI, Stock Transfer state machine + BAST, Central cash monitoring, CRM auto-tiering skala penuh, Add-on (Retail/HRD/SOP).

**P5 — Future:** Forecast, anomaly detection, supplier intelligence, advanced BI, SATUSEHAT integration, AI Owner Copilot, external API/partner outlet network.
