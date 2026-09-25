import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function normalizeDealSlugPart(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._~-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildDealDetailPath(deal: {
  id: string;
  public_id?: number | null;
  shop_id?: string | null;
  item_id?: string | null;
}) {
  if (deal.public_id == null) return `/deals/${deal.id}`;

  const suffix = [
    normalizeDealSlugPart(deal.shop_id),
    normalizeDealSlugPart(deal.item_id),
  ]
    .filter(Boolean)
    .join("-");

  return suffix
    ? `/deals/${deal.public_id}-${suffix}`
    : `/deals/${deal.public_id}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
      console.error("reply notification: required server environment variable is missing");
      return NextResponse.json(
        { error: "Server configuration is incomplete." },
        { status: 500 }
      );
    }

    const authorization = request.headers.get("authorization");
    const accessToken = authorization?.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const {
      data: { user: actor },
      error: actorError,
    } = await admin.auth.getUser(accessToken);

    if (actorError || !actor) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const payload = await request.json().catch(() => null);
    const replyId =
      payload && typeof payload.replyId === "string" ? payload.replyId.trim() : "";

    if (!replyId) {
      return NextResponse.json({ error: "replyId is required." }, { status: 400 });
    }

    const { data: reply, error: replyError } = await admin
      .from("deal_comment_replies")
      .select("id, comment_id, user_id, body")
      .eq("id", replyId)
      .maybeSingle();

    if (replyError) {
      console.error("reply notification: reply lookup failed", replyError);
      return NextResponse.json({ error: "Failed to load reply." }, { status: 500 });
    }

    if (!reply || reply.user_id !== actor.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const { data: comment, error: commentError } = await admin
      .from("deal_comments")
      .select("id, deal_id, user_id")
      .eq("id", reply.comment_id)
      .maybeSingle();

    if (commentError) {
      console.error("reply notification: comment lookup failed", commentError);
      return NextResponse.json({ error: "Failed to load comment." }, { status: 500 });
    }

    if (!comment?.user_id) {
      return NextResponse.json({ ok: true, skipped: "no_recipient" });
    }

    if (comment.user_id === actor.id) {
      return NextResponse.json({ ok: true, skipped: "self_reply" });
    }

    const [recipientResult, profileResult, dealResult] = await Promise.all([
      admin.auth.admin.getUserById(comment.user_id),
      admin.from("profiles").select("username").eq("id", actor.id).maybeSingle(),
      admin
        .from("deals")
        .select("id, public_id, shop_id, item_id, title")
        .eq("id", comment.deal_id)
        .maybeSingle(),
    ]);

    if (recipientResult.error) {
      console.error("reply notification: recipient auth lookup failed", recipientResult.error);
      return NextResponse.json({ error: "Failed to load recipient." }, { status: 500 });
    }

    if (profileResult.error) {
      console.warn("reply notification: actor profile lookup failed", profileResult.error);
    }

    if (dealResult.error) {
      console.error("reply notification: deal lookup failed", dealResult.error);
      return NextResponse.json({ error: "Failed to load deal." }, { status: 500 });
    }

    const recipientEmail = recipientResult.data.user?.email;
    const deal = dealResult.data;

    if (!recipientEmail || !deal) {
      return NextResponse.json({ ok: true, skipped: "missing_email_or_deal" });
    }

    const actorUsername = profileResult.data?.username?.trim() || "トクミッケユーザー";
    const dealTitle = deal.title?.trim() || "ディール";
    const dealPath = buildDealDetailPath(deal);
    const requestOrigin = new URL(request.url).origin;
    const dealUrl = `${requestOrigin}${dealPath}#comment-${comment.id}`;

    const safeActor = escapeHtml(actorUsername);
    const safeTitle = escapeHtml(dealTitle);
    const safeBody = escapeHtml(String(reply.body ?? "")).replace(/\n/g, "<br />");
    const safeUrl = escapeHtml(dealUrl);

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "トクミッケ <noreply@tokumikke.com>",
        to: [recipientEmail],
        subject: `【トクミッケ】${actorUsername}さんがあなたのコメントに返信しました`,
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.7;color:#0f172a;">
            <p>${safeActor}さんが、あなたのコメントに返信しました。</p>
            <p style="font-weight:700;">${safeTitle}</p>
            <div style="margin:16px 0;padding:14px 16px;background:#f7f8fa;border-radius:8px;">
              ${safeBody}
            </div>
            <p><a href="${safeUrl}" style="color:#006888;font-weight:700;">返信を確認する</a></p>
            <p style="margin-top:28px;font-size:12px;color:#64748b;">このメールはトクミッケのコメント返信通知です。</p>
          </div>
        `,
        text: `${actorUsername}さんが、あなたのコメントに返信しました。\n\n${dealTitle}\n\n${reply.body}\n\n返信を確認する:\n${dealUrl}`,
      }),
    });

    const resendResult = await resendResponse.json().catch(() => null);

    if (!resendResponse.ok) {
      console.error("reply notification: Resend failed", resendResult);
      return NextResponse.json({ error: "Email delivery failed." }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("reply notification route error:", error);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
