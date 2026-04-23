import Link from "next/link";
import type { CategoryListItem } from "@/entities/category";

interface NavigationProps {
  categories: CategoryListItem[];
}

export function Navigation({ categories }: NavigationProps) {
  return (
    <nav className="hidden md:flex items-center gap-6">
      <Link
        href="/katalog/"
        className="text-sm font-medium text-gray-700 hover:text-green-600 transition-colors"
      >
        Каталог
      </Link>
      {categories.map((cat) => (
        <Link
          key={cat.id}
          href={`/${cat.slug}/`}
          className="text-sm font-medium text-gray-700 hover:text-green-600 transition-colors"
        >
          {cat.name}
        </Link>
      ))}
      <Link
        href="/pro-nas/"
        className="text-sm font-medium text-gray-700 hover:text-green-600 transition-colors"
      >
        Про нас
      </Link>
      <Link
        href="/blog/"
        className="text-sm font-medium text-gray-700 hover:text-green-600 transition-colors"
      >
        Блог
      </Link>
    </nav>
  );
}
