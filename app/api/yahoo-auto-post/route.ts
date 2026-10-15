// app/api/yahoo-auto-post/route.ts
// Yahoo!ショッピング: カテゴリ別セール期間候補の確認専用。
// 商品キーワード・通常価格・割引率を使用しない。
// DB保存、AI生成、アフィリエイトリンク生成、投稿は行わない。

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEARCH_API = "https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch";
const RANKING_API = "https://shopping.yahooapis.jp/ShoppingWebService/V1/highRatingTrendRanking";
const RANKING_LIMIT = 100;
const LOOKUP_API = "https://shopping.yahooapis.jp/ShoppingWebService/V1/json/itemLookup";
const DIRECT_LOOKUPS_PER_CATEGORY = 10;
// 旧V1の商品詳細APIへの負荷を抑えるため、同時照会は最大2件。
const DIRECT_LOOKUP_CONCURRENCY = 2;
const CATEGORY_API = "https://shopping.yahooapis.jp/ShoppingWebService/V1/json/categorySearch";
const RESULTS_PER_CATEGORY = 50;
const PAGES_PER_CATEGORY = 2;
const MAX_CANDIDATES = 100;
const MAX_POSTS_PER_RUN = 15;
// Yahoo!はPCのローカル時刻 06:30〜20:30 の毎時30分を予定。現段階ではスケジューラ未登録。
const SCHEDULE_TIMEZONE = "Windows computer local time";
const SCHEDULE_HOURS = "06:30-20:30";

type DealCategory =
  | "fashion_women"
  | "fashion_men"
  | "food"
  | "beauty"
  | "home"
  | "interior"
  | "electronics"
  | "sports"
  | "shoes"
  | "other";

type CategoryNode = { id: number; name: string };
type YahooHit = {
  name?: string;
  price?: number | string;
  url?: string;
  code?: string;
  image?: { medium?: string; small?: string };
  exImage?: { url?: string };
  seller?: { sellerId?: string; name?: string };
  shipping?: { code?: number | string };
  priceLabel?: { periodStart?: number | string | null; periodEnd?: number | string | null };
};
type Candidate = {
  category: DealCategory;
  title: string;
  price: number;
  shopId: string;
  itemId: string;
  shopName: string;
  itemUrl: string;
  imageUrl: string;
  freeShipping: boolean | null;
  saleStartsAt: string;
  saleEndsAt: string;
  trendRank?: number;
  rankingUpdatedAt?: string;
};

const CATEGORY_KEYS: DealCategory[] = [
  "fashion_women", "fashion_men", "food", "beauty", "home",
  "interior", "electronics", "sports", "shoes", "other",
];

// 既存投稿を読み取るだけ。プレビュー段階でINSERT/UPDATE/DELETEは実行しない。
// Yahoo!の商品は market_code / shop_id / item_id と正規化した商品URLの双方で照合する。
function yahooProductKeyFromUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.hostname.toLowerCase() !== "store.shopping.yahoo.co.jp") return null;
    const parts = url.pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
    if (parts.length !== 2 || !parts[1].toLowerCase().endsWith(".html")) return null;
    const itemId = parts[1].slice(0, -5);
    return parts[0] && itemId ? `${parts[0]}:${itemId}`.toLowerCase() : null;
  } catch {
    return null;
  }
}

type ExistingYahooDeal = {
  market_code: string | null;
  shop_id: string | null;
  item_id: string | null;
  source_url: string | null;
  deal_url: string | null;
};

