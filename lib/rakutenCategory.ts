import {
  fetchRakutenGenrePath,
  type RakutenGenreNode,
} from "@/lib/rakuten";

export type DealCategory =
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

export type RakutenRankingSource = {
  key: string;
  name?: string;
  genreId?: number | null;
  rank: number;
};

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

async function getGenrePathCached(
  genreId: number
): Promise<RakutenGenreNode[]> {
  const cached = genrePathCache.get(genreId);
  if (cached) return cached;

  const path = await fetchRakutenGenrePath(genreId);
  genrePathCache.set(genreId, path);
  return path;
}

export async function resolveRakutenDealCategory(
  genreId: number | null,
  rankingSources: RakutenRankingSource[] = []
): Promise<DealCategory> {
  // Structural classification only. Product text is intentionally ignored.
  if (genreId != null) {
    try {
      const genrePath = await getGenrePathCached(genreId);

      for (const node of genrePath) {
        const mapped = RAKUTEN_GENRE_CATEGORY_MAP[node.genreId];
        if (mapped) return mapped;
      }

      const directMapped = RAKUTEN_GENRE_CATEGORY_MAP[genreId];
      if (directMapped) return directMapped;
    } catch (error) {
      console.warn(
        "[rakuten-category] genre lookup failed:",
        genreId,
        error
      );
    }
  }

  const bestCategorySource = rankingSources
    .filter(
      (source) =>
        source.key !== "overall" &&
        RANKING_SOURCE_CATEGORY_MAP[source.key]
    )
    .sort((a, b) => a.rank - b.rank)[0];

  if (bestCategorySource) {
    return (
      RANKING_SOURCE_CATEGORY_MAP[bestCategorySource.key] ?? "other"
    );
  }

  return "other";
}
