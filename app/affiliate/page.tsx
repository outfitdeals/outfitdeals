import Link from "next/link";

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-7 shadow-sm sm:px-10 sm:py-10">
        <div className="mb-8 border-b border-slate-200 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-[#001e43] sm:text-3xl">
            アフィリエイトについて
          </h1>
          <p className="mt-3 text-xs text-slate-500">制定日：2026年9月16日</p>
        </div>

        <div className="space-y-9">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">アフィリエイトプログラムについて</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>トクミッケでは、楽天アフィリエイト、Amazonアソシエイト、Yahoo!ショッピングその他のアフィリエイトプログラムを利用しています。</p>              <p>本サイトに掲載されたリンクを経由して商品・サービスが購入された場合、トクミッケ運営者が紹介料を受け取ることがあります。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">商品情報について</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>商品の価格、在庫、送料、ポイント、クーポン、販売期間、仕様その他の情報は、掲載後に変更される場合があります。購入前に必ずリンク先の販売サイトで最新情報をご確認ください。</p>              <p>トクミッケは商品の販売者ではありません。購入、支払い、配送、返品、交換、保証その他の取引については、各販売事業者へお問い合わせください。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">Amazonアソシエイトについて</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>Amazonのアソシエイトとして、トクミッケは適格販売により収入を得ています。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">ユーザー投稿について</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>トクミッケにはユーザーが投稿したディール情報が含まれます。掲載されている商品や販売店について、運営者が個別に推奨、保証または販売していることを意味するものではありません。</p>
            </div>
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
