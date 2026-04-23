# Cloud.md — Deploy, Infrastructure & Integration Guide

## 1. Project Overview

E-commerce store for Anatoliy Nesterchuk — natural apple cider vinegar and Bordeaux mixture.

**Stack:** Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + Prisma 7 + PostgreSQL + Railway

**Architecture:**
- **Storefront** (this repo) — product catalog, cart, checkout, static pages, admin panel
- **KeyCRM** — order processing, buyer management (external SaaS, sync via API)
- **WayForPay** — payment processing (external, webhook-based)

**Repo:** https://github.com/SergiiNesterchuk/www.nesterchukanatoliy.com

---

## 2. Production URLs

| Endpoint | URL |
|----------|-----|
| Site | https://wwwnesterchukanatoliycom-production.up.railway.app |
| Admin | https://wwwnesterchukanatoliycom-production.up.railway.app/admin/login |
| API | https://wwwnesterchukanatoliycom-production.up.railway.app/api/ |
| Sitemap | https://wwwnesterchukanatoliycom-production.up.railway.app/api/sitemap.xml |

---

## 3. Environment Variables

### Required — site won't work without these

| Variable | Example | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://postgres:PASS@host:port/railway` | Full PostgreSQL connection string. **Must include user, password, host, port, dbname.** Without it: all DB-backed pages return 500. |
| `NEXT_PUBLIC_SITE_URL` | `https://wwwnesterchukanatoliycom-production.up.railway.app` | Public site URL. Used for canonical URLs, OG tags, sitemap, payment callbacks. Without it: SEO broken, payment redirects fail. |
| `ADMIN_JWT_SECRET` | `a3f8c9...` (64+ chars) | Secret for admin auth cookie signing. Generate: `openssl rand -hex 32`. Without it: admin login won't work. |

### Optional — features degrade gracefully without them

| Variable | Default | Description |
|----------|---------|-------------|
| `ADMIN_LOGIN` | — | Admin display login (informational) |
| `ADMIN_PASSWORD` | — | Admin display password (informational) |
| `KEYCRM_API_KEY` | — | KeyCRM API bearer token. Without it: orders created locally but not synced to CRM. |
| `KEYCRM_BASE_URL` | `https://openapi.keycrm.app/v1` | KeyCRM API endpoint. |
| `KEYCRM_SOURCE_ID` | `1` | Source ID in KeyCRM for orders from this site. |
| `CRM_SYNC_ENABLED` | `true` | Set `false` to disable all KeyCRM sync. Orders stay local only. |
| `PAYMENTS_ENABLED` | `true` | Set `false` to disable payment processing. Checkout will skip payment step. |
| `WAYFORPAY_MERCHANT_ACCOUNT` | — | WayForPay merchant ID. Without it: card payments won't work. |
| `WAYFORPAY_MERCHANT_SECRET` | — | WayForPay HMAC secret for signature verification. |
| `WAYFORPAY_MERCHANT_DOMAIN` | — | Domain registered with WayForPay (e.g. `nesterchukanatoliy.com`). |
| `NOVAPOSHTA_API_KEY` | — | Nova Poshta API key for branch search (future). |

---

## 4. Railway Setup

### Project structure

```
Railway Project: beautiful-forgiveness
├── www.nesterchukanatoliy.com   (web service — Docker, this repo)
└── PostgreSQL                    (database service — managed by Railway)
```

### DATABASE_URL configuration

**Critical:** the web service `DATABASE_URL` must be the **full** PostgreSQL connection string, not just `host:port`.

Correct:
```
postgresql://postgres:OKhXdXRHnsSJKPTqTysqvOcZhESfPZGq@shortline.proxy.rlwy.net:53510/railway
```

Wrong:
```
shortline.proxy.rlwy.net:53510
```

**How to set correctly:**
1. Open PostgreSQL service → Variables → copy `DATABASE_PUBLIC_URL`
2. Open web service → Variables → set `DATABASE_URL` = copied value

Or use Railway variable reference: `${{Postgres.DATABASE_PUBLIC_URL}}`

### Where to find Variables

Railway Dashboard → Project → Service → Variables tab

---

## 5. Deploy Configuration

### Dockerfile-based build (current)

The project uses a multi-stage `Dockerfile`. Railway detects it automatically.

### Effective pipeline

| Stage | Command | Notes |
|-------|---------|-------|
| **Install** | `npm ci` | Runs `postinstall` → `prisma generate` |
| **Build** | `npm run build` | Next.js production build |
| **Start** | `./start.sh` | Runs `prisma db push` then `npm run start` |

### start.sh behavior

