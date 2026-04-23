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
  deliveryBranchName: string | null;
  comment: string | null;
  total: number;
  paymentStatus: string;
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

/**
 * Normalize phone to format KeyCRM expects: digits only or +380...
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/[\s\-\(\)]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `+38${digits}`;
  if (digits.startsWith("380")) return `+${digits}`;
  return digits;
}

/**
 * Remove undefined values from object — prevents JSON serialization issues.
 * KeyCRM API may 500 on undefined/null in unexpected fields.
 */
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

export class KeyCRMMapper {
  static mapOrderToKeycrm(
    order: LocalOrder,
    sourceId: number
  ): KeyCRMOrderCreate {
    const deliveryService = this.mapDeliveryService(order.deliveryMethod);
    const phone = normalizePhone(order.customerPhone);
    const buyerName = (order.customerName || "").trim() || "Клієнт";

    // Build buyer — only include email if valid and non-empty
    const buyer: KeyCRMOrderCreate["buyer"] = {
      full_name: buyerName,
      phone,
    };
    if (order.customerEmail && order.customerEmail.trim() && order.customerEmail.includes("@")) {
      buyer.email = order.customerEmail.trim();
    }

    // Build products — ensure numeric types
    const products = order.items.map((item) => {
      const product: KeyCRMOrderCreate["products"][0] = {
        name: (item.name || "").trim() || "Товар",
        sku: item.sku || undefined,
        price: Number(toHryvni(item.price)) || 0,
        quantity: Number(item.quantity) || 1,
      };
      if (item.imageUrl) {
        product.picture = item.imageUrl;
      }
      return stripUndefined(product);
    });

    // Build shipping — use empty strings instead of undefined for optional fields
    const shipping = stripUndefined({
      delivery_service: deliveryService,
      shipping_address_city: order.deliveryCity || "",
      shipping_address: order.deliveryBranchName || order.deliveryAddress || "",
      recipient_full_name: buyerName,
      recipient_phone: phone,
    });

    // Build order payload
    const keycrmOrder: KeyCRMOrderCreate = {
      source_id: sourceId,
      buyer,
      products,
      shipping,
    };

    // Add comment only if present
    if (order.comment && order.comment.trim()) {
      keycrmOrder.buyer_comment = order.comment.trim();
    }

    // Add UTM only if present (avoid empty strings)
    if (order.utmSource) keycrmOrder.utm_source = order.utmSource;
    if (order.utmMedium) keycrmOrder.utm_medium = order.utmMedium;
    if (order.utmCampaign) keycrmOrder.utm_campaign = order.utmCampaign;
    if (order.utmTerm) keycrmOrder.utm_term = order.utmTerm;
    if (order.utmContent) keycrmOrder.utm_content = order.utmContent;

    // Add manager_comment with local order reference
    keycrmOrder.manager_comment = `Замовлення з сайту: ${order.orderNumber}`;

    // Attach payment if paid
    if (order.paymentStatus === "paid") {
      keycrmOrder.payments = [
        {
          payment_method: this.mapPaymentMethod(order.paymentMethod),
          amount: Number(toHryvni(order.total)) || 0,
          status: "paid",
          description: order.externalPaymentId
            ? `WayForPay: ${order.externalPaymentId}`
            : "Оплата карткою",
        },
      ];
    }

    return keycrmOrder;
  }

  static mapDeliveryService(method: string): string {
    const mapping: Record<string, string> = {
      nova_poshta_branch: "nova_poshta",
      nova_poshta_courier: "nova_poshta_courier",
    };
    return mapping[method] || "other";
  }

  static mapPaymentMethod(method: string): string {
    const mapping: Record<string, string> = {
      card_online: "card",
    };
    return mapping[method] || "other";
  }
}
