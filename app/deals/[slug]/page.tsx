import type { Metadata } from "next";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { notFound, permanentRedirect } from "next/navigation";
import DealDetailClient, { type DealRow } from "./DealDetailClient";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

const SITE_URL = "https://www.tokumikke.com";

const DEAL_SELECT =
  "id, public_id, created_at, title, price, orig_price, free_shipping, brand, expires_at, market, market_code, shop_id, item_id, deal_number, shop_name, deal_url, image_url, comment, item_description, is_expired, likes_count, comments_count, user_id";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function normalizeDealSlugPart(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._~-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildDealDetailPath(deal: {
  public_id?: number | null;
  shop_id?: string | null;
  item_id?: string | null;
}) {
  if (deal.public_id == null) return null;

  const suffix = [
    normalizeDealSlugPart(deal.shop_id),
    normalizeDealSlugPart(deal.item_id),
  ]
    .filter(Boolean)
    .join("-");

  return suffix
    ? `/deals/${deal.public_id}-${suffix}`
    : `/deals/${deal.public_id}`;
}

function extractPublicId(slug: string) {
  const match = slug.match(/^(\d+)(?:-|$)/);
  return match?.[1] ?? null;
}

function buildCanonicalUrl(deal: {
  public_id?: number | null;
  shop_id?: string | null;
  item_id?: string | null;
}) {
  const path = buildDealDetailPath(deal);
  return path ? `${SITE_URL}${path}` : null;
}

function buildMetaDescription(data: Record<string, any>) {
  const parts: string[] = [];

  if (data.shop_name) parts.push(String(data.shop_name));

  if (data.price != null) {
    const price = Number(data.price);
    if (Number.isFinite(price)) {
      parts.push(`¥${Math.round(price).toLocaleString("ja-JP")}`);
    }
  }

  const detail =
    typeof data.comment === "string" && data.comment.trim()
      ? data.comment.trim()
      : typeof data.item_description === "string" &&
          data.item_description.trim()
        ? data.item_description.trim()
        : "";

  const prefix = parts.length > 0 ? `${parts.join("・")}。` : "";
  const description = `${prefix}${detail}`.replace(/\s+/g, " ").trim();

  return description
    ? description.slice(0, 160)
    : "トクミッケでお得なディール情報をチェック。";
}

const getDealForRoute = cache(async (slug: string) => {
  const supabase = getSupabase();

  if (UUID_PATTERN.test(slug)) {
    const { data, error } = await supabase
      .from("deals")
      .select(DEAL_SELECT)
      .eq("id", slug)
      .maybeSingle();

    return { supabase, data, error, isLegacyUuid: true };
  }

  const publicId = extractPublicId(slug);

  if (!publicId) {
    return {
      supabase,
      data: null,
      error: null,
      isLegacyUuid: false,
    };
  }

  const { data, error } = await supabase
    .from("deals")
    .select(DEAL_SELECT)
    .eq("public_id", publicId)
    .maybeSingle();

  return { supabase, data, error, isLegacyUuid: false };
});

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;

  if (!slug) {
    return {
      title: "ディールが見つかりません | トクミッケ",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const { data, error } = await getDealForRoute(slug);

  if (error || !data) {
    return {
      title: "ディールが見つかりません | トクミッケ",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const canonicalUrl = buildCanonicalUrl(data);
  const title = data.title
    ? String(data.title)
    : "ディール";
  const description = buildMetaDescription(data);
  const imageUrl =
    typeof data.image_url === "string" && data.image_url.trim()
      ? data.image_url.trim()
      : null;

  return {
    title,
    description,
    alternates: canonicalUrl
      ? {
          canonical: canonicalUrl,
        }
      : undefined,
    openGraph: {
      type: "website",
      locale: "ja_JP",
      siteName: "トクミッケ",
      title,
      description,
      url: canonicalUrl ?? undefined,
      images: imageUrl
        ? [
            {
              url: imageUrl,
              alt: data.title ? String(data.title) : "トクミッケのディール",
            },
          ]
        : undefined,
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

async function decorateDeal(
  supabase: ReturnType<typeof getSupabase>,
  data: Record<string, any>
): Promise<DealRow> {
  const profilePromise = data.user_id
    ? supabase
        .from("profiles")
        .select("username")
        .eq("id", data.user_id)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null } as any);

  const dislikePromise = supabase
    .from("deal_dislikes")
    .select("deal_id", { count: "exact", head: true })
    .eq("deal_id", String(data.id));

  const [profileResult, dislikeResult] = await Promise.all([
    profilePromise,
    dislikePromise,
  ]);

  if (profileResult.error) {
    console.warn("deal author profile load warn:", profileResult.error);
  }

  if (dislikeResult.error) {
    console.warn("deal dislike count load warn:", dislikeResult.error);
  }

  return {
    ...data,
    id: String(data.id),
    public_id: data.public_id != null ? Number(data.public_id) : null,
    author_username: profileResult.data?.username ?? null,
    dislikes_count: dislikeResult.error ? 0 : dislikeResult.count ?? 0,
    has_liked: false,
    has_disliked: false,
    has_saved: false,
  } as DealRow;
}

export default async function DealPage({ params }: PageProps) {
  const { slug } = await params;

  if (!slug) {
    notFound();
  }

  const { supabase, data, error, isLegacyUuid } =
    await getDealForRoute(slug);

  if (error) {
    console.error(
      isLegacyUuid
        ? "legacy deal load error:"
        : "deal detail server load error:",
      error
    );

    throw new Error(
      isLegacyUuid ? "Failed to load legacy deal URL." : "Failed to load deal."
    );
  }

  if (!data) {
    notFound();
  }

  const canonicalPath = buildDealDetailPath(data);
  const currentPath = `/deals/${slug}`;

  if (canonicalPath && canonicalPath !== currentPath) {
    permanentRedirect(canonicalPath);
  }

  const initialDeal = await decorateDeal(
    supabase,
    data as Record<string, any>
  );

  return <DealDetailClient initialDeal={initialDeal} />;
}
