import { NextRequest, NextResponse } from "next/server";
import { OrderService } from "@/services/OrderService";
import { WayForPayAdapter } from "@/integrations/payment/WayForPayAdapter";
import { createLogger } from "@/shared/logger";

const logger = createLogger("PaymentCallback");

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => { headers[key] = value; });

    const result = await OrderService.handlePaymentCallback(rawBody, headers);

    if (!result.accepted) {
      return NextResponse.json({ status: "error" }, { status: 400 });
    }

    // WayForPay requires signed response
    const adapter = new WayForPayAdapter();
    const responseBody = adapter.generateCallbackResponse(result.orderNumber);

    return new NextResponse(responseBody, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error("Payment callback error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
