import { Phone } from "lucide-react";
import { prisma } from "@/shared/db";
import { SocialLinks } from "./SocialLinks";

interface TopBarConfig {
  enabled: boolean;
  showPhone: boolean;
  phone: string;
  phoneLabel: string;
  phoneLinkType: string; // tel, viber, custom
  showSocials: boolean;
}

async function getTopBarConfig(): Promise<{ config: TopBarConfig; socialLinks: Record<string, string> }> {
  const config: TopBarConfig = {
    enabled: true,
    showPhone: true,
    phone: "",
    phoneLabel: "",
    phoneLinkType: "tel",
    showSocials: true,
  };
  const socialLinks: Record<string, string> = {};

  try {
    const settings = await prisma.settings.findMany({
      where: {
        key: {
          in: [
            "topbar_enabled", "topbar_show_phone", "topbar_phone",
            "topbar_phone_label", "topbar_phone_link_type", "topbar_show_socials",
            "social_instagram", "social_youtube", "social_facebook", "social_tiktok",
          ],
        },
      },
    });

    for (const s of settings) {
      const v = s.value ?? "";
      switch (s.key) {
        case "topbar_enabled": config.enabled = v !== "false"; break;
        case "topbar_show_phone": config.showPhone = v !== "false"; break;
        case "topbar_phone": config.phone = v; break;
        case "topbar_phone_label": config.phoneLabel = v; break;
        case "topbar_phone_link_type": config.phoneLinkType = v || "tel"; break;
        case "topbar_show_socials": config.showSocials = v !== "false"; break;
        case "social_instagram": if (v) socialLinks.instagram = v; break;
        case "social_youtube": if (v) socialLinks.youtube = v; break;
        case "social_facebook": if (v) socialLinks.facebook = v; break;
        case "social_tiktok": if (v) socialLinks.tiktok = v; break;
      }
    }
  } catch { /* DB unavailable */ }

  return { config, socialLinks };
}

function buildPhoneHref(phone: string, linkType: string): string {
  const clean = phone.replace(/[\s\-\(\)]/g, "");
  if (linkType === "viber") {
    const num = clean.startsWith("+") ? clean.substring(1) : clean;
    return `viber://chat?number=${num}`;
  }
  return `tel:${clean.startsWith("+") ? clean : `+${clean}`}`;
}

export async function TopBar() {
  const { config: tb, socialLinks } = await getTopBarConfig();

  if (!tb.enabled) return null;

  const hasPhone = tb.showPhone && tb.phone;
  const hasSocials = tb.showSocials && Object.keys(socialLinks).length > 0;

  if (!hasPhone && !hasSocials) return null;

  return (
    <div className="bg-gray-900 text-white text-sm hidden md:block">
      <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between">
        {hasPhone ? (
          <a
            href={buildPhoneHref(tb.phone, tb.phoneLinkType)}
            className="flex items-center gap-1.5 hover:text-green-400 transition-colors"
          >
            <Phone className="h-3.5 w-3.5" />
            {tb.phoneLabel || tb.phone}
          </a>
        ) : (
          <div />
        )}

        {hasSocials && (
          <SocialLinks links={socialLinks} iconSize={16} className="gap-3" />
        )}
      </div>
    </div>
  );
}
