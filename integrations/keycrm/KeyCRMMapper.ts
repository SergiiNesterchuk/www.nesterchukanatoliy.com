import type { KeyCRMOrderCreate } from "./types";
import { toHryvni } from "@/shared/money";

interface LocalOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  deliveryMethod: string;
  deliveryCity: string | null;
  deliveryAddress: string | null;
  deliveryBranchRef: string | null;
  deliveryBranchName: string | null;
  comment: string | null;
  total: number;
  paymentStatus: string;
  paymentPurpose: string | null;
  prepaymentAmount: number | null;
  paymentMethod: string;
  externalPaymentId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  items: Array<{
    name: string;
    sku: string;
    price: number;
    quantity: number;
    imageUrl: string | null;
  }>;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[\s\-\(\)]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `+38${digits}`;
  if (digits.startsWith("380")) return `+${digits}`;
  return digits;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const result = {} as T;
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}

function buildDeliveryComment(order: LocalOrder): string {
  const parts: string[] = [];
  parts.push(`Замовлення з сайту: ${order.orderNumber}`);

  // Delivery info
  const deliveryType = order.deliveryMethod === "nova_poshta_courier" ? "Адресна" : "Відділення/Поштомат";
  parts.push(`Доставка: Нова Пошта (${deliveryType})`);

  if (order.deliveryCity) parts.push(`Місто: ${order.deliveryCity}`);

  if (order.deliveryBranchName) {
    parts.push(`Відділення: ${order.deliveryBranchName}`);
  }
  if (order.deliveryAddress && order.deliveryMethod === "nova_poshta_courier") {
    parts.push(`Адреса: ${order.deliveryAddress}`);
  }
  if (order.deliveryBranchRef) {
    parts.push(`NP Ref: ${order.deliveryBranchRef}`);
  }

  // Prepayment info
  if (order.prepaymentAmount && order.prepaymentAmount > 0) {
    const prepUAH = order.prepaymentAmount / 100;
    const remainUAH = (order.total - order.prepaymentAmount) / 100;
    parts.push(`Передплата: ${prepUAH} грн (WayForPay)`);
    if (remainUAH > 0) parts.push(`Решта при отриманні: ${remainUAH} грн`);
  }

  if (order.comment?.trim()) {
    parts.push(`Коментар клієнта: ${order.comment.trim()}`);
  }

  return parts.join("\n");
}

