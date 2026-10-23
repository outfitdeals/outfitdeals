// app/category/[slug]/page.tsx
// SEO向けカテゴリ一覧。既存のトップページや投稿処理は変更しません。
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import CategoryDealCard from "@/app/components/CategoryDealCard";

const SITE = "https://www.tokumikke.com";
const PAGE_SIZE = 48;
const CATEGORIES = {
  fashion_women: { label: "レディース", title: "レディースファッションのセール・お得情報", description: "レディースファッションのセール・割引情報をチェック。楽天市場・Yahoo!ショッピングなどから投稿されたお得な商品を新着順で紹介します。" },
  fashion_men: { label: "メンズ", title: "メンズファッションのセール・お得情報", description: "メンズファッションのセール・割引情報をチェック。楽天市場・Yahoo!ショッピングなどから投稿されたお得な商品を新着順で紹介します。" },
  food: { label: "食品・飲料", title: "食品・飲料のセール・お得情報", description: "食品・飲料のセール・割引情報をチェック。楽天市場・Yahoo!ショッピングなどから投稿されたお得な商品を新着順で紹介します。" },
  beauty: { label: "ビューティー", title: "コスメ・美容のセール・お得情報", description: "コスメや美容用品のセール・割引情報をチェック。楽天市場・Yahoo!ショッピングなどから投稿されたお得な商品を新着順で紹介します。" },
  home: { label: "日用品・ホーム", title: "日用品・ホームのセール・お得情報", description: "日用品・ホーム用品のセール・割引情報をチェック。楽天市場・Yahoo!ショッピングなどから投稿されたお得な商品を新着順で紹介します。" },
  interior: { label: "インテリア・家具", title: "インテリア・家具のセール・お得情報", description: "インテリア・家具のセール・割引情報をチェック。楽天市場・Yahoo!ショッピングなどから投稿されたお得な商品を新着順で紹介します。" },
  electronics: { label: "家電・ガジェット", title: "家電・ガジェットのセール・お得情報", description: "家電・ガジェットのセール・割引情報をチェック。楽天市場・Yahoo!ショッピングなどから投稿されたお得な商品を新着順で紹介します。" },
  sports: { label: "スポーツ・アウトドア", title: "スポーツ・アウトドアのセール・お得情報", description: "スポーツ・アウトドア用品のセール・割引情報をチェック。楽天市場・Yahoo!ショッピングなどから投稿されたお得な商品を新着順で紹介します。" },
  shoes: { label: "靴・シューズ", title: "靴・シューズのセール・お得情報", description: "靴・シューズのセール・割引情報をチェック。楽天市場・Yahoo!ショッピングなどから投稿されたお得な商品を新着順で紹介します。" },
  other: { label: "その他", title: "その他の商品セール・お得情報", description: "さまざまな商品のセール・割引情報をチェック。楽天市場・Yahoo!ショッピングなどから投稿されたお得な商品を新着順で紹介します。" },
} as const;

type CategoryId = keyof typeof CATEGORIES;
type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};
type Deal = {
  id: string;
  user_id: string | null;
  category: string | null;
  dislikes_count: number | null;
  public_id: number | null;
  shop_id: string | null;
  item_id: string | null;
  title: string | null;
  image_url: string | null;
  price: number | null;
  orig_price: number | null;
  shop_name: string | null;
  market: string | null;
  created_at: string;
  likes_count: number | null;
  comments_count: number | null;
};

function isCategoryId(value: string): value is CategoryId {
  return Object.prototype.hasOwnProperty.call(CATEGORIES, value);
}

function safePage(value: string | string[] | undefined): number {
  const input = Array.isArray(value) ? value[0] : value;
  if (!input || !/^[1-9]\d*$/.test(input)) return 1;
  const parsed = Number(input);
  return Number.isSafeInteger(parsed) ? parsed : 1;
}

function normalizeSlug(value: string | null): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, "-")
    .replace(/[^a-z0-9._~-]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}

function dealPath(deal: Deal): string | null {
  if (deal.public_id == null) return null;
  const suffix = [normalizeSlug(deal.shop_id), normalizeSlug(deal.item_id)].filter(Boolean).join("-");
  return `/deals/${deal.public_id}${suffix ? `-${suffix}` : ""}`;
}

function formatPrice(value: number | null): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `${new Intl.NumberFormat("ja-JP").format(value)}円` : "価格情報なし";
}

function pageUrl(slug: CategoryId, page: number): string {
  return `/category/${slug}${page > 1 ? `?page=${page}` : ""}`;
}

export const revalidate = 300;

