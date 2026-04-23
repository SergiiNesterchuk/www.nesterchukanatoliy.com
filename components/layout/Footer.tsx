import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";
import { CONTACT, SOCIAL, SITE_NAME } from "@/shared/constants";

export function Footer() {
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
            <div className="flex gap-3 mt-4">
              <a href={SOCIAL.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors text-sm">Instagram</a>
              <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors text-sm">YouTube</a>
              <a href={SOCIAL.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors text-sm">Facebook</a>
              <a href={SOCIAL.tiktok} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors text-sm">TikTok</a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="text-white font-semibold mb-3">Покупцям</h3>
            <nav className="space-y-2 text-sm">
              <Link href="/katalog/" className="block hover:text-white transition-colors">Каталог</Link>
              <Link href="/pro-nas/" className="block hover:text-white transition-colors">Про нас</Link>
              <Link href="/oplata-i-dostavka/" className="block hover:text-white transition-colors">Оплата і доставка</Link>
              <Link href="/kontaktna-informatsiya/" className="block hover:text-white transition-colors">Контакти</Link>
              <Link href="/blog/" className="block hover:text-white transition-colors">Блог</Link>
              <Link href="/umovy-vykorystannia/" className="block hover:text-white transition-colors">Умови використання</Link>
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
