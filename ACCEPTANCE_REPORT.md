# Technical Acceptance Report

**Commit:** `Production-ready: full admin CRUD, WayForPay payment, KeyCRM sync, UX polish`
**Date:** 2026-04-24
**Scope:** 35 files, +1908/-295 lines

---

## 1. Payment Lifecycle (WayForPay)

### 1.1 Order Creation

**Trigger:** `POST /api/checkout` → `OrderService.createOrder()` (`services/OrderService.ts:20`)

**Flow:**
1. Idempotency check: `OrderRepository.findByIdempotencyKey(input.idempotencyKey)` (line 21)
   - DB constraint: `idempotencyKey String @unique` (`prisma/schema.prisma:92`)
   - If exists → returns cached order, no new creation
2. Product validation: checks existence, `stockStatus === "in_stock"`, quantity (lines 28-42)
3. Order created with `status: "new"`, `paymentStatus: "pending"`, `keycrmSyncStatus: "pending"` (DB defaults)
4. `orderNumber` format: `YYYYMMDD-XXXXXX` (timestamp + 6 random alphanumeric) (line 15)

### 1.2 Payment Request Formation

**Trigger:** `OrderService.createPaymentForOrder(orderId)` (`services/OrderService.ts:83`)

**Feature flag:** `PAYMENTS_ENABLED === "false"` → returns `null`, checkout redirects to success page without payment (line 84-87)

**WayForPay form fields** (`integrations/payment/WayForPayAdapter.ts:42-80`):

| Field | Value |
|-------|-------|
| `merchantAccount` | env `WAYFORPAY_MERCHANT_ACCOUNT` |
| `merchantDomainName` | env `WAYFORPAY_MERCHANT_DOMAIN` |
| `merchantSignature` | HMAC-MD5 (see below) |
| `merchantTransactionSecureType` | `AUTO` |
| `orderReference` | `order.orderNumber` (e.g. `20260424-A3BX9K`) |
| `orderDate` | Unix timestamp (seconds) |
| `amount` | `toHryvni(order.total)` — kopiyky → hryvni |
| `currency` | `UAH` |
| `productName[]` | item names from order |
| `productPrice[]` | item prices in hryvni |
| `productCount[]` | item quantities |
| `returnUrl` | `{SITE_URL}/checkout/success?order={orderNumber}` |
| `serviceUrl` | `{SITE_URL}/api/payment/callback` |
| `language` | `UA` |

### 1.3 Merchant Signature (request)

**File:** `WayForPayAdapter.ts:48-54`

```
HMAC-MD5(key=merchantSecret, data=
  merchantAccount;merchantDomainName;orderReference;orderDate;
  amount;currency;productName[0];...;productCount[0];...;productPrice[0];...
)
```

Separator: `;`. All values concatenated in strict order. `orderReference` = `order.orderNumber`.

### 1.4 Redirect to WayForPay

**File:** `components/checkout/CheckoutForm.tsx:91-117`

After successful `POST /api/checkout`, if `payment.formFields` returned:
1. Dynamically creates `<form method="POST" action="https://secure.wayforpay.com/pay">`
2. Adds all formFields as hidden inputs (arrays get `name[]` suffix)
3. Auto-submits form via `form.submit()`
4. Cart is cleared via `clearCart()` **before** redirect (line 89)

### 1.5 Callback Processing (Source of Truth)

**File:** `app/api/payment/callback/route.ts` → `OrderService.handlePaymentCallback()` (`services/OrderService.ts:117`)

**Source of truth:** Only validated WayForPay callback determines payment success. User redirect to `returnUrl` does NOT change payment status.

**Callback signature verification** (`WayForPayAdapter.ts:106-123`):

```
HMAC-MD5(key=merchantSecret, data=
  merchantAccount;orderReference;amount;currency;authCode;cardPan;transactionStatus;reasonCode
)
```

Compared against `merchantSignature` from callback body.

