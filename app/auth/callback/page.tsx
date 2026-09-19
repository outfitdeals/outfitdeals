"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const CONSENT_KEY = "tokumikke_oauth_signup_consent";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const finishOAuth = async () => {
      const consentAt =
        sessionStorage.getItem(CONSENT_KEY) ||
        localStorage.getItem(CONSENT_KEY);

      const { data, error } = await supabase.auth.getSession();

      if (cancelled) return;

      if (error || !data.session?.user) {
        console.error("OAuth callback session error:", error);
        router.replace("/auth");
        return;
      }

      const user = data.session.user;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (profileError) {
        console.error("OAuth profile check error:", profileError);
        router.replace("/mypage");
        router.refresh();
        return;
      }

      if (!profile?.username) {
        if (consentAt) {
          sessionStorage.setItem(CONSENT_KEY, consentAt);
        } else {
          sessionStorage.removeItem(CONSENT_KEY);
        }
        router.replace("/auth/setup-profile");
        return;
      }

      if (consentAt) {
        sessionStorage.removeItem(CONSENT_KEY);
        localStorage.removeItem(CONSENT_KEY);
      }

      if (!cancelled) {
        router.replace("/mypage");
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
