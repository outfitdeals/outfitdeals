// lib/rakuten.ts

// 20170706 のエンドポイントを使用（レスポンス形式がシンプルで扱いやすい）
const RAKUTEN_ENDPOINT =
  "https://app.rakuten.co.jp/services/api/IchibaItem/Search/20170706";

export type RakutenPreview = {
  title: string;
  price: number;
  imageUrl: string;
  shopName: string;
  dealUrl: string;
  market: "楽天市場";
};

/**
 * 楽天の商品ページ URL から、プレビューに必要な情報を取得する関数
 */
export async function fetchRakutenPreviewByUrl(
  productUrl: string
): Promise<RakutenPreview> {
  const appId = process.env.RAKUTEN_APP_ID;
  const affiliateId = process.env.RAKUTEN_AFFILIATE_ID;

  if (!appId || !affiliateId) {
    throw new Error(
      "RAKUTEN_APP_ID / RAKUTEN_AFFILIATE_ID が環境変数に設定されていません。"
    );
  }

  let shopCode: string | undefined;
  let keyword: string | undefined;

  try {
    const url = new URL(productUrl);

    if (!url.hostname.includes("rakuten.co.jp")) {
      throw new Error("楽天の商品 URL ではありません。");
    }

    const segments = url.pathname.split("/").filter(Boolean);
    // 例: /sneak/ugg-3010/ → ["sneak", "ugg-3010"]
    if (segments.length >= 2) {
      shopCode = segments[0];      // sneak
      keyword = segments[1];       // ugg-3010
    } else if (segments.length === 1) {
      keyword = segments[0];
    }
  } catch {
    console.warn("Failed to parse Rakuten URL, fallback to whole URL as keyword.");
  }

  // どうしても取れなかった場合は URL 全体を keyword にする
  if (!keyword) {
    keyword = productUrl;
  }

  const params = new URLSearchParams({
    applicationId: appId,
    affiliateId,
    format: "json",
    hits: "1",
    keyword,
  });

  if (shopCode) {
    params.set("shopCode", shopCode);
  }

  const apiUrl = `${RAKUTEN_ENDPOINT}?${params.toString()}`;

  const res = await fetch(apiUrl, { cache: "no-store" });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Rakuten API error: status ${res.status}, body: ${body}`);
  }

  const data: any = await res.json();

  // この形式を想定: data.Items[0].Item
  if (!data.Items || data.Items.length === 0) {
    throw new Error("楽天の商品が見つかりませんでした。");
  }

  const item = data.Items[0].Item;

  const imageUrl =
    item.mediumImageUrls?.[0]?.imageUrl ??
    item.smallImageUrls?.[0]?.imageUrl ??
    "";

  return {
    title: item.itemName,
    price: item.itemPrice,
    imageUrl,
    shopName: item.shopName,
    dealUrl: item.affiliateUrl || item.itemUrl,
    market: "楽天市場",
  };
}
