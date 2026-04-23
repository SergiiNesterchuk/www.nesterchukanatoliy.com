import { NextRequest, NextResponse } from "next/server";
import { IntegrationLogRepository } from "@/repositories/IntegrationLogRepository";
import { createLogger } from "@/shared/logger";

const logger = createLogger("KeyCRM:Webhook");

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Log incoming webhook
    await IntegrationLogRepository.create({
      integration: "keycrm",
      direction: "inbound",
      method: "WEBHOOK",
      endpoint: "/api/keycrm/webhook",
      requestBody: rawBody.substring(0, 5000),
      responseStatus: 200,
    });

    logger.info("KeyCRM webhook received", {
      bodyLength: rawBody.length,
    });

    // Process webhook based on event type
    // KeyCRM webhooks can notify about order status changes, etc.
    // For MVP, we just log them

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    logger.error("KeyCRM webhook error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
