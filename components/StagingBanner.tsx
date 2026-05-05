import { paymentsMode } from "@/shared/features";

export function StagingBanner() {
  if (process.env.NEXT_PUBLIC_APP_ENV !== "staging") return null;

  const modeLabel = paymentsMode === "mock" ? "mock-оплата" : paymentsMode === "disabled" ? "оплати вимкнені" : paymentsMode;

  return (
    <div className="bg-amber-500 text-white text-center text-sm font-medium py-1.5 px-4 z-[9999] relative">
      ТЕСТОВИЙ САЙТ — {modeLabel}, синхронізація відключена
    </div>
  );
}
