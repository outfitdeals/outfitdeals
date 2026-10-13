// app/contact/page.tsx
"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type ContactForm = {
  category: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  website: string;
};

const initialForm: ContactForm = {
  category: "general",
  name: "",
  email: "",
  subject: "",
  message: "",
  website: "",
};

export default function Page() {
  const [form, setForm] = useState<ContactForm>(initialForm);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [startedAt, setStartedAt] = useState(() => Date.now());

  const update = (key: keyof ContactForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError("");
    setSuccess(false);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, startedAt }),
      });
      const result: { ok?: boolean; error?: string } = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "送信できませんでした。時間をおいて再度お試しください。");
      }
      setForm(initialForm);
      setStartedAt(Date.now());
      setSuccess(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "送信に失敗しました。");
    } finally {
      setSending(false);
    }
  };

  const fieldClass =
    "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-[#006888] focus:ring-2 focus:ring-[#006888]/15";

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-7 shadow-sm sm:px-10 sm:py-10">
        <div className="mb-8 border-b border-slate-200 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-[#001e43] sm:text-3xl">
            お問い合わせ
          </h1>
          <p className="mt-3 text-xs text-slate-500">制定日：2026年9月16日</p>
        </div>

        <div className="space-y-9">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">お問い合わせについて</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>トクミッケへのご質問やご意見、ご提案、情報交換、サービスに関するご相談などをお気軽にお寄せください。</p>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">お問い合わせ窓口</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              <p>以下のフォームよりお問い合わせください。内容を確認のうえ、必要に応じてご連絡いたします。</p>
            </div>

            {success && (
              <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                お問い合わせを受け付けました。ご連絡ありがとうございます。
              </div>
            )}
            {error && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate={false}>
              <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
                <label htmlFor="contact-website">Website</label>
                <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => update("website", event.target.value)} />
              </div>

              <div>
                <label htmlFor="contact-category" className="text-sm font-semibold text-slate-900">お問い合わせの種類 <span className="text-red-600">*</span></label>
                <select id="contact-category" required className={fieldClass} value={form.category} onChange={(event) => update("category", event.target.value)}>
                  <option value="general">一般的なお問い合わせ</option>
                  <option value="feedback">ご意見・ご提案</option>
                  <option value="exchange">情報交換・交流について</option>
                  <option value="collaboration">企業・サービスとの連携について</option>
                  <option value="other">その他</option>
                </select>
              </div>
              <div>
                <label htmlFor="contact-name" className="text-sm font-semibold text-slate-900">お名前 <span className="text-red-600">*</span></label>
                <input id="contact-name" type="text" required maxLength={100} autoComplete="name" className={fieldClass} value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="お名前をご入力ください" />
              </div>
              <div>
                <label htmlFor="contact-email" className="text-sm font-semibold text-slate-900">返信先メールアドレス <span className="text-red-600">*</span></label>
                <input id="contact-email" type="email" required maxLength={254} autoComplete="email" className={fieldClass} value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="example@gmail.com" />
              </div>
              <div>
                <label htmlFor="contact-subject" className="text-sm font-semibold text-slate-900">件名 <span className="text-red-600">*</span></label>
                <input id="contact-subject" type="text" required maxLength={150} className={fieldClass} value={form.subject} onChange={(event) => update("subject", event.target.value)} placeholder="お問い合わせの件名" />
              </div>
              <div>
                <label htmlFor="contact-message" className="text-sm font-semibold text-slate-900">お問い合わせ内容 <span className="text-red-600">*</span></label>
                <textarea id="contact-message" required rows={8} maxLength={5000} className={fieldClass} value={form.message} onChange={(event) => update("message", event.target.value)} placeholder="お問い合わせ内容をご入力ください" />
                <p className="mt-1 text-right text-xs text-slate-500">{form.message.length} / 5,000文字</p>
              </div>
              <p className="text-xs leading-6 text-slate-600">
                ご入力いただいた情報はお問い合わせへの対応に利用します。詳細は
                <Link href="/privacy" className="cursor-pointer text-[#006888] underline hover:text-[#00526b]">プライバシーポリシー</Link>
                をご確認ください。
              </p>
              <button type="submit" disabled={sending} className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg bg-[#006888] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#00526b] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
                {sending ? "送信中..." : "お問い合わせを送信"}
              </button>
            </form>
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
