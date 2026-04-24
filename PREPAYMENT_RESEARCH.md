# Prepayment / Deposit Research Report

**Date:** 2026-04-24
**Source:** `internet-shop-backend/` (Python FastAPI)
**Status:** Read-only audit. No code changes.

---

## 1. Current Old Implementation Summary

The old system is a **separate Python FastAPI microservice** that handles "Deposit 300 UAH" prepayment flow for Horoshop orders. It:

- Creates a WayForPay **invoice** (not a direct payment form) via `CREATE_INVOICE` API
- Stores deposit state in a **local SQLite** database
- After successful payment, **finds the order in KeyCRM** (with retry loop) and attaches a 300 UAH payment
- Cancels any existing "full amount" placeholder payment in KeyCRM
- Sends Telegram notifications on success/failure
- Has a result page showing payment status

**Key:** The order already exists in KeyCRM (created by Horoshop) BEFORE the deposit payment. The old backend only adds the 300 UAH payment record to that existing KeyCRM order.

---

## 2. Old Flow Diagram

```
Horoshop creates order in KeyCRM
    ↓
User sees "Оплата при отриманні з передплатою 300 грн"
    ↓
Horoshop redirects to → GET /deposit/start?order_id=HS123&customer_name=...
    ↓
HTML page with JS → POST /api/deposit/create
    ↓
Backend creates DepositPayment (SQLite, status: CREATED)
    ↓
Calls WayForPay API: CREATE_INVOICE (amount: 300 UAH)
    ↓
Gets invoice_url → JS redirects user to WayForPay
    ↓
User pays → WayForPay POST /api/wfp/callback (signed)
    ↓
Backend validates HMAC-MD5 signature
    ↓
If APPROVED:
  → Mark deposit PAID
  → Find order in KeyCRM (10 retries × 3 sec)
  → Cancel placeholder full payment in KeyCRM
  → Create 300 UAH payment in KeyCRM (status: paid)
  → Append comment: "Передплату 300 грн отримано"
  → Telegram: "✅ Deposit paid"
    ↓
If REFUND/REVERSE:
  → Mark deposit CANCELLED
  → Find matching payment in KeyCRM by description
  → Cancel that payment in KeyCRM
  → Append comment: "Платіж WayForPay відкликано"
  → Telegram: "⚠️ Rollback"
    ↓
Return WayForPay ACK (signed response)
    ↓
User → GET /deposit/result?order_id=HS123 → status page
```

---

## 3. Files Inspected

| File | Purpose |
|------|---------|
| `app/main.py` | FastAPI app, routes, startup, SQLite init |
| `app/core/config.py` | All env vars, amounts (300 UAH), TTL |
| `app/routes/deposit.py` | HTTP routes: create, retry, callback, start page, result page |
| `app/services/deposits/service.py` | Business logic: create/get deposit, mark paid/failed, product building |
| `app/services/deposits/workflow.py` | Orchestration: create flow, callback handling, KeyCRM lookup+update |
| `app/services/deposits/repository.py` | SQLite persistence, CRUD |
| `app/domain/deposits/models.py` | DepositPayment model, ProductLine |
| `app/domain/deposits/enums.py` | DepositStatus enum: CREATED, PENDING, PAID, FAILED, EXPIRED, CANCELLED |
| `app/services/providers/wayforpay.py` | WayForPay CREATE_INVOICE, signature, amount formatting |
| `app/services/providers/base.py` | Provider protocol interface |
| `app/services/wayforpay/validator.py` | Callback signature validation, response signature |
| `app/services/keycrm_service.py` | KeyCRM: find order, create/cancel payment, append comment |
| `app/schemas/deposits.py` | Request/response Pydantic schemas |
| `.env.example` | All environment variables |

---

## 4. Weak Points / Hacks

