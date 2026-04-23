import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 group">
      <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold text-sm group-hover:bg-green-700 transition-colors">
        НА
      </div>
      <span className="font-semibold text-gray-900 hidden sm:block">
        Нестерчук Анатолій
      </span>
    </Link>
  );
}
