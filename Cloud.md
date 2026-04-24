# Cloud.md — Infrastructure, Integrations & Maintenance Guide

> Правило: кожна зміна, яка додає нову Railway variable, інтеграцію, endpoint, payment method, cron або змінює production flow, **повинна одночасно оновлювати Cloud.md**. Якщо Cloud.md не оновлено — задача незавершена.

---

## 1. Project Overview

E-commerce store for Anatoliy Nesterchuk — apple cider vinegar and Bordeaux mixture.

**Stack:** Next.js 16 + TypeScript + Tailwind CSS + Prisma 7 + PostgreSQL + Railway

**Integrations:**
- **KeyCRM** — order management, buyer, payment sync, status sync
- **WayForPay** — online card payments (Visa/Mastercard)
- **Nova Poshta** — delivery service (city/warehouse search)
- **Cloudflare R2** — product image storage (S3-compatible)

**Repo:** https://github.com/SergiiNesterchuk/www.nesterchukanatoliy.com

---

## 2. Railway Services

```
Railway Project: beautiful-forgiveness
├── www.nesterchukanatoliy.com   (web service — Docker)
├── PostgreSQL                    (database — managed)
└── keycrm-status-cron           (future — cron for status sync)
```

| Service | Purpose | Variables |
|---------|---------|-----------|
| **Web service** | Site, admin, API, checkout, webhooks | All app variables (see §3) |
| **PostgreSQL** | Database | DATABASE_URL (auto-generated) |
| **Cron service** | KeyCRM status sync (every 10-15 min) | CRON_SECRET, SITE_URL |

**DATABASE_URL** must be the **full** connection string in web service:
```
postgresql://postgres:PASSWORD@host:port/railway
```
Not just `host:port`. Use Railway variable reference `${{Postgres.DATABASE_PUBLIC_URL}}` or copy from Postgres service.

---

## 3. Environment Variables Reference

### Required (site won't work without)

| Variable | Service | Purpose | Example | When to change |
|----------|---------|---------|---------|----------------|
| `DATABASE_URL` | web | PostgreSQL connection | `postgresql://postgres:xxx@host:5432/railway` | Change DB |
| `SITE_URL` | web | Server-side public URL (runtime) | `https://wwwnesterchukanatoliycom-production.up.railway.app` | Change domain |
| `ADMIN_JWT_SECRET` | web | Admin auth cookie signing | `openssl rand -hex 32` | Rotate security. **Logs out all admins.** |

### KeyCRM

| Variable | Purpose | When to change |
|----------|---------|----------------|
| `KEYCRM_API_KEY` | API bearer token | Change KeyCRM account/key |
| `KEYCRM_BASE_URL` | API endpoint (default: `https://openapi.keycrm.app/v1`) | Never (unless KeyCRM changes API) |
| `KEYCRM_SOURCE_ID` | Source ID for orders (default: `1`) | Change sales channel in KeyCRM |
| `KEYCRM_NOVA_POSHTA_SERVICE_ID` | Nova Poshta delivery service ID in KeyCRM | `4` (check KeyCRM → Settings → Delivery) |

### WayForPay

| Variable | Purpose | When to change | Risk if wrong |
|----------|---------|----------------|---------------|
| `WAYFORPAY_MERCHANT_ACCOUNT` | Merchant ID | Change ФОП/merchant | Payments fail |
| `WAYFORPAY_MERCHANT_SECRET` | HMAC signing secret | Change merchant | Signature invalid, payments fail |
| `WAYFORPAY_MERCHANT_DOMAIN` | Domain for redirects | Change domain | Redirect to wrong host after payment |

### Nova Poshta

| Variable | Purpose | When to change |
|----------|---------|----------------|
| `NOVAPOSHTA_API_KEY` | API key for city/warehouse search | Change NP account/sender |

### Cloudflare R2 (Image Storage)

| Variable | Purpose | Example |
|----------|---------|---------|
| `S3_ENDPOINT` | R2 API endpoint (origin only, no path) | `https://ACCOUNT_ID.r2.cloudflarestorage.com` |
| `S3_ACCESS_KEY` | R2 access key | From R2 API Tokens |
| `S3_SECRET_KEY` | R2 secret key | From R2 API Tokens |
| `S3_BUCKET` | Bucket name | `nesterchukanatoliy` |
| `S3_REGION` | Region | `auto` |
| `S3_PUBLIC_URL` | Public bucket URL | `https://pub-XXXXX.r2.dev` |

