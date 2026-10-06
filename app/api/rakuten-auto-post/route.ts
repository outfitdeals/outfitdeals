import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  fetchCurrentRakutenSaleRankingItems,
  fetchRakutenGenrePath,
  type RakutenSaleRankingItem,
  type RakutenGenreNode,
} from "@/lib/rakuten";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

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
  | "food"
  | "sports"
  | "interior"
  | "shoes"
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

const RAKUTEN_GENRE_CATEGORY_MAP: Partial<Record<number, DealCategory>> = {
  // Fashion
  100371: "fashion_women",
  551177: "fashion_men",
  558885: "shoes",

  // Food & drinks
  100227: "food",
  551167: "food",
  100316: "food",
  510915: "food",
  510901: "food",

  // Electronics
  562637: "electronics",
  211742: "electronics",
  100026: "electronics",
  564500: "electronics",

  // Beauty
  100939: "beauty",

  // Sports
  101070: "sports",

  // Interior / daily goods
  100804: "interior",
  215783: "home",
  558944: "home",

  // Tokumikke has no separate baby category.
  100533: "home",
};

const RANKING_SOURCE_CATEGORY_MAP: Partial<Record<string, DealCategory>> = {
  ladies: "fashion_women",
  mens: "fashion_men",
  food: "food",
  appliances: "electronics",
  beauty: "beauty",
  daily: "home",
  sports: "sports",
  interior: "interior",
  shoes: "shoes",
};

const genrePathCache = new Map<number, RakutenGenreNode[]>();

async function getGenrePathCached(genreId: number): Promise<RakutenGenreNode[]> {
  const cached = genrePathCache.get(genreId);
  if (cached) return cached;

  const path = await fetchRakutenGenrePath(genreId);
  genrePathCache.set(genreId, path);
  return path;
}

