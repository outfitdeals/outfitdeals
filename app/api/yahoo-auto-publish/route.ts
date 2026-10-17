// app/api/yahoo-auto-publish/route.ts
// Yahoo!本番投稿用の独立エンドポイント。
// 既存 /api/yahoo-auto-post はプレビュー専用のまま維持する。
// 二重の安全装置: POSTリクエスト + YAHOO_POSTING_ENABLED=true が必要。
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { GET as getYahooPreview } from "../yahoo-auto-post/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_POSTS = 15;
// 300-second Vercel limit: reserve time to finish the database log and response.
const SAFE_EXECUTION_MS = 235_000;
const AI_AND_DB_BUDGET_MS = 27_000;
const OPENAI_MODEL = "gpt-5-nano";
const JOB_NAME = "yahoo-auto-publish";
const LOCK_STALE_MS = 10 * 60 * 1000;

type Candidate = {
  category: string;
  title: string;
  description: string | null;
  price: number;
  shopId: string;
  itemId: string;
  shopName: string;
  itemUrl: string;
  imageUrl: string;
  freeShipping: boolean | null;
  saleStartsAt: string;
  saleEndsAt: string;
  affiliateUrl: string | null;
  trendRank?: number;
};

type CreatedDeal = {
  id: string;
  publicId: number;
  dealNumber: number;
  path: string;
  itemCode: string;
  category: string;
};

function authorized(req: NextRequest): boolean {
  const secret = process.env.YAHOO_AUTOMATION_SECRET;
  return Boolean(secret && req.headers.get("authorization") === `Bearer ${secret}`);
}

function fail(message: string, status: number) {
  return NextResponse.json({ ok: false, postedCount: 0, error: message },
    { status, headers: { "Cache-Control": "no-store" } });
}

function sameProductUrl(url: string, item: Candidate): boolean {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    return parsed.protocol === "https:" &&
      parsed.hostname === "store.shopping.yahoo.co.jp" &&
      segments.length === 2 &&
      segments[0].toLowerCase() === item.shopId.toLowerCase() &&
      segments[1].toLowerCase() === `${item.itemId}.html`.toLowerCase();
  } catch {
    return false;
  }
}

function validAffiliate(item: Candidate): boolean {
  if (!item.affiliateUrl || !sameProductUrl(item.itemUrl, item)) return false;
  try {
    const link = new URL(item.affiliateUrl);
    const destination = link.searchParams.get("vc_url");
    return link.protocol === "https:" &&
      link.hostname === "ck.jp.ap.valuecommerce.com" &&
      link.pathname === "/servlet/referral" &&
      link.searchParams.get("sid") === process.env.VALUECOMMERCE_SID &&
      link.searchParams.get("pid") === process.env.VALUECOMMERCE_PID &&
      Boolean(destination && sameProductUrl(destination, item));
  } catch {
    return false;
  }
}

function outputText(data: any): string {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  return (Array.isArray(data?.output) ? data.output : [])
    .flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
    .filter((part: any) => part?.type === "output_text" && typeof part.text === "string")
    .map((part: any) => part.text.trim())
    .filter(Boolean).join("\n").trim();
}

