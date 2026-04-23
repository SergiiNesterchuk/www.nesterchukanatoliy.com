# Технічний Reverse-Analysis сайту nesterchukanatoliy.com

**Дата аналізу:** 2026-04-23
**Аналітик:** Senior Full-Stack Engineer + Solution Architect + QA Analyst
**Об'єкт:** https://nesterchukanatoliy.com/

---

## 0. Executive Summary

Сайт побудований на **Horoshop** — українській SaaS e-commerce платформі. Це мікро-магазин із 4 товарами у 2 категоріях (яблучний оцет, бордоська суміш). Платформа Horoshop є закритою SaaS — вихідний код, база даних та адмінка недоступні для клонування. **Буквальне відтворення неможливе** — потрібна повна перебудова на власному стеку з відтворенням функціоналу та дизайну.

**Рівень впевненості CMS:** Horoshop — **100% confirmed** (тема `horoshop_default` у JS globals, webpack бандли `npm.horoshop.*`, endpoint `/api/` з відповіддю `{"status":"UNDEFINED_FUNCTION"}`, характерні cookies, robots.txt директиви).

---

## 1. Що можна відтворити на 100% з публічного сайту

| Елемент | Деталі |
|---------|--------|
| **HTML-структура всіх публічних сторінок** | DOM-дерево, BEM-класи, семантика |
| **Візуальний дизайн (pixel-perfect)** | Скріншоти + CSS файли доступні публічно |
| **URL-структура та routing** | Flat URLs з транслітерованими slug-ами |
| **SEO мета-теги** | title, description, canonical, OG tags, JSON-LD schema |
| **Тексти та контент** | Всі публічні тексти, описи, блог-пости |
| **Зображення** | Завантажуються з `/content/images/` з динамічним ресайзом |
| **Контактна інформація** | Телефон, email, адреса, соц.мережі |
| **Каталог товарів (публічні дані)** | Назви, ціни, артикули, описи, фото, наявність |
| **Breadcrumbs** | 3-рівнева структура із Schema.org `BreadcrumbList` |
| **Sorting** | За популярністю, ціною ↑↓, назвою |
| **Mobile-responsive layout** | CSS media queries доступні |
| **SVG іконки** | Спрайт доступний публічно |
| **Analytics IDs** | GA4: G-JT8BTTGSC2, Clarity: vpdpsqf2ig |
| **Структура форм** | Login, Register, Password Recovery, Callback, Reviews |
| **Юридичні сторінки** | Оферта, умови використання |

---

## 2. Що можна відтворити лише приблизно

| Елемент | Причина неточності |
|---------|-------------------|
| **JS поведінка (модальні вікна, AJAX кошик)** | Логіка є в мініфікованих бандлах — можна reverse-engineer, але точне відтворення нераціональне |
| **Фільтрація каталогу** | URL-патерни видимі (`/filter/sort_price=ASC/`), але повна логіка фільтрів прихована (зараз фільтри мінімальні через 4 товари) |
| **Checkout flow** | Сторінка `/checkout/` існує, але показує контент лише з товарами у кошику — повний flow не проаналізований |
| **Анімації та переходи** | CSS transitions/animations можна витягти, але деякі JS-driven анімації потребують reverse-engineering |
| **Anti-bot challenge** | Hash-based JS challenge — видимий, але відтворення його алгоритму потребує аналізу мініфікованого JS |
| **Email templates** | Тексти відправлених листів невідомі |
| **Галерея товарів** | TMGallery бібліотека — поведінку видно, але це Horoshop-specific JS |

---

## 3. Що неможливо відтворити без доступу до бекенду/адмінки/БД

| Елемент | Причина |
|---------|---------|
| **Адмін-панель** | Повністю закрита, нуль публічних ознак |
| **Структура БД** | SaaS — БД на серверах Horoshop |
| **Бізнес-логіка замовлень** | Статуси, workflow, нотифікації — все на бекенді |
| **Оплата (WayForPay API)** | Merchant ID, секретні ключі, callback URL — приватні |
| **Доставка (Нова Пошта API)** | API ключі, логіка тарифів — приватні |
| **Система знижок/купонів** | Код checkout підтримує поле `coupon`, але логіка невідома |
| **Управління залишками** | Лише `purchase_limit` видно у meta-тегах |
| **Ролі користувачів** | Невідомо скільки ролей в адмінці |
| **CRM/ERP інтеграції** | Неможливо визначити з фронтенду |
| **Email розсилки** | Шаблони, тригери — невідомі |
| **Viber/SMS інтеграції** | Згадується Viber для зв'язку, але інтеграція невідома |
| **Історія замовлень та клієнтів** | Дані в SaaS БД |
| **Оптові ціни** | Блок `product__block--wholesale-prices` є, але пустий |
| **Паролі користувачів** | Не можуть бути перенесені (хешовані) |

