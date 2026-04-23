export interface OrderCreate {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryMethod: string;
  deliveryCity?: string;
  deliveryAddress?: string;
  deliveryBranchRef?: string;
  deliveryBranchName?: string;
  comment?: string;
  paymentMethod: string;
  items: OrderItemCreate[];
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  idempotencyKey: string;
}

export interface OrderItemCreate {
  productId: string;
  quantity: number;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  total: number;
  paymentStatus: string;
  keycrmSyncStatus: string;
  createdAt: Date;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  deliveryMethod: string;
  deliveryCity: string | null;
  deliveryAddress: string | null;
  deliveryBranchName: string | null;
  comment: string | null;
  subtotal: number;
  discountTotal: number;
  deliveryCost: number;
  total: number;
  currency: string;
  paymentMethod: string;
  paymentStatus: string;
  paymentProvider: string | null;
  externalPaymentId: string | null;
  keycrmOrderId: string | null;
  keycrmSyncStatus: string;
  keycrmSyncError: string | null;
  items: OrderItemDetail[];
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItemDetail {
  id: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  lineTotal: number;
  imageUrl: string | null;
}
