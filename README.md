Barber Management System — Backend

A multi-tenant REST API for managing barber-shop operations, revenue, services, debts, expenses, barber payouts, and shop administration.

Built with Node.js, Express, MongoDB, and Mongoose, the backend provides role-based authentication and authorization for Workers, Shop Administrators, and Super Administrators.

Architecture

                    ┌──────────────────────┐
                    │    Super Admin       │
                    │ Platform Management  │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  Barber Management    │
                    │       API             │
                    │   Node + Express      │
                    └──────────┬───────────┘
                               │
                       ┌───────┴───────┐
                       ▼               ▼
                  MongoDB          Cron Jobs
                                   │
                         ┌─────────┴─────────┐
                         ▼                   ▼
                   Barber Payouts      Daily Summaries

---

Core Capabilities

- Multi-tenant barber-shop architecture
- Worker authentication
- Admin authentication
- Super Admin authentication
- JWT-based authentication
- Role-based authorization
- Shop-level data isolation
- Barber management
- Service catalog management
- Service transaction logging
- Customer debt tracking
- Revenue reporting
- Running-cost management
- Monthly-expense management
- Barber payout management
- Automated scheduled payouts
- Daily summary jobs
- Security middleware
- Request rate limiting
- MongoDB query sanitization
- Environment-based configuration

---

Multi-Tenant Architecture

Each barber shop is represented as a tenant and identified by a unique "barberCode".

Authenticated JWT payloads contain:

{
  id,
  role,
  barberShop
}

Super Admin users operate at the platform level and do not belong to an individual barber shop.

Shop-scoped queries use the authenticated user's "barberShop" to restrict access to that tenant's data.

This creates the following isolation model:

Barber Shop A
 ├── Workers
 ├── Services
 ├── Service Logs
 ├── Debts
 ├── Expenses
 └── Payouts

Barber Shop B
 ├── Workers
 ├── Services
 ├── Service Logs
 ├── Debts
 ├── Expenses
 └── Payouts

Data from one shop is not intended to be accessible through another shop's authenticated context.

---

User Roles

Worker

Workers can:

- Log services
- Record debts
- View today's totals

Worker accounts can be created automatically when a valid barber code is used and a worker with that name does not already exist in the shop.

---

Admin

The Admin represents the barber-shop owner or manager.

Admins can:

- View revenue
- Manage barbers
- Manage services
- Review payable barbers
- Process barber payouts
- Manage running costs
- Manage monthly expenses

Admin accounts are provisioned by the Super Admin rather than being automatically created from a barber code.

---

Super Admin

The Super Admin operates at the platform level.

Super Admin functionality includes:

- Creating barber shops
- Managing barber-shop records
- Deactivating shops
- Generating/provisioning barber-shop access
- Provisioning the first Admin account for a shop

There is intentionally no public Super Admin registration endpoint.

---

Authentication

The backend provides separate authentication endpoints for the different roles:

POST /api/auth/worker/login
POST /api/auth/admin/login
POST /api/auth/superadmin/login

The frontend also supports a unified login flow that can determine whether the authenticated account is a Worker or Admin.

JWT authentication is used to identify the user and their role and barber-shop tenant.

---

Service Architecture

The backend separates the service catalog from historical service transactions.

Service

Represents the shop's service catalog.

Example concepts include:

- Service name
- Price
- Shop percentage

ServiceLog

Represents an actual service transaction performed by a worker.

The service log stores the relevant percentage information at transaction time so that later changes to the service catalog do not silently change historical payout calculations.

This provides more reliable historical financial calculations.

---

Revenue & Financial Calculations

The backend supports daily, weekly, and monthly revenue reporting.

Revenue
   │
   ├── Barber Payments
   │
   ├── Running Costs
   │
   └── Monthly Expenses
          │
          ▼
        Profit

The current calculation model uses:

Total Income
= Total Revenue
  - Barber Payments
  - Running Costs

For monthly reporting, monthly expenses are also included in the profit calculation.

---

Barber Payouts

The payout system tracks unpaid service/debt records rather than relying exclusively on a fixed calendar period.

This means unpaid amounts remain available until they are actually paid.

The backend supports:

GET  /api/payouts/today
POST /api/payouts/:barberId/pay

When a payout is processed, the relevant records are marked as paid.

---

Automated Payouts

Each barber can have an individual "paymentDay".

The backend includes a scheduled payout process that runs daily.

The default application timezone is:

Africa/Addis_Ababa

The payout schedule can be configured through environment variables.

The system checks which barbers are scheduled for payment and processes their unpaid payable records.

---

Scheduled Jobs

The backend contains scheduled jobs for automated business operations.

Current scheduled functionality includes:

- Barber payout processing
- Daily summary processing

The cron architecture is separated into the "cron/" directory.

cron/
├── payoutCron
└── dailySummaryCron

---

API Overview