async function loadExistingYahooProductKeys(): Promise<{ keys: Set<string>; rowsScanned: number }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("既存投稿チェックに必要な Supabase URL / SUPABASE_SERVICE_ROLE_KEY が未設定です。");
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const keys = new Set<string>();
  let rowsScanned = 0;
  const pageSize = 1000;
  // Yahoo!の可能性がある投稿をサーバー側で絞る。楽天・Amazonは除外する。
  // 旧投稿ではmarket_codeがなくてもsource_urlから判定できる。
  for (let start = 0; start < 50000; start += pageSize) {
    const { data, error } = await db
      .from("deals")
      .select("market_code,shop_id,item_id,source_url,deal_url")
      .or("market_code.eq.yh,market.eq.Yahoo!ショッピング,source_url.ilike.*store.shopping.yahoo.co.jp*")
      .order("id", { ascending: true })
      .range(start, start + pageSize - 1);
    if (error) throw new Error(`Supabase既投稿チェック失敗: ${error.message}`);
    const rows = (data ?? []) as ExistingYahooDeal[];
    rowsScanned += rows.length;
    for (const row of rows) {
      if (row.market_code?.toLowerCase() === "yh" && row.shop_id && row.item_id) {
        keys.add(`${row.shop_id}:${row.item_id}`.toLowerCase());
      }
      const fromSource = yahooProductKeyFromUrl(row.source_url);
      const fromDeal = yahooProductKeyFromUrl(row.deal_url);
      if (fromSource) keys.add(fromSource);
      if (fromDeal) keys.add(fromDeal);
    }
    if (rows.length < pageSize) return { keys, rowsScanned };
  }
  // 途中までの一覧では「重複なし」を保証できないため、誤投稿を避けて失敗扱いにする。
  throw new Error("Yahoo!既投稿が50,000件に達したため全件確認できませんでした。");
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.YAHOO_AUTOMATION_SECRET;
  return Boolean(secret && req.headers.get("authorization") === `Bearer ${secret}`);
}

function childNodes(json: any): CategoryNode[] {
  // JSON版は ResultSet["0"].Result.Categories.Children に
  // "0", "1", ... の番号付きキーで子カテゴリが格納される。
  const result = json?.ResultSet?.["0"]?.Result ?? json?.ResultSet?.Result;
  const children = result?.Categories?.Children;
  if (!children || typeof children !== "object") return [];

  const raw = children.Child ?? children;
  const entries: any[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? Object.entries(raw)
          .filter(([key]) => /^\d+$/.test(key))
          .map(([, value]) => value)
      : [];

  // XML型から変換された単一Childオブジェクトにも対応する。
  if (entries.length === 0 && raw?.Id) entries.push(raw);

  return entries
    .map((entry) => ({
      id: Number(entry?.Id),
      name: String(entry?.Title?.Short ?? entry?.Title ?? "").trim(),
    }))
    .filter((entry) => Number.isInteger(entry.id) && entry.id > 1 && Boolean(entry.name));
}

async function categoryChildren(appId: string, categoryId: number): Promise<CategoryNode[]> {
  const url = new URL(CATEGORY_API);
  url.searchParams.set("appid", appId);
  url.searchParams.set("category_id", String(categoryId));
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`カテゴリAPI HTTP ${res.status} (category=${categoryId})`);
  return childNodes(await res.json());
}

function anyName(node: CategoryNode, pattern: RegExp): boolean {
  return pattern.test(node.name);
}

