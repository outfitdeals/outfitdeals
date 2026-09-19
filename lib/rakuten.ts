const RAKUTEN_APP_ID = process.env.RAKUTEN_APP_ID;
const RAKUTEN_ACCESS_KEY = process.env.RAKUTEN_ACCESS_KEY;
const RAKUTEN_AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID;

if (!RAKUTEN_APP_ID) {
  console.warn("[rakuten] RAKUTEN_APP_ID is not set in env.");
}
if (!RAKUTEN_ACCESS_KEY) {
  console.warn("[rakuten] RAKUTEN_ACCESS_KEY is not set in env.");
}
if (!RAKUTEN_AFFILIATE_ID) {
  console.warn("[rakuten] RAKUTEN_AFFILIATE_ID is not set in env.");
}

// カード用に取得する画像サイズ
const AFFILIATE_IMAGE_SIZE = 400;

// 通信リトライ設定
const RAKUTEN_FETCH_RETRY_COUNT = 3;
const RAKUTEN_FETCH_TIMEOUT_MS = 8000;
const RAKUTEN_FETCH_RETRY_DELAY_MS = 700;

export type RakutenItemPreview = {
  title: string;
  price: number;
  imageUrl: string | null;
  itemUrl: string;
  shopName: string;
  shopCode: string;
  freeShipping: boolean | null;
  itemDescription: string | null;
};

type ParsedRakutenUrl = {
  origin: string;
  shopCode: string;
  itemId: string;
  sourcePathSegments: string[];
};

type RakutenApiItem = {
  itemName?: string;
  itemPrice?: number | string;
  itemUrl?: string;
  shopName?: string;
  mediumImageUrls?: Array<string | { imageUrl?: string }>;
  smallImageUrls?: Array<string | { imageUrl?: string }>;
  postageFlag?: number | string;
  itemCaption?: string;
};

export function parseRakutenItemUrl(rawUrl: string): ParsedRakutenUrl {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("URLの形式が不正です。");
  }

  if (url.hostname !== "item.rakuten.co.jp") {
    throw new Error("楽天の商品URLではありません。");
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) {
    throw new Error(
      "楽天の商品URLから shopCode と itemId を特定できませんでした。"
    );
  }

  const [shopCode, itemId] = segments;

  return {
    origin: `${url.protocol}//${url.host}`,
    shopCode,
    itemId,
    sourcePathSegments: segments,
  };
}

function normalizeForCompare(v: string | undefined | null): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .replace(/[%+]/g, "")
    .replace(/[-_.\s]/g, "");
}

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.map((v) => String(v ?? "").trim()).filter(Boolean))
  );
}

function buildKeywordCandidates(itemId: string): string[] {
  const base = itemId.trim();
  const hyphenToSpace = base.replace(/[-_]+/g, " ");
  const hyphenRemoved = base.replace(/[-_]+/g, "");
  const parts = base.split(/[-_]+/).filter(Boolean);
  const firstTwoJoined = parts.slice(0, 2).join(" ");
  const firstThreeJoined = parts.slice(0, 3).join(" ");

  return uniqueNonEmpty([
    base,
    hyphenToSpace,
    hyphenRemoved,
    firstTwoJoined,
    firstThreeJoined,
  ]);
}

function unwrapRakutenUrl(raw: string): string {
  try {
    const url = new URL(raw);

    const pc = url.searchParams.get("pc");
    if (pc) {
      return decodeURIComponent(pc);
    }

    return raw;
  } catch {
    return raw;
  }
}

function toCanonicalRakutenItemUrl(rawUrl: string): string {
  const base = unwrapRakutenUrl(rawUrl);

  let url: URL;
  try {
    url = new URL(base);
  } catch {
    throw new Error("楽天商品URLの整形に失敗しました。");
  }

  if (url.hostname !== "item.rakuten.co.jp") {
    return base;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) {
    return `${url.origin}${url.pathname}`;
  }

  const [shopCode, itemId] = segments;
  return `${url.origin}/${shopCode}/${itemId}/`;
}

