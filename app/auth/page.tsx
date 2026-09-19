"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [mode, setMode] = useState<"signup" | "login">("login");
  const [message, setMessage] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState<"google" | "line" | null>(null);
  const [legalConsent, setEmailUseConsent] = useState(false);
  const [showConsentError, setShowConsentError] = useState(false);

  const handleGoogleLogin = async () => {
    setMessage(null);

    if (mode === "signup" && !legalConsent) {
      setShowConsentError(true);
      return;
    }

    setShowConsentError(false);
    setOauthLoading("google");

    if (mode === "signup") {
      const consentAt = new Date().toISOString();
      sessionStorage.setItem("tokumikke_oauth_signup_consent", consentAt);
      localStorage.setItem("tokumikke_oauth_signup_consent", consentAt);
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      sessionStorage.removeItem("tokumikke_oauth_signup_consent");
      localStorage.removeItem("tokumikke_oauth_signup_consent");
      setMessage(`Google login error: ${error.message}`);
      setOauthLoading(null);
    }
  };

  const handleLineLogin = async () => {
    setMessage(null);

    if (mode === "signup" && !legalConsent) {
      setShowConsentError(true);
      return;
    }

    setShowConsentError(false);
    setOauthLoading("line");

    if (mode === "signup") {
      const consentAt = new Date().toISOString();
      sessionStorage.setItem("tokumikke_oauth_signup_consent", consentAt);
      localStorage.setItem("tokumikke_oauth_signup_consent", consentAt);
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "custom:line-oauth" as any,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      sessionStorage.removeItem("tokumikke_oauth_signup_consent");
      localStorage.removeItem("tokumikke_oauth_signup_consent");
      setMessage(`LINE login error: ${error.message}`);
      setOauthLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (mode === "signup") {
      if (!legalConsent) {
        setMessage("利用規約およびプライバシーポリシーに同意してください。");
        return;
      }

      const trimmed = username.trim();

      if (!trimmed) {
        setMessage("ユーザー名を入力してください。");
        return;
      }

      if (trimmed.length < 2 || trimmed.length > 20) {
        setMessage("ユーザー名は2〜20文字にしてください。");
        return;
      }

      const allowed = /^[\p{L}\p{N}_\-ぁ-んァ-ヶ一-龠ー]+$/u;

      if (!allowed.test(trimmed)) {
        setMessage("ユーザー名には英数字・日本語・「_」「-」のみ使用できます。");
        return;
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: trimmed,
            terms_accepted_at: new Date().toISOString(),
            privacy_accepted_at: new Date().toISOString(),
          },
        },
      });

      if (error) {
        setMessage(`Sign up error: ${error.message}`);
      } else {
        setMessage("サインアップ用メールを送信しました。受信箱を確認してください。");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(`Login error: ${error.message}`);
        return;
      }

      router.push("/mypage");
      router.refresh();
    }
  };

  return (
    <main className="flex items-start justify-center bg-[#f7f8fa] px-4 pb-24 pt-8 md:h-[calc(100dvh-104px)] md:min-h-0 md:pb-8">
      <div className="w-full max-w-md rounded-xl bg-white shadow p-6 space-y-4">
        <h1 className="text-xl font-semibold text-slate-900">
          {mode === "signup" ? "新規登録" : "ログイン"}
        </h1>

        {mode === "signup" ? (
          <div
            className={`rounded-lg border p-3 transition ${
              showConsentError
                ? "border-red-500 bg-red-50 ring-2 ring-red-200"
                : "border-[#006888]/30 bg-[#006888]/[0.04]"
            }`}
          >
            <p className="text-xs leading-5 text-slate-700">
              新規登録するには、利用規約およびプライバシーポリシーへの同意が必要です。
            </p>

            <label
              className={`mt-3 flex cursor-pointer items-start gap-2 text-xs leading-5 ${
                showConsentError ? "font-semibold text-red-700" : "text-slate-700"
              }`}
            >
              <input
                type="checkbox"
                checked={legalConsent}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setEmailUseConsent(checked);
                  if (checked) setShowConsentError(false);
                }}
                className={`mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[#006888] ${
                  showConsentError ? "outline outline-2 outline-offset-2 outline-red-500" : ""
                }`}
              />
              <span>
                <Link
                  href="/terms"
                  target="_blank"
                  className="font-medium text-[#006888] underline underline-offset-2 hover:opacity-75"
                >
                  利用規約
                </Link>
                <span> および </span>
                <Link
                  href="/privacy"
                  target="_blank"
                  className="font-medium text-[#006888] underline underline-offset-2 hover:opacity-75"
                >
                  プライバシーポリシー
                </Link>
                <span>に同意します。</span>
              </span>
            </label>

            {showConsentError ? (
              <p className="mt-2 text-xs font-semibold leading-5 text-red-600">
                新規登録するには、上記への同意が必要です。
              </p>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={oauthLoading === "google"}
          className="relative flex h-11 w-full items-center overflow-hidden rounded-md border border-[#747775] bg-white text-[#1f1f1f] cursor-pointer transition hover:bg-[#f8faff] active:bg-[#f1f3f4] disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Googleでログイン"
        >
          <span className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center">
            <svg className="h-[18px] w-[18px]" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#EA4335" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.797 2.715v2.258h2.909c1.702-1.567 2.684-3.878 2.684-6.614Z" />
              <path fill="#4285F4" d="M9 18c2.43 0 4.467-.806 5.956-2.181l-2.909-2.258c-.806.54-1.836.859-3.047.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A9 9 0 0 0 9 18Z" />
              <path fill="#FBBC05" d="M3.963 10.706A5.41 5.41 0 0 1 3.682 9c0-.592.102-1.168.281-1.706V4.962H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.038l3.007-2.332Z" />
              <path fill="#34A853" d="M9 3.58c1.321 0 2.507.454 3.441 1.346l2.581-2.581C13.463.892 11.426 0 9 0A9 9 0 0 0 .956 4.962l3.007 2.332C4.672 5.165 6.656 3.58 9 3.58Z" />
            </svg>
          </span>
          <span className="w-full px-[52px] text-center text-sm font-medium leading-5">
            {oauthLoading === "google" ? "Googleに接続中..." : "Googleでログイン"}
          </span>
        </button>

        <button
          type="button"
          onClick={handleLineLogin}
          disabled={oauthLoading === "line"}
          className="relative flex h-11 w-full items-center overflow-hidden rounded-md bg-[#06C755] text-white cursor-pointer transition hover:bg-[#05B94F] active:bg-[#049B43] disabled:cursor-not-allowed disabled:bg-white disabled:text-[rgba(30,30,30,0.2)] disabled:ring-1 disabled:ring-inset disabled:ring-[rgba(229,229,229,0.6)]"
          aria-label="LINEでログイン"
        >
          <span className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center border-r border-black/[0.08]">
            <img
              src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAsCAYAAAAehFoBAAAFNElEQVRYhdWZa0xTVxzAf7e93BZaRHkoOEUjVgxDN6cS9IOPLZpNpzGL+MHHxA+4JXObbNkkW5YsZGNsYgjDzCXGmGl0i4/NqWyOTKOLA6d7KFNEHr6QhwEUhAItfezDxdpab9tbi7Dfp/ac/7nnd2/POfd/egSpPIOHMAFZwCIgCdA/HDDA9AJ1wE/AdqDGvVJwE5aAfOBNQHyCgr6wAcVADmCFB2IScARYODheiohANvA0sASwavor8hl6su4sRHZEkMozTEAlQ2cYKGEDUjTAeoa+LMiOWRrgxcE2UcFLIvIyFhSioGV2ZDIvRE1luiGJieHxPCXFIAnyD2Z12miwtlHb08xf5jqOd/xLWWcVNqc92C4nClJ5hlNtq/iwEbydsJg1cXOJC4tS1balr4PdLacoaiqhue+u2q5RJWzQ6PhgzHLeSljseorB0ue0U9R0lLxbBzA7LAG3C1j4GcN49piyMekTgpZ8FDW9TayqKeSC+XpA8Rr/ITBvWConUnJDLgtg0idwIiWXecNSA4r3KzwrMplDk3MwagcupTBq9RyanMOsyGS/sT6FY8VI9pqyCddIIZNTIlwjsdeUTawY6TPOp3Bu4kpGS9EhFfPFaCma3MSVPmMUhRN1cWTGzQ+5lD8y4+aTqItTrFdcm1bHzkEreN5PdU8j7XYzaUbPd83V3ts09t0h3TiJemsrTdZ2ZruNx8qeeqwOGykRYznTWe3RNkKjY4YxyfVdK2hYHTuHvIaD6oQXDn/Wq+yNa9v57d4lLOn7PMo33dzF4TvnODd1M8VNJexqOcmW8ZlsiF8EwLrardy1dXEg+X0WVH7s0Xa4aOD2jJ1efasWTokYq1QVEDk3djPDMJH0yEk48Vzql0bPZOmINAAMWp2qvhXHcJQ2IlhXQJ71K2sKabV1etX1OvrosJvpsJu5Z+tR1feApZU7kjaworqAV2uKsDsdHnWl7ecpbT8PyEMic2Tgk1tR+Kalxeds9cfS6JlsTHiZwqYjCAgk6mJddetHLSBrlLzB0QthXm3rLa3qhc921SoKZ9V95fq81sfT+TRxFee6ajndedmj/I+uGnodfQBEiQYKxq31qC/vuqJe+Mc7Z1keM8ujTK+Rn8aulpOusjSjCb0gISCgE0TCBC2ioAXkJWrPpI2kVWwiTBAR+5fJC+brrmQnLmyYl/DBtjOKworZmiSIXJ5WzBgpRrHxQFDX28zUC9mKSb7iKmF12vjw5p4BE1Mi+/pOnzsSn7nEd62n2d9WFnIpJbY1H+OX9n98xvhNL9fXbaO8U3kShIrjHRW8d+Mbv3F+hbsdFpZU5fm988fh1L1LLL+ymb4ANqcB7Tg67T0sq8rno/pvsfQvR6Hi6N0/WVaVT3eA+7qAhAEcOPmi4QemVbzL/rYyHKjebHvxZVMJK6oLApYFlbtmd8bqYlkTO5dXYtKZEjFOVVuzw8LrdV+zr+131f0GLexOtGhkmmECzxkmsG7k8yTp4xVjz5uvsaa2iOqexqD6ComwO9MNSZRN+cyr3Oa0s6XxMJ/c2o/VaQv6+iHP1hw4vMr+Nl/ltbptVHTfeOzrh1x4cvgY1+cOezd5tw5S3FzilWIGiwhYAO+0P0gitXrMDgs7bv/K5w3fPzKBfwx6Bak84yLyX/L/By5qgJ8H20IFxzTIR0vBT9snhw3YrgGqkY+Whjpbger7r+YcoHQQZfxRCmyCB7mEFfkcrJChNTxsyE5L6D9YdE9+rMA7QCpQgHwUZn3Cgvc9KvsdUvudXB7/AfyOqgH4XEisAAAAAElFTkSuQmCC"
              alt=""
              width={44}
              height={44}
              className="h-11 w-11"
              aria-hidden="true"
            />
          </span>
          <span className="w-full px-[52px] text-center text-sm font-bold leading-none">
            {oauthLoading === "line" ? "接続中..." : "LINEでログイン"}
          </span>
        </button>



        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs text-slate-400">または</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <div>
              <label className="block text-sm text-slate-700 mb-1">
                ユーザー名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="例：トクミッケ太郎"
                required
              />
              <p className="mt-1 text-xs text-slate-500">
                コメントなどに表示される名前です。（2〜20文字）
              </p>
              <p className="mt-1 text-xs font-semibold text-amber-700">
                ※ ユーザー名は登録後に変更できません。登録前に入力内容をご確認ください。
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm text-slate-700 mb-1">
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-slate-700 mb-1">
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full cursor-pointer rounded-md bg-[#001e43] text-white py-2 text-sm font-medium hover:bg-[#022a6b]"
          >
            {mode === "signup" ? "メールで登録" : "ログイン"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signup" ? "login" : "signup");
            setMessage(null);
            setShowConsentError(false);
          }}
          className="cursor-pointer text-xs text-blue-600 underline"
        >
          {mode === "signup"
            ? "すでにアカウントをお持ちの方はこちら"
            : "アカウントを新規作成する"}
        </button>

        {message && (
          <p className="text-xs text-slate-700 whitespace-pre-line">
            {message}
          </p>
        )}
      </div>
    </main>
  );
}
