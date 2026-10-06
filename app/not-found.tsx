import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-[calc(100dvh-140px)] bg-white px-4 py-10 md:py-16">
      <div className="mx-auto flex max-w-2xl flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm md:px-10">
        {/* ロゴ画像のパスは、今ヘッダーで使っているものと同じにしてください */}
        <img
          src="/tokumikke_logo.png"
          alt="トクミッケ"
          className="mb-8 h-auto w-[220px] md:w-[260px]"
        />

        <p className="text-sm font-semibold tracking-wide text-[#006888]">
          404 NOT FOUND
        </p>

        <h1 className="mt-2 text-2xl font-bold text-[#001e43] md:text-3xl">
          お探しのページは見つかりませんでした
        </h1>

        <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base">
          ページが削除されたか、URLが変更された可能性があります。
          <br />
          トップページから、もう一度ディールを探してみてください。
        </p>

        <div className="mt-8 flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex min-w-[220px] items-center justify-center rounded-full bg-[#006888] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#00546d]"
          >
            トップページへ戻る
          </Link>

          <Link
            href="/post"
            className="inline-flex min-w-[220px] items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-[#001e43] transition hover:bg-slate-50"
          >
            ディールを投稿する
          </Link>
        </div>
      </div>
    </main>
  );
}