"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Phone } from "lucide-react";
import type { CategoryListItem } from "@/entities/category";

interface MobileMenuProps {
  categories: CategoryListItem[];
  pages: { title: string; slug: string }[];
  siteName?: string;
  phoneEnabled?: boolean;
  phoneText?: string;
  phoneNumber?: string;
  phoneLinkType?: string;
}

export function MobileMenu({ categories, pages, siteName, phoneEnabled = true, phoneText, phoneNumber, phoneLinkType = "tel" }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const close = () => setIsOpen(false);

  const phoneHref = phoneNumber
    ? phoneLinkType === "viber"
      ? `viber://chat?number=${phoneNumber.replace(/[\s\-\(\)]/g, "").replace("+", "%2B")}`
      : `tel:${phoneNumber.replace(/[\s\-\(\)]/g, "")}`
    : "";

  return (
    <div className="md:hidden">
      <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-gray-700" aria-label="Меню">
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={close} />
          <div className="fixed top-0 left-0 h-full w-72 bg-white z-50 shadow-xl overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <span className="font-semibold text-gray-900">{siteName || "Меню"}</span>
              <button onClick={close} className="p-1" aria-label="Закрити">
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="p-4 space-y-1">
              <Link href="/katalog/" onClick={close} className="block py-2 text-gray-900 font-medium hover:text-green-600">
                Каталог
              </Link>
              {categories.map((cat) => (
                <Link key={cat.id} href={`/${cat.slug}/`} onClick={close} className="block py-2 pl-4 text-gray-700 hover:text-green-600">
                  {cat.name}
                </Link>
              ))}
              <div className="border-t my-3" />
              {pages.map((page) => (
                <Link key={page.slug} href={`/${page.slug}/`} onClick={close} className="block py-2 text-gray-700 hover:text-green-600">
                  {page.title}
                </Link>
              ))}
            </nav>

            <div className="p-4 border-t space-y-3">
              <Link href="/account/orders" onClick={close} className="flex items-center gap-2 bg-green-600 text-white rounded-lg px-4 py-2.5 font-medium text-sm">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                Мій кабінет
              </Link>

              {phoneEnabled && phoneNumber && (
                <a href={phoneHref} className={`flex items-center gap-2 rounded-lg px-4 py-2.5 font-medium text-sm ${phoneLinkType === "viber" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-700"}`}>
                  {phoneLinkType === "viber" ? (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.398.002C9.473.028 5.292.344 3.013 2.467 1.258 4.223.518 6.789.39 9.957c-.128 3.168-.298 9.107 5.6 10.765h.003l-.004 2.456s-.036.994.616 1.198c.79.247 1.254-.508 2.01-1.318.414-.444.985-1.095 1.415-1.593 3.904.328 6.905-.42 7.244-.533.783-.26 5.21-.82 5.933-6.694.746-6.054-.358-9.876-2.347-11.593C19.086.95 15.276-.084 11.398.002z"/></svg>
                  ) : (
                    <Phone className="h-5 w-5" />
                  )}
                  {phoneText ? `${phoneText} ${phoneNumber}` : phoneNumber}
                </a>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
