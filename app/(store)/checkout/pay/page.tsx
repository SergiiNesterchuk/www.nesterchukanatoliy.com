import { Suspense } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { PaymentRedirect } from "./PaymentRedirect";

export default function CheckoutPayPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <Spinner className="mx-auto mb-4 h-8 w-8" />
          <p className="text-gray-600">Підготовка оплати...</p>
        </div>
      }
    >
      <PaymentRedirect />
    </Suspense>
  );
}