On every container start:
1. If `DATABASE_URL` is set → runs `npx prisma db push` (applies schema, idempotent)
2. Starts Next.js server on `PORT` (set by Railway automatically)

### What NOT to do in build

- Do not run `seed` in build/start — it's a one-time manual operation
- Do not run `prisma migrate dev` in production — use `db push` or `migrate deploy`
- Do not put `DATABASE_URL` in Dockerfile — it's a runtime env var

---

## 6. Database

### Engine

PostgreSQL, managed by Railway. Connected via `pg` driver + `@prisma/adapter-pg`.

### Schema location

```
prisma/schema.prisma
```

### Key tables

| Table | Purpose |
|-------|---------|
| `Category` | Product categories (2 in seed) |
| `Product` | Products with price in kopiyky (4 in seed) |
| `ProductImage` | Product photo gallery |
| `Order` | Customer orders with delivery/payment info |
| `OrderItem` | Line items (snapshot of product at order time) |
| `PaymentEvent` | Payment webhook log (success/failure/refund) |
| `IntegrationLog` | All external API calls (KeyCRM, WayForPay) |
| `Page` | CMS-managed static pages |
| `Banner` | Homepage banners |
| `Settings` | Key-value site settings |
| `AdminUser` | Admin panel users |
| `Redirect` | 301 redirect rules for SEO migration |
| `SyncJob` | Pending CRM sync queue |

### Database commands

```bash
# Apply schema to database (safe, idempotent)
DATABASE_URL="..." npx prisma db push

# Apply migrations (when migration files exist)
DATABASE_URL="..." npx prisma migrate deploy

# Open visual DB browser
DATABASE_URL="..." npx prisma studio

# Generate Prisma client (after schema changes)
npx prisma generate
```

**Note:** Prisma 7 requires `--url` flag or `datasource.url` in `prisma.config.ts` for CLI commands. The env var `DATABASE_URL` is read by `prisma.config.ts` at runtime.

---

## 7. Seed Data

### How to run

From local machine with Railway CLI:
```bash
railway link          # select project, environment, web service
railway run npx tsx prisma/seed.ts
```

Or with explicit DATABASE_URL:
```bash
DATABASE_URL="postgresql://postgres:PASS@host:port/railway" npx tsx prisma/seed.ts
```

### What seed creates

- **2 categories:** Бордоська суміш, Яблучний оцет
- **4 products:** SKU 01-04, with prices, descriptions, stock quantities
- **4 pages:** Про нас, Оплата і доставка, Контакти, Умови використання
- **6 settings:** site_name, description, phone, email, GA4 ID, Clarity ID
- **1 admin user:** `admin@nesterchukanatoliy.com` / `admin123`

### Admin credentials

```
URL:      /admin/login
Email:    admin@nesterchukanatoliy.com
Password: admin123
```

**Change password in production** — currently stored as SHA-256 hash.

---

## 8. KeyCRM Integration

### Flow

```
Checkout → Local Order created → Payment processed → KeyCRM sync triggered
```

1. Order always saved locally first (never lost)
2. After payment success → `KeyCRMService.createOrder()` called
3. If KeyCRM unavailable → order marked `keycrmSyncStatus: "pending"`
4. Retry mechanism: `POST /api/revalidate?action=sync&secret=ADMIN_JWT_SECRET`

### Sync statuses

| Status | Meaning |
|--------|---------|
| `pending` | Waiting to sync |
| `synced` | Successfully sent to KeyCRM |
| `failed` | Sync failed, will retry (up to 5 attempts) |

### Feature flag

```
CRM_SYNC_ENABLED=false
```

When disabled: orders are created locally, no KeyCRM API calls made. All checkout and payment still works.

### Code location

```
integrations/keycrm/KeyCRMClient.ts    — HTTP client with logging
integrations/keycrm/KeyCRMMapper.ts    — local order → KeyCRM format
services/KeyCRMService.ts              — business logic, retry, sync
```

---

## 9. Payment Flow

### Flow

```
Checkout form → POST /api/checkout → Order created → Payment session created
→ User pays on WayForPay → Webhook POST /api/payment/callback
→ Signature verified → PaymentEvent recorded → Order status updated → KeyCRM sync
```

### Payment states

| Status | Meaning |
|--------|---------|
| `pending` | Order created, waiting for payment |
| `paid` | Payment confirmed via webhook |
| `failed` | Payment failed or declined |

### Feature flag

```
PAYMENTS_ENABLED=false
```

When disabled: checkout skips payment step, order created with `paymentStatus: "pending"`.

### Code location

