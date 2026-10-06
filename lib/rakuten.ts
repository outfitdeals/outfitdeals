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
  endTime: string | null;
};
export type RakutenSaleRankingItem = {
  rank: number;
  itemCode: string;
  genreId: number | null;
  title: string;
  price: number;
  imageUrl: string | null;
  itemUrl: string;
  affiliateUrl: string | null;
  shopName: string;
  shopCode: string;
  itemId: string;
  freeShipping: boolean | null;
  itemDescription: string | null;
  startTime: string;
  endTime: string;
};

export type RakutenGenreNode = {
  genreId: number;
  jaName: string;
  level: number;
};

type ParsedRakutenUrl = {
  origin: string;
  shopCode: string;
  itemId: string;
  sourcePathSegments: string[];
};
type RakutenApiItem = {
  itemCode?: string;
  itemName?: string;
  itemPrice?: number | string;
  itemUrl?: string;
  shopName?: string;
  mediumImageUrls?: Array<string | { imageUrl?: string }>;
  smallImageUrls?: Array<string | { imageUrl?: string }>;
  postageFlag?: number | string;
  itemCaption?: string;
  endTime?: string;
};
type RakutenRankingApiItem = RakutenApiItem & {
  rank?: number | string;
  itemCode?: string;
  genreId?: number | string;
  affiliateUrl?: string;
  availability?: number | string;
  startTime?: string;
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
          Referer: "https://www.tokumikke.com/",
          Origin: "https://www.tokumikke.com",
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

async function searchRakutenItemByCode(
  shopCode: string,
  itemId: string
): Promise<RakutenApiItem | null> {
  if (!RAKUTEN_APP_ID || !RAKUTEN_ACCESS_KEY) return null;

  const itemCode = `${shopCode}:${itemId}`;
  const apiUrl = new URL(
    "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701"
  );

  apiUrl.searchParams.set("applicationId", RAKUTEN_APP_ID);
  apiUrl.searchParams.set("accessKey", RAKUTEN_ACCESS_KEY);
  apiUrl.searchParams.set("format", "json");
  apiUrl.searchParams.set("formatVersion", "2");
  apiUrl.searchParams.set("itemCode", itemCode);
  apiUrl.searchParams.set("hits", "1");

  if (RAKUTEN_AFFILIATE_ID) {
    apiUrl.searchParams.set("affiliateId", RAKUTEN_AFFILIATE_ID);
  }

  let res: Response;

  try {
    res = await fetchWithTimeoutAndRetry(apiUrl.toString());
  } catch (error) {
    console.warn("[rakuten] exact itemCode request failed:", itemCode, error);
    return null;
  }

  const text = await res.text();

  if (!res.ok) {
    console.warn("[rakuten] exact itemCode unavailable:", {
      itemCode,
      status: res.status,
      body: text.slice(0, 300),
    });
    return null;
  }

  try {
    const json = JSON.parse(text);
    const rawItems = Array.isArray(json.items)
      ? json.items
      : Array.isArray(json.Items)
      ? json.Items
      : [];

    const first = rawItems[0];
    if (!first) return null;

    const item =
      first?.Item && typeof first.Item === "object" ? first.Item : first;

    return item as RakutenApiItem;
  } catch (error) {
    console.warn("[rakuten] exact itemCode JSON parse failed:", error);
    return null;
  }
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

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_m, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10))
    );
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function getHtmlAttribute(tag: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(
    new RegExp(
      `${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
      "i"
    )
  );
  const value = match?.[1] ?? match?.[2] ?? match?.[3];
  return value ? decodeHtmlEntities(value).trim() : null;
}

function getMetaContent(
  html: string,
  attributeName: "property" | "name" | "itemprop",
  attributeValue: string
): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];

  for (const tag of tags) {
    const key = getHtmlAttribute(tag, attributeName);
    if (key?.toLowerCase() !== attributeValue.toLowerCase()) continue;

    const content = getHtmlAttribute(tag, "content");
    if (content) return content;
  }

  return null;
}

function toPositivePrice(value: unknown): number | null {
  const text = String(value ?? "")
    .replace(/[￥¥円,，\s]/g, "")
    .trim();
  const match = text.match(/\d+(?:\.\d+)?/);
  if (!match) return null;

  const price = Number(match[0]);
  return Number.isFinite(price) && price > 0 ? Math.round(price) : null;
}

function findJsonLdProduct(value: unknown): Record<string, any> | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findJsonLdProduct(entry);
      if (found) return found;
    }
    return null;
  }

  if (!value || typeof value !== "object") return null;

  const objectValue = value as Record<string, any>;
  const rawType = objectValue["@type"];
  const types = Array.isArray(rawType) ? rawType : [rawType];

  if (
    types.some(
      (type) =>
        typeof type === "string" &&
        (type.toLowerCase() === "product" ||
          type.toLowerCase().endsWith("/product"))
    )
  ) {
    return objectValue;
  }

  for (const key of ["@graph", "mainEntity", "itemListElement"]) {
    if (key in objectValue) {
      const found = findJsonLdProduct(objectValue[key]);
      if (found) return found;
    }
  }

  return null;
}

function getJsonLdProduct(html: string): Record<string, any> | null {
  const scriptRegex =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(html)) !== null) {
    const raw = decodeHtmlEntities(match[1])
      .replace(/^\s*<!--/, "")
      .replace(/-->\s*$/, "")
      .trim();

    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      const product = findJsonLdProduct(parsed);
      if (product) return product;
    } catch {
      // Some Rakuten pages contain non-standard JSON-LD blocks.
    }
  }

  return null;
}

function getOfferPrice(offers: unknown): number | null {
  const candidates = Array.isArray(offers) ? offers : [offers];

  for (const offer of candidates) {
    if (!offer || typeof offer !== "object") continue;
    const objectOffer = offer as Record<string, unknown>;

    for (const key of ["price", "lowPrice", "highPrice"]) {
      const price = toPositivePrice(objectOffer[key]);
      if (price !== null) return price;
    }
  }

  return null;
}

function getSellerName(offers: unknown): string | null {
  const candidates = Array.isArray(offers) ? offers : [offers];

  for (const offer of candidates) {
    if (!offer || typeof offer !== "object") continue;
    const seller = (offer as Record<string, any>).seller;

    if (typeof seller === "string" && seller.trim()) return seller.trim();

    if (seller && typeof seller === "object") {
      const name = String(seller.name ?? "").trim();
      if (name) return name;
    }
  }

  return null;
}

function getEmbeddedJsonString(html: string, key: string): string | null {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(
    new RegExp(
      `(?:"|')${escapedKey}(?:"|')\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`,
      "i"
    )
  );

  if (!match?.[1]) return null;

  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return decodeHtmlEntities(match[1]).trim() || null;
  }
}

