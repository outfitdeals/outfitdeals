import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const reasonLabels: Record<string, string> = {
  harassment: "誹謗中傷・嫌がらせ",
  sexual: "不適切・性的な内容",
  spam: "スパム・宣伝",
  other: "その他",
};

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;
    const reportEmail = process.env.REPORT_NOTIFICATION_EMAIL;

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !reportEmail) {
      console.error("report notification: required server environment variable is missing");
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
    const reportId =
      payload && typeof payload.reportId === "string"
        ? payload.reportId.trim()
        : "";

    if (!reportId) {
      return NextResponse.json({ error: "reportId is required." }, { status: 400 });
    }

    const { data: report, error: reportError } = await admin
      .from("comment_reports")
      .select(
        "id, reporter_user_id, comment_id, reply_id, reason, details, status, created_at"
      )
      .eq("id", reportId)
      .maybeSingle();

    if (reportError) {
      console.error("report notification: report lookup failed", reportError);
      return NextResponse.json({ error: "Failed to load report." }, { status: 500 });
    }

    if (!report || report.reporter_user_id !== actor.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    let targetBody = "";
    let targetAuthorId: string | null = null;
    let dealId: string | null = null;
    let commentAnchorId: string | null = null;
    let targetType = "";

    if (report.comment_id) {
      const { data: comment, error } = await admin
        .from("deal_comments")
        .select("id, deal_id, user_id, body")
        .eq("id", report.comment_id)
        .maybeSingle();

      if (error || !comment) {
        console.error("report notification: comment lookup failed", error);
        return NextResponse.json({ error: "Failed to load comment." }, { status: 500 });
      }

      targetBody = String(comment.body ?? "");
      targetAuthorId = comment.user_id;
      dealId = comment.deal_id;
      commentAnchorId = comment.id;
      targetType = "コメント";
    } else if (report.reply_id) {
      const { data: reply, error: replyError } = await admin
        .from("deal_comment_replies")
        .select("id, comment_id, user_id, body")
        .eq("id", report.reply_id)
        .maybeSingle();

      if (replyError || !reply) {
        console.error("report notification: reply lookup failed", replyError);
        return NextResponse.json({ error: "Failed to load reply." }, { status: 500 });
      }

      const { data: parent, error: parentError } = await admin
        .from("deal_comments")
        .select("id, deal_id")
        .eq("id", reply.comment_id)
        .maybeSingle();

      if (parentError || !parent) {
        console.error("report notification: parent comment lookup failed", parentError);
        return NextResponse.json(
          { error: "Failed to load parent comment." },
          { status: 500 }
        );
      }

      targetBody = String(reply.body ?? "");
      targetAuthorId = reply.user_id;
      dealId = parent.deal_id;
      commentAnchorId = parent.id;
      targetType = "返信";
    } else {
      return NextResponse.json({ error: "Report target is missing." }, { status: 400 });
    }

    const [reporterProfile, authorProfile, dealResult] = await Promise.all([
      admin.from("profiles").select("username").eq("id", actor.id).maybeSingle(),
      targetAuthorId
        ? admin.from("profiles").select("username").eq("id", targetAuthorId).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
      admin
        .from("deals")
        .select("id, public_id, shop_id, item_id, title")
        .eq("id", dealId)
        .maybeSingle(),
    ]);

    if (dealResult.error || !dealResult.data) {
      console.error("report notification: deal lookup failed", dealResult.error);
      return NextResponse.json({ error: "Failed to load deal." }, { status: 500 });
    }

    const deal = dealResult.data;
    const publicId = deal.public_id;
    const suffix = [deal.shop_id, deal.item_id]
      .map((value: string | null) =>
        String(value ?? "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9._~-]+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-+|-+$/g, "")
      )
      .filter(Boolean)
      .join("-");

    const dealPath =
      publicId == null
        ? `/deals/${deal.id}`
        : suffix
          ? `/deals/${publicId}-${suffix}`
          : `/deals/${publicId}`;

    const origin = new URL(request.url).origin;
    const targetUrl = `${origin}${dealPath}#comment-${commentAnchorId}`;

    const reporterName =
      reporterProfile.data?.username?.trim() || "トクミッケユーザー";
    const authorName =
      authorProfile.data?.username?.trim() || "匿名ユーザー";
    const reasonLabel = reasonLabels[report.reason] ?? report.reason;
    const details = String(report.details ?? "").trim();
    const dealTitle = deal.title?.trim() || "ディール";

    const safeBody = escapeHtml(targetBody).replace(/\n/g, "<br />");
    const safeDetails = escapeHtml(details).replace(/\n/g, "<br />");

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "トクミッケ <noreply@tokumikke.com>",
        to: [reportEmail],
        subject: `【トクミッケ】${targetType}が通報されました`,
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.7;color:#0f172a;">
            <h2 style="margin:0 0 16px;">新しい通報があります</h2>
            <p><strong>対象:</strong> ${escapeHtml(targetType)}</p>
            <p><strong>理由:</strong> ${escapeHtml(reasonLabel)}</p>
            <p><strong>通報者:</strong> ${escapeHtml(reporterName)}</p>
            <p><strong>投稿者:</strong> ${escapeHtml(authorName)}</p>
            <p><strong>ディール:</strong> ${escapeHtml(dealTitle)}</p>
            <div style="margin:16px 0;padding:14px 16px;background:#f7f8fa;border-radius:8px;">
              ${safeBody}
            </div>
            ${
              details
                ? `<p><strong>補足:</strong></p><div style="margin:8px 0 16px;padding:12px 14px;background:#f7f8fa;border-radius:8px;">${safeDetails}</div>`
                : ""
            }
            <p><a href="${escapeHtml(targetUrl)}" style="color:#006888;font-weight:700;">通報された投稿を確認する</a></p>
            <p style="margin-top:28px;font-size:12px;color:#64748b;">Report ID: ${escapeHtml(report.id)}</p>
          </div>
        `,
        text: `新しい通報があります

対象: ${targetType}
理由: ${reasonLabel}
通報者: ${reporterName}
投稿者: ${authorName}
ディール: ${dealTitle}

${targetBody}

${details ? `補足: ${details}\n\n` : ""}確認する:
${targetUrl}

Report ID: ${report.id}`,
      }),
    });

    const resendResult = await resendResponse.json().catch(() => null);

    if (!resendResponse.ok) {
      console.error("report notification: Resend failed", resendResult);
      return NextResponse.json({ error: "Email delivery failed." }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("report notification route error:", error);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