---

## 4. Inventory функціоналу сайту — повний список модулів

### 4.1. Frontend модулі

| # | Модуль | Статус | Деталі |
|---|--------|--------|--------|
| 1 | **Каталог товарів** | ✅ confirmed | 2 категорії, 4 товари, grid/list view |
| 2 | **Категорії** | ✅ confirmed | `/bordoska-sumish/`, `/yabluchnyi-otset/` |
| 3 | **Картка товару** | ✅ confirmed | Повна структура: фото, ціна, опис, SKU, наявність, вкладки |
| 4 | **Варіанти товарів** | ❌ not present | Товари — окремі SKU, не варіанти |
| 5 | **Ціни** | ✅ confirmed | UAH, без знижок на даний момент |
| 6 | **Оптові ціни** | ⚠️ inferred | HTML-блок існує, але пустий |
| 7 | **Залишки/наявність** | ✅ confirmed | `purchase_limit` у meta, "В наявності" / "Немає в наявності" |
| 8 | **Кошик** | ✅ confirmed | AJAX modal, AjaxCart, без окремої сторінки |
| 9 | **Checkout** | ✅ confirmed | `/checkout/`, деталі потребують авторизованої сесії |
| 10 | **Авторизація** | ✅ confirmed | Modal popup, email+password, CSRF |
| 11 | **Реєстрація** | ✅ confirmed | Modal popup, ім'я+email+password |
| 12 | **OAuth (соц. мережі)** | ✅ confirmed | Facebook, Google |
| 13 | **Відновлення пароля** | ✅ confirmed | Modal popup, email |
| 14 | **Блог** | ✅ confirmed | 2 пости, без категорій/тегів |
| 15 | **Статичні сторінки** | ✅ confirmed | Про нас, Оплата і доставка, Контакти, Умови |
| 16 | **Контактна форма (callback)** | ✅ confirmed | Ім'я + телефон, AJAX submit |
| 17 | **Wishlist / Обране** | ✅ confirmed | `/profile/favorites/`, потребує логіну |
| 18 | **Compare / Порівняння** | ✅ confirmed | ComparisonTable JS popup |
| 19 | **User account / Кабінет** | ⚠️ inferred | `/profile/` існує, деталі невідомі |
| 20 | **Історія замовлень** | ⚠️ inferred | Очікується у кабінеті, не підтверджено |
| 21 | **Mobile menu** | ✅ confirmed | Окрема мобільна версія `/?v=mobile` |
| 22 | **Search / Пошук** | ✅ confirmed | AJAX widget, `/katalog/search/?q=` |
| 23 | **Filters / Фільтри** | ✅ confirmed | URL-based `/filter/`, AJAX, CatalogBuilder |
| 24 | **Sorting / Сортування** | ✅ confirmed | 4 опції: популярність, ціна ↑↓, назва |
| 25 | **SEO metadata** | ✅ confirmed | Title, description, canonical, OG, JSON-LD |
| 26 | **Schema.org markup** | ✅ confirmed | WebSite, Product, BreadcrumbList, ItemList, Review, Rating |
| 27 | **Robots.txt** | ✅ confirmed | 24 disallow правила, sitemap |
| 28 | **Sitemap XML** | ✅ confirmed | Index → pages, news, catalog (3 sub-sitemaps) |
| 29 | **Analytics** | ✅ confirmed | GA4, Microsoft Clarity, Sourcebuster |
| 30 | **Cookie consent** | ❌ not present | Жодного банера згоди не виявлено |
| 31 | **Localization** | ❌ single-language | Тільки українська, `use_countries: false` |
| 32 | **Notifications (наявність)** | ✅ confirmed | "Повідомити, коли з'явиться" для out-of-stock |
| 33 | **Відгуки (reviews)** | ✅ confirmed | AJAX comments, 1-5 зірок, threaded replies |
| 34 | **Схожі товари** | ✅ confirmed | 3 типи: similar, accessories, see-also (AJAX) |
| 35 | **Нещодавно переглянуті** | ✅ confirmed | Widget `/_widget/seen_items/default/` |
| 36 | **Галерея фото товару** | ✅ confirmed | TMGallery, zoom, thumbnails, підтримка відео |
| 37 | **Scroll to top** | ✅ confirmed | Кнопка прокрутки вгору |
| 38 | **Anti-bot challenge** | ✅ confirmed | JS hash challenge, cookie `challenge_passed` |
| 39 | **CSRF protection** | ✅ confirmed | Token у всіх формах |

