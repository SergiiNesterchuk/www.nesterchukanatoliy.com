"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Phone } from "lucide-react";
import { CONTACT, SOCIAL } from "@/shared/constants";
import type { CategoryListItem } from "@/entities/category";

interface MobileMenuProps {
  categories: CategoryListItem[];
}

export function MobileMenu({ categories }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const close = () => setIsOpen(false);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-700"
        aria-label="Меню"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={close} />
          <div className="fixed top-0 left-0 h-full w-72 bg-white z-50 shadow-xl overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <span className="font-semibold">Меню</span>
              <button onClick={close} className="p-1" aria-label="Закрити">
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="p-4 space-y-1">
              <Link href="/katalog/" onClick={close} className="block py-2 text-gray-900 font-medium hover:text-green-600">
                Каталог
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/${cat.slug}/`}
                  onClick={close}
                  className="block py-2 pl-4 text-gray-700 hover:text-green-600"
                >
                  {cat.name}
                </Link>
              ))}
              <div className="border-t my-3" />
              <Link href="/pro-nas/" onClick={close} className="block py-2 text-gray-700 hover:text-green-600">
                Про нас
              </Link>
              <Link href="/oplata-i-dostavka/" onClick={close} className="block py-2 text-gray-700 hover:text-green-600">
                Оплата і доставка
              </Link>
              <Link href="/kontaktna-informatsiya/" onClick={close} className="block py-2 text-gray-700 hover:text-green-600">
                Контакти
              </Link>
              <Link href="/blog/" onClick={close} className="block py-2 text-gray-700 hover:text-green-600">
                Блог
              </Link>
            </nav>

            <div className="p-4 border-t space-y-3">
              <a href={`tel:${CONTACT.phone}`} className="flex items-center gap-2 text-green-600 font-medium">
                <Phone className="h-4 w-4" />
                {CONTACT.phoneDisplay}
              </a>
              <div className="flex gap-3 text-sm text-gray-500">
                <a href={SOCIAL.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>
                <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer">YouTube</a>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
