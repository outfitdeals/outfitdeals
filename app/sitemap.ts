import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const SITE_URL = "https://www.tokumikke.com";
const PAGE_SIZE = 1000;

export const revalidate = 3600;

type SitemapDeal = {
  public_id: number | null;
  shop_id: string | null;
  item_id: string | null;
  created_at: string | null;
};

function normalizeDealSlugPart(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._~-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildDealPath(deal: SitemapDeal) {
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

async function loadVisibleDeals(): Promise<SitemapDeal[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("sitemap: Supabase environment variables are not configured.");
    return [];
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const rows: SitemapDeal[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("deals")
      .select("public_id, shop_id, item_id, created_at")
      .eq("moderation_status", "visible")
      .not("public_id", "is", null)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("sitemap: failed to load deals:", error);
      break;
    }

    const page = (data ?? []) as SitemapDeal[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/terms`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/privacy`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/affiliate`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/contact`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  const deals = await loadVisibleDeals();

  const dealPages: MetadataRoute.Sitemap = deals.flatMap((deal) => {
    const path = buildDealPath(deal);
    if (!path) return [];

    return [
      {
        url: `${SITE_URL}${path}`,
        lastModified: deal.created_at
          ? new Date(deal.created_at)
          : undefined,
        changeFrequency: "daily" as const,
        priority: 0.8,
      },
    ];
  });

  return [...staticPages, ...dealPages];
}
