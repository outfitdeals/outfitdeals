import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

    /*
     * Avatar
     *
     * Current MyPage implementation stores the avatar at:
     *
     * avatars/{userId}/avatar.jpg
     *
     * Failure to remove the avatar should not leave the account undeletable.
     * We log the error and continue with account deletion.
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
     * Delete the Supabase Auth user.
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

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("delete account route error:", error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}