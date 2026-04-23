import crypto from "crypto";
import type {
  PaymentProviderInterface,
  PaymentSession,
  PaymentCallbackData,
  PaymentResult,
} from "./PaymentProviderInterface";
import { createLogger } from "@/shared/logger";

const logger = createLogger("WayForPay");

export class WayForPayAdapter implements PaymentProviderInterface {
  readonly providerName = "wayforpay";

  private merchantAccount: string;
  private merchantSecret: string;
  private merchantDomain: string;

  constructor() {
    this.merchantAccount = process.env.WAYFORPAY_MERCHANT_ACCOUNT || "";
    this.merchantSecret = process.env.WAYFORPAY_MERCHANT_SECRET || "";
    this.merchantDomain = process.env.WAYFORPAY_MERCHANT_DOMAIN || "";
  }

  async createPaymentSession(params: {
    orderNumber: string;
    amount: number;
    currency: string;
    description: string;
    returnUrl: string;
    callbackUrl: string;
    customerEmail?: string;
    items: Array<{ name: string; quantity: number; price: number }>;
  }): Promise<PaymentSession> {
    const orderDate = Math.floor(Date.now() / 1000);
    const productNames = params.items.map((i) => i.name);
    const productPrices = params.items.map((i) => i.price / 100); // kopiyky to hryvni
    const productCounts = params.items.map((i) => i.quantity);

    const signatureString = [
      this.merchantAccount,
      this.merchantDomain,
      params.orderNumber,
      orderDate,
      params.amount / 100, // kopiyky to hryvni
      params.currency,
      ...productNames,
      ...productCounts,
      ...productPrices,
    ].join(";");

    const signature = this.hmacMd5(signatureString);

    // WayForPay uses form-based redirect or API
    // For MVP, we build a payment URL with params
    const formData = {
      merchantAccount: this.merchantAccount,
      merchantDomainName: this.merchantDomain,
      merchantSignature: signature,
      orderReference: params.orderNumber,
      orderDate: orderDate.toString(),
      amount: (params.amount / 100).toString(),
      currency: params.currency,
      productName: productNames,
      productPrice: productPrices.map(String),
      productCount: productCounts.map(String),
      returnUrl: params.returnUrl,
      serviceUrl: params.callbackUrl,
    };

    logger.info("Payment session created", {
      orderNumber: params.orderNumber,
      amount: params.amount,
    });

    return {
      sessionId: params.orderNumber,
      paymentUrl: "https://secure.wayforpay.com/pay",
      provider: this.providerName,
      amount: params.amount,
      currency: params.currency,
      orderNumber: params.orderNumber,
      ...({ formData } as Record<string, unknown>),
    };
  }

  async verifyCallback(data: PaymentCallbackData): Promise<PaymentResult> {
    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(data.rawBody);
    } catch {
      return {
        success: false,
        orderNumber: "",
        externalPaymentId: "",
        amount: 0,
        currency: "UAH",
        status: "failure",
        rawPayload: data.rawBody,
        signatureValid: false,
      };
    }

    const {
      merchantSignature,
      orderReference,
      transactionStatus,
      amount,
      currency,
      authCode,
    } = parsed;

    // Verify signature
    const signString = [
      this.merchantAccount,
      orderReference,
      amount,
      currency,
      authCode,
      parsed.cardPan || "",
      transactionStatus,
      parsed.reasonCode || "",
    ].join(";");

    const expectedSignature = this.hmacMd5(signString);
    const signatureValid = merchantSignature === expectedSignature;

    if (!signatureValid) {
      logger.warn("Invalid webhook signature", { orderNumber: orderReference });
    }

    const success = transactionStatus === "Approved" && signatureValid;

    return {
      success,
      orderNumber: orderReference || "",
      externalPaymentId: authCode || "",
      amount: Math.round(parseFloat(amount || "0") * 100),
      currency: currency || "UAH",
      status: success ? "success" : "failure",
      rawPayload: data.rawBody,
      signatureValid,
    };
  }

  private hmacMd5(data: string): string {
    return crypto
      .createHmac("md5", this.merchantSecret)
      .update(data, "utf8")
      .digest("hex");
  }
}