| # | Issue | Risk |
|---|-------|------|
| 1 | **Separate microservice** — requires own Railway service, own deploy, own SQLite DB | Operational complexity, data split |
| 2 | **SQLite in container** — ephemeral on Railway, data lost on redeploy | Data loss of deposit records |
| 3 | **10× retry loop** to find KeyCRM order (30 sec total) — blocks response | Timeout, race condition |
| 4 | **No strict payment method check** — if code/name not provided, deposit proceeds anyway | Security hole |
| 5 | **Payment matching by description text** — fragile; if description format changes, cancel fails | Orphaned payments |
| 6 | **4 different KeyCRM endpoint attempts** for payment update — tries PATCH/PUT on 2 URLs | Masking real API behavior |
| 7 | **5 different search strategies** to find order in KeyCRM | Compensates for Horoshop→KeyCRM sync delay |
| 8 | **Amount normalization** — custom decimal formatting ("300.00"→"300") critical for signature | Signature mismatch bugs |
| 9 | **No duplicate callback protection** beyond status check | Potential double payment in KeyCRM |
| 10 | **Telegram as primary monitoring** — no structured logs or admin UI | Not scalable |

---

## 5. What Can Be Reused (Logic Only)

| Component | What to take |
|-----------|-------------|
| WayForPay `CREATE_INVOICE` flow | API payload structure, signature calculation |
| Amount normalization | `_fmt_decimal()` / `_normalize_amount()` for trailing zero stripping |
| Callback signature validation | Same HMAC-MD5 approach (already in our WayForPayAdapter) |
| Response ACK format | `{orderReference, status: "accept", time, signature}` (already implemented) |
| KeyCRM payment create/cancel | `create_order_payment()`, `cancel_order_payment()` patterns |
| Refund rollback flow | Find payment by description → cancel |

---

## 6. What Should NOT Be Reused

| Component | Why |
|-----------|-----|
| Separate Python microservice | We already have Next.js API routes |
| SQLite persistence | We have PostgreSQL + Prisma |
| HTML-rendering start/result pages | We have React pages |
| Telegram notifications | Use structured logs + admin UI |
| 10× retry loop for KeyCRM | Our order is created locally BEFORE payment — no need to search |
| 5 search strategies for KeyCRM order | Same reason — we control order creation |
| Payment method fuzzy matching | We have PaymentMethod model with exact keys |
| Horoshop-specific order_reference format | We have our own order numbering |

---

## 7. Recommended New Architecture

### Use existing infrastructure

The new prepayment does NOT need a separate backend. All components already exist:

| Need | Already have |
|------|-------------|
| WayForPay integration | `WayForPayAdapter` with `createPaymentSession()` |
| Payment callback | `/api/payment/callback` with signature validation |
| Order creation | `OrderService.createOrder()` |
| KeyCRM sync | `KeyCRMService.createOrder()` + `attachPayment()` |
| Payment methods | `PaymentMethod` model + admin UI |
| Database | PostgreSQL + Prisma (not ephemeral SQLite) |

### New payment method: `cod_with_prepayment`

Add a third PaymentMethod:
```
key: "cod_with_prepayment"
title: "Накладений платіж з передплатою"
description: "Передплата {amount} грн, решта — при отриманні"
requiresOnlinePayment: true  (WayForPay invoice for prepayment amount)
```

### Prepayment amount: admin-configurable

Store as Setting: `prepayment_amount = 20000` (200 UAH in kopiyky, editable in admin).

---

## 8. Proposed Flow for COD Prepayment

```
User selects "Накладений платіж з передплатою 200 грн"
    ↓
Checkout creates local Order:
  - paymentMethod: "cod_with_prepayment"
  - paymentStatus: "prepayment_pending"
  - total: full order amount
  - prepaymentAmount: 200 UAH (from settings)
    ↓
WayForPay session created for PREPAYMENT AMOUNT ONLY (200 UAH, not full total)
    ↓
User pays 200 UAH on WayForPay
    ↓
Callback validates → paymentStatus: "prepayment_paid"
    ↓
PaymentEvent created (amount: 200 UAH, type: "prepayment")
    ↓
KeyCRM sync:
  - Order created with full total
  - Payment attached: 200 UAH, status: paid, description: "Передплата 200 грн"
  - Comment: "Передплату 200 грн отримано. Решта при отриманні."
    ↓
Success page: "Передплату отримано! Решта X грн — при отриманні."
```

