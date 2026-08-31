# Dokumentasi Integrasi Frontend–Backend Kelola Apotek

Versi dokumen: 1.0  
Tanggal audit: 29 Agustus 2026  
Target pembaca: tim backend, frontend, QA, dan product owner

## 1. Tujuan dokumen

Dokumen ini menjelaskan kondisi aktual frontend Kelola Apotek, meliputi:

- arsitektur integrasi API;
- route, menu, role, permission, paket, dan feature gate;
- endpoint yang sudah dipakai UI;
- pemetaan request/response ke model frontend;
- alur kritis seperti login, produk tenant, stok batch/ED, POS, pembelian, dan stok opname;
- state yang memang tetap lokal di frontend;
- fitur yang repository-nya sudah tersedia tetapi UI belum sepenuhnya memakai backend;
- gap kontrak dan pekerjaan yang perlu disepakati atau ditambahkan di backend.

Dokumen ini adalah handoff kontrak berdasarkan implementasi frontend saat ini. Jika terdapat perbedaan dengan dokumentasi lama, kontrak aktual pada bagian “Alur kritis” dan “Gap integrasi” perlu dijadikan bahan sinkronisasi bersama.

## 2. Legenda status integrasi

| Status | Arti |
|---|---|
| **Aktif** | UI sudah memanggil repository/API backend. |
| **Parsial** | Sebagian alur sudah memakai API, tetapi masih ada aksi atau data yang belum tersedia. |
| **Adapter** | Repository/API adapter sudah tersedia, tetapi halaman masih memakai store lokal atau belum terhubung penuh. |
| **Lokal** | Data merupakan state UI yang memang boleh berada di browser. |
| **Gap BE** | UI membutuhkan dukungan atau keputusan kontrak backend. |

## 3. Ringkasan untuk backend

Kontrak utama yang perlu dipertahankan adalah:

1. Base API menggunakan `/api/v1`.
2. Endpoint terproteksi menerima `Authorization: Bearer <accessToken>` dan konteks cabang melalui `X-Branch-Id` jika cabang aktif tersedia.
3. Response sukses menggunakan envelope `{ "data": ..., "meta": ... }`.
4. Response error menggunakan `{ "error": { "code", "message", "details" } }`.
5. Identitas produk global berasal dari `ProductCatalog`, sedangkan konfigurasi milik tenant berasal dari `TenantProduct`/`Product`.
6. Tanggal kedaluwarsa bukan atribut produk. `expiredDate` berada pada `ProductBatch` dan dibuat melalui `POST /stock/batches` atau proses receiving pembelian.
7. Pembuatan produk dengan stok awal di UI merupakan dua request berurutan: membuat produk tenant, lalu membuat batch.
8. Checkout POS harus tetap atomik melalui satu endpoint `POST /pos/checkout`.
9. Backend menjadi source of truth untuk auth, authorization, entitlement, stok, transaksi, keuangan, tenant, dan audit.
10. Beberapa modul tambahan masih memiliki adapter tetapi halaman masih lokal; rinciannya ada di bagian gap.

Prioritas backend paling penting:

- menjaga response create tenant-product selalu memberikan ID produk operasional yang dapat dipakai untuk membuat batch;
- memastikan detail produk dan endpoint batch mengembalikan `batches[].expiredDate` secara konsisten;
- memperjelas kontrak receiving PO agar nomor batch dan ED aktual dapat dikirim per item;
- memutuskan apakah “harga resep” merupakan atribut yang benar-benar diperlukan;
- melengkapi aksi yang saat ini belum didukung: ekspor, approval retur penjualan terpisah, edit faktur, dan beberapa aksi stok.

## 4. Arsitektur frontend

Teknologi utama:

- React 18;
- TypeScript strict;
- Vite;
- React Router;
- Tailwind CSS;
- Zustand untuk state UI/persist ringan;
- React Hook Form dan Zod untuk form dan validasi.

Alur akses data:

```text
pages/features -> services/repository -> services/api -> backend
```

Komponen tidak membaca envelope backend secara langsung. API client atau repository melakukan:

- unwrap `{ data, meta }`;
- normalisasi nama field dan tipe data;
- konversi angka desimal dari string ke number;
- pemetaan enum backend ke model UI;
- penyatuan beberapa endpoint jika sebuah halaman membutuhkan data gabungan.

Konfigurasi environment:

```env
VITE_API_BASE_URL=https://host-backend.example.com/api/v1
```

Pada production, API URL wajib tersedia. Mode mock hanya dipertahankan sebagai fallback demo ketika dikonfigurasi secara eksplisit; mock bukan source of truth saat API aktif.

## 5. Protokol API umum

### 5.1 Header

```http
Authorization: Bearer <access-token>
Content-Type: application/json
X-Branch-Id: <active-branch-id>
```

`X-Branch-Id` dikirim untuk request yang membutuhkan konteks outlet/cabang. Backend tetap harus melakukan validasi bahwa user memang memiliki akses ke cabang tersebut.

### 5.2 Response sukses

