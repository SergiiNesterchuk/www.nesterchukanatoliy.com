import type { Metadata } from "next";
import Script from "next/script";
import { inter } from "@/lib/fonts";
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION } from "@/shared/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  icons: {
    icon: [
      { url: "/api/favicon", type: "image/png", sizes: "any" },
    ],
    apple: [
      { url: "/api/favicon", type: "image/png", sizes: "180x180" },
    ],
    shortcut: "/api/favicon",
  },
  openGraph: {
    type: "website",
    locale: "uk_UA",
    siteName: SITE_NAME,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Script
          id="clarity-tag"
          src="https://www.clarity.ms/tag/whdthaxfvc"
          strategy="afterInteractive"
        />
        <Script id="clarity-init" strategy="afterInteractive">
          {`window.clarity=window.clarity||function(){(window.clarity.q=window.clarity.q||[]).push(arguments)};`}
        </Script>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-SPHFK5YCCF"
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-SPHFK5YCCF',{page_path:window.location.pathname});`}
        </Script>
      </body>
    </html>
  );
}
