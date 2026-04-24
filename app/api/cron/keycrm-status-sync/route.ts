import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/db";
import { createLogger } from "@/shared/logger";
import { mapKeycrmStatus } from "@/shared/order-statuses";

const logger = createLogger("KeyCRMStatusSync");

/**
 * Cron endpoint: syncs order statuses from KeyCRM back to local DB.
 * Call: POST /api/cron/keycrm-status-sync?secret=CRON_SECRET
 */
export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (secret !== process.env.ADMIN_JWT_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.KEYCRM_STATUS_SYNC_ENABLED === "false") {
    return NextResponse.json({ skipped: true, reason: "sync disabled" });
  }

  const apiKey = process.env.KEYCRM_API_KEY;
  const baseUrl = (process.env.KEYCRM_BASE_URL || "https://openapi.keycrm.app/v1").trim().replace(/\/+$/, "");

  if (!apiKey) {
    return NextResponse.json({ skipped: true, reason: "no API key" });
  }

  try {
    // Find orders synced to KeyCRM that aren't completed/cancelled
    const orders = await prisma.order.findMany({
      where: {
        keycrmOrderId: { not: null },
        status: { notIn: ["completed", "cancelled", "returned"] },
      },
      select: { id: true, orderNumber: true, keycrmOrderId: true, status: true },
      take: 20,
    });

    let updated = 0;
    let errors = 0;

    for (const order of orders) {
      try {
        const res = await fetch(`${baseUrl}/order/${order.keycrmOrderId}`, {
          headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
        });

        if (!res.ok) {
          logger.warn("KeyCRM order fetch failed", { orderId: order.id, status: res.status });
          errors++;
          continue;
        }

        const keycrmOrder = await res.json();
        const keycrmStatusName = keycrmOrder.status?.name || keycrmOrder.status_name || "";
        const keycrmStatusId = keycrmOrder.status_id || keycrmOrder.status?.id;
        const trackingNumber = keycrmOrder.tracking_code || keycrmOrder.ttn || null;
        const newLocalStatus = mapKeycrmStatus(keycrmStatusName);

        // Only update if status changed
        if (newLocalStatus !== order.status || trackingNumber) {
          const updateData: Record<string, unknown> = {};

          if (newLocalStatus !== order.status) {
            updateData.status = newLocalStatus;
            updateData.keycrmStatusId = keycrmStatusId;
            updateData.keycrmStatusName = keycrmStatusName;

            if (newLocalStatus === "shipped" && !order.status.includes("shipped")) {
              updateData.deliveryStatus = "shipped";
              updateData.shippedAt = new Date();
            }
            if (newLocalStatus === "completed") {
              updateData.deliveryStatus = "delivered";
              updateData.deliveredAt = new Date();
            }

            // Record status change
            await prisma.orderStatusHistory.create({
              data: {
                orderId: order.id,
                source: "keycrm",
                oldStatus: order.status,
                newStatus: newLocalStatus,
                message: `KeyCRM: ${keycrmStatusName}`,
              },
            });
          }

          if (trackingNumber) {
            updateData.trackingNumber = trackingNumber;
          }

          if (Object.keys(updateData).length > 0) {
            await prisma.order.update({ where: { id: order.id }, data: updateData });
            updated++;
            logger.info("Order status synced from KeyCRM", {
              orderId: order.id,
              orderNumber: order.orderNumber,
              oldStatus: order.status,
              newStatus: newLocalStatus,
              keycrmStatus: keycrmStatusName,
              trackingNumber,
            });
          }
        }

        // Rate limit: 1 request per second
        await new Promise((r) => setTimeout(r, 1000));
      } catch (e) {
        logger.error("KeyCRM status sync error for order", {
          orderId: order.id,
          error: e instanceof Error ? e.message : String(e),
        });
        errors++;
      }
    }

    return NextResponse.json({ processed: orders.length, updated, errors });
  } catch (error) {
    logger.error("KeyCRM status sync failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
