"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu, X, ArrowLeft, LogOut,
  LayoutDashboard, Package, FolderOpen, FileText,
  ShoppingCart, AlertCircle, Settings, CornerDownRight,
  Home, CreditCard, Star,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/banners", label: "Головна сторінка", icon: Home },
  { href: "/admin/products", label: "Товари", icon: Package },
  { href: "/admin/categories", label: "Категорії", icon: FolderOpen },
  { href: "/admin/orders", label: "Замовлення", icon: ShoppingCart },
  { href: "/admin/reviews", label: "Відгуки", icon: Star },
  { href: "/admin/blog", label: "Блог", icon: FileText },
  { href: "/admin/pages", label: "Сторінки", icon: FileText },
  { href: "/admin/payment-methods", label: "Оплата", icon: CreditCard },
  { href: "/admin/redirects", label: "Redirects", icon: CornerDownRight },
  { href: "/admin/branding", label: "Брендинг", icon: Home },
  { href: "/admin/integration-logs", label: "Інтеграції", icon: AlertCircle },
  { href: "/admin/settings", label: "Налаштування", icon: Settings },
];

export function AdminMobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-40 bg-white border-b px-4 py-3 flex items-center justify-between">
        <button onClick={() => setOpen(true)} className="p-1 -ml-1 text-gray-700">
          <Menu className="h-6 w-6" />
        </button>
        <span className="font-bold text-gray-900 text-sm">Адмін-панель</span>
        <Link href="/" className="text-gray-400 text-xs">На сайт</Link>
      </div>

      {/* Overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-72 max-w-[85vw] bg-white flex flex-col h-full shadow-xl">
            <div className="p-4 border-b flex items-center justify-between">
              <span className="font-bold text-gray-900">Меню</span>
              <button onClick={() => setOpen(false)} className="p-1 text-gray-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors ${
                      isActive ? "bg-green-50 text-green-700 font-medium" : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 border-t space-y-1">
              <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500">
                <ArrowLeft className="h-4 w-4" /> На сайт
              </Link>
              <a href="/api/admin/logout" className="flex items-center gap-2 px-3 py-2 text-sm text-red-500">
                <LogOut className="h-4 w-4" /> Вийти
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