### 4.2. Передбачувані модулі адмін-панелі

| # | Модуль | Статус | Обґрунтування |
|---|--------|--------|---------------|
| 1 | **Dashboard (огляд)** | ⚠️ inferred | Стандарт для Horoshop |
| 2 | **Управління товарами** | ⚠️ inferred | CRUD для 4+ товарів |
| 3 | **Управління категоріями** | ⚠️ inferred | 2 категорії, деревовидна структура |
| 4 | **Управління замовленнями** | ⚠️ inferred | Checkout є — значить і замовлення є |
| 5 | **Управління клієнтами** | ⚠️ inferred | Реєстрація є — значить і клієнтська база |
| 6 | **Управління контентом (сторінки)** | ⚠️ inferred | 5+ статичних сторінок |
| 7 | **Управління блогом** | ⚠️ inferred | 2 пости з CMS-структурою |
| 8 | **Управління відгуками** | ⚠️ inferred | Модерація коментарів |
| 9 | **Налаштування оплати** | ⚠️ inferred | WayForPay інтегрований |
| 10 | **Налаштування доставки** | ⚠️ inferred | Нова Пошта |
| 11 | **SEO налаштування** | ⚠️ inferred | Meta-теги, sitemap генерація |
| 12 | **Аналітика (вбудована)** | ⚠️ inferred | GA4/Clarity IDs в налаштуваннях |
| 13 | **Управління знижками/купонами** | ⚠️ inferred | Поле `coupon` у checkout events |
| 14 | **Налаштування теми/дизайну** | ⚠️ inferred | Кольори наявності кастомізовані |
| 15 | **Управління банерами** | ⚠️ inferred | Банер на головній |
| 16 | **Управління файлами/медіа** | ⚠️ inferred | Система завантаження фото |
| 17 | **Налаштування домену** | ⚠️ inferred | Стандарт Horoshop SaaS |
| 18 | **Управління оптовими цінами** | ⚠️ inferred | Блок wholesale-prices у HTML |
| 19 | **Список очікування (waiting list)** | ⚠️ inferred | Кнопка "Повідомити" для out-of-stock |
| 20 | **Email шаблони** | ⚠️ inferred | Стандарт e-commerce платформи |

---

## 5. Список виявлених та передбачуваних інтеграцій

| # | Інтеграція | Статус | Деталі |
|---|-----------|--------|--------|
| 1 | **Google Analytics 4** | ✅ confirmed | ID: G-JT8BTTGSC2, enhanced e-commerce events |
| 2 | **Microsoft Clarity** | ✅ confirmed | ID: vpdpsqf2ig, heatmaps/recordings |
| 3 | **Sourcebuster.js** | ✅ confirmed | UTM/traffic source tracking (bundled) |
| 4 | **WayForPay** | ✅ confirmed | Платіжний сервіс, згадано в тексті оплати |
| 5 | **Нова Пошта** | ✅ confirmed | Доставка, згадано у тексті |
| 6 | **Facebook OAuth** | ✅ confirmed | `/security/OAuthRedirect/?soc=facebook` |
| 7 | **Google OAuth** | ✅ confirmed | `/security/OAuthRedirect/?soc=google` |
| 8 | **Viber** | ⚠️ inferred | Згадано як канал зв'язку (тел. 093-000-3008) |
| 9 | **Meta Pixel** | ❌ not detected | Не знайдено fbq() чи pixel ID |
| 10 | **Google Tag Manager** | ❌ not detected | Прямий gtag.js, не GTM |
| 11 | **CRM/ERP** | ❓ unknown | Жодних ознак |
| 12 | **Email marketing** | ⚠️ inferred | `newsletter_subscription` event у JS, але форма не знайдена |
| 13 | **SMS** | ❓ unknown | Жодних ознак |

