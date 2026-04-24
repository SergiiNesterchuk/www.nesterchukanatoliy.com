import { NextRequest, NextResponse } from "next/server";
import { buildAbsoluteUrl } from "@/shared/url";
import { createLogger } from "@/shared/logger";

const logger = createLogger("PaymentReturn");

/**
 * WayForPay redirects user back via POST to returnUrl.
 * Extracts order ref and redirects to success page.
 */
export async function POST(request: NextRequest) {
  const order = request.nextUrl.searchParams.get("order") || "";

  let orderRef = order;
  try {
    const formData = await request.formData();
    const bodyOrder = formData.get("orderReference") as string;
    if (bodyOrder && !orderRef) orderRef = bodyOrder;
  } catch { /* Not form data */ }

  logger.info("Payment return POST", { orderRef });

  const successUrl = orderRef
    ? buildAbsoluteUrl(`/checkout/success?order=${orderRef}`)
    : buildAbsoluteUrl("/checkout/success");

  return NextResponse.redirect(successUrl, 303);
}

export async function GET(request: NextRequest) {
  const order = request.nextUrl.searchParams.get("order") || "";

  logger.info("Payment return GET", { order });

  const successUrl = order
    ? buildAbsoluteUrl(`/checkout/success?order=${order}`)
    : buildAbsoluteUrl("/checkout/success");

  return NextResponse.redirect(successUrl, 302);
}
