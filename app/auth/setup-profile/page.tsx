"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";

const CONSENT_KEY = "tokumikke_oauth_signup_consent";

export default function SetupProfilePage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [consentAt, setConsentAt] = useState<string | null>(null);
  const [initialAvatarUrl, setInitialAvatarUrl] = useState<string | null>(null);
  const [needsLegalConsent, setNeedsLegalConsent] = useState(false);
  const [legalConsent, setLegalConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase.auth.getUser();

      if (cancelled) return;

      if (error || !data.user) {
        router.replace("/auth");
        return;
      }

      const pendingConsent = sessionStorage.getItem(CONSENT_KEY);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("username, terms_accepted_at, privacy_accepted_at")
        .eq("id", data.user.id)
        .maybeSingle();

      if (cancelled) return;

      if (profileError) {
        console.error("Profile setup load error:", profileError);
        setMessage("プロフィール情報を確認できませんでした。");
        setLoading(false);
        return;
      }

      if (profile?.username) {
        sessionStorage.removeItem(CONSENT_KEY);
        router.replace("/mypage");
        return;
      }

      const meta = (data.user as any).user_metadata || {};

      const providerAvatar =
        meta.avatar_url || meta.avatarUrl || meta.picture || null;

      const alreadyAccepted =
        Boolean(profile?.terms_accepted_at) &&
        Boolean(profile?.privacy_accepted_at);

      setUserId(data.user.id);
      setConsentAt(pendingConsent);
      setNeedsLegalConsent(!pendingConsent && !alreadyAccepted);
      setLegalConsent(Boolean(pendingConsent) || alreadyAccepted);
      setInitialAvatarUrl(providerAvatar);
      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!userId) {
      setMessage(
        "登録情報を確認できませんでした。もう一度ログインからお試しください。"
      );
      return;
    }

    if (needsLegalConsent && !legalConsent) {
      setMessage("利用規約およびプライバシーポリシーに同意してください。");
      return;
    }

    const acceptedAt = consentAt || new Date().toISOString();
    const trimmed = username.trim();

    if (trimmed.length < 2 || trimmed.length > 20) {
      setMessage("ユーザー名は2〜20文字にしてください。");
      return;
    }

    const allowed = /^[\p{L}\p{N}_\-ぁ-んァ-ヶ一-龠ー]+$/u;

    if (!allowed.test(trimmed)) {
      setMessage("ユーザー名には英数字・日本語・「_」「-」のみ使用できます。");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("profiles").upsert(
      {
        id: userId,
        username: trimmed,
        avatar_url: initialAvatarUrl,
        terms_accepted_at: acceptedAt,
        privacy_accepted_at: acceptedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      console.error("Profile setup save error:", error);
      setMessage(
        error.code === "23505"
          ? "そのユーザー名はすでに使用されています。別のユーザー名を入力してください。"
          : `プロフィールの保存に失敗しました: ${error.message}`
      );
      setSaving(false);
      return;
    }

    sessionStorage.removeItem(CONSENT_KEY);
    localStorage.removeItem(CONSENT_KEY);
    router.replace("/mypage");
    router.refresh();
  };

  if (loading) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center bg-[#f7f8fa] px-4">
        <p className="text-sm text-slate-600">登録情報を確認しています...</p>
      </main>
    );
  }

  return (
    <main className="flex items-start justify-center bg-[#f7f8fa] px-4 pb-24 pt-8 md:min-h-[calc(100dvh-104px)] md:pb-8">
      <div className="w-full max-w-md space-y-5 rounded-xl bg-white p-6 shadow">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            ユーザー名を設定
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            トクミッケで表示するユーザー名を設定してください。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {needsLegalConsent ? (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
              <input
                type="checkbox"
                checked={legalConsent}
                onChange={(e) => setLegalConsent(e.target.checked)}
                className="mt-1 h-4 w-4 cursor-pointer accent-[#006888]"
              />
              <span>
                <a
                  href="/terms"
                  target="_blank"
                  rel="noreferrer"
                  className="cursor-pointer font-semibold text-[#006888] hover:underline"
                >
                  利用規約
                </a>
                および
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="cursor-pointer font-semibold text-[#006888] hover:underline"
                >
                  プライバシーポリシー
                </a>
                に同意します。
              </span>
            </label>
          ) : null}

          <div>
            <label className="mb-1 block text-sm text-slate-700">
              ユーザー名
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006888] focus:ring-2 focus:ring-[#006888]/15"
              placeholder="例：トクミッケ太郎"
              autoComplete="username"
              autoFocus
              required
              onInvalid={(e) =>
                e.currentTarget.setCustomValidity(
                  "ユーザー名を入力してください。"
                )
              }
              onInput={(e) => e.currentTarget.setCustomValidity("")}
            />
            <p className="mt-1 text-xs text-slate-500">
              コメントなどに表示される名前です。（2〜20文字）
            </p>
            <p className="mt-1 text-xs font-semibold text-amber-700">
              ※ ユーザー名は登録後も変更できます。変更後90日間は再変更できません。
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full cursor-pointer rounded-md bg-[#001e43] py-2.5 text-sm font-medium text-white transition hover:bg-[#022a6b] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "登録中..." : "登録を完了する"}
          </button>
        </form>

        {message ? (
          <p className="whitespace-pre-line text-xs leading-5 text-red-600">
            {message}
          </p>
        ) : null}
      </div>
    </main>
  );
}