function getEmbeddedPrice(html: string): number | null {
  for (const key of [
    "itemPrice",
    "sellingPrice",
    "currentPrice",
    "displayPrice",
    "price",
  ]) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const quoted = html.match(
      new RegExp(
        `(?:"|')${escapedKey}(?:"|')\\s*:\\s*"([^"\\n]{1,40})"`,
        "i"
      )
    );
    const numeric = html.match(
      new RegExp(
        `(?:"|')${escapedKey}(?:"|')\\s*:\\s*(\\d{2,9})`,
        "i"
      )
    );
    const price = toPositivePrice(quoted?.[1] ?? numeric?.[1]);
    if (price !== null) return price;
  }

  return null;
}

function parseRakutenPageTitle(html: string): {
  title: string | null;
  shopName: string | null;
} {
  const ogTitle = getMetaContent(html, "property", "og:title");
  const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];

  let title = decodeHtmlEntities(ogTitle ?? stripHtml(titleTag ?? ""))
    .replace(/^【楽天市場】\s*/, "")
    .trim();

  let shopName: string | null = null;
  const separatorIndex = title.lastIndexOf("：");

  if (separatorIndex > 0 && separatorIndex < title.length - 1) {
    shopName = title.slice(separatorIndex + 1).trim() || null;
    title = title.slice(0, separatorIndex).trim();
  }

  return { title: title || null, shopName };
}



function decodeEmbeddedJsonValue(raw: string): string | null {
  try {
    return JSON.parse(`"${raw}"`);
  } catch {
    return decodeHtmlEntities(raw)
      .replace(/\\u002F/gi, "/")
      .replace(/\\\//g, "/")
      .trim() || null;
  }
}

function parseRakutenJstDateTime(value: string): number | null {
  const match = String(value ?? "").match(
    /^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/
  );

  if (!match) return null;

  const [, year, month, day, hour, minute, second = "00"] = match;
  const timestamp = Date.parse(
    `${year}-${month.padStart(2, "0")}-${day.padStart(
      2,
      "0"
    )}T${hour.padStart(2, "0")}:${minute}:${second}+09:00`
  );

  return Number.isNaN(timestamp) ? null : timestamp;
}

function formatRakutenJstMinute(value: string): string | null {
  const match = String(value ?? "").match(
    /^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})\s+(\d{1,2}):(\d{2})(?::\d{2})?$/
  );

  if (!match) return null;

  return `${match[1]}/${match[2].padStart(2, "0")}/${match[3].padStart(
    2,
    "0"
  )} ${match[4].padStart(2, "0")}:${match[5]}`;
}

