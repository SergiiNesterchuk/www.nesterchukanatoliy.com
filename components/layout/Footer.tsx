import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";
import { CONTACT, SITE_NAME } from "@/shared/constants";
import { PageRepository } from "@/repositories/PageRepository";
import { SocialLinks } from "./SocialLinks";
import { prisma } from "@/shared/db";

interface FooterConfig {
  brandTitle: string;
  brandDescription: string;
  showSocial: boolean;
  showContacts: boolean;
  showCustomerLinks: boolean;
  copyrightText: string;
  phone: string;
  phoneDisplay: string;
  email: string;
  address: string;
}

async function getFooterConfig(): Promise<{ config: FooterConfig; socialLinks: Record<string, string> }> {
  const defaults: FooterConfig = {
    brandTitle: SITE_NAME,
    brandDescription: "Натуральний яблучний оцет власного виробництва та засоби для захисту саду.",
    showSocial: true,
    showContacts: true,
    showCustomerLinks: true,
    copyrightText: "",
    phone: CONTACT.phone,
    phoneDisplay: CONTACT.phoneDisplay,
    email: CONTACT.email,
    address: "м. Бровари, Київська обл.",
  };

  const socialLinks: Record<string, string> = {
    instagram: "https://www.instagram.com/nesterchuk_anatoliy",
    youtube: "https://youtube.com/@nesterchuk_anatoliy",
    facebook: "https://www.facebook.com/profile.php?id=100025198117909",
    tiktok: "https://www.tiktok.com/@nesterchuk_anatoliy",
  };

  try {
    const settings = await prisma.settings.findMany({
      where: { key: { in: [
        "footer_brand_title", "footer_brand_description",
        "footer_show_social", "footer_show_contacts", "footer_show_customer_links",
        "footer_copyright_text", "footer_phone", "footer_email", "footer_address",
        "social_instagram", "social_youtube", "social_facebook", "social_tiktok",
      ] } },
    });

    for (const s of settings) {
      if (!s.value) continue;
      switch (s.key) {
        case "footer_brand_title": defaults.brandTitle = s.value; break;
        case "footer_brand_description": defaults.brandDescription = s.value; break;
        case "footer_show_social": defaults.showSocial = s.value !== "false"; break;
        case "footer_show_contacts": defaults.showContacts = s.value !== "false"; break;
        case "footer_show_customer_links": defaults.showCustomerLinks = s.value !== "false"; break;
        case "footer_copyright_text": defaults.copyrightText = s.value; break;
        case "footer_phone": defaults.phone = s.value; defaults.phoneDisplay = s.value; break;
        case "footer_email": defaults.email = s.value; break;
        case "footer_address": defaults.address = s.value; break;
        case "social_instagram": socialLinks.instagram = s.value; break;
        case "social_youtube": socialLinks.youtube = s.value; break;
        case "social_facebook": socialLinks.facebook = s.value; break;
        case "social_tiktok": socialLinks.tiktok = s.value; break;
      }
    }
  } catch { /* fallback */ }

  return { config: defaults, socialLinks };
}

export async function Footer() {
  let pages: { title: string; slug: string }[] = [];
  try { pages = await PageRepository.findForFooter(); } catch { /* */ }

  const { config: fc, socialLinks } = await getFooterConfig();

  const copyright = fc.copyrightText || `${CONTACT.owner} · ${new Date().getFullYear()}`;

  return (
    <footer className="bg-gray-900 text-gray-300 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <h3 className="text-white font-semibold mb-3">{fc.brandTitle}</h3>
            {fc.brandDescription && <p className="text-sm leading-relaxed">{fc.brandDescription}</p>}
            {fc.showSocial && <SocialLinks links={socialLinks} className="mt-4" />}
          </div>

          {/* Customer links */}
          {fc.showCustomerLinks && (
            <div>
              <h3 className="text-white font-semibold mb-3">Покупцям</h3>
              <nav className="space-y-2 text-sm">
                <Link href="/katalog/" className="block hover:text-white transition-colors">Каталог</Link>
                {pages.map((page) => (
                  <Link key={page.slug} href={page.slug.startsWith("http") ? page.slug : `/${page.slug}/`} className="block hover:text-white transition-colors">
                    {page.title}
                  </Link>
                ))}
              </nav>
            </div>
          )}

          {/* Contacts */}
          {fc.showContacts && (
            <div>
              <h3 className="text-white font-semibold mb-3">Контакти</h3>
              <div className="space-y-2 text-sm">
                <a href={`tel:${fc.phone}`} className="flex items-center gap-2 hover:text-white transition-colors">
                  <Phone className="h-4 w-4 flex-shrink-0" />
                  {fc.phoneDisplay}
                </a>
                <a href={`mailto:${fc.email}`} className="flex items-center gap-2 hover:text-white transition-colors">
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  {fc.email}
                </a>
                {fc.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>{fc.address}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-700 mt-8 pt-6 text-sm text-gray-500 text-center">
          <p>{copyright}</p>
        </div>
      </div>
    </footer>
  );
}