**Important:** `S3_ENDPOINT` must be only the origin — do NOT append bucket name.

### Cron

| Variable | Purpose |
|----------|---------|
| `CRON_SECRET` | Auth for `/api/cron/*` endpoints. **Do NOT use ADMIN_JWT_SECRET.** |

### Feature Flags

| Variable | Default | Purpose |
|----------|---------|---------|
| `PAYMENTS_ENABLED` | `true` | `false` → skip WayForPay, orders created as unpaid |
| `CRM_SYNC_ENABLED` | `true` | `false` → no KeyCRM API calls |
| `EMAIL_ENABLED` | `false` | Future: enable email notifications |

### Future Email

| Variable | Purpose |
|----------|---------|
| `EMAIL_ENABLED` | `true` to enable |
| `EMAIL_FROM` | Sender address |
| `RESEND_API_KEY` | Resend.com API key |

---

## 4. How to Change WayForPay Merchant

1. Get new credentials from WayForPay dashboard → Merchant settings
2. In Railway → web service → Variables:
   ```
   WAYFORPAY_MERCHANT_ACCOUNT=new_merchant_account
   WAYFORPAY_MERCHANT_SECRET=new_secret_key
   WAYFORPAY_MERCHANT_DOMAIN=your-domain.com
   ```
3. Redeploy web service
4. Test: make a small order → pay → verify success page works
5. Verify in KeyCRM: payment synced correctly
6. **Warning:** Old transaction IDs belong to old merchant — don't mix

---

## 5. How to Change Nova Poshta Account

1. Get new API key from https://new.novaposhta.ua → Settings → Security → API keys
2. In Railway → web service → Variables:
   ```
   NOVAPOSHTA_API_KEY=new_key
   ```
3. Redeploy
4. Test: checkout → search "Бровари" → warehouses load
5. If future TTN creation added: also update sender/counterparty refs

---

## 6. How to Change KeyCRM Account

1. Get new API key from KeyCRM → Settings → API
2. In Railway → web service → Variables:
   ```
   KEYCRM_API_KEY=new_key
   KEYCRM_SOURCE_ID=1  (check your KeyCRM sources)
   ```
3. Redeploy
4. Test: create order → verify it appears in KeyCRM
5. If status/payment/delivery mappings changed → update code mappings

---

## 7. Payment Methods

**Admin:** `/admin/payment-methods`

| Method | Key | Online | Description |
|--------|-----|--------|-------------|
| Card (WayForPay) | `card_wayforpay` | Yes | Redirect to WayForPay → callback → paid |
| Cash on Delivery | `cod_cash_on_delivery` | No | Order created as unpaid, sync to KeyCRM immediately |

**How to enable COD:** Admin → Оплата → `cod_cash_on_delivery` → toggle Увімкнено → Save

**Payment statuses:**

| Status | Meaning |
|--------|---------|
| `pending` | Waiting for online payment |
| `cod_pending` | Cash on delivery — will be paid at pickup |
| `paid` | Payment confirmed via WayForPay callback |
| `failed` | Payment declined/failed |
| `refunded` | Payment refunded/reversed |

**Critical:** COD orders must NOT create WayForPay invoice. Guard clause in `createPaymentForOrder()`.

---

## 8. Order Status / Customer Lookup

**URL:** `/order-status`

- User enters order number + phone
- Ownership verified via normalized phone match
- Shows: status, payment, delivery, tracking, items, total, history
- Does NOT show: crm_sync_status, KeyCRM IDs, integration logs
- User cannot cancel/edit orders
- Recent orders saved in browser localStorage (up to 10)

**Footer link:** "Статус замовлення"

---

## 9. KeyCRM Status Sync / Cron

### Why cron?
KeyCRM is source of truth for order processing. When manager changes status in KeyCRM (e.g. "Відправлено"), local site needs to know.

### Endpoint
```
POST /api/cron/keycrm-status-sync?secret=CRON_SECRET
```

### What it does
- Fetches orders with `keycrmOrderId` that are NOT in final status
- For each: `GET /order/{id}` from KeyCRM → updates local status
- Maps KeyCRM status names → local statuses (see `shared/order-statuses.ts`)
- Updates tracking number if available
- Records changes in OrderStatusHistory