Area| Endpoint
Worker Auth| "POST /api/auth/worker/login"
Admin Auth| "POST /api/auth/admin/login"
Super Admin Auth| "POST /api/auth/superadmin/login"
Barbers| "GET/POST /api/barbers"
Barbers| "PUT/DELETE /api/barbers/:id"
Services| "GET/POST /api/services"
Services| "PUT/DELETE /api/services/:id"
Service Logs| "POST /api/services/log"
Today's Services| "GET /api/services/log/today"
Debts| "POST /api/debts"
Today's Debts| "GET /api/debts/today"
Running Costs| "GET/POST /api/running-costs"
Monthly Expenses| "GET/POST /api/monthly-expenses"
Monthly Expenses| "PUT/DELETE /api/monthly-expenses/:id"
Revenue| "GET /api/revenue?period=daily|weekly|monthly&date="
Payouts| "GET /api/payouts/today"
Barber Payment| "POST /api/payouts/:barberId/pay"
Super Admin Shops| "POST/GET /api/superadmin/shops"
Deactivate Shop| "PATCH /api/superadmin/shops/:id/deactivate"
Shop Admin| "POST /api/superadmin/shops/:id/admins"

---

Security

The backend includes several security layers.

Security Headers

Helmet is used to apply security-related HTTP headers.

Rate Limiting

Request rate limiting is implemented to reduce abuse and excessive requests.

MongoDB Sanitization

MongoDB query input is sanitized using:

express-mongo-sanitize

Authentication

JWT authentication protects authenticated resources.

Role-Based Authorization

Protected administrative routes verify the user's role before processing the request.

CORS

Allowed frontend origins are controlled through environment configuration.

Password Security

Passwords are hashed using:

bcryptjs

Environment Variables

Sensitive configuration such as database credentials and JWT secrets is intended to be supplied through environment variables.

Never commit real credentials or production secrets to GitHub.

---

Project Structure

BarberManagmentSystemBackend/
│
├── config/
│   └── Database configuration
│
├── controllers/
│   └── Business logic
│
├── cron/
│   ├── payoutCron
│   └── dailySummaryCron
│
├── middleware/
│   ├── Authentication
│   ├── Authorization
│   ├── Error handling
│   └── Rate limiting
│
├── models/
│   └── MongoDB/Mongoose models
│
├── routes/
│   ├── authRoutes
│   ├── barberRoutes
│   ├── serviceRoutes
│   ├── debtRoutes
│   ├── runningCostRoutes
│   ├── monthlyExpenseRoutes
│   ├── revenueRoutes
│   ├── payoutRoutes
│   └── superAdminRoutes
│
├── scripts/
│   └── seedSuperAdmin.js
│
├── utils/
│   └── Shared backend utilities
│
├── validators/
│   └── Request validation
│
├── server.js
├── package.json
└── README.md

---

Technology Stack

Backend

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT
- bcryptjs
- CORS
- Helmet
- Express Rate Limit
- Express Validator
- MongoDB Sanitization
- Node Cron
- dotenv

The current backend package configuration confirms these major dependencies and the "start", "dev", and "seed:superadmin" scripts.

---

Local Development

1. Clone the repository

git clone https://github.com/Fanitu/BarberManagmentSystemBackend.git

cd BarberManagmentSystemBackend

2. Install dependencies

npm install

3. Configure environment variables

Create a local ".env" file.

Example structure:

MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret

ALLOWED_ORIGINS=http://localhost:5173

APP_TIMEZONE=Africa/Addis_Ababa

SUPER_ADMIN_NAME=your_name
SUPER_ADMIN_EMAIL=your_email
SUPER_ADMIN_PASSWORD=your_password

Use your actual production configuration only in the deployment environment.

4. Create the first Super Admin

npm run seed:superadmin

The seed script reads the Super Admin credentials from the environment configuration.

5. Start development server

npm run dev

6. Start production server

npm start

---

Frontend

The backend is consumed by the separate React frontend.

Frontend Repository:
https://github.com/Fanitu/BarberManagmentSystem

Live Frontend:
https://barber-managment-system.vercel.app/

---

Engineering Highlights

This project demonstrates several full-stack engineering concepts:

- Multi-tenant SaaS architecture
- Role-based authentication and authorization
- JWT-based sessions
- Tenant-level data isolation
- REST API design
- MongoDB/Mongoose data modeling
- Financial aggregation and reporting
- Barber commission calculations
- Payment-state tracking
- Scheduled background jobs
- Security middleware
- Input validation
- Rate limiting
- CORS configuration
- Separation of controllers, routes, models, middleware, and validators
- Platform-level Super Admin architecture

---

Business Problem

Traditional barber shops can rely heavily on notebooks and manual calculations for:

- Daily service records
- Barber commissions
- Customer debts
- Running costs
- Monthly expenses
- Revenue
- Barber payments

This system centralizes those workflows into a multi-tenant application so that shop owners can manage operational and financial information from a single platform.

---

Project Status

The backend currently provides the core API infrastructure for the Worker, Admin, and Super Admin workflows.

The Super Admin interface is maintained separately from the main Worker/Admin frontend because it serves a different platform-management role.

---

Author

Fanuel Bahta

Full-Stack Web Developer

Portfolio:
https://fanu-portofoilio.vercel.app/

GitHub:
https://github.com/Fanitu