import Link from "next/link";

interface LogoProps {
  logoUrl?: string | null;
}

export function Logo({ logoUrl }: LogoProps) {
  return (
    <Link href="/" className="flex items-center gap-2 group">
      {logoUrl ? (
        <img src={logoUrl} alt="Логотип" className="h-10 w-auto object-contain" />
      ) : (
        <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold text-sm group-hover:bg-green-700 transition-colors">
          НА
        </div>
      )}
      <span className="font-semibold text-gray-900 hidden sm:block">
        Нестерчук Анатолій
      </span>
    </Link>
  );
}
