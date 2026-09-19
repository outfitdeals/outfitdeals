// app/api/rakuten-affiliate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createRakutenAffiliateLinkByUrl } from "@/lib/rakuten";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "url が指定されていません。" },
        { status: 400 }
      );
    }

    const affiliateUrl = await createRakutenAffiliateLinkByUrl(url);
    return NextResponse.json({ affiliateUrl });
  } catch (e: any) {
    console.error("rakuten-affiliate API error:", e);
    return NextResponse.json(
      {
        error:
          e?.message ??
          "楽天アフィリエイトリンクの生成に失敗しました。時間をおいて再度お試しください。",
      },
      { status: 400 }
    );
  }
}
