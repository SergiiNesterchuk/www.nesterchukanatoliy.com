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
| `KEYCRM_WEBHOOK_SECRET` | Auth secret for incoming KeyCRM webhooks | Rotate security or change webhook URL |

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

## 9. KeyCRM Status Sync (Webhook + Cron Fallback)

### Architecture: Webhook-first with smart cron fallback

KeyCRM is source of truth for order processing. When a manager changes status in KeyCRM, the site is updated via:

1. **Webhook (primary, real-time)** — KeyCRM sends POST to our endpoint immediately on status change
2. **Cron (fallback, every 15 min)** — catches any missed webhooks or out-of-band changes

Both use the same centralized mapping: `shared/keycrm-status-map.ts` → `mapKeycrmToPublicStatus()`

### 6 Global Order Statuses

KeyCRM may have dozens of internal sub-statuses. The site maps ALL of them to exactly 6 public statuses:

| Public status | Label (UA) | KeyCRM status names matched (case-insensitive, keyword match) |
|---------------|-----------|--------------------------------------------------------------|
| `cancelled` | Скасовано | скасовано, відмінено, відмовлено, не оплачено, не влаштувала ціна, не влаштувала доставка, недозвон, немає в наявності, cancelled, refund |
| `delivery` | Доставка | доставка, доставляється, відправлен, передано в доставку, у дорозі, створена накладна, shipped, transit |
| `completed` | Виконано | виконано, виконаний, доставлено, отримано, завершено, completed, delivered, done |
| `production` | Виробництво | виробництво, виготов, виготовлено, виготовляється, збирається, передано у виробництво, production, manufacturing |
| `approval` | Погодження | погодження, прийнято, прийнятий, очікування, узгодження, підтверджен, очікування оплати, очікує оплати, approval, confirm, accepted, pending |
| `new` | Нове | новий, нове, new |

**Matching order matters:** cancelled is checked first (contains phrases like "не оплачено" that could partially match other rules). Most specific → least specific.

**Повна таблиця KeyCRM статусів (verified via API `/order/status`, April 2026):**

| status_id | Системна назва API | Назва в KeyCRM UI | Site status | Customer label |
|-----------|-------------------|-------------------|-------------|----------------|
| 1 | `new` | Новий | `new` | Нове |
| 2 | `presence_confirmed` | Наявність підтверджена | `approval` | Готується до відправки |
| 3 | `waiting_for_email_response` | Очікування відповіді | `approval` | Готується до відправки |
| 4 | `Оплачена попередня партія` | Оплачена попередня партія | `approval` | Готується до відправки |
| 5 | `transferred_to_production` | Передано у виробництво | `production` | Виробництво |
| 6 | `manufacturing` | Виготовляється | `production` | Виробництво |
| 7 | `manufactured` | Виготовлено | `production` | Виробництво |
| 8 | `delivered_to_delivery` | Передано в доставку | `delivery` | Доставка |
| 9 | `delivered` | Доставлено | `completed` | Виконано |
| 10 | `departing` | Відправляється | `delivery` | Доставка |
| 11 | `in_transit` | В дорозі | `delivery` | Доставка |
| 12 | `completed` | Виконано | `completed` | Виконано |
| 13 | `incorrect_data` | Некоректні дані | `cancelled` | Скасовано |
| 14 | `underbid` | Не влаштувала ціна | `cancelled` | Скасовано |
| 15 | `not_available` | Немає в наявності | `cancelled` | Скасовано |
| 19 | (кастомний) | Скасовано | `cancelled` | Скасовано |
| 20 | (кастомний) | Прийнято | `approval` | Готується до відправки |

**Як це працює:**
1. Dynamic cache: при першому webhook код робить `GET /order/status` → отримує список статусів (id + системна назва) → мапить по keywords в назві → кешує на 1 годину.
2. Manual overrides: `KEYCRM_STATUS_ID_OVERRIDES` в `shared/keycrm-status-map.ts` — для кастомних статусів (19, 20), чиї системні назви не матчаться по keywords.
3. Якщо статус невідомий → `undefined` → статус на сайті НЕ змінюється, логується warning.

**Важливо:**
- Системна назва API ≠ назва в UI KeyCRM (наприклад, `presence_confirmed` ≠ "Наявність підтверджена").
- Кастомні статуси (19, 20) не повертаються в `/order/status` — потрібні manual overrides.
- Якщо додати новий статус у KeyCRM з зрозумілою системною назвою — він автоматично замапиться.
- Якщо назва нестандартна — додати override в `KEYCRM_STATUS_ID_OVERRIDES`.

