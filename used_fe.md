# Used FE - SIM Apotek Backend MVP1

Dokumen ini adalah referensi endpoint yang siap dipakai FE untuk integrasi MVP1.

Status lokal 2026-08-22:

- `npm run verify:staging` lulus: build, OpenAPI, HTTP smoke, database readiness, RLS runtime, dan E2E MVP1.
- Kontrak OpenAPI memuat 53 path wajib.
- Endpoint `src/modules/starter` adalah prototype/legacy. FE baru sebaiknya memakai endpoint module produksi di dokumen ini.

## Seed UI Integration

Untuk database demo dengan data master dan operasional lengkap tetapi hanya satu akun:

```bash
npx prisma migrate deploy
npx prisma db execute --file prisma/seed.superadmin.sql
```

Login superadmin:

```text
email: superadmin@apotek.local
password: Password123!
```

Superadmin membuat tenant baru melalui `POST /internal/tenants`. Tenant baru otomatis mendapat role `OWNER`, `ADMIN`, `CASHIER`, dan `APJ` apabila owner dikirim pada payload.

## Base Contract

Base URL:

```text
/api/v1
```

Header umum untuk endpoint protected:

```http
Authorization: Bearer <accessToken>
X-Branch-Id: <branchId>
Content-Type: application/json
```

`X-Branch-Id` wajib untuk endpoint branch/outlet scoped. Backend juga membaca `X-Outlet-Id`, tetapi FE sebaiknya konsisten memakai `X-Branch-Id`.

Response sukses:

```json
{
  "data": {},
  "meta": {
    "message": "Operation successful"
  }
}
```

