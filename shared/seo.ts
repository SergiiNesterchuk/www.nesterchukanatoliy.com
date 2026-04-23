import { SITE_NAME, SITE_URL, CONTACT } from "./constants";
import { toHryvni } from "./money";

export function buildWebSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/katalog/search/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function buildOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    contactPoint: {
      "@type": "ContactPoint",
      telephone: CONTACT.phone,
      contactType: "sales",
      availableLanguage: "Ukrainian",
    },
    sameAs: [
      "https://www.instagram.com/nesterchuk_anatoliy",
      "https://youtube.com/@nesterchuk_anatoliy",
      "https://www.facebook.com/profile.php?id=100025198117909",
      "https://www.tiktok.com/@nesterchuk_anatoliy",
    ],
  };
}

export function buildProductJsonLd(product: {
  name: string;
  slug: string;
  description?: string | null;
  price: number;
  compareAtPrice?: number | null;
  sku: string;
  stockStatus: string;
  images: { url: string; alt?: string | null }[];
  category?: { name: string } | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    url: `${SITE_URL}/${product.slug}/`,
    description: product.description?.substring(0, 500),
    sku: product.sku,
    image: product.images.map((img) => img.url),
    brand: {
      "@type": "Brand",
      name: SITE_NAME,
    },
    category: product.category?.name,
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/${product.slug}/`,
      priceCurrency: "UAH",
      price: toHryvni(product.price),
      ...(product.compareAtPrice
        ? { priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] }
        : {}),
      availability:
        product.stockStatus === "in_stock"
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: SITE_NAME,
      },
    },
  };
}

export function buildBreadcrumbJsonLd(
  items: { name: string; url: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildItemListJsonLd(
  items: { name: string; url: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  };
}
