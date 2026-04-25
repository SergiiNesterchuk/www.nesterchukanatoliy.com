import Link from "next/link";

interface LogoProps {
  logoUrl?: string | null;
  siteName?: string;
  showNameOnMobile?: boolean;
}

export function Logo({ logoUrl, siteName = "Нестерчук Анатолій", showNameOnMobile = true }: LogoProps) {
  return (
    <Link href="/" className="flex items-center gap-2 group min-w-0">
      {logoUrl ? (
        <img src={logoUrl} alt="Логотип" className="h-10 w-auto object-contain flex-shrink-0" />
      ) : (
        <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold text-sm group-hover:bg-green-700 transition-colors flex-shrink-0">
          НА
        </div>
      )}
      <span className={`font-semibold text-gray-900 truncate max-w-[140px] sm:max-w-none ${showNameOnMobile ? "block" : "hidden sm:block"}`}>
        {siteName}
      </span>
    </Link>
  );
}
