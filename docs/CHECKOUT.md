# Checkout — кошик, оформлення, guards

Як працює оформлення замовлення зараз. Пов'язані документи:
[STOCK_VALIDATION.md](STOCK_VALIDATION.md) · [SLUG_NAMESPACE.md](SLUG_NAMESPACE.md) · [../STAGING.md](../STAGING.md)

---

## Flow

```
AddToCartButton  components/cart/AddToCartButton.tsx
      ↓
Zustand cart     hooks/useCart.ts            persist → localStorage "cart-storage"
      ↓
CartDrawer       components/cart/CartDrawer.tsx      (рендериться в app/(store)/layout.tsx)
      ↓
/checkout        app/(store)/checkout/page.tsx       (server component)
      ↓
CheckoutForm     components/checkout/CheckoutForm.tsx
      ↓
POST /api/checkout   app/api/checkout/route.ts       (Zod: validators/checkout.schema.ts)
      ↓
OrderService.createOrder()   services/OrderService.ts   ← authoritative guards
      ↓
OrderRepository.create()     repositories/OrderRepository.ts
```

**`OrderService.createOrder()` — єдина точка створення замовлення.** `prisma.order.create()`
викликається лише з `OrderRepository.create()`, який викликається лише звідти, а той —
лише з `POST /api/checkout`. Будь-яка нова бізнес-перевірка має жити саме там.

### Входи в `/checkout`

Їх рівно два — обидва проходять через `CheckoutForm`, тож перевірки достатньо мати в ньому:

1. `CartDrawer` → `<Link href="/checkout/">`
2. `RepeatOrderButton` (`app/(store)/account/orders/[orderNumber]/RepeatOrderButton.tsx`) →
   `router.push("/checkout")` — наповнює кошик з попереднього замовлення й веде напряму,
   минаючи drawer

Окремого «купити в 1 клік», mobile-checkout чи floating-cart немає.

---

## Money model

Критично для будь-яких майбутніх змін:

- усі ціни й суми зберігаються як **integer у копійках** (`Product.price`, `Order.subtotal`,
  `Order.total`, `OrderItem.lineTotal` — усі `Int`);
- `45000` = 450.00 грн;
- `subtotal` рахується цілочисельно: `product.price * quantity`, без floating point;
- ділення на 100 відбувається **тільки** для показу — `formatPrice()` у `shared/money.ts`;
- порівняння порогів робиться в копійках, тому граничні значення точні.

Не вводити float/decimal у бізнес-розрахунки.

### Склад суми

`services/OrderService.ts` записує `subtotal` і `total: subtotal` — вони завжди рівні.

- **доставка не входить** — поле `Order.deliveryCost` у схемі є, але ніде не записується (завжди `0`);
- **знижок немає** — `Order.discountTotal` теж завжди `0`; промокодів/купонів/бонусів у коді немає;
- `Product.compareAtPrice` — лише закреслена стара ціна для UI, у розрахунках не бере участі.

---

## Ключові константи

`shared/constants.ts`:

| Константа | Значення | Сенс |
|---|---|---|
| `MIN_ORDER_AMOUNT` | `20000` коп. = **200 грн** | мінімальна сума замовлення |
| `COD_PREPAYMENT_AMOUNT` | `20000` коп. = **200 грн** | сума авансу при накладеному платежі |
| `MAX_CART_QUANTITY` | `99` | стеля кількості, коли залишок не заданий |

⚠️ `MIN_ORDER_AMOUNT` і `COD_PREPAYMENT_AMOUNT` — **різні бізнес-параметри**. Числовий збіг
випадковий. Не об'єднувати, не виражати одну через одну: зміна порогу авансу не повинна
зачіпати мінімальне замовлення і навпаки.

---

## Мінімальна сума замовлення

**Правило:** мінімум застосовується до **subtotal товарів**, без доставки.

```
subtotal <  20000  →  reject
subtotal >= 20000  →  allow
```

### Source of truth

Одна константа в `shared/constants.ts`. Файл імпортується і клієнтом, і сервером — це один
Next.js-бандл, тож розсинхрону між frontend і backend бути не може.

### Backend (authoritative)

`services/OrderService.ts`, одразу після циклу підрахунку `subtotal`:

```ts
if (subtotal < MIN_ORDER_AMOUNT) {
  throw new ValidationError(`Мінімальна сума замовлення — ${MIN_ORDER_AMOUNT / 100} грн`);
}
```

Розташування важливе — перевірка стоїть:

- **після** idempotency-check;
- **після** підрахунку `subtotal` **з цін у БД** (клієнт надсилає лише `productId` + `quantity`,
  підмінити ціну через API неможливо);
- **до** `OrderRepository.create()`, створення платіжної сесії WayForPay, синхронізації
  з KeyCRM, списання залишків і запису історії статусів.

Тому відхилений запит не залишає жодних побічних ефектів.