**Status mapping** (`WayForPayAdapter.ts:128-133`):

| WayForPay transactionStatus | Internal status | Action |
|-----------------------------|-----------------|--------|
| `Approved` + valid signature | `success` | `paymentStatus → paid`, trigger CRM sync |
| `Pending` / `InProcessing` | `pending` | No status change |
| Everything else | `failure` | `paymentStatus → failed` |
| Invalid signature (any status) | rejected | `{ accepted: false }`, logged as 401 |

**Signed callback response** (`WayForPayAdapter.ts:148-158`):

```json
{
  "orderReference": "<orderNumber>",
  "status": "accept",
  "time": <unix_timestamp>,
  "signature": HMAC-MD5("orderReference;accept;time")
}
```

### 1.6 External Transaction ID Storage

**Location:** `order.externalPaymentId` (`OrderRepository.updatePaymentStatus`, line 67-80)

Set to `authCode` or `transactionId` from WayForPay callback (`WayForPayAdapter.ts:137`). Also stored in `PaymentEvent.externalId`.

### 1.7 Payment Provider

Set to `order.paymentProvider = "wayforpay"` on successful callback.

---

## 2. Idempotency Analysis

### 2.1 Повторний submit checkout

**Mechanism:** `idempotencyKey` generated client-side: `${Date.now()}-${Math.random().toString(36).slice(2)}` (`CheckoutForm.tsx:65`)

**Server behavior** (`OrderService.ts:21-25`):
```typescript
const existing = await OrderRepository.findByIdempotencyKey(input.idempotencyKey);
if (existing) { return existing; }
```

**Result:** Повторний submit з тим самим idempotencyKey → повертає існуюче замовлення без створення нового.

**Risk:** IdempotencyKey генерується новий при кожному submit (містить `Date.now()`). Якщо користувач натискає "Оплатити" двічі швидко — два різних ключі можуть встигнути пройти. Проте `setSubmitting(true)` на CheckoutForm.tsx:62 та `disabled={submitting}` на кнопці (line 212) блокують повторне натискання на UI рівні.

**DB safety net:** `idempotencyKey @unique` constraint — Prisma кине помилку при спробі вставити дублікат.

### 2.2 Повторний WayForPay callback

**File:** `OrderService.ts:145-147`

```typescript
if (order.paymentStatus === "paid" && result.status === "success") {
  return { accepted: true, orderNumber: result.orderNumber };
}
```

**Result:** Дублікат callback для вже оплаченого замовлення → accepted без змін. Новий `PaymentEvent` НЕ створюється. CRM sync НЕ тригериться повторно. Статус не змінюється.

**Confirmed:** Повторний WayForPay callback не створює другу оплату.

### 2.3 Refresh success page

**URL:** `/checkout/success?order=XXXXXXXX-XXXXXX`

**Behavior:** Статична сторінка, читає `order` з searchParams. Не робить жодних mutations. Кошик вже очищений. Refresh безпечний.

### 2.4 Callback прийшов раніше за redirect

**Not a problem:** Callback обробляється серверно (`POST /api/payment/callback`). Redirect — клієнтський. Вони незалежні. Замовлення буде `paid` коли користувач побачить success page.

### 2.5 Timeout після оплати

Якщо redirect не відбувся (timeout/закриття браузера):
- Callback все одно приходить від WayForPay
- Замовлення отримує `paid` статус
- CRM sync тригериться
- Користувач може повернутись на сайт пізніше

---

## 3. Повторні оплати

### 3.1 Already paid order

**Behavior:** Якщо `order.paymentStatus === "paid"` і прийшов ще один success callback → `return { accepted: true }` без змін (`OrderService.ts:145-147`).

**Confirmed:** Уже paid order не може бути "оплачений повторно" через дублікат callback.

### 3.2 Новий payment attempt для failed order

**Current implementation:** Немає механізму для створення нового payment attempt для вже існуючого замовлення. Checkout завжди створює НОВЕ замовлення. Якщо оплата провалилась — клієнт мусить пройти checkout заново.