### Final statuses (not synced)
`completed`, `cancelled`, `returned`

### Setup Railway cron service
1. Create new Railway service in same project
2. Set cron schedule: `*/15 * * * *` (every 15 minutes)
3. Command: `curl -X POST "https://SITE_URL/api/cron/keycrm-status-sync?secret=CRON_SECRET"`
4. Variables: `CRON_SECRET`, `SITE_URL`

**Do NOT use ADMIN_JWT_SECRET as cron secret.**

---

## 10. Cloudflare R2 Image Storage

### Why not local filesystem?
Railway uses ephemeral containers. Files in `/public/uploads/` are **lost on every redeploy**.

### How it works
```
Admin upload → API route → Buffer → S3 PutObject → R2 → Public URL → DB
Frontend: <img src="https://pub-XXX.r2.dev/products/uuid.jpg">
```

### Setup
1. Cloudflare → R2 → Create bucket → Enable public access
2. Create API token with Object Read & Write
3. Set Railway variables (see §3)

### Troubleshooting
- **Images not showing:** Check `S3_PUBLIC_URL` matches actual bucket public URL
- **Upload fails:** Check `S3_ENDPOINT` is origin only (no `/bucket-name` suffix)
- **404 on image:** Check R2 public access is enabled for bucket
- **Images lost after deploy:** They're still in R2. Check DB has correct URLs, not `/api/uploads/`

---

## 11. Database & Data Safety

**All data lives in Railway PostgreSQL.** GitHub stores code only.

### Never run in production
- `prisma migrate reset`
- `prisma db push --force-reset`
- `DELETE FROM ...` or `TRUNCATE` on orders/customers/settings
- Destructive seed that overwrites admin-changed settings

### Safe seed
```bash
railway run npx tsx prisma/seed.ts
```
Seed uses `upsert` — creates if missing, doesn't overwrite existing data.

### Backup before changes
```bash
railway run pg_dump $DATABASE_URL > backup.sql
```

---

## 12. What Lives Where

| System | Stores | Backup responsibility |
|--------|--------|----------------------|
| **GitHub** | Code, Prisma schema, seed, configs | Git history |
| **Railway PostgreSQL** | Products, pages, orders, customers, settings, payment methods | `pg_dump` before migrations |
| **Cloudflare R2** | Uploaded product images | R2 has its own durability |
| **KeyCRM** | Operational orders, buyer data, payments, statuses | KeyCRM's responsibility |
| **WayForPay** | Card payment transactions, refunds | WayForPay's responsibility |
| **Nova Poshta** | Delivery directory, future TTN | Nova Poshta's responsibility |
| **Browser localStorage** | Recent order numbers (non-critical) | Not backed up |

**Key insight:** If Railway PostgreSQL is lost, ALL orders/products/settings are gone. Regular `pg_dump` backups are essential.

---

## 13. Order Lifecycle

### Card Payment Flow (card_wayforpay)

```
Cart → Checkout form → POST /api/checkout
  → Local Order created (status: new, paymentStatus: pending)
  → WayForPay session created → user redirected to WayForPay
  → User pays → WayForPay callback POST /api/payment/callback
  → Signature verified → paymentStatus: paid
  → KeyCRM sync triggered (async)
  → KeyCRM order + payment created, keycrmPaymentId saved
  → User redirected to success page
```

### COD Flow (cod_cash_on_delivery)

```
Cart → Checkout form → POST /api/checkout
  → Local Order created (status: new, paymentStatus: cod_pending)
  → WayForPay NOT called (guard clause)
  → KeyCRM sync triggered immediately
  → KeyCRM order created with payment_method: cash_on_delivery, status: not_paid
  → User redirected to success page ("Оплата при отриманні")
```

### Status Table

| Status field | Values | Visible to customer? |
|-------------|--------|---------------------|
| `status` | new, confirmed, processing, paid, shipped, delivered, completed, cancelled | Yes (Ukrainian labels) |
| `paymentStatus` | pending, cod_pending, paid, failed, refunded, cancelled | Yes |
| `deliveryStatus` | null, shipped, in_transit, delivered | Yes |
| `keycrmSyncStatus` | pending, synced, failed | **No** (admin only) |
| `trackingNumber` | null or NP tracking | Yes (when available) |

