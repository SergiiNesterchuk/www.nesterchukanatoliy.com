import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";
import { CONTACT, SITE_NAME } from "@/shared/constants";
import { PageRepository } from "@/repositories/PageRepository";
import { SocialLinks } from "./SocialLinks";
import { prisma } from "@/shared/db";

export async function Footer() {
  let pages: { title: string; slug: string }[] = [];
  let socialLinks: Record<string, string> = {};
  try {
    pages = await PageRepository.findForNav();
    const socialSettings = await prisma.settings.findMany({
      where: { key: { startsWith: "social_" } },
    });
    for (const s of socialSettings) {
      if (s.value) socialLinks[s.key.replace("social_", "")] = s.value;
    }
    // Fallback to hardcoded if no settings yet
    if (Object.keys(socialLinks).length === 0) {
      socialLinks = {
        instagram: "https://www.instagram.com/nesterchuk_anatoliy",
        youtube: "https://youtube.com/@nesterchuk_anatoliy",
        facebook: "https://www.facebook.com/profile.php?id=100025198117909",
        tiktok: "https://www.tiktok.com/@nesterchuk_anatoliy",
      };
    }
  } catch { /* DB unavailable */ }

  return (
    <footer className="bg-gray-900 text-gray-300 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About */}
          <div>
            <h3 className="text-white font-semibold mb-3">{SITE_NAME}</h3>
            <p className="text-sm leading-relaxed">
              Натуральний яблучний оцет власного виробництва та засоби для захисту саду.
            </p>
            <SocialLinks links={socialLinks} className="mt-4" />
          </div>

          {/* Navigation — dynamic from DB */}
          <div>
            <h3 className="text-white font-semibold mb-3">Покупцям</h3>
            <nav className="space-y-2 text-sm">
              <Link href="/katalog/" className="block hover:text-white transition-colors">Каталог</Link>
              {pages.map((page) => (
                <Link key={page.slug} href={`/${page.slug}/`} className="block hover:text-white transition-colors">
                  {page.title}
                </Link>
              ))}
              <Link href="/order-status/" className="block hover:text-white transition-colors">Статус замовлення</Link>
            </nav>
          </div>

          {/* Contacts */}
          <div>
            <h3 className="text-white font-semibold mb-3">Контакти</h3>
            <div className="space-y-2 text-sm">
              <a href={`tel:${CONTACT.phone}`} className="flex items-center gap-2 hover:text-white transition-colors">
                <Phone className="h-4 w-4 flex-shrink-0" />
                {CONTACT.phoneDisplay}
              </a>
              <a href={`mailto:${CONTACT.email}`} className="flex items-center gap-2 hover:text-white transition-colors">
                <Mail className="h-4 w-4 flex-shrink-0" />
                {CONTACT.email}
              </a>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>м. Бровари, Київська обл.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-8 pt-6 text-sm text-gray-500 text-center">
          <p>{CONTACT.owner} &middot; {new Date().getFullYear()}</p>
        </div>
      </div>
    </footer>
  );
}
