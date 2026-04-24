export interface KeyCRMBuyer {
  id?: number;
  full_name: string;
  phone: string;
  email?: string;
  source_id?: number;
}

export interface KeyCRMOrderProduct {
  name: string;
  sku?: string;
  price: number;
  quantity: number;
  picture?: string;
}

export interface KeyCRMShipping {
  shipping_address_city?: string;
  shipping_address_country?: string;
  shipping_address_region?: string;
  shipping_address_zip?: string;
  shipping_secondary_line?: string;
  shipping_receive_point?: string;
  recipient_full_name?: string;
  recipient_phone?: string;
  warehouse_ref?: string;
  delivery_service?: string;
  delivery_service_id?: number;
  tracking_code?: string;
}

export interface KeyCRMOrderCreate {
  source_id: number;
  buyer: KeyCRMBuyer;
  products: KeyCRMOrderProduct[];
  shipping: KeyCRMShipping;
  payments?: Array<{
    payment_method: string;
    amount: number;
    status: string;
    description?: string;
  }>;
  manager_comment?: string;
  buyer_comment?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

export interface KeyCRMOrderResponse {
  id: number;
  source_id: number;
  buyer_id: number;
  status_id: number;
  created_at: string;
  updated_at: string;
}

export interface KeyCRMBuyerResponse {
  id: number;
  full_name: string;
  phone: string[];
  email: string[];
}

export interface KeyCRMPaymentAttach {
  payment_method: string;
  amount: number;
  status: string;
  description?: string;
}
