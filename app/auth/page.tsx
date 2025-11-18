"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) setMessage(`Sign up error: ${error.message}`);
      else setMessage("サインアップ用メールを送信しました。受信箱を確認してください。");
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) setMessage(`Login error: ${error.message}`);
      else setMessage("ログインに成功しました。");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md rounded-xl bg-white shadow p-6 space-y-4">
        <h1 className="text-xl font-semibold text-slate-900">
          {mode === "signup" ? "新規登録" : "ログイン"}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-slate-700 mb-1">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-slate-700 mb-1">パスワード</label>
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
            className="w-full rounded-md bg-[#001e43] text-white py-2 text-sm font-medium hover:bg-[#022a6b]"
          >
            {mode === "signup" ? "メールで登録" : "ログイン"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signup" ? "login" : "signup")}
          className="text-xs text-blue-600 underline"
        >
          {mode === "signup"
            ? "すでにアカウントをお持ちの方はこちら"
            : "アカウントを新規作成する"}
        </button>

        {message && (
          <p className="text-xs text-slate-700 whitespace-pre-line">{message}</p>
        )}
      </div>
    </main>
  );
}