---

## 6. Ризики при спробі зробити "точну копію"

### Критичні ризики

1. **Horoshop — закрита SaaS платформа.** Вихідний код не доступний. Ліцензійне копіювання неможливе. Потрібна повна перебудова.

2. **Юридичний ризик.** Pixel-perfect копіювання дизайну Horoshop-теми може порушувати авторські права на шаблон. Рекомендується створити технічно еквівалентний, але візуально унікальний дизайн.

3. **Втрата SEO-позицій.** При міграції на новий стек без збереження URL-структури, мета-тегів, schema markup, sitemap і canonical — позиції у Google будуть втрачені. **Мітигація:** 1:1 URL mapping, 301 redirects, GSC migration.

4. **Відсутність даних бекенду.** Замовлення, клієнти, аналітика історії — все це в Horoshop SaaS і потребує експорту.

5. **Платіжна інтеграція.** WayForPay потребує merchant account і API ключів. Без них checkout не працюватиме.

6. **Нова Пошта API.** Для розрахунку доставки потрібні API credentials і розуміння логіки тарифів.

7. **OAuth credentials.** Facebook/Google OAuth потребують свої app credentials для нового домену.

8. **Паролі користувачів.** Хеші паролів з Horoshop не можуть бути перенесені — всім клієнтам треба скидати пароль.

### Помірні ризики

9. **Мобільна версія.** Horoshop має окрему мобільну версію (`/?v=mobile`), а не responsive. Нова реалізація має бути responsive-first.

10. **Anti-bot challenge.** Специфічний для Horoshop. Потребує власної реалізації або сторонніх рішень (Cloudflare, hCaptcha).

11. **JS-поведінка.** Мініфіковані бандли (~20 файлів) — reverse-engineering можливий, але трудомісткий і нераціональний.

---

## 7. Що треба замінити на нову реалізацію

| Оригінал (Horoshop) | Заміна |
|---------------------|--------|
| Horoshop SaaS backend | Custom backend (Node.js/Next.js або PHP/Laravel) |
| Horoshop admin panel | Custom admin (або Strapi / Payload CMS / AdminJS) |
| Horoshop AjaxCart | Custom cart (React/Vue component + REST/GraphQL API) |
| Horoshop CatalogBuilder | Custom catalog з фільтрами (Algolia / MeiliSearch або custom) |
| Horoshop TMGallery | Lightbox бібліотека (PhotoSwipe / GLightbox) |
| Horoshop ComparisonTable | Custom compare module |
| Horoshop OAuth flow | NextAuth.js / Passport.js |
| Horoshop CSRF | Standard CSRF middleware |
| Horoshop anti-bot | Cloudflare Bot Management / hCaptcha |
| Horoshop image resizer | Sharp.js / Cloudinary / imgproxy |
| Horoshop widget system (`/_widget/`) | API routes + SSR components |
| Horoshop email system | SendGrid / Mailgun / Resend + custom templates |
| Horoshop sitemap generator | next-sitemap / custom generation |

---

## 8. Рекомендований стек для відтворення

### Варіант А — Modern Fullstack (рекомендований)

```
Frontend:     Next.js 15 (App Router, SSR/SSG, React 19)
Styling:      Tailwind CSS 4
State:        Zustand (cart, UI) + React Query (API)
Backend:      Next.js API Routes + tRPC або REST
Database:     PostgreSQL (Supabase або self-hosted)
ORM:          Prisma / Drizzle
Auth:         NextAuth.js v5 (email + Google + Facebook)
Admin:        Payload CMS 3 (headless, вбудований у Next.js)
Payments:     WayForPay SDK / LiqPay
Delivery:     Нова Пошта API v2
Search:       MeiliSearch або PostgreSQL FTS
Images:       Cloudinary / Uploadthing + Sharp
Email:        Resend + React Email
Analytics:    GA4 (gtag.js) + Clarity
Hosting:      Vercel / Railway / VPS (Hetzner)
CDN:          Cloudflare
Bot protect:  Cloudflare Turnstile
```

