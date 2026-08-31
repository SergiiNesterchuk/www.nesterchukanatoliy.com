# Документація

Навігатор по технічній документації проєкту.

## Основне

| Документ | Про що |
|---|---|
| [../STAGING.md](../STAGING.md) | Середовища, Railway mapping, deployment triggers, Git workflow, ізоляція staging/production, mock-платежі, синхронізація даних |
| [CHECKOUT.md](CHECKOUT.md) | Кошик і оформлення: flow, money model, мінімальна сума 200 грн, COD і аванс, terms, backend guards |
| [STOCK_VALIDATION.md](STOCK_VALIDATION.md) | Три рівні обмеження кількості, `/api/cart/validate`, серверна перевірка залишків, межі гарантій |
| [SLUG_NAMESPACE.md](SLUG_NAMESPACE.md) | Спільний URL-простір `/{slug}`, порядок резолву, захист від колізій, auto/manual slug |

## Інфраструктура та історія

| Документ | Про що |
|---|---|
| [../Cloud.md](../Cloud.md) | Інфраструктура, інтеграції (KeyCRM, WayForPay, Нова Пошта, R2), обслуговування |
| [../CHANGELOG.md](../CHANGELOG.md) | Історія змін проєкту |
| [../SMOKE_TEST.md](../SMOKE_TEST.md) | Чекліст ручного smoke-тесту |
| [../ACCEPTANCE_REPORT.md](../ACCEPTANCE_REPORT.md) | Приймальний технічний звіт |
| [../REVERSE_ANALYSIS_REPORT.md](../REVERSE_ANALYSIS_REPORT.md) | Reverse-аналіз сайту |
| [../PREPAYMENT_RESEARCH.md](../PREPAYMENT_RESEARCH.md) | Дослідження механік авансу/передоплати |
| [Звіт по роботі 44.md](Звіт%20по%20роботі%2044.md) | Створення тестового сайту |
| [Звіт по роботі 45.md](Звіт%20по%20роботі%2045.md) | Дошліфування staging до production-grade |

---

## Швидкі відповіді

**Де ставити нову бізнес-перевірку замовлення?**
`services/OrderService.ts` → `createOrder()`. Це єдина точка створення замовлення.
Кидати `ValidationError` з `shared/errors.ts`, не `new Error` — інакше буде 500 замість 400.

**Як влаштовані гроші?**
Integer у копійках усюди. `20000` = 200 грн. Ділення на 100 — тільки для UI.
Див. [CHECKOUT.md](CHECKOUT.md#money-model).

**Куди пушити?**
Тільки `TestovaGilka` → staging. У `main` — лише fast-forward merge після ручного тесту.
Див. [../STAGING.md](../STAGING.md).

**Товар не відкривається, хоча є в адмінці?**
Швидше за все slug зайнятий категорією або сторінкою — вони резолвляться раніше.
Див. [SLUG_NAMESPACE.md](SLUG_NAMESPACE.md).

---

## Known notes / limitations

Свідомо залишені нюанси. Не баги в production — але знати про них варто.

**Локальний `npm run build` падає на кириличному шляху.**
Turbopack панікує (`ident.rs`: `byte index is not a char boundary`), бо шлях проєкту містить
кириличні теки. Це pre-existing проблема локального середовища, **не production issue**:
збірка з ASCII-шляху проходить, Railway (Docker, `/app`) збирає без проблем. Для локальної
перевірки збірки — скопіювати проєкт у теку з латинським шляхом. Виправлення не планується.

**`PROD_DATABASE_URL` у staging — application-level read-only, не database-level.**
Staging має повний connection string до production БД для кнопки синхронізації.
Read-only гарантується лише кодом. Деталі й захисти — [../STAGING.md](../STAGING.md).

**Реального резервування товару немає.**
Залишок перевіряється, але не резервується. Гонка між покупцями можлива, останнє слово —
за серверною перевіркою. Див. [STOCK_VALIDATION.md](STOCK_VALIDATION.md#known-limitations).

**Немає крос-табличного DB-констрейнта на slug.**
Захист від колізій — application-level, паралельні create теоретично можуть його обійти.
Див. [SLUG_NAMESPACE.md](SLUG_NAMESPACE.md#known-limitation-race-condition).

**Облікові дані адмінки.**
На момент аудиту `ADMIN_LOGIN` / `ADMIN_PASSWORD` збігались у production і staging — через
це об'єкт, створений «у тестовій адмінці», опинявся в production. Рекомендований принцип:
**окремі облікові дані для кожного середовища**, змінюються в Railway env vars відповідного
environment. Значення секретів у документації не зберігаються.

**Тестові дані на staging.**
Staging БД наповнюється кнопкою «Синхронізувати» з production. Замовлення й клієнти не
копіюються. Залишки та статуси наявності на staging можуть навмисне відрізнятись від
production — вони правляться в адмінці staging під конкретний тестовий сценарій.
