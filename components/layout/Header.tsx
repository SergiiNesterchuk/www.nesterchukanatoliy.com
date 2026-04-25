import { TopBar } from "./TopBar";
import { Logo } from "./Logo";
import { Navigation } from "./Navigation";
import { MobileMenu } from "./MobileMenu";
import { CartIcon } from "@/components/cart/CartIcon";
import { CategoryService } from "@/services/CategoryService";
import { PageRepository } from "@/repositories/PageRepository";
import { prisma } from "@/shared/db";
import { SITE_NAME } from "@/shared/constants";

export async function Header() {
  let categories: Awaited<ReturnType<typeof CategoryService.getAll>> = [];
  let headerPages: { title: string; slug: string }[] = [];
  let mobilePages: { title: string; slug: string }[] = [];
  let logoUrl: string | null = null;
  let siteName = SITE_NAME;
  let showNameOnMobile = true;
  let mobileTitle = "";
  let phoneEnabled = true;
  let phoneText = "";
  let phoneNumber = "";
  let phoneLinkType = "viber";

  try {
    const [cats, navPages, mobPages, settingsList] = await Promise.all([
      CategoryService.getAll(),
      PageRepository.findForNav(),
      PageRepository.findForMobile(),
      prisma.settings.findMany({
        where: { key: { in: [
          "site_logo_url", "site_name", "site_mobile_title",
          "header_show_site_name_mobile",
          "topbar_phone", "topbar_phone_label", "topbar_phone_link_type", "topbar_show_phone",
        ] } },
      }),
    ]);
    categories = cats;
    headerPages = navPages;
    mobilePages = mobPages;

    for (const s of settingsList) {
      const v = s.value ?? "";
      switch (s.key) {
        case "site_logo_url": logoUrl = v || null; break;
        case "site_name": if (v) siteName = v; break;
        case "site_mobile_title": mobileTitle = v; break;
        case "header_show_site_name_mobile": showNameOnMobile = v !== "false"; break;
        case "topbar_phone": phoneNumber = v; break;
        case "topbar_phone_label": phoneText = v; break;
        case "topbar_phone_link_type": phoneLinkType = v || "viber"; break;
        case "topbar_show_phone": phoneEnabled = v !== "false"; break;
      }
    }
  } catch { /* DB unavailable */ }

  return (
    <header className="sticky top-0 z-30 bg-white">
      <TopBar />
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 md:gap-6 min-w-0">
            <MobileMenu
              categories={categories}
              pages={mobilePages}
              siteName={siteName}
              phoneEnabled={phoneEnabled}
              phoneText={phoneText}
              phoneNumber={phoneNumber}
              phoneLinkType={phoneLinkType}
            />
            <Logo logoUrl={logoUrl} siteName={siteName} mobileTitle={mobileTitle} showNameOnMobile={showNameOnMobile} />
            <Navigation categories={categories} pages={headerPages} />
          </div>
          <div className="flex items-center gap-1">
            <a href="/account/orders" className="p-2 text-gray-700 hover:text-green-600 transition-colors" aria-label="Мої замовлення">
              <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