### Варіант Б — PHP/Laravel (якщо замовник обирає PHP)

```
Frontend:     Blade templates + Alpine.js + Livewire
Backend:      Laravel 12
Database:     MySQL 8 / PostgreSQL
Admin:        Filament 3
Payments:     WayForPay SDK
Delivery:     Нова Пошта API
Auth:         Laravel Socialite
Search:       Laravel Scout + MeiliSearch
Images:       Spatie Media Library
Email:        Laravel Mail + Mailgun
Hosting:      VPS (Hetzner / DigitalOcean)
```

---

## 9. Gap Analysis — що потрібно для точної копії

### Дані, які є (з публічного сайту)

| Дані | Джерело |
|------|---------|
| Назви, описи, фото, ціни, SKU 4 товарів | Product pages |
| 2 категорії з назвами та URL | Navigation + sitemap |
| 2 блог-пости (повний текст + фото) | Blog pages |
| 5 статичних сторінок (контент) | Page URLs |
| Контактна інформація (повна) | Footer + contact page |
| SEO мета-теги для всіх сторінок | HTML head |
| URL-структура | Sitemap + navigation |
| Структура форм (fields, validation) | HTML forms |
| Analytics IDs | JS scripts |
| Дизайн (CSS) | Public CSS files |

### Дані, яких немає

| Дані | Ризик без них | Безпечний шлях відтворення |
|------|--------------|--------------------------|
| **Структура БД** | Невідома модель даних | Спроєктувати з нуля на основі публічних полів |
| **Бізнес-логіка замовлень** | Невідомі статуси, workflow | Запитати у замовника або реалізувати стандартний flow |
| **WayForPay API credentials** | Checkout не працюватиме | Отримати merchant account від замовника |
| **Нова Пошта API key** | Розрахунок доставки не працюватиме | Отримати від замовника |
| **OAuth app credentials** | Social login не працюватиме | Створити нові apps на Facebook/Google |
| **Email templates** | Не буде email notifications | Створити нові шаблони |
| **Логіка знижок/купонів** | Не буде промо-функціоналу | Запитати правила у замовника |
| **Дані клієнтів** | Порожня клієнтська база | Експортувати з Horoshop |
| **Дані замовлень** | Порожня історія | Експортувати з Horoshop |
| **Повні оригінальні фото** | Можливо зниження якості | Запитати оригінали у замовника |
| **Журнали помилок** | Не видно проблемних місць | Налаштувати logging з нуля |
| **Резервні копії** | Немає fallback | Налаштувати з нуля |

---

## 10. Список інформації для запиту у замовника

### Критичні (без них — неможливо запустити)

1. **Доступ до Horoshop адмінки** або відеозапис усіх екранів і сценаріїв роботи
2. **Опис усіх ролей користувачів:** власник, менеджер, контент-редактор, оператор замовлень, склад тощо
3. **Повний flow замовлення:** створення → оплата → підтвердження → збірка → відправка → завершення → скасування → повернення
4. **Список статусів замовлень** і правила переходів між ними
5. **Структура товарів:** категорії, атрибути, варіанти, фото, ціни, залишки, SKU — чи планується розширення асортименту
6. **Правила наявності товарів:** ручне редагування чи автоматичний складський облік
7. **Способи доставки** й логіка тарифів (фіксована ціна, за вагою, за відділенням НП)
8. **Способи оплати** та доступи/API до WayForPay (merchant ID, secret key)
9. **Інтеграції:** CRM, ERP, пошта, Viber, SMS, рекламні кабінети
10. **Доступ до домену nesterchukanatoliy.com** (реєстратор, DNS)
11. **Доступ до хостингу** або рішення щодо нового хостингу

### Важливі (для повноти відтворення)

12. **Експорт з Horoshop:** товари (CSV/JSON), клієнти, замовлення, блог, сторінки, SEO-дані
13. **Усі медіафайли** в оригінальній якості (фото товарів, банери, лого)
14. **Усі тексти:** юридичні сторінки, політики, мета-теги
15. **Аналітика:** GA4, Clarity — чи потрібно зберегти history, чи починаємо з нуля
16. **GTM/Meta Pixel** — чи планується підключення
17. **Conversion events** — які конверсії відстежуються

