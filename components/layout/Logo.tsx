import Link from "next/link";

interface LogoProps {
  logoUrl?: string | null;
  siteName?: string;
  mobileTitle?: string;
  showNameOnMobile?: boolean;
}

export function Logo({ logoUrl, siteName = "Нестерчук Анатолій", mobileTitle, showNameOnMobile = true }: LogoProps) {
  const mobileName = mobileTitle || siteName;

  return (
    <Link href="/" className="flex items-center gap-2 group min-w-0 flex-1 sm:flex-none">
      {logoUrl ? (
        <img src={logoUrl} alt="Логотип" className="h-10 w-auto object-contain flex-shrink-0" />
      ) : (
        <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold text-sm group-hover:bg-green-700 transition-colors flex-shrink-0">
          НА
        </div>
      )}
      {showNameOnMobile ? (
        <>
          {/* Mobile: uses available space, wraps to 2 lines if needed */}
          <span className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2 block sm:hidden">
            {mobileName}
          </span>
          {/* Desktop: full title, single line */}
          <span className="font-semibold text-gray-900 hidden sm:block whitespace-nowrap">
            {siteName}
          </span>
        </>
      ) : (
        <span className="font-semibold text-gray-900 hidden sm:block whitespace-nowrap">
          {siteName}
        </span>
      )}
    </Link>
  );
}