**Перевірка mapping:** `GET /api/admin/keycrm-statuses` — показує всі статуси з API + поточний mapping + "UNMAPPED" якщо є проблема.

**Перевірка конкретного замовлення:** `GET /api/admin/keycrm-order-debug?orderId=3912` — показує всі поля замовлення, shipping, TTN.

KeyCRM sub-status name зберігається в `keycrmStatusName` для діагностики, але **ніколи не показується** користувачу.

### Webhook Endpoint (production)

```
POST /api/webhooks/keycrm/order-status?secret=KEYCRM_WEBHOOK_SECRET
```

**Full production URL configured in KeyCRM:**
```
https://wwwnesterchukanatoliycom-production.up.railway.app/api/webhooks/keycrm/order-status?secret=KEYCRM_WEBHOOK_SECRET
```

**Method:** POST
**Auth:** query param `secret` or header `x-webhook-secret` checked against `KEYCRM_WEBHOOK_SECRET` env var.

**Events configured in KeyCRM:** order status change. Additional payment/invoice events may also arrive.

**KeyCRM webhook payload structure:**
```json
{
  "event": "order.status_changed",
  "context": { "id": 3911, ... }
}
```
Top-level keys are `event` (string) and `context` (object with at least `id`).

**Strategy: unified snapshot sync.** ANY webhook → extract `context.id` (KeyCRM order ID) → `GET /order/{id}?include=payments` from KeyCRM API → sync ALL dimensions in one pass:
- Order status (6 global statuses)
- Payment status (from payments array + payment_status field)
- Delivery status + tracking/TTN

No separate event routing. Every webhook triggers the same full sync. This prevents scenarios where status changes are classified as one type but carry data for another.

**Field extraction:** tries multiple paths for each field:
- **Status:** `status.name`, `status` (string), `status_id`, `status_name`, `current_status`
- **Tracking:** `tracking_code`, `ttn`, `tracking_number`, `shipping.tracking_code`, `delivery.tracking_code`, `deliveries[0].tracking_code`
- **Payment:** `payments` array (amount/status) + `payment_status` field as fallback

**Debug logging:** the handler logs the KeyCRM API response shape (top-level keys, status type/value, tracking fields found) to diagnose any field mapping issues.

**Idempotency:** each dimension is checked independently — duplicate webhook with unchanged values does NOT create duplicate history entries.

**Error handling:** handler never returns 500 to KeyCRM. Internal errors are logged and return 200 to prevent retry storms.

**Refund labels:** If payment was previously `paid`/`partial_paid` and a refund comes:
- Shows "Кошти повернено" (not "Помилка оплати")
- If prepayment was received then refunded: "Передплату скасовано / кошти повернено"
- "Оплата не пройшла" used ONLY when card was declined before any charge

### Backward-compatible aliases

| Alias endpoint | Forwards to |
|---------------|------------|
| `/api/webhooks/keycrm` | `/api/webhooks/keycrm/order-status` (re-export) |
| `/api/keycrm/webhook` | `/api/webhooks/keycrm/order-status` (re-export) |

These aliases exist for backward compatibility. **Do not configure new webhooks using alias URLs.**

### Cron Fallback Endpoint

```
POST /api/cron/keycrm-status-sync?secret=CRON_SECRET
```

**What it does:**
- Fetches orders with `keycrmOrderId` that are NOT in final status (`completed`, `cancelled`)
- For each: `GET /order/{id}` from KeyCRM API → maps status via `mapKeycrmToPublicStatus()`
- Updates local status, tracking number, delivery timestamps
- Records changes in OrderStatusHistory with source `keycrm_cron`
- Rate-limited: 1 KeyCRM API call per second

**Difference from webhook:** cron polls KeyCRM API; webhook receives push from KeyCRM. Cron is a safety net — if webhook delivery fails or KeyCRM doesn't fire the webhook, cron catches up within 15 minutes.

### Setup

**Webhook (already configured in KeyCRM):**
1. Railway variable: `KEYCRM_WEBHOOK_SECRET` — set to a random string (`openssl rand -hex 32`)
2. KeyCRM → Settings → Webhooks → URL: `https://wwwnesterchukanatoliycom-production.up.railway.app/api/webhooks/keycrm/order-status?secret=<value>`
3. Event: order status change