### Refund/Cancel Flow

```
WayForPay refund/cancel callback
  → paymentStatus: failed/refunded
  → PaymentEvent recorded
  → If keycrmPaymentId exists:
      → PUT /order/{id}/payment/{paymentId} status:canceled in KeyCRM
  → If no keycrmPaymentId (old orders):
      → Comment added to KeyCRM order (manual check required)
  → OrderStatusHistory updated
```

### Refund Sync: Old vs New Orders

| Order type | keycrmPaymentId | Refund behavior |
|-----------|-----------------|-----------------|
| **Old** (before fix) | Not saved | Comment only → **manual cancellation in KeyCRM** |
| **New** (after fix) | Saved after sync | **Automatic** financial payment cancellation in KeyCRM |
| Refund sync failed | — | `keycrmSyncStatus: failed` → manual retry in admin |
| Duplicate callback | — | Idempotent — no duplicate refund |

**Where to check:** Admin → Orders → [order] → CRM Sync status + Integration Logs

---

## 14. Business Switch Checklist

When changing ФОП, merchant, delivery sender, or CRM account:

### WayForPay (payment processor)
- [ ] Get new credentials from WayForPay dashboard
- [ ] Change in Railway Variables:
  - `WAYFORPAY_MERCHANT_ACCOUNT`
  - `WAYFORPAY_MERCHANT_SECRET`
  - `WAYFORPAY_MERCHANT_DOMAIN`
- [ ] Redeploy
- [ ] Test: small card payment → success → refund test

### KeyCRM
- [ ] Get new API key from KeyCRM → Settings → API
- [ ] Change in Railway Variables:
  - `KEYCRM_API_KEY`
  - `KEYCRM_SOURCE_ID` (check new KeyCRM sources)
  - `KEYCRM_NOVA_POSHTA_SERVICE_ID` (check new delivery services)
- [ ] Redeploy
- [ ] Test: create order → appears in KeyCRM with correct delivery

### Nova Poshta
- [ ] Get new API key from NP dashboard
- [ ] Change: `NOVAPOSHTA_API_KEY`
- [ ] Redeploy
- [ ] Test: search "Бровари" in checkout → warehouses load
- [ ] Future TTN: also update sender/counterparty refs if applicable

### Cloudflare R2 (if changing storage)
- [ ] Change: `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_PUBLIC_URL`
- [ ] Migrate existing images to new bucket
- [ ] Redeploy
- [ ] Test: upload new photo → displays on site

### Domain change
- [ ] Update: `SITE_URL`, `WAYFORPAY_MERCHANT_DOMAIN`
- [ ] Configure DNS for new domain → Railway
- [ ] Update WayForPay merchant settings (allowed domains)
- [ ] Redeploy
- [ ] Test: full checkout → payment → redirect back to site

### Email (future)
- [ ] Change: `EMAIL_FROM`, `RESEND_API_KEY`
- [ ] Verify domain in Resend/provider

### Post-switch verification
- [ ] Card checkout → payment → success page
- [ ] COD checkout → no WayForPay → success page
- [ ] KeyCRM: order appears with delivery + payment
- [ ] Nova Poshta: city search works
- [ ] Photo upload works
- [ ] /order-status → order found
- [ ] Admin panel → all sections load

---

## 15. Secrets Separation Rule

| Secret | Used for | Where |
|--------|----------|-------|
| `ADMIN_JWT_SECRET` | Admin panel auth cookies **only** | Admin login, middleware |
| `CRON_SECRET` | Cron endpoint auth **only** | `/api/cron/*` endpoints |

**Never** use `ADMIN_JWT_SECRET` for cron endpoints or external services.
**Never** use `CRON_SECRET` for admin auth.

---

## 16. Deploy Flow

```
git push main
    ↓
Railway detects push → Docker build
    ↓
[Dockerfile] npm ci → prisma generate → next build
    ↓
Container starts → start.sh
    ↓
prisma db push (apply schema, idempotent)
    ↓
npm run start (Next.js on $PORT)
```

**After changing env variables:** Redeploy required for changes to take effect.

---

## 17. Troubleshooting

### 500 on homepage
```
Cause: DATABASE_URL missing or malformed
Fix:   Check full connection string in Railway Variables
```

