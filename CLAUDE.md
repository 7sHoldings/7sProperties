# 7s Properties — working notes

## Never destroy or hide the owner's data

This app is the system of record for real rental income. Data loss, or the
*appearance* of data loss, is the most serious failure mode here.

**Rules, no exceptions:**

1. **Never write destructive SQL.** No `DELETE`, `TRUNCATE`, `DROP TABLE`,
   `DROP COLUMN`, or `UPDATE` that overwrites owner-entered values in a
   migration. Migrations are additive: `ADD COLUMN ... DEFAULT`, new tables,
   new indexes. Dropping and re-adding a `CHECK` constraint is fine; dropping
   data is not.
2. **Never let a failed query render as "no data."** `(res.data || [])` turns a
   database error into an empty list, which reads to the owner exactly like
   deleted records. Always check `res.error`, log it, and either recover or
   tell the user something went wrong.
3. **A new column must not break the app before its migration runs.** Any query
   naming a column added by a migration fails outright until that SQL is
   applied against the live database. Route those reads through
   `lib/payments.ts`-style fallbacks (retry without the column) so existing
   history keeps rendering, and show the owner a banner naming the migration.
4. **Never silently coerce a value to a wrong one to make a write succeed.**
   Saving a deposit as rent because a column is missing corrupts income
   totals. Fail loudly with an actionable message instead.
5. **Migrations are run by hand** in the Supabase SQL Editor — assume any new
   one has *not* been applied yet when the code ships, and design for that gap.

## Stack

Next.js 15 App Router · Supabase (Postgres + RLS + Storage) · Tailwind ·
react-hook-form + zod (`lib/schemas.ts`) · Stripe for tenant ACH/card rent.

- `supabase/schema.sql` is the base schema; `supabase/v*.sql` are additive
  migrations applied in order, by hand.
- Money is `NUMERIC(10,2)`. Row-level security is on for every table.
- Shared P&L math lives in `lib/pnl.ts` so the dashboard and reports agree.
- Payment rent/deposit classification lives in `lib/payments.ts` — read a row's
  type with `paymentTypeOf()`, never `row.payment_type === "deposit"` directly,
  so rows predating the column still classify as rent.

## Checks before pushing

```bash
npx tsc --noEmit
npm run build
```
