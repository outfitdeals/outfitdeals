import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PROTECTED_ADMIN_USER_ID = "1440c629-69cf-4b03-b552-22cb605a0f19";

async function sendAccountDeletedEmail(
  resendApiKey: string,
  recipientEmail: string
) {
  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "トクミッケ <noreply@tokumikke.com>",
      to: [recipientEmail],
      subject: "【トクミッケ】アカウント削除完了のお知らせ",
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.8;color:#0f172a;">
          <p>トクミッケをご利用いただき、ありがとうございました。</p>

          <p>アカウントの削除が完了しました。</p>

          <p>
            投稿・コメント・返信は、サイトの情報を維持するためアカウントとの紐付けを解除した状態で残ります。
            保存・リアクションなどのアカウントデータは削除されています。
          </p>

          <p style="margin-top:28px;">
            これまでトクミッケをご利用いただき、ありがとうございました。
          </p>

          <p style="margin-top:28px;color:#64748b;font-size:13px;">
            トクミッケ運営
          </p>
        </div>
      `,
      text: `トクミッケをご利用いただき、ありがとうございました。

アカウントの削除が完了しました。

投稿・コメント・返信は、サイトの情報を維持するためアカウントとの紐付けを解除した状態で残ります。
保存・リアクションなどのアカウントデータは削除されています。

これまでトクミッケをご利用いただき、ありがとうございました。

トクミッケ運営`,
    }),
  });

  const resendResult = await resendResponse.json().catch(() => null);

  if (!resendResponse.ok) {
    console.error(
      "delete account: confirmation email failed",
      resendResult
    );
    return false;
  }

  return true;
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(
        "delete account: required server environment variable is missing"
      );

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
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const userId = user.id;
    const userEmail = user.email?.trim() ?? "";

    /*
     * Protect the main administrator account from self-deletion.
     */
    if (userId === PROTECTED_ADMIN_USER_ID) {
      console.warn(
        "delete account: blocked deletion attempt for protected admin user"
      );

      return NextResponse.json(
        { error: "This account cannot be deleted." },
        { status: 403 }
      );
    }

    /*
     * Delete the Supabase Auth user first.
     *
     * Database foreign keys handle related records:
     *
     * - deals.user_id                 -> SET NULL
     * - deal_comments.user_id         -> SET NULL
     * - deal_comment_replies.user_id  -> SET NULL
     * - profiles.id                   -> CASCADE
     * - likes / dislikes / saves      -> CASCADE
     * - comment reactions             -> CASCADE
     * - reports                       -> CASCADE
     * - notifications                 -> removed with profile
     * - deal_views.user_id            -> SET NULL
     *
     * Content itself remains while the account relationship is removed.
     */
    const { error: deleteUserError } =
      await admin.auth.admin.deleteUser(userId);

    if (deleteUserError) {
      console.error(
        "delete account: auth user deletion failed",
        deleteUserError
      );

      return NextResponse.json(
        { error: "Failed to delete account." },
        { status: 500 }
      );
    }

    /*
     * Remove the avatar only after the account deletion has succeeded.
     *
     * A storage cleanup failure must not turn a successful account deletion
     * into a failed deletion response.
     */
    const { error: avatarDeleteError } = await admin.storage
      .from("avatars")
      .remove([`${userId}/avatar.jpg`]);

    if (avatarDeleteError) {
      console.error(
        "delete account: avatar deletion failed",
        avatarDeleteError
      );
    }

    /*
     * Send a deletion confirmation email after successful account deletion.
     *
     * Email delivery failure must not turn a completed account deletion
     * into an error. The account is already gone at this point.
     */
    let confirmationEmailSent = false;

    if (resendApiKey && userEmail) {
      confirmationEmailSent = await sendAccountDeletedEmail(
        resendApiKey,
        userEmail
      );
    } else {
      console.warn(
        "delete account: confirmation email skipped because RESEND_API_KEY or user email is missing"
      );
    }

    return NextResponse.json({
      ok: true,
      confirmationEmailSent,
    });
  } catch (error) {
    console.error("delete account route error:", error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
