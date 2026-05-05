# Staging / Dev Workflow

## Environments

| | Production | Staging | Local |
|---|---|---|---|
| **URL** | nesterchukanatoliy.com | staging-xxx.up.railway.app | localhost:3000 |
| **Branch** | main | feature/* | feature/* |
| **Database** | Railway PostgreSQL (prod) | Railway PostgreSQL (staging) | Local PostgreSQL |
| **WayForPay** | Live (PAYMENTS_ENABLED=true) | Disabled (PAYMENTS_ENABLED=false) | Disabled |
| **KeyCRM** | Live (CRM_SYNC_ENABLED=true) | Disabled (CRM_SYNC_ENABLED=false) | Disabled |
| **Analytics** | Google Analytics + Clarity | Disabled | Disabled |
| **SEO robots** | index, follow | noindex, nofollow | noindex, nofollow |
| **Banner** | Немає | "ТЕСТОВИЙ САЙТ..." (жовтий) | "ТЕСТОВИЙ САЙТ..." |

---

## Env Variables для Staging

Скопіювати з production і змінити:

```env
APP_ENV=staging
NEXT_PUBLIC_APP_ENV=staging
PAYMENTS_ENABLED=false
CRM_SYNC_ENABLED=false
KEYCRM_STATUS_SYNC_ENABLED=false
KEYCRM_API_KEY=
KEYCRM_BASE_URL=
KEYCRM_WEBHOOK_SECRET=
WAYFORPAY_MERCHANT_ACCOUNT=
WAYFORPAY_MERCHANT_SECRET=
WAYFORPAY_MERCHANT_DOMAIN=
NEXT_PUBLIC_SITE_URL=https://<staging-url>.up.railway.app
SITE_URL=https://<staging-url>.up.railway.app
AUTH_URL=https://<staging-url>.up.railway.app
ADMIN_JWT_SECRET=<new-random-staging-secret>
CRON_SECRET=<new-random-staging-secret>
DATABASE_URL=<staging-postgres-url>
```

Залишити без змін:
- `NOVAPOSHTA_API_KEY` — read-only пошук вiддiлень, безпечно
- `S3_*` — можна використовувати prod bucket (зображення)

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
main ────────────────────── production (auto-deploy)
  └── feature/xxx ────────── staging (manual deploy branch switch)
```

### Процес розробки

1. `git checkout -b feature/назва-фічі`
2. Розробка і commit
3. Push: `git push origin feature/назва-фічі`
4. В Railway staging: встановити deploy branch на `feature/назва-фічі`
5. Тестування на staging URL
6. Створити PR: `feature/назва-фічі` > `main`
7. Merge > production auto-deploy

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