function getRakutenPageTimeSaleEndTime(html: string): string | null {
  type SalePeriod = {
    startMs: number;
    endMs: number;
    endText: string;
  };

  const periods: SalePeriod[] = [];

  // 楽天商品ページ内の初期状態:
  // "timeSale": {
  //   "startDateTime": "2026\\u002F10\\u002F04 12:00:00",
  //   "endDateTime":   "2026\\u002F10\\u002F11 11:59:59"
  // }
  const dateTimePattern =
    /"timeSale"\s*:\s*\{[\s\S]{0,1200}?"startDateTime"\s*:\s*"((?:\\.|[^"\\])*)"[\s\S]{0,600}?"endDateTime"\s*:\s*"((?:\\.|[^"\\])*)"/gi;

  for (const match of html.matchAll(dateTimePattern)) {
    const startText = decodeEmbeddedJsonValue(match[1]);
    const endTextRaw = decodeEmbeddedJsonValue(match[2]);

    if (!startText || !endTextRaw) continue;

    const startMs = parseRakutenJstDateTime(startText);
    const endMs = parseRakutenJstDateTime(endTextRaw);
    const endText = formatRakutenJstMinute(endTextRaw);

    if (
      startMs === null ||
      endMs === null ||
      endMs < startMs ||
      !endText
    ) {
      continue;
    }

    periods.push({ startMs, endMs, endText });
  }

  // 同じページにはepoch milliseconds版のtimeSale状態も入る。
  const epochPattern =
    /"timeSale"\s*:\s*\{[\s\S]{0,1200}?"startTime"\s*:\s*(\d{13})[\s\S]{0,400}?"endTime"\s*:\s*(\d{13})/gi;

  for (const match of html.matchAll(epochPattern)) {
    const startMs = Number(match[1]);
    const endMs = Number(match[2]);

    if (
      !Number.isFinite(startMs) ||
      !Number.isFinite(endMs) ||
      endMs < startMs
    ) {
      continue;
    }

    const end = new Date(endMs + 9 * 60 * 60 * 1000);
    const endText =
      `${end.getUTCFullYear()}/${String(end.getUTCMonth() + 1).padStart(
        2,
        "0"
      )}/${String(end.getUTCDate()).padStart(2, "0")} ` +
      `${String(end.getUTCHours()).padStart(2, "0")}:${String(
        end.getUTCMinutes()
      ).padStart(2, "0")}`;

    periods.push({ startMs, endMs, endText });
  }

  const unique = Array.from(
    new Map(
      periods.map((period) => [
        `${period.startMs}:${period.endMs}`,
        period,
      ])
    ).values()
  );

  const now = Date.now();

  const active = unique
    .filter((period) => period.startMs <= now && now <= period.endMs)
    .sort((a, b) => a.endMs - b.endMs);

  if (active.length > 0) {
    return active[0].endText;
  }

  const upcoming = unique
    .filter((period) => period.startMs > now)
    .sort((a, b) => a.startMs - b.startMs);

  return upcoming[0]?.endText ?? null;
}


function getRakutenVisibleSalePeriodEndTime(html: string): string | null {
  type SalePeriod = {
    startMs: number;
    endMs: number;
    endText: string;
  };

  const periods: SalePeriod[] = [];
  const labelPattern = /販売期間/gi;

  for (const labelMatch of html.matchAll(labelPattern)) {
    const startIndex = labelMatch.index ?? 0;
    const nearby = decodeHtmlEntities(
      html.slice(startIndex, startIndex + 1800)
    )
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");

    const range = nearby.match(
      /(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*[～〜~-]\s*(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})(?::\d{2})?/
    );

    if (!range) continue;

    const startText =
      `${range[1]}/${range[2]}/${range[3]} ${range[4]}:${range[5]}:00`;
    const endTextRaw =
      `${range[6]}/${range[7]}/${range[8]} ${range[9]}:${range[10]}:59`;

    const startMs = parseRakutenJstDateTime(startText);
    const endMs = parseRakutenJstDateTime(endTextRaw);
    const endText = formatRakutenJstMinute(endTextRaw);

    if (
      startMs === null ||
      endMs === null ||
      endMs < startMs ||
      !endText
    ) {
      continue;
    }

    periods.push({ startMs, endMs, endText });
  }

  const now = Date.now();

  const active = periods
    .filter((period) => period.startMs <= now && now <= period.endMs)
    .sort((a, b) => a.endMs - b.endMs);

  if (active.length > 0) return active[0].endText;

  const upcoming = periods
    .filter((period) => period.startMs > now)
    .sort((a, b) => a.startMs - b.startMs);

  return upcoming[0]?.endText ?? null;
}

function getRakutenCalendarSaleEndTime(html: string): string | null {
  const hrefPattern =
    /href=["']([^"']*my\.calendar\.rakuten\.co\.jp\/add\/evt\/1\/\?[^"']+)["']/gi;

  for (const match of html.matchAll(hrefPattern)) {
    const href = decodeHtmlEntities(match[1]);

    try {
      const url = new URL(href);
      const rawEnd = url.searchParams.get("ed");

      if (!rawEnd) continue;

      const decodedEnd = decodeURIComponent(rawEnd);
      const endMatch = decodedEnd.match(
        /^(\d{4})年(\d{1,2})月(\d{1,2})日(\d{1,2})時(\d{2})分$/
      );

      if (!endMatch) continue;

      const endText =
        `${endMatch[1]}/${endMatch[2].padStart(2, "0")}/${endMatch[3].padStart(
          2,
          "0"
        )} ${endMatch[4].padStart(2, "0")}:${endMatch[5]}`;

      const endMs = Date.parse(
        `${endMatch[1]}-${endMatch[2].padStart(
          2,
          "0"
        )}-${endMatch[3].padStart(2, "0")}T${endMatch[4].padStart(
          2,
          "0"
        )}:${endMatch[5]}:59+09:00`
      );

      if (!Number.isNaN(endMs) && endMs >= Date.now()) {
        return endText;
      }
    } catch {
      // Ignore malformed calendar links.
    }
  }

  return null;
}

function getRakutenPageSaleEndTime(html: string): string | null {
  return (
    getRakutenPageTimeSaleEndTime(html) ??
    getRakutenVisibleSalePeriodEndTime(html) ??
    getRakutenCalendarSaleEndTime(html)
  );
}

function normalizeRakutenHtmlCharset(
  rawCharset: string | null | undefined
): string | null {
  const charset = String(rawCharset ?? "")
    .trim()
    .toLowerCase()
    .replace(/^["']|["']$/g, "");

  if (!charset) return null;
  if (charset === "utf8" || charset === "utf-8") return "utf-8";

  if (
    [
      "shift_jis",
      "shift-jis",
      "sjis",
      "x-sjis",
      "windows-31j",
      "cp932",
      "ms932",
    ].includes(charset)
  ) {
    return "shift_jis";
  }

  if (["euc-jp", "euc_jp", "x-euc-jp"].includes(charset)) {
    return "euc-jp";
  }

  if (charset === "iso-2022-jp" || charset === "jis") {
    return "iso-2022-jp";
  }

  return null;
}

function detectRakutenHtmlCharset(
  bytes: Uint8Array,
  contentType: string | null
): string | null {
  const headerMatch = String(contentType ?? "").match(
    /charset\s*=\s*["']?\s*([a-z0-9._-]+)/i
  );
  const headerCharset = normalizeRakutenHtmlCharset(headerMatch?.[1]);

  if (headerCharset) return headerCharset;

  try {
    const probe = new TextDecoder("windows-1252").decode(
      bytes.slice(0, Math.min(bytes.length, 32768))
    );
    const metaMatch = probe.match(
      /charset\s*=\s*["']?\s*([a-z0-9._-]+)/i
    );

    return normalizeRakutenHtmlCharset(metaMatch?.[1]);
  } catch {
    return null;
  }
}

function decodeRakutenHtml(
  bytes: Uint8Array,
  contentType: string | null
): string {
  const detectedCharset = detectRakutenHtmlCharset(bytes, contentType);
  const candidates = Array.from(
    new Set(
      [
        detectedCharset,
        "utf-8",
        "shift_jis",
        "euc-jp",
        "iso-2022-jp",
      ].filter((value): value is string => Boolean(value))
    )
  );

  let bestHtml = "";
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const charset of candidates) {
    try {
      const html = new TextDecoder(charset).decode(bytes);
      const replacementCount = (html.match(/\uFFFD/g) ?? []).length;
      const japaneseCount = (
        html.match(/[\u3040-\u30ff\u3400-\u9fff]/g) ?? []
      ).length;
      const score =
        Math.min(japaneseCount, 3000) -
        replacementCount * 100 +
        (detectedCharset === charset ? 5000 : 0);

      if (score > bestScore) {
        bestHtml = html;
        bestScore = score;
      }
    } catch {
      // Unsupported decoder candidates are ignored.
    }
  }

  return bestHtml || new TextDecoder("utf-8").decode(bytes);
}

function normalizeRakutenImageCandidate(value: string): string | null {
  const normalized = String(value ?? "")
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/gi, "&")
    .trim();

  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    const hostname = url.hostname.toLowerCase();

    if (
      hostname !== "image.rakuten.co.jp" &&
      hostname !== "thumbnail.image.rakuten.co.jp" &&
      hostname !== "shop.r10s.jp"
    ) {
      return null;
    }

    if (
      hostname === "thumbnail.image.rakuten.co.jp" &&
      url.pathname === "/t.gif"
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function getRakutenPageImageCandidates(html: string): string[] {
  const candidates: string[] = [];

  const add = (value: unknown) => {
    if (typeof value === "string") {
      const normalized = normalizeRakutenImageCandidate(value);
      if (normalized) candidates.push(normalized);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(add);
      return;
    }

    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      add(record.url);
      add(record.contentUrl);
      add(record.image);
    }
  };

  const jsonLd = getJsonLdProduct(html);
  add(jsonLd?.image);
  add(getMetaContent(html, "property", "og:image"));
  add(getMetaContent(html, "name", "twitter:image"));
  add(getEmbeddedJsonString(html, "imageUrl"));

  const imagePattern =
    /https?:\\?\/\\?\/(?:image\.rakuten\.co\.jp|thumbnail\.image\.rakuten\.co\.jp|shop\.r10s\.jp)\\?\/[^"'<>\\s]+/gi;

  for (const match of html.matchAll(imagePattern)) {
    add(match[0]);
  }

  return Array.from(new Set(candidates));
}

function buildPageSearchKeywords(title: string): string[] {
  const cleaned = title
    .replace(/【[^】]*】/g, " ")
    .replace(/[|｜／/・,，!！?？()（）「」『』【】]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = cleaned
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .filter((token) => !/^(送料無料|訳あり|無塩|半額|OFF)$/i.test(token));

  return uniqueNonEmpty([
    cleaned.slice(0, 80),
    tokens.slice(0, 4).join(" "),
    tokens.slice(0, 3).join(" "),
    tokens.slice(0, 2).join(" "),
    ...tokens.slice(0, 5),
  ]);
}

function getRakutenImageUrl(
  value: string | { imageUrl?: string } | undefined
): string | undefined {
  if (typeof value === "string") return value;
  return value?.imageUrl;
}

function getRakutenApiImageCandidates(item: RakutenApiItem): string[] {
  return Array.from(
    new Set(
      [
        ...(item.mediumImageUrls ?? []).map(getRakutenImageUrl),
        ...(item.smallImageUrls ?? []).map(getRakutenImageUrl),
      ]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  );
}

async function chooseWorkingRakutenAffiliateImage(
  rawCandidates: string[]
): Promise<string | null> {
  const candidates = Array.from(
    new Set(
      rawCandidates
        .map((value) => normalizeRakutenImageCandidate(value) ?? value.trim())
        .filter(Boolean)
    )
  );

  for (const rawImageUrl of candidates) {
    const affiliateImageUrl = createRakutenAffiliateImageUrl(rawImageUrl);

    if (!affiliateImageUrl) continue;

    if (!RAKUTEN_AFFILIATE_ID) {
      return affiliateImageUrl;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(affiliateImageUrl, {
        method: "GET",
        redirect: "follow",
        cache: "no-store",
        headers: {
          Accept:
            "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
        signal: controller.signal,
      });

      const finalUrl = response.url || "";
      const contentType = String(
        response.headers.get("content-type") ?? ""
      ).toLowerCase();

      let isMissingGif = false;

      try {
        const final = new URL(finalUrl);
        isMissingGif =
          final.hostname.toLowerCase() ===
            "thumbnail.image.rakuten.co.jp" &&
          final.pathname === "/t.gif";
      } catch {
        isMissingGif = false;
      }

      const looksLikeImage =
        contentType.startsWith("image/") ||
        /\.(?:avif|gif|jpe?g|png|webp)(?:\?|$)/i.test(finalUrl);

      try {
        await response.body?.cancel();
      } catch {
        // Nothing to do.
      }

      if (response.ok && looksLikeImage && !isMissingGif) {
        return affiliateImageUrl;
      }
    } catch (error) {
      console.warn("[rakuten] affiliate image check failed:", {
        rawImageUrl,
        error,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return null;
}

async function rakutenApiItemToPreview(
  item: RakutenApiItem,
  rawUrl: string,
  shopCode: string,
  useApiSaleEndTime = false
): Promise<RakutenItemPreview> {
  return {
    title: String(item.itemName ?? ""),
    price: Number(item.itemPrice) || 0,
    imageUrl: await chooseWorkingRakutenAffiliateImage(
      getRakutenApiImageCandidates(item)
    ),
    itemUrl: String(item.itemUrl ?? rawUrl),
    shopName: String(item.shopName ?? ""),
    shopCode,
    freeShipping: getFreeShippingFromPostageFlag(item.postageFlag),
    itemDescription: cleanRakutenItemCaption(item.itemCaption),

    // 投稿期限には「itemCode完全一致」で取得した同一商品の
    // Rakuten Ichiba Item Search API endTime だけを使用する。
    endTime: useApiSaleEndTime
      ? String(item.endTime ?? "").trim() || null
      : null,
  };
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
  const text = String(value ?? "")
    .replace(/\r\n?|\n/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
  return text || null;
}



function getRakutenInternalItemId(
  html: string,
  shopCode: string
): string | null {
  const escapedShopCode = shopCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Most reliable Rakuten item-page marker:
  // <input ... id="ratItemId" value="387193/10000148"/>
  const ratItemIdMatch = html.match(
    /id=["']ratItemId["'][^>]*value=["']([^"']+)["']/i
  );

  if (ratItemIdMatch?.[1]) {
    const value = decodeHtmlEntities(ratItemIdMatch[1]).trim();
    const slashIndex = value.lastIndexOf("/");
    const itemId =
      slashIndex >= 0 ? value.slice(slashIndex + 1).trim() : value;

    if (itemId) return itemId;
  }

  // Attribute order can be reversed.
  const ratItemIdReverseMatch = html.match(
    /value=["']([^"']+)["'][^>]*id=["']ratItemId["']/i
  );

  if (ratItemIdReverseMatch?.[1]) {
    const value = decodeHtmlEntities(ratItemIdReverseMatch[1]).trim();
    const slashIndex = value.lastIndexOf("/");
    const itemId =
      slashIndex >= 0 ? value.slice(slashIndex + 1).trim() : value;

    if (itemId) return itemId;
  }

  // Rakuten's item-page settings also expose the actual item ID.
  const shopAndItemPattern = new RegExp(
    `data-shop-id=["']\\d+["'][^>]{0,800}data-item-id=["']([^"']+)["']`,
    "i"
  );
  const settingsMatch = html.match(shopAndItemPattern);

  if (settingsMatch?.[1]?.trim()) {
    return settingsMatch[1].trim();
  }

  // Last-resort structured state. Restrict the search to an item object
  // near the current shop code when possible to avoid related-item IDs.
  const shopIndex = html.toLowerCase().indexOf(
    `"shopurl":"${shopCode.toLowerCase()}"`
  );

  const searchArea =
    shopIndex >= 0
      ? html.slice(Math.max(0, shopIndex - 12000), shopIndex + 12000)
      : html;

  const structuredMatch = searchArea.match(
    /"itemId"\s*:\s*"?([0-9A-Za-z_-]+)"?/i
  );

  return structuredMatch?.[1]?.trim() || null;
}

async function resolveRakutenInternalItemId(
  rawUrl: string,
  shopCode: string
): Promise<string | null> {
  const canonicalUrl = toCanonicalRakutenItemUrl(rawUrl);

  for (const mobile of [false, true]) {
    const html = await fetchRakutenProductHtml(canonicalUrl, mobile);
    if (!html) continue;

    const itemId = getRakutenInternalItemId(html, shopCode);
    if (itemId) return itemId;
  }

  return null;
}

async function fetchRakutenProductHtml(
  canonicalUrl: string,
  mobile = false
): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(canonicalUrl, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      headers: {
        "User-Agent": mobile
          ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"
          : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.8,en;q=0.6",
        "Cache-Control": "no-cache",
      },
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const bytes = new Uint8Array(await response.arrayBuffer());
    const html = decodeRakutenHtml(
      bytes,
      response.headers.get("content-type")
    );

    return html && html.length >= 500 ? html : null;
  } catch (error) {
    console.warn("[rakuten] product page fetch failed:", {
      canonicalUrl,
      mobile,
      error,
    });
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchRakutenPageFallback(
  rawUrl: string,
  shopCode: string
): Promise<RakutenItemPreview | null> {
  const canonicalUrl = toCanonicalRakutenItemUrl(rawUrl);
  try {
    let html = await fetchRakutenProductHtml(canonicalUrl, false);

    if (!html) {
      html = await fetchRakutenProductHtml(canonicalUrl, true);
    }

    if (!html) return null;

    const jsonLd = getJsonLdProduct(html);
    const titleParts = parseRakutenPageTitle(html);

    const title = String(
      jsonLd?.name ??
        getEmbeddedJsonString(html, "itemName") ??
        titleParts.title ??
        ""
    )
      .replace(/^【楽天市場】\s*/, "")
      .trim();

    let price =
      getOfferPrice(jsonLd?.offers) ??
      toPositivePrice(
        getMetaContent(html, "property", "product:price:amount")
      ) ??
      toPositivePrice(getMetaContent(html, "itemprop", "price")) ??
      getEmbeddedPrice(html);

    if (price === null) {
      const bodyText = stripHtml(html);

      for (const label of ["販売価格", "商品価格", "価格"]) {
        const index = bodyText.indexOf(label);
        if (index < 0) continue;

        const nearby = bodyText.slice(index, index + 180);
        const match = nearby.match(
          /([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,9})\s*円/
        );
        price = toPositivePrice(match?.[1]);

        if (price !== null) break;
      }
    }

    if (!title || price === null) return null;

    const shopName =
      getSellerName(jsonLd?.offers) ??
      getEmbeddedJsonString(html, "shopName") ??
      titleParts.shopName ??
      shopCode;

    const description = String(
      jsonLd?.description ??
        getMetaContent(html, "name", "description") ??
        getMetaContent(html, "property", "og:description") ??
        ""
    ).trim();

    // タイトルから期限は推測しない。
    // APIにendTimeが無い場合のfallbackとして、楽天商品ページ自身が
    // 初期状態に持つtimeSale.start/endだけを使用する。
    let endTime = getRakutenPageSaleEndTime(html);

    if (!endTime) {
      const mobileHtml = await fetchRakutenProductHtml(
        canonicalUrl,
        true
      );

      if (mobileHtml) {
        endTime = getRakutenPageSaleEndTime(mobileHtml);
      }
    }

    const imageUrl = await chooseWorkingRakutenAffiliateImage(
      getRakutenPageImageCandidates(html)
    );

    return {
      title,
      price,
      imageUrl,
      itemUrl: canonicalUrl,
      shopName,
      shopCode,
      freeShipping: null,
      itemDescription: cleanRakutenItemCaption(description),
      endTime,
    };
  } catch (error) {
    console.warn("[rakuten] page fallback failed:", error);
    return null;
  }
}

async function mergePageTruth(
  apiPreview: RakutenItemPreview,
  rawUrl: string,
  shopCode: string
): Promise<RakutenItemPreview> {
  const page = await fetchRakutenPageFallback(rawUrl, shopCode);

  if (!page) return apiPreview;

  return {
    ...apiPreview,
    title: apiPreview.title.trim() || page.title,
    price:
      Number.isFinite(apiPreview.price) && apiPreview.price > 0
        ? apiPreview.price
        : page.price,
    shopName: apiPreview.shopName.trim() || page.shopName,
    imageUrl: apiPreview.imageUrl ?? page.imageUrl,
    freeShipping:
      apiPreview.freeShipping ?? page.freeShipping,
    itemDescription:
      apiPreview.itemDescription?.trim() ||
      page.itemDescription ||
      null,
    endTime: apiPreview.endTime ?? page.endTime,
  };
}

function parseRakutenUtcDateTime(
  value: string | undefined | null
): number | null {
  const match = String(value ?? "")
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);

  if (!match) return null;

  const [, year, month, day, hour, minute, second = "00"] = match;
  const timestamp = Date.parse(
    `${year}-${month}-${day}T${hour}:${minute}:${second}Z`
  );

  return Number.isNaN(timestamp) ? null : timestamp;
}

function formatRakutenUtcAsJstDateTime(timestamp: number): string {
  const jst = new Date(timestamp + 9 * 60 * 60 * 1000);
  const year = jst.getUTCFullYear();
  const month = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  const hour = String(jst.getUTCHours()).padStart(2, "0");
  const minute = String(jst.getUTCMinutes()).padStart(2, "0");
  const second = String(jst.getUTCSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function parseRakutenItemCode(itemCode: string): {
  shopCode: string;
  itemId: string;
} | null {
  const separatorIndex = itemCode.indexOf(":");

  if (separatorIndex <= 0 || separatorIndex >= itemCode.length - 1) {
    return null;
  }

  const shopCode = itemCode.slice(0, separatorIndex).trim();
  const itemId = itemCode.slice(separatorIndex + 1).trim();

  if (!shopCode || !itemId) return null;

  return { shopCode, itemId };
}

export async function fetchCurrentRakutenSaleRankingItems(params?: {
  maxRank?: number;
  period?: "realtime";
  genreId?: number;
}): Promise<RakutenSaleRankingItem[]> {
  if (!RAKUTEN_APP_ID) {
    throw new Error("RAKUTEN_APP_ID が設定されていません。");
  }

  if (!RAKUTEN_ACCESS_KEY) {
    throw new Error("RAKUTEN_ACCESS_KEY が設定されていません。");
  }

  const requestedMaxRank = Math.floor(params?.maxRank ?? 100);
  const maxRank = Math.min(Math.max(requestedMaxRank, 1), 1000);
  const lastPage = Math.min(Math.ceil(maxRank / 30), 34);
  const now = Date.now();
  const saleItems: RakutenSaleRankingItem[] = [];

  for (let page = 1; page <= lastPage; page++) {
    const apiUrl = new URL(
      "https://openapi.rakuten.co.jp/ichibaranking/api/IchibaItem/Ranking/20220601"
    );

    apiUrl.searchParams.set("applicationId", RAKUTEN_APP_ID);
    apiUrl.searchParams.set("accessKey", RAKUTEN_ACCESS_KEY);
    apiUrl.searchParams.set("format", "json");
    apiUrl.searchParams.set("formatVersion", "2");
    apiUrl.searchParams.set("page", String(page));

    if (params?.period === "realtime") {
      apiUrl.searchParams.set("period", "realtime");
    }

    if (
      typeof params?.genreId === "number" &&
      Number.isInteger(params.genreId) &&
      params.genreId > 0
    ) {
      apiUrl.searchParams.set("genreId", String(params.genreId));
    }

    if (RAKUTEN_AFFILIATE_ID) {
      apiUrl.searchParams.set("affiliateId", RAKUTEN_AFFILIATE_ID);
    }

    const debugUrl = new URL(apiUrl.toString());
    debugUrl.searchParams.set("applicationId", "***");
    debugUrl.searchParams.set("accessKey", "***");

    if (debugUrl.searchParams.has("affiliateId")) {
      debugUrl.searchParams.set("affiliateId", "***");
    }

    console.log("[rakuten] IchibaItem/Ranking request:", debugUrl.toString());

    let res: Response;

    try {
      res = await fetchWithTimeoutAndRetry(apiUrl.toString());
    } catch (e: any) {
      console.error("[rakuten] ranking final fetch failure:", e);
      console.error("[rakuten] ranking final fetch cause:", e?.cause);
      throw new Error(
        "楽天ランキングAPIとの通信が一時的に不安定です。もう一度お試しください。"
      );
    }

    const responseText = await res.text();

    if (!res.ok) {
      console.error("[rakuten] ranking API error:", responseText);

      let detail = "";

      try {
        const errorJson = JSON.parse(responseText);
        const errorCode = String(
          errorJson?.error ?? errorJson?.code ?? errorJson?.status ?? ""
        ).trim();
        const errorDescription = String(
          errorJson?.error_description ??
            errorJson?.message ??
            errorJson?.details ??
            ""
        ).trim();

        detail = [errorCode, errorDescription].filter(Boolean).join(": ");
      } catch {
        detail = responseText.trim().slice(0, 500);
      }

      throw new Error(
        detail
          ? `楽天ランキングAPIエラー (${res.status}): ${detail}`
          : `楽天ランキングAPIエラー (${res.status})`
      );
    }

    let json: any;

    try {
      json = JSON.parse(responseText);
    } catch (e) {
      console.error("[rakuten] ranking JSON parse error:", e, responseText);
      throw new Error("楽天ランキングAPIのレスポンス解析に失敗しました。");
    }

    const rawItems = Array.isArray(json.items)
      ? json.items
      : Array.isArray(json.Items)
      ? json.Items
      : [];

    const items = rawItems.map((entry: any) =>
      entry?.Item && typeof entry.Item === "object" ? entry.Item : entry
    ) as RakutenRankingApiItem[];

    for (const item of items) {
      const rank = Number(item.rank);

      if (!Number.isFinite(rank) || rank < 1 || rank > maxRank) continue;
      if (Number(item.availability) !== 1) continue;

      const startTime = String(item.startTime ?? "").trim();
      const endTime = String(item.endTime ?? "").trim();

      if (!startTime || !endTime) continue;

      const startAt = parseRakutenUtcDateTime(startTime);
      const endAt = parseRakutenUtcDateTime(endTime);

      if (startAt === null || endAt === null) continue;
      if (now < startAt || now >= endAt) continue;

      const itemCode = String(item.itemCode ?? "").trim();
      const parsedItemCode = parseRakutenItemCode(itemCode);

      if (!parsedItemCode) continue;

      const rawImageUrl =
        getRakutenImageUrl(item.mediumImageUrls?.[0]) ??
        getRakutenImageUrl(item.smallImageUrls?.[0]);

      const rawGenreId = Number(item.genreId);
      const genreId =
        Number.isInteger(rawGenreId) && rawGenreId > 0 ? rawGenreId : null;

      saleItems.push({
        rank,
        itemCode,
        genreId,
        title: String(item.itemName ?? ""),
        price: Number(item.itemPrice) || 0,
        imageUrl: createRakutenAffiliateImageUrl(rawImageUrl),
        itemUrl: String(item.itemUrl ?? ""),
        affiliateUrl: String(item.affiliateUrl ?? "").trim() || null,
        shopName: String(item.shopName ?? ""),
        shopCode: parsedItemCode.shopCode,
        itemId: parsedItemCode.itemId,
        freeShipping: getFreeShippingFromPostageFlag(item.postageFlag),
        itemDescription: cleanRakutenItemCaption(item.itemCaption),
        startTime: formatRakutenUtcAsJstDateTime(startAt),
        endTime: formatRakutenUtcAsJstDateTime(endAt),
      });
    }
  }

  return saleItems.sort((a, b) => a.rank - b.rank);
}

export async function fetchRakutenGenrePath(
  genreId: number
): Promise<RakutenGenreNode[]> {
  if (!RAKUTEN_APP_ID) {
    throw new Error("RAKUTEN_APP_ID が設定されていません。");
  }

  if (!RAKUTEN_ACCESS_KEY) {
    throw new Error("RAKUTEN_ACCESS_KEY が設定されていません。");
  }

  if (!Number.isInteger(genreId) || genreId <= 0) {
    return [];
  }

  const apiUrl = new URL(
    "https://openapi.rakuten.co.jp/ichibagt/api/IchibaGenre/Search/20260701"
  );

  apiUrl.searchParams.set("applicationId", RAKUTEN_APP_ID);
  apiUrl.searchParams.set("accessKey", RAKUTEN_ACCESS_KEY);
  apiUrl.searchParams.set("format", "json");
  apiUrl.searchParams.set("formatVersion", "2");
  apiUrl.searchParams.set("genreId", String(genreId));

  const response = await fetchWithTimeoutAndRetry(apiUrl.toString());
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `楽天ジャンルAPIの取得に失敗しました (${response.status}): ${responseText}`
    );
  }

  const data = JSON.parse(responseText);
  const nodes: RakutenGenreNode[] = [];

  const addNode = (value: any) => {
    const id = Number(value?.genreId);
    const level = Number(value?.level);

    if (!Number.isInteger(id) || id <= 0) return;
    if (!Number.isInteger(level) || level < 0) return;

    nodes.push({
      genreId: id,
      jaName: String(value?.jaName ?? value?.nameJa ?? ""),
      level,
    });
  };

  if (Array.isArray(data?.ancestors)) {
    for (const ancestor of data.ancestors) addNode(ancestor);
  }

  addNode(data?.genre);

  return Array.from(
    new Map(nodes.map((node) => [node.genreId, node])).values()
  ).sort((a, b) => a.level - b.level);
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

  // 1. URL上の itemCode で完全一致を確認する。
  const exactItem = await searchRakutenItemByCode(shopCode, itemId);
  const exactEndTime = String(exactItem?.endTime ?? "").trim();

  // 楽天では URL の商品番号と内部 itemId が異なる商品がある。
  // exact API が取れない、または期限が無い場合だけ商品ページの
  // ratItemId / data-item-id から実 itemId を解決し、APIを再検索する。
  let resolvedItemId = itemId;
  let resolvedExactItem: RakutenApiItem | null = exactItem;

  if (!exactItem || !exactEndTime) {
    const internalItemId = await resolveRakutenInternalItemId(
      rawUrl,
      shopCode
    );

    if (internalItemId && internalItemId !== itemId) {
      const internalExactItem = await searchRakutenItemByCode(
        shopCode,
        internalItemId
      );

      if (internalExactItem) {
        resolvedItemId = internalItemId;
        resolvedExactItem = internalExactItem;
      }
    }
  }

  if (resolvedExactItem) {
    const apiPreview = await rakutenApiItemToPreview(
      resolvedExactItem,
      rawUrl,
      shopCode,
      true
    );

    return mergePageTruth(apiPreview, rawUrl, shopCode);
  }

  // 2. 元の安定版と同じ keyword fallback。
  // 内部 itemId を解決できた場合は、URL上の別名IDではなく実IDを使う。
  const keywords = buildKeywordCandidates(resolvedItemId);
  let allCandidates: RakutenApiItem[] = [];

  for (const keyword of keywords) {
    const items = await searchRakutenItems({
      shopCode,
      keyword,
      hits: 30,
    });

    if (items.length === 0) continue;

    allCandidates = [...allCandidates, ...items];
    const chosen = chooseBestRakutenItem(
      allCandidates,
      shopCode,
      resolvedItemId
    );

    if (chosen) {
      const apiPreview = await rakutenApiItemToPreview(
        chosen,
        rawUrl,
        shopCode
      );

      return mergePageTruth(apiPreview, rawUrl, shopCode);
    }
  }

  // 3. APIに出ない商品だけ商品ページを読む。
  const pagePreview = await fetchRakutenPageFallback(rawUrl, shopCode);

  if (!pagePreview) {
    throw new Error(
      "楽天の商品情報を取得できませんでした。時間をおいてもう一度お試しください。"
    );
  }

  // 4. 商品IDでは検索に出ないケースでも、ページ上の商品名なら
  //    同じショップの商品がAPIに出る場合がある。
  //    API画像・送料無料情報を回収するためだけに限定して再検索する。
  const pageKeywords = buildPageSearchKeywords(pagePreview.title);

  for (const keyword of pageKeywords) {
    let items: RakutenApiItem[] = [];

    try {
      items = await searchRakutenItems({
        shopCode,
        keyword,
        hits: 30,
      });
    } catch (error) {
      console.warn("[rakuten] page-title API enrichment skipped:", {
        keyword,
        error,
      });
      continue;
    }

    const chosen = chooseBestRakutenItem(
      items,
      shopCode,
      resolvedItemId
    );

    if (!chosen) continue;

    const chosenItemCode = String(chosen.itemCode ?? "").trim();
    const chosenParsedCode = parseRakutenItemCode(chosenItemCode);
    const isExactResolvedItem =
      chosenParsedCode?.shopCode === shopCode &&
      chosenParsedCode?.itemId === resolvedItemId;

    const apiPreview = await rakutenApiItemToPreview(
      chosen,
      rawUrl,
      shopCode,
      isExactResolvedItem
    );

    return {
      ...pagePreview,
      imageUrl: apiPreview.imageUrl ?? pagePreview.imageUrl,
      freeShipping:
        apiPreview.freeShipping ?? pagePreview.freeShipping,
      endTime: apiPreview.endTime ?? pagePreview.endTime,
    };
  }

  // APIに存在しない場合も、商品ページから確認できた情報だけで返す。
  return pagePreview;
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