**Cron fallback:**
1. Create Railway cron service in same project
2. Schedule: `*/15 * * * *` (every 15 min)
3. Command: `curl -X POST "https://SITE_URL/api/cron/keycrm-status-sync?secret=CRON_SECRET"`
4. Variables: `CRON_SECRET`, `SITE_URL`

**Do NOT use ADMIN_JWT_SECRET for webhook or cron secrets.**

### Smoke Test: KeyCRM Status Sync

1. **Webhook test:** Change order status in KeyCRM → check Railway logs for `KeyCRM:Webhook:OrderStatus` event classification → verify `"Webhook: order updated"` in logs → check customer account shows new status
2. **Duplicate webhook:** Send same status change again → logs show `"no changes detected, skipping"`, no duplicate history
3. **Unsupported event:** Send arbitrary JSON to webhook URL → returns 200, logged as `unsupported` in IntegrationLog, no 500
4. **TTN test:** Add tracking number in KeyCRM → webhook triggers → customer account shows ТТН block + history entry
5. **Refund test:** Refund a previously paid order → customer sees "Кошти повернено" (not "Помилка оплати")
6. **Prepayment refund:** Refund a COD prepayment that was received → shows "Передплату скасовано / кошти повернено" (not "Передплата не пройшла")
7. **Cron test:** `curl -X POST "https://SITE_URL/api/cron/keycrm-status-sync?secret=CRON_SECRET"` → returns `{processed, updated, errors}`
8. **Verify logs:** Railway logs should show `event: "order.status_changed"` (not `eventType: "unknown"`)

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

### Status Table — 3 Separate Dimensions

Customer account shows 3 separate status blocks: Order, Payment, Delivery.

**1. Order Status (6 global, from KeyCRM mapping):**

| Value | Customer label | Color |
|-------|---------------|-------|
| `new` | Нове замовлення | Yellow |
| `approval` | Готується до відправки | Yellow |
| `production` | Виробництво | Blue |
| `delivery` | Доставка | Blue |
| `completed` | Виконано | Green |
| `cancelled` | Скасовано | Red |

KeyCRM sub-statuses are stored in `keycrmStatusName` for diagnostics but never shown to customers.

**2. Payment Status:**

| Value | Customer label | Notes |
|-------|---------------|-------|
| `pending` | Очікує оплати | |
| `awaiting_prepayment` | Очікує передплати | COD flow |
| `partial_paid` | Передплата отримана | COD prepayment 200 UAH |
| `cod_pending` | Оплата при отриманні | |
| `paid` | Оплачено | |
| `failed` | Оплата не пройшла | Payment declined BEFORE charge |
| `prepayment_failed` | Передплата не пройшла | COD prepayment declined |
| `refunded` | Кошти повернено | Refund AFTER successful charge |
| `cancelled` | Платіж скасовано | Payment cancelled |

**Important:** `failed` ≠ `refunded`. `failed` = card declined, no money charged. `refunded` = money was charged then returned.

**3. Delivery Status:**

| Value | Customer label | Source |
|-------|---------------|--------|
| `pending` / null | Очікує відправки | Default |
| `preparing` | Готується до відправки | KeyCRM delivery status |
| `shipped` | Відправлено | Order status "Доставка" or TTN appeared |
| `in_transit` | В дорозі | KeyCRM/Nova Poshta "У дорозі" |
| `arrived` | Прибуло у відділення | KeyCRM/Nova Poshta "Прибуло" |
| `delivered` | Доставлено | Order status "Виконано" or NP "Доставлено" |
| `returned` | Повернення | NP "Повернення" |
| `delivery_issue` | Проблема з доставкою | NP "Проблема доставки" |

Delivery status is extracted from KeyCRM order fields: `delivery_status`, `shipping_status`, `shipping.status`, `delivery.status`, `deliveries[0].status`, `shipments[0].status`. If no explicit delivery status, it's inferred from order status and tracking number.

**Nova Poshta tracking link:** if `trackingNumber` is a 14-digit number, a "Відстежити" button links to `novaposhta.ua/tracking/`.

**4. Internal fields (admin only, NOT shown to customers):**