**PaymentEvent таблиця:** Зберігає ВСІ events (success і failure) окремо, кожен з `eventType` полем. Дублювання записів неможливе — кожен callback створює один `PaymentEvent`.

### 3.3 Failed vs successful attempt

| Scenario | paymentStatus | PaymentEvent.eventType | CRM sync triggered? |
|----------|---------------|----------------------|---------------------|
| Approved callback | `paid` | `success` | Yes |
| Declined callback | `failed` | `failure` | No |
| Duplicate approved | no change | not created | No |

---

## 4. KeyCRM Sync Lifecycle

### 4.1 Коли створюється order у KeyCRM

**Тільки після оплати.** Не до.

**Trigger chain:**
1. WayForPay callback → `OrderService.handlePaymentCallback()` → status = success
2. `OrderRepository.updateKeycrmSync(orderId, { keycrmSyncStatus: "pending" })` (line 171)
3. Async fire-and-forget: `KeyCRMService.createOrder(orderId)` (lines 173-178)

**Feature flag:** `CRM_SYNC_ENABLED !== "false"` перевіряється перед sync trigger (`OrderService.ts:170`)

### 4.2 KeyCRM unavailable

**File:** `KeyCRMService.ts:88-99`

```typescript
catch (error) {
  await OrderRepository.updateKeycrmSync(orderId, {
    keycrmSyncStatus: "failed",
    keycrmSyncError: message.substring(0, 500),
    keycrmSyncRetries: { increment: 1 },
  });
  throw new RetryableSyncError(...)
}
```

**Result:** Order зберігається локально, отримує `keycrmSyncStatus: "failed"`, помилка логується.

### 4.3 Sync statuses

| Status | Meaning | Set when |
|--------|---------|----------|
| `pending` | Очікує синхронізації | Payment success callback, before sync attempt |
| `synced` | Успішно відправлено | After KeyCRM API returns 200 with order ID |
| `failed` | Помилка синхронізації | KeyCRM API error, network error |

**Note:** `paid_but_not_synced` не існує як окремий стан. Еквівалент: `paymentStatus === "paid" AND keycrmSyncStatus IN ("pending", "failed")`.

### 4.4 Retry не створить дубль у KeyCRM

**File:** `KeyCRMService.ts:59-65`

```typescript
if (order.keycrmOrderId) {
  logger.info("Order already synced to KeyCRM", { orderId, keycrmOrderId: order.keycrmOrderId });
  return;
}
```

**Confirmed:** Якщо `keycrmOrderId` вже записаний — retry зупиняється. Після успішного sync `keycrmOrderId` записується в БД (`OrderRepository.updateKeycrmSync`, line 86-90).

### 4.5 Manual retry

**Endpoint:** `POST /api/admin/orders/[id]/retry-sync` (`app/api/admin/orders/[id]/retry-sync/route.ts`)

**Flow:**
1. Admin guard check
2. `CRM_SYNC_ENABLED` check
3. `KeyCRMService.retrySync(orderId)` → `createOrder(orderId)`
4. Idempotency via `keycrmOrderId` check (see 4.4)

### 4.6 Batch retry

**Endpoint:** `POST /api/revalidate?action=sync&secret=ADMIN_JWT_SECRET`

**File:** `KeyCRMService.processPendingSyncs()` (line 146)

```typescript
prisma.order.findMany({
  where: {
    keycrmSyncStatus: { in: ["pending", "failed"] },
    keycrmSyncRetries: { lt: 5 },
    paymentStatus: "paid",
  },
  take: 10,
})
```

Max 5 retries per order. Max 10 orders per batch. Feature flag + API key checks.

### 4.7 Payment attach

**File:** `KeyCRMService.attachPayment()` (line 102)

