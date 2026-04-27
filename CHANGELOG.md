# CHANGELOG — Історія змін проєкту

> Цей файл фіксує ключові зміни, рішення та контекст для наступних сесій.
> Cloud Code має тримати цей файл актуальним після кожної значної зміни.

---

## 2026-04-27 — Авт��матичне видалення зображень з Cloudflare R2

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
