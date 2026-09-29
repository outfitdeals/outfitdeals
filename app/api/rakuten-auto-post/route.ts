import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  fetchCurrentRakutenSaleRankingItems,
  type RakutenSaleRankingItem,
} from "@/lib/rakuten";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_RANK = 100;
const OPENAI_MODEL = "gpt-5-nano";

const RANKING_TARGETS = [
  { key: "overall", name: "総合", genreId: undefined },
  { key: "ladies", name: "レディースファッション", genreId: 100371 },
  { key: "mens", name: "メンズファッション", genreId: 551177 },
  { key: "food", name: "食品", genreId: 100227 },
  { key: "appliances", name: "家電", genreId: 562637 },
  { key: "beauty", name: "美容・コスメ・香水", genreId: 100939 },
  { key: "daily", name: "日用品雑貨・文房具・手芸", genreId: 215783 },
  { key: "sports", name: "スポーツ・アウトドア", genreId: 101070 },
  { key: "interior", name: "インテリア・寝具・収納", genreId: 100804 },
  { key: "shoes", name: "靴", genreId: 558885 },
] as const;

type DealCategory =
  | "fashion_women"
  | "fashion_men"
  | "beauty"
  | "home"
  | "electronics"
  | "other";

type RankedSaleItem = RakutenSaleRankingItem & {
  rankingSources: Array<{
    key: string;
    name: string;
    genreId: number | null;
    rank: number;
  }>;
};

function isAuthorized(request: NextRequest): boolean {
  const expectedSecret = process.env.RAKUTEN_AUTOMATION_SECRET;
  if (!expectedSecret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${expectedSecret}`;
}

function getResponseOutputText(data: any): string {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  if (!Array.isArray(data?.output)) return "";

  const parts: string[] = [];

  for (const outputItem of data.output) {
    if (!Array.isArray(outputItem?.content)) continue;

    for (const contentItem of outputItem.content) {
      if (
        contentItem?.type === "output_text" &&
        typeof contentItem?.text === "string" &&
        contentItem.text.trim()
      ) {
        parts.push(contentItem.text.trim());
      }
    }
  }

  return parts.join("\n").trim();
}

function rakutenJapanTimeToIso(value: string): string {
  const match = value
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);

  if (!match) {
    throw new Error(`楽天日時の形式が不正です: ${value}`);
  }

  const [, year, month, day, hour, minute, second = "00"] = match;
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}+09:00`;
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`楽天日時を変換できません: ${value}`);
  }

  return date.toISOString();
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

function inferCategory(item: RankedSaleItem): DealCategory {
  const sourceKeys = new Set(item.rankingSources.map((source) => source.key));

  if (sourceKeys.has("ladies")) return "fashion_women";
  if (sourceKeys.has("mens")) return "fashion_men";
  if (sourceKeys.has("beauty")) return "beauty";
  if (sourceKeys.has("appliances")) return "electronics";
  if (sourceKeys.has("daily") || sourceKeys.has("interior")) return "home";

  const merged = normalizeText(
    `${item.title ?? ""} ${item.shopName ?? ""} ${item.itemUrl ?? ""}`
  );
  const hasAny = (words: string[]) => words.some((word) => merged.includes(word));

  if (
    hasAny([
      "iphone",
      "ipad",
      "applewatch",
      "airpods",
      "macbook",
      "パソコン",
      "モニター",
      "イヤホン",
      "ヘッドホン",
      "スマホ",
      "タブレット",
      "カメラ",
      "テレビ",
      "冷蔵庫",
      "洗濯機",
      "掃除機",
    ])
  ) {
    return "electronics";
  }

  if (
    hasAny([
      "化粧水",
      "乳液",
      "美容液",
      "コスメ",
      "メイク",
      "ファンデ",
      "リップ",
      "マスカラ",
      "アイシャドウ",
      "クレンジング",
      "シャンプー",
      "トリートメント",
      "香水",
    ])
  ) {
    return "beauty";
  }

  if (
    hasAny([
      "収納",
      "キッチン",
      "食器",
      "フライパン",
      "タオル",
      "寝具",
      "布団",
      "枕",
      "インテリア",
      "洗剤",
      "日用品",
      "家具",
      "カーテン",
      "水筒",
      "タンブラー",
    ])
  ) {
    return "home";
  }

  if (
    hasAny([
      "レディース",
      "婦人",
      "women",
      "ladies",
      "スカート",
      "ワンピース",
      "ブラウス",
      "パンプス",
      "レディースファッション",
    ])
  ) {
    return "fashion_women";
  }

  if (
    hasAny([
      "メンズ",
      "紳士",
      "mens",
      "tシャツ",
      "スウェット",
      "パーカー",
      "スラックス",
      "ジャケット",
      "メンズファッション",
    ])
  ) {
    return "fashion_men";
  }

  return "other";
}

