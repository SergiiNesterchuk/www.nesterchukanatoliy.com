import { TopBar } from "./TopBar";
import { Logo } from "./Logo";
import { Navigation } from "./Navigation";
import { MobileMenu } from "./MobileMenu";
import { CartIcon } from "@/components/cart/CartIcon";
import { CategoryService } from "@/services/CategoryService";
import { PageRepository } from "@/repositories/PageRepository";
import { prisma } from "@/shared/db";

export async function Header() {
  let categories: Awaited<ReturnType<typeof CategoryService.getAll>> = [];
  let headerPages: { title: string; slug: string }[] = [];
  let mobilePages: { title: string; slug: string }[] = [];
  let logoUrl: string | null = null;
  try {
    const [cats, navPages, mobPages, logoSetting] = await Promise.all([
      CategoryService.getAll(),
      PageRepository.findForNav(),
      PageRepository.findForMobile(),
      prisma.settings.findUnique({ where: { key: "site_logo_url" } }),
    ]);
    categories = cats;
    headerPages = navPages;
    mobilePages = mobPages;
    logoUrl = logoSetting?.value || null;
  } catch {
    // DB may be unavailable during build
  }

  return (
    <header className="sticky top-0 z-30 bg-white">
      <TopBar />
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <MobileMenu categories={categories} pages={mobilePages} />
            <Logo logoUrl={logoUrl} />
            <Navigation categories={categories} pages={headerPages} />
          </div>
          <div className="flex items-center gap-2">
            <a href="/account/orders" className="p-2 text-gray-700 hover:text-green-600 transition-colors" aria-label="Мої замовлення">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </a>
            <CartIcon />
          </div>
        </div>
      </div>
    </header>
  );
}
