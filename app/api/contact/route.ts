// app/api/contact/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";

export const runtime = "nodejs";

const MESSAGE_MAX = 300;
const NAME_MAX = 60;
const SUBJECT_MAX = 100;
const RATE_LIMIT = 3;
const RATE_LIMIT_WINDOW_SEC = 600;

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !token) return false;
  const params = new URLSearchParams({ secret, response: token });
  if (ip) params.set("remoteip", ip);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST", body: params, cache: "no-store", signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return false;
  const result: { success?: boolean; hostname?: string } = await response.json();
  if (!result.success) return false;
  const hosts = new Set(["www.tokumikke.com", "tokumikke.com"]);
  if (process.env.NODE_ENV !== "production") hosts.add("localhost");
  return Boolean(result.hostname && hosts.has(result.hostname));
}

async function consumeRateLimit(ip: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const pepper = process.env.CONTACT_RATE_LIMIT_PEPPER;
  if (!url || !key || !pepper) throw new Error("Contact rate-limit configuration missing");
  const hashedIp = createHash("sha256").update(`${pepper}:${ip}`).digest("hex");
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/consume_contact_rate_limit`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_key: hashedIp, p_max: RATE_LIMIT, p_window_seconds: RATE_LIMIT_WINDOW_SEC }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    console.error("[contact] rate limit RPC error", response.status, (await response.text()).slice(0, 300));
    throw new Error("Contact rate-limit RPC failed");
  }
  return (await response.json()) === true;
}

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
  const name = text(body.name, NAME_MAX);
  const email = text(body.email, 254);
  const subject = text(body.subject, SUBJECT_MAX);
  const message = text(body.message, MESSAGE_MAX);
  const honeypot = text(body.website, 200);
  const startedAt = Number(body.startedAt);
  const turnstileToken = text(body.turnstileToken, 2048);

  // Do not reveal to bots whether a honeypot triggered.
  if (honeypot) return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });

  if (
    !categories[category] ||
    !name || name.length > NAME_MAX ||
    !email || email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !subject || subject.length > SUBJECT_MAX ||
    !message || message.length > MESSAGE_MAX
  ) {
    return errorResponse("必須項目と入力内容をご確認ください。", 400);
  }
  if (Number.isFinite(startedAt) && startedAt > 0 && Date.now() - startedAt < 2000) {
    return errorResponse("少し時間をおいてから送信してください。", 429);
  }

  // Missing security configuration must not silently disable verification.
  if (!process.env.TURNSTILE_SECRET_KEY || !process.env.CONTACT_RATE_LIMIT_PEPPER) {
    console.error("[contact] security configuration missing");
    return errorResponse("現在お問い合わせを受け付けられません。時間をおいて再度お試しください。", 503);
  }

  // On Vercel, the trusted proxy provides the visitor IP. Rate-limit failures fail closed.
  const ip = request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  try {
    const allowed = await consumeRateLimit(ip);
    if (!allowed) return errorResponse("送信回数の上限に達しました。10分ほど待ってから再度お試しください。", 429);
  } catch (caught) {
    console.error("[contact] rate-limit failed", caught);
    return errorResponse("現在送信できません。時間をおいて再度お試しください。", 503);
  }

  try {
    if (!(await verifyTurnstile(turnstileToken, ip === "unknown" ? "" : ip))) {
      return errorResponse("BOT確認に失敗しました。ページを再読み込みしてもう一度お試しください。", 403);
    }
  } catch (caught) {
    console.error("[contact] turnstile verification failed", caught);
    return errorResponse("BOT確認に接続できませんでした。時間をおいて再度お試しください。", 503);
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