### Стратегічні (для правильного проєктування)

18. **Чи потрібна буквальна копія дизайну**, чи допускається технічно еквівалентна нова реалізація
19. **Чи потрібне перенесення** старих користувачів, паролів, історії замовлень і SEO-позицій
20. **Чи потрібна багатомовність** (зараз тільки UA, чи планується RU/EN)
21. **Який стек бажаний** для нової системи (або довіряє рішення архітектору)
22. **Хто буде підтримувати сайт** після запуску (технічна команда / фрілансер / замовник сам)
23. **Планований масштаб** — скільки товарів, категорій, замовлень на день очікується

---

## 11. Висновок по трудомісткості

| Аспект | Оцінка |
|--------|--------|
| **Exact UI clone** | ✅ POSSIBLE — CSS та HTML структура публічні |
| **Backend clone** | ⚠️ PARTIALLY POSSIBLE — логіка потребує проєктування з нуля |
| **Admin clone** | ❌ IMPOSSIBLE without access — жодних публічних даних |
| **Рекомендація** | 🔄 **RECOMMENDED: REBUILD** instead of literal clone |

**Обґрунтування:** Horoshop — закрита SaaS. Копіювання неможливе технічно та юридично. Правильний підхід — побудова нового магазину з нуля, використовуючи публічно зібрані дані як специфікацію для дизайну та функціоналу.

---

## 12. Поетапний план розробки

### Фаза 0 — Підготовка (1 тиждень)
- [ ] Отримати відповіді на всі питання з розділу 10
- [ ] Експортувати дані з Horoshop (товари, клієнти, замовлення, контент)
- [ ] Завантажити всі медіафайли в оригінальній якості
- [ ] Зафіксувати повну URL-карту для 301 redirects
- [ ] Створити Figma-макети на основі скріншотів (або прийняти рішення про новий дизайн)

### Фаза 1 — Фундамент (2 тижні)
- [ ] Ініціалізація проєкту (Next.js + Payload CMS + PostgreSQL)
- [ ] Схема БД: товари, категорії, користувачі, замовлення, контент
- [ ] Auth: email/password, Google OAuth, Facebook OAuth
- [ ] Базова адмін-панель (Payload CMS setup)
- [ ] CI/CD pipeline

### Фаза 2 — Каталог і товари (2 тижні)
- [ ] Категорії та сторінки категорій
- [ ] Картка товару (фото, опис, ціна, наявність, SKU)
- [ ] Галерея фото з zoom
- [ ] Sorting (4 типи)
- [ ] Фільтрація
- [ ] Пошук
- [ ] Схожі товари
- [ ] Порівняння
- [ ] Wishlist / Обране
- [ ] Нещодавно переглянуті
- [ ] Відгуки з рейтингом

### Фаза 3 — Кошик і Checkout (2 тижні)
- [ ] AJAX кошик (modal)
- [ ] Checkout flow (форма, валідація)
- [ ] Інтеграція WayForPay
- [ ] Інтеграція Нова Пошта (API вибору відділення, розрахунок вартості)
- [ ] Email підтвердження замовлення
- [ ] Сповіщення "Повідомити, коли з'явиться"

### Фаза 4 — Контент і SEO (1 тиждень)
- [ ] Блог (список + окремий пост + коментарі)
- [ ] Статичні сторінки (CMS-managed)
- [ ] SEO: meta tags, OG, canonical, JSON-LD schema
- [ ] Sitemap.xml generation
- [ ] Robots.txt
- [ ] 301 redirects з старих URL

### Фаза 5 — Кабінет і профіль (1 тиждень)
- [ ] User dashboard
- [ ] Історія замовлень
- [ ] Wishlist management
- [ ] Зміна пароля / профілю
- [ ] Callback форма

### Фаза 6 — Адмін-панель (2 тижні)
- [ ] CRUD товарів з фото-завантаженням
- [ ] Управління категоріями
- [ ] Управління замовленнями (статуси, workflow)
- [ ] Управління клієнтами
- [ ] Управління блогом
- [ ] Управління контентом сторінок
- [ ] Управління відгуками (модерація)
- [ ] Налаштування оплати та доставки
- [ ] SEO налаштування
- [ ] Знижки / купони
- [ ] Банери
- [ ] Dashboard зі статистикою

