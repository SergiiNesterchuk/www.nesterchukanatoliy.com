import { NextRequest, NextResponse } from "next/server";
import { OrderService } from "@/services/OrderService";
import { createLogger } from "@/shared/logger";

const logger = createLogger("PaymentCallback");

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const result = await OrderService.handlePaymentCallback(rawBody, headers);

    if (!result.accepted) {
      return NextResponse.json({ status: "error" }, { status: 400 });
    }

    // WayForPay expects a specific response format
    return NextResponse.json({
      orderReference: "ok",
      status: "accept",
      time: Math.floor(Date.now() / 1000),
      signature: "", // WFP response signature
    });
  } catch (error) {
    logger.error("Payment callback error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