| Field | Values | Purpose |
|-------|--------|---------|
| `keycrmSyncStatus` | pending, synced, failed | CRM sync state |
| `keycrmStatusName` | Original KeyCRM sub-status | Diagnostics |
| `keycrmStatusId` | KeyCRM status ID | Diagnostics |
| `trackingNumber` | NP tracking number | Shown to customer when present |

### Refund/Cancel Flow

**Customer sees:** "Кошти повернено" (refunded) or "Платіж скасовано" (cancelled), NOT "Помилка оплати".

```
WayForPay refund/cancel callback
  → paymentStatus: refunded/cancelled (NOT "failed" — that's for declined cards)
  → PaymentEvent recorded
  → OrderStatusHistory entry: "Кошти повернено" or "Платіж скасовано"
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

### Provider & Domain

- **Provider:** Resend (https://resend.com)
- **Domain:** nesterchukanatoliy.com (verified in Resend)
- **DNS Provider:** Namecheap
- **Region:** eu-west-1 (Ireland)
- **Transport:** HTTPS API (not SMTP)

### DNS Records (Namecheap)

| Type | Host | Purpose |
|------|------|---------|
| TXT | `resend._domainkey` | DKIM signature verification |
| TXT | `@` | SPF: `v=spf1 include:spf.efwd.registrar-servers.com include:amazonses.com ~all` |
| TXT | `send` | SPF: `v=spf1 include:amazonses.com ~all` |
| MX | `send` | `feedback-smtp.eu-west-1.amazonses.com` (priority 10) |

**Important:** Only ONE SPF record per host (@). DKIM required or emails go to spam.

### Railway Variables

```
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=orders@nesterchukanatoliy.com
EMAIL_FROM_NAME=Магазин Анатолія Нестерчука
EMAIL_REPLY_TO=support@nesterchukanatoliy.com
```

### When emails are sent

| Event | Email sent? |
|-------|------------|
| Card payment success (paid) | ✅ Order confirmation |
| COD prepayment success (partial_paid) | ✅ With prepayment + remaining amount |
| Payment failed/declined | ❌ No email |
| No email in order | ❌ Skipped (logged as info) |
| Duplicate callback | ❌ Idempotent: emailSentAt prevents re-send |

### Idempotency

Order has `emailSentAt` field. Email sent only once per order.
If WayForPay callback fires twice → second email NOT sent.

### How to change email sender

1. Add new domain in Resend dashboard
2. Configure DNS (DKIM + SPF + MX)
3. Wait for verification (up to 48h for DNS propagation)
4. Update `EMAIL_FROM` in Railway Variables
5. Redeploy

### Test email

```bash
curl -X POST https://SITE_URL/api/admin/test-email \
  -H "Content-Type: application/json" \
  -H "Cookie: admin_token=..." \
  -d '{"email":"test@example.com"}'
```

### Common issues

- **Resend "Pending"** → DNS not propagated yet
- **Emails go to spam** → Missing DKIM or SPF misconfigured
- **Emails not sending** → Invalid API key or domain not verified
- **Multiple SPF records on @** → Invalid, merge into one record

### SMS/Viber (future)

NotificationService.sendOrderSmsOrViber() is a no-op placeholder.
When SMS/Viber provider is chosen, implement there.
Currently logs "no provider configured" without sending.

**Important:** Email must never block checkout. If send fails → logged in IntegrationLog, order continues.

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
| KeyCRM webhook (production) | `.../api/webhooks/keycrm/order-status?secret=KEYCRM_WEBHOOK_SECRET` |
| KeyCRM webhook (alias) | `.../api/webhooks/keycrm` (re-export) |
| KeyCRM webhook (legacy alias) | `.../api/keycrm/webhook` (re-export) |
| Cron status sync | `.../api/cron/keycrm-status-sync?secret=CRON_SECRET` |

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

---

## 22. Domain Migration Checklist (Railway → nesterchukanatoliy.com)

> Інструкція для переходу з тимчасового Railway-домену
> `wwwnesterchukanatoliycom-production.up.railway.app`
> на production-домен `nesterchukanatoliy.com`.

### 22.1 Canonical Domain (SOURCE OF TRUTH)

After migration:

| Domain | Role |
|--------|------|
| `https://nesterchukanatoliy.com` | **Primary canonical domain** — all URLs, SEO, links |
| `https://www.nesterchukanatoliy.com` | Alias — 301 redirect to canonical OR served as equal (Railway supports both) |
| `https://wwwnesterchukanatoliycom-production.up.railway.app` | Technical fallback/staging only — NOT public canonical |