### Фаза 7 — Інтеграції та поліш (1 тиждень)
- [ ] GA4 enhanced e-commerce events
- [ ] Microsoft Clarity
- [ ] Cookie consent (якщо потрібно)
- [ ] Bot protection (Cloudflare Turnstile)
- [ ] Email шаблони (підтвердження, відновлення пароля, замовлення)
- [ ] Mobile responsive тестування
- [ ] Performance optimization (Core Web Vitals)

### Фаза 8 — Міграція і запуск (1 тиждень)
- [ ] Імпорт товарів
- [ ] Імпорт контенту
- [ ] DNS migration
- [ ] SSL certificate
- [ ] 301 redirects перевірка
- [ ] Smoke testing всіх flows
- [ ] GSC migration
- [ ] Launch

**Загальна оцінка: 11-13 тижнів** для одного senior full-stack розробника.

---

## 13. Підсумкова таблиця — Module Inventory

| Module | Publicly Visible | Can Recreate Exactly | Requires Internal Access | Notes |
|--------|:---:|:---:|:---:|-------|
| **Каталог товарів** | ✅ | ✅ UI / ⚠️ logic | ⚠️ filter logic | 4 товари, 2 категорії |
| **Категорії** | ✅ | ✅ | — | Flat structure |
| **Картка товару** | ✅ | ✅ UI | ⚠️ wholesale prices | Повна структура видима |
| **Варіанти товарів** | ❌ absent | N/A | N/A | Товари — окремі SKU |
| **Ціни (UAH)** | ✅ | ✅ | ⚠️ discount logic | Тільки базові ціни видимі |
| **Залишки/наявність** | ✅ partial | ⚠️ | ✅ stock management | Лише purchase_limit видно |
| **Кошик (AJAX modal)** | ✅ | ⚠️ | — | JS-поведінка потребує reverse |
| **Checkout** | ✅ exists | ⚠️ | ✅ full flow | Потребує session з товарами |
| **Авторизація** | ✅ | ✅ form | ⚠️ backend logic | Modal, email+password |
| **Реєстрація** | ✅ | ✅ form | ⚠️ backend logic | Modal, name+email+password |
| **OAuth (FB/Google)** | ✅ | ⚠️ | ✅ credentials | Потрібні нові app IDs |
| **Відновлення пароля** | ✅ | ✅ form | ⚠️ email template | Modal, email |
| **Блог** | ✅ | ✅ | — | 2 пости, повний контент |
| **Статичні сторінки** | ✅ | ✅ | — | 5 сторінок |
| **Контактна форма** | ✅ | ✅ UI | ⚠️ email routing | Callback form |
| **Wishlist** | ✅ | ⚠️ | ⚠️ user scope | Потребує auth |
| **Compare** | ✅ | ⚠️ | — | JS popup, reverse-engineer |
| **User account** | ⚠️ hidden | ⚠️ | ✅ full structure | `/profile/` недоступний |
| **Order history** | ⚠️ inferred | ❌ | ✅ | Невідома структура |
| **Mobile menu** | ✅ | ⚠️ | — | Окрема мобільна версія |
| **Search** | ✅ | ⚠️ | — | AJAX widget |
| **Filters** | ✅ | ⚠️ | ⚠️ filter config | URL-based, мало даних |
| **Sorting** | ✅ | ✅ | — | 4 опції |
| **SEO metadata** | ✅ | ✅ | — | Повний набір |
| **Schema.org** | ✅ | ✅ | — | Product, Review, Breadcrumb |
| **Robots.txt** | ✅ | ✅ | — | 24 rules |
| **Sitemap** | ✅ | ✅ | — | 3 sub-sitemaps |
| **GA4 Analytics** | ✅ | ✅ | ⚠️ property access | ID відомий |
| **Clarity** | ✅ | ✅ | ⚠️ project access | ID відомий |
| **Cookie consent** | ❌ absent | N/A | — | Потрібно додати |
| **Localization** | ❌ single | N/A | — | Тільки UA |
| **Notifications (stock)** | ✅ | ⚠️ | ⚠️ email logic | Потребує auth |
| **Reviews** | ✅ | ✅ UI | ⚠️ moderation | AJAX, зірки, threaded |
| **Related products** | ✅ | ⚠️ | ⚠️ algorithm | 3 типи зв'язків |
| **Recently viewed** | ✅ | ⚠️ | — | localStorage-based |
| **Photo gallery** | ✅ | ⚠️ | — | Zoom, thumbnails |
| **Anti-bot** | ✅ | ⚠️ | — | Потрібна заміна |
| **WayForPay** | ✅ mentioned | ❌ | ✅ API keys | Merchant account |
| **Нова Пошта** | ✅ mentioned | ❌ | ✅ API keys | Delivery API |
| **Email system** | ❌ hidden | ❌ | ✅ templates | Невідомі шаблони |
| **Admin panel** | ❌ hidden | ❌ | ✅ full access | Повністю закрита |
| **Order management** | ❌ hidden | ❌ | ✅ workflow | Невідомий flow |
| **Stock management** | ❌ hidden | ❌ | ✅ logic | Ручне / авто — невідомо |
| **Discounts/coupons** | ⚠️ JS hint | ❌ | ✅ rules | Поле coupon у events |
| **Email marketing** | ⚠️ JS hint | ❌ | ✅ | Newsletter event є |

