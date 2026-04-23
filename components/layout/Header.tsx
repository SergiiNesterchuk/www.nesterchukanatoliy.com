import { TopBar } from "./TopBar";
import { Logo } from "./Logo";
import { Navigation } from "./Navigation";
import { MobileMenu } from "./MobileMenu";
import { CartIcon } from "@/components/cart/CartIcon";
import { CategoryService } from "@/services/CategoryService";

export async function Header() {
  let categories: Awaited<ReturnType<typeof CategoryService.getAll>> = [];
  try {
    categories = await CategoryService.getAll();
  } catch {
    // DB may be unavailable during build
  }

  return (
    <header className="sticky top-0 z-30 bg-white">
      <TopBar />
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <MobileMenu categories={categories} />
            <Logo />
            <Navigation categories={categories} />
          </div>
          <CartIcon />
        </div>
      </div>
    </header>
  );
}