### Admin login doesn't work
```
Cause: ADMIN_JWT_SECRET not set, or seed not run
Fix:   Set secret, run seed, redeploy
```

### Images disappeared
```
Cause: Old images were on local filesystem (lost on redeploy)
Fix:   Re-upload via admin. New images go to R2 (persistent)
```

### WayForPay redirect has %20 or goes to localhost
```
Cause: SITE_URL has trailing space, or WAYFORPAY_MERCHANT_DOMAIN wrong
Fix:   Trim SITE_URL, set correct domain, redeploy
```

### COD creates WayForPay invoice
```
Cause: Guard clause missing or paymentMethod key mismatch
Fix:   Verify cod_cash_on_delivery exists in PaymentMethod table
       Run seed if needed
```

### KeyCRM doesn't receive delivery address
```
Cause: Missing KEYCRM_NOVA_POSHTA_SERVICE_ID
Fix:   Set to Nova Poshta service ID from KeyCRM settings (e.g. 4)
```

### Nova Poshta cities/warehouses don't load
```
Cause: NOVAPOSHTA_API_KEY not set or invalid
Fix:   Set correct API key, redeploy
```

### Payment refund only writes comment in KeyCRM
```
Cause: keycrmPaymentId not saved (old orders before keycrmPaymentId fix)
```

**IMPORTANT — old vs new orders:**

| Order type | keycrmPaymentId | Refund sync |
|-----------|-----------------|-------------|
| Old (before fix) | `null` | Comment only → **manual cancellation in KeyCRM** |
| New (after fix) | Saved | **Automatic:** `PUT /order/{id}/payment/{paymentId}` with `status:canceled` |
| Sync failed | — | `keycrmSyncStatus: failed` → retry via admin |
| Duplicate callback | — | Idempotent — skipped if already refunded |

**Where to check:** Admin → Orders → [order] → CRM Sync status, Payment Events, Integration Logs

### Cron not updating statuses
```
Cause: CRON_SECRET wrong, or KeyCRM API key expired
Fix:   Check cron service logs, verify secrets match
```

---

## 18. Future Email Setup

**Provider:** Resend (https://resend.com)

**Variables to add:**
```
EMAIL_ENABLED=true
EMAIL_FROM=orders@nesterchukanatoliy.com
RESEND_API_KEY=re_xxxxx
```

**Planned emails:**
- Order created (order number, items, delivery, status link)
- Payment received
- Order shipped (tracking number)
- Order cancelled/refunded

**Important:** Email must never block checkout. If send fails → log error, continue.

---

## 19. Maintenance Checklist

| After... | Do... |
|----------|-------|
| Changing any env variable | Redeploy web service |
| Changing WayForPay merchant | Test payment with small order |
| Changing Nova Poshta key | Test city/warehouse search in checkout |
| Changing KeyCRM key | Test order creation → check KeyCRM |
| Before Prisma migrations | Backup database |
| After deploy | Run smoke test (see SMOKE_TEST.md) |
| Adding new env variable | Update Cloud.md |
| Adding new integration | Update Cloud.md |
| Adding new payment method | Update Cloud.md §7 |

---

## 20. Production URLs

| URL | Purpose |
|-----|---------|
| Site | `https://wwwnesterchukanatoliycom-production.up.railway.app` |
| Admin | `.../admin/login` |
| Order status | `.../order-status` |
| Sitemap | `.../api/sitemap.xml` |
| Payment callback | `.../api/payment/callback` |
| Payment return | `.../api/payment/return` |
| KeyCRM webhook | `.../api/keycrm/webhook` |
| Cron sync | `.../api/cron/keycrm-status-sync?secret=CRON_SECRET` |

**Admin credentials:** `admin@nesterchukanatoliy.com` / `admin123` (change in production!)

---

## 21. Change Documentation Rule

Every code change that does any of the following **must update Cloud.md in the same commit:**

- Adds a new environment variable
- Adds a new external integration
- Adds a new API endpoint
- Adds a new payment method
- Adds a new cron job
- Changes storage/CDN configuration
- Changes email provider
- Changes production deploy flow
- Changes KeyCRM/WayForPay/NovaPoshta mapping

**If Cloud.md is not updated, the task is incomplete.**
