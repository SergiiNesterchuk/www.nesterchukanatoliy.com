export interface PaymentSession {
  sessionId: string;
  paymentUrl: string;
  provider: string;
  amount: number;
  currency: string;
  orderNumber: string;
}

export interface PaymentCallbackData {
  provider: string;
  rawBody: string;
  headers: Record<string, string>;
}

export interface PaymentResult {
  success: boolean;
  orderNumber: string;
  externalPaymentId: string;
  amount: number;
  currency: string;
  status: "success" | "failure" | "pending";
  rawPayload: string;
  signatureValid: boolean;
}

export interface PaymentProviderInterface {
  readonly providerName: string;

  createPaymentSession(params: {
    orderNumber: string;
    amount: number;
    currency: string;
    description: string;
    returnUrl: string;
    callbackUrl: string;
    customerEmail?: string;
    items: Array<{
      name: string;
      quantity: number;
      price: number;
    }>;
  }): Promise<PaymentSession>;

  verifyCallback(data: PaymentCallbackData): Promise<PaymentResult>;
}