// Yahoo!公式カテゴリツリーから分類する。商品名のキーワード検索ではない。
// 曖昧なカテゴリは推測して他の分類に割り当てず、結果に警告を返す。
async function resolveCategories(appId: string): Promise<{
  ids: Record<DealCategory, number[]>;
  notes: string[];
}> {
  const ids: Record<DealCategory, number[]> = {
    fashion_women: [],
    fashion_men: [],
    food: [],
    beauty: [],
    home: [],
    interior: [],
    electronics: [],
    sports: [],
    shoes: [],
    other: [],
  };
  const notes: string[] = [];
  const roots = await categoryChildren(appId, 1);
  if (!roots.length) throw new Error("Yahoo!のルートカテゴリを取得できませんでした。");

  const fashion = roots.filter((n) => anyName(n, /ファッション|衣料/));
  const shoesRoots = roots.filter((n) => anyName(n, /靴|シューズ/));
  const homeRoots = roots.filter((n) => anyName(n, /キッチン|日用品|文具|家庭用品/));
  const interiorRoots = roots.filter((n) => anyName(n, /家具|インテリア|寝具/));
  const beautyRoots = roots.filter((n) => anyName(n, /コスメ|美容|ヘアケア|化粧/));

  ids.food.push(...roots.filter((n) => anyName(n, /食品|飲料|グルメ/)).map((n) => n.id));
  ids.electronics.push(...roots.filter((n) => anyName(n, /家電|スマホ|パソコン|テレビ|カメラ/)).map((n) => n.id));
  ids.sports.push(...roots.filter((n) => anyName(n, /スポーツ|アウトドア/)).map((n) => n.id));
  ids.beauty.push(...beautyRoots.map((n) => n.id));
  ids.home.push(...homeRoots.map((n) => n.id));
  ids.interior.push(...interiorRoots.map((n) => n.id));
  ids.shoes.push(...shoesRoots.map((n) => n.id));

  // 「レディース」「メンズ」「靴」はファッションの子カテゴリを確認する。
  for (const parent of fashion.slice(0, 2)) {
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const children = await categoryChildren(appId, parent.id);
    ids.fashion_women.push(...children.filter((n) => anyName(n, /レディース|女性|婦人/)).map((n) => n.id));
    ids.fashion_men.push(...children.filter((n) => anyName(n, /メンズ|男性|紳士/)).map((n) => n.id));
    ids.shoes.push(...children.filter((n) => anyName(n, /靴|シューズ|シューズ、靴/)).map((n) => n.id));
    ids.beauty.push(...children.filter((n) => anyName(n, /コスメ|美容/)).map((n) => n.id));
  }

  // 靴は多くの場合「ファッション」のさらに下位に置かれるため、
  // レディース／メンズの直下カテゴリも調査する。
  const shoeParents = [...new Set([...ids.fashion_women, ...ids.fashion_men])];
  for (const parentId of shoeParents.slice(0, 8)) {
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const children = await categoryChildren(appId, parentId);
    ids.shoes.push(...children.filter((n) => anyName(n, /靴|シューズ|スニーカー|ブーツ|パンプス|サンダル/)).map((n) => n.id));
  }

  // 「その他」は上記のカテゴリに割り当てなかったルートカテゴリ。
  // 下位カテゴリとの重複を防ぐためファッション全体は除外する。
  const assignedRootIds = new Set([
    ...fashion.map((n) => n.id),
    ...Object.values(ids).flat(),
  ]);
  ids.other.push(...roots.filter((n) => !assignedRootIds.has(n.id)).map((n) => n.id));

  for (const key of CATEGORY_KEYS) {
    ids[key] = [...new Set(ids[key])];
    if (!ids[key].length) notes.push(`${key}: Yahoo!カテゴリを自動対応できず、このカテゴリの検索を保留しました。`);
  }
  return { ids, notes };
}

type RejectionReason =
  | "missing_item_data"
  | "missing_sale_period"
  | "invalid_sale_period"
  | "outside_sale_period"
  | "invalid_price_or_title"
  | "invalid_item_url"
  | "invalid_item_code"
  | "invalid_image"
  | "other_validation";

type LookupResult =
  | { candidate: Candidate; reason: null }
  | { candidate: null; reason: RejectionReason };

function validateHit(hit: YahooHit, category: DealCategory, nowSeconds: number): LookupResult {
  const price = Number(hit.price);
  const start = Number(hit.priceLabel?.periodStart);
  const end = Number(hit.priceLabel?.periodEnd);
  if (!hit.name?.trim() || !Number.isFinite(price) || price <= 0) {
    return { candidate: null, reason: "invalid_price_or_title" };
  }
  if (!hit.priceLabel || hit.priceLabel.periodStart == null || hit.priceLabel.periodEnd == null) {
    return { candidate: null, reason: "missing_sale_period" };
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end <= start) {
    return { candidate: null, reason: "invalid_sale_period" };
  }
  if (nowSeconds < start || nowSeconds >= end) {
    return { candidate: null, reason: "outside_sale_period" };
  }
  let url: URL;
  try { url = new URL(hit.url ?? ""); } catch { return { candidate: null, reason: "invalid_item_url" }; }
  if (url.protocol !== "https:" || url.hostname !== "store.shopping.yahoo.co.jp") {
    return { candidate: null, reason: "invalid_item_url" };
  }
  const path = url.pathname.split("/").filter(Boolean);
  if (path.length !== 2 || !path[1].toLowerCase().endsWith(".html")) {
    return { candidate: null, reason: "invalid_item_url" };
  }
  const shopId = path[0];
  const itemId = path[1].slice(0, -5);
  if (!itemId || (hit.seller?.sellerId && hit.seller.sellerId.toLowerCase() !== shopId.toLowerCase())) {
    return { candidate: null, reason: "invalid_item_code" };
  }
  if (hit.code && hit.code.toLowerCase() !== `${shopId}_${itemId}`.toLowerCase()) {
    return { candidate: null, reason: "invalid_item_code" };
  }
  const image = hit.exImage?.url ?? hit.image?.medium ?? hit.image?.small;
  let imageUrl: string;
  try {
    const parsed = new URL(image ?? "");
    if (parsed.protocol !== "https:") return { candidate: null, reason: "invalid_image" };
    imageUrl = parsed.toString();
  } catch { return { candidate: null, reason: "invalid_image" }; }
  const shippingCode = Number(hit.shipping?.code);
  return {
    candidate: {
      category, title: hit.name.trim(), price, shopId, itemId,
      shopName: hit.seller?.name ?? shopId,
      itemUrl: `https://store.shopping.yahoo.co.jp/${shopId}/${itemId}.html`,
      imageUrl,
      freeShipping: shippingCode === 2 ? true : shippingCode === 3 ? false : null,
      saleStartsAt: new Date(start * 1000).toISOString(),
      saleEndsAt: new Date(end * 1000).toISOString(),
    },
    reason: null,
  };
}

