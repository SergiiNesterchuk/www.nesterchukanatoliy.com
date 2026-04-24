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
          <CartIcon />
        </div>
      </div>
    </header>
  );
}
