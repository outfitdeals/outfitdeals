// app/api/rakuten-preview/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchRakutenPreviewByUrl,
  parseRakutenItemUrl,
} from "@/lib/rakuten";

export const runtime = "nodejs";

function normalizeRakutenPath(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.hostname !== "item.rakuten.co.jp") return null;

    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length < 2) return null;

    return `/${segments[0].toLowerCase()}/${segments[1].toLowerCase()}/`;
  } catch {
    return null;
  }
}

function extractRakutenItemPath(rawUrl: string): string | null {
  const directPath = normalizeRakutenPath(rawUrl);
  if (directPath) return directPath;

  try {
    const url = new URL(rawUrl);

    if (url.hostname !== "hb.afl.rakuten.co.jp") {
      return null;
    }

    const pcUrl = url.searchParams.get("pc");
    if (!pcUrl) return null;

    return normalizeRakutenPath(pcUrl);
  } catch {
    return null;
  }
}

function isoToRakutenJapanTime(value: string | null | undefined): string | null {
  if (!value) return null;

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return null;

  const jst = new Date(timestamp + 9 * 60 * 60 * 1000);
  const year = jst.getUTCFullYear();
  const month = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  const hour = String(jst.getUTCHours()).padStart(2, "0");
  const minute = String(jst.getUTCMinutes()).padStart(2, "0");
  const second = String(jst.getUTCSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

async function findExistingRakutenPreview(rawUrl: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  const parsed = parseRakutenItemUrl(rawUrl);
  const requestedPath = normalizeRakutenPath(rawUrl);

  if (!requestedPath) {
    return null;
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await admin
    .from("deals")
    .select(
      "title, price, image_url, source_url, shop_name, shop_id, free_shipping, item_description, expires_at, source_sale_ends_at, created_at"
    )
    .eq("market_code", "rk")
    .eq("shop_id", parsed.shopCode)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[api/rakuten-preview] existing deal lookup failed:", error);
    return null;
  }

  const matched = (data ?? []).find(
    (deal) =>
      extractRakutenItemPath(String(deal.source_url ?? "")) === requestedPath
  );

  if (!matched) {
    return null;
  }

  console.log("[api/rakuten-preview] reused existing Rakuten deal:", {
    sourceUrl: matched.source_url,
    shopId: matched.shop_id,
  });

  return {
    title: String(matched.title ?? ""),
    price: Number(matched.price) || 0,
    imageUrl: matched.image_url ? String(matched.image_url) : null,
    itemUrl: rawUrl,
    shopName: String(matched.shop_name ?? ""),
    shopCode: parsed.shopCode,
    freeShipping:
      typeof matched.free_shipping === "boolean"
        ? matched.free_shipping
        : null,
    itemDescription: matched.item_description
      ? String(matched.item_description)
      : null,
    endTime: isoToRakutenJapanTime(
      matched.source_sale_ends_at ?? matched.expires_at
    ),
  };
}

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

    const existingPreview = await findExistingRakutenPreview(url);

    if (existingPreview) {
      return NextResponse.json(existingPreview, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    const preview = await fetchRakutenPreviewByUrl(url);

    return NextResponse.json(preview, {
      headers: { "Cache-Control": "no-store" },
    });
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
