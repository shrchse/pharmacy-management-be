# AGENT.md - Kelola Apotek Backend Integration Guide

## Tujuan Agent

Repo ini adalah frontend Kelola Apotek. Tugas agent saat mengerjakan backend integration adalah mengganti data mock/localStorage melalui repository layer tanpa mengubah perilaku UI, routing, role gate, atau design system.

Baca dulu:

- `README.md`
- `PRD.md`
- `src/services/index.ts`
- `src/services/db.ts`
- `src/services/repository/*`
- `src/types/*`
- `src/lib/rbac.ts`

## Prinsip Utama

1. Jangan refactor page/komponen jika tugasnya hanya integrasi API.
2. Pertahankan signature repository yang sudah dipakai FE.
3. Komponen harus tetap menerima tipe yang sama seperti sekarang.
4. Backend adalah source of truth untuk auth, permission, entitlement, stok, transaksi, keuangan, tenant, dan audit.
5. FE boleh tetap menyimpan state UI lokal seperti cart draft, toast, sidebar, command palette, dan filter ringan.

## Titik Integrasi

Gunakan pola ini:

```text
features/pages -> services/repository -> services/api -> backend
```

Tambahkan client terpusat, misalnya:

- `src/services/api.ts`
- env: `VITE_API_BASE_URL`

Repository harus tetap mengembalikan `Promise<T>` atau `Promise<T[]>`. Jika backend memakai envelope `{ data, meta }`, unwrap di API client/repository, bukan di komponen.

## Jangan Diubah Tanpa Alasan Kuat

- `src/app/router.tsx`
- `src/app/guards/*`
- `src/app/nav.ts`
- `src/components/ui/*`
- desain Tailwind/theme
- `src/lib/money.ts` kecuali kontrak kalkulasi berubah resmi
- `src/lib/format.ts` kecuali format produk berubah resmi

## Data Layer Saat Ini

Saat ini repo memakai:

- `ka.*`: Zustand persist.
- `kadb.*`: localStorage collections via `src/services/db.ts`.
- `mocks/*`: seed deterministic.

Saat API sudah aktif:

- CRUD inti pindah ke backend.
- Mock/localStorage boleh tetap menjadi fallback demo saat `VITE_API_BASE_URL` kosong.
- Jangan hapus seed data sebelum parity API selesai.

## Backend Contract Ringkas

Base API: `/api/v1`

Core endpoint yang wajib diprioritaskan:

- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/supervisor-authorizations`
- `/products`, `/categories`, `/units`, `/racks`
- `/customers`, `/suppliers`, `/doctors`, `/users`, `/outlets`
- `POST /pos/checkout`
- `/transactions`
- `/products/:id/stock-card`
- `/stock/opname`, `/stock/defekta`, `/stock/internal-mutations`
- `/purchase-orders`, `/invoices`, `/debts`, `/receivables`, `/cash`
- `/internal/tenants`

Detail requirement ada di `PRD.md`.

## Aturan Auth dan Authorization

Role, permission, entitlement, dan supervisor action mengikuti `src/lib/rbac.ts`.

Backend harus mengembalikan `403` untuk permission/entitlement gagal. FE dapat memetakan error ke forbidden atau module locked page.

Supervisor action yang perlu endpoint khusus:

- `cancel_paid_trx`
- `discount_over_50`
- `return_over_sell`
- `sell_empty_stock`
- `delete_product_with_history`
- `edit_sell_price`

## POS Checkout

Jangan implement checkout sebagai beberapa request dari FE. Backend harus menyediakan `POST /pos/checkout` yang atomik:

- validasi cart
- validasi stok
- validasi supervisor override
- create transaction
- create transaction lines
- decrement stock
- create stock movement
- create cash/piutang entry jika perlu
- write audit log

FE `Pos.tsx` saat ini melakukan beberapa write lokal. Saat migrasi, pindahkan orkestrasi itu ke repository/service, bukan menyebar ke komponen.

## Testing dan Validasi

Sebelum selesai:

- Jalankan `npm run build` jika perubahan menyentuh TypeScript.
- Jalankan `npm run test` jika menyentuh kalkulasi, formatter, entitlement, atau repository adapter.
- Pastikan tidak ada import baru yang melanggar path alias `@/`.
- Pastikan komponen tetap menerima tipe lama.

## Style

- TypeScript strict, hindari `any`.
- Ikuti pola repository yang sudah ada.
- Buat perubahan kecil dan terisolasi.
- Jangan menghapus mock sampai API parity terbukti.
- Dokumentasikan env baru di README jika menambah konfigurasi.
