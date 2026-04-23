import crypto from "crypto";
import type {
  PaymentProviderInterface,
  PaymentSession,
  PaymentCallbackData,
  PaymentResult,
} from "./PaymentProviderInterface";
import { createLogger } from "@/shared/logger";
import { toHryvni } from "@/shared/money";

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
    const productPrices = params.items.map((i) => toHryvni(i.price));
    const productCounts = params.items.map((i) => i.quantity);
    const amount = toHryvni(params.amount);

    // Signature: merchantAccount;merchantDomainName;orderReference;orderDate;amount;currency;productName[i];productCount[i];productPrice[i]
    const signatureData = [
      this.merchantAccount,
      this.merchantDomain,
      params.orderNumber,
      orderDate,
      amount,
      params.currency,
      ...productNames,
      ...productCounts,
      ...productPrices,
    ];
    const signature = this.hmacMd5(signatureData.join(";"));

    const formFields: Record<string, string | string[]> = {
      merchantAccount: this.merchantAccount,
      merchantDomainName: this.merchantDomain,
      merchantSignature: signature,
      merchantTransactionSecureType: "AUTO",
      orderReference: params.orderNumber,
      orderDate: orderDate.toString(),
      amount: amount.toString(),
      currency: params.currency,
      productName: productNames,
      productPrice: productPrices.map(String),
      productCount: productCounts.map(String),
      returnUrl: params.returnUrl,
      serviceUrl: params.callbackUrl,
      orderTimeout: "900",
      language: "UA",
    };

    logger.info("Payment session created", {
      orderNumber: params.orderNumber,
      amount,
    });

    return {
      sessionId: params.orderNumber,
      paymentUrl: "https://secure.wayforpay.com/pay",
      provider: this.providerName,
      amount: params.amount,
      currency: params.currency,
      orderNumber: params.orderNumber,
      formFields,
    } as PaymentSession & { formFields: Record<string, string | string[]> };
  }

  async verifyCallback(data: PaymentCallbackData): Promise<PaymentResult> {
    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(data.rawBody);
    } catch {
      logger.warn("Invalid callback JSON");
      return this.failedResult(data.rawBody);
    }

    const {
      merchantSignature,
      orderReference,
      transactionStatus,
      amount,
      currency,
      authCode,
      reasonCode,
      cardPan,
    } = parsed;

    // Response signature: merchantAccount;orderReference;amount;currency;authCode;cardPan;transactionStatus;reasonCode
    const signString = [
      this.merchantAccount,
      orderReference || "",
      amount || "",
      currency || "",
      authCode || "",
      cardPan || "",
      transactionStatus || "",
      reasonCode || "",
    ].join(";");

    const expectedSignature = this.hmacMd5(signString);
    const signatureValid = merchantSignature === expectedSignature;

    if (!signatureValid) {
      logger.warn("Invalid webhook signature", { orderNumber: orderReference });
    }

    const isApproved = transactionStatus === "Approved";
    const success = isApproved && signatureValid;

    let status: "success" | "failure" | "pending" = "failure";
    if (success) status = "success";
    else if (transactionStatus === "Pending" || transactionStatus === "InProcessing") status = "pending";

    return {
      success,
      orderNumber: orderReference || "",
      externalPaymentId: authCode || parsed.transactionId || "",
      amount: Math.round(parseFloat(amount || "0") * 100),
      currency: currency || "UAH",
      status,
      rawPayload: data.rawBody,
      signatureValid,
    };
  }

  generateCallbackResponse(orderReference: string): string {
    const time = Math.floor(Date.now() / 1000);
    const signString = `${orderReference};accept;${time}`;
    const signature = this.hmacMd5(signString);
    return JSON.stringify({
      orderReference,
      status: "accept",
      time,
      signature,
    });
  }

  private failedResult(rawBody: string): PaymentResult {
    return {
      success: false,
      orderNumber: "",
      externalPaymentId: "",
      amount: 0,
      currency: "UAH",
      status: "failure",
      rawPayload: rawBody,
      signatureValid: false,
    };
  }

  private hmacMd5(data: string): string {
    return crypto
      .createHmac("md5", this.merchantSecret)
      .update(data, "utf8")
      .digest("hex");
  }
}
