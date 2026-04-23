import { TopBar } from "./TopBar";
import { Logo } from "./Logo";
import { Navigation } from "./Navigation";
import { MobileMenu } from "./MobileMenu";
import { CartIcon } from "@/components/cart/CartIcon";
import { CategoryService } from "@/services/CategoryService";
import { PageRepository } from "@/repositories/PageRepository";

export async function Header() {
  let categories: Awaited<ReturnType<typeof CategoryService.getAll>> = [];
  let pages: { title: string; slug: string }[] = [];
  try {
    [categories, pages] = await Promise.all([
      CategoryService.getAll(),
      PageRepository.findForNav(),
    ]);
  } catch {
    // DB may be unavailable during build
  }

  return (
    <header className="sticky top-0 z-30 bg-white">
      <TopBar />
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <MobileMenu categories={categories} pages={pages} />
            <Logo />
            <Navigation categories={categories} pages={pages} />
          </div>
          <CartIcon />
        </div>
      </div>
    </header>
  );
}