```
integrations/payment/PaymentProviderInterface.ts   — abstract interface
integrations/payment/WayForPayAdapter.ts           — WayForPay implementation
integrations/payment/PaymentProviderFactory.ts     — provider selection
services/OrderService.ts                           — orchestration
app/api/payment/callback/route.ts                  — webhook handler
```

---

## 10. Debug & Troubleshooting

### 500 on `/` (homepage)

```
Cause:  DATABASE_URL missing, malformed, or DB has no tables
Fix:    1. Check DATABASE_URL is full connection string in Railway Variables
        2. Redeploy (start.sh runs db push automatically)
        3. If tables exist but empty → run seed
```

### No products or categories visible

```
Cause:  Seed not executed
Fix:    railway run npx tsx prisma/seed.ts
        or: DATABASE_URL="..." npx tsx prisma/seed.ts
```

### Admin login doesn't work

```
Cause:  ADMIN_JWT_SECRET not set, or seed not run (no admin user in DB)
Fix:    1. Set ADMIN_JWT_SECRET in Railway Variables
        2. Run seed if admin user doesn't exist
        3. Redeploy
```

### Checkout fails / payment error

```
Cause:  WAYFORPAY_* variables not set
Fix:    Set WAYFORPAY_MERCHANT_ACCOUNT, SECRET, DOMAIN
        or: set PAYMENTS_ENABLED=false to skip payments
```

### KeyCRM sync errors

```
Cause:  KEYCRM_API_KEY invalid or KeyCRM API down
Fix:    1. Check /admin/integration-logs for detailed error
        2. Fix API key in Railway Variables
        3. Trigger retry: POST /api/revalidate?action=sync&secret=ADMIN_JWT_SECRET
        or: set CRM_SYNC_ENABLED=false to disable
```

### Railway build fails

```
Cause:  Usually .env files leaking into build context
Fix:    .dockerignore must exclude .env*
        Dockerfile must not reference DATABASE_URL at build time
```

---

## 11. Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL (local or Docker)

### Setup

```bash
git clone https://github.com/SergiiNesterchuk/www.nesterchukanatoliy.com.git
cd www.nesterchukanatoliy.com
npm install
```

### Local PostgreSQL via Docker

```bash
docker run -d \
  --name nesterchukanatoliy-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=nesterchukanatoliy \
  -p 5432:5432 \
  postgres:16-alpine
```

### .env.local

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nesterchukanatoliy"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
ADMIN_JWT_SECRET="dev-secret-change-in-production"
```

### Run

```bash
npx prisma db push        # create tables
npx tsx prisma/seed.ts    # seed data
npm run dev               # start dev server at localhost:3000
```

---

## 12. Deployment Flow

```
Developer pushes to main
        ↓
Railway detects push, starts Docker build
        ↓
[Dockerfile] npm ci → prisma generate → next build
        ↓
Container starts → start.sh
        ↓
prisma db push (apply schema changes, idempotent)
        ↓
npm run start (Next.js production server on $PORT)
```

### Manual redeploy

Railway Dashboard → web service → Deployments → Redeploy

### Manual sync trigger

```bash
curl -X POST "https://SITE_URL/api/revalidate?action=sync&secret=ADMIN_JWT_SECRET"
```

---

## 13. Security Notes

- **Never commit** `.env`, `.env.local`, or any file with credentials
- **`.env.example`** must never contain real values (use empty strings or placeholders)
- **`ADMIN_JWT_SECRET`** must be at least 32 random bytes: `openssl rand -hex 32`
- **WayForPay webhook** verifies HMAC-MD5 signature before processing
- **Admin auth** uses httpOnly secure cookies (not localStorage)
- **CSRF** protection on all admin mutation endpoints
- **Rate limiting** should be added for `/api/checkout` and `/api/payment/callback` (not yet implemented)
- **Production credentials** must be separate from development
- **Database password** should be rotated periodically via Railway dashboard

---

## 14. Future Improvements

| Priority | Task |
|----------|------|
| High | Connect WayForPay with real merchant credentials |
| High | Connect KeyCRM with production API key |
| High | Add Nova Poshta API for branch/city search in checkout |
| Medium | Add user accounts and order history |
| Medium | Add product search (MeiliSearch or PostgreSQL FTS) |
| Medium | Rate limiting on checkout and webhook endpoints |
| Medium | Email notifications (order confirmation, shipping) |
| Low | Image upload to Cloudinary/S3 instead of local `/public` |
| Low | Add product reviews |
| Low | Add wishlist/favorites |
| Low | Add Cloudflare CDN + custom domain |
| Low | ISR/caching optimization for catalog pages |