async function resolveCategory(item: RankedSaleItem): Promise<DealCategory> {
  // No keyword classification.
  // The product's Rakuten genre tree is the primary source of truth.
  if (item.genreId != null) {
    try {
      const genrePath = await getGenrePathCached(item.genreId);

      for (const node of genrePath) {
        const mapped = RAKUTEN_GENRE_CATEGORY_MAP[node.genreId];
        if (mapped) return mapped;
      }

      const directMapped = RAKUTEN_GENRE_CATEGORY_MAP[item.genreId];
      if (directMapped) return directMapped;
    } catch (error) {
      console.warn(
        "[rakuten-auto-post] genre classification lookup failed:",
        item.genreId,
        error
      );
    }
  }

  // Fallback only to the structured ranking source.
  // Product title/description/shop/URL are intentionally not inspected.
  const bestCategorySource = item.rankingSources
    .filter(
      (source) =>
        source.key !== "overall" && RANKING_SOURCE_CATEGORY_MAP[source.key]
    )
    .sort((a, b) => a.rank - b.rank)[0];

  if (bestCategorySource) {
    return RANKING_SOURCE_CATEGORY_MAP[bestCategorySource.key] ?? "other";
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

  const response = await fetch("https\://api.openai.com/v1/responses", {
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
  const SAFE_EXECUTION_MS = 240_000;

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
      let items: RakutenSaleRankingItem[];

      try {
        items = await fetchCurrentRakutenSaleRankingItems({
          maxRank: MAX_RANK,
          period: "realtime",
          genreId: target.genreId,
        });
      } catch (error) {
        const message = String(error instanceof Error ? error.message : error);

        if (
          message.includes("楽天ランキングAPIエラー (404)") &&
          message.includes("This genre data does not exist")
        ) {
          console.warn(
            `[rakuten-auto-post] Ranking genre unavailable: ${target.name} (${target.genreId ?? "overall"}). Skipping target.`
          );
          continue;
        }

        throw error;
      }

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

    let duplicateCount = 0;
    let aiFailureCount = 0;
    let postFailureCount = 0;
    let postedCount = 0;
    let stoppedForTime = false;

    const createdDeals: Array<{
      id: string;
      publicId: number;
      dealNumber: number;
      path: string;
      itemCode: string;
      category: DealCategory;
    }> = [];

    for (const item of candidates) {
      if (Date.now() - startedAt >= SAFE_EXECUTION_MS) {
        stoppedForTime = true;
        break;
      }

      try {
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
          throw new Error(`重複確認に失敗しました: ${duplicateLookupError.message}`);
        }

        if (existingDeal) {
          duplicateCount += 1;
          continue;
        }

        let comment = "";

        try {
          comment = await generateAiComment(item);
        } catch (error) {
          aiFailureCount += 1;
          console.error(
            `[rakuten-auto-post] AI comment generation failed for ${item.itemCode}. Skipping candidate.`,
            error
          );
          continue;
        }

        if (Date.now() - startedAt >= SAFE_EXECUTION_MS) {
          stoppedForTime = true;
          break;
        }

        const category = await resolveCategory(item);

        const { data: latestSameProductDeal, error: dealNumberError } = await admin
          .from("deals")
          .select("deal_number")
          .eq("market_code", "rk")
          .eq("shop_id", item.shopCode)
          .eq("item_id", item.itemId)
          .order("deal_number", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (dealNumberError) {
          throw new Error(`ディール番号の確認に失敗しました: ${dealNumberError.message}`);
        }

        let assignedDealNumber = (latestSameProductDeal?.deal_number ?? 0) + 1;
        const sourceUrl = item.itemUrl;

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
        let duplicateCreatedConcurrently = false;

        for (let attempt = 0; attempt < 3; attempt += 1) {
          const result = await admin
            .from("deals")
            .insert({
              user_id: adminUserId,
              title: item.title,
              price: item.price,
              orig_price: null,
              market: "楽天市場",
              market_code: "rk",
              shop_id: item.shopCode,
              item_id: item.itemId,
              shop_name: item.shopName || null,
              source_url: sourceUrl,
              deal_url: finalDealUrl,
              image_url: item.imageUrl || null,
              comment,
              item_description: item.itemDescription || null,
              category,
              brand: null,
              free_shipping: item.freeShipping,
              expires_at: endIso,
              source_sale_started_at: startIso,
              source_sale_ends_at: endIso,
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
            .select("id")
            .eq("market_code", "rk")
            .eq("shop_id", item.shopCode)
            .eq("item_id", item.itemId)
            .eq("source_sale_started_at", startIso)
            .eq("source_sale_ends_at", endIso)
            .limit(1)
            .maybeSingle();

          if (sameSaleLookupError) {
            throw new Error(
              `同時投稿後の重複確認に失敗しました: ${sameSaleLookupError.message}`
            );
          }

          if (sameSaleDeal) {
            duplicateCount += 1;
            duplicateCreatedConcurrently = true;
            break;
          }

          const { data: latestDealAfterConflict, error: retryLookupError } =
            await admin
              .from("deals")
              .select("deal_number")
              .eq("market_code", "rk")
              .eq("shop_id", item.shopCode)
              .eq("item_id", item.itemId)
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

        if (duplicateCreatedConcurrently) {
          continue;
        }

        if (lastInsertError || !createdDeal?.id) {
          throw new Error(
            `自動投稿の保存に失敗しました: ${
              lastInsertError?.message ?? "unknown insert error"
            }`
          );
        }

        postedCount += 1;
        createdDeals.push({
          id: createdDeal.id,
          publicId: createdDeal.public_id,
          dealNumber: assignedDealNumber,
          path: `/deals/${createdDeal.public_id}-${item.shopCode}-${item.itemId}`,
          itemCode: item.itemCode,
          category,
        });
      } catch (error) {
        postFailureCount += 1;
        console.error(
          `[rakuten-auto-post] candidate processing failed for ${item.itemCode}. Skipping candidate.`,
          error
        );
      }
    }

    return NextResponse.json(
      {
        ok: true,
        posted: postedCount > 0,
        model: OPENAI_MODEL,
        elapsedMs: Date.now() - startedAt,
        candidateCount: candidates.length,
        postedCount,
        duplicateCount,
        aiFailureCount,
        postFailureCount,
        stoppedForTime,
        createdDeals,
        message: stoppedForTime
          ? "安全な実行時間に達したため正常終了しました。次回実行時に未投稿候補から続行します。"
          : postedCount > 0
            ? `${postedCount}件の楽天ディールを自動投稿しました。`
            : "今回新たに投稿できる楽天ディールはありませんでした。",
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
