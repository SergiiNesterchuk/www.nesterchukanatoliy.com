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

export class KeyCRMMapper {
  static mapOrderToKeycrm(
    order: LocalOrder,
    sourceId: number
  ): KeyCRMOrderCreate {
    const deliveryService = this.mapDeliveryService(order.deliveryMethod);

    const keycrmOrder: KeyCRMOrderCreate = {
      source_id: sourceId,
      buyer: {
        full_name: order.customerName,
        phone: order.customerPhone,
        ...(order.customerEmail ? { email: order.customerEmail } : {}),
      },
      products: order.items.map((item) => ({
        name: item.name,
        sku: item.sku,
        price: toHryvni(item.price),
        quantity: item.quantity,
        ...(item.imageUrl ? { picture: item.imageUrl } : {}),
      })),
      shipping: {
        delivery_service: deliveryService,
        shipping_address_city: order.deliveryCity || undefined,
        shipping_address:
          order.deliveryBranchName || order.deliveryAddress || undefined,
        recipient_full_name: order.customerName,
        recipient_phone: order.customerPhone,
      },
      buyer_comment: order.comment || undefined,
      ...(order.utmSource ? { utm_source: order.utmSource } : {}),
      ...(order.utmMedium ? { utm_medium: order.utmMedium } : {}),
      ...(order.utmCampaign ? { utm_campaign: order.utmCampaign } : {}),
      ...(order.utmTerm ? { utm_term: order.utmTerm } : {}),
      ...(order.utmContent ? { utm_content: order.utmContent } : {}),
      custom_fields: {
        local_order_number: order.orderNumber,
      },
    };

    // Attach payment if paid
    if (order.paymentStatus === "paid") {
      keycrmOrder.payments = [
        {
          payment_method: this.mapPaymentMethod(order.paymentMethod),
          amount: toHryvni(order.total),
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