Response error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation error",
    "details": []
  }
}
```

Error umum:

| HTTP | Code | Arti |
| --- | --- | --- |
| 400 | `BAD_REQUEST` / `VALIDATION_ERROR` | Payload/query tidak valid |
| 401 | `UNAUTHENTICATED` | Token tidak ada/tidak valid |
| 403 | `PERMISSION_DENIED` / `FEATURE_LOCKED` | Permission/feature tenant tidak cukup |
| 404 | `NOT_FOUND` | Data tidak ditemukan |
| 409 | `CONFLICT` atau code domain | Conflict bisnis/transaksi |
| 429 | `RATE_LIMITED` | Terlalu banyak request |
| 403 | `SUBSCRIPTION_INACTIVE` | Subscription tenant expired/suspended/cancelled |

## Auth

Access token memakai Bearer JWT (default 24 jam) untuk kenyamanan aplikasi POS, dengan dukungan stateless refresh token (berlaku 7 hari) untuk mempermudah pembaruan sesi otomatis tanpa reload halaman.

| Method | Endpoint | Auth | Permission | Catatan |
| --- | --- | --- | --- | --- |
| POST | `/auth/bootstrap` | Tidak | - | Setup pertama jika belum ada user |
| POST | `/auth/login` | Tidak | - | Login owner/user |
| POST | `/auth/logout` | Ya | - | FE discard token |
| POST | `/auth/refresh` | Opsional | - | Refresh session via refreshToken body ATAU access token aktif |
| GET | `/auth/me` | Ya | - | Ambil user, tenant, branches, permissions, entitlements |
| POST | `/auth/dev-token` | Tidak | - | Development only, disabled saat production |

### POST `/auth/bootstrap`

```json
{
  "tenant": {
    "name": "Apotek Sehat",
    "slug": "apotek-sehat",
    "email": "owner@apotek.test",
    "phone": "08123456789",
    "address": "Jl. Contoh"
  },
  "branch": {
    "code": "MAIN",
    "name": "Cabang Utama",
    "phone": "08123456789",
    "address": "Jl. Contoh",
    "siaNumber": "SIA-001",
    "apjName": "Apt. Contoh",
    "apjSipaNumber": "SIPA-001"
  },
  "owner": {
    "name": "Owner",
    "email": "owner@apotek.test",
    "password": "Password123!",
    "phone": "08123456789",
    "sipaNumber": "SIPA-001"
  }
}
```

Response penting: `data.accessToken`, `data.refreshToken`, `data.owner`, `data.tenant`, `data.branch`, `data.permissions`.

### POST `/auth/login`

```json
{
  "email": "owner@apotek.test",
  "password": "Password123!"
}
```

Response penting: `data.accessToken`, `data.refreshToken`, `data.user.permissions`, `data.tenant`, `data.branch`.

### POST `/auth/refresh`

Dapat dipanggil dengan salah satu dari dua cara berikut:

1. **Menggunakan Refresh Token (Direkomendasikan - Tanpa Header Auth)**
   Kirim token refresh dalam body request JSON. Berguna saat access token lama sudah kedaluwarsa.

   Request Body:
   ```json
   {
     "refreshToken": "<refreshToken_lama>"
   }
   ```

2. **Menggunakan Access Token Lama (Kompatibilitas Backward)**
   Kirim access token lama yang masih aktif melalui header Authorization.

   Header:
   ```http
   Authorization: Bearer <accessToken_aktif>
   ```

Response sukses (kedua cara di atas mengembalikan struktur yang sama):
```json
{
  "data": {
    "accessToken": "<newAccessToken>",
    "refreshToken": "<newRefreshToken>"
  },
  "meta": {
    "message": "Token refreshed"
  }
}
```

### GET `/auth/me`

Response penting:

```json
{
  "user": {
    "id": "uuid",
    "tenantId": "uuid",
    "branchId": "uuid",
    "role": "OWNER",
    "permissions": ["product.manage"]
  },
  "tenant": {
    "id": "uuid",
    "subscriptionStatus": "TRIAL",
    "entitlements": [
      { "code": "crm", "enabled": true, "config": null }
    ]
  },
  "activeBranch": {},
  "branches": []
}
```

## Tenant

| Method | Endpoint | Auth | Permission | Catatan |
| --- | --- | --- | --- | --- |
| GET | `/tenants/active` | Ya | - | Tenant aktif user |
| POST | `/tenants/active` | Ya | - | Pilih branch aktif; FE memakai branch id sebagai `X-Branch-Id` |
| GET | `/internal/plans` | Ya | `SUPERADMIN` + `internal.tenant.manage` | Daftar paket aktif untuk console superadmin |
| POST | `/internal/plans` | Ya | `SUPERADMIN` + `internal.tenant.manage` | Buat paket subscription |
| GET | `/internal/tenants` | Ya | `SUPERADMIN` + `internal.tenant.manage` | Superadmin/internal |
| POST | `/internal/tenants` | Ya | `SUPERADMIN` + `internal.tenant.manage` | Superadmin/internal |
| GET | `/internal/tenants/:id` | Ya | `SUPERADMIN` + `internal.tenant.manage` | Detail tenant, plan, branch, feature, user |
| PATCH | `/internal/tenants/:id` | Ya | `SUPERADMIN` + `internal.tenant.manage` | Update profil tenant dan `planId` |
| PATCH | `/internal/tenants/:id/entitlement` | Ya | `SUPERADMIN` + `internal.tenant.manage` | Update satu feature entitlement |
| PATCH | `/internal/tenants/:id/subscription` | Ya | `SUPERADMIN` + `internal.tenant.manage` | Update status, periode, dan plan subscription |
| POST | `/internal/tenants/:id/reset-demo` | Ya | `SUPERADMIN` + `internal.tenant.manage` | Reset status trial/demo 14 hari |
| PATCH | `/internal/tenants/:tenantId/users/:userId/password` | Ya | `SUPERADMIN` + `internal.tenant.manage` | Reset password user tenant |

### Paket dan subscription

Jenis subscription adalah paket `Plan`, bukan nilai `subscriptionStatus`. Paket default saat bootstrap pertama: `start`, `grow`, dan `scale`.

| Paket | Fitur utama |
| --- | --- |
| `start` | `inventory`, `purchasing`, `finance`, `resep` |
| `grow` | Semua fitur `start` + `crm`, `multi_outlet` |
| `scale` | Semua fitur `grow` + `retail`, `hrd`, `sop` |

Status subscription: `TRIAL`, `ACTIVE`, `EXPIRED`, `CANCELLED`, atau `SUSPENDED`.

Alur FE:

1. Ambil daftar paket dari `GET /internal/plans` dan simpan `data[].id`.
2. Saat membuat atau mengganti paket tenant, kirim `planId` berupa UUID `Plan.id`, bukan string `start/grow/scale`.
3. Backend otomatis menyinkronkan `Plan.features` ke `TenantFeature` tenant.
4. FE membaca paket dan entitlement dari `GET /auth/me` atau `GET /tenants/active`.
5. Jika fitur tidak aktif, endpoint terkait mengembalikan `403` dengan code `FEATURE_LOCKED`.

Contoh bagian response tenant:

```json
{
  "plan": {
    "id": "uuid-plan",
    "code": "grow",
    "name": "Grow",
    "features": {
      "inventory": true,
      "purchasing": true,
      "finance": true,
      "resep": true,
      "crm": true,
      "multi_outlet": true,
      "retail": false,
      "hrd": false,
      "sop": false
    }
  },
  "subscriptionStatus": "ACTIVE",
  "subscriptionEndsAt": "2027-08-20T00:00:00.000Z",
  "entitlements": [
    { "code": "crm", "enabled": true, "config": null },
    { "code": "retail", "enabled": false, "config": null }
  ]
}
```

Role platform untuk endpoint `/internal/*` dinormalisasi case-insensitive dan menerima `SUPERADMIN`, `SUPER_ADMIN`, `superadmin`, atau `super_admin`. Permission `internal.tenant.manage` tetap wajib.

## RBAC dan Permission Tenant

Role tenant dan permission dapat dibaca/dikelola melalui endpoint berikut. Semua endpoint memakai `X-Branch-Id` bila user memiliki lebih dari satu branch.

| Method | Endpoint | Permission | Catatan |
| --- | --- | --- | --- |
| GET | `/permissions` | `role.manage` | Daftar permission yang tersedia |
| GET | `/roles` | `role.manage` | Role tenant dan permission-nya |
| POST | `/roles` | `role.manage` | Buat role custom |
| PATCH | `/roles/:id` | `role.manage` | Ubah role custom dan permission |
| DELETE | `/roles/:id` | `role.manage` | Hanya jika tidak dipakai user |

Contoh membuat role custom:

```json
{
  "name": "Kasir Plus",
  "description": "Kasir dengan akses resep",
  "permissionCodes": ["stock.read", "pos.checkout", "prescription.manage"]
}
```

Owner/admin tenant dapat memberi permission tambahan ke role custom, termasuk `prescription.manage`, selama permission tersebut tersedia dan bukan `internal.tenant.manage`. Role system dan `OWNER` tidak dapat diubah atau dihapus.

Setelah role dibuat, gunakan `roleId` dari response pada `POST /users` atau `PATCH /users/:id`.

### PATCH `/internal/tenants/:id/entitlement`

```json
{
  "code": "crm",
  "enabled": true,
  "config": { "tiers": true }
}
```

### PATCH `/internal/tenants/:id/subscription`

```json
{
  "status": "ACTIVE",
  "planId": "uuid",
  "trialEndsAt": null,
  "subscriptionEndsAt": "2027-08-20T00:00:00.000Z"
}
```

`planId` mengubah paket sekaligus menyinkronkan entitlement feature. Perubahan manual satu feature setelahnya dapat dilakukan melalui endpoint entitlement.

### POST `/internal/plans`

Hanya untuk membuat paket baru dari console superadmin. `features` adalah object boolean dan menjadi sumber konfigurasi entitlement saat paket diberikan ke tenant.

```json
{
  "code": "enterprise",
  "name": "Enterprise",
  "description": "Paket enterprise",
  "priceMonthly": 1500000,
  "priceYearly": 15000000,
  "maxBranches": null,
  "maxUsers": null,
  "features": {
    "inventory": true,
    "purchasing": true,
    "finance": true,
    "multi_outlet": true,
    "resep": true,
    "retail": true,
    "crm": true,
    "hrd": true,
    "sop": true
  }
}
```

### POST `/tenants/active`

```json
{
  "branchId": "uuid"
}
```

Endpoint ini tidak mengubah JWT. Setelah berhasil, FE memakai `data.branch.id` sebagai header `X-Branch-Id`.

### POST `/internal/tenants`

```json
{
  "name": "Tenant Baru",
  "slug": "tenant-baru",
  "email": "tenant@example.test",
  "phone": "08123456789",
  "address": "Jl. Tenant",
  "taxId": "01.234.567.8-999.000",
  "planId": "uuid",
  "isDemo": false,
  "branch": {
    "code": "MAIN",
    "name": "Cabang Utama",
    "businessCategory": "APOTEK",
    "phone": "08123456789",
    "address": "Jl. Cabang",
    "siaNumber": "SIA-001",
    "apjName": "Apt. Owner",
    "apjSipaNumber": "SIPA-001"
  },
  "owner": {
    "name": "Owner Tenant",
    "email": "owner@tenant-baru.test",
    "password": "Password123!",
    "phone": "08123456789",
    "sipaNumber": "SIPA-OWNER-001"
  }
}
```

Catatan penting:

- Endpoint ini membuat profil tenant dan menyinkronkan entitlement dari `planId`.
- `email` pada payload adalah email profil tenant, bukan akun login.
- Jika `owner` dikirim, backend membuat role `OWNER`, user owner, hash password, permission owner penuh, master category/unit awal, dan branch awal.
- Jika `owner` dikirim tanpa `branch`, backend otomatis membuat branch default `MAIN` / `Cabang Utama`.
- Akun owner langsung bisa login melalui `POST /auth/login` memakai `owner.email` dan `owner.password`.
- Jika `owner` tidak dikirim, endpoint tetap hanya membuat tenant profile. Tenant belum bisa login sampai user dibuat untuk tenant tersebut.
- Response tetap memiliki `data.id` sebagai tenant id, ditambah `data.branch` dan `data.owner` jika onboarding owner dilakukan.

Contoh login owner tenant baru:

```json
{
  "email": "owner@tenant-baru.test",
  "password": "Password123!"
}
```

### PATCH `/internal/tenants/:tenantId/users/:userId/password`

Endpoint ini dipakai superadmin/internal untuk reset password user milik tenant, termasuk akun owner tenant yang dibuat dari onboarding.

Parameter:

| Param | Isi |
| --- | --- |
| `tenantId` | `Tenant.id` dari tenant target |
| `userId` | `User.id` dari user tenant target |

Header:

```http
Authorization: Bearer <accessToken_superadmin>
X-Branch-Id: <branchId_superadmin>
Content-Type: application/json
```

Payload:

```json
{
  "newPassword": "Password456!",
  "reason": "Owner lupa password"
}
```

Response penting:

```json
{
  "data": {
    "id": "uuid-user",
    "tenantId": "uuid-tenant",
    "branchId": "uuid-branch",
    "roleId": "uuid-role",
    "name": "Owner Tenant",
    "email": "owner@tenant-baru.test",
    "phone": "08123456789",
    "sipaNumber": "SIPA-OWNER-001",
    "status": "ACTIVE"
  },
  "meta": {
    "message": "Tenant user password reset"
  }
}
```

Catatan FE:

- `newPassword` minimal 8 karakter.
- Password di-hash di backend. Response tidak pernah mengembalikan `password` atau `passwordHash`.
- Setelah reset, user login memakai password baru melalui `POST /auth/login`.
- Access token lama tidak otomatis dicabut karena JWT masih stateless. Untuk MVP1, FE cukup arahkan user logout/login ulang jika reset dilakukan saat user sedang aktif.
- Aksi ini masuk audit log dengan entity `UserPassword`; kirim `reason` agar riwayat operasional jelas.

## Master Data

| Method | Endpoint | Permission | Body utama |
| --- | --- | --- | --- |
| GET | `/branches` | `branch.manage` | - |
| POST | `/branches` | `branch.manage` | Branch body |
| PATCH | `/branches/:id` | `branch.manage` | Update branch |
| DELETE | `/branches/:id` | `branch.manage` | Deactivate branch; gagal bila masih ada user aktif |
| GET | `/outlets` | `branch.manage` | Alias `/branches` |
| POST | `/outlets` | `branch.manage` | Alias `/branches` |
| PATCH | `/outlets/:id` | `branch.manage` | Alias update branch |
| DELETE | `/outlets/:id` | `branch.manage` | Alias deactivate branch |
| GET | `/categories` | `product.manage` | - |
| POST | `/categories` | `product.manage` | Category body |
| PATCH | `/categories/:id` | `product.manage` | Update category |
| DELETE | `/categories/:id` | `product.manage` | Gagal bila masih dipakai produk |
| GET | `/units` | `product.manage` | - |
| POST | `/units` | `product.manage` | Unit body |
| PATCH | `/units/:id` | `product.manage` | Update unit |
| DELETE | `/units/:id` | `product.manage` | Gagal bila masih dipakai product unit |
| GET | `/racks` | `stock.read` | - |
| POST | `/racks` | `stock.adjust` | Rack body |
| PATCH | `/racks/:id` | `stock.adjust` | Update rack |
| DELETE | `/racks/:id` | `stock.adjust` | Gagal bila masih dipakai batch |
| GET | `/suppliers` | `purchase.manage` | - |
| POST | `/suppliers` | `purchase.manage` | Supplier body |
| PATCH | `/suppliers/:id` | `purchase.manage` | Update supplier |
| DELETE | `/suppliers/:id` | `purchase.manage` | Gagal bila masih direferensikan |
| GET | `/customers` | `product.manage` | - |
| POST | `/customers` | `product.manage` | Customer body |
| PATCH | `/customers/:id` | `product.manage` | Update customer |
| DELETE | `/customers/:id` | `product.manage` | Gagal bila punya histori |
| GET | `/doctors` | `product.manage` | - |
| POST | `/doctors` | `product.manage` | Doctor body |
| PATCH | `/doctors/:id` | `product.manage` atau `prescription.manage` | Update doctor |
| DELETE | `/doctors/:id` | `product.manage` atau `prescription.manage` | Gagal bila dipakai resep |
| GET | `/users` | `user.manage` | - |
| POST | `/users` | `user.manage` | User body |
| PATCH | `/users/:id` | `user.manage` | Update user/role/branch/status |
| DELETE | `/users/:id` | `user.manage` | Deactivate user, bukan hard delete |

Branch/outlet body:

```json
{
  "code": "MAIN",
  "name": "Cabang Utama",
  "businessCategory": "APOTEK",
  "phone": "08123456789",
  "address": "Jl. Contoh",
  "siaNumber": "SIA-001",
  "apjName": "Apt. Contoh",
  "apjSipaNumber": "SIPA-001"
}
```

Category body:

```json
{
  "name": "Obat Bebas",
  "type": "OBAT_BEBAS"
}
```

Allowed `type`: `OBAT_BEBAS`, `OBAT_BEBAS_TERBATAS`, `OBAT_KERAS`, `PSIKOTROPIKA`, `NARKOTIKA`, `ALKES`, `BMHP`, `KOSMETIK`, `UMUM`.

Unit body:

```json
{
  "code": "TABLET",
  "name": "Tablet"
}
```

Rack body:

```json
{
  "branchId": "uuid",
  "code": "R-A1",
  "name": "Rak A1",
  "type": "RACK"
}
```

Supplier body:

```json
{
  "code": "SUP-001",
  "name": "PBF Contoh",
  "type": "PBF",
  "email": "sales@pbf.test",
  "phone": "08123456789",
  "address": "Jl. Supplier",
  "taxId": "01.234.567.8-999.000",
  "contactPerson": "Budi"
}
```

Allowed supplier `type`: `PBF`, `DISTRIBUTOR`, `CONSIGNOR`, `GENERAL`.

Customer/member body:

```json
{
  "memberNo": "MEM-001",
  "name": "Customer Contoh",
  "phone": "08123456789",
  "email": "customer@example.test",
  "address": "Jl. Customer",
  "birthDate": "1990-01-01",
  "gender": "F"
}
```

Doctor/practitioner awal body:

```json
{
  "name": "dr. Contoh",
  "sipNumber": "SIP-001",
  "phone": "08123456789",
  "address": "Jl. Dokter"
}
```

User body:

```json
{
  "branchId": "uuid",
  "roleId": "uuid",
  "name": "Kasir",
  "email": "kasir@example.test",
  "phone": "08123456789",
  "password": "Password123!",
  "sipaNumber": "SIPA-001"
}
```

## Products

| Method | Endpoint | Permission | Catatan |
| --- | --- | --- | --- |
| GET | `/products` | `stock.read` | List produk |
| GET | `/products/search?q=para` | `stock.read` | Search POS/master |
| POST | `/products` | `product.manage` | Buat produk + base unit |
| GET | `/products/:id` | `stock.read` | Detail + batches |
| PATCH | `/products/:id` | `product.manage` | Update master/harga base |
| DELETE | `/products/:id` | `product.manage` | Gagal jika sudah ada histori |
| GET | `/products/:id/batches` | `stock.read` | Batch by product |

### POST `/products`

```json
{
  "categoryId": "uuid",
  "defaultSupplierId": "uuid",
  "code": "PRD-001",
  "barcode": "899000000001",
  "name": "Paracetamol 500mg",
  "genericName": "Paracetamol",
  "brandName": "Brand",
  "registrationNumber": "DBL0000000010A1",
  "dosageForm": "Tablet",
  "strength": "500mg",
  "composition": "Paracetamol 500mg",
  "manufacturer": "PT Contoh",
  "principal": "PT Principal",
  "productType": "MEDICINE",
  "controlledClass": "NONE",
  "requiresPrescription": false,
  "minStock": 10,
  "maxStock": 100,
  "unitId": "uuid",
  "conversion": 1,
  "sellingPrice": 15000,
  "purchasePrice": 8000
}
```

Allowed `productType`: `MEDICINE`, `MEDICAL_DEVICE`, `CONSUMABLE`, `COSMETIC`, `GENERAL`, `COMPOUND`.

Allowed `controlledClass`: `NONE`, `OBAT_KERAS`, `PSIKOTROPIKA`, `NARKOTIKA`.

### PATCH `/products/:id`

Body sama dengan create, tetapi semua field optional kecuali `unitId` dan `conversion` tidak diterima. Bisa kirim `status`: `ACTIVE`, `INACTIVE`, `DISCONTINUED`.

Jika mengubah harga jual saat policy tenant `requireSupervisorForPriceEdit` aktif, FE wajib lebih dahulu membuat authorization dengan action `edit_sell_price`, lalu mengirim `supervisorAuthorizationIds` pada payload update. Menghapus produk yang sudah memiliki histori memakai action `delete_product_with_history` dan diproses sebagai `DISCONTINUED` agar histori tetap aman.

## Inventory

Semua endpoint inventory di bawah ini **branch-scoped**. FE harus mengirim `X-Branch-Id: <branchId>` untuk memilih cabang aktif. Backend bisa fallback ke `branchId` dari JWT user, tetapi FE sebaiknya tetap mengirim header agar aman saat user bisa pindah cabang.

`branchId` tidak perlu dikirim di body untuk endpoint inventory. Body hanya berisi data operasi stok, sedangkan scope cabang diambil dari header/token.

| Method | Endpoint | Permission | Scope/Params | Catatan |
| --- | --- | --- | --- | --- |
| GET | `/stock/overview` | `stock.read` | `X-Branch-Id` | Total stok per produk |
| GET | `/stock/defekta` | `stock.read` | `X-Branch-Id` | Produk stok <= minStock |
| GET | `/stock/reminder-ed?days=90` | `stock.read` | `X-Branch-Id`, query `days` optional | Batch akan expired |
| GET | `/products/:id/stock-card` | `stock.read` | `X-Branch-Id`, path `id` = productId | StockLedger produk |
| POST | `/stock/batches` | `stock.adjust` | `X-Branch-Id` | Tambah batch/stok awal |
| GET | `/stock/opname` | `stock.read` | `X-Branch-Id` | List opname |
| POST | `/stock/opname` | `stock.adjust` | `X-Branch-Id` | Draft opname |
| GET | `/stock/opname/:id/items` | `stock.read` | `X-Branch-Id` | Item opname |
| PATCH | `/stock/opname/:id` | `stock.adjust` | `X-Branch-Id` | Update catatan opname draft |
| PUT | `/stock/opname/:id/physical-counts` | `stock.adjust` | `X-Branch-Id` | Simpan hitungan fisik |
| POST | `/stock/opname/:id/close` | `stock.adjust` | `X-Branch-Id`, path `id` = opnameId | Apply opname |
| GET | `/stock/internal-mutations` | `stock.read` | `X-Branch-Id` | Riwayat mutasi lokasi |
| POST | `/stock/internal-mutations` | `stock.adjust` | `X-Branch-Id` | Mutasi lokasi/rak |

Contoh header:

```http
Authorization: Bearer <accessToken>
X-Branch-Id: <branchId>
Content-Type: application/json
```

### POST `/stock/batches`

```json
{
  "productId": "uuid",
  "batchNumber": "BATCH-001",
  "expiredDate": "2027-12-31",
  "buyPrice": 8000,
  "stock": 100,
  "locationId": "uuid",
  "notes": "Initial stock"
}
```

### POST `/stock/opname`

```json
{
  "code": "OPN-001",
  "notes": "Opname bulanan",
  "items": [
    {
      "batchId": "uuid",
      "realStock": 98
    }
  ]
}
```

### POST `/stock/internal-mutations`

```json
{
  "batchId": "uuid",
  "toLocationId": "uuid",
  "qty": 100,
  "notes": "Pindah rak"
}
```

Catatan: partial rack mutation belum didukung. `qty` harus sama dengan stok batch jika dikirim.

## Supervisor Authorization

Aksi sensitif harus meminta otorisasi supervisor terlebih dahulu. FE mengirim password supervisor atau PIN APJ, lalu menyimpan `data.id` authorization untuk request operasi.

### POST `/auth/supervisor-authorizations`

```json
{
  "supervisorId": "uuid-supervisor",
  "action": "discount_over_50",
  "password": "PasswordSupervisor!",
  "reason": "Diskon pelanggan khusus",
  "expiresInSeconds": 300
}
```

Nilai `action`:

```text
cancel_paid_trx
discount_over_50
return_over_sell
sell_empty_stock
delete_product_with_history
edit_sell_price
```

Gunakan response `data.id` pada `supervisorAuthorizationIds`. Authorization hanya berlaku untuk tenant, branch, user peminta, action, dan periode expiry yang sesuai; maksimum expiry 1800 detik.

## Cashier Shifts

Semua endpoint cashier shift **branch-scoped**. FE harus mengirim `X-Branch-Id: <branchId>`.

`:id` pada endpoint cashier shift adalah `CashierSession.id`, yaitu `data.id` dari response `POST /cashier-shifts/open`. Ini bukan `cashierId`, bukan `userId`, dan bukan `branchId`.

| Method | Endpoint | Permission | Scope/Params | Catatan |
| --- | --- | --- | --- | --- |
| POST | `/cashier-shifts/open` | `pos.checkout` | `X-Branch-Id` | Buka shift kasir |
| GET | `/cashier-shifts/:id` | `pos.checkout` | `X-Branch-Id`, path `id` = `CashierSession.id` | Detail shift |
| POST | `/cashier-shifts/:id/close` | `pos.checkout` | `X-Branch-Id`, path `id` = `CashierSession.id` | Blind close |
| POST | `/cashier-shifts/:id/deposit` | `finance.manage` | `X-Branch-Id`, path `id` = `CashierSession.id` | Set deposit |
| POST | `/cashier-shifts/:id/verify` | `stock.adjust` | `X-Branch-Id`, path `id` = `CashierSession.id` | Verifikasi leader |

### POST `/cashier-shifts/open`

```json
{
  "cashierId": "uuid",
  "startingCash": 100000,
  "notes": "Shift pagi"
}
```

`cashierId` optional. Jika kosong, backend memakai user dari token.

Response penting untuk FE:

```json
{
  "data": {
    "id": "cashier-session-uuid",
    "tenantId": "uuid",
    "branchId": "uuid",
    "cashierId": "uuid",
    "status": "OPEN",
    "startingCash": "100000.00",
    "openedAt": "2026-08-18T08:00:00.000Z"
  },
  "meta": {
    "message": "Cashier shift opened"
  }
}
```

Simpan `data.id` sebagai `cashierShiftId`/`sessionId` di state FE. Gunakan nilai itu untuk:

```txt
GET  /cashier-shifts/{data.id}
POST /cashier-shifts/{data.id}/close
POST /cashier-shifts/{data.id}/deposit
POST /cashier-shifts/{data.id}/verify
POST /pos/checkout body.sessionId
```

### GET `/cashier-shifts/:id`

Tidak ada body. Kirim header:

```http
Authorization: Bearer <accessToken>
X-Branch-Id: <branchId>
```

Response berisi data shift, cashier, branch, dan daftar sales pada shift tersebut.

### POST `/cashier-shifts/:id/close`

```json
{
  "actualCash": 500000,
  "notes": "Tutup shift"
}
```

Backend menghitung `expectedCash` dan `difference`. FE kasir tidak perlu meminta expected cash sebelum close.

### POST `/cashier-shifts/:id/deposit`

```json
{
  "depositAmount": 450000,
  "notes": "Setor kas"
}
```

### POST `/cashier-shifts/:id/verify`

```json
{
  "approved": true,
  "notes": "Sesuai"
}
```

## POS and Transactions

| Method | Endpoint | Permission | Catatan |
| --- | --- | --- | --- |
| POST | `/pos/checkout` | `pos.checkout` | Checkout POS idempotent |
| GET | `/transactions` | `pos.checkout` | Query optional `status` |
| GET | `/transactions/:id` | `pos.checkout` | Detail transaksi |
| POST | `/transactions/:id/cancel` | `sale.return` | Cancel transaksi completed |
| GET | `/receipts/:transactionId` | `pos.checkout` | Data receipt thermal |
| GET | `/sales-returns` | `sale.return` | Riwayat retur penjualan |
| POST | `/sales-returns` | `sale.return` | Retur jual, refund, dan restore stok |

### POST `/pos/checkout`

Header tambahan wajib:

```http
Idempotency-Key: <unique-key-per-payment-attempt>
```

Header global tetap wajib:

```http
Authorization: Bearer <access_token>
X-Branch-Id: <branch-id>
```

Body:

```json
{
  "cashierId": "uuid",
  "customerId": "uuid",
  "sessionId": "uuid",
  "saleType": "REGULAR",
  "channel": "OFFLINE",
  "discountAmount": 0,
  "taxAmount": 0,
  "notes": "Catatan transaksi",
  "items": [
    {
      "productId": "uuid",
      "productUnitId": "uuid",
      "batchId": "uuid",
      "qty": 1,
      "unitPrice": 15000,
      "discountAmount": 0
    }
  ],
  "payments": [
    {
      "method": "CASH",
      "amount": 15000,
      "referenceNo": "REF-001"
    }
  ]
}
```

Allowed `saleType`: `REGULAR`, `PRESCRIPTION`, `COMPOUND`.

Allowed `channel`: `OFFLINE`, `WHATSAPP`, `MARKETPLACE`, `ONLINE_STORE`, `MOBILE_OFFLINE`.

Allowed payment `method`: `CASH`, `QRIS`, `DEBIT_CARD`, `CREDIT_CARD`, `TRANSFER`, `E_WALLET`, `CREDIT`.

Cara kerja checkout:

- Endpoint ini langsung memfinalisasi transaksi. Jika sukses, backend membuat sale completed, sale item, sale payment, stock ledger, cash mutation untuk pembayaran non-credit, dan receivable jika pembayaran kurang dari total.
- `sessionId` adalah `CashierSession.id` dari endpoint `POST /cashier-shifts/open`. FE disarankan selalu mengirim `sessionId` shift aktif.
- `cashierId` optional. Jika kosong, backend memakai user dari token login.
- `customerId` optional. Kosongkan jika transaksi walk-in tanpa customer tersimpan.
- `batchId` optional. Jika kosong, backend memilih batch otomatis dengan FEFO dari batch `AVAILABLE`.
- `unitPrice` optional. Jika kosong, backend memakai harga dari product unit.
- `Idempotency-Key` harus unik per percobaan pembayaran. Untuk retry body yang sama pakai key yang sama; untuk cart yang diubah atau customer berbeda pakai key baru.

Catatan:

- Shift kasir harus sudah open.
- Jika `batchId` kosong, backend memilih batch FEFO dari batch `AVAILABLE`.
- Retry dengan `Idempotency-Key` dan body sama akan mengembalikan sale yang sama.
- Retry dengan key sama tapi body berbeda akan `409 IDEMPOTENCY_KEY_CONFLICT`.
- Jika discount item/global melebihi 50% atau menjual stok kosong, kirim authorization supervisor yang sesuai.

### Pending cart / hold customer

Saat ini MVP 1 belum punya endpoint backend untuk hold/pending cart POS. Walaupun schema memiliki status sale `DRAFT`, modul POS yang tersedia hanya `POST /pos/checkout`, sehingga data cart baru masuk database ketika checkout sukses.

Untuk melayani lebih dari 1 customer tanpa menghilangkan input, FE perlu menyimpan pending cart di state FE sampai user melakukan checkout. Minimal state yang disarankan:

```json
{
  "activeCartId": "local-cart-uuid-1",
  "carts": [
    {
      "id": "local-cart-uuid-1",
      "label": "Customer 1",
      "sessionId": "cashier-session-uuid",
      "customerId": null,
      "saleType": "REGULAR",
      "channel": "OFFLINE",
      "discountAmount": 0,
      "taxAmount": 0,
      "notes": "",
      "items": [
        {
          "productId": "uuid",
          "productUnitId": "uuid",
          "batchId": null,
          "qty": 1,
          "unitPrice": 15000,
          "discountAmount": 0
        }
      ],
      "payments": []
    }
  ]
}
```

Implementasi FE yang aman untuk MVP 1:

- Simpan cart aktif dan cart pending di memory state.
- Persist ke `localStorage` atau IndexedDB agar input tidak hilang jika browser refresh.
- Saat user menekan bayar, kirim cart terpilih ke `POST /pos/checkout`.
- Hapus cart lokal hanya setelah checkout sukses.
- Jangan kurangi stok di FE sebagai sumber kebenaran. Stok tetap dipastikan backend saat checkout.

Jika nanti ingin pending cart tersimpan di database, perlu tambahan endpoint seperti `POST /pos/carts`, `PATCH /pos/carts/:id`, `POST /pos/carts/:id/checkout`, atau memakai `SaleStatus.DRAFT` dengan implementasi service khusus.

### POST `/transactions/:id/cancel`

```json
{
  "reason": "Salah input"
}
```

Cancel mengembalikan stok batch, membuat stock ledger, dan update cash/receivable bila relevan.

### POST `/sales-returns`

```json
{
  "saleId": "uuid",
  "returnNumber": "SR-001",
  "reason": "Barang dikembalikan",
  "items": [
    { "saleItemId": "uuid", "qty": 1 }
  ],
  "supervisorAuthorizationIds": []
}
```

Jika jumlah retur melebihi sisa jumlah item yang dapat diretur, authorization `return_over_sell` wajib disertakan.

## Purchases

| Method | Endpoint | Permission | Catatan |
| --- | --- | --- | --- |
| POST | `/purchase-orders/apj-pin` | `purchase.manage` | Set PIN APJ user aktif |
| GET | `/purchase-orders` | `purchase.manage` | Query optional `status` |
| POST | `/purchase-orders` | `purchase.manage` | Buat PO draft |
| GET | `/purchase-orders/:id` | `purchase.manage` | Detail PO + approvals |
| POST | `/purchase-orders/:id/submit-approval` | `purchase.manage` | Submit approval |
| POST | `/purchase-orders/:id/approve-apj` | `purchase.manage` | Approve dengan PIN APJ |
| POST | `/purchase-orders/:id/receive` | `purchase.manage` | Receiving batch + debt |
| GET | `/invoices` | `purchase.manage` | Purchase dengan invoice |
| GET | `/purchase-returns` | `purchase.manage` | List return pembelian |
| POST | `/purchase-returns` | `purchase.manage` | Return pembelian |

### POST `/purchase-orders/apj-pin`

```json
{
  "pin": "123456"
}
```

### POST `/purchase-orders`

```json
{
  "supplierId": "uuid",
  "poNumber": "PO-001",
  "invoiceNo": "INV-SUP-001",
  "dueDate": "2026-09-30",
  "discountAmount": 0,
  "taxAmount": 0,
  "items": [
    {
      "productId": "uuid",
      "productUnitId": "uuid",
      "qty": 10,
      "buyPrice": 8000
    }
  ]
}
```

### POST `/purchase-orders/:id/submit-approval`

```json
{
  "notes": "Mohon approval APJ"
}
```

### POST `/purchase-orders/:id/approve-apj`

```json
{
  "pin": "123456",
  "notes": "Approved"
}
```

### POST `/purchase-orders/:id/receive`

```json
{
  "invoiceNo": "INV-SUP-001",
  "dueDate": "2026-09-30",
  "items": [
    {
      "purchaseItemId": "uuid",
      "receivedQty": 10,
      "batchNumber": "BATCH-PO-001",
      "expiredDate": "2027-12-31",
      "locationId": "uuid"
    }
  ]
}
```

### POST `/purchase-returns`

```json
{
  "purchaseId": "uuid",
  "returnNumber": "PR-001",
  "reason": "Barang rusak",
  "items": [
    {
      "purchaseItemId": "uuid",
      "batchId": "uuid",
      "qty": 1
    }
  ]
}
```

## Finance

| Method | Endpoint | Permission | Catatan |
| --- | --- | --- | --- |
| GET | `/cash` | `finance.manage` | List cash accounts |
| POST | `/cash` | `finance.manage` | Buat cash account |
| GET | `/cash/mutations` | `finance.manage` | Mutasi kas |
| POST | `/cash/mutations` | `finance.manage` | Mutasi kas manual |
| GET | `/debts` | `finance.manage` | Hutang |
| POST | `/debts/:id/pay` | `finance.manage` | Bayar hutang |
| POST | `/debts/:id/payments` | `finance.manage` | Alias kompatibilitas untuk bayar hutang |
| GET | `/receivables` | `finance.manage` | Piutang |
| POST | `/receivables/:id/pay` | `finance.manage` | Bayar piutang |
| POST | `/receivables/:id/payments` | `finance.manage` | Alias kompatibilitas untuk bayar piutang |
| POST | `/expenses` | `finance.manage` | Catat expense |
| GET | `/finance/pnl` | `finance.manage` | P&L live |
| GET | `/finance/cash-flow` | `finance.manage` | Cash flow by mutation type |
| GET | `/finance/balance-sheet` | `finance.manage` | Summary neraca |
| GET | `/finance/ratios` | `finance.manage` | Rasio ringkas |
| GET | `/finance/aging-debts` | `finance.manage` | Aging hutang |
| GET | `/finance/aging-receivables` | `finance.manage` | Aging piutang |

### POST `/cash`

```json
{
  "branchId": "uuid",
  "code": "CASH-MAIN",
  "name": "Kas Utama",
  "openingBalance": 1000000
}
```

### POST `/cash/mutations`

```json
{
  "branchId": "uuid",
  "cashAccountId": "uuid",
  "type": "CASH_IN",
  "amount": 100000,
  "notes": "Setoran manual"
}
```

Allowed `type`: `CASH_IN`, `CASH_OUT`, `CASH_TRANSFER`, `OPENING_BALANCE`, `EXPENSE`.

### POST `/debts/:id/pay`

```json
{
  "cashAccountId": "uuid",
  "paymentMethod": "TRANSFER",
  "amount": 100000,
  "referenceNo": "TRF-001"
}
```

### POST `/receivables/:id/pay`

```json
{
  "cashAccountId": "uuid",
  "paymentMethod": "CASH",
  "amount": 100000,
  "referenceNo": "RCV-001"
}
```

### POST `/expenses`

```json
{
  "branchId": "uuid",
  "cashAccountId": "uuid",
  "category": "OPERASIONAL",
  "amount": 50000,
  "description": "Biaya operasional",
  "spentAt": "2026-08-18"
}
```

## Compliance

| Method | Endpoint | Permission | Catatan |
| --- | --- | --- | --- |
| GET | `/licenses` | `compliance.manage` atau `finance.manage` | List izin outlet/tenant |
| POST | `/licenses` | `compliance.manage` atau `finance.manage` | Buat license |
| PATCH | `/licenses/:id` | `compliance.manage` atau `finance.manage` | Update license |
| GET | `/licenses/alerts` | `compliance.manage` atau `finance.manage` | Alert 90/60/30/7 hari |
| GET | `/practitioner-licenses` | `compliance.manage` atau `finance.manage` | List SIPA/SIP practitioner |
| POST | `/practitioner-licenses` | `compliance.manage` atau `finance.manage` | Buat practitioner license |
| PATCH | `/practitioner-licenses/:id` | `compliance.manage` atau `finance.manage` | Update practitioner license |

### POST `/licenses`

```json
{
  "branchId": "uuid",
  "code": "SIA-MAIN",
  "type": "SIA",
  "holderName": "Apotek Sehat",
  "number": "SIA-001",
  "issuedAt": "2025-01-01",
  "expiredAt": "2027-01-01",
  "status": "ACTIVE",
  "notes": "Izin utama"
}
```

### POST `/practitioner-licenses`

```json
{
  "branchId": "uuid",
  "practitionerName": "Apt. Contoh",
  "profession": "APOTEKER",
  "licenseType": "SIPA",
  "number": "SIPA-001",
  "issuedAt": "2025-01-01",
  "expiredAt": "2027-01-01",
  "status": "ACTIVE",
  "notes": "APJ"
}
```

## Pharmacy / Resep

Feature tenant wajib: `resep`.

| Method | Endpoint | Permission | Catatan |
| --- | --- | --- | --- |
| GET | `/prescriptions` | `prescription.manage` atau `product.manage` | Query optional `status`, `customerId` |
| POST | `/prescriptions` | `prescription.manage` atau `product.manage` | Buat resep + label awal |
| GET | `/prescriptions/history` | `prescription.manage` atau `product.manage` | History redeemed/cancelled |
| GET | `/prescriptions/:id` | `prescription.manage` atau `product.manage` | Detail resep |
| PATCH | `/prescriptions/:id` | `prescription.manage` atau `product.manage` | Update resep/items |
| POST | `/prescriptions/:id/verify` | `prescription.manage` atau `product.manage` | Verifikasi apoteker/user aktif |
| POST | `/prescriptions/:id/dispense` | `prescription.manage` atau `product.manage` | Ikat resep ke sale POS |

### POST `/prescriptions`

```json
{
  "prescriptionNumber": "RX-001",
  "source": "MANUAL",
  "repeatType": "NONE",
  "repeatLimit": 1,
  "doctorId": "uuid",
  "customerId": "uuid",
  "attachmentUrl": "https://example.test/resep.jpg",
  "notes": "Catatan resep",
  "items": [
    {
      "productId": "uuid",
      "medicineName": "Paracetamol 500mg",
      "qtyRequired": 10,
      "dosageInstruction": "3 x sehari 1 tablet",
      "labelText": "Sesudah makan",
      "isCompounded": false
    }
  ]
}
```

Allowed `source`: `MANUAL`, `DOCTOR_RME`, `COPY_FROM_OTHER_PHARMACY`, `TELEPHARMACY`.

Allowed `repeatType`: `NONE`, `ITEM_ITER`, `FULL_ITER`.

Allowed `status` saat update: `RECEIVED`, `PARTIALLY_REDEEMED`, `REDEEMED`, `CANCELLED`.

### POST `/prescriptions/:id/dispense`

```json
{
  "saleId": "uuid",
  "notes": "Sudah diserahkan"
}
```

Syarat:

- Resep sudah diverifikasi.
- `saleId` adalah sale completed dengan `saleType` `PRESCRIPTION` atau `COMPOUND`.

## CRM

Feature tenant wajib: `crm`.

| Method | Endpoint | Permission | Catatan |
| --- | --- | --- | --- |
| GET | `/crm/members?q=andi` | `product.manage` | Member dari Customer + tier live |
| POST | `/crm/members` | `product.manage` | Buat member/customer |
| GET | `/crm/campaigns` | `product.manage` | Campaign dari AnalyticsSnapshot |
| POST | `/crm/campaigns` | `product.manage` | Buat campaign |

### POST `/crm/members`

```json
{
  "memberNo": "MEM-001",
  "name": "Andi",
  "phone": "08123456789",
  "email": "andi@example.test",
  "address": "Jl. Member",
  "birthDate": "1990-01-01",
  "gender": "M",
  "points": 0
}
```

Tier default:

- `PLATINUM`: total belanja >= 10000000
- `GOLD`: total belanja >= 5000000
- `SILVER`: total belanja >= 1000000
- `BASIC`: default

Jika tenant punya policy `crm.tiers`, backend membaca rule dari sana.

### POST `/crm/campaigns`

```json
{
  "branchId": "uuid",
  "name": "Promo Akhir Bulan",
  "type": "PROMO",
  "channel": "WHATSAPP",
  "status": "DRAFT",
  "segment": "GOLD",
  "message": "Promo khusus member",
  "startsAt": "2026-08-20T00:00:00.000Z",
  "endsAt": "2026-08-31T23:59:59.000Z"
}
```

Allowed campaign `type`: `BROADCAST`, `PROMO`, `LOYALTY`, `REMINDER`.

Allowed `channel`: `WHATSAPP`, `SMS`, `EMAIL`, `IN_APP`.

Allowed `status`: `DRAFT`, `SCHEDULED`, `RUNNING`, `COMPLETED`, `CANCELLED`.

## Owner and Analysis

| Method | Endpoint | Permission | Catatan |
| --- | --- | --- | --- |
| GET | `/owner/dashboard` | `report.read` | KPI dashboard single outlet/tenant |
| GET | `/owner/daily-brief` | `report.read` | Brief harian |
| GET | `/owner/health-score` | `report.read` | Score operasional |
| GET | `/owner/warnings` | `report.read` | Low stock, ED, overdue |
| GET | `/owner/recommendations` | `report.read` | Rekomendasi action |
| GET | `/owner/audit-control` | `audit.read` atau `report.read` | Audit control/anomali |
| GET | `/analysis/inventory` | `report.read` | Analisis inventory |
| GET | `/analysis/pareto` | `report.read` | Produk revenue tertinggi bulan ini |
| GET | `/analysis/product-margin` | `report.read` | Margin produk bulan ini |
| GET | `/analysis/supplier-purchases` | `report.read` | Pembelian supplier bulan ini |

Semua endpoint owner membaca data live dari sale, sale item, stock batch, cash, debt, receivable, purchase, dan audit log.

## Audit Log

| Method | Endpoint | Permission | Catatan |
| --- | --- | --- | --- |
| GET | `/audit-logs` | `audit.read` | Filter `action`, `entity`, `take`; branch-scoped |

Contoh query:

```text
GET /audit-logs?action=UPDATE&entity=Role&take=50
```

Backend mencatat login/logout, perubahan role/permission, perubahan master sensitif, adjustment stok, checkout, retur, pembatalan transaksi, pembayaran, approval pembelian, dan supervisor authorization.

## Minimal FE Integration Flow

1. Login: `POST /auth/login`.
2. Simpan `accessToken`.
3. Panggil `GET /auth/me`.
4. Pilih branch dari `data.branches`, lalu kirim `X-Branch-Id` di endpoint branch-scoped.
5. Untuk halaman administrasi, load `GET /permissions` dan `GET /roles`, lalu kelola role custom melalui `/roles` sebelum membuat user.
6. Load master data: products, customers, suppliers, units, categories, racks.
7. POS:
   - buka shift `POST /cashier-shifts/open`
   - checkout `POST /pos/checkout` dengan `Idempotency-Key`
   - print receipt dari `GET /receipts/:transactionId`
   - close shift `POST /cashier-shifts/:id/close`
8. Jika aksi sensitif membutuhkan override, panggil `POST /auth/supervisor-authorizations`, lalu kirim `data.id` pada `supervisorAuthorizationIds`.
9. Backoffice:
   - purchase order -> submit approval -> approve APJ -> receive
   - finance report
   - owner dashboard
10. Add-on MVP1:
   - prescription verify/dispense
   - CRM member/campaign
   - compliance alerts

## Deployment/Local DB Checklist untuk FE Testing

Setelah database PostgreSQL lokal sudah siap:

```bash
npm ci
npm run prisma:deploy
npm run verify:staging
npm run dev
```

Dev server default:

```text
http://localhost:5000/api/v1
```

Environment minimal:

```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pharmacy_db?schema=public"
JWT_SECRET="change-this-development-secret-at-least-32-characters"
CORS_ORIGIN="http://localhost:3000,http://localhost:5173"
JSON_BODY_LIMIT="1mb"
TRUST_PROXY=false
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=600
```

Untuk staging/production nanti:

- `NODE_ENV=production`
- `JWT_SECRET` wajib secret asli, bukan contoh.
- `CORS_ORIGIN` wajib domain FE final.
- Jalankan `npm run prisma:deploy` sebelum start app.
- Jalankan `npm run verify:staging` di staging sebelum promosi release.
