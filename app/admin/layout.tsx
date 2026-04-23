import Link from "next/link";
import {
  LayoutDashboard,
  Package,
  FolderOpen,
  FileText,
  ShoppingCart,
  AlertCircle,
  Settings,
  ArrowLeft,
  CornerDownRight,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Товари", icon: Package },
  { href: "/admin/categories", label: "Категорії", icon: FolderOpen },
  { href: "/admin/orders", label: "Замовлення", icon: ShoppingCart },
  { href: "/admin/pages", label: "Сторінки", icon: FileText },
  { href: "/admin/redirects", label: "Redirects", icon: CornerDownRight },
  { href: "/admin/integration-logs", label: "Інтеграції", icon: AlertCircle },
  { href: "/admin/settings", label: "Налаштування", icon: Settings },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r hidden md:flex flex-col">
        <div className="p-4 border-b">
          <h1 className="font-bold text-gray-900">Адмін-панель</h1>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            На сайт
          </Link>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
