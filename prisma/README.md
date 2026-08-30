# Prisma seed files

## Seed lengkap untuk UI integration

Jalankan migration lalu seed idempotent berikut:

```bash
npm run prisma:deploy
npm run prisma:seed
```

Seed membuat satu tenant demo lengkap, dua cabang, plan/features, permission,
lima role, lima akun, serta data master dan operasional untuk inventory, POS,
purchasing, finance, CRM, compliance, dan HR.

Tenant demo:

```text
Apotek MVP 1 Local
- Cabang Utama
- Gudang Pembantu
```

Semua akun memakai password `Password123!`:

```text
superadmin@apotek.local  (SUPER_ADMIN)
owner@apotek.local       (OWNER)
admin@apotek.local       (ADMIN)
apj@apotek.local         (APJ, PIN: 123456)
cashier@apotek.local     (CASHIER)
```

Seed aman dijalankan ulang karena memakai upsert/`ON CONFLICT`. Data dengan ID
seed diperbarui tanpa menghapus tenant atau data lain di database. New real
tenants tetap dapat dibuat melalui `POST /api/v1/internal/tenants`.

`seed.mvp1.sql` remains the legacy seed and still contains the original demo
account domain `@apotek-mvp1.local`. Gunakan `npm run prisma:seed` untuk data
demo yang menjadi referensi FE saat ini.
