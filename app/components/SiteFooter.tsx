// app/components/SiteFooter.tsx

import Image from "next/image";
import Link from "next/link";

const links = [
  { href: "/terms", label: "利用規約" },
  { href: "/privacy", label: "プライバシーポリシー" },
  { href: "/affiliate", label: "アフィリエイトについて" },
  { href: "/contact", label: "お問い合わせ" },
];

export default function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-5">
          <Link
            href="/"
            aria-label="トクミッケ ホーム"
            className="transition-opacity hover:opacity-75"
          >
            <Image
              src="/tokumikke_logo.png"
              alt="トクミッケ"
              width={150}
              height={40}
              className="h-auto w-[130px] sm:w-[140px]"
            />
          </Link>

          <nav
            aria-label="フッターナビゲーション"
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-[13px] text-slate-600 sm:text-sm"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-[#006888]"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="h-px w-full max-w-3xl bg-slate-100" />

          <p className="text-center text-xs text-slate-400">
            © 2026 トクミッケ
          </p>
        </div>
      </div>
    </footer>
  );
}
