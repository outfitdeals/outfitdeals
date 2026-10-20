// app/api/yahoo-manual-preview/route.ts
// 手動投稿専用。Yahoo!公式商品検索APIから同一商品・VCリンク・公式カテゴリを照合。
// DBへの書き込みは一切行わない。
import { NextRequest, NextResponse } from "next/server";
import { fetchYahooPreviewByUrl, parseYahooItemUrl } from "@/lib/yahoo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OfficialGenre = { id?: number; name?: string; depth?: number };
type AffiliateHit = {
  code?: string;
  seller?: { sellerId?: string };
  url?: string;
  genreCategory?: OfficialGenre;
  parentGenreCategories?: OfficialGenre[];
};
type AffiliateResponse = { hits?: AffiliateHit[] };
type Category = "fashion_women" | "fashion_men" | "food" | "beauty" | "home" |
  "interior" | "electronics" | "sports" | "shoes" | "other";

// 商品名ではなくYahoo!が返した公式ジャンル階層だけを分類に使用。
// 未対応のジャンルはotherにする（無理に分類しない）。
function officialCategory(hit: AffiliateHit): Category {
  const path = [...(Array.isArray(hit.parentGenreCategories) ? hit.parentGenreCategories : []),
    ...(hit.genreCategory ? [hit.genreCategory] : [])]
    .sort((a, b) => Number(a.depth ?? 99) - Number(b.depth ?? 99));
  const names = path.map((p) => String(p.name ?? ""));
  const root = names[0] ?? "";
  const under = names.slice(1).join("/");
  if (names.some((n) => /靴|シューズ|スニーカー|ブーツ|パンプス|サンダル|ローファー/.test(n)) && /ファッション|靴|シューズ/.test(root)) return "shoes";
  if (/ファッション|衣料/.test(root)) {
    if (/レディース|女性|婦人/.test(under)) return "fashion_women";
    if (/メンズ|男性|紳士/.test(under)) return "fashion_men";
    return "other";
  }
  if (/食品|飲料|グルメ/.test(root)) return "food";
  if (/美容|コスメ|化粧|ヘアケア|ダイエット/.test(root)) return "beauty";
  if (/家具|インテリア|寝具/.test(root)) return "interior";
  if (/家電|スマホ|パソコン|テレビ|カメラ/.test(root)) return "electronics";
  if (/スポーツ|アウトドア/.test(root)) return "sports";
  if (/キッチン|日用品|家庭用品|文具/.test(root)) return "home";
  return "other";
}

function verifiedLink(raw: string | undefined, shopId: string, itemId: string, sid: string, pid: string): string | null {
  if (!raw) return null;
  try {
    const link = new URL(raw);
    if (link.protocol !== "https:" || link.hostname !== "ck.jp.ap.valuecommerce.com" ||
        link.pathname !== "/servlet/referral" || link.searchParams.get("sid") !== sid ||
        link.searchParams.get("pid") !== pid) return null;
    const destination = link.searchParams.get("vc_url");
    if (!destination) return null;
    const actual = parseYahooItemUrl(destination);
    if (actual.shopId.toLowerCase() !== shopId.toLowerCase() ||
        actual.itemId.toLowerCase() !== itemId.toLowerCase()) return null;
    return link.toString();
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    const input = body && typeof body === "object" && "url" in body ? (body as {url?: unknown}).url : null;
    if (typeof input !== "string" || input.length > 2048) return NextResponse.json({error: "商品URLが不正です。"}, {status:400});
    const identity = parseYahooItemUrl(input);
    const appid = process.env.YAHOO_CLIENT_ID;
    const sid = process.env.VALUECOMMERCE_SID?.trim();
    const pid = process.env.VALUECOMMERCE_PID?.trim();
    if (!appid || !sid || !pid || !/^\d+$/.test(sid) || !/^\d+$/.test(pid)) {
      throw new Error("Yahoo! / ValueCommerce のサーバー設定が不足しています。");
    }
    const item = await fetchYahooPreviewByUrl(identity.canonicalUrl);
    const url = new URL("https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch");
    url.searchParams.set("appid", appid);
    url.searchParams.set("affiliate_type", "vc");
    url.searchParams.set("affiliate_id", `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${sid}&pid=${pid}&vc_url=`);
    url.searchParams.set("seller_id", identity.shopId);
    url.searchParams.set("query", identity.itemId);
    url.searchParams.set("results", "50");
    const response = await fetch(url, {cache:"no-store", signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error(`Yahoo!アフィリエイト照合API HTTP ${response.status}`);
    const data = (await response.json()) as AffiliateResponse;
    const code = `${identity.shopId}_${identity.itemId}`.toLowerCase();
    const hit = (Array.isArray(data.hits) ? data.hits : []).find(h =>
      h.code?.toLowerCase() === code &&
      (!h.seller?.sellerId || h.seller.sellerId.toLowerCase() === identity.shopId.toLowerCase()));
    if (!hit) throw new Error("商品IDが一致するYahoo!アフィリエイト商品を確認できませんでした。");
    const affiliateUrl = verifiedLink(hit.url, identity.shopId, identity.itemId, sid, pid);
    if (!affiliateUrl) throw new Error("ValueCommerceリンクの生成・同一商品検証に失敗しました。");
    // 登録画面に返すのは検証済みの商品情報のみ。
    return NextResponse.json({...item, affiliateUrl,
      category: officialCategory(hit),
      officialGenreId: hit.genreCategory?.id ?? null,
      officialGenreName: hit.genreCategory?.name ?? null,
      officialGenrePath: [...(hit.parentGenreCategories ?? []), ...(hit.genreCategory ? [hit.genreCategory] : [])].map(g=>g.name).filter(Boolean)
    }, {headers:{"Cache-Control":"no-store"}});
  } catch (e) {
    const error = e instanceof Error ? e.message : "Yahoo!の商品情報を取得できませんでした。";
    console.error("[yahoo-manual-preview] failed", error);
    return NextResponse.json({error}, {status:503, headers:{"Cache-Control":"no-store"}});
  }
}