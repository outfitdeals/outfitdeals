// app/api/rakuten-preview/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fetchRakutenPreviewByUrl } from "@/lib/rakuten";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = body?.url as string | undefined;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "url が指定されていません。" },
        { status: 400 }
      );
    }

    // 楽天APIからプレビュー情報取得
    const preview = await fetchRakutenPreviewByUrl(url);

    // ★ ここでそのまま preview オブジェクトを返す（ラップしない）
    return NextResponse.json(preview);
  } catch (err: any) {
    console.error("rakuten-preview route error:", err);
    return NextResponse.json(
      {
        error:
          err?.message ??
          "楽天商品の取得中にエラーが発生しました。時間をおいて再度お試しください。",
      },
      { status: 500 }
    );
  }
}
