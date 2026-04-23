import { NextRequest, NextResponse } from "next/server";

/**
 * WayForPay redirects user back via POST to returnUrl.
 * Next.js 16 App Router interprets POST to a page route as server action.
 * This API route handles the POST, extracts order reference, and redirects via GET.
 */
export async function POST(request: NextRequest) {
  const order = request.nextUrl.searchParams.get("order") || "";

  // Also try to extract from form body (WayForPay may send data in body)
  let orderRef = order;
  try {
    const formData = await request.formData();
    const bodyOrder = formData.get("orderReference") as string;
    if (bodyOrder && !orderRef) orderRef = bodyOrder;
  } catch {
    // Not form data, ignore
  }

  const redirectUrl = new URL("/checkout/success", request.url);
  if (orderRef) redirectUrl.searchParams.set("order", orderRef);

  return NextResponse.redirect(redirectUrl, 303); // 303 = See Other (GET after POST)
}

export async function GET(request: NextRequest) {
  const order = request.nextUrl.searchParams.get("order") || "";
  const redirectUrl = new URL("/checkout/success", request.url);
  if (order) redirectUrl.searchParams.set("order", order);
  return NextResponse.redirect(redirectUrl, 302);
}