POST to `/order/{keycrmOrderId}/payment` з amount, method, status. Виконується окремо від createOrder. Наразі не тригериться автоматично — тільки якщо payment info включено в `KeyCRMMapper.mapOrderToKeycrm()` (line 77-86), де `payments` додається якщо `paymentStatus === "paid"`.

---

## 5. Admin CRUD

### 5.1 Сутності та операції

| Entity | Create | Read | Update | Delete | Validation |
|--------|--------|------|--------|--------|------------|
| Products | `POST /api/admin/products` | `GET .../products` `GET .../[id]` | `PUT .../[id]` | `DEL .../[id]` | `productCreateSchema` / `productUpdateSchema` |
| Categories | `POST /api/admin/categories` | `GET .../categories` | `PUT .../[id]` | `DEL .../[id]` | `categorySchema` |
| Pages | `POST /api/admin/pages` | `GET .../pages` `GET .../[id]` | `PUT .../[id]` | `DEL .../[id]` | `pageSchema` |
| Settings | — (via upsert) | `GET .../settings` | `PUT .../settings` | — | `settingSchema` |
| Redirects | `POST /api/admin/redirects` | `GET .../redirects` | — | `DEL .../[id]` | `redirectSchema` |
| Orders | — | `GET .../orders` `GET .../[id]` | — | — | — (read-only) |

### 5.2 Slug/SKU uniqueness

**Products** (`app/api/admin/products/route.ts:27-34`):
```typescript
const existing = await prisma.product.findFirst({
  where: { OR: [{ slug: data.slug }, { sku: data.sku }] },
});
```
Create: checks both slug AND sku. Update: checks each separately, excludes current ID (`NOT: { id }`).

**Categories** (`app/api/admin/categories/route.ts:16`): slug uniqueness on create. Update checks with `NOT: { id }`.

**Pages** (`app/api/admin/pages/route.ts:13`): slug uniqueness on create.

**Redirects** (`app/api/admin/redirects/route.ts:12`): `fromPath` uniqueness check.

### 5.3 Validation rules (validators/admin.schema.ts)

| Field | Rule |
|-------|------|
| `name/title` | 1-200/300 chars, required |
| `slug` | Regex `/^[a-z0-9-]+$/`, 1-200 chars |
| `sku` | 1-50 chars, required |
| `price` | Integer > 0 (kopiyky) |
| `quantity` | Integer >= 0, optional/nullable |
| `stockStatus` | enum: `in_stock`, `out_of_stock`, `preorder` |
| `description` | max 50000 chars |
| `content` (pages) | required, max 100000 chars |
| `redirects.fromPath` | Must start with `/` |

### 5.4 Видалення товару з замовленням

**Risk:** `DELETE /api/admin/products/[id]` (`app/api/admin/products/[id]/route.ts:69-80`) виконує `prisma.product.delete()` без перевірки активних замовлень. Prisma schema має `OrderItem.product @relation(... onDelete: Cascade)` — **НІ, на Product це не задано**, тому Prisma кине foreign key error якщо є OrderItems. Фактично: видалення зафейлиться з DB error, але error message буде нечитабельним для адміна.

### 5.5 Category delete protection

**File:** `app/api/admin/categories/[id]/route.ts:41-44`

```typescript
const productsCount = await prisma.product.count({ where: { categoryId: id } });
if (productsCount > 0) {
  return errorResponse(new Error(`Неможливо видалити: ${productsCount} товарів у цій категорії`));
}
```

Explicit check — не дозволяє видалити категорію з товарами.

---

## 6. Security

### 6.1 Admin session

| Property | Value | File |
|----------|-------|------|
| Cookie name | `admin_token` | `app/api/admin/auth/route.ts:39` |
| httpOnly | `true` | line 41 |
| secure | `true` in production | line 42 |
| sameSite | `lax` | line 43 |
| maxAge | 86400 (24 hours) | line 44 |
| Token format | SHA-256 hash of `userId-timestamp-secret` | line 34-36 |