export function generateStaticParams() {
  return Object.keys(CATEGORIES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isCategoryId(slug)) return {};
  const page = safePage((await searchParams).page);
  const category = CATEGORIES[slug];
  const path = pageUrl(slug, page);
  const title = `${category.title}${page > 1 ? `（${page}ページ目）` : ""}`;
  return {
    title,
    description: category.description,
    alternates: { canonical: path },
    openGraph: { title: `${title}｜トクミッケ`, description: category.description, url: path, type: "website", locale: "ja_JP" },
    robots: { index: true, follow: true },
  };
}

async function getCategoryDeals(category: CategoryId, page: number): Promise<{ deals: Deal[]; count: number; error: boolean }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { deals: [], count: 0, error: true };

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await supabase.from("deals")
    .select("id,user_id,category,public_id,shop_id,item_id,title,image_url,price,orig_price,shop_name,market,created_at,likes_count,comments_count", { count: "exact" })
    .eq("moderation_status", "visible")
    .eq("is_expired", false)
    .eq("category", category)
    .not("public_id", "is", null)
    .order("created_at", { ascending: false })
    .order("public_id", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (error) {
    console.error(`category page query failed (${category}):`, { message: error.message, code: error.code, details: error.details, hint: error.hint });
    return { deals: [], count: 0, error: true };
  }
  return { deals: (data ?? []) as Deal[], count: count ?? 0, error: false };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  if (!isCategoryId(slug)) notFound();
  const page = safePage((await searchParams).page);
  const category = CATEGORIES[slug];
  const { deals, count, error } = await getCategoryDeals(slug, page);
  const authorIds = [...new Set(deals.map((d) => d.user_id).filter((id): id is string => !!id))];
  const profileMap: Record<string, { username: string | null; avatar_url: string | null; avatar_updated_at: string | null }> = {};
  if (authorIds.length) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
      const { data: profiles, error: profileError } = await client.from("profiles")
        .select("id,username,avatar_url,avatar_updated_at").in("id", authorIds);
      if (profileError) console.error("category profiles query error:", profileError);
      for (const profile of profiles ?? []) profileMap[profile.id] = profile;
    }
  }
  const totalPages = Math.ceil(count / PAGE_SIZE);
  if (!error && page > 1 && (page > totalPages || count === 0)) notFound();

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      <nav aria-label="パンくずリスト" className="mb-4 text-xs text-slate-500">
        <Link href="/" className="cursor-pointer hover:underline">トップ</Link>
        <span aria-hidden="true" className="px-2">/</span>
        <span>{category.label}</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{category.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{category.description}</p>
      </header>

      <nav aria-label="商品カテゴリ" className="mb-6 flex flex-wrap gap-2">
        {(Object.keys(CATEGORIES) as CategoryId[]).map((id) => (
          <Link key={id} href={pageUrl(id, 1)} aria-current={id === slug ? "page" : undefined}
            className={`inline-flex cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${id === slug ? "border-[#006888] bg-[#006888] text-white" : "border-slate-300 bg-white text-slate-700 hover:border-[#006888] hover:text-[#006888]"}`}>
            {CATEGORIES[id].label}
          </Link>
        ))}
      </nav>

      {error ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-700" role="status">商品を取得できませんでした。時間をおいて再度お試しください。</div>
      ) : deals.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-700">現在掲載中の商品はありません。</div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between gap-2 text-sm text-slate-600">
            <span>掲載中 {count.toLocaleString("ja-JP")} 件</span>
            <span>{page} / {totalPages} ページ</span>
          </div>
          <div className="-mx-4 grid grid-cols-1 gap-2.5 md:mx-0 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {deals.map((deal) => {
              const href = dealPath(deal);
              if (!href) return null;
              const profile = deal.user_id ? profileMap[deal.user_id] : undefined;
              const separator = profile?.avatar_url?.includes("?") ? "&" : "?";
              const avatar = profile?.avatar_url && profile?.avatar_updated_at
                ? `${profile.avatar_url}${separator}v=${encodeURIComponent(profile.avatar_updated_at)}`
                : profile?.avatar_url ?? "/tokumikke_logo.png";
              return (
                <CategoryDealCard
                  key={deal.id}
                  deal={{ ...deal, dislikes_count: 0, detailUrl: href, username: profile?.username ?? "匿名ユーザー", avatar }}
                />
              );
            })}
          </div>
          <nav aria-label="ページ切り替え" className="mt-8 flex items-center justify-center gap-3">
            {page > 1 ? <Link href={pageUrl(slug, page - 1)} className="cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">前のページ</Link> : null}
            <span className="text-sm text-slate-600">{page} / {totalPages}</span>
            {page < totalPages ? <Link href={pageUrl(slug, page + 1)} className="cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">次のページ</Link> : null}
          </nav>
        </>
      )}
    </div>
  );
}