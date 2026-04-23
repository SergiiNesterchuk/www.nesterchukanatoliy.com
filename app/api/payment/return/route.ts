import { NextRequest, NextResponse } from "next/server";
import { buildAbsoluteUrl } from "@/shared/url";

/**
 * WayForPay redirects user back via POST to returnUrl.
 * This API route handles POST/GET, extracts order reference,
 * and redirects to success page using PUBLIC domain (not internal localhost).
 */
export async function POST(request: NextRequest) {
  const order = request.nextUrl.searchParams.get("order") || "";

  let orderRef = order;
  try {
    const formData = await request.formData();
    const bodyOrder = formData.get("orderReference") as string;
    if (bodyOrder && !orderRef) orderRef = bodyOrder;
  } catch {
    // Not form data, ignore
  }

  const successUrl = orderRef
    ? buildAbsoluteUrl(`/checkout/success?order=${orderRef}`)
    : buildAbsoluteUrl("/checkout/success");

  return NextResponse.redirect(successUrl, 303);
}

export async function GET(request: NextRequest) {
  const order = request.nextUrl.searchParams.get("order") || "";

  const successUrl = order
    ? buildAbsoluteUrl(`/checkout/success?order=${order}`)
    : buildAbsoluteUrl("/checkout/success");

  return NextResponse.redirect(successUrl, 302);
}