export class KeyCRMMapper {
  static mapOrderToKeycrm(
    order: LocalOrder,
    sourceId: number
  ): KeyCRMOrderCreate {
    const deliveryService = this.mapDeliveryService(order.deliveryMethod);
    const phone = normalizePhone(order.customerPhone);
    const buyerName = (order.customerName || "").trim() || "Клієнт";

    const buyer: KeyCRMOrderCreate["buyer"] = {
      full_name: buyerName,
      phone,
    };
    if (order.customerEmail && order.customerEmail.trim() && order.customerEmail.includes("@")) {
      buyer.email = order.customerEmail.trim();
    }

    const products = order.items.map((item) => {
      const product: KeyCRMOrderCreate["products"][0] = {
        name: (item.name || "").trim() || "Товар",
        sku: item.sku || undefined,
        price: Number(toHryvni(item.price)) || 0,
        quantity: Number(item.quantity) || 1,
      };
      if (item.imageUrl) product.picture = item.imageUrl;
      return stripUndefined(product);
    });

    // Build structured shipping for KeyCRM right panel
    // KeyCRM fields: shipping_address_city, shipping_receive_point, shipping_secondary_line,
    // recipient_full_name, recipient_phone, warehouse_ref
    const shipping: KeyCRMOrderCreate["shipping"] = {
      shipping_address_city: order.deliveryCity || "",
      recipient_full_name: buyerName,
      recipient_phone: phone,
    };

    // Receive point = warehouse/postomat description (shown in KeyCRM delivery panel)
    if (order.deliveryBranchName) {
      shipping.shipping_receive_point = order.deliveryBranchName;
    }

    // Secondary line = courier address or additional delivery info
    if (order.deliveryAddress && order.deliveryMethod === "nova_poshta_courier") {
      shipping.shipping_secondary_line = order.deliveryAddress;
    }

    // Nova Poshta warehouse Ref — requires delivery_service_id in KeyCRM
    // Changed default shipping_type_id from 4 to 5 (correct Nova Poshta account)
    const npServiceId = process.env.KEYCRM_NOVA_POSHTA_SERVICE_ID || "5";
    if (order.deliveryBranchRef) {
      shipping.warehouse_ref = order.deliveryBranchRef;
      shipping.delivery_service_id = parseInt(npServiceId, 10);
    }

    const keycrmOrder: KeyCRMOrderCreate = {
      source_id: sourceId,
      buyer,
      products,
      shipping,
    };

    if (order.comment?.trim()) {
      keycrmOrder.buyer_comment = order.comment.trim();
    }

    // UTM
    if (order.utmSource) keycrmOrder.utm_source = order.utmSource;
    if (order.utmMedium) keycrmOrder.utm_medium = order.utmMedium;
    if (order.utmCampaign) keycrmOrder.utm_campaign = order.utmCampaign;
    if (order.utmTerm) keycrmOrder.utm_term = order.utmTerm;
    if (order.utmContent) keycrmOrder.utm_content = order.utmContent;

    // Manager comment with full delivery details for TTN creation
    keycrmOrder.manager_comment = buildDeliveryComment(order);

    // Payment records for KeyCRM
    const paymentMethodId = this.getPaymentMethodId(order.paymentMethod);
    const orderNum = order.orderNumber;

    if (order.paymentStatus === "paid") {
      // Повна оплата отримана
      keycrmOrder.payments = [
        {
          ...(paymentMethodId ? { payment_method_id: paymentMethodId } : { payment_method: this.mapPaymentMethod(order.paymentMethod) }),
          amount: Number(toHryvni(order.total)) || 0,
          status: "paid",
          description: order.externalPaymentId
            ? `WayForPay: ${order.externalPaymentId}. Замовлення сайту: ${orderNum}`
            : `Оплата карткою. Замовлення сайту: ${orderNum}`,
        },
      ];
    } else if (order.paymentMethod === "card_online" && ["pending", "awaiting_prepayment"].includes(order.paymentStatus)) {
      // Інвойс створено, але ще не оплачено — зберігаємо в KeyCRM як not_paid
      keycrmOrder.payments = [
        {
          ...(paymentMethodId ? { payment_method_id: paymentMethodId } : { payment_method: this.mapPaymentMethod(order.paymentMethod) }),
          amount: Number(toHryvni(order.total)) || 0,
          status: "not_paid",
          description: `WayForPay інвойс створено. Замовлення сайту: ${orderNum}. Очікує оплати.`,
        },
      ];
    } else if (order.paymentStatus === "partial_paid" && order.prepaymentAmount) {
      // COD with prepayment — 2 payment records
      const prepaymentUAH = Number(toHryvni(order.prepaymentAmount)) || 0;
      const remainingUAH = Number(toHryvni(order.total - order.prepaymentAmount)) || 0;

      keycrmOrder.payments = [
        {
          payment_method: "WayForPay",
          amount: prepaymentUAH,
          status: "paid",
          description: `Передплата ${prepaymentUAH} грн${order.externalPaymentId ? ` (WayForPay: ${order.externalPaymentId})` : ""}`,
        },
      ];

      if (remainingUAH > 0) {
        keycrmOrder.payments.push({
          payment_method: "cash_on_delivery",
          amount: remainingUAH,
          status: "not_paid",
          description: `Решта ${remainingUAH} грн при отриманні`,
        });
      }
    } else if (order.paymentMethod.includes("cod") && order.paymentStatus === "cod_pending") {
      // Legacy COD without prepayment
      keycrmOrder.payments = [
        {
          payment_method: "cash_on_delivery",
          amount: Number(toHryvni(order.total)) || 0,
          status: "not_paid",
          description: "Накладений платіж — оплата при отриманні",
        },
      ];
    }

    return keycrmOrder;
  }

  static mapDeliveryService(method: string): string {
    const mapping: Record<string, string> = {
      nova_poshta_branch: "nova_poshta",
      nova_poshta_courier: "nova_poshta",
    };
    return mapping[method] || "other";
  }

  static mapPaymentMethod(method: string): string {
    const mapping: Record<string, string> = {
      card_online: "card",
    };
    return mapping[method] || "other";
  }

  // KeyCRM payment method ID 8 = 100% online card payment via WayForPay
  static getPaymentMethodId(method: string): number | undefined {
    if (method === "card_online") {
      return parseInt(process.env.KEYCRM_PAYMENT_METHOD_CARD_ID || "8", 10);
    }
    return undefined;
  }
}