```json
{
  "data": {},
  "meta": {
    "message": "Success"
  }
}
```

`data` dapat berupa object, array, atau hasil berhalaman. Repository akan mengubahnya menjadi tipe yang digunakan komponen.

### 5.3 Response error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation error",
    "details": [
      {
        "path": "fieldName",
        "message": "Required"
      }
    ]
  }
}
```

Kode HTTP yang harus konsisten:

| HTTP | Pemakaian |
|---|---|
| `400` | Payload atau query tidak valid. |
| `401` | Token tidak ada, kedaluwarsa, atau tidak valid. |
| `403` | Permission, entitlement, feature, atau subscription tidak memenuhi. |
| `404` | Resource tidak ditemukan. |
| `409` | Konflik bisnis/duplikasi/state transition tidak valid. |
| `429` | Rate limit. |

Untuk error validasi, `details[].path` sebaiknya sama dengan nama field request agar UI dapat menempatkan error pada input terkait.

### 5.4 Refresh token

Saat memperoleh `401` atau kode `UNAUTHENTICATED`, API client:

1. memanggil `POST /auth/refresh` dengan refresh token;
2. menyimpan access token baru;
3. mengulang request awal satu kali;
4. mencegah beberapa request paralel melakukan refresh secara bersamaan.

Jika refresh gagal, sesi lokal dibersihkan dan user harus login kembali.

## 6. Auth, tenant, role, dan akses

### 6.1 Endpoint auth

| Method | Endpoint | Kegunaan | Status |
|---|---|---|---|
| POST | `/auth/login` | Login dan memperoleh token/user. | Aktif |
| GET | `/auth/me` | Memulihkan sesi dan profil akses. | Aktif |
| POST | `/auth/refresh` | Memperbarui access token. | Aktif |
| POST | `/auth/logout` | Mengakhiri sesi. | Aktif |
| POST | `/auth/bootstrap` | Bootstrap akun/tenant pada flow yang didukung. | Aktif |
| POST | `/auth/dev-token` | Token development; tidak untuk production. | Development |

Response login/me perlu menyediakan data yang cukup untuk:

- identitas user;
- role atau daftar role;
- permission efektif;
- tenant aktif;
- cabang/outlet yang boleh diakses;
- entitlement paket dan add-on;
- status subscription.

### 6.2 Role frontend

Role yang dikenali:

- `kasir`;
- `apoteker`;
- `owner_outlet`;
- `owner_multi`;
- `admin`;
- `superadmin`.

### 6.3 Permission

Permission yang digunakan guard/menu:

```text
pos
transaksi
shift
produk:read
produk:write
stok:read
stok:opname
pembelian
keuangan
mitra:read
mitra:write
laporan:operasional
laporan:keuangan
owner_hub
analisis
multi_cabang
pengaturan:user
audit:own
audit:all
internal
```

Backend wajib tetap mengotorisasi setiap endpoint. Menyembunyikan menu di frontend bukan mekanisme keamanan.

### 6.4 Supervisor authorization

Aksi yang membutuhkan otorisasi supervisor:

```text
cancel_paid_trx
discount_over_50
return_over_sell
sell_empty_stock
delete_product_with_history
edit_sell_price
```

Endpoint utama:

```http
POST /auth/supervisor-authorizations
```

Response perlu memberikan ID otorisasi sekali pakai/terbatas yang dapat diteruskan pada request bisnis, misalnya `supervisorAuthorizationIds` ketika membuat retur atau checkout.

### 6.5 Paket dan feature gate

Paket yang dikenal adalah `start`, `grow`, dan `scale`.

- Owner Hub dan analisis membutuhkan minimal paket Grow.
- Command Center/multi-cabang membutuhkan Scale.

Feature/add-on yang digunakan route guard:

```text
inventory
purchasing
finance
multi_outlet
resep
retail
crm
hrd
sop
reminder_ed
loyalty
wa_broadcast
price_tag
```

Dependensi penting:

- `loyalty` dan `wa_broadcast` bergantung pada CRM;
- `price_tag` bergantung pada retail;
- subscription tenant yang kedaluwarsa memblokir aplikasi tenant, kecuali area internal untuk superadmin.

## 7. Route dan fitur UI

### 7.1 Operasional utama

| Area | Route utama | Sumber data | Status |
|---|---|---|---|
| Dashboard | `/dashboard` | Ringkasan repository/domain | Aktif/Parsial |
| POS | `/kasir` | Produk, customer, shift, checkout | Aktif |
| Transaksi | `/transaksi`, `/transaksi/:id` | Transactions | Aktif |
| Shift | `/shift` | Cashier sessions | Aktif |
| Produk | `/produk`, `/produk/baru`, `/produk/:id` | Catalog, tenant products, products | Aktif |
| Sinonim | `/produk/sinonim` | Product synonym adapter | Parsial |
| Kategori | `/produk/kategori` | Categories | Aktif |
| Stok | `/stok` | Tenant products + stock overview | Aktif |
| Defekta | `/stok/defekta` | Defekta | Parsial |
| Stok opname | `/stok/opname` | Stock opname | Aktif/Parsial |
| Mutasi internal | `/stok/mutasi-internal` | Stock mutations | Aktif |
| Reminder ED | `/stok/reminder-ed` | Reminder ED | Aktif |
| Kartu stok | `/stok/kartu/:productId` | Detail, batches, stock-card | Aktif |
| Purchase order | `/pembelian/po`, `/pembelian/po/baru` | Purchase orders | Aktif/Parsial |
| Faktur | `/pembelian/faktur` | Invoices | Parsial |
| Retur pembelian | `/pembelian/retur` | Purchase returns | Aktif/Parsial |
| Retur penjualan | `/penjualan/retur` | Sales returns | Aktif/Parsial |
| Kas | `/keuangan/kas` | Cash/mutations/expenses | Aktif |
| Hutang | `/keuangan/hutang` | Debts/payments | Aktif |
| Piutang | `/keuangan/piutang` | Receivables/payments | Aktif |
| Master mitra | `/supplier`, `/pelanggan`, `/dokter` | Master CRUD | Aktif |
| Laporan | `/laporan` | Reports | Aktif/Parsial |
| Pengaturan | `/pengaturan/*` | Users, audit, tenant profile | Aktif/Parsial |

### 7.2 Modul tambahan

| Modul | Route | Kondisi aktual |
|---|---|---|
| Resep | `/resep`, `/resep/riwayat` | Repository API tersedia, tetapi halaman utama masih dominan memakai store lokal. |
| CRM | `/crm/member`, `/crm/campaign` | Read/CRUD dasar tersedia; kirim campaign dan loyalty redemption belum tersedia. |
| Retail | `/retail/price-tag`, `/retail/promo` | Endpoint read tersedia, halaman masih memakai store lokal. |
| HRD | `/hrd/shift`, `/hrd/kpi` | Endpoint read tersedia, halaman masih memakai store lokal. |
| SOP | `/sop/pustaka`, `/sop/task` | Endpoint read tersedia, halaman masih memakai store lokal. |

### 7.3 Owner, analisis, dan multi-cabang

Owner Hub tersedia pada `/owner` beserta daily brief, health score, warning, rekomendasi, dan audit kontrol.

Analisis tersedia untuk:

- laba rugi;
- arus kas;
- neraca;
- rasio;
- aging hutang/piutang;
- inventory;
- pareto;
- margin produk;
- pembelian per supplier.

Command Center tersedia di `/cabang/*` untuk kesehatan cabang, perbandingan, master produk, stok, mutasi, pemesanan terpusat, hutang, keuangan konsolidasi, distribusi, KPI, warning, dan notifikasi.

Beberapa halaman Command Center saat ini merupakan shell atau memakai endpoint generik. Distribusi dan rekomendasi mutasi otomatis belum memiliki kontrak backend yang final.

### 7.4 Internal superadmin

Route internal:

```text
/internal
/internal/plans
/internal/tenant/new
/internal/tenant/:id
```

Endpoint terkait:

- `GET/POST /internal/plans`;
- `GET/POST /internal/tenants`;
- `GET/PATCH /internal/tenants/:id`;
- update entitlement/subscription tenant;
- reset data demo;
- reset password user tenant.

## 8. Master data dan CRUD umum

Repository menyediakan CRUD collection untuk:

```text
/categories
/units
/racks
/customers
/suppliers
/doctors
/users
/outlets
```

Kontrak list sebaiknya menerima query pencarian, status, pagination, dan filter cabang sesuai domain. Detail/edit harus mengembalikan field yang sama atau superset dari list agar form tidak kosong saat dibuka.

Endpoint akses tambahan:

| Method | Endpoint |
|---|---|
| GET | `/roles` |
| POST | `/roles` |
| PATCH | `/roles/:id` |
| DELETE | `/roles/:id` |
| GET | `/permissions` |
| GET | `/branches` |
| POST | `/branches` |
| GET/POST | `/tenants/active` |

## 9. Produk: model data dan kontrak

### 9.1 Pemisahan entitas

Frontend mengikuti tiga lapisan data berikut:

```text
ProductCatalog (global)
  -> Product/TenantProduct (identitas dan konfigurasi tenant)
    -> ProductUnit (satuan dan harga)
      -> ProductBatch (stok, batch, dan ED)
```

`ProductCatalog` menyimpan master global seperti:

- nama produk;
- nama generik/merek;
- nomor registrasi;
- bentuk sediaan (`dosageForm`);
- kekuatan (`strength`);
- komposisi;
- pabrik (`manufacturer`);
- principal;
- tipe dan golongan produk;
- kategori dan satuan default katalog.

`Product`/`TenantProduct` menyimpan konfigurasi tenant seperti:

- relasi `catalogId`;
- nama custom bila berbeda;
- kategori dan satuan tenant;
- minimum/maksimum stok;
- harga jual dan harga beli melalui unit;
- status aktif;
- supplier default.

`ProductBatch` menyimpan:

- nomor batch;
- tanggal kedaluwarsa;
- jumlah stok batch;
- harga beli batch jika digunakan;
- lokasi/rak bila didukung.

### 9.2 Endpoint produk

| Method | Endpoint | Kegunaan | Status |
|---|---|---|---|
| GET | `/product-catalog` | Pilihan master produk global. | Aktif |
| POST | `/product-catalog` | Menambah katalog global oleh role berwenang. | Adapter |
| GET | `/product-catalog/:id` | Detail katalog global. | Adapter |
| PATCH | `/product-catalog/:id` | Update katalog global. | Adapter |
| GET | `/tenant-products` | Daftar produk yang diaktifkan tenant. | Aktif |
| POST | `/tenant-products` | Mengaktifkan/membuat konfigurasi produk tenant. | Aktif |
| GET | `/tenant-products/:id` | Detail tenant product jika disediakan. | Adapter |
| PATCH | `/tenant-products/:id` | Update konfigurasi tenant product. | Aktif |
| GET | `/products` | Daftar produk operasional/kompatibilitas. | Aktif di beberapa flow |
| GET | `/products/search` | Pencarian produk, termasuk POS. | Aktif |
| GET | `/products/:id` | Detail lengkap produk, units, dan batches. | Aktif |
| GET | `/products/:id/batches` | Daftar batch dan ED produk. | Aktif |
| GET | `/products/:id/stock-card` | Pergerakan/kartu stok. | Aktif |

### 9.3 Form tambah produk dari katalog global

Saat owner baru belum memiliki produk tenant, UI tidak meminta pengguna mengetik ulang identitas obat. Alurnya:

1. UI memanggil `GET /product-catalog`.
2. Pengguna memilih produk global.
3. UI menampilkan value master sebagai field terkunci/read-only:
   - nama;
   - nama generik/merek;
   - kekuatan;
   - bentuk sediaan;
   - komposisi;
   - pabrik;
   - nomor registrasi.
4. UI memilih/memetakan kategori dan satuan tenant.
5. Pengguna mengisi konfigurasi lokal seperti harga jual, HPP, minimum stok, dan supplier.
6. UI mengirim `POST /tenant-products`.

Sediaan bukan dropdown lokal yang harus dipilih ulang. Nilai ditampilkan langsung dari `catalog.dosageForm`. Kekuatan berasal dari `catalog.strength`, dan pabrik berasal dari `catalog.manufacturer`.

Untuk produk non-obat, `dosageForm` dan `strength` dapat `null`; UI menampilkan tanda kosong yang wajar dan tidak memaksakan input.

### 9.4 Payload create tenant product

Nama field final mengikuti kontrak backend, tetapi backend perlu menerima informasi minimum berikut:

```json
{
  "catalogId": "uuid-catalog",
  "categoryId": "uuid-category-tenant",
  "unitId": "uuid-unit-tenant",
  "code": "PRD-AMX-500",
  "sellingPrice": 1200,
  "purchasePrice": 1000,
  "minStock": 50,
  "isActive": true
}
```

Aturan `customName`:

- jika pengguna tidak mengganti nama katalog, field tidak dikirim;
- jangan mengirim `customName: null` jika schema hanya menerima string;
- jika nama custom dipakai, kirim string non-kosong.

Perbaikan ini menghindari error:

```text
customName: Expected string, received null
```

Backend perlu melakukan mapping antara kategori/satuan katalog global dan master tenant. `categoryCatalogId` dan `defaultUnitCatalogId` bukan otomatis sama dengan `categoryId` dan `unitId` milik tenant.

### 9.5 Response create yang dibutuhkan

Setelah create, frontend harus memperoleh ID produk operasional untuk request batch berikutnya. Salah satu bentuk berikut dapat diterima adapter:

```json
{
  "data": {
    "productId": "uuid-product",
    "id": "uuid-tenant-product"
  }
}
```

atau:

```json
{
  "data": {
    "id": "uuid-tenant-product",
    "product": {
      "id": "uuid-product"
    }
  }
}
```

Backend sebaiknya menetapkan satu bentuk resmi dan stabil. `productId` eksplisit adalah bentuk paling mudah untuk orkestrasi stok awal.

### 9.6 Detail/edit produk

UI detail/edit memanggil `GET /products/:id`. Response yang telah tervalidasi kompatibel memiliki:

- field produk pada root;
- `category`;
- `catalog`;
- `tenantProduct` dan nested `tenantProduct.catalog`;
- `units[]` dengan `sellingPrice`, `purchasePrice`, dan `unit`;
- `batches[]`.

Pemetaan utama:

| Field UI | Sumber response |
|---|---|
| Nama | `name`, fallback `tenantProduct.customName`, lalu `catalog.name` |
| Kode | `code`, fallback `catalog.globalCode` |
| Barcode | `barcode`, fallback `catalog.barcode` |
| Generik | `genericName`, fallback `catalog.genericName` |
| Merek | `brandName`, fallback `catalog.brandName` |
| Sediaan | `dosageForm`, fallback `catalog.dosageForm` |
| Kekuatan | `strength`, fallback `catalog.strength` |
| Komposisi | `composition`, fallback `catalog.composition` |
| Pabrik | `manufacturer`, fallback `catalog.manufacturer` |
| Principal | `principal`, fallback `catalog.principal` |
| Kategori | `category`/`categoryId` |
| Satuan | base unit pada `units[]` |
| Harga jual | `units[base].sellingPrice` |
| HPP | `units[base].purchasePrice` |
| Minimum stok | `minStock`, fallback `tenantProduct.minStock` |
| Batch/ED | `batches[]` |

Harga backend dapat berbentuk decimal string, misalnya `"1200"`; adapter mengubahnya menjadi angka untuk form.

Field master global tetap ditampilkan sebagai read-only saat edit agar tenant tidak mengubah identitas katalog secara tidak sengaja. Field konfigurasi tenant tetap dapat diedit sesuai permission.

### 9.7 Harga resep

UI lama memiliki field “Harga Resep”, tetapi kontrak produk/detail saat ini hanya menunjukkan harga jual dan harga beli pada `units[]`. Frontend tidak mengirim harga resep karena belum ada atribut backend atau aturan perhitungan yang resmi.

Backend dan product owner perlu memilih salah satu:

1. hapus field harga resep dari UI dan gunakan `sellingPrice`; atau
2. tambahkan model harga resep yang jelas, termasuk lokasi penyimpanan, satuan, histori harga, permission edit, request create/update, response detail, dan pemakaian pada checkout resep.

Menambah satu field response saja belum cukup karena harga harus konsisten dengan transaksi, audit, dan multi-satuan.

## 10. Batch, stok awal, dan expired date

### 10.1 Prinsip ED

`expiredDate` adalah atribut batch, bukan atribut produk. Karena itu:

- `POST /products` atau `POST /tenant-products` membuat identitas/config produk;
- `POST /stock/batches` membuat stok per batch dan ED;
- receiving pembelian juga dapat membuat atau menambah batch;
- `GET /products/:id` mengembalikan `batches[]`;
- `GET /products/:id/batches` menjadi sumber daftar batch spesifik produk.

### 10.2 UI stok awal saat tambah produk

Pada halaman tambah produk, tab **Harga & Stok** memiliki opsi:

```text
[ ] Tambahkan stok awal sekarang
```

Jika dicentang, UI menampilkan:

- nomor batch;
- expired date;
- jumlah stok awal;
- harga beli batch, dengan fallback HPP produk;
- lokasi/rak jika dipakai.

Perubahan UI ini bersifat tambahan. Form identitas produk tetap sama, tetapi pengguna dapat menyelesaikan produk dan batch awal dalam satu flow tampilan.

### 10.3 Orkestrasi request

Frontend melakukan dua request berurutan:

```text
POST /tenant-products
  -> ambil productId
POST /stock/batches
```

Contoh request batch:

```json
{
  "productId": "uuid-product",
  "batchNumber": "BATCH-001",
  "expiredDate": "2027-12-31",
  "stock": 100
}
```

Backend boleh memiliki field tambahan seperti `purchasePrice`, `rackId`, atau `locationId`, tetapi field dan aturan wajibnya perlu tercatat konsisten di schema.

### 10.4 Kegagalan parsial

Dua request tersebut belum merupakan transaksi lintas endpoint. Jika produk berhasil tetapi batch gagal:

- UI memberi tahu bahwa produk sudah dibuat;
- UI menjelaskan stok awal/batch gagal dibuat;
- UI tidak mengulang create produk agar tidak membuat duplikasi;
- user diarahkan ke daftar/detail produk untuk menambahkan batch melalui alur stok.

Untuk jaminan atomik, backend dapat menyediakan endpoint composite khusus, tetapi itu belum menjadi kontrak saat ini.

### 10.5 Menampilkan ED

Lokasi UI untuk melihat ED:

- **Stok > Reminder ED** untuk daftar batch yang mendekati kedaluwarsa;
- **Stok > Kartu Stok > pilih produk** untuk detail batch;
- detail produk jika `GET /products/:id` mengembalikan `batches`.

Endpoint:

| Method | Endpoint | Kegunaan |
|---|---|---|
| GET | `/stock/reminder-ed?days=180` | Batch yang mendekati ED. |
| GET | `/products/:id/batches` | Semua batch suatu produk. |
| POST | `/stock/batches` | Membuat batch/stok awal. |
| GET | `/products/:id` | Detail produk beserta batch. |

Normalisasi field batch:

| Backend | UI |
|---|---|
| `batchNumber` | `batchNo` |
| `expiredDate` | `expiryDate` |
| decimal/string stock | number |

Status ED dihitung menggunakan tanggal aktual saat halaman dibuka. Backend tetap dianjurkan menyediakan status kanonik bila aturan bisnis lebih kompleks.

### 10.6 Daftar produk dan overview stok

Halaman daftar produk dan Stok Overview menggabungkan:

```text
GET /tenant-products
GET /stock/overview
```

Hal ini diperlukan karena daftar tenant product saat ini tidak menyertakan detail batch. Jika backend ingin mengurangi request dan mendukung tampilan ED langsung, response list dapat ditambah ringkasan seperti:

```json
{
  "totalStock": 100,
  "nearestExpiredDate": "2027-12-31",
  "batchCount": 2
}
```

Jangan mengirim seluruh histori batch di list jika membuat payload terlalu berat. Ringkasan stok dan ED terdekat sudah cukup untuk tabel.

## 11. Endpoint stok

| Method | Endpoint | Kegunaan | Status |
|---|---|---|---|
| GET | `/stock/overview` | Ringkasan stok per produk. | Aktif |
| GET | `/stock/reminder-ed` | Reminder expired date. | Aktif |
| POST | `/stock/batches` | Batch/stok awal. | Aktif |
| GET | `/products/:id/batches` | Batch per produk. | Aktif |
| GET | `/products/:id/stock-card` | Kartu stok. | Aktif |
| GET/POST | `/stock/opname` | List dan draft opname. | Aktif |
| GET | `/stock/opname/:id/items` | Item opname. | Aktif |
| PUT | `/stock/opname/:id/physical-counts` | Simpan hitung fisik. | Aktif |
| POST | `/stock/opname/:id/close` | Tutup dan posting opname. | Aktif |
| GET/POST | `/stock/defekta` | Daftar kebutuhan stok. | Aktif/Parsial |
| GET/POST | `/stock/internal-mutations` | Mutasi stok internal. | Aktif |

Catatan gap:

- update metadata draft opname belum didukung;
- hapus item/bulk delete defekta belum didukung walaupun aksi UI pernah tersedia;
- edit jumlah/supplier/manual item defekta belum final;
- set minimum stok dari halaman stok masih membutuhkan endpoint/update product yang disepakati.

## 12. POS, transaksi, dan shift

### 12.1 Checkout POS

Endpoint:

```http
POST /pos/checkout
Idempotency-Key: <unique-key>
```

Payload konseptual:

```json
{
  "sessionId": "uuid-shift",
  "customerId": "uuid-customer-or-null",
  "items": [
    {
      "productId": "uuid-product",
      "qty": 2,
      "unitPrice": 1200,
      "discountAmount": 0
    }
  ],
  "payments": [
    {
      "method": "CASH",
      "amount": 2400
    }
  ],
  "supervisorAuthorizationIds": []
}
```

Metode pembayaran yang dipetakan frontend meliputi `CASH`, `QRIS`, `TRANSFER`, dan `CREDIT` sesuai kemampuan backend.

Backend harus menangani checkout secara atomik:

- validasi cart dan harga;
- validasi stok dan batch;
- validasi supervisor override;
- membuat transaksi dan baris transaksi;
- mengurangi stok;
- membuat stock movement;
- membuat kas atau piutang;
- menulis audit log.

Frontend tidak boleh mengorkestrasi write tersebut dengan banyak endpoint.

### 12.2 Transaksi

Endpoint utama:

- `GET /transactions`;
- `GET /transactions/:id`;
- aksi cancel transaksi;
- endpoint receipt/print data jika tersedia.

Cancel transaksi dibayar harus memvalidasi authorization `cancel_paid_trx` di backend.

### 12.3 Shift kasir

Flow shift menggunakan:

- open session;
- detail session aktif;
- deposit/setoran;
- close session;
- verification.

ID shift aktif disimpan ringan di browser untuk memulihkan konteks UI, tetapi backend tetap menjadi source of truth status shift dan nominal kas.

## 13. Pembelian dan receiving

Endpoint purchase order meliputi:

- CRUD/list/detail `/purchase-orders`;
- submit approval;
- validasi PIN APJ;
- approve APJ;
- receive purchase order.

Endpoint invoice meliputi list/detail faktur. Tambah atau update faktur manual belum didukung penuh.

### 13.1 Gap receiving batch dan ED

Implementasi UI receiving saat ini masih dapat membuat nomor batch otomatis dan ED satu tahun ke depan. Ini hanya fallback dan tidak cocok sebagai data farmasi final.

Kontrak yang disarankan untuk setiap item receiving:

```json
{
  "purchaseOrderItemId": "uuid-po-item",
  "productId": "uuid-product",
  "receivedQty": 100,
  "batchNumber": "BATCH-PABRIK-001",
  "expiredDate": "2027-12-31",
  "purchasePrice": 1000
}
```

Backend perlu:

- mewajibkan batch number dan ED untuk produk yang dikelola per batch;
- mengizinkan beberapa batch untuk satu item PO;
- menolak ED tidak valid atau sudah kedaluwarsa sesuai policy;
- membuat/menambah ProductBatch secara atomik bersama receiving;
- mengembalikan hasil batch dan stock movement.

UI selanjutnya perlu menampilkan input batch dan ED aktual per item atau per pecahan batch. Ini merupakan perubahan UI yang masih perlu dilakukan setelah kontrak backend final.

## 14. Retur

Retur pembelian dan retur penjualan telah memiliki adapter API untuk list/detail/create sesuai endpoint domain masing-masing.

Ketentuan penting retur penjualan:

- retur melebihi jumlah jual membutuhkan authorization `return_over_sell`;
- ID authorization dikirim saat create, misalnya `supervisorAuthorizationIds`;
- approval terpisah setelah create belum memiliki endpoint final.

Backend perlu menetapkan apakah retur langsung diproses pada create atau melalui state machine `DRAFT -> APPROVED -> POSTED`. Jika memakai approval terpisah, endpoint dan transition harus ditambahkan secara eksplisit.

## 15. Keuangan dan laporan

### 15.1 Kas

Endpoint yang digunakan:

- `GET /cash`;
- `POST /cash`;
- `GET/POST /cash/mutations`;
- `POST /expenses`.

### 15.2 Hutang dan piutang

- list/detail hutang;
- `POST /debts/:id/pay`;
- list piutang;
- `POST /receivables/:id/pay`.

Pembayaran harus atomik dengan pencatatan kas dan audit. Frontend tidak membuat ledger sendiri.

### 15.3 Laporan keuangan

Adapter tersedia untuk:

- profit and loss;
- cash flow;
- balance sheet;
- financial ratios;
- aging hutang;
- aging piutang.

Filter tanggal, cabang, pagination, dan timezone harus konsisten. Tanggal bisnis ditampilkan dalam locale Indonesia, sedangkan kontrak API dianjurkan memakai ISO-8601.

### 15.4 Export

Beberapa tombol export/print masih placeholder. Jika export diproses backend, kontrak perlu menetapkan:

- endpoint dan format (`csv`, `xlsx`, atau `pdf`);
- filter yang sama dengan halaman;
- response file langsung atau asynchronous job;
- filename dan content type;
- authorization dan audit akses laporan.

## 16. Modul resep, CRM, retail, HRD, dan SOP

### 16.1 Resep

Repository mencakup operasi prescriptions seperti list/create/update, cancel, verify, dispense, history, serta patient dan practitioner.

Kondisi aktual: halaman input dan riwayat masih memakai store lokal untuk sebagian besar data, walaupun adapter tersedia. Migrasi perlu menjaga model UI dan memindahkan orkestrasi ke repository.

### 16.2 CRM

Adapter tersedia untuk member dan campaign. Gap yang tersisa:

- endpoint kirim/jalankan campaign;
- loyalty earn/redeem dan ledger poin;
- integrasi WhatsApp bila add-on aktif.

### 16.3 Retail

Adapter read tersedia untuk price tag dan promo, tetapi halaman masih menggunakan store lokal. Backend perlu mengonfirmasi CRUD, activation period, conflict promo, dan histori harga sebelum migrasi final.

### 16.4 HRD

Adapter read tersedia, halaman shift/kinerja masih lokal. Kontrak backend perlu membedakan shift pegawai dari shift kasir agar tidak terjadi tabrakan istilah dan endpoint.

### 16.5 SOP

Adapter read tersedia untuk pustaka dan task, tetapi UI masih lokal. Backend perlu menentukan lifecycle SOP, assignment, completion evidence, dan audit.

## 17. State yang tetap lokal di frontend

State berikut tidak perlu dipindahkan ke backend kecuali ada kebutuhan sinkronisasi lintas perangkat:

- sidebar terbuka/tertutup;
- toast dan dialog;
- command palette;
- filter dan sorting ringan;
- draft cart sementara;
- parked cart lokal;
- status dismissal reminder pada UI;
- preferensi tampilan.

Data berikut tidak boleh hanya lokal ketika API aktif:

- user, role, permission, dan entitlement;
- tenant dan cabang;
- produk operasional;
- stok dan batch;
- transaksi;
- shift kasir;
- pembelian/receiving;
- hutang/piutang/kas;
- audit log.

## 18. Normalisasi dan kompatibilitas response

Repository sengaja menerima beberapa alias selama masa transisi, misalnya:

- decimal number atau decimal string;
- `batchNumber` menjadi `batchNo`;
- `expiredDate` menjadi `expiryDate`;
- field katalog pada root atau nested `catalog`;
- konfigurasi tenant pada root atau nested `tenantProduct`;
- harga pada base unit di `units[]`.

Alias ini membantu migrasi, tetapi backend sebaiknya menstabilkan satu schema resmi. Jangan mengganti nama field tanpa pembaruan dokumen dan contract test.

Untuk endpoint list dan detail:

- ID entity harus konsisten;
- detail harus menjadi superset list;
- object relasi boleh nested tetapi ID relasinya tetap tersedia;
- pagination metadata harus konsisten;
- nilai uang harus memiliki satu konvensi yang jelas;
- tanggal harus ISO-8601 dan timezone dijelaskan.

## 19. Gap dan keputusan backend

### P0 — menghambat alur inti

1. Pastikan `POST /tenant-products` mengembalikan `productId` operasional secara stabil.
2. Pastikan `POST /stock/batches` menerima batch number, ED, dan stok sesuai flow stok awal.
3. Pastikan `GET /products/:id` dan `/products/:id/batches` mengembalikan ED dengan nama field konsisten.
4. Finalisasi payload receiving PO per batch dan hilangkan ketergantungan terhadap ED buatan frontend.
5. Pertahankan checkout POS atomik dan idempotent.

### P1 — parity fitur UI

1. Ringkasan `totalStock`, `nearestExpiredDate`, dan `batchCount` pada tenant product list atau endpoint overview.
2. Endpoint update draft opname bila metadata draft memang editable.
3. Aksi defekta: edit, delete, bulk action, supplier, dan manual item.
4. Faktur manual create/update jika tetap menjadi fitur UI.
5. Approval/state transition retur penjualan.
6. Export laporan dan print piutang/receipt yang belum terhubung.
7. Endpoint audit standar: frontend saat ini memiliki pemakaian `/owner/audit-control`, sedangkan kontrak lain menyebut `/audit-logs`. Pilih satu pembagian tanggung jawab yang jelas.

### P2 — modul tambahan

1. Integrasi penuh UI resep ke repository.
2. CRM campaign send dan loyalty ledger.
3. CRUD retail promo/price tag.
4. HRD shift/KPI.
5. SOP library/task.
6. Distribusi multi-cabang dan rekomendasi mutasi otomatis.

### Keputusan produk yang masih diperlukan

- Apakah harga resep berbeda dari harga jual biasa?
- Apakah semua kategori produk wajib batch dan ED, atau hanya obat tertentu?
- Apakah tenant boleh membuat produk custom di luar global catalog?
- Siapa yang boleh mengubah catalog global?
- Apakah receiving boleh memecah satu item PO menjadi beberapa batch?
- Apakah nearest ED perlu ditampilkan langsung di daftar produk?

## 20. Checklist contract test backend

### Auth dan akses

- [ ] Login mengembalikan token, user, tenant, role/permission, dan entitlement.
- [ ] Refresh token dapat mengulang request 401 satu kali.
- [ ] User tanpa permission memperoleh 403.
- [ ] User tanpa feature/paket memperoleh kode 403 yang dapat dibedakan.
- [ ] `X-Branch-Id` divalidasi terhadap akses user.

### Produk

- [ ] Catalog list mengembalikan `dosageForm`, `strength`, `manufacturer`, kategori, dan unit default.
- [ ] Tenant owner baru dapat mengaktifkan produk katalog.
- [ ] Category/unit tenant dapat dipetakan dengan benar.
- [ ] `customName` boleh tidak dikirim.
- [ ] Create response memberikan `productId` operasional.
- [ ] Detail mengembalikan unit dan decimal price.
- [ ] Detail edit tidak kehilangan harga, HPP, pabrik, sediaan, atau kekuatan.

### Batch dan ED

- [ ] Batch dapat dibuat setelah produk tenant.
- [ ] `expiredDate` menerima format `YYYY-MM-DD`.
- [ ] Batch muncul pada detail dan endpoint batches.
- [ ] Reminder ED mengembalikan produk, batch, ED, dan quantity.
- [ ] Kegagalan batch tidak menghapus produk yang sudah berhasil dibuat tanpa kontrak atomik.
- [ ] Receiving PO mencatat batch aktual dan stock movement.

### POS dan transaksi

- [ ] Checkout menggunakan idempotency key.
- [ ] Request berulang dengan key sama tidak membuat transaksi ganda.
- [ ] Stok, transaksi, payment, cash/receivable, dan audit tercatat atomik.
- [ ] Supervisor authorization divalidasi dan tidak dapat digunakan bebas berulang kali.

### Keuangan

- [ ] Pembayaran hutang/piutang mencatat ledger dan kas atomik.
- [ ] Filter tanggal/cabang konsisten pada laporan.
- [ ] Nilai uang dan pembulatan konsisten dengan POS.

## 21. Validasi frontend yang telah dilakukan

Pada audit integrasi terakhir:

- TypeScript check lulus;
- production build lulus;
- 13 file test dengan total 47 test lulus;
- test khusus setup produk memverifikasi:
  - create produk tanpa stok awal;
  - urutan create tenant product lalu create batch;
  - penanganan kegagalan parsial batch.

Build masih memiliki warning non-blocking terkait ukuran bundle dan pola import auth store. Warning tersebut tidak mengubah kontrak backend.

## 22. Panduan perubahan kontrak berikutnya

Jika backend mengubah endpoint atau schema:

1. dokumentasikan method, path, auth, query, body, response sukses, dan error;
2. sertakan contoh response list dan detail nyata;
3. tandai field nullable dan enum;
4. jelaskan state transition dan side effect;
5. jelaskan apakah operasi atomik dan idempotent;
6. perbarui adapter repository, bukan langsung page/komponen;
7. tambahkan contract/adapter test;
8. jalankan TypeScript, test, dan production build.

Tujuannya adalah menjaga UI, routing, role gate, dan design system tetap stabil meskipun kontrak backend berkembang.

