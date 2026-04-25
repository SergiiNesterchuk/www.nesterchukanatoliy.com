import Link from "next/link";

interface LogoProps {
  logoUrl?: string | null;
  siteName?: string;
  mobileTitle?: string;
  showNameOnMobile?: boolean;
}

export function Logo({ logoUrl, siteName = "Нестерчук Анатолій", mobileTitle, showNameOnMobile = true }: LogoProps) {
  return (
    <Link href="/" className="flex items-center gap-2 group min-w-0">
      {logoUrl ? (
        <img src={logoUrl} alt="Логотип" className="h-10 w-auto object-contain flex-shrink-0" />
      ) : (
        <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold text-sm group-hover:bg-green-700 transition-colors flex-shrink-0">
          НА
        </div>
      )}
      {showNameOnMobile ? (
        <>
          {/* Mobile: short title with smaller font */}
          <span className="font-semibold text-gray-900 text-sm truncate max-w-[120px] block sm:hidden">
            {mobileTitle || siteName}
          </span>
          {/* Desktop: full title */}
          <span className="font-semibold text-gray-900 hidden sm:block">
            {siteName}
          </span>
        </>
      ) : (
        <span className="font-semibold text-gray-900 hidden sm:block">
          {siteName}
        </span>
      )}
    </Link>
  );
}
