# Rental Property Manager

A clean rental property management app for tracking properties, tenants, leases, payments, expenses, and maintenance. Built with **Next.js 15 + Supabase + Tailwind**.

## Phase 1 features (in this MVP)

- Auth (email/password) via Supabase
- Properties — list, add (with default unit auto-created)
- Tenants — list, add, auto-create lease, auto-mark unit occupied
- Payments — bulk monthly view, per-tenant collection status, record payment
- Expenses — categorized log, per-property
- Maintenance — request log with priority, status, cost
- Reports — YTD income, expenses, net profit, per-property P&L, category breakdown
- Dashboard — KPIs and recent activity
- Row-level security (each user sees only their own data)

## Setup (~10 minutes)

### 1. Set up Supabase
1. Go to your existing Supabase project
2. Open **SQL Editor** → New query
3. Paste the entire contents of `supabase/schema.sql` and click **Run**
4. Go to **Storage** → New bucket → name it `documents`, set as **Private**
5. Open **SQL Editor** → New query → paste `supabase/storage-policies.sql` and **Run** (enables per-user file isolation)
6. **Auth → URL Configuration** — set the Site URL to your deployed domain (or `http://localhost:3000` for local) and add `<your-domain>/auth/callback` to redirect URLs
7. Go to **Project Settings → API** and copy:
   - Project URL
   - `anon` public key

### 2. Configure environment
```bash
cp .env.example .env.local
```
Edit `.env.local` and paste in your Supabase URL and anon key.

### 3. Install and run
```bash
npm install
npm run dev
```
Open http://localhost:3000 — it'll redirect you to login. Sign up with your email, confirm via the email Supabase sends, then start adding properties.

### 4. Deploy to Vercel
```bash
git add . && git commit -m "Initial rental management app"
git push origin main
```
On Vercel:
1. Import your repo
2. Add the same two env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
3. Deploy — done.

## Project structure

```
app/
  (app)/                    # Authenticated routes (sidebar layout)
    page.tsx                # Dashboard
    properties/             # List + new
    tenants/                # List + new (auto-creates lease)
    payments/               # Bulk collection + new
    expenses/               # List + new
    maintenance/            # List + new
    reports/                # P&L and category breakdowns
    layout.tsx              # Sidebar wrapper
  login/page.tsx            # Sign in / sign up
  layout.tsx                # Root
components/Sidebar.tsx
lib/supabase/
  client.ts                 # Browser client
  server.ts                 # Server client
middleware.ts               # Auth gate
supabase/schema.sql         # Database schema (run once)
```

## Phase 2 (in progress — most items now shipped)

- ✅ Property detail page with lease history, payments, expenses, maintenance
- ✅ Tenant detail page with lease & payment history
- ✅ Document upload (Supabase Storage with per-user isolation)
- ✅ Edit/delete on properties, tenants, payments, expenses, maintenance
- ✅ Lease expiration alerts (90/60/30 day banner on dashboard)
- ✅ Password reset + email confirmation callback
- ⏳ Receipt photo upload from mobile (use upload UI on expense detail)
- ⏳ Multi-unit add UI (schema already supports it)

## Phase 3 (mobile + automation)

- React Native (Expo) app sharing the same Supabase backend — no backend rewrite needed
- Quick actions: record payment, log expense, snap receipt
- Email reminders to tenants for late rent (Supabase Edge Function + Resend)
- Tenant portal (separate auth role)

## Notes

- **Multi-unit buildings**: the schema supports them via the `units` table. The "Add property" form creates a single default unit; for a duplex you'd add a second unit manually (UI for this comes in Phase 2).
- **All money is stored as `NUMERIC(10,2)`** — no float precision issues.
- **Row-level security is on for every table** — users can only ever see their own rows, even if a query forgets to filter.
- The `(app)` route group is a Next.js convention — it groups authenticated pages under one shared layout (sidebar) without affecting URLs.
