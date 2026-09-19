"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (data.session) {
        setReady(true);
      } else {
        setMessage(
          "パスワード設定用リンクが無効または期限切れです。もう一度メールを送信してください。"
        );
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "PASSWORD_RECOVERY" || session) {
        setReady(true);
        setMessage(null);
      }
    });

    void checkSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (password.length < 6) {
      setMessage("パスワードは6文字以上で入力してください。");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("確認用パスワードが一致しません。");
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      console.error("Password update error:", error);
      setMessage(`パスワードを設定できませんでした。${error.message}`);
      setSaving(false);
      return;
    }

    setMessage("パスワードを設定しました。");
    setSaving(false);

    window.setTimeout(() => {
      router.replace("/mypage");
      router.refresh();
    }, 800);
  };

  return (
    <main className="flex items-start justify-center bg-[#f7f8fa] px-4 pb-24 pt-8 md:h-[calc(100dvh-104px)] md:min-h-0 md:pb-8">
      <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            パスワードの設定・再設定
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            新しいパスワードを入力してください。
          </p>
        </div>

        {ready ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-slate-700">
                新しいパスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006888] focus:ring-1 focus:ring-[#006888]"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700">
                新しいパスワード（確認）
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006888] focus:ring-1 focus:ring-[#006888]"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full cursor-pointer rounded-md bg-[#001e43] py-2.5 text-sm font-medium text-white transition hover:bg-[#022a6b] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "設定中..." : "パスワードを設定する"}
            </button>
          </form>
        ) : null}

        {message ? (
          <p className="text-xs leading-5 text-slate-700">{message}</p>
        ) : null}
      </div>
    </main>
  );
}