async function generateAiComment(item: RankedSaleItem): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const productFacts = {
    title: item.title,
    price: item.price,
    shopName: item.shopName,
    freeShipping: item.freeShipping,
    startTime: item.startTime,
    endTime: item.endTime,
    rankingSources: item.rankingSources,
    itemDescription: item.itemDescription,
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      instructions: [
        "あなたは日本のセール情報共有サイト「トクミッケ」の商品紹介コメントを作成します。",
        "与えられた楽天市場の商品情報だけを根拠に、日本語で自然な短いコメントを作成してください。",
        "2〜3文程度にしてください。",
        "商品説明をそのまま長くコピーせず、読みやすく要約してください。",
        "価格、セール期間、ランキングなどは、入力データに存在する場合だけ言及してください。",
        "freeShipping が true の場合のみ「送料無料」と表現してよいです。",
        "freeShipping が false の場合は、送料について一切言及しないでください。",
        "商品説明内の送料表記と freeShipping が矛盾する場合も、freeShipping を優先し、送料について言及しないでください。",
        "割引率、通常価格、最安値、レビュー評価、人気度、品質、効果、在庫状況など、入力データにない事実を推測・創作しないでください。",
        "「絶対」「必ず」「最安」「激安」など、根拠のない断定的・誇張的な表現は使わないでください。",
        "ランキング順位に触れる場合は、入力されたrankingSourcesの事実だけを使ってください。",
        "URL、ハッシュタグ、箇条書き、見出し、引用符は付けないでください。",
        "コメント本文だけを返してください。",
      ].join("\n"),
      input: JSON.stringify(productFacts, null, 2),
      reasoning: {
        effort: "low",
      },
      max_output_tokens: 800,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const comment = getResponseOutputText(data);

  if (!comment) {
    throw new Error("OpenAI returned no comment.");
  }

  return comment;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const startedAt = Date.now();

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const adminUserId = process.env.TOKUMIKKE_ADMIN_USER_ID;

    if (!supabaseUrl) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured.");
    }

    if (!serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
    }

    if (!adminUserId) {
      throw new Error("TOKUMIKKE_ADMIN_USER_ID is not configured.");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const deduped = new Map<string, RankedSaleItem>();

    for (const target of RANKING_TARGETS) {
      const items = await fetchCurrentRakutenSaleRankingItems({
        maxRank: MAX_RANK,
        period: "realtime",
        genreId: target.genreId,
      });

      for (const item of items) {
        const source = {
          key: target.key,
          name: target.name,
          genreId: target.genreId ?? null,
          rank: item.rank,
        };

        const existing = deduped.get(item.itemCode);

        if (existing) {
          existing.rankingSources.push(source);
          if (item.rank < existing.rank) existing.rank = item.rank;
          continue;
        }

        deduped.set(item.itemCode, {
          ...item,
          rankingSources: [source],
        });
      }
    }

    const candidates = Array.from(deduped.values()).sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.itemCode.localeCompare(b.itemCode);
    });

    let selectedItem: RankedSaleItem | null = null;
    let selectedStartIso = "";
    let selectedEndIso = "";
    let selectedComment = "";
    let duplicateCount = 0;
    let aiFailureCount = 0;

    for (const item of candidates) {
      const startIso = rakutenJapanTimeToIso(item.startTime);
      const endIso = rakutenJapanTimeToIso(item.endTime);

      const { data: existingDeal, error: duplicateLookupError } = await admin
        .from("deals")
        .select("id")
        .eq("market_code", "rk")
        .eq("shop_id", item.shopCode)
        .eq("item_id", item.itemId)
        .eq("source_sale_started_at", startIso)
        .eq("source_sale_ends_at", endIso)
        .limit(1)
        .maybeSingle();

      if (duplicateLookupError) {
        throw new Error(
          `重複確認に失敗しました: ${duplicateLookupError.message}`
        );
      }

      if (existingDeal) {
        duplicateCount += 1;
        continue;
      }

      let generatedComment = "";

      try {
        generatedComment = await generateAiComment(item);
      } catch (error) {
        aiFailureCount += 1;
        console.error(
          `[rakuten-auto-post] AI comment generation failed for ${item.itemCode}. Skipping candidate.`,
          error
        );
        continue;
      }

      selectedItem = item;
      selectedStartIso = startIso;
      selectedEndIso = endIso;
      selectedComment = generatedComment;
      break;
    }

    if (!selectedItem) {
      const noNewCandidate = duplicateCount === candidates.length;

      return NextResponse.json(
        {
          ok: true,
          posted: false,
          reason: noNewCandidate
            ? "NO_NEW_CANDIDATE"
            : "NO_AI_COMMENT_CANDIDATE",
          candidateCount: candidates.length,
          duplicateCount,
          aiFailureCount,
          elapsedMs: Date.now() - startedAt,
          message: noNewCandidate
            ? "現在の候補はすべて同一セール期間ですでに投稿済みです。"
            : "未投稿候補はありましたが、AIコメントを生成できる商品がありませんでした。",
        },
        {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    const comment = selectedComment;
    const category = inferCategory(selectedItem);

    const { data: latestSameProductDeal, error: dealNumberError } = await admin
      .from("deals")
      .select("deal_number")
      .eq("market_code", "rk")
      .eq("shop_id", selectedItem.shopCode)
      .eq("item_id", selectedItem.itemId)
      .order("deal_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dealNumberError) {
      throw new Error(`ディール番号の確認に失敗しました: ${dealNumberError.message}`);
    }

    let assignedDealNumber = (latestSameProductDeal?.deal_number ?? 0) + 1;

    const sourceUrl = selectedItem.itemUrl;

    if (!sourceUrl) {
      throw new Error("楽天の商品URLを取得できませんでした。");
    }

    const affiliateResponse = await fetch(
      new URL("/api/rakuten-affiliate", request.url),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: sourceUrl }),
        cache: "no-store",
      }
    );

    const affiliateText = await affiliateResponse.text();

    if (!affiliateResponse.ok) {
      let message = "アフィリエイトURLの生成に失敗しました。";

      try {
        const parsed = JSON.parse(affiliateText);
        if (parsed?.error) message = String(parsed.error);
      } catch {
        // JSON でない場合は既定メッセージを使用する
      }

      throw new Error(message);
    }

    let affiliateData: any;

    try {
      affiliateData = JSON.parse(affiliateText);
    } catch {
      throw new Error("アフィリエイトURLの応答を解析できませんでした。");
    }

    const finalDealUrl =
      typeof affiliateData?.affiliateUrl === "string"
        ? affiliateData.affiliateUrl.trim()
        : "";

    if (!finalDealUrl) {
      throw new Error("アフィリエイトURLの生成に失敗しました。");
    }

    let createdDeal: { id: string; public_id: number } | null = null;
    let lastInsertError: any = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await admin
        .from("deals")
        .insert({
          user_id: adminUserId,
          title: selectedItem.title,
          price: selectedItem.price,
          orig_price: null,
          market: "楽天市場",
          market_code: "rk",
          shop_id: selectedItem.shopCode,
          item_id: selectedItem.itemId,
          shop_name: selectedItem.shopName || null,
          source_url: sourceUrl,
          deal_url: finalDealUrl,
          image_url: selectedItem.imageUrl || null,
          comment,
          item_description: selectedItem.itemDescription || null,
          category,
          brand: null,
          free_shipping: selectedItem.freeShipping,
          expires_at: selectedEndIso,
          source_sale_started_at: selectedStartIso,
          source_sale_ends_at: selectedEndIso,
          deal_number: assignedDealNumber,
          likes_count: 0,
          comments_count: 0,
        })
        .select("id, public_id")
        .single();

      createdDeal = result.data;
      lastInsertError = result.error;

      if (!lastInsertError && createdDeal?.id) {
        break;
      }

      if (lastInsertError?.code !== "23505") {
        break;
      }

      const { data: sameSaleDeal, error: sameSaleLookupError } = await admin
        .from("deals")
        .select("id, public_id")
        .eq("market_code", "rk")
        .eq("shop_id", selectedItem.shopCode)
        .eq("item_id", selectedItem.itemId)
        .eq("source_sale_started_at", selectedStartIso)
        .eq("source_sale_ends_at", selectedEndIso)
        .limit(1)
        .maybeSingle();

      if (sameSaleLookupError) {
        throw new Error(
          `同時投稿後の重複確認に失敗しました: ${sameSaleLookupError.message}`
        );
      }

      if (sameSaleDeal) {
        return NextResponse.json(
          {
            ok: true,
            posted: false,
            reason: "DUPLICATE_CREATED_CONCURRENTLY",
            candidateCount: candidates.length,
            duplicateCount: duplicateCount + 1,
            elapsedMs: Date.now() - startedAt,
            existingDeal: sameSaleDeal,
          },
          {
            status: 200,
            headers: { "Cache-Control": "no-store" },
          }
        );
      }

      const { data: latestDealAfterConflict, error: retryLookupError } =
        await admin
          .from("deals")
          .select("deal_number")
          .eq("market_code", "rk")
          .eq("shop_id", selectedItem.shopCode)
          .eq("item_id", selectedItem.itemId)
          .order("deal_number", { ascending: false })
          .limit(1)
          .maybeSingle();

      if (retryLookupError) {
        throw new Error(
          `ディール番号の再確認に失敗しました: ${retryLookupError.message}`
        );
      }

      assignedDealNumber =
        (latestDealAfterConflict?.deal_number ?? assignedDealNumber) + 1;
    }

    if (lastInsertError || !createdDeal?.id) {
      throw new Error(
        `自動投稿の保存に失敗しました: ${
          lastInsertError?.message ?? "unknown insert error"
        }`
      );
    }

    return NextResponse.json(
      {
        ok: true,
        posted: true,
        model: OPENAI_MODEL,
        elapsedMs: Date.now() - startedAt,
        candidateCount: candidates.length,
        duplicateCount,
        createdDeal: {
          id: createdDeal.id,
          publicId: createdDeal.public_id,
          dealNumber: assignedDealNumber,
          path: `/deals/${createdDeal.public_id}-${selectedItem.shopCode}-${selectedItem.itemId}`,
        },
        postedItem: {
          rank: selectedItem.rank,
          itemCode: selectedItem.itemCode,
          title: selectedItem.title,
          price: selectedItem.price,
          shopName: selectedItem.shopName,
          shopCode: selectedItem.shopCode,
          itemId: selectedItem.itemId,
          category,
          freeShipping: selectedItem.freeShipping,
          startTime: selectedItem.startTime,
          endTime: selectedItem.endTime,
          rankingSources: selectedItem.rankingSources,
        },
        generatedComment: comment,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error: any) {
    console.error("[rakuten-auto-post] error:", error);

    return NextResponse.json(
      {
        ok: false,
        posted: false,
        elapsedMs: Date.now() - startedAt,
        error:
          String(error?.message ?? "").trim() ||
          "楽天ディールの自動投稿に失敗しました。",
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
