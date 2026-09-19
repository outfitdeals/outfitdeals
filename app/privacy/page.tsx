import Link from "next/link";

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-7 shadow-sm sm:px-10 sm:py-10">
        <div className="mb-8 border-b border-slate-200 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-[#001e43] sm:text-3xl">
            プライバシーポリシー
          </h1>
          <p className="mt-3 text-xs text-slate-500">制定日：2026年9月16日</p>
        </div>

        <div className="space-y-9">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">1. 取得する情報</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>本サービスでは、メールアドレス、ユーザー名、外部認証サービスから提供される認証情報、投稿・コメント・返信・評価等の利用情報、IPアドレス、ブラウザ・端末情報、アクセス日時、Cookie等によって取得される情報、お問い合わせ時に提供される情報を取得する場合があります。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">2. 利用目的</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>取得した情報は、サービス提供、アカウント認証・管理、投稿・コメント・評価等の機能提供、通知、不正利用防止、セキュリティ確保、障害調査、利用状況の分析、サービス改善、お問い合わせ対応および法令・規約違反への対応のために利用します。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">3. 公開される情報</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>ユーザー名、投稿したディール、コメント、返信、評価その他、本サービスの性質上公開を予定している情報は一般に公開される場合があります。メールアドレス等、公開を予定していない情報をプロフィール等に公開することはありません。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">4. 外部サービス</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>本サービスでは、認証、データ保存、ホスティング、メール送信、アクセス解析その他の機能のため、Supabase、Google、LINE、Apple、Vercelその他の外部サービスを利用する場合があります。これらの利用に伴い、情報が日本国外を含む地域で保存または処理される場合があります。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">5. 第三者提供・業務委託</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>運営者は、本人の同意がある場合、サービス提供に必要な業務委託を行う場合、法令に基づく場合、または生命・身体・財産の保護等のために必要な場合を除き、個人データを第三者へ提供しません。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">6. Cookie等</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>本サービスでは、ログイン状態の維持、セキュリティ確保、利用状況の把握、サービス改善、アフィリエイト等のため、Cookie、ローカルストレージその他類似の技術を使用する場合があります。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">7. アフィリエイト</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>本サービスでは、楽天アフィリエイト、Amazonアソシエイト、Yahoo!ショッピングその他のアフィリエイトプログラムを利用する場合があります。外部サイトへ移動した後の情報の取り扱いについては、各サービスのプライバシーポリシー等をご確認ください。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">8. 安全管理</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>運営者は、取得した情報への不正アクセス、漏えい、紛失、改ざん等を防止するため、サービスの規模および取り扱う情報の性質に応じた合理的な安全管理措置を講じます。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">9. 情報の確認・訂正・削除等</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>個人情報の確認、訂正、削除その他の請求については、お問い合わせ窓口からご連絡ください。必要な本人確認を行ったうえで、適用される法令に従って対応します。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">10. アカウント削除</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>ユーザーは、運営者が定める方法によりアカウント削除を申請できます。削除後も、法令上の保存義務、不正利用防止その他合理的な必要性がある情報、または匿名化された情報を一定期間保持する場合があります。</p>              <p>投稿済みコンテンツは、情報の連続性を維持するため、投稿者を特定できない状態にする等の措置を行ったうえで保持する場合があります。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">11. 未成年者</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>未成年者が本サービスを利用する場合は、適用される法令および必要に応じて保護者の同意その他の条件に従って利用してください。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">12. 本ポリシーの変更</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>運営者は、法令、本サービスまたは利用する外部サービスの変更等に応じて本ポリシーを変更することがあります。重要な変更については、本サービス上その他適切な方法でお知らせします。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">13. 運営者・お問い合わせ</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>運営者：トクミッケ運営者</p>              <p>運営拠点：California, United States</p>              <p>プライバシーに関するお問い合わせは、本サービスの「お問い合わせ」ページからご確認ください。</p>
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
