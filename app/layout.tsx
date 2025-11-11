import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Outfit Deals - ファッション好きがお得をシェアし合うコミュニティ",
  description: "Outfit Deals（アウトフィットディールズ）は、ファッション好きがお得をシェアし合うコミュニティです。セール情報に加えて、レビューやコーデ投稿でユーザー同士がつながれる場所です。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
