// app/layout.tsx

import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import SiteHeader from "./components/SiteHeader";
import SiteFooter from "./components/SiteFooter";
import MobileBottomNav from "./components/MobileBottomNav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const siteTitle = "トクミッケ｜みんなで見つけるお得・セール情報";
const siteDescription =
  "トクミッケは、ファッション、家電、日用品、美容など、みんなが見つけたお得なセール・割引情報を共有できるディールサイトです。";

const websiteStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "トクミッケ",
  url: "https://www.tokumikke.com/",
};

export const metadata: Metadata = {
  applicationName: "トクミッケ",
  title: { default: siteTitle, template: "%s｜トクミッケ" },
  description: siteDescription,
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "トクミッケ",
    title: siteTitle,
    description: siteDescription,
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f8fa",
  colorScheme: "light",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className="bg-[#f7f8fa]">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-[#f7f8fa] antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteStructuredData) }}
        />
        <Suspense fallback={null}>
          <SiteHeader />
        </Suspense>
        <div className="pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-0">
          {children}
          <SiteFooter />
        </div>
        <Suspense fallback={null}>
          <MobileBottomNav />
        </Suspense>
      </body>
    </html>
  );
}