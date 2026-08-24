# CLAUDE.md - Kelola Apotek Backend/FE Integration

## Project Context

Kelola Apotek adalah frontend SIM Apotek React 18 + Vite + TypeScript. Aplikasi sudah memiliki 64 halaman demo dengan data deterministic dari mocks dan localStorage. Backend yang akan dibuat harus mengganti data layer tanpa rewrite UI.

Gunakan `PRD.md` sebagai product requirement backend dan `AGENT.md` sebagai aturan kerja integrasi.

## First Files To Read

1. `README.md`
2. `PRD.md`
3. `AGENT.md`
4. `src/services/db.ts`
5. `src/services/index.ts`
6. `src/services/repository/*`
7. `src/types/index.ts`
8. `src/lib/rbac.ts`
9. `src/stores/auth.store.ts`
10. `src/features/pos/pages/Pos.tsx`

## Integration Rule

Do not make pages talk directly to backend endpoints. All API calls must go through `src/services/repository/*` or a shared `src/services/api.ts` client.

Current FE flow:

```text
Component -> repository method -> mock/localStorage
```

Target flow:

```text
Component -> repository method -> API client -> backend
```

Repository method signatures must remain compatible with existing consumers.

## Source Of Truth

- Data shapes: `src/types/*`
- RBAC: `src/lib/rbac.ts`
- Product/backend scope: `PRD.md`
- Current local persistence: `src/services/db.ts`, `src/services/keys.ts`
- Demo seeds: `src/mocks/*`

## Backend Must Own

- Auth and session
- Role, permission, entitlement, subscription
- Tenant/outlet scoping
- Product stock
- POS checkout
- Transaction numbers
- Stock movement and stock card
- Payment of debts and receivables
- Cash ledger balance
- Audit log
- Supervisor authorization

## Keep Local In FE Unless Asked

- Toast state
- Sidebar/topbar UI state
- Command palette UI state
- Mobile POS step state
- Light filters/search query
- Parked cart may remain local for MVP unless cross-device recall is required

## API Expectations

Base path: `/api/v1`

Prefer a shared response envelope:

```json
{ "data": {}, "meta": {} }
```

Errors:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Tidak punya akses.",
    "details": {}
  }
}
```

Unwrap responses in the API client/repository so UI code still receives typed domain objects.

## Critical Business Flow

`POST /pos/checkout` must be atomic. It replaces the current local FE sequence that creates a transaction and then updates product stock one by one.

Required server-side steps:

1. Validate user, tenant, outlet, permission, and entitlement.
2. Validate product availability and price policy.
3. Validate supervisor authorization when needed.
4. Create transaction and lines.
5. Decrement stock with transaction/row lock.
6. Create stock movements.
7. Create cash ledger or receivable entry.
8. Write audit log.
9. Return the saved transaction/receipt data.

## Development Checklist

- Keep FE component behavior stable.
- Add API client tests when adapter logic is non-trivial.
- Run `npm run build` after TS changes.
- Run `npm run test` after shared lib/repository changes.
- Do not remove mock fallback before backend parity is complete.
- Do not touch unrelated dirty files.

## Suggested Migration Order

1. Add `VITE_API_BASE_URL` and `src/services/api.ts`.
2. Migrate auth/session.
3. Migrate products, customers, suppliers, doctors, categories, users, outlets.
4. Migrate POS checkout and transaction listing.
5. Migrate stock movement/card, opname, defekta, mutasi.
6. Migrate purchasing, debts, receivables, cash.
7. Migrate tenant/entitlement/subscription.
8. Migrate analytics and multi-branch read endpoints.
