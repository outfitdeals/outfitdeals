// app/account-deleted/page.tsx
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export default function AccountDeletedPage() {
  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <main className="mx-auto flex min-h-screen w-full max-w-[760px] items-center justify-center px-4 py-12 sm:px-6">
        <section className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm sm:px-10 sm:py-14">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#006888]/10">
            <CheckCircle2
              className="h-8 w-8 text-[#006888]"
              aria-hidden="true"
            />
          </div>

          <h1 className="mt-6 text-2xl font-bold tracking-tight text-[#001e43] sm:text-3xl">
            ご利用ありがとうございました
          </h1>

          <p className="mx-auto mt-4 max-w-[520px] text-sm leading-7 text-slate-600 sm:text-base">
            アカウントの削除が完了しました。
            <br />
            これまでトクミッケをご利用いただき、ありがとうございました。
          </p>

          <Link
            href="/"
            className="mt-8 inline-flex cursor-pointer items-center justify-center rounded-full bg-[#006888] px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            トップページへ
          </Link>
        </section>
      </main>
    </div>
  );
}
