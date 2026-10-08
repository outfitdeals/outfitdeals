"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const CONSENT_KEY = "tokumikke_oauth_signup_consent";

function getSafeReturnTo() {
  if (typeof window === "undefined") return "/mypage";

  const raw = new URLSearchParams(window.location.search).get("next");

  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/auth")) {
    return "/mypage";
  }

  return raw;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [verificationComplete, setVerificationComplete] = useState(false);
  const [verificationReturnTo, setVerificationReturnTo] = useState("/mypage");
  const [callbackError, setCallbackError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const finishOAuth = async () => {
      const returnTo = getSafeReturnTo();
      const isEmailVerification =
        new URLSearchParams(window.location.search).get("verified") === "1";
      const consentAt =
        sessionStorage.getItem(CONSENT_KEY) ||
        localStorage.getItem(CONSENT_KEY);

      // Email confirmation links can return either a PKCE code or hash tokens.
      // Exchange them before checking the session; getSession() alone can race.
      const query = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const code = query.get("code");
      const tokenHash = query.get("token_hash");
      const tokenType = query.get("type");
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (code) {
        const result = await supabase.auth.exchangeCodeForSession(code);
        if (result.error) console.warn("Auth link exchange failed:", result.error.message);
      } else if (tokenHash && tokenType === "signup") {
        const result = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "signup",
        });
        if (result.error) console.warn("Auth link exchange failed:", result.error.message);
      } else if (accessToken && refreshToken) {
        const result = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (result.error) console.warn("Auth link exchange failed:", result.error.message);
      }

      // Prevent reused URL tokens from being processed on refresh.
      if (code || tokenHash || accessToken) {
        window.history.replaceState({}, "", window.location.pathname +
          `?verified=${isEmailVerification ? "1" : "0"}&next=${encodeURIComponent(returnTo)}`);
      }

      const { data, error } = await supabase.auth.getSession();

      if (cancelled) return;

      if (error || !data.session?.user) {
        if (isEmailVerification) {
          setCallbackError(
            "確認リンクを処理できませんでした。リンクが期限切れ、使用済み、または別のブラウザで開かれた可能性があります。登録時のメールアドレスでログインをお試しください。"
          );
          return;
        }
        router.replace(`/auth?next=${encodeURIComponent(returnTo)}`);
        return;
      }

      const user = data.session.user;
      const meta = user.user_metadata || {};
      const providerAvatar =
        meta.avatar_url || meta.avatarUrl || meta.picture || null;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (profileError) {
        console.error("OAuth profile check error:", profileError);
        router.replace(returnTo);
        router.refresh();
        return;
      }

      // OAuthプロバイダー側にアバターがあり、profiles側が空の場合は自動補完する。
      // 既存ユーザーが自分で設定したavatar_urlは上書きしない。
      if (profile && !profile.avatar_url && providerAvatar) {
        const avatarUpdatedAt = new Date().toISOString();

        const { error: avatarSyncError } = await supabase
          .from("profiles")
          .update({
            avatar_url: providerAvatar,
            avatar_updated_at: avatarUpdatedAt,
            updated_at: avatarUpdatedAt,
          })
          .eq("id", user.id);

        if (avatarSyncError) {
          console.error("OAuth avatar sync error:", avatarSyncError);
        }
      }

      if (!profile?.username) {
        // メール登録では新規登録時のユーザー名と同意日時をAuthに保存済み。
        // OAuth専用のプロフィール設定フォームを再度表示しない。
        const signupUsername =
          typeof meta.username === "string" ? meta.username.trim() : "";
        const termsAcceptedAt =
          typeof meta.terms_accepted_at === "string"
            ? meta.terms_accepted_at
            : "";
        const privacyAcceptedAt =
          typeof meta.privacy_accepted_at === "string"
            ? meta.privacy_accepted_at
            : "";
        const isEmailSignup =
          user.app_metadata?.provider === "email" || isEmailVerification;

        if (
          isEmailSignup &&
          signupUsername.length >= 2 &&
          signupUsername.length <= 10 &&
          termsAcceptedAt &&
          privacyAcceptedAt
        ) {
          const { error: saveProfileError } = await supabase
            .from("profiles")
            .upsert(
              {
                id: user.id,
                username: signupUsername,
                terms_accepted_at: termsAcceptedAt,
                privacy_accepted_at: privacyAcceptedAt,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "id" }
            );

          if (cancelled) return;

          if (saveProfileError) {
            console.error("Email signup profile save error:", saveProfileError);
            setCallbackError(
              "メールアドレスの確認は完了しましたが、登録したユーザー名を保存できませんでした。ログイン後、もう一度お試しください。"
            );
            return;
          }
        } else {
          if (consentAt) {
            sessionStorage.setItem(CONSENT_KEY, consentAt);
          } else {
            sessionStorage.removeItem(CONSENT_KEY);
          }

          router.replace(`/auth/setup-profile?next=${encodeURIComponent(returnTo)}`);
          return;
        }
      }

      if (consentAt) {
        sessionStorage.removeItem(CONSENT_KEY);
        localStorage.removeItem(CONSENT_KEY);
      }

      if (!cancelled) {
        if (isEmailVerification) {
          setVerificationReturnTo(returnTo);
          setVerificationComplete(true);
          return;
        }

        router.replace(returnTo);
        router.refresh();
      }
    };

    void finishOAuth();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (callbackError) {
    return (
      <main className="flex min-h-[60vh] items-start justify-center bg-[#f7f8fa] px-4 pt-12">
        <div className="w-full max-w-md rounded-xl bg-white p-6 text-center shadow">
          <h1 className="text-lg font-semibold text-slate-900">メールアドレスの確認</h1>
          <p className="mt-4 text-sm leading-6 text-slate-600">{callbackError}</p>
          <button
            type="button"
            onClick={() => router.replace("/auth")}
            className="mt-6 w-full cursor-pointer rounded-md bg-[#001e43] py-2.5 text-sm font-medium text-white"
          >
            ログイン画面へ
          </button>
        </div>
      </main>
    );
  }

  if (verificationComplete) {
    return (
      <main className="flex min-h-[60vh] items-start justify-center bg-[#f7f8fa] px-4 pb-16 pt-12">
        <div className="w-full max-w-md rounded-xl bg-white p-6 text-center shadow">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600">
            ✓
          </div>

          <h1 className="mt-4 text-xl font-semibold text-slate-900">
            メールアドレスの確認が完了しました
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            トクミッケへの登録が完了しました。
            <br />
            そのままマイページをご利用いただけます。
          </p>

          <button
            type="button"
            onClick={() => {
              router.replace(verificationReturnTo);
              router.refresh();
            }}
            className="mt-6 w-full cursor-pointer rounded-md bg-[#001e43] py-2.5 text-sm font-medium text-white transition hover:bg-[#022a6b]"
          >
            マイページへ
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[50vh] items-center justify-center bg-[#f7f8fa] px-4">
      <p className="text-sm text-slate-600">ログイン処理中...</p>
    </main>
  );
}