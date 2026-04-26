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
  Home,
  CreditCard,
  Star,
  LogOut,
} from "lucide-react";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/banners", label: "Головна сторінка", icon: Home },
  { href: "/admin/products", label: "Товари", icon: Package },
  { href: "/admin/categories", label: "Категорії", icon: FolderOpen },
  { href: "/admin/orders", label: "Замовлення", icon: ShoppingCart },
  { href: "/admin/reviews", label: "Відгуки", icon: Star },
  { href: "/admin/pages", label: "Сторінки", icon: FileText },
  { href: "/admin/payment-methods", label: "Оплата", icon: CreditCard },
  { href: "/admin/redirects", label: "Redirects", icon: CornerDownRight },
  { href: "/admin/branding", label: "Брендинг", icon: Home },
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
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-white border-r hidden md:flex flex-col flex-shrink-0">
        <div className="p-4 border-b">
          <h1 className="font-bold text-gray-900">Адмін-панель</h1>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
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
        <div className="p-3 border-t space-y-1">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            На сайт
          </Link>
          <a
            href="/api/admin/logout"
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:text-red-700"
          >
            <LogOut className="h-4 w-4" />
            Вийти
          </a>
        </div>
      </aside>

      {/* Content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile navigation */}
        <AdminMobileNav />

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
