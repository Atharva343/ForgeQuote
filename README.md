# ForgeQuote — Enterprise Manufacturing RFQ, Costing & Quotation Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.x-61dafb.svg)](https://react.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19.3-2D3748.svg)](https://www.prisma.io/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-shadcn%2Fui-38B2AC.svg)](https://ui.shadcn.com/)
[![Tests](https://img.shields.io/badge/Tests-147%20Passed%20(9%20Suites)-brightgreen.svg)]()

ForgeQuote is a production-grade, enterprise web application engineered for custom manufacturing, precision machining, forging, and fabrication enterprises. It replaces error-prone spreadsheets with an end-to-end, deterministic engineering workflow: from AI-assisted drawing and spreadsheet intake, through multi-tier volume cost modeling, to an audit-logged commercial approval chain and boardroom-ready PDF quotations.

---

## 1. Executive Summary & Value Proposition

In discrete and precision manufacturing (automotive forgings, aerospace valves, agricultural drivetrains), quotation turnaround speed and pricing precision make the difference between winning high-margin orders and suffering commercial losses. 

ForgeQuote standardizes this process by enforcing:
- **100% Deterministic Financial Arithmetic:** Precision calculations using arbitrary-precision decimals (`Prisma.Decimal`). Calculations never run through stochastic LLMs or IEEE 754 floating-point operations.
- **Strict Role-Based Access Control (RBAC):** Clean segregation of duties between Cost Estimators (technical costing, intake, routing, rates) and Sales Leadership (commercial approval, margin governance, customer PDF release).
- **Automated Commercial Governance:** Hard-coded threshold evaluation (₹25,00,000 pre-GST annual value) that triggers a mandatory Sales Head approval queue before any customer-facing quote PDF can be generated.
- **AI-Assisted Document Intake with Human-in-the-Loop:** Ingest customer email tenders, Excel line-item schedules, and engineering drawings (PDF). Extraction is purely assistive—estimators must review, tweak, and approve all suggested geometries before committing to database state.
- **Historical Part Retrieval & Bulk Import:** Import decades of past quotation spreadsheets, extract pricing heuristics, and surface similarity matches by material and geometry during active estimation.

---

## 2. System Architecture

```mermaid
flowchart TD
    subgraph Client["Frontend Client (React 18 + Vite + Tailwind CSS + shadcn/ui)"]
        UI_AUTH[Authentication & RBAC Routing]
        UI_INTAKE[AI Document Intake Dialog]
        UI_RFQ[RFQ Register & Part Detail Sheet]
        UI_COST[Part Costing & Multi-Volume Engine]
        UI_APPROVAL[Sales Head Approval Queue]
        UI_PDF[PDF Viewer & Signed URL Downloader]
        UI_HIST[Historical Part Search & Import]
    end

    subgraph ReverseProxy["Vercel SPA & API Reverse Proxy"]
        V_ROUTE[vercel.json Rewrites /api/*]
    end

    subgraph Server["Backend Server (Express + TypeScript)"]
        AUTH_MW[JWT Cookie Auth & RBAC Middleware]
        RATE_LIMIT[Express Rate Limiter & Helmet Security]
        
        CTRL_INTAKE[Intake Controller & Document Parser]
        CTRL_COST[Costing Engine Service]
        CTRL_APPROVE[Approval State Machine]
        CTRL_PDF[PDFKit Generation Service]
        CTRL_HIST[Historical Import & Search Engine]
    end

    subgraph External["External Cloud Infrastructure"]
        NEON[(Neon Serverless PostgreSQL\nPrisma 6.19.3 Migrations)]
        SUPABASE[(Supabase Private Storage\nEncrypted Bucket)]
        GEMINI[Google Gemini 3.5 Flash-Lite\nStructured Schema Output]
    end

    Client -->|HTTPS /api/*| V_ROUTE
    V_ROUTE -->|Reverse Proxy /api/*| Server
    
    Server -->|Connection Pooling| NEON
    CTRL_INTAKE -->|Multi-modal Parsing| GEMINI
    CTRL_INTAKE -->|Upload Drawings & Excel| SUPABASE
    CTRL_PDF -->|Store & Sign PDF Quotes| SUPABASE
```

---

## 3. Monorepo Organization

```text
RQF/
├── client/                      # React frontend single-page application
│   ├── src/
│   │   ├── components/          # Reusable UI widgets, layout, intake, costing & approvals
│   │   │   ├── auth/            # ProtectedRoute and role gates
│   │   │   ├── costing/         # Cost breakdown sheets and volume price builders
│   │   │   ├── historical/      # Historical search, column mapper & chunked importer
│   │   │   ├── intake/          # Multi-document intake upload & review dialog
│   │   │   ├── layout/          # DashboardLayout, navigation header & role badges
│   │   │   └── ui/              # shadcn/ui accessible primitives (Radix UI)
│   │   ├── pages/               # Top-level view routes (Dashboard, RFQ, Rates, Approvals, etc.)
│   │   ├── services/            # Axios API clients configured with credentials
│   │   └── lib/                 # Tailwind merge utilities and Axios instance
│   ├── vercel.json              # Vercel deployment rewrites for SPA routing & backend proxy
│   └── vite.config.ts           # Development proxy & build bundling configuration
├── server/                      # Express backend API service
│   ├── prisma/
│   │   ├── migrations/          # Committed, reproducible SQL migrations
│   │   ├── migration_lock.toml  # Prisma migration lockfile (provider = postgresql)
│   │   ├── schema.prisma        # Canonical relational data models & enums
│   │   └── seed.ts              # Seed script (users, demo machine rates, baseline RFQs)
│   ├── src/
│   │   ├── config/              # Prisma client, Supabase client, Gemini GenAI, env schema
│   │   ├── controllers/         # HTTP handlers for auth, rfqs, rates, costing, approvals, pdf, intake
│   │   ├── middleware/          # requireAuth, requireRole, errorHandler, notFoundHandler
│   │   ├── services/            # Core deterministic business logic & costing formulas
│   │   ├── tests/               # 9 complete Vitest automated test suites
│   │   └── validators/          # Zod request payload validation schemas
├── package.json                 # Monorepo workspace configuration
├── .gitignore                   # Clean exclusion of build artifacts and environment files
└── README.md                    # System documentation
```

---

## 4. Key Engineering Guarantees & Costing Formulas

### 1. Deterministic Costing Engine
The core costing engine executes purely on the backend inside `server/src/services/costing.service.ts`:
- **Material Cost ($/unit):**
  $$\text{Material Cost} = \text{Gross Weight (kg)} \times \text{Effective Material Rate (₹/kg)}$$
- **Process Cost ($/unit):**
  $$\text{Process Cost} = \sum_{\text{operations}} \left( \frac{\text{Cycle Time (mins)}}{60} \times \text{Machine Hourly Rate (₹/hr)} \right)$$
- **Setup Allocation ($/unit):**
  $$\text{Setup Cost per Unit} = \sum_{\text{operations}} \left( \frac{\frac{\text{Setup Time (mins)}}{60} \times \text{Machine Hourly Rate (₹/hr)}}{\text{Batch / Production Volume}} \right)$$
- **Scrap Cost ($/unit):**
  $$\text{Scrap Cost} = (\text{Material Cost} + \text{Process Cost}) \times \frac{\text{Scrap \%}}{100}$$
- **Overhead Cost ($/unit):**
  $$\text{Overhead Cost} = (\text{Material Cost} + \text{Process Cost} + \text{Scrap Cost}) \times \frac{\text{Overhead \%}}{100}$$
- **Net Manufacturing Cost ($/unit):**
  $$\text{Net Cost} = \text{Material Cost} + \text{Process Cost} + \text{Setup Cost} + \text{Scrap Cost} + \text{Overhead Cost} + \text{Freight Cost}$$
- **Selling Price (Gross Margin Formula):**
  $$\text{Selling Price (pre-GST)} = \frac{\text{Net Cost}}{1 - \left(\frac{\text{Target Margin \%}}{100}\right)}$$
- **GST & Annual Total:**
  $$\text{Selling Price (incl. GST)} = \text{Selling Price} \times \left(1 + \frac{\text{GST \%}}{100}\right)$$
  $$\text{Annual Quotation Value} = \text{Selling Price (pre-GST)} \times \text{Annual Production Volume}$$

### 2. Commercial Approval Policy & Threshold Integrity
- **Approval Threshold:** ₹25,00,000 pre-GST annual value.
- **Tamper Resistance:** The backend evaluates the approval requirement exclusively from saved `QuoteVolumePrice` records in PostgreSQL. Frontend submissions containing `requiresApproval: false` or manipulated values are strictly ignored.
- **GST Excluded from Evaluation:** A quotation with a pre-GST value of ₹24,00,000 and post-GST value of ₹28,32,000 does **not** require Sales Head approval because statutory GST taxes are excluded from internal commercial risk thresholds.
- **Multi-volume Worst-case Principle:** For multi-tier quotations (e.g. 10,000 units, 25,000 units, 50,000 units), the threshold evaluates against the highest annual volume scenario.
- **Self-Approval Prevention:** Estimators cannot approve or reject quotations. Sales Heads cannot submit draft quotations.
- **Immutable Snapshots:** Upon quotation submission and approval, effective rate master snapshots (`rateSnapshot`) are permanently frozen in the quote record. Subsequent updates to material or machine rates will never retroactively modify approved quotations.

### 3. Professional PDF Quotation Output
- **State Gate:** Customer-facing PDF quotations can **only** be generated for quotations with status `APPROVED`. Generating PDFs for `DRAFT`, `PENDING_APPROVAL`, or `REJECTED` quotations is rejected with `HTTP 409 Conflict`.
- **Internal Confidentiality:** PDFs show selling prices, unit rates, tooling, payment terms, and delivery terms. Internal buy rates, machine hourly charges, setup allowances, and margin percentages are strictly omitted from customer documents.
- **Idempotency & Private Storage:** Generated PDFs are uploaded to the private Supabase Storage bucket (`quotations/QUO-...pdf`) and registered in the `QuotationPdf` relational model. Subsequent requests serve the existing artifact idempotently.
- **Demo Watermark:** Any quotation containing the flag `isDemo: true` automatically renders an aesthetic, semi-transparent 45-degree watermark: `"DEMO / NOT FOR COMMERCIAL USE"`.

---

## 5. Pre-Configured Demo Accounts & Role Permissions

The database is seeded with two standard role accounts:

| Role | Email | Password | Default Scope |
| :--- | :--- | :--- | :--- |
| **ESTIMATOR** | `estimator@forgequote.io` | `ForgeQuote@2026` | RFQ Creation, Document Intake, Costing Calculations, Rate Masters, Quote Draft Submission |
| **SALES_HEAD** | `saleshead@forgequote.io` | `ForgeQuote@2026` | Approval Queue Management, Commercial Discounting, Approval/Rejection, PDF Generation |

### Access Control Matrix

| Feature / Workspace | Route | ESTIMATOR | SALES_HEAD | Unauthenticated |
| :--- | :--- | :---: | :---: | :---: |
| **RFQ Register** | `/rfqs` | Read / Write | Read Only | 401 |
| **AI Document Intake** | `/rfq-intake` | Full Access | 403 Forbidden | 401 |
| **Rate Masters** | `/rate-masters` | Full Access | Read Only | 401 |
| **Costing Engine** | `/costing` | Full Access | 403 Forbidden | 401 |
| **Submit Quotation** | `/api/quotations/:id/submit` | Permitted | 403 Forbidden | 401 |
| **Approval Queue** | `/approvals` | 403 Forbidden | Full Access | 401 |
| **Quotation PDF Gen**| `/api/quotations/:id/pdf` | Read (if approved)| Read & Generate | 401 |
| **Historical Archive** | `/historical-quotes` | Read / Import | Read Only | 401 |

---

## 6. Environment Variables Reference

### Backend (`server/.env`)

```ini
# Application Port & Node Environment
PORT=5000
NODE_ENV=development

# Neon PostgreSQL Database Connections
# DATABASE_URL: Pooled transaction connection string
DATABASE_URL="postgresql://user:password@ep-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&pgbouncer=true"
# DIRECT_URL: Direct TCP connection for Prisma migrations (bypasses PgBouncer)
DIRECT_URL="postgresql://user:password@ep-direct.us-east-2.aws.neon.tech/neondb?sslmode=require"

# JWT Authentication & Client Origin
JWT_SECRET="forgequote-production-jwt-secret-min-32-chars-long"
CLIENT_ORIGIN="http://localhost:5173"

# Google Gemini API (Document extraction & routing suggestions)
GEMINI_API_KEY="AIzaSy..."
GEMINI_MODEL="gemini-3.5-flash-lite"

# Supabase Private Storage (Drawing & PDF quotation archive)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI..."
SUPABASE_STORAGE_BUCKET="forgequote-private"

# Seed Credentials (Optional overrides)
SEED_ESTIMATOR_PASSWORD="ForgeQuote@2026"
SEED_SALES_HEAD_PASSWORD="ForgeQuote@2026"

# Seller Commercial Profile (Rendered on final quotation PDFs)
SELLER_COMPANY_NAME="ForgeQuote Precision Technologies Pvt Ltd"
SELLER_GSTIN="27AABCF1234F1Z5"
SELLER_ADDRESS="Plot 42, Heavy Industrial Estate, MIDC, Pune, Maharashtra 411018, India"
SELLER_EMAIL="quotes@forgequote.io"
SELLER_PHONE="+91 20 2740 5000"
SELLER_WEBSITE="https://forgequote.io"
SELLER_PAYMENT_TERMS="30 Days from date of invoice"
SELLER_DELIVERY_TERMS="Ex-Works Pune, freight extra at actuals"
SELLER_VALIDITY_TEXT="30 days from date of issue"
SELLER_SIGNATORY_NAME="Rajesh Sharma"
SELLER_SIGNATORY_DESIGNATION="Authorized Signatory & Head of Sales"
```

### Frontend (`client/.env`)

```ini
# Relative proxy for local development and Vercel proxying
VITE_API_BASE_URL=/api
```

---

## 7. Local Development & Setup Guide

### 1. Prerequisites
- **Node.js:** v20.x or v22.x LTS installed.
- **npm:** v10.x+ installed.
- **PostgreSQL:** Access to a Neon PostgreSQL database or local PostgreSQL instance.

### 2. Installation
Clone the repository and install dependencies across the monorepo:
```bash
git clone https://github.com/your-org/forgequote.git
cd forgequote
npm install
```

### 3. Database Migration & Baseline Seed
Apply committed Prisma migrations and populate baseline accounts and rate masters:
```bash
# Generate Prisma Client
npm run prisma:generate --workspace=server

# Deploy migrations cleanly
npx prisma migrate deploy --schema=server/prisma/schema.prisma

# Seed users, rate masters, and baseline RFQs
npm run prisma:seed --workspace=server
```

### 4. Running Local Development Servers
Run both frontend and backend concurrently:
```bash
npm run dev
```
- **Frontend:** `http://localhost:5173`
- **Backend API:** `http://localhost:5000`
- **Health Check:** `http://localhost:5000/api/health`

---

## 8. Automated Test Suites & Regression Verification

ForgeQuote includes 9 comprehensive integration and unit test suites covering 147 test scenarios across authentication, estimation, deterministic costing, multi-document intake, approvals, PDFKit streaming, and chunked historical imports.

```bash
# Run all server test suites
npm run test --workspace=server

# Run dedicated feature test suites
npm run test:approval --workspace=server    # 20 tests (Approval threshold, governance & audit)
npm run test:pdf --workspace=server         # 14 tests (PDFKit generation, idempotency & signing)
npm run test:intake --workspace=server      # 21 tests (Gemini extraction & private storage)
npm run test:historical --workspace=server  # 24 tests (Excel import, search & 1,400 row chunks)
```

### Test Suite Summary

| Test Suite | Spec File | Tests Passed | Focus Areas |
| :--- | :--- | :---: | :--- |
| **Authentication & RBAC** | `auth.test.ts` | 12 / 12 | HTTP-only cookies, password hashing, role gates, CSRF |
| **Health Check** | `health.test.ts` | 2 / 2 | Service telemetry, uptime, version reporting |
| **RFQ Register** | `rfq.test.ts` | 16 / 16 | Customer association, pagination, status transitions, search |
| **Rate Masters** | `rate.test.ts` | 13 / 13 | Historical rate validity windows, machine/material lookup |
| **Costing Engine** | `costing.test.ts` | 25 / 25 | Arbitrary precision decimal math, scrap, overhead, margin |
| **Approval Workflow** | `approval.test.ts` | 20 / 20 | ₹25L threshold, pre-GST rules, concurrency, audit logging |
| **PDF Generation** | `pdf.test.ts` | 14 / 14 | APPROVED state gate, Supabase upload, signed URLs, watermark |
| **AI Intake** | `intake.test.ts` | 21 / 21 | Multi-file intake (PDF/Excel), Gemini fallback, provenance |
| **Historical Quotes** | `historical-quotes.test.ts` | 24 / 24 | Column mapping, similarity engine, chunked 1,400-row batch |
| **Total** | **9 Suites** | **147 / 147 (100%)** | **Zero Failures** |

---

## 9. Production Deployment Guide

The recommended production deployment topology separates the static React single-page application (hosted on **Vercel**) from the Node.js Express backend (hosted on **Render**).

### 1. Database Setup (Neon PostgreSQL)
1. In your Neon console, create a PostgreSQL database.
2. Note both the **Pooled connection string** (port 5432 with `-pooler`) and the **Direct connection string** (port 5432 direct).
3. Ensure the direct connection is supplied to `DIRECT_URL` so schema migrations execute without PgBouncer limitations.

### 2. Backend Deployment (Render)
1. Create a new **Web Service** connected to your repository.
2. Set **Root Directory** to `server`.
3. Set **Build Command**:
   ```bash
   npm install && npx prisma generate && npx prisma migrate deploy && npm run build
   ```
4. Set **Start Command**:
   ```bash
   npm start
   ```
5. Configure environment variables in the Render dashboard matching `server/.env.example`.
6. Set `NODE_ENV=production` and `CLIENT_ORIGIN=https://<your-vercel-domain>.vercel.app`.

### 3. Frontend Deployment (Vercel)
1. Import the repository in the Vercel dashboard.
2. Set **Root Directory** to `client`.
3. Set **Framework Preset** to `Vite`.
4. The included `client/vercel.json` automatically manages reverse-proxy routing:
   ```json
   {
     "rewrites": [
       {
         "source": "/api/(.*)",
         "destination": "https://<your-render-backend-url>/api/$1"
       },
       {
         "source": "/(.*)",
         "destination": "/index.html"
       }
     ]
   }
   ```
5. Update `<your-render-backend-url>` in `client/vercel.json` with your active Render web service domain.
6. Trigger the deployment. All `/api/*` network requests will be proxied server-side, eliminating cross-domain cookie blocking in modern browsers (Safari ITP / Chrome Privacy Sandbox).

---

## 10. Security & Compliance Checklist

- [x] **Zero Hardcoded Credentials:** Zero API keys, database connection strings, or JWT secrets committed to git.
- [x] **Secure Cookie Flags:** In production, auth cookies enforce `httpOnly: true`, `secure: true`, and `sameSite: 'none'` (or `'lax'` when proxied).
- [x] **Tamper Resistance:** Commercial thresholds and costing formulas are computed exclusively server-side from database records.
- [x] **Private Storage:** Customer drawing PDFs, vendor RFQs, and generated quote PDFs are hosted in private, non-public Supabase buckets accessible only via short-lived signed URLs.
- [x] **Comprehensive Audit Trail:** All quotation status transitions (Submit, Approve, Reject, PDF Generation) persist immutable records in the `AuditLog` table capturing actor ID, timestamp, and metadata.
- [x] **Denial-of-Service Protection:** HTTP rate limiting enabled on sensitive authentication routes (`10 requests per 15-minute window`).
- [x] **Chunked Batch Integrity:** Large spreadsheet imports (>1,000 rows) execute in atomic 200-row database transactions with automatic rollback on error.

---

## 11. Known Limitations & Roadmap

1. **Legacy Binary Excel (`.xls`):** The Excel parser supports modern Office Open XML (`.xlsx`) and Comma-Separated Values (`.csv`). Binary BIFF8 (`.xls`) files are explicitly rejected with an instructive user prompt to save as `.xlsx` or `.csv`.
2. **Background Processing for Very Large Imports (>10,000 rows):** Current imports process synchronously in chunked database transactions. For datasets exceeding 10,000 lines, asynchronous BullMQ / Redis worker queues can be integrated.
3. **ERP Integrations:** Direct sync hooks for SAP S/4HANA or Microsoft Dynamics 365 Business Central can be attached via quotation approval webhooks.

---

## 12. License & Commercial Rights

Copyright © 2026 ForgeQuote Technologies. All rights reserved.
Proprietary software for manufacturing quotation engineering and enterprise resource planning.
