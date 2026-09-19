// app/api/rakuten-preview/route.ts

import { NextRequest, NextResponse } from "next/server";
import { fetchRakutenPreviewByUrl } from "@/lib/rakuten";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = body?.url;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "url は必須です。" },
        { status: 400 }
      );
    }

    console.log("[api/rakuten-preview] request url:", url);

    const preview = await fetchRakutenPreviewByUrl(url);

    return NextResponse.json(preview);
  } catch (e: any) {
    console.error("[api/rakuten-preview] error:", e);

    const message = String(e?.message ?? "");

    const isRateLimited =
      message.includes("429") ||
      message.toLowerCase().includes("rate limit");

    if (isRateLimited) {
      return NextResponse.json(
        {
          error:
            "楽天APIへのアクセスが一時的に集中しています。少し時間をおいてからもう一度お試しください。",
          code: "RAKUTEN_RATE_LIMIT",
        },
        { status: 429 }
      );
    }

    const isTemporarilyUnavailable =
      message.includes("503") ||
      message.toLowerCase().includes("service_unavailable") ||
      message.toLowerCase().includes("under maintenance") ||
      message.includes("一時的") ||
      message.includes("メンテナンス") ||
      message.includes("混雑");

    if (isTemporarilyUnavailable) {
      return NextResponse.json(
        {
          error:
            "楽天APIを一時的に利用できません。メンテナンスや混雑の可能性があります。少し時間をおいてからもう一度お試しください。",
          code: "RAKUTEN_TEMPORARILY_UNAVAILABLE",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error:
          message ||
          "楽天の商品情報を取得できませんでした。",
      },
      { status: 500 }
    );
  }
}
