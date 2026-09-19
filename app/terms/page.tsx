import Link from "next/link";

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-7 shadow-sm sm:px-10 sm:py-10">
        <div className="mb-8 border-b border-slate-200 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-[#001e43] sm:text-3xl">
            利用規約
          </h1>
          <p className="mt-3 text-xs text-slate-500">制定日：2026年9月16日</p>
        </div>

        <div className="space-y-9">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">第1条　本サービス</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>本利用規約（以下「本規約」といいます。）は、トクミッケ運営者（以下「運営者」といいます。）が提供するウェブサービス「トクミッケ」（以下「本サービス」といいます。）の利用条件を定めるものです。</p>              <p>本サービスは、商品、セール、クーポンその他のお得な情報をユーザー同士で投稿、閲覧、評価および共有するためのサービスです。本サービスを利用する方（以下「ユーザー」といいます。）は、本規約に同意のうえ利用するものとします。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">第2条　アカウント</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>ユーザーは、運営者が定める方法によりアカウントを登録することで、投稿、コメント、評価その他の会員向け機能を利用できます。登録情報は正確かつ最新の状態に保ち、アカウントはユーザー自身の責任で管理してください。</p>              <p>アカウントを第三者に譲渡、貸与または不正に共有することはできません。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">第3条　投稿</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>ユーザーは、自らの責任においてディール情報、コメント、返信その他のコンテンツ（以下「投稿コンテンツ」といいます。）を投稿するものとします。</p>              <p>価格、在庫、送料、ポイント、クーポン、販売期間その他の条件は変更される場合があります。投稿時には可能な範囲で正確な情報を掲載してください。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">第4条　禁止事項</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>ユーザーは、法令違反、第三者の権利侵害、虚偽または著しく誤解を招く投稿、誹謗中傷、嫌がらせ、スパム、不正な宣伝、不正な評価操作、複数アカウント等を利用した不正行為、本サービスへの不正アクセスまたは運営妨害、その他運営者が不適切と合理的に判断する行為を行ってはなりません。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">第5条　投稿コンテンツ</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>投稿コンテンツの権利は、原則として投稿したユーザーまたは正当な権利者に帰属します。</p>              <p>ユーザーは、本サービスの運営、表示、検索、紹介、改善および告知に必要な範囲で、運営者が投稿コンテンツを無償で利用、複製、表示、形式変更その他必要な処理を行うことを許諾するものとします。</p>              <p>運営者は、本規約違反その他サービス運営上必要な場合、投稿コンテンツを編集、非表示または削除することがあります。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">第6条　ディールの終了</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>販売期間の終了、在庫切れ、価格変更その他の理由により、ディールを「終了」と表示することがあります。終了したディールについても、過去の情報やコメントを参照できるようページを保持する場合があります。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">第7条　評価・コメント</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>本サービス上の評価数、コメントその他の情報はユーザーの意見や活動を示すものであり、運営者が商品の品質、価格の妥当性、販売店の信頼性等を保証するものではありません。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">第8条　外部サイト・アフィリエイト</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>本サービスには、楽天市場、Amazon、Yahoo!ショッピングその他の第三者が運営するサイトへのリンクが含まれる場合があります。本サービスはアフィリエイトプログラムを利用しており、リンクを経由した購入等により運営者が紹介料を受け取る場合があります。</p>              <p>商品の購入契約、支払い、配送、返品、保証その他の取引は、ユーザーと販売事業者との間で行われます。トクミッケは商品の販売者ではありません。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">第9条　掲載情報・免責</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>運営者は、掲載される価格、割引率、在庫、送料、ポイント、クーポン、販売期間、商品仕様その他の情報について、正確性、完全性または最新性を保証するものではありません。購入前に必ずリンク先の販売サイトで最新の条件をご確認ください。</p>              <p>本サービスまたは掲載情報の利用により生じた損害について、運営者は、適用法令上責任を制限できない場合を除き、責任を負わないものとします。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">第10条　利用制限・アカウント停止</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>運営者は、本規約への違反、不正利用、サービス運営への重大な支障その他合理的な理由がある場合、投稿の削除、機能の制限、アカウントの停止その他必要な措置を講じることがあります。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">第11条　サービスの変更・停止</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>運営者は、保守、障害、セキュリティ対応、仕様変更その他必要な場合、本サービスの全部または一部を変更、中断または終了することがあります。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">第12条　本規約の変更</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>運営者は、法令または本サービスの変更その他必要に応じて本規約を変更することがあります。重要な変更については、本サービス上その他適切な方法でお知らせします。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">第13条　準拠法・紛争</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>本規約および本サービスに関する事項は、ユーザーに適用される強行法規を妨げない範囲で、アメリカ合衆国カリフォルニア州法に準拠します。</p>              <p>本サービスに関する紛争が生じた場合、当事者間で誠実に解決を図るものとし、解決しない場合は適用される法令に従って取り扱うものとします。</p>
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