Відповідь: **HTTP 400**, `code: "VALIDATION_ERROR"`.

### Frontend (UX)

| Компонент | Поведінка при `< 200 грн` |
|---|---|
| `CartDrawer` | `<Link>` **не рендериться взагалі**, кнопка `disabled`, під нею плашка «Мінімальна сума замовлення — 200 грн» |
| `CheckoutForm` | submit `disabled`, така сама плашка над кнопкою; перевірка продубльована у `validate()` |

Чому в drawer саме умовний рендер, а не `disabled`: кнопка була обгорнута в `<Link>`, а
Next.js `Link` перехоплює клік на обгортці — `disabled` на вкладеній кнопці навігацію не
зупиняє.

Кнопка активується автоматично при досягненні порогу: `totalPrice()` перераховується на
кожну зміну zustand-стану, окремих ефектів не потрібно.

Hydration-guard у `CheckoutForm` **не потрібен**: розмітка з кнопкою рендериться лише нижче
early-return на `items.length === 0`, а zustand persist з синхронним localStorage гідратується
до першого клієнтського рендеру — `items` і `totalPrice()` завжди з одного знімка.

### Boundary

| Сума | Копійки | Результат |
|---|---|---|
| 199.00 грн | 19900 | blocked |
| 199.99 грн | 19999 | blocked |
| **200.00 грн** | 20000 | **allowed** |
| 200.01 грн | 20001 | allowed |

---

## Stock

Коротко: `+` на checkout обмежений доступним залишком, застаріла кількість із localStorage
підрізається через `/api/cart/validate`, а `OrderService.createOrder()` перевіряє залишок
повторно. Деталі й межі гарантій — [STOCK_VALIDATION.md](STOCK_VALIDATION.md).

---

## COD (накладений платіж з авансом)

Логіка живе в `app/api/checkout/route.ts`, до виклику `createOrder()`.

- доступний лише коли `estimatedTotal > COD_PREPAYMENT_AMOUNT`, тобто **понад 200 грн**;
- при рівно 200 грн COD прихований у `CheckoutForm` і відхиляється на сервері — платити
  200 авансу за замовлення на 200 не має сенсу;
- аванс = `Math.min(COD_PREPAYMENT_AMOUNT, order.total)`, решта — при отриманні;
- `paymentStatus: "awaiting_prepayment"`, `paymentPurpose: "cod_prepayment"`,
  `prepaymentAmount` у копійках.

### Error handling

Відхилення COD повертає **HTTP 400 / `VALIDATION_ERROR`** з читабельним текстом
«Накладений платіж з авансом доступний для замовлень понад 200 грн.»

Раніше тут кидався звичайний `new Error(...)`, через що `errorResponse()` (`shared/api-response.ts`)
не впізнавав його як `AppError`, падав у generic-гілку і віддавав **500 «Internal server error»**,
ковтаючи повідомлення.

**Правило для всього API:** бізнес-помилки кидати класами з `shared/errors.ts`
(`ValidationError` → 400, `NotFoundError` → 404, `PaymentError` → 400 …). Голий `new Error()`
завжди перетвориться на 500 з generic-текстом.

---

## Terms (згода з умовами)

Поточний стан:

- окремого checkbox «Я погоджуюсь з умовами використання» **немає** — його видалено;
- прихованого `checked=true` контролу теж немає, у DOM `/checkout` нуль checkbox-ів;
- замість нього — інформаційний текст біля кнопки:
  «Оформлюючи замовлення, ви погоджуєтесь з **умовами використання**», де посилання веде
  на `/umovy-vykorystannia/`;
- сторінку умов не чіпали.

Прибрано разом із checkbox: стан `agreedToTerms`, перевірку у `validate()`, проп `requireTerms`,
запит налаштування в `app/(store)/checkout/page.tsx`, контрол у адмінці.

Ключ `checkout_require_terms` **видалено з таблиці `Settings`** в обох середовищах
(staging і production) — reader'ів у коді не лишилось.

Поле `agreedToTerms: true` і далі надсилається в payload: воно є в
`validators/checkout.schema.ts` як `optional().default(true)`. Залишене свідомо, щоб не
змінювати контракт API.

---

## Payments mode

`shared/features.ts` централізує режими. На staging `PAYMENTS_ENABLED=false` → `mock`:
`OrderService.applyMockPayment()` проходить тим самим шляхом, що й реальний callback
WayForPay, але без зовнішнього виклику. Деталі — [../STAGING.md](../STAGING.md).

---

## Що перевіряти при змінах checkout

- нову бізнес-перевірку ставити в `OrderService.createOrder()`, а не в route;
- кидати `ValidationError`, не `new Error`;
- пороги брати з `shared/constants.ts`, не хардкодити;
- рахувати в копійках;
- прямий `POST /api/checkout` в обхід UI має відхилятись так само, як UI;
- перевірити обидва входи в checkout, включно з «Повторити замовлення».