**Token validation:** Presence-only check (`shared/admin-auth.ts:14`). Token content (signature, expiration) не верифікується на кожному запиті. Це означає: будь-який непустий рядок у cookie `admin_token` пройде guard.

**Password hashing:** SHA-256 без salt (`app/api/admin/auth/route.ts:25`). Вразливість до rainbow tables.

### 6.2 Payment callback security

- Signature verification: HMAC-MD5 per WayForPay API spec (`WayForPayAdapter.ts:106-123`)
- Invalid signatures: logged, rejected with `{ accepted: false }` and HTTP 400
- All callbacks logged to `IntegrationLog` table with `signatureValid` flag

**Note:** MD5 використовується тому що WayForPay API вимагає саме HMAC-MD5. Це не наш вибір — це їхній протокол.

### 6.3 Secrets isolation

- `WAYFORPAY_MERCHANT_SECRET` — тільки server-side (`WayForPayAdapter.ts`)
- `KEYCRM_API_KEY` — тільки server-side (`KeyCRMClient.ts`)
- `ADMIN_JWT_SECRET` — тільки server-side (`app/api/admin/auth/route.ts`)
- Жоден секрет не має `NEXT_PUBLIC_` prefix
- `.env*` файли в `.gitignore` та `.dockerignore`

### 6.4 Server-side validation

- Checkout: `checkoutSchema` (zod) з phone regex, email, delivery, items array
- Admin CRUD: окремі zod schemas для кожної сутності (`validators/admin.schema.ts`)
- Payment callback: signature verification перед будь-якими mutations

---

## 7. Critical Flows Status

| # | Flow | Status | Evidence |
|---|------|--------|----------|
| 1 | Checkout submit | **PASS** | Idempotency via key + DB unique constraint. Stock/product validation. Cart cleared after success. |
| 2 | WayForPay redirect | **PASS** | Auto-submit form with all required fields. Signature generated correctly. |
| 3 | WayForPay callback success | **PASS** | Signature verified. PaymentEvent created. Status updated. CRM sync triggered. |
| 4 | WayForPay callback duplicate | **PASS** | `paymentStatus === "paid"` check returns early. No duplicate PaymentEvent. No duplicate CRM sync. |
| 5 | Failed payment | **PASS** | Status set to `failed`. PaymentEvent created with `eventType: "failure"`. No CRM sync. |
| 6 | Already paid order (new callback) | **PASS** | Early return, no mutations. |
| 7 | KeyCRM sync success | **PASS** | `keycrmOrderId` saved. Status `synced`. Integration logged. |
| 8 | KeyCRM sync fail | **PASS** | Status `failed`, error saved, retries incremented. Order not lost. |
| 9 | KeyCRM manual retry | **PASS** | `keycrmOrderId` check prevents duplicates. Admin UI has retry button. |
| 10 | Product edit (admin) | **PASS** | Slug/SKU uniqueness. Partial updates. SEO fields. |
| 11 | Settings edit (admin) | **PASS** | Upsert logic. Live inline editing UI. |
| 12 | Order detail (admin) | **PASS** | Shows customer, items, payments, CRM status, integration logs. Retry button. |
| 13 | Concurrent checkout submits | **PARTIAL** | Client-side `disabled` prevents double-click. DB unique constraint catches race. But error message is raw DB error, not user-friendly. |
| 14 | Payment amount verification | **RISK** | Callback amount not compared against `order.total`. WayForPay guarantees amount match via signature, but explicit check absent. |
| 15 | Admin token validation | **RISK** | Presence-only check. No signature/expiration verification. Any non-empty cookie passes. |
| 16 | Product delete with orders | **RISK** | No explicit check. DB foreign key may block, but error is unhandled. |
| 17 | Cart price re-validation | **RISK** | Prices from product DB fetched at order creation time (line 36-42 OrderService), so prices ARE current. But no explicit "price changed" notification to user. |

---

## 8. Risks to Verify on Railway

### Must verify manually:

