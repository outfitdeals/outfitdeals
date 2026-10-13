// app/api/contact/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const categories: Record<string, string> = {
  general: "一般的なお問い合わせ",
  feedback: "ご意見・ご提案",
  exchange: "情報交換・交流について",
  collaboration: "企業・サービスとの連携について",
  // Keep previous category values accepted for compatibility with older clients.
  bug: "不具合のご報告",
  post: "投稿内容について",
  rights: "権利侵害・削除のご相談",
  privacy: "個人情報について",
  other: "その他",
};

function text(value: unknown, maximum: number): string {
  return typeof value === "string" ? value.trim().slice(0, maximum + 1) : "";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const replacements: Record<string, string> = {
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    };
    return replacements[char];
  });
}

const errorResponse = (message: string, status: number) =>
  NextResponse.json({ ok: false, error: message }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  const requestOrigin = request.headers.get("origin");
  const allowedOrigin = new URL(request.url).origin;
  const canonicalOrigin = "https://www.tokumikke.com";
  if (requestOrigin && requestOrigin !== allowedOrigin && requestOrigin !== canonicalOrigin) {
    return errorResponse("送信元を確認できませんでした。", 403);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 20000) return errorResponse("入力内容が長すぎます。", 413);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return errorResponse("入力内容を確認してください。", 400);
    }
  } catch {
    return errorResponse("入力内容を確認してください。", 400);
  }

  const category = text(body.category, 30);
  const name = text(body.name, 100);
  const email = text(body.email, 254);
  const subject = text(body.subject, 150);
  const message = text(body.message, 5000);
  const honeypot = text(body.website, 200);
  const startedAt = Number(body.startedAt);

  // Do not reveal to bots whether a honeypot triggered.
  if (honeypot) return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });

  if (
    !categories[category] ||
    !name || name.length > 100 ||
    !email || email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !subject || subject.length > 150 ||
    !message || message.length > 5000
  ) {
    return errorResponse("必須項目と入力内容をご確認ください。", 400);
  }
  if (Number.isFinite(startedAt) && startedAt > 0 && Date.now() - startedAt < 2000) {
    return errorResponse("少し時間をおいてから送信してください。", 429);
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[contact] RESEND_API_KEY is not configured");
    return errorResponse("現在送信できません。時間をおいて再度お試しください。", 503);
  }

  const html = [
    `<h2>トクミッケ お問い合わせ</h2>`,
    `<p><strong>種類：</strong>${escapeHtml(categories[category])}</p>`,
    `<p><strong>お名前：</strong>${escapeHtml(name)}</p>`,
    `<p><strong>返信先：</strong>${escapeHtml(email)}</p>`,
    `<p><strong>件名：</strong>${escapeHtml(subject)}</p>`,
    `<p><strong>内容：</strong></p><div style="white-space:pre-wrap">${escapeHtml(message)}</div>`,
  ].join("\n");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "トクミッケお問い合わせ <notifications@tokumikke.com>",
        to: ["contact@tokumikke.com"],
        reply_to: email,
        subject: `【トクミッケお問い合わせ】${subject}`,
        html,
        text: `種類：${categories[category]}\nお名前：${name}\n返信先：${email}\n件名：${subject}\n\n${message}`,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      console.error("[contact] Resend rejected message", response.status, (await response.text()).slice(0, 500));
      return errorResponse("送信に失敗しました。時間をおいて再度お試しください。", 502);
    }
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[contact] send failed", error);
    return errorResponse("通信エラーが発生しました。時間をおいて再度お試しください。", 502);
  }
}