function normalize(hit: YahooHit, category: DealCategory, nowSeconds: number): Candidate | null {
  return validateHit(hit, category, nowSeconds).candidate;
}


type RankingRow = {
  rank?: number;
  item_information?: { code?: string; url?: string };
};

function rankingKey(row: RankingRow): string | null {
  // ランキング側のcodeは商品ID部分のみの場合があるため、商品URLで照合する。
  const raw = row.item_information?.url;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.hostname !== "store.shopping.yahoo.co.jp") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length !== 2 || !parts[1].toLowerCase().endsWith(".html")) return null;
    const itemId = parts[1].slice(0, -5);
    if (!itemId) return null;
    return `${parts[0]}:${itemId}`.toLowerCase();
  } catch { return null; }
}

async function fetchRanking(appId: string, genreId: number) {
  const url = new URL(RANKING_API);
  url.searchParams.set("appid", appId);
  url.searchParams.set("genre_category_id", String(genreId));
  url.searchParams.set("limit", String(RANKING_LIMIT));
  url.searchParams.set("offset", "1");
  // アフィリエイトIDや商品キーワードは付けない。
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`ランキングAPI HTTP ${response.status} (genre=${genreId})`);
  const json = (await response.json()) as {
    high_rating_trend_ranking?: {
      meta?: { last_modified?: string };
      ranking_data?: RankingRow[];
    };
  };
  const body = json.high_rating_trend_ranking;
  if (!body || !Array.isArray(body.ranking_data)) {
    throw new Error(`ランキングAPIの形式が想定外です (genre=${genreId})`);
  }
  const ranks = new Map<string, number>();
  for (const row of body.ranking_data) {
    const key = rankingKey(row);
    const rank = Number(row.rank);
    if (key && Number.isInteger(rank) && rank > 0 && !ranks.has(key)) ranks.set(key, rank);
  }
  return { ranks, rows: body.ranking_data, checked: body.ranking_data.length, updatedAt: body.meta?.last_modified ?? null };
}

