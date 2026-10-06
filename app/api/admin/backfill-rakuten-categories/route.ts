import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { fetchRakutenItemGenreId } from "@/lib/rakuten";
import { resolveRakutenDealCategory } from "@/lib/rakutenCategory";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function isAuthorized(request: NextRequest): boolean {
  const expectedSecret = process.env.RAKUTEN_AUTOMATION_SECRET;
  if (!expectedSecret) return process.env.NODE_ENV !== "production";

  return (
    request.headers.get("authorization") ===
    `Bearer ${expectedSecret}`
  );
}

function readIntegerParam(
  request: NextRequest,
  name: string,
  fallback: number,
  min: number,
  max: number
): number {
  const raw = request.nextUrl.searchParams.get(name);
  if (!raw) return fallback;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(Math.max(Math.floor(parsed), min), max);
}

function readDryRun(request: NextRequest): boolean {
  const raw = request.nextUrl.searchParams.get("dryRun");
  return raw !== "false" && raw !== "0";
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const startedAt = Date.now();
  const dryRun = readDryRun(request);
  const limit = readIntegerParam(
    request,
    "limit",
    DEFAULT_LIMIT,
    1,
    MAX_LIMIT
  );
  const offset = readIntegerParam(
    request,
    "offset",
    0,
    0,
    1_000_000
  );

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const adminUserId = process.env.TOKUMIKKE_ADMIN_USER_ID;

    if (!supabaseUrl) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL is not configured."
      );
    }

    if (!serviceRoleKey) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is not configured."
      );
    }

    if (!adminUserId) {
      throw new Error(
        "TOKUMIKKE_ADMIN_USER_ID is not configured."
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    // Only rows created by the Rakuten auto-post pipeline:
    // admin user + Rakuten market + sale start/end metadata.
    const { data: deals, error: selectError, count } = await admin
      .from("deals")
      .select(
        "id, public_id, title, category, shop_id, item_id, created_at",
        { count: "exact" }
      )
      .eq("user_id", adminUserId)
      .eq("market_code", "rk")
      .not("source_sale_started_at", "is", null)
      .not("source_sale_ends_at", "is", null)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (selectError) {
      throw new Error(
        `自動投稿ディールの取得に失敗しました: ${selectError.message}`
      );
    }

    const rows = deals ?? [];
    const results: Array<{
      id: string;
      publicId: number | null;
      title: string;
      shopId: string | null;
      itemId: string | null;
      genreId: number | null;
      oldCategory: string | null;
      newCategory: string | null;
      changed: boolean;
      updated: boolean;
      skippedReason: string | null;
    }> = [];

    let changedCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const deal of rows) {
      const baseResult = {
        id: String(deal.id),
        publicId:
          typeof deal.public_id === "number"
            ? deal.public_id
            : null,
        title: String(deal.title ?? ""),
        shopId:
          typeof deal.shop_id === "string"
            ? deal.shop_id
            : null,
        itemId:
          typeof deal.item_id === "string"
            ? deal.item_id
            : null,
        genreId: null as number | null,
        oldCategory:
          typeof deal.category === "string"
            ? deal.category
            : null,
        newCategory: null as string | null,
        changed: false,
        updated: false,
        skippedReason: null as string | null,
      };

      if (!baseResult.shopId || !baseResult.itemId) {
        skippedCount += 1;
        results.push({
          ...baseResult,
          skippedReason: "shop_id または item_id がありません。",
        });
        continue;
      }

      try {
        const genreId = await fetchRakutenItemGenreId(
          baseResult.shopId,
          baseResult.itemId
        );

        if (genreId == null) {
          skippedCount += 1;
          results.push({
            ...baseResult,
            skippedReason:
              "楽天Item Search APIから genreId を取得できませんでした。",
          });
          continue;
        }

        const newCategory =
          await resolveRakutenDealCategory(genreId);

        if (newCategory === "other") {
          skippedCount += 1;
          results.push({
            ...baseResult,
            genreId,
            newCategory,
            skippedReason:
              "楽天ジャンル階層をトクミッケカテゴリへ確定できませんでした。",
          });
          continue;
        }

        const changed =
          baseResult.oldCategory !== newCategory;

        if (!changed) {
          unchangedCount += 1;
          results.push({
            ...baseResult,
            genreId,
            newCategory,
          });
          continue;
        }

        changedCount += 1;

        if (dryRun) {
          results.push({
            ...baseResult,
            genreId,
            newCategory,
            changed: true,
          });
          continue;
        }

        const { error: updateError } = await admin
          .from("deals")
          .update({ category: newCategory })
          .eq("id", deal.id);

        if (updateError) {
          failedCount += 1;
          results.push({
            ...baseResult,
            genreId,
            newCategory,
            changed: true,
            skippedReason:
              `UPDATE失敗: ${updateError.message}`,
          });
          continue;
        }

        updatedCount += 1;
        results.push({
          ...baseResult,
          genreId,
          newCategory,
          changed: true,
          updated: true,
        });
      } catch (error: any) {
        failedCount += 1;
        results.push({
          ...baseResult,
          skippedReason:
            String(error?.message ?? "").trim() ||
            "分類処理に失敗しました。",
        });
      }
    }

    const totalCount = count ?? rows.length;
    const nextOffset = offset + rows.length;
    const hasMore = nextOffset < totalCount;

    return NextResponse.json(
      {
        ok: true,
        dryRun,
        elapsedMs: Date.now() - startedAt,
        totalCount,
        offset,
        limit,
        processedCount: rows.length,
        changedCount,
        updatedCount,
        unchangedCount,
        skippedCount,
        failedCount,
        nextOffset: hasMore ? nextOffset : null,
        hasMore,
        results,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error: any) {
    console.error(
      "[rakuten-category-backfill] error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        dryRun,
        elapsedMs: Date.now() - startedAt,
        error:
          String(error?.message ?? "").trim() ||
          "楽天カテゴリのバックフィルに失敗しました。",
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
