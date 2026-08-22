# Prisma seed files

## Seed untuk UI integration

Use `seed.superadmin.sql` after applying migrations:

```bash
npx prisma db execute --file prisma/seed.superadmin.sql
```

It creates the complete demo/master/operational seed data, but only one
account:

```text
superadmin@apotek.local / Password123!
```

The seed tenant and branch remain available so the FE can display inventory,
sales, purchasing, finance, CRM, HR, and other modules immediately. New real
tenants can still be created from the FE using `POST /api/v1/internal/tenants`.
That endpoint can also create its first branch and owner in one request.

`seed.mvp1.sql` remains the legacy seed and still contains the original demo
accounts. Use `seed.superadmin.sql` when only the superadmin account is wanted.
