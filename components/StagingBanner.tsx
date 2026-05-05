export function StagingBanner() {
  if (process.env.NEXT_PUBLIC_APP_ENV !== "staging") return null;

  return (
    <div className="bg-amber-500 text-white text-center text-sm font-medium py-1.5 px-4 z-[9999] relative">
      ТЕСТОВИЙ САЙТ — оплати та синхронізація відключені
    </div>
  );
}