// ランキング商品を商品コードで直接照会する。商品名を使ったキーワード検索は行わない。
// 旧V1 APIのJSONは "0" キーを含むことがあるため、両形式を許容する。
type LookupHit = {
  Name?: string;
  Url?: string;
  Price?: number | string | { "#text"?: string; _content?: string; _value?: string | number };
  PriceLabel?: { PeriodStart?: string; PeriodEnd?: string };
  Image?: { Small?: string; Medium?: string };
  ExImage?: { Url?: string };
  Shipping?: { Code?: number | string };
};
function legacyHit(body: any): LookupHit | null {
  const set = body?.ResultSet;
  // itemLookup のJSON版では ResultSet["0"].Result["0"] が商品本体。
  // XML由来の Hit 階層や、単一オブジェクト形式も許容する。
  const result = set?.["0"]?.Result ?? set?.Result;
  const first = Array.isArray(result) ? result[0] : result?.["0"] ?? result;
  const hitContainer = first?.Hit ?? result?.Hit;
  const hit = Array.isArray(hitContainer)
    ? hitContainer[0]
    : hitContainer?.["0"] ?? hitContainer;
  const value = hit?.Name ? hit : first?.Name ? first : null;
  return value && typeof value === "object" ? value as LookupHit : null;
}
function legacyTimestamp(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? Math.floor(time / 1000) : null;
}
async function lookupRankedItem(appId: string, code: string, category: DealCategory, nowSeconds: number): Promise<LookupResult> {
  const url = new URL(LOOKUP_API);
  url.searchParams.set("appid", appId);
  url.searchParams.set("itemcode", code);
  url.searchParams.set("responsegroup", "medium");
  url.searchParams.set("image_size", "600");
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`商品詳細API HTTP ${response.status}`);
  const raw = legacyHit(await response.json());
  if (!raw) return { candidate: null, reason: "missing_item_data" };
  if (!raw.PriceLabel?.PeriodStart || !raw.PriceLabel?.PeriodEnd) {
    return { candidate: null, reason: "missing_sale_period" };
  }
  const start = legacyTimestamp(raw.PriceLabel.PeriodStart);
  const end = legacyTimestamp(raw.PriceLabel.PeriodEnd);
  if (start === null || end === null) return { candidate: null, reason: "invalid_sale_period" };
  const rawPrice = raw.Price;
  const price = typeof rawPrice === "object" && rawPrice !== null
    ? Number(rawPrice._value ?? rawPrice["#text"] ?? rawPrice._content) : Number(rawPrice);
  return validateHit({
    name: raw.Name,
    url: raw.Url?.replace(/^http:\/\//i, "https://"),
    code, price,
    image: {
      medium: raw.Image?.Medium?.replace(/^http:\/\//i, "https://"),
      small: raw.Image?.Small?.replace(/^http:\/\//i, "https://"),
    },
    exImage: { url: raw.ExImage?.Url?.replace(/^http:\/\//i, "https://") },
    shipping: { code: raw.Shipping?.Code },
    priceLabel: { periodStart: start, periodEnd: end },
  }, category, nowSeconds);
}
function rankingCode(row: RankingRow): string | null {
  const key = rankingKey(row);
  if (!key) return null;
  const colon = key.indexOf(":");
  return `${key.slice(0, colon)}_${key.slice(colon + 1)}`;
}

async function fetchCategory(appId: string, category: DealCategory, genreId: number, offset: number, nowSeconds: number) {
  const url = new URL(SEARCH_API);
  url.searchParams.set("appid", appId);
  url.searchParams.set("genre_category_id", String(genreId));
  url.searchParams.set("results", String(RESULTS_PER_CATEGORY));
  url.searchParams.set("start", String(offset));
  url.searchParams.set("in_stock", "true");
  url.searchParams.set("image_size", "600");
  // ランキングではないが、レビュー件数の多い順で候補の品質を改善。
  url.searchParams.set("sort", "-review_count");
  // query/is_discounted/defaultPrice/discountPercent は使用しない。
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`商品検索API HTTP ${response.status} (genre=${genreId})`);
  const json = (await response.json()) as { hits?: YahooHit[] };
  const hits = Array.isArray(json.hits) ? json.hits : [];
  return { scanned: hits.length, candidates: hits.map((hit) => normalize(hit, category, nowSeconds)).filter((x): x is Candidate => x !== null) };
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const appId = process.env.YAHOO_CLIENT_ID;
  if (!appId) return NextResponse.json({ ok: false, error: "YAHOO_CLIENT_ID is not configured" }, { status: 503 });

  try {
    const { ids, notes } = await resolveCategories(appId);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const hour = Math.floor(Date.now() / 3_600_000);
    const unique = new Map<string, Candidate>();
    const errors: Array<{ category: DealCategory; genreId: number; error: string }> = [];
    const categoryStats: Record<string, { genres: number; scanned: number; candidates: number }> = {};
    const rankingStats: Record<string, { genreId: number | null; checked: number; matched: number; updatedAt: string | null; error: string | null }> = {};
    const rankingMaps: Partial<Record<DealCategory, Map<string, number>>> = {};
    type LookupStats = { checked: number; saleCandidates: number; errors: number; rejected: Record<RejectionReason, number> };
    const directLookupStats: Record<string, LookupStats> = {};

    // 各カテゴリを2ページ分確認する。固定キーワードは使用しない。
    // APIの呼び出し制限を考慮し、直列で1.1秒ずつ間隔を空ける。
    for (const category of CATEGORY_KEYS) {
      const categories = ids[category];
      categoryStats[category] = { genres: categories.length, scanned: 0, candidates: 0 };
      rankingStats[category] = { genreId: null, checked: 0, matched: 0, updatedAt: null, error: null };
      directLookupStats[category] = {
        checked: 0, saleCandidates: 0, errors: 0,
        rejected: {
          missing_item_data: 0,
          missing_sale_period: 0,
          invalid_sale_period: 0,
          outside_sale_period: 0,
          invalid_price_or_title: 0,
          invalid_item_url: 0,
          invalid_item_code: 0,
          invalid_image: 0,
          other_validation: 0,
        },
      };
      if (!categories.length) continue;

      // カテゴリのランキング上位を1回取得。検索候補との一致のみ順位を付与。
      // 複数ジャンルは時間ごとに巡回する。
      const rankingGenreId = categories[hour % categories.length];
      rankingStats[category].genreId = rankingGenreId;
      try {
        const ranking = await fetchRanking(appId, rankingGenreId);
        rankingMaps[category] = ranking.ranks;
        rankingStats[category].checked = ranking.checked;
        rankingStats[category].updatedAt = ranking.updatedAt;
        // 上位の商品を直接照会。旧V1 APIの短時間アクセス制限に配慮し1.1秒間隔。
        const topRows = [...ranking.rows]
          .filter((row) => Number.isInteger(Number(row.rank)) && Number(row.rank) > 0)
          .sort((a, b) => Number(a.rank) - Number(b.rank));
        const selected = new Set<string>();
        const rankedItems: Array<{ code: string; rank: number }> = [];
        for (const row of topRows) {
          if (rankedItems.length >= DIRECT_LOOKUPS_PER_CATEGORY) break;
          const code = rankingCode(row);
          if (!code || selected.has(code)) continue;
          selected.add(code);
          rankedItems.push({ code, rank: Number(row.rank) });
        }
        // 2件ずつ照会し、バッチ間は1.1秒待機する。カテゴリーは引き続き直列。
        for (let i = 0; i < rankedItems.length; i += DIRECT_LOOKUP_CONCURRENCY) {
          const batch = rankedItems.slice(i, i + DIRECT_LOOKUP_CONCURRENCY);
          const lookups = await Promise.allSettled(
            batch.map(({ code }) => lookupRankedItem(appId, code, category, nowSeconds)),
          );
          batch.forEach(({ rank }, index) => {
            directLookupStats[category].checked += 1;
            const outcome = lookups[index];
            if (outcome.status === "rejected") {
              directLookupStats[category].errors += 1;
              return;
            }
            const lookup = outcome.value;
            if (!lookup.candidate) {
              directLookupStats[category].rejected[lookup.reason] += 1;
              return;
            }
            const item = lookup.candidate;
            item.trendRank = rank;
            item.rankingUpdatedAt = ranking.updatedAt ?? undefined;
            const key = `${item.shopId}:${item.itemId}`.toLowerCase();
            unique.set(key, item);
            directLookupStats[category].saleCandidates += 1;
          });
          if (i + DIRECT_LOOKUP_CONCURRENCY < rankedItems.length) {
            await new Promise((resolve) => setTimeout(resolve, 1100));
          }
        }
      } catch (error) {
        rankingStats[category].error = error instanceof Error ? error.message : String(error);
      }
      await new Promise((resolve) => setTimeout(resolve, 1100));

      for (let page = 0; page < PAGES_PER_CATEGORY; page += 1) {
        const genreId = categories[(hour + page) % categories.length];
        const offset = 1 + (Math.floor(hour / Math.max(1, categories.length)) % 8 + (categories.length === 1 ? page : 0)) % 9 * RESULTS_PER_CATEGORY;
        try {
          const result = await fetchCategory(appId, category, genreId, offset, nowSeconds);
          categoryStats[category].scanned += result.scanned;
          categoryStats[category].candidates += result.candidates.length;
          for (const item of result.candidates) {
            const key = `${item.shopId}:${item.itemId}`.toLowerCase();
            const rank = rankingMaps[category]?.get(key);
            if (rank !== undefined) {
              item.trendRank = rank;
              item.rankingUpdatedAt = rankingStats[category].updatedAt ?? undefined;
              rankingStats[category].matched += 1;
            }
            const existing = unique.get(key);
            if (!existing || (item.trendRank !== undefined && existing.trendRank === undefined)) {
              unique.set(key, item);
            }
          }
        } catch (error) {
          errors.push({ category, genreId, error: error instanceof Error ? error.message : String(error) });
        }
        await new Promise((resolve) => setTimeout(resolve, 1100));
      }
    }

    const rankedCandidateCount = [...unique.values()].filter((item) => item.trendRank !== undefined).length;
    const allCandidates = [...unique.values()]
      .sort((a, b) => {
        if (a.trendRank !== undefined && b.trendRank === undefined) return -1;
        if (a.trendRank === undefined && b.trendRank !== undefined) return 1;
        if (a.trendRank !== undefined && b.trendRank !== undefined) return a.trendRank - b.trendRank;
        return a.saleEndsAt.localeCompare(b.saleEndsAt);
      });
    const candidates = allCandidates.slice(0, MAX_CANDIDATES);
    // ランキング優先の並びを維持したまま、既投稿商品を除外して最大15件を選ぶ。
    // DBが読み取れない場合は「重複なし」とみなさず選定を停止する。
    const { keys: postedKeys, rowsScanned: existingPostRowsScanned } = await loadExistingYahooProductKeys();
    const duplicateCandidates = allCandidates.filter((item) => postedKeys.has(`${item.shopId}:${item.itemId}`.toLowerCase()));
    const eligibleCandidates = allCandidates.filter((item) => !postedKeys.has(`${item.shopId}:${item.itemId}`.toLowerCase()));
    const selectedCandidates = eligibleCandidates.slice(0, MAX_POSTS_PER_RUN);
    const selectedRankedCount = selectedCandidates.filter((item) => item.trendRank !== undefined).length;
    const selectedFallbackCount = selectedCandidates.length - selectedRankedCount;

    return NextResponse.json({
      ok: errors.length === 0,
      mode: "preview_only",
      selectionBasis: "ranking_first_item_lookup_plus_category_search_sale_period",
      schedulePlan: { timezone: SCHEDULE_TIMEZONE, localHours: SCHEDULE_HOURS, intervalMinutes: 60, dailyRuns: 15, enabled: false },
      maxPostsPerRun: MAX_POSTS_PER_RUN,
      selectedCount: selectedCandidates.length,
      selectedRankedCount,
      selectedFallbackCount,
      existingPostDuplicateCheck: "completed_read_only",
      existingPostRowsScanned,
      existingYahooProductKeys: postedKeys.size,
      duplicateCandidateCount: duplicateCandidates.length,
      eligibleCandidateCount: eligibleCandidates.length,
      selectionReadyForPosting: false,
      selectedCandidates,
      postedCount: 0,
      elapsedMs: Date.now() - startedAt,
      scannedCount: Object.values(categoryStats).reduce((sum, stat) => sum + stat.scanned, 0),
      candidateCount: unique.size,
      rankedCandidateCount,
      rankingStats,
      directLookupStats,
      directLookupSummary: Object.values(directLookupStats).reduce(
        (summary, stats) => {
          summary.checked += stats.checked;
          summary.saleCandidates += stats.saleCandidates;
          summary.errors += stats.errors;
          for (const reason of Object.keys(stats.rejected) as RejectionReason[]) {
            summary.rejected[reason] += stats.rejected[reason];
          }
          return summary;
        },
        {
          checked: 0, saleCandidates: 0, errors: 0,
          rejected: {
            missing_item_data: 0, missing_sale_period: 0, invalid_sale_period: 0,
            outside_sale_period: 0, invalid_price_or_title: 0, invalid_item_url: 0,
            invalid_item_code: 0, invalid_image: 0, other_validation: 0,
          } as Record<RejectionReason, number>,
        },
      ),
      categoryStats,
      categoryIds: ids,
      notes,
      candidates,
      errors,
      message: "既存Yahoo!投稿との重複を除外し、ランキング優先で最大15件をプレビュー選定しました。投稿・DB保存は行っていません。",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, mode: "preview_only", postedCount: 0, error: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }
}