---

## 14. Технічні деталі зібрані з публічного аналізу

### Контактна інформація
- **Власник:** ФОП Нестерчук Анатолій Григорович
- **ІПН:** 2614810893
- **Телефон:** 093-000-3008
- **Email:** marina.onof38@gmail.com
- **Адреса:** Україна, 07400, Київська обл., Броварський р-н, м. Бровари, вул. Симона Петлюри, буд. 16, корпус Г, кв. 104

### Соціальні мережі
- Instagram: @nesterchuk_anatoliy
- TikTok: @nesterchuk_anatoliy
- Facebook: profile ID 100025198117909
- YouTube: @nesterchuk_anatoliy

### Товари (повний каталог)

| ID | SKU | Назва | Ціна | Наявність | URL |
|----|-----|-------|------|-----------|-----|
| 513 | 01 | Набір для приготування 30л 3% бордоської суміші | 450 грн | ❌ (0 шт.) | `/nabir-dlia-pryhotuvannia-30l-3-bordoskoi-sumishi/` |
| 514 | 02 | Яблучний оцет 0.5л скло | 280 грн | ✅ (58 шт.) | `/yabluchnyi-otset-0.5l-sklo/` |
| 515 | 03 | Яблучний оцет 1л скло | 480 грн | ✅ | `/yabluchnyi-otset-1l-sklo/` |
| 516 | 04 | Яблучний оцет 1л пластик | 450 грн | ✅ | `/yabluchnyi-otset-1l-plastyk/` |

### API endpoints виявлені

| Endpoint | Метод | Призначення |
|----------|-------|------------|
| `/security/login/` | POST | Авторизація |
| `/security/sign_up/` | POST | Реєстрація |
| `/security/password-recovery/` | POST | Відновлення пароля |
| `/security/OAuthRedirect/` | GET | OAuth redirect |
| `/_widget/contacts/submit-callback/` | POST | Форма зворотнього дзвінка |
| `/_widget/ajax_comments/submit/` | POST | Відправка відгуку |
| `/_widget/ajax_comments/renderReplyForm/` | GET | Форма відповіді |
| `/_widget/product_rating/render/gallery/{id}/` | GET | Рейтинг товару |
| `/_widget/seen_items/default/` | GET | Нещодавно переглянуті |
| `/_widget/horoshop_viewStrategies_product_modern_blocks_associatedProducts_widget/load-associated-products/` | GET | Схожі товари |
| `/katalog/search/` | GET | Пошук |
| `/api/` | GET | REST API root |
| `/globals.js/` | GET | JS конфігурація |

### HTTP Security Headers
- `X-Frame-Options: SAMEORIGIN`
- `Strict-Transport-Security: max-age=31536000`
- `Cache-Control: no-store, no-cache, must-revalidate`
- PHP backend (`PHPSESSID` cookie)

### Performance
- Render time: ~0.16s
- Memory: ~2 MB
- ~20 JS бандлів (webpack code-split)
- 2 CSS файли

---

**Документ підготовлено:** 2026-04-23
**Статус:** Готовий до review замовником
