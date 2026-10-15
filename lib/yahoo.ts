
// lib/yahoo.ts
// Yahoo!ショッピングの商品URLから、公式商品検索API v3で同一商品を照合する。
// アフィリエイトURLの生成やDBへの投稿は、このファイルでは行わない。

export type YahooProductIdentity = {
  shopId: string;
  itemId: string;
  canonicalUrl: string;
};

export type YahooItemPreview = {
  title: string;
  price: number;
  imageUrl: string | null;
  itemUrl: string;
  shopName: string;
  shopCode: string;
  itemCode: string;
  freeShipping: boolean | null;
  itemDescription: string | null;
  endTime: string | null;
};

type YahooHit = {
  name?: string;
  price?: number | string;
  url?: string;
  code?: string;
  description?: string;
  image?: { medium?: string; small?: string };
  exImage?: { url?: string };
  seller?: { sellerId?: string; name?: string };
  shipping?: { code?: number | string };
  priceLabel?: { periodEnd?: number | string };
};

type YahooItemSearchResponse = { hits?: YahooHit[] };

export function parseYahooItemUrl(rawUrl: string): YahooProductIdentity {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("Yahoo!ショッピングの商品URLの形式が正しくありません。");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("商品URLはhttpまたはhttpsで指定してください。");
  }

  if (url.hostname.toLowerCase() !== "store.shopping.yahoo.co.jp") {
    throw new Error("store.shopping.yahoo.co.jp の元の商品URLを入力してください。");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 2 || !parts[1].toLowerCase().endsWith(".html")) {
    throw new Error("Yahoo!ショッピングの個別商品ページURLを入力してください。");
  }

  const shopId = parts[0];
  const itemId = parts[1].slice(0, -5);
  if (!shopId || !itemId || !/^[a-zA-Z0-9_-]+$/.test(shopId)) {
    throw new Error("商品URLからストアIDと商品コードを取得できませんでした。");
  }

  return {
    shopId,
    itemId,
    canonicalUrl: `https://store.shopping.yahoo.co.jp/${encodeURIComponent(shopId)}/${encodeURIComponent(itemId)}.html`,
  };
}

function sameProduct(hit: YahooHit, identity: YahooProductIdentity): boolean {
  if (!hit.url) return false;
  try {
    const found = parseYahooItemUrl(hit.url);
    return (
      found.shopId.toLowerCase() === identity.shopId.toLowerCase() &&
      found.itemId.toLowerCase() === identity.itemId.toLowerCase()
    );
  } catch {
    return false;
  }
}

function safeImageUrl(...candidates: Array<string | null | undefined>): string | null {
  for (const value of candidates) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === "https:") return url.toString();
    } catch {
      // Invalid image candidate.
    }
  }
  return null;
}

function formatJapanDateTime(unixSeconds: number | string | undefined): string | null {
  const value = Number(unixSeconds);
  if (!Number.isFinite(value) || value <= 0) return null;
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}:${part("second")}`;
}

export async function fetchYahooPreviewByUrl(rawUrl: string): Promise<YahooItemPreview> {
  const identity = parseYahooItemUrl(rawUrl);
  const clientId = process.env.YAHOO_CLIENT_ID;
  if (!clientId) {
    throw new Error("YAHOO_CLIENT_ID がサーバーの環境変数に設定されていません。");
  }

  const endpoint = new URL("https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch");
  endpoint.searchParams.set("appid", clientId);
  endpoint.searchParams.set("seller_id", identity.shopId);
  endpoint.searchParams.set("query", identity.itemId);
  endpoint.searchParams.set("results", "50");
  endpoint.searchParams.set("image_size", "600");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let response: Response;
  try {
    response = await fetch(endpoint.toString(), {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Yahoo!の商品APIがタイムアウトしました。時間をおいて再度お試しください。");
    }
    throw new Error("Yahoo!の商品APIに接続できませんでした。");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Yahoo!の商品APIへのアクセスが集中しています。時間をおいて再度お試しください。");
    }
    throw new Error(`Yahoo!の商品APIでエラーが発生しました（HTTP ${response.status}）。`);
  }

  let data: YahooItemSearchResponse;
  try {
    data = (await response.json()) as YahooItemSearchResponse;
  } catch {
    throw new Error("Yahoo!の商品情報を読み取れませんでした。");
  }

  // キーワード検索は部分一致になり得るため、必ず元URLと一致する商品だけ採用する。
  const hit = (Array.isArray(data.hits) ? data.hits : []).find((item) =>
    sameProduct(item, identity)
  );
  if (!hit) {
    throw new Error("該当商品の情報を正確に特定できませんでした。異なる商品を誤登録しないため自動入力を中止しました。");
  }

  const price = Number(hit.price);
  if (!hit.name?.trim() || !Number.isFinite(price) || price <= 0) {
    throw new Error("対象商品の商品名または価格を取得できませんでした。");
  }

  const shippingCode = Number(hit.shipping?.code);
  const freeShipping = shippingCode === 2 ? true : shippingCode === 3 ? false : null;

  return {
    title: hit.name.trim(),
    price,
    imageUrl: safeImageUrl(hit.exImage?.url, hit.image?.medium, hit.image?.small),
    itemUrl: identity.canonicalUrl,
    shopName: String(hit.seller?.name ?? identity.shopId).trim(),
    shopCode: identity.shopId,
    itemCode: identity.itemId,
    freeShipping,
    itemDescription: String(hit.description ?? "").trim() || null,
    endTime: formatJapanDateTime(hit.priceLabel?.periodEnd),
  };
}
