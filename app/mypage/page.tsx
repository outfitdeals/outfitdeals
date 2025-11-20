"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function MyPage() {
  const router = useRouter();
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        // 未ログインなら /auth へ
        router.replace("/auth");
        return;
      }
      setUser(data.user);
      setLoading(false);
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600 text-sm">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-[960px] px-4 py-8">
        <h1 className="text-2xl font-semibold text-slate-900 mb-6">
          マイページ
        </h1>

        <section className="rounded-lg bg-white shadow-md ring-1 ring-slate-200 p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-700 mb-1">
              アカウント情報
            </h2>
            <p className="text-sm text-slate-600">
              UID: <span className="font-mono break-all">{user.id}</span>
            </p>
            <p className="text-sm text-slate-600 mt-1">
              メールアドレス:{" "}
              <span className="font-mono break-all">{user.email}</span>
            </p>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <p className="text-xs text-slate-500">
              ※ 今後ここに「自分が投稿したディール」や「保存したディール」を表示していきます。
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
