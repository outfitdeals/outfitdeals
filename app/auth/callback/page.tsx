"use client";

import { useEffect } from "react";
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

  useEffect(() => {
    let cancelled = false;

    const finishOAuth = async () => {
      const returnTo = getSafeReturnTo();
      const consentAt =
        sessionStorage.getItem(CONSENT_KEY) ||
        localStorage.getItem(CONSENT_KEY);

      const { data, error } = await supabase.auth.getSession();

      if (cancelled) return;

      if (error || !data.session?.user) {
        console.error("OAuth callback session error:", error);
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
        if (consentAt) {
          sessionStorage.setItem(CONSENT_KEY, consentAt);
        } else {
          sessionStorage.removeItem(CONSENT_KEY);
        }

        router.replace(`/auth/setup-profile?next=${encodeURIComponent(returnTo)}`);
        return;
      }

      if (consentAt) {
        sessionStorage.removeItem(CONSENT_KEY);
        localStorage.removeItem(CONSENT_KEY);
      }

      if (!cancelled) {
        router.replace(returnTo);
        router.refresh();
      }
    };

    void finishOAuth();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex min-h-[50vh] items-center justify-center bg-[#f7f8fa] px-4">
      <p className="text-sm text-slate-600">ログイン処理中...</p>
    </main>
  );
}
