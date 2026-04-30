# CHANGELOG — Історія змін проєкту

> Цей файл фіксує ключові зміни, рішення та контекст для наступних сесій.
> Cloud Code має тримати цей файл актуальним після кожної значної зміни.

---

## 2026-04-30 — Покращення логування webhook + override для status_id 21

### Що змінено
- Додано `status_id: 21 → "approval"` в `KEYCRM_STATUS_ID_OVERRIDES` — тепер навіть при холодному кеші (після рестарту) цей статус маппиться коректно і не генерує WARN
- Додано `orderNumber` в усі WARN/ERROR/INFO логи webhook-функцій (`syncOrderStatus`, `syncDeliveryAndTracking`, `syncPaymentStatus`) — тепер у Railway логах видно номер замовлення (K-XXXX) поруч з orderId

### Контекст
- У логах Railway спостерігались повторювані WARN `UNMAPPED status_id=21` для замовлень K-5069, K-5054, K-5067 та інших — причина: cold cache після рестарту, а 21 не було в overrides
- Помилка `"Canceled payments cannot be updated"` (K-5075) — разова, вирішилась автоматично через fallback (нова оплата #3867 прикріплена як paid)

### Файли
- `shared/keycrm-status-map.ts` — додано override 21 → approval
- `app/api/webhooks/keycrm/order-status/route.ts` — orderNumber в логах + типи функцій

---

## 2026-04-29 — Drag-and-drop порядок для категорій і товарів

### Що додано
- Drag-and-drop reorder для категорій в `/admin/categories`
- Drag-and-drop reorder для товарів в `/admin/products`
- Колонка "Порядок" (sortOrder) видима в обох списках
- Кнопка "Зберегти порядок" + попередження про незбережені зміни
- Кнопки вверх/вниз як fallback для мобільних пристроїв
- API endpoints: `PATCH /api/admin/categories/reorder`, `PATCH /api/admin/products/reorder`

### Деталі
- HTML5 Drag and Drop (без зовнішніх бібліотек)
- sortOrder присвоюється як 10, 20, 30... (кратне 10) для зручності вставки між
- Публічний сайт вже сортував по `sortOrder asc` — порядок оновлюється одразу після деплою
- Product.sortOrder вже існував в Prisma schema — schema не змінювалась
- Товари сортуються глобально (не в межах категорії) — відповідно до архітектури де sortOrder одне поле

### Файли
- `app/admin/categories/page.tsx` — DnD + save order
- `app/admin/products/page.tsx` — переписано на client component + DnD + save order
- `app/api/admin/categories/reorder/route.ts` — новий: batch update sortOrder
- `app/api/admin/products/reorder/route.ts` — новий: batch update sortOrder

### Перевірка після деплою
1. /admin/categories — перетягнути, зберегти, refresh — порядок на місці
2. /admin/products — перетягнути, зберегти, refresh — порядок на місці
3. Публічний каталог — порядок відповідає admin sortOrder

---

## 2026-04-28 — Автоматичне списання залишків + безпечний db push

### Списання залишків
- При створенні замовлення `quantity` товару зменшується на замовлену кількість
- Якщо залишок стає 0 — товар автоматично отримує `stockStatus: "out_of_stock"`
- Якщо `quantity` не задано (null) — товар вважається безлімітним, списання не відбувається
- Файл: `services/OrderService.ts`

### Безпечний db push (start.sh)
- Прибрано `--accept-data-loss` з `prisma db push` в `start.sh`
- Тепер Prisma відмовиться від деструктивних змін (drop table/column) замість мовчазного видалення даних
- Це запобігає випадковій втраті налаштувань, payment methods та інших даних при деплої

---

## 2026-04-28 — Приховання COD передплати для замовлень <= 200 грн

### Проблема
"Накладений платіж з передплатою 200 грн" не має сенсу якщо сума замовлення <= 200 грн (передплата = повна сума).

### Рішення
- **Frontend** (`components/checkout/CheckoutForm.tsx`):
  - COD метод прихований якщо `totalPrice() <= COD_PREPAYMENT_AMOUNT` (20000 коп.)
  - Якщо COD вибраний і кошик зменшився <= 200 грн — автоматичний скид на перший доступний метод
- **Backend** (`app/api/checkout/route.ts`):
  - Pre-validation: обчислює total з цін товарів до створення замовлення
  - Відхиляє COD якщо total <= 20000 коп. з повідомленням помилки
  - Console log з totalAmount, paymentMethod, reason (без персональних даних)
- Поріг: `COD_PREPAYMENT_AMOUNT` з `shared/constants.ts` (20000 коп. = 200 грн)
- WayForPay callbacks, KeyCRM sync, інші способи оплати — без змін

---

## 2026-04-28 — Повне керування категоріями + авто-slug для товарів

### Категорії (admin)
- Повний CRUD: створення, редагування, видалення категорій
- Кнопка toggle isActive прямо в списку (вмикати/вимикати видимість на сайті)
- Автогенерація slug з назви (транслітерація) при створенні, з можливістю ручного редагування
- Форма: назва, slug, опис, URL зображення, порядок, isActive, SEO (metaTitle, metaDesc)
- Видалення захищено: не можна видалити категорію з товарами

### Авто-slug для товарів
- При створенні нового товару slug автоматично генерується з назви (українська транслітерація)
- Slug можна відредагувати вручну; кнопка "Генерувати з назви" повертає автогенерацію
- При редагуванні існуючого товару slug не змінюється автоматично (безпека URL)

### Файли
- `app/admin/categories/page.tsx` — переписано: client component з CRUD, toggle active, delete
- `app/admin/categories/CategoryEditForm.tsx` — новий: форма створення/редагування
- `app/admin/categories/new/page.tsx` — новий: сторінка створення категорії
- `app/admin/categories/[id]/page.tsx` — новий: сторінка редагування категорії
- `app/admin/products/[id]/ProductEditForm.tsx` — авто-slug з назви для нових товарів

---

## 2026-04-27 — Fix ERR_TOO_MANY_REDIRECTS + admin reviews

### Root cause
1. **trailingSlash:true** (видалено раніше) залишив кешовані **308 Permanent Redirect** в браузерах: `/api/admin/reviews?status=approved` → 308 → `/api/admin/reviews/?status=approved` → loop. 308 кешується браузером назавжди.
2. **adminFetch** при 401 робив redirect на login → React render loop.
3. **Default filter "pending"** показував 0 відгуків (бо pending порожній).

### Fix
- `adminFetch`: спрощено до простого fetch з `cache: "no-store"` (обходить кешовані 308) і `credentials: "same-origin"`. Без redirect логіки.
- `middleware`: `/api/*` виключено з redirect на login (API повертає JSON 401)
- Reviews page: default filter `"approved"`, error state при failed fetch
- API reviews: підтримка `status=all`

### Урок
**НІКОЛИ не вмикати `trailingSlash: true`** в Next.js App Router якщо є POST API routes. 308 redirects кешуються браузером назавжди і створюють redirect loops навіть після видалення налаштування. Єдине рішення для користувачів — очистити кеш браузера.

---

## 2026-04-27 — Автоматичне видалення зображень з Cloudflare R2

### Аудит
- Storage: Cloudflare R2 (S3-compatible), `shared/storage.ts`
- `deleteFile(url)` вже існував — витягує key з URL і робить S3 DeleteObject
- Використовувався тільки при видаленні окремого image товару
- **НЕ використовувався** при: видаленні product, видаленні blog post, заміні cover image

### Fix
- **Product delete**: перед видаленням отримує всі images → deleteFile кожного з R2
- **Blog delete**: видаляє coverImageUrl з R2
- **Blog update**: при за��іні cover image — видаляє старе з R2
- Всі delete операції non-blocking (catch) — не ламають основний flow

### Файли
- `app/api/admin/products/[id]/route.ts`
- `app/api/admin/blog/[id]/route.ts`

---

## 2026-04-27 — YouTube embed у статтях блогу

- sanitize-html.ts: дозволено iframe тільки для YouTube embed (youtube.com/embed/, youtube-nocookie.com/embed/)
- Non-YouTube iframe видаляються
- YouTube iframe обгортається в responsive container (aspect-ratio: 16/9)
- Event handlers (onclick/onload) прибираються з iframe

---

## 2026-04-27 — Bugfix: blog 404 через слеш на початку slug

### Root cause
Slug статті про яблучний оцет в БД починався зі `/`:
`/naturalnyi-yabluchnyi-otset-koryst-...` замість `naturalnyi-yabluchnyi-otset-koryst-...`
Link генерував `/blog//naturalnyi...` → Next.js не матчив route → 404.

### Fix
- Виправлено slug в БД (прибрано `/` на початку)
- Додано normalizeSlug при збереженні в admin API (POST/PUT)
- Додано decodeURIComponent + trim в blog detail page
- Бордоська суміш працювала бо її slug був без `/`

---

## 2026-04-27 — Блог як керована сторінка + upload обкладинки

### Доробки
- **Сторінка "Блог"** в Pages: seed створює page slug="blog" з showInNav=true
  → "Блог" зʼявляється в header/footer/mobile menu автоматично
  → якщо page вимкнена в /admin/pages → зникає з навігації
- **Upload обкладинки**: file input через існуючий /api/admin/upload → Cloudflare R2
  → більше не потрібно вставляти URL вручну
  → можна видалити завантажене фото кнопкою ×
  → fallback: ручний URL залишається доступним

---

## 2026-04-27 — Блог/статті

### Що додано
- **Prisma model BlogPost**: title, slug, excerpt, content (HTML), coverImageUrl, publishedAt, isPublished, seoTitle, seoDescription, ctaLabel, ctaUrl, sortOrder
- **Admin**: `/admin/blog` — CRUD для статей, auto-slug з кирилиці, CTA кнопка, SEO поля
- **Public**: `/blog/` — список опублікованих статей, `/blog/[slug]/` — окрема стаття
- **CTA button**: в кожній статті можна додати кнопку "Купити яблучний оцет" → /katalog/
- **Sitemap**: published blog posts автоматично включаються
- **SEO**: canonical, og:title, og:description, og:image
- **Seed**: 2 draft-статті (isPublished=false) для прикладу
- **Безпека**: content рендериться через sanitizeHtml (без script/iframe)

### Routes
- `/blog/` — список статей
- `/blog/[slug]/` — окрема стаття
- `/api/admin/blog` — CRUD API
- `/admin/blog` — адмін-панель

### Бізнес-логіка: НЕ змінена
Checkout, WayForPay, KeyCRM, платежі, доставка, auth — без змін.

---

## 2026-04-26 — Mobile-responsive адмін-панель

### Що зроблено
- **Mobile drawer навігація**: hamburger menu → slide-out drawer з усіма пунктами
- **Active page highlight**: поточна сторінка підсвічується зеленим
- **Responsive padding**: `p-4 md:p-6` на main content
- **Таблиці order detail**: додано `overflow-x-auto` + `min-w` для horizontal scroll
- **Desktop**: без змін, sidebar працює як раніше

### Файли
- `components/admin/AdminMobileNav.tsx` — новий client component
- `app/admin/layout.tsx` — додано mobile nav + responsive padding
- `app/admin/orders/[id]/page.tsx` — overflow-x-auto на таблицях

### Бізнес-логіка: НЕ змінена
Checkout, WayForPay, KeyCRM, платежі, статуси, middleware, API — без змін.

---

## 2026-04-26 — Велика сесія: KeyCRM sync, payment methods, SEO, domain migration

### KeyCRM Webhook Status Sync
- **Реалізовано**: webhook endpoint `/api/webhooks/keycrm/order-status`
- **Payload**: KeyCRM шле `{ event: "order.change_order_status", context: { id: ... } }`
- **Стратегія**: webhook як trigger → GET /order/{id}?include=payments,shipping → unified snapshot sync всіх dimensions
- **Dynamic status mapping**: автоматичне отримання статусів з KeyCRM API `/order/status` + кеш 1 годину
- **Manual overrides**: `KEYCRM_STATUS_ID_OVERRIDES` в `shared/keycrm-status-map.ts` для кастомних статусів (19=cancelled, 20=approval)
- **Всі 15 статусів замаплені**: перевірити через `GET /api/admin/keycrm-statuses`

### KeyCRM Payment Sync
- **Критичне правило**: передавати ТІЛЬКИ `payment_method_id` (число), без `payment_method` string — інакше KeyCRM ставить ID 5 "Other"
- **Endpoint списку методів**: `GET /order/payment-method`
- **Discovery**: `GET /api/admin/keycrm-payment-methods?orderId=XXXX`
- **Payment method IDs**:
  - ID 3 = Оплата на рахунок (bank_transfer)
  - ID 8 = 100% WayForPay (card_wayforpay)
  - ID 12 = Передплата 200 грн (cod_prepayment)
  - ID 17 = Накладений платіж з Нової Пошти (COD решта)
- **syncPaymentToKeyCRM**: централізована функція для full payment
- **syncCodPrepaymentToKeyCRM**: спеціальна функція для COD з 2 payments (ID 12 + ID 17)
- **Unpaid invoice**: створюється одразу при checkout (до оплати)
- **Late payment**: знаходить existing not_paid → PUT update → paid
- **Verification**: GET /order/{id}?include=payments після кожної операції

### Способи оплати
- **Модель**: PaymentMethod в Prisma з полями: key, title, description, customerInstruction, checkoutButtonLabel, enabled, requiresOnlinePayment, sortOrder
- **Адмінка**: `/admin/payment-methods` — повне CRUD
- **Checkout**: динамічна кнопка з checkoutButtonLabel
- **Success page**: індивідуальний текст з customerInstruction + шаблонні змінні {orderNumber}, {totalAmount}, {paidAmount}, {prepaymentAmount}, {remainingAmount}
- **3 активні методи**: card_wayforpay, bank_transfer, cod_cash_on_delivery (disabled)

### Критичний баг: trailingSlash:true
- **Проблема**: `trailingSlash: true` в next.config.ts робив 308 redirect для ВСІХ routes включаючи API POST endpoints
- **Наслідок**: WayForPay callback, KeyCRM webhooks, checkout — POST body губився при redirect
- **Рішення**: видалено trailingSlash:true. SEO canonical через alternates.canonical в metadata
- **Урок**: НІКОЛИ не вмикати trailingSlash в Next.js App Router якщо є POST API routes

### SEO
- **sitemap.xml**: `app/sitemap.ts` — Next.js metadata sitemap з реальними даними з БД
- **robots.txt**: `public/robots.txt` з Sitemap reference
- **Canonical URLs**: через alternates.canonical на кожній сторінці
- **GA4**: G-Q96TP2EW2C через next/script afterInteractive
- **Clarity**: whdthaxfvc через next/script src + init

### Domain Migration (nesterchukanatoliy.com)
- **URL priority**: `SITE_URL > NEXT_PUBLIC_SITE_URL > RAILWAY_PUBLIC_DOMAIN > fallback` (shared/url.ts)
- **Homepage CTA**: normalizeInternalLink() — strip old Railway domain з DB settings
- **Auth redirect guard**: auth.ts callback блокує redirect на railway.app
- **PKCE cookie**: явна конфігурація для production domain
- **www → non-www**: через Namecheap DNS redirect (НЕ middleware)
- **Повний checklist**: Cloud.md §22

### Адмінка
- **Logout**: кнопка "Вийти" + endpoint `/api/admin/logout`
- **Session expired**: повідомлення "Сесія закінчилась" при redirect на login
- **adminFetch()**: обгортка що при 401 редіректить на login
- **Admin password**: через env ADMIN_LOGIN + ADMIN_PASSWORD (не в коді)

### Delivery/TTN
- **Shipping include**: `?include=payments,shipping` — єдиний валідний include для доставки
- **TTN extraction**: з `shipping.shipment_payload` array
- **Nova Poshta tracking**: кнопка "Відстежити" + "Скопіювати" для 14-значних ТТН
- **Delivery statuses**: pending, preparing, shipped, in_transit, arrived, delivered, returned, delivery_issue
- **Customer labels**: "Готується до відправки" (approval), "Доставка", "В дорозі", etc.

### Відомі обмеження
- KeyCRM `status` field НЕ повертається в GET /order/{id} — використовується тільки status_id з webhook context і dynamic cache
- `delivery`, `shipments`, `tracking` includes — невалідні, повертають 400
- `payment_method` string field при створенні payment — ламає payment_method_id (ставить ID 5 "Other")

---

## Env Variables (повний список у Cloud.md §3)
Ключові:
- `SITE_URL` / `NEXT_PUBLIC_SITE_URL` = https://nesterchukanatoliy.com
- `AUTH_URL` = https://nesterchukanatoliy.com
- `KEYCRM_PAYMENT_METHOD_CARD_ID` = 8
- `KEYCRM_PAYMENT_METHOD_PREPAYMENT_ID` = 12
- `KEYCRM_PAYMENT_METHOD_COD_ID` = 17
- `KEYCRM_PAYMENT_METHOD_BANK_TRANSFER_ID` = 3
- `KEYCRM_NOVA_POSHTA_SERVICE_ID` = 5
- `ADMIN_LOGIN` / `ADMIN_PASSWORD` — для seed

## Debug Endpoints
- `GET /api/admin/keycrm-statuses` — список статусів + mapping
- `GET /api/admin/keycrm-payment-methods?orderId=XXXX` — методи оплати + payment objects
- `GET /api/admin/keycrm-order-debug?orderId=XXXX` — shipping/delivery/TTN fields
