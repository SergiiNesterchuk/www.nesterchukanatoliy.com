import { Phone } from "lucide-react";
import { CONTACT, SOCIAL } from "@/shared/constants";

export function TopBar() {
  return (
    <div className="bg-gray-900 text-white text-sm hidden md:block">
      <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between">
        <a
          href={`tel:${CONTACT.phone}`}
          className="flex items-center gap-1.5 hover:text-green-400 transition-colors"
        >
          <Phone className="h-3.5 w-3.5" />
          {CONTACT.phoneDisplay}
        </a>
        <div className="flex items-center gap-3">
          <a href={SOCIAL.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-green-400 transition-colors" aria-label="Instagram">
            Instagram
          </a>
          <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="hover:text-green-400 transition-colors" aria-label="YouTube">
            YouTube
          </a>
          <a href={SOCIAL.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-green-400 transition-colors" aria-label="Facebook">
            Facebook
          </a>
          <a href={SOCIAL.tiktok} target="_blank" rel="noopener noreferrer" className="hover:text-green-400 transition-colors" aria-label="TikTok">
            TikTok
          </a>
        </div>
      </div>
    </div>
  );
}
