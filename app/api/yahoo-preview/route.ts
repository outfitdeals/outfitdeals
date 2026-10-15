
// app/api/yahoo-preview/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fetchYahooPreviewByUrl } from "@/lib/yahoo";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    const url =
      body && typeof body === "object" && "url" in body
        ? (body as { url?: unknown }).url
        : undefined;

    if (typeof url !== "string" || !url.trim() || url.length > 2048) {
      return NextResponse.json(
        { error: "有効な商品URLを指定してください。" },
        { status: 400 }
      );
    }

    const preview = await fetchYahooPreviewByUrl(url);
    return NextResponse.json(preview, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "商品情報を取得できませんでした。";
    console.error("[api/yahoo-preview] failed:", message);
    const status =
      message.includes("タイムアウト") || message.includes("接続できません")
        ? 503
        : message.includes("アクセスが集中")
          ? 429
          : message.includes("環境変数")
            ? 503
            : 400;
    return NextResponse.json(
      { error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