function createRakutenAffiliateImageUrl(
  rawImageUrl: string | undefined | null
): string | null {
  if (!rawImageUrl) return null;

  if (!RAKUTEN_AFFILIATE_ID) {
    console.warn("[rakuten] no AFFILIATE_ID, use raw image url.");
    return rawImageUrl;
  }

  let urlObj: URL;
  try {
    urlObj = new URL(rawImageUrl);
  } catch (e) {
    console.warn("[rakuten] invalid rawImageUrl:", rawImageUrl, e);
    return null;
  }

  urlObj.searchParams.set(
    "_ex",
    `${AFFILIATE_IMAGE_SIZE}x${AFFILIATE_IMAGE_SIZE}`
  );

  const withSize = urlObj.toString();
  const encoded = encodeURIComponent(withSize);

  const affiliateImageUrl = `https://hbb.afl.rakuten.co.jp/hgb/${RAKUTEN_AFFILIATE_ID}/?pc=${encoded}&s=${AFFILIATE_IMAGE_SIZE}x${AFFILIATE_IMAGE_SIZE}&t=pict`;

  console.log("[rakuten] affiliate image url:", affiliateImageUrl);

  return affiliateImageUrl;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableFetchError(error: any): boolean {
  const message = String(error?.message ?? "").toLowerCase();
  const causeCode = String(error?.cause?.code ?? "").toUpperCase();
  const causeMessage = String(error?.cause?.message ?? "").toLowerCase();

  return (
    message.includes("fetch failed") ||
    causeCode === "ECONNRESET" ||
    causeCode === "ETIMEDOUT" ||
    causeCode === "ECONNREFUSED" ||
    causeCode === "EAI_AGAIN" ||
    causeCode === "ENOTFOUND" ||
    causeMessage.includes("econnreset") ||
    causeMessage.includes("timed out")
  );
}

async function fetchWithTimeoutAndRetry(url: string): Promise<Response> {
  let lastError: any = null;

  for (let attempt = 1; attempt <= RAKUTEN_FETCH_RETRY_COUNT; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, RAKUTEN_FETCH_TIMEOUT_MS);

    try {
      const safeUrl = new URL(url);
      safeUrl.searchParams.delete("applicationId");
      safeUrl.searchParams.delete("accessKey");
      safeUrl.searchParams.delete("affiliateId");

      console.log(
        `[rakuten] fetch attempt ${attempt}/${RAKUTEN_FETCH_RETRY_COUNT}:`,
        safeUrl.toString()
      );

      const res = await fetch(url, {
        method: "GET",
        headers: {
          Referer: "https://outfitdeals.vercel.app/",
          Origin: "https://outfitdeals.vercel.app",
        },
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.status === 429 && attempt < RAKUTEN_FETCH_RETRY_COUNT) {
        const retryAfterHeader = res.headers.get("retry-after");
        const retryAfterSeconds = Number(retryAfterHeader);
        const retryDelayMs =
          Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
            ? retryAfterSeconds * 1000
            : RAKUTEN_FETCH_RETRY_DELAY_MS * attempt;

        console.warn(
          `[rakuten] rate limited (429). retrying in ${retryDelayMs}ms.`
        );

        await sleep(retryDelayMs);
        continue;
      }

      return res;
    } catch (e: any) {
      clearTimeout(timeoutId);
      lastError = e;

      console.error(`[rakuten] fetch attempt ${attempt} failed:`, e);
      console.error("[rakuten] fetch cause:", e?.cause);

      const retryable =
        isRetryableFetchError(e) ||
        e?.name === "AbortError";

      if (!retryable || attempt === RAKUTEN_FETCH_RETRY_COUNT) {
        break;
      }

      await sleep(RAKUTEN_FETCH_RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError;
}

async function searchRakutenItems(params: {
  shopCode: string;
  keyword: string;
  hits?: number;
}): Promise<RakutenApiItem[]> {
  if (!RAKUTEN_APP_ID) {
    throw new Error("RAKUTEN_APP_ID が設定されていません。");
  }
  if (!RAKUTEN_ACCESS_KEY) {
    throw new Error("RAKUTEN_ACCESS_KEY が設定されていません。");
  }

  const apiUrl = new URL(
    "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701"
  );

  apiUrl.searchParams.set("applicationId", RAKUTEN_APP_ID);
  apiUrl.searchParams.set("accessKey", RAKUTEN_ACCESS_KEY);
  apiUrl.searchParams.set("format", "json");
  apiUrl.searchParams.set("formatVersion", "2");
  apiUrl.searchParams.set("shopCode", params.shopCode);
  apiUrl.searchParams.set("keyword", params.keyword);
  apiUrl.searchParams.set("hits", String(params.hits ?? 30));
  apiUrl.searchParams.set("sort", "-updateTimestamp");

  if (RAKUTEN_AFFILIATE_ID) {
    apiUrl.searchParams.set("affiliateId", RAKUTEN_AFFILIATE_ID);
  }

  const debugUrl = new URL(apiUrl.toString());
  debugUrl.searchParams.set("applicationId", "***");
  debugUrl.searchParams.set("accessKey", "***");
  if (debugUrl.searchParams.has("affiliateId")) {
    debugUrl.searchParams.set("affiliateId", "***");
  }

  console.log("[rakuten] IchibaItem/Search request:", debugUrl.toString());

  let res: Response;
  try {
    res = await fetchWithTimeoutAndRetry(apiUrl.toString());
  } catch (e: any) {
    console.error("[rakuten] final fetch failure:", e);
    console.error("[rakuten] final fetch cause:", e?.cause);
    throw new Error("楽天APIとの通信が一時的に不安定です。もう一度お試しください。");
  }

  const text = await res.text();

  if (!res.ok) {
    console.error("[rakuten] API error:", text);

    try {
      const errorJson = JSON.parse(text);
      const errorCode = String(errorJson?.error ?? "");
      const errorDescription = String(errorJson?.error_description ?? "");

      if (
        res.status === 503 ||
        errorCode === "service_unavailable" ||
        errorDescription.toLowerCase().includes("under maintenance")
      ) {
        throw new Error(
          "現在、楽天APIを一時的に利用できません。メンテナンスまたはアクセス集中の可能性があります。"
        );
      }
    } catch (e: any) {
      if (
        String(e?.message ?? "").includes(
          "現在、楽天APIを一時的に利用できません"
        )
      ) {
        throw e;
      }
    }

    let detail = "";
    try {
      const errorJson = JSON.parse(text);
      const errorCode = String(
        errorJson?.error ??
          errorJson?.code ??
          errorJson?.status ??
          ""
      ).trim();
      const errorDescription = String(
        errorJson?.error_description ??
          errorJson?.message ??
          errorJson?.details ??
          ""
      ).trim();

      detail = [errorCode, errorDescription].filter(Boolean).join(": ");
    } catch {
      detail = text.trim().slice(0, 500);
    }

    throw new Error(
      detail
        ? `楽天APIエラー (${res.status}): ${detail}`
        : `楽天APIエラー (${res.status})`
    );
  }

  let json: any;
  try {
    json = JSON.parse(text);
  } catch (e) {
    console.error("[rakuten] JSON parse error:", e, text);
    throw new Error("楽天APIのレスポンス解析に失敗しました。");
  }

  const rawItems = Array.isArray(json.items)
    ? json.items
    : Array.isArray(json.Items)
    ? json.Items
    : null;

  if (!rawItems) {
    console.error("[rakuten] items/Items is not array:", json);
    return [];
  }

  const items = rawItems.map((entry: any) =>
    entry?.Item && typeof entry.Item === "object" ? entry.Item : entry
  ) as RakutenApiItem[];

  console.log(
    "[rakuten] result count:",
    json.count,
    "items length:",
    items.length,
    "keyword:",
    params.keyword
  );

  return items;
}

function scoreRakutenItemMatch(
  item: RakutenApiItem,
  expectedShop: string,
  expectedItemId: string
): number {
  const normalizedExpectedShop = normalizeForCompare(expectedShop);
  const normalizedExpectedItemId = normalizeForCompare(expectedItemId);

  let score = 0;

  try {
    const realUrl = unwrapRakutenUrl(String(item.itemUrl ?? ""));
    const u = new URL(realUrl);
    const segs = u.pathname.split("/").filter(Boolean);
    const shopSeg = segs[0] ?? "";
    const itemSeg = segs[1] ?? "";

    const normalizedShopSeg = normalizeForCompare(shopSeg);
    const normalizedItemSeg = normalizeForCompare(itemSeg);

    if (normalizedShopSeg === normalizedExpectedShop) {
      score += 100;
    }

    if (normalizedItemSeg === normalizedExpectedItemId) {
      score += 1000;
    } else if (
      normalizedItemSeg.includes(normalizedExpectedItemId) ||
      normalizedExpectedItemId.includes(normalizedItemSeg)
    ) {
      score += 300;
    }

    const fullPath = normalizeForCompare(u.pathname);
    if (fullPath.includes(normalizedExpectedShop + normalizedExpectedItemId)) {
      score += 500;
    }
  } catch (e) {
    console.warn("[rakuten] invalid itemUrl in response:", item.itemUrl, e);
  }

  const itemNameNorm = normalizeForCompare(item.itemName);
  if (itemNameNorm.includes(normalizedExpectedItemId)) {
    score += 120;
  }

  const itemIdParts = expectedItemId.split(/[-_]+/).filter(Boolean);
  const matchedParts = itemIdParts.filter((p) =>
    itemNameNorm.includes(normalizeForCompare(p))
  ).length;

  score += matchedParts * 20;

  return score;
}

function chooseBestRakutenItem(
  allItems: RakutenApiItem[],
  shopCode: string,
  itemId: string
): RakutenApiItem | null {
  if (allItems.length === 0) return null;

  const scored = allItems
    .map((item) => ({
      item,
      score: scoreRakutenItemMatch(item, shopCode, itemId),
    }))
    .sort((a, b) => b.score - a.score);

  console.log(
    "[rakuten] top scored candidates:",
    scored.slice(0, 5).map((x) => ({
      score: x.score,
      itemUrl: x.item.itemUrl,
      itemName: x.item.itemName,
      unwrappedUrl: unwrapRakutenUrl(String(x.item.itemUrl ?? "")),
    }))
  );

  if (scored[0].score >= 1000) {
    return scored[0].item;
  }

  if (scored.length === 1 && scored[0].score > 0) {
    return scored[0].item;
  }

  if (
    scored.length >= 2 &&
    scored[0].score >= 300 &&
    scored[0].score - scored[1].score >= 150
  ) {
    return scored[0].item;
  }

  if (scored[0].score >= 500) {
    return scored[0].item;
  }

  return null;
}

/**
 * IchibaItem/Search を叩いて、指定URLに対応する商品を取得
 * 改善点:
 *  - keyword を itemId 1回だけでなく複数パターンで試す
 *  - itemUrl 完全一致だけでなくスコアリングで最適候補を選ぶ
 *  - affiliate URL の pc パラメータ内に入っている本来のURLを展開して比較する
 *  - fetch failed / ECONNRESET 対策としてリトライを入れる
 */
function getRakutenImageUrl(
  value: string | { imageUrl?: string } | undefined
): string | undefined {
  if (typeof value === "string") return value;
  return value?.imageUrl;
}

function getFreeShippingFromPostageFlag(
  postageFlag: number | string | undefined
): boolean | null {
  if (postageFlag === undefined || postageFlag === null) {
    return null;
  }

  const normalized = Number(postageFlag);

  if (normalized === 0) return true;
  if (normalized === 1) return false;

  return null;
}

function cleanRakutenItemCaption(value: string | undefined | null): string | null {
  let text = String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();

  if (!text) return null;

  // 商品説明の前に置かれやすい「関連ワード」のSEOキーワード列を除去。
  text = text.replace(
    /^\s*(?:【?\s*)?\[?関連ワード\]?[：:\s]*[\s\S]*?(?=(?:【[^】]{2,80}】|メーカー希望小売価格|商品説明|商品の特徴))/i,
    ""
  );

  // 商品説明ではない定型文を除去。
  const boilerplatePatterns = [
    /メーカー希望小売価格はメーカーサイトに基づいて掲載しています/gi,
    /メーカー希望小売価格はメーカーカタログに基づいて掲載しています/gi,
    /メーカーサイトTOP/gi,
    /メーカーサイト会社概要/gi,
    /メーカーサイト特定商取引法表示/gi,
    /会社概要/gi,
    /特定商取引法表示/gi,
  ];

  for (const pattern of boilerplatePatterns) {
    text = text.replace(pattern, " ");
  }

  text = text
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // まだ極端に長い場合だけ、説明文らしい開始位置まで前半を落とす。
  if (text.length > 1800) {
    const markers = [
      /【[^】]{2,80}】/,
      /(?:日差し|紫外線|素材|着心地|デザイン|特徴|ポイント)[^。]{0,80}。/,
    ];

    for (const marker of markers) {
      const match = text.match(marker);
      if (match?.index != null && match.index > 250) {
        text = text.slice(match.index).trim();
        break;
      }
    }
  }

  // 詳細欄が長大にならないよう、文章の切れ目を優先して上限を設ける。
  const maxLength = 1600;
  if (text.length > maxLength) {
    const clipped = text.slice(0, maxLength);
    const lastSentence = Math.max(
      clipped.lastIndexOf("。"),
      clipped.lastIndexOf("！"),
      clipped.lastIndexOf("？")
    );

    text =
      lastSentence >= 600
        ? clipped.slice(0, lastSentence + 1).trim()
        : `${clipped.trim()}…`;
  }

  return text || null;
}

export async function fetchRakutenItemByUrl(
  rawUrl: string
): Promise<RakutenItemPreview> {
  if (!RAKUTEN_APP_ID) {
    throw new Error("RAKUTEN_APP_ID が設定されていません。");
  }
  if (!RAKUTEN_ACCESS_KEY) {
    throw new Error("RAKUTEN_ACCESS_KEY が設定されていません。");
  }

  const { shopCode, itemId } = parseRakutenItemUrl(rawUrl);
  const keywords = buildKeywordCandidates(itemId);

  console.log("[rakuten] parsed url:", {
    shopCode,
    itemId,
    keywords,
  });

  let allCandidates: RakutenApiItem[] = [];

  for (const keyword of keywords) {
    const items = await searchRakutenItems({
      shopCode,
      keyword,
      hits: 30,
    });

    if (items.length > 0) {
      allCandidates = [...allCandidates, ...items];

      const chosen = chooseBestRakutenItem(allCandidates, shopCode, itemId);
      if (chosen) {
        console.log("[rakuten] chosen by keyword:", keyword, {
          itemUrl: chosen.itemUrl,
          unwrappedUrl: unwrapRakutenUrl(String(chosen.itemUrl ?? "")),
        });

        console.log("[rakuten] chosen itemCaption:", {
          type: typeof chosen.itemCaption,
          length:
            typeof chosen.itemCaption === "string"
              ? chosen.itemCaption.length
              : null,
          value: chosen.itemCaption ?? null,
        });

        console.log(
          "[rakuten] cleaned itemDescription:",
          cleanRakutenItemCaption(chosen.itemCaption)
        );

        const rawImageUrl =
          getRakutenImageUrl(chosen.mediumImageUrls?.[0]) ??
          getRakutenImageUrl(chosen.smallImageUrls?.[0]);

        return {
          title: String(chosen.itemName ?? ""),
          price: Number(chosen.itemPrice) || 0,
          imageUrl: createRakutenAffiliateImageUrl(rawImageUrl),
          itemUrl: String(chosen.itemUrl ?? rawUrl),
          shopName: String(chosen.shopName ?? ""),
          shopCode,
          freeShipping: getFreeShippingFromPostageFlag(
            chosen.postageFlag
          ),
          itemDescription: cleanRakutenItemCaption(chosen.itemCaption),
        };
      }
    }
  }

  const deduped = Array.from(
    new Map(
      allCandidates.map((item) => [String(item.itemUrl ?? Math.random()), item])
    ).values()
  );

  const finalChosen = chooseBestRakutenItem(deduped, shopCode, itemId);

  if (!finalChosen) {
    console.error("[rakuten] no matched item. final candidates:", {
      shopCode,
      itemId,
      keywords,
      candidateUrls: deduped.slice(0, 10).map((i) => i.itemUrl),
      candidateUnwrappedUrls: deduped
        .slice(0, 10)
        .map((i) => unwrapRakutenUrl(String(i.itemUrl ?? ""))),
      candidateNames: deduped.slice(0, 10).map((i) => i.itemName),
    });
    throw new Error("楽天の商品が見つかりませんでした。");
  }

  const rawImageUrl =
    getRakutenImageUrl(finalChosen.mediumImageUrls?.[0]) ??
    getRakutenImageUrl(finalChosen.smallImageUrls?.[0]);

  const preview: RakutenItemPreview = {
    title: String(finalChosen.itemName ?? ""),
    price: Number(finalChosen.itemPrice) || 0,
    imageUrl: createRakutenAffiliateImageUrl(rawImageUrl),
    itemUrl: String(finalChosen.itemUrl ?? rawUrl),
    shopName: String(finalChosen.shopName ?? ""),
    shopCode,
    freeShipping: getFreeShippingFromPostageFlag(
      finalChosen.postageFlag
    ),
    itemDescription: cleanRakutenItemCaption(finalChosen.itemCaption),
  };

  console.log("[rakuten] final preview:", {
    title: preview.title,
    price: preview.price,
    itemUrl: preview.itemUrl,
    unwrappedItemUrl: unwrapRakutenUrl(preview.itemUrl),
    imageUrl: preview.imageUrl,
    freeShipping: preview.freeShipping,
  });

  return preview;
}

export function createRakutenAffiliateLinkByUrl(itemUrl: string): string {
  if (!RAKUTEN_AFFILIATE_ID) {
    throw new Error(
      "RAKUTEN_AFFILIATE_ID が設定されていないため、楽天アフィリエイトリンクを生成できません。"
    );
  }

  const canonicalUrl = toCanonicalRakutenItemUrl(itemUrl);
  const encoded = encodeURIComponent(canonicalUrl);

  const affiliateUrl = `https://hb.afl.rakuten.co.jp/hgc/${RAKUTEN_AFFILIATE_ID}/?pc=${encoded}&m=${encoded}`;

  console.log("[rakuten] affiliate deal url:", affiliateUrl);

  return affiliateUrl;
}

export async function fetchRakutenPreviewByUrl(
  rawUrl: string
): Promise<RakutenItemPreview> {
  return fetchRakutenItemByUrl(rawUrl);
}