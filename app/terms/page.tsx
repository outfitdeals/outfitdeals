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
          <p className="mt-1 text-xs text-slate-500">最終改定日：2026年10月13日</p>
        </div>

        <div className="space-y-9">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">第1条　本サービス</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>本利用規約（以下「本規約」といいます。）は、トクミッケ運営者（以下「運営者」といいます。）が提供するウェブサービス「トクミッケ」（以下「本サービス」といいます。）の利用条件を定めるものです。</p>
              <p>本サービスは、商品、セール、クーポンその他のお得な情報をユーザー同士で投稿、閲覧、評価および共有するためのサービスです。本サービスを利用する方（以下「ユーザー」といいます。）は、本規約に同意のうえ利用するものとします。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">第2条　アカウント</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>ユーザーは、運営者が定める方法によりアカウントを登録することで、投稿、コメント、評価その他の会員向け機能を利用できます。登録情報は正確かつ最新の状態に保ち、アカウントはユーザー自身の責任で管理してください。</p>
              <p>アカウントを第三者に譲渡、貸与または不正に共有することはできません。認証情報の漏えいや不正利用が疑われる場合は、速やかに運営者へご連絡ください。</p>
              <p>ユーザーは、本サービスが提供する所定の手続により、自らアカウントの削除を申請または実行できます。退会後の情報の取り扱いについては第10条およびプライバシーポリシーに従います。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">第3条　投稿</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>ユーザーは、自らの責任においてディール情報、コメント、返信その他のコンテンツ（以下「投稿コンテンツ」といいます。）を投稿するものとします。</p>
              <p>価格、在庫、送料、ポイント、クーポン、販売期間その他の条件は変更される場合があります。投稿時には可能な範囲で正確な情報を掲載してください。</p>
              <p>ユーザーは、投稿に必要な権利または許諾を有する内容のみを掲載し、第三者の著作権、商標権、プライバシーその他の権利を侵害しないものとします。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">第4条　禁止事項</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>ユーザーは、次の行為を行ってはなりません。</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>法令違反、犯罪行為またはこれらを助長する行為</li>
                <li>第三者の著作権、商標権、名誉、信用、プライバシーその他の権利を侵害する行為</li>
                <li>誹謗中傷、侮辱、脅迫、差別的発言、個人攻撃、執拗な嫌がらせ、他のユーザーを威圧する行為</li>
                <li>同一または類似のコメント・返信の繰り返し投稿、荒らし、スパム、不正な勧誘や宣伝、無関係な投稿の大量送信</li>
                <li>虚偽の情報、なりすまし、実際の購入・使用経験を装った投稿その他著しく誤解を招く行為</li>
                <li>複数アカウント、外部サービス、プログラム等を用いた不正な評価・投票・閲覧数の操作</li>
                <li>本人の同意や正当な理由なく、住所、電話番号その他の個人情報を公開する行為</li>
                <li>通報機能の濫用、虚偽の通報を繰り返す行為、運営者の調査や措置を不正に妨げる行為</li>
                <li>アカウントの停止・制限を回避する目的で別アカウントを利用する行為</li>
                <li>本サービスへの不正アクセス、脆弱性の悪用、過度な負荷をかける行為、運営妨害</li>
                <li>その他、前各号に準じ、ユーザーの安全または本サービスの正常な運営を害すると運営者が合理的に判断する行為</li>
              </ul>
              <p>商品や販売店への合理的な批評、根拠に基づく否定的な意見、他のユーザーとの通常の意見の相違は、それだけを理由として禁止行為とはしません。ただし、その表現方法や反復の程度が前項に該当する場合はこの限りではありません。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">第5条　投稿コンテンツ</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>投稿コンテンツの権利は、原則として投稿したユーザーまたは正当な権利者に帰属します。</p>
              <p>ユーザーは、本サービスの運営、表示、検索、紹介、改善および告知に必要な範囲で、運営者が投稿コンテンツを無償で利用、複製、表示、形式変更その他必要な処理を行うことを許諾するものとします。</p>
              <p>運営者は、本規約違反、権利侵害の申立て、法令上の要請その他合理的に必要な場合、投稿コンテンツの公開範囲を制限し、非表示、編集または削除することがあります。対応の際は、内容や影響を考慮し、必要以上の変更を避けるよう努めます。</p>
              <p>投稿コンテンツの公開終了またはアカウント削除後も、法令上の義務、権利の保護、不正利用への対応、紛争への対処などに必要な範囲で、情報を一定期間保存する場合があります。その取り扱いは適用法令およびプライバシーポリシーに従います。</p>
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
              <p>コメントや返信を投稿する際は、他のユーザーの人格や権利を尊重してください。評価の不正操作、虚偽の体験談、宣伝目的の投稿、繰り返される攻撃的なコメント等には、第10条に定める措置を講じることがあります。</p>
              <p>ユーザーは、問題があると考える投稿について、本サービスに用意された通報機能またはお問い合わせフォームを通じて運営者に連絡できます。通報があったことのみをもって、対象投稿が規約違反と確定するものではありません。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">第8条　外部サイト・アフィリエイト</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>本サービスには、楽天市場、Amazon、Yahoo!ショッピングその他の第三者が運営するサイトへのリンクが含まれる場合があります。本サービスはアフィリエイトプログラムを利用しており、リンクを経由した購入等により運営者が紹介料を受け取る場合があります。</p>
              <p>商品の購入契約、支払い、配送、返品、保証その他の取引は、ユーザーと販売事業者との間で行われます。トクミッケは商品の販売者ではありません。</p>
              <p>外部サイトの内容、提供条件および個人情報の取り扱いについては、各提供事業者の規約等をご確認ください。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">第9条　掲載情報・免責</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>運営者は、掲載される価格、割引率、在庫、送料、ポイント、クーポン、販売期間、商品仕様その他の情報について、正確性、完全性または最新性を保証するものではありません。購入前に必ずリンク先の販売サイトで最新の条件をご確認ください。</p>
              <p>運営者は、本サービスの中断、投稿情報の誤り、第三者との取引その他本サービスに関連する事由により生じた損害について、適用法令で認められる範囲に限り責任を制限するものとします。運営者の故意または重大な過失による場合など、法令上免責または責任制限が認められない場合には本条を適用しません。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">第10条　利用制限・アカウントの停止および削除</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>運営者は、ユーザーが本規約に違反した場合、違反の合理的な疑いがある場合、または本サービスの安全もしくは正常な運営を守るために必要な場合、行為の内容、重大性、反復性、影響および事実関係を考慮し、次の措置の全部または一部を講じることがあります。</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>警告、注意喚起または問題となる行為の中止要請</li>
                <li>投稿コンテンツの非表示、公開制限、編集または削除</li>
                <li>コメント、返信、投稿、評価その他の機能の一時的または継続的な制限</li>
                <li>アカウントの一時停止、無期限停止、強制退会または削除</li>
              </ul>
              <p>悪質なコメントや嫌がらせ、荒らし、スパム、不正な評価操作等を繰り返すユーザーについては、警告後も改善が認められない場合など、必要に応じて利用制限、アカウント停止または削除の対象とします。重大な権利侵害、脅迫、安全上の危険、不正アクセスなど緊急性の高い行為については、事前の警告なしに措置を講じることがあります。</p>
              <p>停止・制限措置を受けたユーザーは、運営者の許可なく別アカウントを作成または使用するなどして当該措置を回避してはなりません。</p>
              <p>運営者は、法令上必要な場合その他状況に応じて、措置の内容や主な理由を合理的な方法で通知するよう努めます。ただし、調査の妨げとなる場合、第三者の安全や権利を損なうおそれがある場合等は、この限りではありません。</p>
              <p>措置について確認または再審査を希望するユーザーは、<Link href="/contact" className="cursor-pointer text-[#006888] underline underline-offset-2 hover:text-[#00516a]">お問い合わせフォーム</Link>から申し出ることができます。運営者は内容を確認のうえ適切に対応しますが、必ずしも措置の撤回を約束するものではありません。</p>
              <p>アカウントの停止または削除後の投稿コンテンツや登録情報については、適用法令およびプライバシーポリシーに従い、保存・非表示・削除等の必要な処理を行います。強制退会が直ちにすべての投稿や情報の消去を意味するものではありません。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">第11条　サービスの変更・停止</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>運営者は、保守、障害、セキュリティ対応、仕様変更その他必要な場合、本サービスの全部または一部を変更、中断または終了することがあります。可能な場合は、影響や緊急性に応じて事前または事後に適切な方法でお知らせします。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">第12条　本規約の変更</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>運営者は、法令、本サービスの変更その他必要に応じ、適用法令で認められる範囲で本規約を変更することがあります。</p>
              <p>本規約を変更する場合、変更内容、効力発生日その他必要な事項を、本サービス上への掲載その他適切な方法により周知します。法令上、個別の同意が必要な場合には、所定の方法により同意を取得します。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">第13条　準拠法・紛争</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>本規約および本サービスに関する事項は、ユーザーに適用される強行法規を妨げない範囲で、アメリカ合衆国カリフォルニア州法に準拠します。</p>
              <p>本サービスに関する紛争が生じた場合、当事者間で誠実に解決を図るものとし、解決しない場合は適用される法令に従って取り扱うものとします。</p>
            </div>
          </section>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-6">
          <Link href="/" className="cursor-pointer text-sm font-medium text-[#006888] hover:underline">
            トップページへ戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
