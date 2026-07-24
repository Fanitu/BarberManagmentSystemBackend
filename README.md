# Barber Management System — Backend (Phase 1)

Multi-tenant MERN backend. Each tenant is a **BarberShop**, identified by a
unique `barberCode` issued from the Super Admin panel.

## Setup

```bash
cp .env.example .env   # fill in MONGO_URI, JWT_SECRET, etc.
npm install
npm run seed:superadmin   # creates your first Super Admin login (reads
                           # SUPER_ADMIN_NAME/EMAIL/PASSWORD from .env)
npm run dev             # nodemon
# or
npm start
```

There's no public sign-up route for Super Admin on purpose — `npm run
seed:superadmin` is the only way to create one. It's safe to re-run any
time (e.g. if you forget the password): it updates the existing account
by email instead of failing.

## Roles & tenancy

Every JWT payload carries `{ id, role, barberShop }` (superadmin has no
`barberShop`). All shop-scoped queries filter by `req.user.barberShop`, so
one shop can never see another shop's data.

- **worker** — logs services and debts, views today's totals
- **admin** — the shop owner; sees revenue, runs payouts, manages
  barbers/services/expenses
- **superadmin** — platform operator; creates shops + barber codes,
  provisions the first admin login for each shop

## Design decisions / assumptions (flag if you want these changed)

1. **Worker login auto-registers.** Per your spec: if the barber code is
   valid and no worker with that name exists yet under the shop, one is
   created on the spot. If a worker with that name *does* exist, the
   password must match.
2. **Admin accounts do NOT auto-register.** They're provisioned by the
   Super Admin (`POST /api/superadmin/shops/:id/admins`) so a random person
   with just the barber code can't grant themselves owner access.
3. **Two "Service" collections.** `Service` is the catalog (name, price,
   shopPercent) admins manage in the sidebar. `ServiceLog` is each
   transaction a worker submits (barber, service, price paid, status). This
   keeps catalog edits from silently rewriting historical payout numbers —
   each `ServiceLog` snapshots `shopPercent` at submit time.
4. **"Barbers Payment" = the barbers' cut**, i.e.
   `price * (100 - shopPercent) / 100`, summed. `Total Income = Total
   Revenue - Barbers Payment - Running-cost` (and `Profit` also subtracts
   `Monthly Expense` for the monthly view), matching your spec.
5. **Payable Barbers uses `status: unpaid` as the source of truth**, not a
   fixed calendar week — it sums every unpaid ServiceLog/Debt for a barber,
   not just "this week's" entries. This way nothing is missed if the shop
   misses a payout day, and "Pay Now" (or the cron job) simply flips those
   records to `paid`.
6. **Barber payout day** is stored per-barber as `paymentDay` (0=Sun..6=Sat).
   Cron runs daily at 9am `Africa/Addis_Ababa` (configurable via `.env`) and
   pays out every barber whose `paymentDay` is today, across all shops.

## API overview

| Area | Routes |
|---|---|
| Auth | `POST /api/auth/worker/login`, `/admin/login`, `/superadmin/login` |
| Barbers | `GET/POST /api/barbers`, `PUT/DELETE /api/barbers/:id` |
| Services (catalog) | `GET/POST /api/services`, `PUT/DELETE /api/services/:id` |
| Service logs | `POST /api/services/log`, `GET /api/services/log/today` |
| Debts | `POST /api/debts`, `GET /api/debts/today` |
| Running costs | `GET/POST /api/running-costs` |
| Monthly expenses | `GET/POST /api/monthly-expenses`, `PUT/DELETE /:id` |
| Revenue | `GET /api/revenue?period=daily\|weekly\|monthly&date=` |
| Payouts | `GET /api/payouts/today`, `POST /api/payouts/:barberId/pay` |
| Super admin | `POST/GET /api/superadmin/shops`, `PATCH /:id/deactivate`, `POST /:id/admins` |

## Not yet built (later phases)

- Worker UI (React)
- Admin UI (React)
- Super Admin UI (React)
- Password reset / super-admin seeding script
