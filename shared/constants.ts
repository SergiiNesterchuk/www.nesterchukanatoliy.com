export const SITE_NAME = "Магазин Анатолія Нестерчука";

// Normalize: trim whitespace, remove trailing slash — prevents %20 in URLs
const rawSiteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://nesterchukanatoliy.com").trim();
export const SITE_URL = rawSiteUrl.replace(/\/+$/, "");
export const SITE_DESCRIPTION =
  "Натуральний яблучний оцет власного виробництва та бордоська суміш для саду. Замовляйте на сайті.";

export const CONTACT = {
  phone: "+380930003008",
  phoneDisplay: "093-000-3008",
  email: "marina.onof38@gmail.com",
  address: "Україна, 07400, Київська обл., Броварський р-н, м. Бровари, вул. Симона Петлюри, буд. 16, корпус Г, кв. 104",
  owner: "ФОП Нестерчук Анатолій Григорович",
  ipn: "2614810893",
} as const;

export const SOCIAL = {
  instagram: "https://www.instagram.com/nesterchuk_anatoliy",
  tiktok: "https://www.tiktok.com/@nesterchuk_anatoliy",
  facebook: "https://www.facebook.com/profile.php?id=100025198117909",
  youtube: "https://youtube.com/@nesterchuk_anatoliy",
} as const;

export const SORT_OPTIONS = [
  { value: "popularity", label: "За популярністю" },
  { value: "price_asc", label: "Від дешевих до дорогих" },
  { value: "price_desc", label: "Від дорогих до дешевих" },
  { value: "name_asc", label: "За назвою" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

export const ORDER_STATUSES = {
  new: "Нове",
  approval: "Погодження",
  production: "Виробництво",
  delivery: "Доставка",
  completed: "Виконано",
  cancelled: "Скасовано",
  // Legacy statuses (backward compat for old orders)
  confirmed: "Підтверджено",
  paid: "Оплачено",
  processing: "В обробці",
  shipped: "Відправлено",
  delivered: "Доставлено",
  returned: "Повернено",
} as const;

export const PAYMENT_STATUSES = {
  pending: "Очікує оплати",
  awaiting_prepayment: "Очікує передплати",
  partial_paid: "Передплата отримана",
  cod_pending: "Оплата при отриманні",
  paid: "Оплачено",
  failed: "Оплата не пройшла",
  prepayment_failed: "Передплата не пройшла",
  refunded: "Кошти повернено",
  cancelled: "Платіж скасовано",
} as const;

export const CRM_SYNC_STATUSES = {
  pending: "Очікує синхронізації",
  synced: "Синхронізовано",
  failed: "Помилка синхронізації",
  not_required: "Не потребує синхронізації",
} as const;

export const DELIVERY_METHODS = {
  nova_poshta_branch: "Нова Пошта (відділення)",
  nova_poshta_courier: "Нова Пошта (кур'єр)",
} as const;

export const PAYMENT_METHODS = {
  card_online: "Оплата карткою онлайн",
} as const;

/** COD prepayment amount in kopiyky. 20000 = 200 UAH */
export const COD_PREPAYMENT_AMOUNT = 20000;

export const ITEMS_PER_PAGE = 12;
export const MAX_CART_QUANTITY = 99;
export const CRM_SYNC_MAX_RETRIES = 5;