**Recommendation:** configure `www.nesterchukanatoliy.com` → 301 redirect to `nesterchukanatoliy.com` to avoid duplicate SEO content.

### 22.2 Railway: Add Custom Domains

Railway → Project → Web Service → Settings → Domains:

1. Add `nesterchukanatoliy.com`
2. Add `www.nesterchukanatoliy.com`
3. Railway will show required DNS records for each
4. SSL certificates are auto-provisioned (Let's Encrypt) — verify both show "Active"

### 22.3 DNS (Namecheap)

| Type | Host | Value | Purpose |
|------|------|-------|---------|
| `CNAME` | `www` | Railway-provided CNAME target | www subdomain |
| `A` | `@` | Railway-provided IP (or use ALIAS/CNAME flattening if supported) | Root domain |

**Alternative for root domain:** if Namecheap doesn't support ALIAS records, use Cloudflare as DNS proxy (free tier) with CNAME flattening.

**Verify propagation:**
```bash
dig nesterchukanatoliy.com +short
dig www.nesterchukanatoliy.com +short
curl -I https://nesterchukanatoliy.com
```

### 22.4 Environment Variables (Railway)

Update in Railway → Web Service → Variables:

| Variable | Old value | New value | Notes |
|----------|-----------|-----------|-------|
| `SITE_URL` | `https://wwwnesterchukanatoliycom-production.up.railway.app` | `https://nesterchukanatoliy.com` | Used by sitemap, SEO, JSON-LD, email links |
| `NEXT_PUBLIC_SITE_URL` | (same as SITE_URL) | `https://nesterchukanatoliy.com` | Used by `shared/constants.ts` → `SITE_URL` |
| `AUTH_URL` | not set or railway URL | `https://nesterchukanatoliy.com` | Auth.js v5 uses this for OAuth redirects |
| `WAYFORPAY_MERCHANT_DOMAIN` | railway URL or old domain | `nesterchukanatoliy.com` | WayForPay merchant domain (no protocol, no path) |

**Variables that stay the same:**
- `DATABASE_URL` — no change
- `KEYCRM_API_KEY`, `KEYCRM_WEBHOOK_SECRET` — no change
- `S3_*` variables — no change (R2 is independent)
- `RESEND_API_KEY` — no change
- `EMAIL_FROM=orders@nesterchukanatoliy.com` — already correct
- `ADMIN_JWT_SECRET`, `CRON_SECRET`, `AUTH_SECRET` — no change

**Important:** After changing variables, Railway will auto-redeploy.

### 22.5 How Domain Flows Through the Code

The site uses a centralized approach — changing env vars is sufficient, no code changes needed:

```
NEXT_PUBLIC_SITE_URL → shared/constants.ts → SITE_URL
    ↓
    ├── app/layout.tsx         → metadataBase (all canonical/OG URLs)
    ├── shared/seo.ts          → JSON-LD (WebSite, Organization, Product, Breadcrumb)
    ├── api/sitemap.xml        → all <loc> URLs
    ├── shared/url.ts          → buildAbsoluteUrl() used by:
    │   ├── WayForPay returnUrl  (redirect after payment)
    │   ├── WayForPay serviceUrl (callback URL)
    │   ├── Email order links    (order status in email body)
    │   └── Access token links   (email magic links)
    └── pages with canonical   → [slug]/page.tsx, katalog/page.tsx
```

`buildAbsoluteUrl()` priority: `RAILWAY_PUBLIC_DOMAIN` > `SITE_URL` > `NEXT_PUBLIC_SITE_URL` > hardcoded fallback.

**After domain migration:** consider removing `RAILWAY_PUBLIC_DOMAIN` from priority or unsetting it, so `SITE_URL` is always used. Otherwise Railway's auto-injected variable may override your custom domain.

**Action:** verify `RAILWAY_PUBLIC_DOMAIN` is not set, or if it is, ensure `SITE_URL` takes priority. If Railway auto-injects it, update `shared/url.ts` to prioritize `SITE_URL` over `RAILWAY_PUBLIC_DOMAIN`.

### 22.6 Google OAuth (CRITICAL)

Without this change, Google login will break immediately.

**Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID:**

1. **Authorized redirect URIs** — add:
   ```
   https://nesterchukanatoliy.com/api/auth/callback/google
   ```
2. Optionally add www version:
   ```
   https://www.nesterchukanatoliy.com/api/auth/callback/google
   ```
3. **Keep old Railway URI** as fallback until migration is verified:
   ```
   https://wwwnesterchukanatoliycom-production.up.railway.app/api/auth/callback/google
   ```
4. After verified working → remove old Railway URI

**Authorized JavaScript origins** — add:
```
https://nesterchukanatoliy.com
https://www.nesterchukanatoliy.com
```

**Auth.js env:** set `AUTH_URL=https://nesterchukanatoliy.com` (Auth.js v5 uses this to build callback URLs).

### 22.7 KeyCRM Webhook

Update webhook URL in KeyCRM dashboard:

**Old:**
```
https://wwwnesterchukanatoliycom-production.up.railway.app/api/webhooks/keycrm/order-status?secret=KEYCRM_WEBHOOK_SECRET
```

**New:**
```
https://nesterchukanatoliy.com/api/webhooks/keycrm/order-status?secret=KEYCRM_WEBHOOK_SECRET
```

**Verification:**
1. Change status of a test order in KeyCRM
2. Check Railway logs for `KeyCRM:Webhook:OrderStatus` with 200 response
3. Verify order status updated in customer account

### 22.8 WayForPay

WayForPay uses `WAYFORPAY_MERCHANT_DOMAIN` for signature and `buildAbsoluteUrl()` for return/callback URLs.

**Railway variable:** `WAYFORPAY_MERCHANT_DOMAIN=nesterchukanatoliy.com`

**WayForPay merchant dashboard:**
1. Verify domain `nesterchukanatoliy.com` is in allowed domains list
2. If WayForPay requires domain verification — do it

**After migration, payment URLs will automatically be:**
- returnUrl: `https://nesterchukanatoliy.com/api/payment/return?order=K-XXXX`
- serviceUrl (callback): `https://nesterchukanatoliy.com/api/payment/callback`

### 22.9 Email (Resend)

Resend is already configured for domain `nesterchukanatoliy.com`:
- `EMAIL_FROM=orders@nesterchukanatoliy.com` — no change needed
- DNS records (DKIM, SPF, MX) — already set for `nesterchukanatoliy.com`
- Email body links use `buildAbsoluteUrl()` → will automatically use new `SITE_URL`

**Verify:** after migration, send test email → check that order status link opens on `nesterchukanatoliy.com`

### 22.10 Cron Service

If cron calls the webhook externally, update the URL:

**Old:**
```
curl -X POST "https://wwwnesterchukanatoliycom-production.up.railway.app/api/cron/keycrm-status-sync?secret=CRON_SECRET"
```

**New:**
```
curl -X POST "https://nesterchukanatoliy.com/api/cron/keycrm-status-sync?secret=CRON_SECRET"
```

Update Railway cron service `SITE_URL` variable if it uses one.

### 22.11 SEO

All SEO outputs are centralized through `SITE_URL` — no code changes needed:

| SEO element | Source | Auto-updated? |
|------------|--------|---------------|
| `<link rel="canonical">` | `metadataBase` in `app/layout.tsx` → `SITE_URL` | Yes |
| `<meta property="og:url">` | Next.js auto from `metadataBase` | Yes |
| `sitemap.xml` URLs | `api/sitemap.xml/route.ts` → `SITE_URL` | Yes |
| JSON-LD (`url`, `@id`) | `shared/seo.ts` → `SITE_URL` | Yes |
| `robots.txt` | Next.js auto, no hardcoded sitemap URL | Yes |

**www duplicate content:** if `www.nesterchukanatoliy.com` is served as separate domain (not 301 redirect), add middleware to redirect www → non-www to prevent duplicate indexing.

### 22.12 301 Redirects (SEO preservation)

Old Railway URL should redirect to new domain. Options:

**Option A: Railway handles it** — keep Railway domain active, add redirect in Next.js middleware:
```typescript
// middleware.ts — add at top of matcher
if (request.headers.get("host")?.includes("railway.app")) {
  return NextResponse.redirect(new URL(request.url.replace(/https?:\/\/[^/]+/, "https://nesterchukanatoliy.com")), 301);
}
```

**Option B: Remove Railway domain** — users on old URLs get Railway's default page.

**Recommendation:** Option A for at least 3-6 months after migration.

### 22.13 Hardcoded URLs Check

The codebase uses centralized `SITE_URL` everywhere. No hardcoded absolute URLs in components.

Places that reference the domain (all via env/constants, not hardcoded):
- `shared/constants.ts` → `SITE_URL` from `NEXT_PUBLIC_SITE_URL`
- `shared/url.ts` → `buildAbsoluteUrl()` with fallback `nesterchukanatoliy.com`
- `app/layout.tsx` → `metadataBase` from `SITE_URL`
- `shared/seo.ts` → JSON-LD from `SITE_URL`
- `api/sitemap.xml` → from `SITE_URL`

**No frontend code has hardcoded `railway.app` URLs.**

### 22.14 Full Migration Procedure (step by step)

```
1. [DNS]      Add A/CNAME records in Namecheap for nesterchukanatoliy.com + www
2. [Railway]  Add custom domains in Railway Settings → verify SSL active
3. [Railway]  Update env variables:
                SITE_URL=https://nesterchukanatoliy.com
                NEXT_PUBLIC_SITE_URL=https://nesterchukanatoliy.com
                AUTH_URL=https://nesterchukanatoliy.com
                WAYFORPAY_MERCHANT_DOMAIN=nesterchukanatoliy.com
4. [Google]   Add redirect URI: https://nesterchukanatoliy.com/api/auth/callback/google
5. [KeyCRM]   Update webhook URL to:
                https://nesterchukanatoliy.com/api/webhooks/keycrm/order-status?secret=...
6. [WayForPay] Verify domain in merchant dashboard (if required)
7. [Railway]  Redeploy (auto after env change)
8. [Test]     Run verification checklist (§22.15)
9. [SEO]      Add 301 redirect from old railway URL (middleware)
10. [Cleanup] After 3 months: remove old Railway domain, remove old Google OAuth URI
```

### 22.15 Post-Migration Verification Checklist

| Test | How | Expected |
|------|-----|----------|
| Site loads | `curl -I https://nesterchukanatoliy.com` | 200 OK, correct SSL |
| www redirects | `curl -I https://www.nesterchukanatoliy.com` | 301 → `nesterchukanatoliy.com` (or 200 if alias) |
| Google login | Click "Увійти з Google" on /account/login | Redirects to Google → back to site → logged in |
| Email login | Enter email on /account/login | Email arrives with link to `nesterchukanatoliy.com` |
| Card payment | Create test order → pay | WayForPay → success → redirect to `nesterchukanatoliy.com/checkout/success` |
| COD order | Create COD order | Success page on new domain |
| KeyCRM webhook | Change status in KeyCRM | Railway logs show webhook received, order status updated |
| Email links | Open order link from email | Opens on `nesterchukanatoliy.com` |
| Sitemap | Visit `/api/sitemap.xml` | All URLs use `nesterchukanatoliy.com` |
| Favicon | Check browser tab | Favicon loads |
| Mobile | Open on phone | Site works, no mixed content |
| Old URL redirect | Visit `wwwnesterchukanatoliycom-production.up.railway.app` | 301 → `nesterchukanatoliy.com` |
| Cron | Trigger cron manually | Returns `{processed, updated, errors}` |

### 22.16 Known Side Effects

| Effect | Severity | Mitigation |
|--------|----------|------------|
| All users logged out | Expected | Cookies are domain-scoped. Users re-login once. |
| Old email links stop working | Low | Links use old domain → if 301 redirect is active, they still work |
| Browser cache shows old site | Low | Users hard-refresh or clear cache |
| Google OAuth fails if not updated | **Critical** | Update redirect URIs BEFORE changing domain |
| WayForPay rejects payments | **Critical** | Update `WAYFORPAY_MERCHANT_DOMAIN` BEFORE first payment |
| KeyCRM webhooks fail silently | Medium | Update webhook URL, verify with test status change |
| SEO rankings temporarily drop | Low | Normal for domain migration, recovers in 2-4 weeks with 301s |

### 22.17 Rollback Plan

If something breaks after migration:

1. Revert Railway env variables to old values
2. Remove custom domains from Railway (or keep as secondary)
3. Revert Google OAuth redirect URIs
4. Revert KeyCRM webhook URL
5. Redeploy

All changes are in external configs — no code changes needed to roll back.
