# Тестовий сайт (TestoviySite) — Dev Workflow

## Environments

| | Production | TestoviySite | Local |
|---|---|---|---|
| **URL** | nesterchukanatoliy.com | staging-web-staging-2eaf.up.railway.app | localhost:3000 |
| **Railway env** | production | TestoviySite | — |
| **Railway service** | www.nesterchukanatoliy.com | TestoviySite | — |
| **Branch** | main | main (або feature/*) | feature/* |
| **Database** | Railway PostgreSQL (prod) | Railway PostgreSQL (окрема) | Local PostgreSQL |
| **WayForPay** | Live | Mock (auto-paid, alert) | Mock |
| **KeyCRM** | Live | Disabled | Disabled |
| **Analytics** | GA + Clarity | Disabled | Disabled |
| **SEO robots** | index, follow | noindex, nofollow | noindex, nofollow |
| **Banner** | Немає | "ТЕСТОВИЙ САЙТ..." (жовтий) | "ТЕСТОВИЙ САЙТ..." |

---

## Env Variables для TestoviySite

Ключові відмінності від production:

```env
APP_ENV=staging
NEXT_PUBLIC_APP_ENV=staging
PAYMENTS_ENABLED=false
CRM_SYNC_ENABLED=false
KEYCRM_STATUS_SYNC_ENABLED=false
KEYCRM_API_KEY=disabled
WAYFORPAY_MERCHANT_ACCOUNT=disabled
WAYFORPAY_MERCHANT_SECRET=disabled
WAYFORPAY_MERCHANT_DOMAIN=disabled
PROD_DATABASE_URL=<production postgres PUBLIC url>   # для кнопки "Синхронізувати"
```

Залишити без змін:
- `NOVAPOSHTA_API_KEY` — read-only пошук вiддiлень, безпечно
- `S3_*` — prod bucket (фото однакові на обох сайтах)

---

## Синхронізація даних з production

### Через адмінку (рекомендовано)
1. Відкрити тестовий сайт → `/admin`
2. На Dashboard натиснути **"Синхронізувати"** (жовтий блок)
3. Підтвердити → товари, категорії, фото, сторінки, налаштування скопіюються з production
4. Замовлення НЕ копіюються

### Через термінал
```bash
railway environment link TestoviySite && railway service link Postgres-cQGI
STAGING_URL=$(railway variables --json | jq -r '.DATABASE_PUBLIC_URL')
railway environment link production && railway service link Postgres
PROD_URL=$(railway variables --json | jq -r '.DATABASE_PUBLIC_URL')
PROD_DATABASE_URL="$PROD_URL" DATABASE_URL="$STAGING_URL" npx tsx scripts/sync-to-staging.ts
```

---

## PAYMENTS_MODE

| Режим | Env | Поведінка |
|---|---|---|
| `live` | `PAYMENTS_MODE=live` або не задано + `PAYMENTS_ENABLED=true` | Реальний WayForPay |
| `mock` | `PAYMENTS_MODE=mock` або `PAYMENTS_ENABLED=false` | Auto-paid через shared flow, alert |
| `sandbox` | `PAYMENTS_MODE=sandbox` | Тестові WayForPay credentials (майбутнє) |
| `disabled` | `PAYMENTS_MODE=disabled` | Платежі повністю вимкнені |

Centralized config: `shared/features.ts`

---

## Mock-оплата (тестовий режим)

### При оформленні замовлення (checkout)
1. Натискаєш "Оплатити" → замовлення створюється
2. `OrderService.applyMockPayment()` — проходить той самий шлях що й реальний callback:
   - Створює PaymentEvent (provider: "mock")
   - Оновлює paymentStatus через OrderRepository
   - Записує StatusHistory
   - Тригерить email notification (для тестування шаблонів)
3. Frontend показує alert: **"ТЕСТОВИЙ РЕЖИМ"**
4. Redirect на success page

### Ручне тестування сценаріїв (адмінка)
В адмінці на сторінці замовлення є блок **"Тестова оплата"** з 3 кнопками:
- **Оплата пройшла** → paymentStatus: paid / partial_paid
- **Оплата не пройшла** → paymentStatus: failed / prepayment_failed
- **Повернення коштів** → paymentStatus: refunded

API: `POST /api/admin/test-payments/mock-callback` (staging only, adminGuard)
Body: `{ "orderId": "...", "action": "success|failure|refund" }`

### Що НЕ тестується в mock
- Реальний WayForPay redirect/форма
- Підпис WayForPay callback
- Для повного тесту payment form — використати `PAYMENTS_MODE=sandbox` з тестовими credentials WayForPay (майбутнє)

---

## R2 / Cloudflare (зображення)

Staging використовує ті самі S3/R2 credentials і URL що й production. Це зроблено свідомо:
- Фото ідентичні на обох сайтах
- Staging призначений для тестування коду, не для масового редагування зображень
- Якщо тестуєш upload/delete через адмінку — будь обережний, бо R2 bucket shared

---

## Email

Email на staging **працює** (Resend API key від production). Це зроблено свідомо для тестування шаблонів листів. При тестах використовуй власну пошту.

---

## PROD_DATABASE_URL — чому це безпечно

`PROD_DATABASE_URL` є у staging env vars для кнопки "Синхронізувати" в адмінці.

**Захисти:**
1. API endpoint `/api/admin/sync-from-production` перевіряє `isStaging` — на production повертає 403
2. Перевірка `DATABASE_URL !== PROD_DATABASE_URL` — abort якщо однакові
3. `adminGuard` — потрібен адмін логін
4. `prodPrisma` використовується **тільки для read** (findMany/findFirst)
5. Всі write операції йдуть через `prisma` (staging DB)

---

## Як створити Staging на Railway

### Крок 1: Створити environment
Railway Dashboard > Project > New Environment > "staging"

### Крок 2: Додати PostgreSQL
У staging environment > Add Database > PostgreSQL

### Крок 3: Налаштувати env variables
Скопіювати з production, змінити згідно таблиці вище.

Згенерувати нові секрети:
```bash
openssl rand -hex 32  # для ADMIN_JWT_SECRET
openssl rand -hex 32  # для CRON_SECRET
```

### Крок 4: Deploy branch
Railway > staging environment > Service Settings > Deploy Branch > обрати потрібну feature гілку

### Крок 5: Ініціалізувати БД
```bash
railway link  # обрати staging environment
railway run npx prisma db push
railway run npx tsx prisma/seed.ts
```

---

## Git Workflow

```
main ────────────────── production (auto-deploy)
  │
  └── TestovaGilka ──── TestoviySite (auto-deploy)
```

### Процес розробки

1. Працюєш у гілці `TestovaGilka` (вона вже створена)
2. Комітиш, пушиш → деплоїться тільки TestoviySite
3. Тестуєш на тестовому сайті
4. Все ок → merge в main → деплоїться production
5. Повертаєшся в TestovaGilka, продовжуєш

```bash
git checkout TestovaGilka
# ... робота ...
git push

# Готово до production:
git checkout main
git merge TestovaGilka
git push origin main

# Назад до роботи:
git checkout TestovaGilka
```

---

## Як перевірити ізоляцію Staging

### 1. База даних — окрема
```bash
# У staging:
railway run --environment staging -- npx prisma studio
# Перевірити: orders порожні або тестові, не production
```

### 2. WayForPay — відключений
- Оформити замовлення з оплатою карткою
- Замовлення створюється, але payment URL = null
- В Railway logs: "Payments disabled, skipping"

### 3. KeyCRM — відключений
- Оформити замовлення
- В Railway logs: НЕ має бути "KeyCRM outbound request"
- В БД: keycrmSyncStatus має бути "pending" (не "synced")

### 4. Analytics — відключені
- Відкрити staging URL
- DevTools > Network: НЕ має бути запитів до clarity.ms або googletagmanager.com

### 5. SEO — закрито від індексації
- View Source > шукати `<meta name="robots"` > має бути "noindex, nofollow"

### 6. Banner — видимий
- Зверху сторінки: жовтий banner "ТЕСТОВИЙ САЙТ..."
- В адмінці: теж видимий

---

## Локальна розробка

### Створити .env.local
```env
DATABASE_URL=postgresql://localhost:5432/nesterchukanatoliy_dev
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_APP_ENV=staging
APP_ENV=local
PAYMENTS_ENABLED=false
CRM_SYNC_ENABLED=false
KEYCRM_API_KEY=
WAYFORPAY_MERCHANT_ACCOUNT=
WAYFORPAY_MERCHANT_SECRET=
WAYFORPAY_MERCHANT_DOMAIN=
ADMIN_JWT_SECRET=local-dev-secret-change-me
CRON_SECRET=local-cron-secret-change-me
NOVAPOSHTA_API_KEY=<від production — read-only, безпечно>
```

### Запуск
```bash
# Локальна PostgreSQL (Docker)
docker run -d --name pg-dev -p 5432:5432 -e POSTGRES_DB=nesterchukanatoliy_dev -e POSTGRES_PASSWORD=dev postgres:17

# Або через brew
brew install postgresql@17 && brew services start postgresql@17
createdb nesterchukanatoliy_dev

# Ініціалізація
npm run db:push
npm run db:seed
npm run dev
```

---

## Як відкотитися

Safety commit перед staging змінами: `4c614b5`

```bash
git reset --hard 4c614b5
git push --force-with-lease origin main
```

---

## Ризики

| Ризик | Контроль |
|---|---|
| Staging з prod credentials | Чеклист env vars: PAYMENTS_ENABLED=false, CRM_SYNC_ENABLED=false, порожні ключі |
| Feature branch зламала prod | Тестувати на staging перед merge в main |
| Staging БД переповнена | Періодично: `prisma db push --force-reset` + seed |
| Prod і staging R2 перемішались | Один bucket — зображення не критичні |
| NEXT_PUBLIC_* забились в build | Railway rebuild для кожного environment окремо |
