# Task Tracker - Kelola Apotek Backend

Dokumen ini menjadi tracker progres yang sudah diverifikasi. Task berikutnya ditambahkan setelah hasil audit FE/backend berikutnya disepakati.

## Scope Saat Ini: Login Superadmin dan Pembuatan Tenant

- [x] Menyediakan login superadmin melalui `POST /api/v1/auth/login`.
- [x] Menggunakan Bearer access token untuk request terproteksi.
- [x] Menyediakan `GET /api/v1/auth/me` untuk membaca konteks user yang sedang login.
- [x] Melindungi endpoint internal dengan role superadmin dan permission `internal.tenant.manage`.
- [x] Menyediakan daftar plan melalui `GET /api/v1/internal/plans`.
- [x] Menyediakan pembuatan plan melalui `POST /api/v1/internal/plans`.
- [x] Menyediakan perubahan plan melalui `PATCH /api/v1/internal/plans/:id`.
- [x] Menyediakan penghapusan plan melalui `DELETE /api/v1/internal/plans/:id` dengan proteksi `PLAN_IN_USE`.
- [x] Menyediakan pembuatan tenant melalui `POST /api/v1/internal/tenants`.
- [x] Menyediakan penghapusan tenant testing melalui `DELETE /api/v1/internal/tenants/:id` beserta data child dalam satu transaksi.
- [x] Membatasi endpoint delete tenant/plan di backend dengan `requireSuperadmin` dan permission `internal.tenant.manage`.
- [x] DELETE tenant memfilter tabel berdasarkan keberadaan kolom `tenantId` agar tabel legacy tidak menyebabkan error `42703`.
- [x] Pembuatan tenant dapat sekaligus membuat branch utama dan akun owner.
- [x] Pembuatan tenant menyinkronkan entitlement dari `planId`.
- [x] Pembuatan tenant mendukung subscription `PAID` dan `TRIAL`.
- [x] Subscription `PAID` otomatis menjadi `ACTIVE` dan periode dihitung backend.
- [x] Subscription `TRIAL` otomatis memakai masa trial, default 14 hari.
- [x] Menyimpan `subscriptionStartedAt` dan `subscriptionBillingCycle` sebagai metadata periode.
- [x] Menyediakan perubahan subscription melalui `PATCH /api/v1/internal/tenants/:id/subscription`.
- [x] Reset demo mengembalikan tenant ke trial 14 hari.
- [x] Perubahan subscription dan tenant dicatat pada audit log.

## Kontrak FE yang Sudah Didokumentasikan

- [x] Payload login superadmin.
- [x] Payload create plan untuk `basic`, `grow`, dan `plus`.
- [x] Payload edit plan.
- [x] Payload create tenant dengan `planId` dan object `subscription`.
- [x] Kontrak `slug` tenant wajib dikirim, unik, lowercase, dan dapat dibuat otomatis FE dari nama tenant.
- [x] Payload aktivasi/perpanjangan subscription.
- [x] Penjelasan status `TRIAL`, `ACTIVE`, `EXPIRED`, `CANCELLED`, dan `SUSPENDED`.
- [x] Penjelasan bahwa status expired diproteksi runtime oleh backend.

## Verifikasi Teknis

- [x] `npm run prisma:generate`
- [x] `npm run prisma:deploy` (migration `20260829110000_subscription_lifecycle`)
- [x] `npm run prisma:seed` (tenant demo diselaraskan dengan periode subscription)
- [x] `npm run build`
- [x] `npm run test:openapi`

## Cashier Shift dan Sesi Kasir

- [x] Menyediakan `GET /api/v1/cashier-shifts/active` untuk mengambil shift `OPEN` milik kasir yang login.
- [x] Menyediakan `GET /api/v1/cashier-shifts` dengan filter status, kasir, periode, dan pagination.
- [x] Membatasi daftar shift: OWNER/ADMIN dapat melihat seluruh kasir pada outlet, role lain hanya shift miliknya.
- [x] Menambahkan kontrak endpoint shift aktif dan daftar shift ke `used_fe.md`.
- [x] Mendokumentasikan status `OPEN`, `CLOSED`, `DEPOSITED`, `VERIFIED`, dan `REJECTED`.
- [x] Mendokumentasikan bahwa seed `VERIFIED` adalah histori shift yang sudah selesai dan diverifikasi.
- [x] Menambahkan endpoint shift baru ke OpenAPI.
- [x] Menjalankan `npm run build` setelah perubahan cashier shift.
- [x] Memperbaiki error Prisma pada endpoint daftar shift dengan menghindari array-style `$transaction` pada Prisma proxy.

## Kontrak Satuan Stok dan Checkout

- [x] Mendokumentasikan bahwa `ProductBatch.stock` pada kontrak saat ini adalah jumlah unit dasar.
- [x] Mendokumentasikan rumus `baseQty = qty * ProductUnit.conversion` dan contoh pcs/strip/box di `used_fe.md`.
- [x] Mendokumentasikan aturan FE untuk memilih `product.units[].id`, menampilkan label satuan, dan menghitung kapasitas jual.
- [x] Mendokumentasikan keterbatasan checkout saat ini yang belum mengalokasikan stok dari beberapa batch secara otomatis.
- [x] Mewajibkan produk baru memakai unit dasar `isBaseUnit: true` dengan `conversion: 1`.
- [x] Menambahkan `POST /products/:id/units` untuk unit penjualan tambahan (strip/box).
- [x] Menambahkan `PATCH /products/:id/units/:unitId` untuk memperbaiki konfigurasi unit lama.
- [x] Menambahkan `productUnitId` pada `POST /stock/batches` agar backend mengonversi quantity input ke unit dasar.
- [ ] Menormalisasi data produk lama yang sudah terlanjur memiliki `conversion > 1` pada unit base; maksud stok harus dikonfirmasi terlebih dahulu.
- [ ] Menambahkan alokasi checkout lintas beberapa batch secara otomatis.

## Aturan Subscription MVP1

- `Plan` adalah definisi paket dan fitur.
- Data tenant menyimpan status dan periode subscription aktif.
- `planId` tidak lagi menyebabkan tenant selalu trial.
- Jika `subscription.type` adalah `PAID`, status tenant menjadi `ACTIVE` sejak `startsAt` atau waktu pembuatan.
- Jika `subscription.type` adalah `TRIAL`, status tenant menjadi `TRIAL` sampai `trialEndsAt`.
- Jika tanggal periode lewat, middleware menolak feature dengan `403 SUBSCRIPTION_INACTIVE`.
- Scheduled billing job untuk mempersist status menjadi `EXPIRED` masih menjadi pekerjaan lanjutan.

## Task Berikutnya

- [ ] Verifikasi login dan onboarding tenant melalui FE secara end-to-end.
- [ ] Audit dan selaraskan task berikutnya dengan `plan.md`.
- [ ] Menambahkan billing/expiration job untuk transisi otomatis ke `EXPIRED`.
- [ ] Menambahkan histori subscription/renewal jika diperlukan bisnis.
- [ ] Menentukan dan mengimplementasikan import/export MVP1.
