# Smoke Test Checklist

## Card Payment (WayForPay)

- [ ] Додати товар у кошик
- [ ] Перейти в checkout
- [ ] Заповнити ім'я, телефон
- [ ] Обрати місто через пошук Nova Poshta
- [ ] Обрати відділення/поштомат
- [ ] Обрати "Оплата карткою онлайн"
- [ ] Натиснути "Оплатити"
- [ ] Redirect на WayForPay працює (не localhost)
- [ ] Після оплати — повертає на success page
- [ ] Success page показує номер замовлення
- [ ] Кнопка копіювання номера працює
- [ ] Кнопка "Перевірити статус" веде на /order-status
- [ ] В адмінці замовлення з'явилось із статусом paid
- [ ] В KeyCRM замовлення з'явилось з одержувачем, телефоном, адресою
- [ ] Повторний WayForPay callback не дублює оплату

## COD (Накладений платіж)

- [ ] Увімкнути COD в адмінці → Оплата → cod_cash_on_delivery → Увімкнено
- [ ] У checkout з'явився другий варіант оплати
- [ ] Обрати "Оплата при отриманні"
- [ ] Натиснути "Оформити"
- [ ] WayForPay НЕ викликається
- [ ] Success page показує "Оплата при отриманні" з іконкою Package
- [ ] В адмінці замовлення має paymentStatus = "cod_pending"
- [ ] В KeyCRM замовлення створилось із payment method "cash_on_delivery"

## Payment Methods Admin

- [ ] /admin/payment-methods — обидва методи видимі
- [ ] Вимкнути card — checkout показує тільки COD
- [ ] Вимкнути COD — checkout показує тільки card
- [ ] Увімкнути обидва — checkout показує radio buttons
- [ ] Змінити назву методу — зміна видима в checkout
- [ ] Seed повторно не перезаписує змінені назви

## Order Status (/order-status)

- [ ] Ввести правильний номер + телефон → бачить замовлення
- [ ] Ввести неправильний телефон → "Замовлення не знайдено"
- [ ] Ввести неправильний номер → "Замовлення не знайдено"
- [ ] Для card order показує "Оплачено"
- [ ] Для COD order показує "Оплата при отриманні"
- [ ] Не показує crm_sync_status, KeyCRM IDs, integration logs

## KeyCRM Sync

- [ ] Card order синхронізується після оплати
- [ ] COD order синхронізується одразу після створення
- [ ] Retry не створює дубль замовлення
- [ ] Delivery fields (city, warehouse, recipient) видимі в KeyCRM
- [ ] manager_comment містить повну адресу доставки

## Refund/Cancel (WayForPay)

- [ ] Card order paid → WayForPay refund callback → paymentStatus = failed/refunded
- [ ] KeyCRM financial payment record cancelled (not just comment)
- [ ] keycrmPaymentId saved after order sync → used for refund
- [ ] Повторний refund callback не дублює PaymentEvent/фінансову корекцію
- [ ] COD order НЕ реагує на WayForPay callbacks

## Critical Guards

- [ ] COD order → createPaymentForOrder returns null (no WayForPay call)
- [ ] COD order → no invoice/paymentUrl created
- [ ] COD order → WayForPay callback ignored (no matching order with online payment)
- [ ] Duplicate refund callback → idempotent (synced + refunded = skip)

## Recent Orders (localStorage)

- [ ] Після success page номер з'являється в localStorage
- [ ] Не дублюється при refresh
- [ ] Максимум 10 записів

## Security

- [ ] /order-status не показує чужі замовлення
- [ ] /api/admin/* повертає 401 без admin_token
- [ ] /api/cron/* повертає 401 без secret
- [ ] CRON_SECRET окремий від ADMIN_JWT_SECRET

## Environment Variables

```
DATABASE_URL          — PostgreSQL (required)
SITE_URL              — public domain (required)
ADMIN_JWT_SECRET      — admin auth (required)
CRON_SECRET           — cron auth (recommended, fallback to ADMIN_JWT_SECRET)
KEYCRM_API_KEY        — KeyCRM sync
KEYCRM_SOURCE_ID      — KeyCRM source (default: 1)
WAYFORPAY_MERCHANT_ACCOUNT — payment
WAYFORPAY_MERCHANT_SECRET  — payment
WAYFORPAY_MERCHANT_DOMAIN  — payment
NOVAPOSHTA_API_KEY    — delivery
S3_ENDPOINT           — images
S3_ACCESS_KEY         — images
S3_SECRET_KEY         — images
S3_BUCKET             — images
S3_PUBLIC_URL         — images
CRM_SYNC_ENABLED      — true/false
PAYMENTS_ENABLED      — true/false
```
