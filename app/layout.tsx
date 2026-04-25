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
          id="clarity"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","whdthaxfvc");`,
          }}
        />
      </body>
    </html>
  );
}
