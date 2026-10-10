// app/deals/[slug]/RelatedCategoryDeals.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  ThumbsUp,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { likeDeal } from "@/lib/dealActions";
import { yen } from "@/app/components/DealUI";

type RelatedDeal = {
  id: string;
  public_id: number | null;
  shop_id: string | null;
  item_id: string | null;
  title: string | null;
  image_url: string | null;
  price: number | null;
  orig_price: number | null;
  market: string | null;
  shop_name: string | null;
  created_at: string;
  likes_count: number | null;
  comments_count: number | null;
};

type CardState = {
  liked: boolean;
  likes: number;
  comments: number;
  commented: boolean;
};

const CATEGORIES: Record<string, string> = {
  fashion_women: "レディース",
  fashion_men: "メンズ",
  food: "食品・飲料",
  beauty: "ビューティー",
  home: "日用品・ホーム",
  interior: "インテリア・家具",
  electronics: "家電・ガジェット",
  sports: "スポーツ・アウトドア",
  shoes: "靴・シューズ",
  other: "その他",
};

function detailUrl(d: RelatedDeal) {
  if (d.public_id == null) return `/deals/${d.id}`;

  const suffix = [d.shop_id, d.item_id]
    .map((s) =>
      (s ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9._~-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
    )
    .filter(Boolean)
    .join("-");

  return `/deals/${d.public_id}${suffix ? `-${suffix}` : ""}`;
}

export default function RelatedCategoryDeals({ dealId }: { dealId: string }) {
  const [category, setCategory] = useState<string | null>(null);
  const [deals, setDeals] = useState<RelatedDeal[]>([]);
  const [cardStates, setCardStates] = useState<Record<string, CardState>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const busyRef = useRef<Set<string>>(new Set());
  const rail = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (active) setCurrentUserId(data.user?.id ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setCurrentUserId(session?.user?.id ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    setCategory(null);
    setDeals([]);
    setCardStates({});

    (async () => {
      const { data: current, error: categoryError } = await supabase
        .from("deals")
        .select("category")
        .eq("id", dealId)
        .maybeSingle();

      if (!active) return;

      if (categoryError || !current?.category) {
        if (categoryError) {
          console.warn("related deals category load warn:", categoryError);
        }
        return;
      }

      const selected: string = current.category;
      if (!Object.prototype.hasOwnProperty.call(CATEGORIES, selected)) return;

      setCategory(selected);

      const { data, error } = await supabase
        .from("deals")
        .select(
          "id, public_id, shop_id, item_id, title, image_url, price, orig_price, market, shop_name, created_at, likes_count, comments_count"
        )
        .eq("category", selected)
        .eq("moderation_status", "visible")
        .eq("is_expired", false)
        .neq("id", dealId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(21);

      if (!active) return;

      if (error) {
        console.warn("related category deals warn:", error);
        return;
      }

      setDeals((data ?? []) as RelatedDeal[]);
    })();

    return () => {
      active = false;
    };
  }, [dealId]);

  const refreshCardStates = useCallback(async () => {
    if (!deals.length) return;

    const ids = deals.map((d) => d.id);

    const [
      { data: likeRows, error: likeError },
      { data: dislikeRows, error: dislikeError },
      { data: commentRows, error: commentError },
    ] = await Promise.all([
      supabase.from("deal_likes").select("deal_id, user_id").in("deal_id", ids),
      supabase.from("deal_dislikes").select("deal_id").in("deal_id", ids),
      supabase
        .from("deal_comments")
        .select("id, deal_id, user_id")
        .in("deal_id", ids)
        .eq("moderation_status", "visible"),
    ]);

    const commentToDeal = new Map<string, string>();
    const commentTotals = new Map<string, number>();
    const commentedDeals = new Set<string>();

    if (!commentError) {
      for (const row of commentRows ?? []) {
        const commentId = String(row.id);
        const relatedDealId = String(row.deal_id);
        commentToDeal.set(commentId, relatedDealId);
        if (currentUserId && row.user_id === currentUserId) {
          commentedDeals.add(relatedDealId);
        }
        commentTotals.set(
          relatedDealId,
          (commentTotals.get(relatedDealId) ?? 0) + 1
        );
      }

      const commentIds = [...commentToDeal.keys()];
      if (commentIds.length) {
        const { data: replies, error: replyError } = await supabase
          .from("deal_comment_replies")
          .select("comment_id, user_id")
          .in("comment_id", commentIds)
          .eq("moderation_status", "visible");

        if (!replyError) {
          for (const reply of replies ?? []) {
            const relatedDealId = commentToDeal.get(String(reply.comment_id));
            if (relatedDealId) {
              if (currentUserId && reply.user_id === currentUserId) {
                commentedDeals.add(relatedDealId);
              }
              commentTotals.set(
                relatedDealId,
                (commentTotals.get(relatedDealId) ?? 0) + 1
              );
            }
          }
        } else {
          console.warn("related reply counts warn:", replyError);
        }
      }
    } else {
      console.warn("related comment counts warn:", commentError);
    }

    const likeTotals = new Map<string, number>();
    const dislikeTotals = new Map<string, number>();
    const mine = new Set<string>();

    if (!likeError) {
      for (const row of likeRows ?? []) {
        const likedDealId = String(row.deal_id);
        likeTotals.set(likedDealId, (likeTotals.get(likedDealId) ?? 0) + 1);
        if (currentUserId && row.user_id === currentUserId) {
          mine.add(likedDealId);
        }
      }
    } else {
      console.warn("related like counts warn:", likeError);
    }

    if (!dislikeError) {
      for (const row of dislikeRows ?? []) {
        const dislikedDealId = String(row.deal_id);
        dislikeTotals.set(
          dislikedDealId,
          (dislikeTotals.get(dislikedDealId) ?? 0) + 1
        );
      }
    } else {
      console.warn("related dislike counts warn:", dislikeError);
    }

    const next: Record<string, CardState> = {};

    for (const d of deals) {
      next[d.id] = {
        liked: mine.has(d.id),
        commented: commentedDeals.has(d.id),
        likes:
          (likeError ? Number(d.likes_count ?? 0) : likeTotals.get(d.id) ?? 0) -
          (dislikeError ? 0 : dislikeTotals.get(d.id) ?? 0),
        comments: commentError
          ? Number(d.comments_count ?? 0)
          : commentTotals.get(d.id) ?? 0,
      };
    }

    setCardStates(next);
  }, [deals, currentUserId]);

  useEffect(() => {
    void refreshCardStates();
  }, [refreshCardStates]);

  const handleLike = async (d: RelatedDeal) => {
    if (!currentUserId) {
      const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.location.assign(`/auth?next=${encodeURIComponent(next)}`);
      return;
    }

    if (busyRef.current.has(d.id)) return;

    busyRef.current.add(d.id);
    setBusyIds((previous) => [...previous, d.id]);

    const wasLiked = cardStates[d.id]?.liked ?? false;

    try {
      if (wasLiked) {
        const { error } = await supabase
          .from("deal_likes")
          .delete()
          .eq("deal_id", d.id)
          .eq("user_id", currentUserId);
        if (error) throw error;
      } else {
        const { error: removeDislikeError } = await supabase
          .from("deal_dislikes")
          .delete()
          .eq("deal_id", d.id)
          .eq("user_id", currentUserId);
        if (removeDislikeError) throw removeDislikeError;

        const result = await likeDeal({ dealId: d.id, userId: currentUserId });
        if (!result.ok) {
          throw new Error(String(result.error ?? "Like failed"));
        }
      }

      await refreshCardStates();
    } catch (error) {
      console.error("related deal like error:", error);
      window.alert("投票を更新できませんでした。もう一度お試しください。");
      await refreshCardStates();
    } finally {
      busyRef.current.delete(d.id);
      setBusyIds((previous) => previous.filter((id) => id !== d.id));
    }
  };

  const shareDeal = async (d: RelatedDeal) => {
    const url = `${window.location.origin}${detailUrl(d)}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: d.title || "トクミッケ",
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        window.alert("リンクをコピーしました。");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("related deal share error:", error);
    }
  };

  if (!category || deals.length === 0) return null;

  const scroll = (direction: number) => {
    const el = rail.current;
    if (!el) return;

    const pageWidth = Math.max(el.clientWidth - 16, el.clientWidth * 0.92);
    el.scrollBy({
      left: direction * pageWidth,
      behavior: "smooth",
    });
  };

  return (
    <section
      aria-label="同じカテゴリのディール"
      className="w-full min-w-0 max-w-full overflow-hidden bg-white px-4 py-5 shadow-sm md:rounded-xl md:border md:border-slate-200 md:px-5 md:py-6"
    >
      <div className="mb-4 flex min-w-0 items-center justify-between gap-2">
        <h2 className="min-w-0 text-base font-bold text-[#001e43] sm:text-xl">
          {CATEGORIES[category]}の新着ディール
        </h2>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Link
            href={`/?category=${encodeURIComponent(category)}`}
            className="cursor-pointer whitespace-nowrap text-xs font-semibold text-[#006888] hover:underline sm:text-sm"
          >
            全て見る
          </Link>

          <button
            type="button"
            onClick={() => scroll(-1)}
            className="hidden h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-[#001e43] hover:bg-slate-50 sm:inline-flex"
            aria-label="前の商品"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => scroll(1)}
            className="hidden h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-[#001e43] hover:bg-slate-50 sm:inline-flex"
            aria-label="次の商品"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={rail}
        className="flex w-full min-w-0 max-w-full snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-2 pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ touchAction: "pan-x pan-y" }}
      >
        {deals.map((d) => {
          const state = cardStates[d.id];
          const createdAtTime = new Date(d.created_at).getTime();
          const createdRecently =
            !Number.isNaN(createdAtTime) &&
            Date.now() >= createdAtTime &&
            Date.now() - createdAtTime < 24 * 60 * 60 * 1000;

          return (
            <article
              key={d.id}
              className="flex min-w-0 shrink-0 snap-start flex-col overflow-hidden rounded-lg border border-slate-200 bg-white p-2 shadow-sm w-[calc((100%-0.75rem)/2.35)] min-[390px]:w-[calc((100%-0.75rem)/2.2)] sm:w-[calc((100%-1.5rem)/3)] lg:w-[calc((100%-2.25rem)/4)] xl:w-[calc((100%-3rem)/5)] 2xl:w-[calc((100%-3.75rem)/6)]"
            >
              <Link
                href={detailUrl(d)}
                className="block cursor-pointer overflow-hidden rounded-md bg-slate-50"
              >
                {d.image_url ? (
                  <img
                    src={d.image_url}
                    alt={d.title ?? "商品画像"}
                    loading="lazy"
                    className="aspect-square w-full object-contain"
                  />
                ) : (
                  <div className="aspect-square w-full bg-slate-100" />
                )}
              </Link>

              <Link
                href={detailUrl(d)}
                className="mt-2 line-clamp-2 min-h-[2.7em] cursor-pointer text-[12px] font-semibold leading-[1.35] text-slate-900 hover:underline sm:text-[13px]"
              >
                {d.title ?? "タイトル未設定"}
              </Link>

              <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span className="text-[15px] font-bold leading-none text-[#d70035] sm:text-[18px]">
                  {yen(Number(d.price ?? 0))}
                </span>

                {createdRecently ? (
                  <span className="inline-flex self-center items-center rounded bg-[#d43b16] px-1.5 py-[1px] text-[9px] font-bold leading-none text-white">
                    NEW
                  </span>
                ) : null}

                {Number(d.orig_price ?? 0) > Number(d.price ?? 0) ? (
                  <span className="text-[11px] text-slate-400 line-through">
                    {yen(Number(d.orig_price))}
                  </span>
                ) : null}
              </div>

              <span className="mt-1 truncate text-[11px] text-slate-500">
                {d.shop_name || d.market || "ショップ未設定"}
              </span>

              <div className="mt-auto flex items-center gap-2 border-t border-slate-200 pt-2 text-[11px] text-slate-500">
                <button
                  type="button"
                  disabled={busyIds.includes(d.id)}
                  onClick={() => void handleLike(d)}
                  aria-label={state?.liked ? "いいねを取り消す" : "いいね"}
                  aria-pressed={state?.liked ?? false}
                  className={`inline-flex cursor-pointer items-center gap-1 disabled:cursor-wait disabled:opacity-50 ${
                    state?.liked ? "text-[#006888]" : "hover:text-[#006888]"
                  }`}
                >
                  <ThumbsUp
                    className="h-3.5 w-3.5"
                    fill={state?.liked ? "currentColor" : "none"}
                  />
                  {state?.likes ?? Number(d.likes_count ?? 0)}
                </button>

                <Link
                  href={`${detailUrl(d)}#comments`}
                  aria-label="コメントを見る"
                  className={`inline-flex cursor-pointer items-center gap-1 ${
                    state?.commented
                      ? "text-[#001e43] hover:text-[#001e43]"
                      : "hover:text-slate-700"
                  }`}
                  title={state?.commented ? "コメント済み" : "コメントを見る"}
                >
                  <MessageSquare
                    className="h-3.5 w-3.5"
                    fill={state?.commented ? "currentColor" : "none"}
                  />
                  {state?.comments ?? Number(d.comments_count ?? 0)}
                </Link>

                <button
                  type="button"
                  onClick={() => void shareDeal(d)}
                  aria-label="シェアする"
                  className="ml-auto inline-flex cursor-pointer items-center text-slate-500 hover:text-slate-700"
                  title="シェア"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
                    <path d="M21.55 9.17 14.83 3.5a.75.75 0 0 0-1.23.57v3.06C7.5 7.63 3.25 10.72 2.1 16.8a.75.75 0 0 0 1.28.65c2.52-2.7 5.57-4.12 10.22-4.22v3.2a.75.75 0 0 0 1.23.57l6.72-5.67a1.4 1.4 0 0 0 0-2.16Z" />
                  </svg>
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