async function generateComment(item: Candidate): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const result = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      instructions: [
        "日本のセール情報共有サイト『トクミッケ』向けに、日本語で2〜3文の自然な商品紹介コメントを書いてください。",
        "提供されたYahoo!ショッピングの商品名、現行価格、店舗名、セール期間だけを根拠にしてください。",
        "通常価格、割引率、割引額、最安値、レビュー評価、在庫、品質、効果を推測しないでください。",
        "送料無料と記載できるのはfreeShipping=trueの場合だけです。",
        "ランキングについてはtrendRankがある場合にのみ触れてよいです。",
        "事実のない誇張、URL、ハッシュタグ、見出し、箇条書きは不要です。本文だけを返してください。",
      ].join("\n"),
      input: JSON.stringify({ title: item.title, price: item.price, shopName: item.shopName,
        freeShipping: item.freeShipping, saleStartsAt: item.saleStartsAt,
        saleEndsAt: item.saleEndsAt, trendRank: item.trendRank ?? null }),
      reasoning: { effort: "low" },
      max_output_tokens: 800,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (!result.ok) throw new Error(`AI HTTP ${result.status}`);
  const comment = outputText(await result.json());
  if (!comment) throw new Error("AI returned no comment");
  return comment;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return fail("Unauthorized", 401);
  if (process.env.YAHOO_POSTING_ENABLED !== "true") {
    return NextResponse.json({ ok: true, mode: "disabled", postedCount: 0,
      message: "Yahoo!本番投稿は無効です。YAHOO_POSTING_ENABLED=true が設定されるまでDBへ投稿しません。" },
      { headers: { "Cache-Control": "no-store" } });
  }

  // During the first live test, set YAHOO_POST_LIMIT=1. Production default remains 15.
  const configuredLimit = process.env.YAHOO_POST_LIMIT?.trim();
  const postLimit = configuredLimit === undefined || configuredLimit === ""
    ? MAX_POSTS : Number(configuredLimit);
  if (!Number.isInteger(postLimit) || postLimit < 1 || postLimit > MAX_POSTS) {
    return fail("YAHOO_POST_LIMIT must be an integer from 1 to 15", 503);
  }

  const start = Date.now();
  let runId: string | null = null;
  // 楽天の自動投稿と同様、DBの未生成スキーマ型による never 推論を回避する。
  let admin: any = null;
  let postedCount = 0;
  let duplicateCount = 0;
  let aiFailureCount = 0;
  let postFailureCount = 0;
  let stoppedForTime = false;
  let candidateCount = 0;
  const createdDeals: CreatedDeal[] = [];

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const adminUserId = process.env.TOKUMIKKE_ADMIN_USER_ID;
    if (!supabaseUrl || !serviceKey || !adminUserId) throw new Error("Supabase / admin environment variables are missing");
    admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: active, error: lockError } = await admin.from("cron_job_runs")
      .select("id").eq("job_name", JOB_NAME).eq("status", "running")
      .gte("started_at", new Date(start - LOCK_STALE_MS).toISOString()).limit(1);
    if (lockError) throw new Error(`実行ロックの確認失敗: ${lockError.message}`);
    if ((active ?? []).length) return NextResponse.json({ ok: true, skipped: true,
      reason: "ALREADY_RUNNING", postedCount: 0 }, { headers: { "Cache-Control": "no-store" } });

    const { data: logged, error: logError } = await admin.from("cron_job_runs").insert({
      job_name: JOB_NAME, invocation_source: "manual_or_other", started_at: new Date(start).toISOString(), status: "running",
    }).select("id").single();
    if (logError || !logged?.id) throw new Error(`実行ログ開始失敗: ${logError?.message ?? "unknown"}`);
    runId = String(logged.id);

    // 検証済みプレビューのGET関数を直接使用。選定・重複除外・VCリンク照合ロジックを再実装しない。
    const previewResponse = await getYahooPreview(req);
    const preview = await previewResponse.json();
    if (!previewResponse.ok || !preview.ok || preview.mode !== "preview_only" ||
        preview.affiliateVerifiedCount !== preview.selectedCount ||
        !Array.isArray(preview.selectedCandidates) || preview.selectedCandidates.length > MAX_POSTS) {
      throw new Error("Yahoo!選定/リンク検証に失敗したため投稿を停止しました");
    }
    const items = (preview.selectedCandidates as Candidate[]).slice(0, postLimit);
    candidateCount = items.length;

    for (const item of items) {
      // Do not start a potentially 20-second AI call when the remaining
      // time cannot cover AI + insertion + run-log finalization.
      if (Date.now() - start >= SAFE_EXECUTION_MS - AI_AND_DB_BUDGET_MS) {
        stoppedForTime = true; break;
      }
      try {
        if (!validAffiliate(item)) throw new Error("商品とアフィリエイトURLが一致しません");
        const image = new URL(item.imageUrl);
        if (image.protocol !== "https:") throw new Error("商品画像URLが不正です");
        const saleStart = new Date(item.saleStartsAt);
        const saleEnd = new Date(item.saleEndsAt);
        if (!Number.isFinite(item.price) || item.price <= 0 ||
            !Number.isFinite(saleStart.getTime()) || !Number.isFinite(saleEnd.getTime()) ||
            Date.now() < saleStart.getTime() || Date.now() >= saleEnd.getTime()) {
          throw new Error("現在有効なセール期間/価格ではありません");
        }
        const { data: sameSale, error: duplicateError } = await admin.from("deals")
          .select("id").eq("market_code", "yh").eq("shop_id", item.shopId)
          .eq("item_id", item.itemId).eq("source_sale_started_at", saleStart.toISOString())
          .eq("source_sale_ends_at", saleEnd.toISOString()).limit(1).maybeSingle();
        if (duplicateError) throw new Error(`重複確認失敗: ${duplicateError.message}`);
        if (sameSale) { duplicateCount++; continue; }

        let comment: string;
        try { comment = await generateComment(item); }
        catch (error) { aiFailureCount++; console.error("[yahoo-auto-publish] AI failed", error); continue; }
        if (Date.now() - start >= SAFE_EXECUTION_MS - 5_000 || Date.now() >= saleEnd.getTime()) {
          stoppedForTime = true; break;
        }
        const { data: previous, error: numberError } = await admin.from("deals")
          .select("deal_number").eq("market_code", "yh").eq("shop_id", item.shopId)
          .eq("item_id", item.itemId).order("deal_number", { ascending: false }).limit(1).maybeSingle();
        if (numberError) throw new Error(`番号取得失敗: ${numberError.message}`);
        let dealNumber = (previous?.deal_number ?? 0) + 1;
        let created: { id: string; public_id: number } | null = null;
        let concurrentDuplicate = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          const { data, error } = await admin.from("deals").insert({
            user_id: adminUserId, title: item.title, price: item.price, orig_price: null,
            market: "Yahoo!ショッピング", market_code: "yh", shop_id: item.shopId,
            item_id: item.itemId, shop_name: item.shopName || null,
            source_url: item.itemUrl, deal_url: item.affiliateUrl, image_url: item.imageUrl,
            comment, item_description: item.description?.trim().slice(0, 2000) || null, category: item.category, brand: null,
            free_shipping: item.freeShipping === true, expires_at: saleEnd.toISOString(),
            source_sale_started_at: saleStart.toISOString(), source_sale_ends_at: saleEnd.toISOString(),
            deal_number: dealNumber, likes_count: 0, comments_count: 0,
          }).select("id, public_id").single();
          if (!error && data?.id) { created = data; break; }
          if (error?.code !== "23505") throw new Error(`DB投稿失敗: ${error?.message ?? "unknown"}`);
          const { data: again, error: againError } = await admin.from("deals")
            .select("id").eq("market_code", "yh").eq("shop_id", item.shopId)
            .eq("item_id", item.itemId).eq("source_sale_started_at", saleStart.toISOString())
            .eq("source_sale_ends_at", saleEnd.toISOString()).limit(1).maybeSingle();
          if (againError) throw new Error(`再重複確認失敗: ${againError.message}`);
          if (again) { concurrentDuplicate = true; duplicateCount++; break; }
          const { data: last, error: lastError } = await admin.from("deals")
            .select("deal_number").eq("market_code", "yh").eq("shop_id", item.shopId)
            .eq("item_id", item.itemId).order("deal_number", { ascending: false }).limit(1).maybeSingle();
          if (lastError) throw new Error(`番号再取得失敗: ${lastError.message}`);
          dealNumber = (last?.deal_number ?? dealNumber) + 1;
        }
        if (concurrentDuplicate) continue;
        if (!created) throw new Error("DB投稿リトライ上限");
        postedCount++;
        createdDeals.push({ id: created.id, publicId: created.public_id, dealNumber,
          path: `/deals/${created.public_id}-${item.shopId}-${item.itemId}`,
          itemCode: `${item.shopId}_${item.itemId}`, category: item.category });
      } catch (error) {
        postFailureCount++;
        console.error("[yahoo-auto-publish] candidate failed", item.shopId, item.itemId, error);
      }
    }

    const status = postFailureCount || aiFailureCount || stoppedForTime ? "partial" : "success";
    const { error: updateError } = await admin.from("cron_job_runs").update({
      finished_at: new Date().toISOString(), status, candidate_count: candidateCount,
      posted_count: postedCount, duplicate_count: duplicateCount,
      ai_failure_count: aiFailureCount, post_failure_count: postFailureCount,
      stopped_for_time: stoppedForTime, elapsed_ms: Date.now() - start,
      created_deals: createdDeals, error_message: null,
    }).eq("id", runId);
    if (updateError) console.error("[yahoo-auto-publish] log update failed", updateError);
    return NextResponse.json({ ok: true, mode: "posting", candidateCount, postedCount,
      duplicateCount, aiFailureCount, postFailureCount, stoppedForTime, createdDeals,
      elapsedMs: Date.now() - start }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (runId && admin) {
      try {
        await admin.from("cron_job_runs").update({ finished_at: new Date().toISOString(),
          status: "failed", elapsed_ms: Date.now() - start, error_message: message }).eq("id", runId);
      } catch { /* preserve original failure */ }
    }
    console.error("[yahoo-auto-publish] failed", message);
    return fail(message, 503);
  }
}