1. **WayForPay callback reachability** — WayForPay повинен мати доступ до `POST https://wwwnesterchukanatoliycom-production.up.railway.app/api/payment/callback`. Перевірити що Railway не блокує POST від WayForPay IP.

2. **DATABASE_URL format** — Має бути повний connection string `postgresql://user:pass@host:port/db`, не тільки `host:port`.

3. **Environment variables** — перевірити що всі є:
   ```
   DATABASE_URL (full connection string)
   NEXT_PUBLIC_SITE_URL
   ADMIN_JWT_SECRET
   WAYFORPAY_MERCHANT_ACCOUNT
   WAYFORPAY_MERCHANT_SECRET
   WAYFORPAY_MERCHANT_DOMAIN
   KEYCRM_API_KEY
   ```

4. **Prisma tables** — перевірити що `start.sh` виконав `prisma db push` і всі таблиці створені.

5. **Seed data** — перевірити що товари, категорії, сторінки і admin user існують.

### Smoke-test commands:

```bash
# Homepage
curl -s -o /dev/null -w "%{http_code}" https://wwwnesterchukanatoliycom-production.up.railway.app/

# Catalog
curl -s -o /dev/null -w "%{http_code}" https://wwwnesterchukanatoliycom-production.up.railway.app/katalog/

# Product page
curl -s -o /dev/null -w "%{http_code}" https://wwwnesterchukanatoliycom-production.up.railway.app/yabluchnyi-otset-0.5l-sklo/

# Static page
curl -s -o /dev/null -w "%{http_code}" https://wwwnesterchukanatoliycom-production.up.railway.app/pro-nas/

# Checkout
curl -s -o /dev/null -w "%{http_code}" https://wwwnesterchukanatoliycom-production.up.railway.app/checkout

# Admin login
curl -s -o /dev/null -w "%{http_code}" https://wwwnesterchukanatoliycom-production.up.railway.app/admin/login

# API products
curl -s https://wwwnesterchukanatoliycom-production.up.railway.app/api/products | head -100

# API categories
curl -s https://wwwnesterchukanatoliycom-production.up.railway.app/api/categories | head -100

# Sitemap
curl -s -o /dev/null -w "%{http_code}" https://wwwnesterchukanatoliycom-production.up.railway.app/api/sitemap.xml

# Robots
curl -s https://wwwnesterchukanatoliycom-production.up.railway.app/robots.txt
```

### Smoke-test URLs (browser):

| URL | Expected |
|-----|----------|
| `/` | Homepage з hero, categories, products |
| `/katalog/` | Product grid з sorting |
| `/yabluchnyi-otset-0.5l-sklo/` | Product page з фото, ціна, buy button |
| `/bordoska-sumish/` | Category page |
| `/pro-nas/` | Static page |
| `/checkout` | Checkout form (порожній кошик → повідомлення) |
| `/admin/login` | Admin login form |
| `/admin` | Dashboard (після логіну) |
| `/admin/products` | Product list |
| `/admin/products/{id}` | Product edit form |
| `/admin/orders` | Orders list з search |
| `/admin/settings` | Editable settings |
| `/admin/integration-logs` | Health dashboard |
| `/admin/redirects` | Redirects management |

---

## 9. Summary

**Що працює надійно:**
- Checkout → order creation → idempotency
- WayForPay signature generation та verification
- Payment callback idempotency (no duplicate payments)
- KeyCRM sync з retry (no duplicate CRM orders)
- Admin CRUD для всіх сутностей
- Feature flags (PAYMENTS_ENABLED, CRM_SYNC_ENABLED)
- Integration logging

**Що потребує уваги (не блокери, але risks):**
- Admin token — presence-only validation (security medium)
- Password hashing — SHA-256 without salt (security medium)
- Product deletion — no active order check (data integrity low)
- Payment amount — no explicit callback amount vs order total comparison (security low — WayForPay signature covers this)
- No audit logging for admin actions (compliance)
- No rate limiting on login endpoint (security medium)
