"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Phone } from "lucide-react";
import { CONTACT } from "@/shared/constants";
import type { CategoryListItem } from "@/entities/category";

interface MobileMenuProps {
  categories: CategoryListItem[];
  pages: { title: string; slug: string }[];
}

export function MobileMenu({ categories, pages }: MobileMenuProps) {
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
              {pages.map((page) => (
                <Link key={page.slug} href={`/${page.slug}/`} onClick={close} className="block py-2 text-gray-700 hover:text-green-600">
                  {page.title}
                </Link>
              ))}
            </nav>

            <div className="p-4 border-t space-y-3">
              <a href={`viber://chat?number=${CONTACT.phone.replace("+", "%2B")}`} className="flex items-center gap-2 bg-purple-600 text-white rounded-lg px-4 py-2.5 font-medium text-sm">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.398.002C9.473.028 5.292.344 3.013 2.467 1.258 4.223.518 6.789.39 9.957c-.128 3.168-.298 9.107 5.6 10.765h.003l-.004 2.456s-.036.994.616 1.198c.79.247 1.254-.508 2.01-1.318.414-.444.985-1.095 1.415-1.593 3.904.328 6.905-.42 7.244-.533.783-.26 5.21-.82 5.933-6.694.746-6.054-.358-9.876-2.347-11.593C19.086.95 15.276-.084 11.398.002zm.297 1.931c3.457-.098 6.725.794 8.244 2.065 1.655 1.387 2.603 4.756 1.964 10.017-.601 4.893-4.201 5.266-4.87 5.489-.281.093-2.89.746-6.218.543 0 0-2.464 2.974-3.233 3.752-.12.122-.261.17-.355.145-.133-.035-.17-.194-.168-.428l.024-4.073c-4.907-1.378-4.62-6.344-4.512-9.06.107-2.716.723-4.908 2.203-6.378 1.954-1.837 5.48-2.04 6.92-2.072zM12 5.459c-.164 0-.328.009-.49.026a.486.486 0 00-.093.964.482.482 0 00.562-.393c.278-.023.558-.023.837.003a.486.486 0 10.098-.965A5.7 5.7 0 0012 5.46zm2.845 1.233a.487.487 0 00-.38.787c.537.658.829 1.412.862 2.222a.487.487 0 00.972-.04c-.04-.97-.389-1.87-1.03-2.654a.487.487 0 00-.424-.315z"/></svg>
                Написати у Viber
              </a>
              <a href={`tel:${CONTACT.phone}`} className="flex items-center gap-2 text-gray-600 text-sm">
                <Phone className="h-4 w-4" />
                {CONTACT.phoneDisplay}
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
