import { NextRequest, NextResponse } from "next/server";
import { OrderService } from "@/services/OrderService";
import { WayForPayAdapter } from "@/integrations/payment/WayForPayAdapter";
import { createLogger } from "@/shared/logger";

const logger = createLogger("PaymentCallback");

export async function POST(request: NextRequest) {
  let rawBody = "";
  try {
    rawBody = await request.text();

    logger.info("Payment callback received", {
      bodyLength: rawBody.length,
      bodyPreview: rawBody.substring(0, 200),
    });

    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => { headers[key] = value; });

    const result = await OrderService.handlePaymentCallback(rawBody, headers);

    logger.info("Payment callback processed", {
      accepted: result.accepted,
      orderNumber: result.orderNumber,
    });

    if (!result.accepted) {
      return NextResponse.json({ status: "error" }, { status: 400 });
    }

    // WayForPay requires signed response
    const adapter = new WayForPayAdapter();
    const responseBody = adapter.generateCallbackResponse(result.orderNumber);

    logger.info("Payment callback response", {
      orderNumber: result.orderNumber,
      responsePreview: responseBody.substring(0, 100),
    });

    return new NextResponse(responseBody, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error("Payment callback CRITICAL ERROR", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
      bodyPreview: rawBody.substring(0, 200),
    });
    // Still return 200 with accept to prevent WayForPay retries
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
