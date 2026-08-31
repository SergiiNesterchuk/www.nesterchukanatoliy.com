# Тестовий сайт (TestoviySite) — Dev Workflow

Середовища, деплой і Git-процес. Решта документації — [docs/README.md](docs/README.md).
Логіка застосунку: [docs/CHECKOUT.md](docs/CHECKOUT.md) ·
[docs/STOCK_VALIDATION.md](docs/STOCK_VALIDATION.md) ·
[docs/SLUG_NAMESPACE.md](docs/SLUG_NAMESPACE.md)

## Environments

| | Production | TestoviySite | Local |
|---|---|---|---|
| **URL** | nesterchukanatoliy.com | staging-web-staging-2eaf.up.railway.app | localhost:3000 |
| **Railway env** | production | TestoviySite | — |
| **Railway service** | www.nesterchukanatoliy.com | TestoviySite | — |
| **Branch** | main | TestovaGilka | будь-яка локальна |
| **Database** | Railway PostgreSQL (prod) | Railway PostgreSQL (окрема) | Local PostgreSQL |
| **WayForPay** | Live | Mock (auto-paid, alert) | Mock |
| **KeyCRM** | Live | Disabled | Disabled |
| **Analytics** | GA + Clarity | Disabled | Disabled |
| **SEO robots** | index, follow | noindex, nofollow | noindex, nofollow |
| **Banner** | Немає | "ТЕСТОВИЙ САЙТ..." (жовтий) | "ТЕСТОВИЙ САЙТ..." |

---

## Branch → Deployment mapping

Фактична конфігурація Railway deployment triggers (authoritative, перевірено через Railway API):

```
GitHub branch: TestovaGilka  →  Railway env TestoviySite  →  service TestoviySite
                                 APP_ENV=staging · staging PostgreSQL
                                 WayForPay Mock · KeyCRM Disabled
                                 staging-web-staging-2eaf.up.railway.app

GitHub branch: main          →  Railway env production   →  service www.nesterchukanatoliy.com
                                 APP_ENV=production (default) · production PostgreSQL
                                 WayForPay Live · KeyCRM Live
                                 nesterchukanatoliy.com
```

### Trigger isolation

У проєкті рівно **два** deployment triggers, по одному на середовище:

| Trigger | Наслідок |
|---|---|
| `TestovaGilka` → env `TestoviySite` / service `TestoviySite` | push у `TestovaGilka` деплоїть **тільки staging** |
| `main` → env `production` / service `www.nesterchukanatoliy.com` | push у `main` деплоїть **тільки production** |

- push у `TestovaGilka` **ніколи** не запускає production deploy;
- push у `main` **ніколи** не запускає staging deploy;
- production-домени (`nesterchukanatoliy.com`, `www.nesterchukanatoliy.com`) прикріплені
  лише до production service;
- staging має власний `DATABASE_URL` і не пише в production БД.

Раніше існував третій, **orphan** trigger `main → env production → service TestoviySite`.
Сервіс `TestoviySite` не має інстансу в production environment, тож trigger ніколи не
давав деплою, але створював плутанину в конфігурації. **Видалений.** Якщо в Railway
знову з'явиться cross-environment trigger — це помилка конфігурації.

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

## PROD_DATABASE_URL — свідомий нюанс

`PROD_DATABASE_URL` присутній у staging env vars для кнопки «Синхронізувати» в адмінці
(копіює каталог, сторінки й налаштування production → staging). Це єдине місце, де
staging взагалі бачить production БД.

**Захисти (application-level):**
1. `/api/admin/sync-from-production` перевіряє `isStaging` — на production повертає 403
2. Перевірка `DATABASE_URL !== PROD_DATABASE_URL` — abort, якщо однакові
3. `adminGuard` — потрібен адмін логін
4. `prodPrisma` викликається **тільки на читання** (`findMany` / `findFirst`)
5. Усі write-операції (`deleteMany` / `create`) йдуть через staging-клієнт

**Known nuance (не баг, свідоме рішення):**
це **не** database-level read-only credential. Staging володіє повноцінним connection
string до production БД, а read-only гарантується **лише кодом**. Тобто будь-хто з
доступом до staging env vars технічно має повний доступ до production даних, і помилка
в коді синхронізації теоретично могла б записати в production.

Повне закриття потребувало б окремої PostgreSQL-ролі з `GRANT SELECT` і окремого
connection string. Наразі не реалізовано. Якщо змінюєте `sync-from-production` —
переконайтесь, що `prodPrisma` не отримав жодного write-виклику.

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
Railway > TestoviySite environment > Service Settings > Deploy Branch > `TestovaGilka`
(production service лишається на `main` — не змінювати)

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

1. Працюєш у гілці `TestovaGilka` — жодних feature-змін напряму в `main`
2. Комітиш, пушиш → деплоїться **тільки** TestoviySite
3. Тестуєш вручну на тестовому сайті
4. Отримуєш підтвердження → fast-forward merge у `main` → деплоїться production
5. Production smoke check
6. Синхронізуєш `TestovaGilka` з `main` перед наступною задачею

```bash
git checkout TestovaGilka
git pull
# ... робота, commit ...
git push origin TestovaGilka        # → staging deploy

# Після ручного тесту й погодження:
git checkout main
git merge --ff-only TestovaGilka    # історія лишається лінійною
git push origin main                # → production deploy

# Синхронізація перед наступною задачею:
git checkout TestovaGilka
git merge main                      # main == TestovaGilka
```

**Інваріант між задачами:** `main == TestovaGilka == origin/main == origin/TestovaGilka`.
Якщо гілки розійшлись — спершу вирівняти, потім починати нову роботу.

`--ff-only` навмисне: якщо fast-forward неможливий, значить у `main` є коміти, яких
немає в тестовій гілці — це треба розібрати вручну, а не заливати merge-комітом.
Force push не використовується.

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

Історія `main` — лінійна й опублікована, тому відкат робиться **новим комітом**, а не
переписуванням історії. Force push у `main` не використовується.

```bash
# Відкотити один проблемний коміт:
git checkout main
git revert <commit>
git push origin main          # → production redeploy

# Відкотити цілий діапазон:
git revert --no-commit <old>..<new>
git commit -m "revert: ..."
git push origin main
```

Швидша альтернатива без git: у Railway Dashboard → production → Deployments →
обрати попередній успішний деплой → **Redeploy**. Це повертає працюючу версію за хвилини,
але не змінює код — після цього все одно потрібен `git revert`, інакше наступний push у
`main` знову задеплоїть зламану версію.

Після відкату не забути синхронізувати `TestovaGilka` з `main`.

---

## Ризики

| Ризик | Контроль |
|---|---|
| Staging з prod credentials | Чеклист env vars: PAYMENTS_ENABLED=false, CRM_SYNC_ENABLED=false, порожні ключі |
| Feature branch зламала prod | Тестувати на staging перед merge в main |
| Staging БД переповнена | Періодично: `prisma db push --force-reset` + seed |
| Prod і staging R2 перемішались | Один bucket — зображення не критичні |
| NEXT_PUBLIC_* забились в build | Railway rebuild для кожного environment окремо |
