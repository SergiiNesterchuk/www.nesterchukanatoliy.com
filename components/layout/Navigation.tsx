import Link from "next/link";
import type { CategoryListItem } from "@/entities/category";

interface NavigationProps {
  categories: CategoryListItem[];
  pages: { title: string; slug: string }[];
}

export function Navigation({ categories, pages }: NavigationProps) {
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
      {pages.slice(0, 3).map((page) => (
        <Link
          key={page.slug}
          href={`/${page.slug}/`}
          className="text-sm font-medium text-gray-700 hover:text-green-600 transition-colors"
        >
          {page.title}
        </Link>
      ))}
    </nav>
  );
}
