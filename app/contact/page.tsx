import Link from "next/link";

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-7 shadow-sm sm:px-10 sm:py-10">
        <div className="mb-8 border-b border-slate-200 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-[#001e43] sm:text-3xl">
            お問い合わせ
          </h1>
          <p className="mt-3 text-xs text-slate-500">制定日：2026年9月16日</p>
        </div>

        <div className="space-y-9">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">お問い合わせについて</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>トクミッケに関するお問い合わせ、権利侵害のご連絡、個人情報に関するご請求、投稿内容に関するご相談などを受け付けます。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">お問い合わせ窓口</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>現在、お問い合わせ窓口を準備しています。専用の連絡先を公開後、このページに掲載します。</p>            </div>
          </section>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-6">
          <Link href="/" className="text-sm font-medium text-[#006888] hover:underline">
            トップページへ戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