### If payment fails/cancelled:
- Order stays with `paymentStatus: "prepayment_pending"`
- User can retry from order-status page
- No KeyCRM sync until prepayment confirmed

### If refund after payment:
- Same flow as current card refund
- PaymentEvent recorded
- KeyCRM payment cancelled via keycrmPaymentId

---

## 9. KeyCRM Impact

| Field | Card payment | COD | COD + Prepayment |
|-------|-------------|-----|------------------|
| payments[0].method | `card` | `cash_on_delivery` | `WayForPay` |
| payments[0].amount | Full total | Full total | **200 UAH** (prepayment only) |
| payments[0].status | `paid` | `not_paid` | `paid` |
| payments[0].description | WayForPay ID | Накладений платіж | "Передплата 200 грн" |
| payments[1] (optional) | — | — | `cash_on_delivery`, amount: rest, status: `not_paid` |
| manager_comment | Order + delivery info | Same | Same + "Решта {X} грн при отриманні" |

---

## 10. Risks and Edge Cases

| Scenario | Risk | Mitigation |
|----------|------|------------|
| User closes WayForPay page | Order stays prepayment_pending | Retry link on order-status page |
| Callback before user redirect | Normal — callback is source of truth | Order updated regardless of redirect |
| Duplicate callback | Must not create duplicate PaymentEvent | Idempotency: check paymentStatus before processing |
| Refund after prepayment | Must cancel 200 UAH in KeyCRM, not full amount | Use amount from PaymentEvent, not order total |
| Admin changes prepayment amount | New orders use new amount; old orders keep their amount | Store prepaymentAmount per order, not just in settings |
| Prepayment amount > order total | Invalid state | Validate: prepaymentAmount <= order.total |
| WayForPay creates invoice with different amount | Signature mismatch or financial error | Validate callback amount === prepaymentAmount |

---

## 11. Implementation Plan (Future Task)

### Phase 1: Database + Settings
- [ ] Add to Settings: `prepayment_amount` (default: 20000 kopiyky = 200 UAH)
- [ ] Add to Order schema: `prepaymentAmount Int?`, `prepaymentStatus String?`
- [ ] Add PaymentMethod seed: `cod_with_prepayment`
- [ ] Admin: editable prepayment amount in Payment Methods or Settings

### Phase 2: Checkout + WayForPay
- [ ] Checkout UI: third radio button with dynamic amount from settings
- [ ] Checkout API: for `cod_with_prepayment` create WayForPay session with prepayment amount (not total)
- [ ] WayForPay callback: validate amount === order.prepaymentAmount
- [ ] On success: `prepaymentStatus: "paid"`, `paymentStatus: "prepayment_paid"`
- [ ] Success page: "Передплату {X} грн отримано. Решта {Y} грн при отриманні."

### Phase 3: KeyCRM Sync
- [ ] KeyCRMMapper: for `cod_with_prepayment` create 2 payment records:
  1. WayForPay prepayment (paid, amount: 200)
  2. Cash on delivery remainder (not_paid, amount: total - 200)
- [ ] Manager comment: include prepayment info
- [ ] Refund: cancel only the 200 UAH payment, not the full amount

### Phase 4: Polish
- [ ] Order-status page: show prepayment status separately
- [ ] Admin order detail: show prepayment amount + status
- [ ] Retry prepayment from order-status if failed

---

## Conclusions

### 1. Can integrate without separate backend?
**YES.** All required components already exist in the current Next.js site. No need for separate Python service.

### 2. Recommended flow
**COD with prepayment as third PaymentMethod** → WayForPay invoice for partial amount → callback confirms → KeyCRM gets 2 payment records (prepayment paid + COD remainder unpaid).

### 3. Risk assessment
**LOW.** The current WayForPayAdapter, payment callback, and KeyCRM sync already handle the hard parts. Main addition is: partial amount in WayForPay session + dual payment records in KeyCRM.

### 4. What to implement next
Add `cod_with_prepayment` PaymentMethod with configurable amount. Estimated effort: 1-2 days for a senior developer familiar with the codebase. No architectural changes needed.
