// app/deals/[id]/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Bookmark,
  Forward,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Truck,
  CheckCircle2,
  UserRound,
  Search,
} from "lucide-react";

import RightSidebar, { type SidebarDeal } from "@/app/components/RightSidebar";
import { MarketTag, yen } from "@/app/components/DealUI";
import ViewTracker from "@/app/components/ViewTracker";
import { likeDeal, saveDeal } from "@/lib/dealActions";

type DealRow = {
  id: string;
  created_at: string;
  title: string | null;
  price: number | null;
  orig_price: number | null;
  free_shipping: boolean | null;
  brand: string | null;
  expires_at: string | null;
  market: string | null;
  shop_name: string | null;
  deal_url: string | null;
  image_url: string | null;
  comment: string | null;
  item_description: string | null;
  is_expired: boolean | null;
  likes_count: number | null;
  comments_count: number | null;
  user_id: string | null;
  author_username?: string | null;
  has_liked?: boolean | null;
  has_disliked?: boolean | null;
  dislikes_count?: number | null;
  has_saved?: boolean | null;
};

type ReplyRow = {
  id: string;
  comment_id: string;
  created_at: string;
  body: string;
  user_id: string | null;
  username?: string | null;
  like_count?: number;
  has_liked?: boolean;
};

type CommentRow = {
  id: string;
  created_at: string;
  body: string;
  user_id: string | null;
  username?: string | null;
  like_count?: number;
  has_liked?: boolean;
  replies?: ReplyRow[];
};

const PLACEHOLDER_IMG = "https://via.placeholder.com/900x900?text=No+Image";

function fmtShort(dt: string) {
  try {
    return new Date(dt).toLocaleString("ja-JP", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dt;
  }
}

function fmtCommentDateTime(dt: string) {
  try {
    const date = new Date(dt);
    const now = new Date();

    const targetDay = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );
    const today = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const diffDays = Math.round(
      (today.getTime() - targetDay.getTime()) / 86400000
    );

    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const time = `${hours}:${minutes}`;

    if (diffDays === 0) {
      return `今日 ${time}`;
    }

    if (diffDays === 1) {
      return `昨日 ${time}`;
    }

    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${time}`;
  } catch {
    return dt;
  }
}

function getDiscountPercent(price: number | null, origPrice: number | null) {
  if (!price || !origPrice || origPrice <= price) return null;
  return Math.round(((origPrice - price) / origPrice) * 100);
}

function FreeShippingBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={
        compact
          ? "inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-[11px] font-semibold leading-none text-emerald-700 ring-1 ring-inset ring-emerald-200"
          : "inline-flex items-center gap-1 rounded bg-emerald-50 px-2.5 py-1.5 text-[12px] font-semibold leading-none text-emerald-700 ring-1 ring-inset ring-emerald-200"
      }
    >
      <Truck className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      送料無料
    </span>
  );
}

function formatDealExpiry(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function CommentAvatar({
  userId,
  username,
  size = "normal",
}: {
  userId: string | null;
  username?: string | null;
  size?: "small" | "normal";
}) {
  const publicUrl = userId
    ? supabase.storage.from("avatars").getPublicUrl(`${userId}/avatar.jpg`).data
        .publicUrl
    : null;

  const dimension = size === "small" ? "h-8 w-8" : "h-10 w-10";
  const iconSize = size === "small" ? "h-5 w-5" : "h-6 w-6";

  return (
    <span
      className={`relative inline-flex ${dimension} shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-slate-400 ring-1 ring-slate-200`}
      aria-label={`${username ?? "ユーザー"}のアバター`}
    >
      <UserRound className={iconSize} strokeWidth={1.8} />

      {publicUrl ? (
        <img
          src={publicUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : null}
    </span>
  );
}

export default function DealDetailPage() {
  const params = useParams<{ id: string }>();
  const id = (params?.id as string) ?? "";

  const [viewportWidth, setViewportWidth] = useState<number>(1600);
  const [showStickyMobileCta, setShowStickyMobileCta] = useState(false);
  const [showStickyDesktopCta, setShowStickyDesktopCta] = useState(false);
  const mobilePrimaryCtaRef = useRef<HTMLAnchorElement | null>(null);
  const desktopPrimaryCtaRef = useRef<HTMLAnchorElement | null>(null);
  const mobileCommentsRef = useRef<HTMLDivElement | null>(null);
  const desktopCommentsRef = useRef<HTMLElement | null>(null);
  const mobileCommentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const desktopCommentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const shareToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [shareCopied, setShareCopied] = useState(false);
  const [mobileCommentComposer, setMobileCommentComposer] = useState<
    "top" | "bottom" | null
  >(null);
  const [desktopCommentComposer, setDesktopCommentComposer] = useState<
    "top" | "bottom" | null
  >(null);
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  const [deal, setDeal] = useState<DealRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentSearch, setCommentSearch] = useState("");
  const [commentSort, setCommentSort] = useState<
    "oldest" | "newest" | "popular"
  >("oldest");
  const [commentPage, setCommentPage] = useState(1);
  const [commentBody, setCommentBody] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentLoading, setCommentLoading] = useState(false);

  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyOpenMap, setReplyOpenMap] = useState<Record<string, boolean>>({});
  const [expandedReplyThreads, setExpandedReplyThreads] = useState<
    Record<string, boolean>
  >({});
  const [replySubmittingId, setReplySubmittingId] = useState<string | null>(null);
  const [commentLikingId, setCommentLikingId] = useState<string | null>(null);
  const [replyLikingId, setReplyLikingId] = useState<string | null>(null);

  const [popular, setPopular] = useState<SidebarDeal[]>([]);
  const [trending, setTrending] = useState<SidebarDeal[]>([]);
  const [endingSoon, setEndingSoon] = useState<SidebarDeal[]>([]);
  const [loadingSide, setLoadingSide] = useState(false);

  const [liking, setLiking] = useState(false);
  const [disliking, setDisliking] = useState(false);
  const [saving, setSaving] = useState(false);

  const [openDealDetails, setOpenDealDetails] = useState(true);
  const [productDetailsExpanded, setProductDetailsExpanded] = useState(false);
  const [openPosterNote, setOpenPosterNote] = useState(true);
  const [openProductInfo, setOpenProductInfo] = useState(false);
  const [openAboutPoster, setOpenAboutPoster] = useState(false);

  useEffect(() => {
    function handleResize() {
      if (typeof window === "undefined") return;
      setViewportWidth(window.innerWidth);
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash;
    const hasCommentAnchor = hash.startsWith("#comment-");

    if (hasCommentAnchor || hash === "#comments") return;

    const resetScroll = () => {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "auto",
      });
    };

    resetScroll();

    const frameId = window.requestAnimationFrame(() => {
      resetScroll();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [id]);

  useEffect(() => {
    return () => {
      if (shareToastTimerRef.current) {
        clearTimeout(shareToastTimerRef.current);
      }
    };
  }, []);

  const isMobile = viewportWidth < 768;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#comments") return;
    if (loading || errorMsg || !deal) return;

    const scrollToComments = () => {
      const target = isMobile
        ? mobileCommentsRef.current
        : desktopCommentsRef.current;

      target?.scrollIntoView({
        behavior: "auto",
        block: "start",
      });
    };

    scrollToComments();

    const frameId = window.requestAnimationFrame(() => {
      scrollToComments();
    });

    const timeoutId = window.setTimeout(() => {
      scrollToComments();
    }, 120);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [deal, errorMsg, isMobile, loading]);

  useEffect(() => {
    let cancelled = false;

    const applyUser = (user: any | null) => {
      if (cancelled) return;
      setCurrentUser(user);
    };

    supabase.auth.getUser().then(({ data }) => {
      applyUser(data.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (!isMobile && showStickyDesktopCta) {
      document.body.setAttribute("data-hide-global-site-header", "true");
    } else {
      document.body.removeAttribute("data-hide-global-site-header");
    }

    return () => {
      document.body.removeAttribute("data-hide-global-site-header");
    };
  }, [isMobile, showStickyDesktopCta]);

  const discountPercent = useMemo(() => {
    if (!deal) return null;
    return getDiscountPercent(deal.price, deal.orig_price);
  }, [deal]);

  const expiryLabel = useMemo(
    () => formatDealExpiry(deal?.expires_at ?? null),
    [deal?.expires_at]
  );

  const isPastExpiry = useMemo(() => {
    if (!deal?.expires_at) return false;
    const time = new Date(deal.expires_at).getTime();
    return !Number.isNaN(time) && time < Date.now();
  }, [deal?.expires_at]);

  const sectionCard =
    "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";

  useEffect(() => {
    if (!isMobile) {
      setShowStickyMobileCta(false);
      return;
    }

    function updateStickyCta() {
      const el = mobilePrimaryCtaRef.current;
      if (!el) {
        setShowStickyMobileCta(false);
        return;
      }

      const rect = el.getBoundingClientRect();
      setShowStickyMobileCta(rect.bottom < 0);
    }

    updateStickyCta();
    window.addEventListener("scroll", updateStickyCta, { passive: true });
    window.addEventListener("resize", updateStickyCta);

    return () => {
      window.removeEventListener("scroll", updateStickyCta);
      window.removeEventListener("resize", updateStickyCta);
    };
  }, [isMobile, deal, loading, errorMsg]);

  useEffect(() => {
    if (isMobile) {
      setShowStickyDesktopCta(false);
      return;
    }

    function updateStickyDesktopCta() {
      const el = desktopPrimaryCtaRef.current;
      if (!el) {
        setShowStickyDesktopCta(false);
        return;
      }

      const rect = el.getBoundingClientRect();
      setShowStickyDesktopCta(rect.bottom < 0);
    }

    updateStickyDesktopCta();
    window.addEventListener("scroll", updateStickyDesktopCta, { passive: true });
    window.addEventListener("resize", updateStickyDesktopCta);

    return () => {
      window.removeEventListener("scroll", updateStickyDesktopCta);
      window.removeEventListener("resize", updateStickyDesktopCta);
    };
  }, [isMobile, deal, loading, errorMsg]);

  const attachHasLikedAndSaved = useCallback(
    async (rows: DealRow[]) => {
      if (rows.length === 0) return rows;

      const ids = rows.map((r) => String(r.id));

      const [
        { data: likeRows, error: likeErr },
        { data: dislikeRows, error: dislikeErr },
        saveResult,
      ] = await Promise.all([
        supabase
          .from("deal_likes")
          .select("deal_id, user_id")
          .in("deal_id", ids),
        supabase
          .from("deal_dislikes")
          .select("deal_id, user_id")
          .in("deal_id", ids),
        currentUser
          ? supabase
              .from("deal_saves")
              .select("deal_id")
              .eq("user_id", currentUser.id)
              .in("deal_id", ids)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (likeErr) {
        console.warn("attach likes warn:", likeErr);
      }

      if (dislikeErr) {
        console.warn("attach dislikes warn:", dislikeErr);
      }

      if (saveResult.error) {
        console.warn("attach has_saved warn:", saveResult.error);
      }

      const likeCountMap = new Map<string, number>();
      const dislikeCountMap = new Map<string, number>();
      const likedSet = new Set<string>();
      const dislikedSet = new Set<string>();

      (likeRows ?? []).forEach((r: any) => {
        const dealId = String(r.deal_id);
        likeCountMap.set(dealId, (likeCountMap.get(dealId) ?? 0) + 1);

        if (currentUser && r.user_id === currentUser.id) {
          likedSet.add(dealId);
        }
      });

      (dislikeRows ?? []).forEach((r: any) => {
        const dealId = String(r.deal_id);
        dislikeCountMap.set(dealId, (dislikeCountMap.get(dealId) ?? 0) + 1);

        if (currentUser && r.user_id === currentUser.id) {
          dislikedSet.add(dealId);
        }
      });

      const savedSet = new Set(
        (saveResult.data ?? []).map((r: any) => String(r.deal_id))
      );

      return rows.map((r) => {
        const dealId = String(r.id);

        return {
          ...r,
          likes_count: likeErr
            ? Number(r.likes_count ?? 0)
            : likeCountMap.get(dealId) ?? 0,
          dislikes_count: dislikeErr
            ? Number(r.dislikes_count ?? 0)
            : dislikeCountMap.get(dealId) ?? 0,
          has_liked: currentUser ? likedSet.has(dealId) : false,
          has_disliked: currentUser ? dislikedSet.has(dealId) : false,
          has_saved: currentUser ? savedSet.has(dealId) : false,
        };
      });
    },
    [currentUser]
  );

  useEffect(() => {
    if (!id) return;

    (async () => {
      setLoading(true);
      setErrorMsg(null);

      const { data, error } = await supabase
        .from("deals")
        .select(
          "id, created_at, title, price, orig_price, free_shipping, brand, expires_at, market, shop_name, deal_url, image_url, comment, item_description, is_expired, likes_count, comments_count, user_id"
        )
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error("deal detail load error:", error);
        setErrorMsg("ディールの取得に失敗しました。");
        setDeal(null);
        setLoading(false);
        return;
      }

      if (!data) {
        setErrorMsg("ディールが見つかりませんでした。");
        setDeal(null);
        setLoading(false);
        return;
      }

      let author_username: string | null = null;
      if ((data as any).user_id) {
        const { data: p, error: pe } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", (data as any).user_id)
          .maybeSingle();

        if (!pe) author_username = p?.username ?? null;
      }

      let row: DealRow = {
        ...(data as any),
        id: String((data as any).id),
        author_username,
      };

      const withFlags = await attachHasLikedAndSaved([row]);
      row = withFlags[0] ?? row;

      setDeal(row);
      setLoading(false);
    })();
  }, [id, attachHasLikedAndSaved]);

  const loadSide = useCallback(async () => {
    setLoadingSide(true);

    const { data, error } = await supabase.rpc("get_sidebar_deals_by_views", {
      p_popular_days: 7,
      p_trending_hours: 24,
      p_limit: 5,
    });

    if (error) {
      console.warn("load sidebar rpc warn:", error);
      setPopular([]);
      setTrending([]);
      setEndingSoon([]);
      setLoadingSide(false);
      return;
    }

    const rows = (data ?? []) as any[];

    const popularRows = rows.filter((r) => r.kind === "popular");
    const trendingRows = rows.filter((r) => r.kind === "trending");
    const endingSoonRows = rows.filter((r) => r.kind === "ending_soon");

    let popularDeals = popularRows.map((r) => ({
      id: String(r.id),
      title: r.title ?? "タイトル未設定",
      price: r.price ?? 0,
      market: r.market ?? "",
      imageUrl: r.image_url ?? null,
      likes: Number(r.likes_count ?? 0),
      comments: Number(r.comments_count ?? 0),
      isLiked: false,
      isSaved: false,
    })) as SidebarDeal[];

    let trendingDeals = trendingRows.map((r) => ({
      id: String(r.id),
      title: r.title ?? "タイトル未設定",
      price: r.price ?? 0,
      market: r.market ?? "",
      imageUrl: r.image_url ?? null,
      likes: Number(r.likes_count ?? 0),
      comments: Number(r.comments_count ?? 0),
      isLiked: false,
      isSaved: false,
    })) as SidebarDeal[];

    let endingSoonDeals = endingSoonRows.map((r) => ({
      id: String(r.id),
      title: r.title ?? "タイトル未設定",
      price: r.price ?? 0,
      market: r.market ?? "",
      imageUrl: r.image_url ?? null,
      likes: Number(r.likes_count ?? 0),
      comments: Number(r.comments_count ?? 0),
      isLiked: false,
      isSaved: false,
    })) as SidebarDeal[];

    const allIds = Array.from(
      new Set([...popularDeals, ...trendingDeals, ...endingSoonDeals].map((r) => r.id))
    );

    if (allIds.length > 0) {
      const { data: allLikeRows, error: allLikesError } = await supabase
        .from("deal_likes")
        .select("deal_id, user_id")
        .in("deal_id", allIds);

      if (allLikesError) {
        console.warn("sidebar like count warn:", allLikesError);
      }

      const likeCountMap = new Map<string, number>();
      const likedSet = new Set<string>();

      (allLikeRows ?? []).forEach((row: any) => {
        const dealId = String(row.deal_id);
        likeCountMap.set(dealId, (likeCountMap.get(dealId) ?? 0) + 1);

        if (currentUser && row.user_id === currentUser.id) {
          likedSet.add(dealId);
        }
      });

      let savedSet = new Set<string>();

      if (currentUser) {
        const { data: saveRows, error: saveError } = await supabase
          .from("deal_saves")
          .select("deal_id")
          .eq("user_id", currentUser.id)
          .in("deal_id", allIds);

        if (saveError) {
          console.warn("sidebar saved-state warn:", saveError);
        } else {
          savedSet = new Set(
            (saveRows ?? []).map((r: any) => String(r.deal_id))
          );
        }
      }

      const commentCountMap = new Map<string, number>();
      const commentedSet = new Set<string>();
      const commentDealMap = new Map<string, string>();

      const { data: sidebarCommentRows, error: sidebarCommentError } =
        await supabase
          .from("deal_comments")
          .select("id, deal_id, user_id")
          .in("deal_id", allIds);

      if (sidebarCommentError) {
        console.warn("sidebar comment-state warn:", sidebarCommentError);
      } else {
        (sidebarCommentRows ?? []).forEach((row: any) => {
          const dealId = String(row.deal_id);
          const commentId = String(row.id);

          commentDealMap.set(commentId, dealId);
          commentCountMap.set(
            dealId,
            (commentCountMap.get(dealId) ?? 0) + 1
          );

          if (currentUser && row.user_id === currentUser.id) {
            commentedSet.add(dealId);
          }
        });

        const commentIds = Array.from(commentDealMap.keys());

        if (commentIds.length > 0) {
          const { data: sidebarReplyRows, error: sidebarReplyError } =
            await supabase
              .from("deal_comment_replies")
              .select("comment_id, user_id")
              .in("comment_id", commentIds);

          if (sidebarReplyError) {
            console.warn("sidebar reply-state warn:", sidebarReplyError);
          } else {
            (sidebarReplyRows ?? []).forEach((row: any) => {
              const dealId = commentDealMap.get(String(row.comment_id));
              if (!dealId) return;

              commentCountMap.set(
                dealId,
                (commentCountMap.get(dealId) ?? 0) + 1
              );

              if (currentUser && row.user_id === currentUser.id) {
                commentedSet.add(dealId);
              }
            });
          }
        }
      }

      const patchSidebarDeal = (r: SidebarDeal): SidebarDeal => ({
        ...r,
        likes: likeCountMap.get(r.id) ?? 0,
        comments: commentCountMap.get(r.id) ?? 0,
        isLiked: likedSet.has(r.id),
        isSaved: savedSet.has(r.id),
        isCommented: commentedSet.has(r.id),
      });

      popularDeals = popularDeals.map(patchSidebarDeal);
      trendingDeals = trendingDeals.map(patchSidebarDeal);
      endingSoonDeals = endingSoonDeals.map(patchSidebarDeal);
    }

    setPopular(popularDeals);
    setTrending(trendingDeals);
    setEndingSoon(endingSoonDeals);
    setLoadingSide(false);
  }, [currentUser]);

  useEffect(() => {
    loadSide();
  }, [loadSide]);

  const loadComments = useCallback(async () => {
    if (!id) return;

    const { data: commentData, error: commentErrorRes } = await supabase
      .from("deal_comments")
      .select("id, body, created_at, user_id")
      .eq("deal_id", id)
      .order("created_at", { ascending: true });

    if (commentErrorRes) {
      console.warn("load comments warn:", commentErrorRes);
      setComments([]);
      return;
    }

    const baseComments = (commentData ?? []) as CommentRow[];
    const commentIds = baseComments.map((c) => c.id);

    const commentUserIds = Array.from(
      new Set(baseComments.map((c) => c.user_id).filter((v): v is string => !!v))
    );

    const { data: replyData, error: replyError } = commentIds.length
      ? await supabase
          .from("deal_comment_replies")
          .select("id, comment_id, body, created_at, user_id")
          .in("comment_id", commentIds)
          .order("created_at", { ascending: true })
      : { data: [], error: null as any };

    if (replyError) {
      console.warn("load replies warn:", replyError);
    }

    const replies = (replyData ?? []) as ReplyRow[];
    const replyUserIds = Array.from(
      new Set(replies.map((r) => r.user_id).filter((v): v is string => !!v))
    );

    const allUserIds = Array.from(new Set([...commentUserIds, ...replyUserIds]));

    let usernameMap: Record<string, string | null> = {};
    if (allUserIds.length > 0) {
      const { data: profs, error: pe } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", allUserIds);

      if (!pe) {
        usernameMap = Object.fromEntries(
          (profs ?? []).map((p: any) => [String(p.id), p.username ?? null])
        );
      }
    }

    const { data: likeRows, error: likeRowsError } = commentIds.length
      ? await supabase
          .from("deal_comment_likes")
          .select("comment_id, user_id")
          .in("comment_id", commentIds)
      : { data: [], error: null as any };

    if (likeRowsError) {
      console.warn("load comment likes warn:", likeRowsError);
    }

    const likeCountMap: Record<string, number> = {};
    const likedByMe = new Set<string>();

    (likeRows ?? []).forEach((row: any) => {
      const cid = String(row.comment_id);
      likeCountMap[cid] = (likeCountMap[cid] ?? 0) + 1;
      if (currentUser && row.user_id === currentUser.id) {
        likedByMe.add(cid);
      }
    });

    const replyIds = replies.map((r) => String(r.id));

    const { data: replyLikeRows, error: replyLikeRowsError } = replyIds.length
      ? await supabase
          .from("deal_comment_reply_likes")
          .select("reply_id, user_id")
          .in("reply_id", replyIds)
      : { data: [], error: null as any };

    if (replyLikeRowsError) {
      console.warn("load reply likes warn:", replyLikeRowsError);
    }

    const replyLikeCountMap: Record<string, number> = {};
    const replyLikedByMe = new Set<string>();

    (replyLikeRows ?? []).forEach((row: any) => {
      const replyId = String(row.reply_id);
      replyLikeCountMap[replyId] = (replyLikeCountMap[replyId] ?? 0) + 1;

      if (currentUser && row.user_id === currentUser.id) {
        replyLikedByMe.add(replyId);
      }
    });

    const repliesByComment: Record<string, ReplyRow[]> = {};
    replies.forEach((r) => {
      const normalizedReply: ReplyRow = {
        ...r,
        username: r.user_id
          ? usernameMap[String(r.user_id)] ?? "匿名ユーザー"
          : "匿名ユーザー",
        like_count: replyLikeCountMap[String(r.id)] ?? 0,
        has_liked: replyLikedByMe.has(String(r.id)),
      };

      if (!repliesByComment[String(r.comment_id)]) {
        repliesByComment[String(r.comment_id)] = [];
      }

      repliesByComment[String(r.comment_id)].push(normalizedReply);
    });

    const normalizedComments = baseComments.map((c) => {
      const nameFromProfiles = c.user_id
        ? usernameMap[String(c.user_id)] ?? null
        : null;
      const name = nameFromProfiles ?? "匿名ユーザー";

      return {
        ...c,
        username: name,
        like_count: likeCountMap[String(c.id)] ?? 0,
        has_liked: likedByMe.has(String(c.id)),
        replies: repliesByComment[String(c.id)] ?? [],
      };
    });

    setComments(normalizedComments);
  }, [id, currentUser]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleLike = async () => {
    if (!currentUser) {
      alert("いいね機能を使うには、ログインが必要です。");
      return;
    }
    if (!deal || liking || disliking) return;

    const wasLiked = !!deal.has_liked;
    const wasDisliked = !!deal.has_disliked;

    setLiking(true);

    setDeal((p) =>
      p
        ? {
            ...p,
            has_liked: !wasLiked,
            has_disliked: wasLiked ? p.has_disliked : false,
            likes_count: Math.max(
              0,
              Number(p.likes_count ?? 0) + (wasLiked ? -1 : 1)
            ),
            dislikes_count:
              !wasLiked && wasDisliked
                ? Math.max(0, Number(p.dislikes_count ?? 0) - 1)
                : Number(p.dislikes_count ?? 0),
          }
        : p
    );

    try {
      if (wasLiked) {
        const { error } = await supabase
          .from("deal_likes")
          .delete()
          .eq("deal_id", deal.id)
          .eq("user_id", currentUser.id);

        if (error) {
          console.error("unlike error:", error);
          const refreshed = await attachHasLikedAndSaved([deal]);
          setDeal(refreshed[0] ?? deal);
          return;
        }
      } else {
        if (wasDisliked) {
          const { error: removeDislikeError } = await supabase
            .from("deal_dislikes")
            .delete()
            .eq("deal_id", deal.id)
            .eq("user_id", currentUser.id);

          if (removeDislikeError) {
            console.error("remove dislike before like error:", removeDislikeError);
            const refreshed = await attachHasLikedAndSaved([deal]);
            setDeal(refreshed[0] ?? deal);
            return;
          }
        }

        const res = await likeDeal({
          dealId: deal.id,
          userId: currentUser.id,
        });

        if (!res.ok) {
          console.error("likeDeal error:", res.error);
          const refreshed = await attachHasLikedAndSaved([deal]);
          setDeal(refreshed[0] ?? deal);
          return;
        }
      }

      const refreshed = await attachHasLikedAndSaved([deal]);
      setDeal(refreshed[0] ?? deal);
      await loadSide();
    } finally {
      setLiking(false);
    }
  };

  const handleSidebarLike = async (dealId: string) => {
    if (!currentUser) {
      alert("いいね機能を使うには、ログインが必要です。");
      return;
    }

    const sidebarDeal =
      popular.find((item) => item.id === dealId) ??
      trending.find((item) => item.id === dealId);

    if (!sidebarDeal) return;

    const wasLiked = sidebarDeal.isLiked === true;

    const patchSidebarState = (items: SidebarDeal[]) =>
      items.map((item) =>
        item.id === dealId
          ? {
              ...item,
              isLiked: !wasLiked,
              likes: Math.max(0, Number(item.likes ?? 0) + (wasLiked ? -1 : 1)),
            }
          : item
      );

    setPopular(patchSidebarState);
    setTrending(patchSidebarState);
    setEndingSoon(patchSidebarState);

    try {
      if (wasLiked) {
        const { error } = await supabase
          .from("deal_likes")
          .delete()
          .eq("deal_id", dealId)
          .eq("user_id", currentUser.id);

        if (error) {
          console.error("sidebar unlike error:", error);
          await loadSide();
          return;
        }
      } else {
        const res = await likeDeal({
          dealId,
          userId: currentUser.id,
        });

        if (!res.ok) {
          console.error("sidebar like error:", res.error);
          await loadSide();
          return;
        }
      }

      if (deal?.id === dealId) {
        const refreshed = await attachHasLikedAndSaved([deal]);
        setDeal(refreshed[0] ?? deal);
      }

      await loadSide();
    } catch (error) {
      console.error("sidebar like error:", error);
      await loadSide();
    }
  };

  const handleSidebarShare = async (dealId: string) => {
    if (typeof window === "undefined") return;

    const sidebarDeal =
      popular.find((item) => item.id === dealId) ??
      trending.find((item) => item.id === dealId);

    const url = `${window.location.origin}/deals/${dealId}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: sidebarDeal?.title || "トクミッケ",
          url,
        });
        return;
      }

      await navigator.clipboard.writeText(url);
      window.alert("リンクをコピーしました。");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("sidebar share error:", error);
    }
  };

  const handleSave = async () => {
    if (!currentUser) {
      alert("保存機能を使うには、ログインが必要です。");
      return;
    }
    if (!deal || saving) return;

    const wasSaved = !!deal.has_saved;

    setSaving(true);
    setDeal((p) => (p ? { ...p, has_saved: !wasSaved } : p));

    try {
      if (wasSaved) {
        const { error } = await supabase
          .from("deal_saves")
          .delete()
          .eq("deal_id", deal.id)
          .eq("user_id", currentUser.id);

        if (error) {
          console.error("unsave error:", error);
          setDeal((p) => (p ? { ...p, has_saved: true } : p));
          return;
        }
      } else {
        const res = await saveDeal({
          dealId: deal.id,
          userId: currentUser.id,
        });

        if (!res.ok) {
          console.error("saveDeal error:", res.error);
          setDeal((p) => (p ? { ...p, has_saved: false } : p));
          return;
        }
      }

      await loadSide();
    } finally {
      setSaving(false);
    }
  };

  const handleBadDeal = async () => {
    if (!currentUser) {
      alert("「イマイチ」に投票するには、ログインが必要です。");
      return;
    }
    if (!deal || liking || disliking) return;

    const wasDisliked = !!deal.has_disliked;
    const wasLiked = !!deal.has_liked;

    setDisliking(true);

    setDeal((p) =>
      p
        ? {
            ...p,
            has_disliked: !wasDisliked,
            has_liked: wasDisliked ? p.has_liked : false,
            dislikes_count: Math.max(
              0,
              Number(p.dislikes_count ?? 0) + (wasDisliked ? -1 : 1)
            ),
            likes_count:
              !wasDisliked && wasLiked
                ? Math.max(0, Number(p.likes_count ?? 0) - 1)
                : Number(p.likes_count ?? 0),
          }
        : p
    );

    try {
      if (wasDisliked) {
        const { error } = await supabase
          .from("deal_dislikes")
          .delete()
          .eq("deal_id", deal.id)
          .eq("user_id", currentUser.id);

        if (error) {
          console.error("remove Bad Deal error:", error);
          const refreshed = await attachHasLikedAndSaved([deal]);
          setDeal(refreshed[0] ?? deal);
          return;
        }
      } else {
        if (wasLiked) {
          const { error: removeLikeError } = await supabase
            .from("deal_likes")
            .delete()
            .eq("deal_id", deal.id)
            .eq("user_id", currentUser.id);

          if (removeLikeError) {
            console.error("remove like before Bad Deal error:", removeLikeError);
            const refreshed = await attachHasLikedAndSaved([deal]);
            setDeal(refreshed[0] ?? deal);
            return;
          }
        }

        const { error } = await supabase.from("deal_dislikes").insert({
          deal_id: deal.id,
          user_id: currentUser.id,
        });

        if (error && (error as any).code !== "23505") {
          console.error("Bad Deal insert error:", error);
          const refreshed = await attachHasLikedAndSaved([deal]);
          setDeal(refreshed[0] ?? deal);
          return;
        }
      }

      const refreshed = await attachHasLikedAndSaved([deal]);
      setDeal(refreshed[0] ?? deal);
      await loadSide();
    } finally {
      setDisliking(false);
    }
  };

  const handleShare = async () => {
    if (typeof window === "undefined") return;

    const shareUrl = window.location.href;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = shareUrl;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setShareCopied(true);

      if (shareToastTimerRef.current) {
        clearTimeout(shareToastTimerRef.current);
      }

      shareToastTimerRef.current = setTimeout(() => {
        setShareCopied(false);
        shareToastTimerRef.current = null;
      }, 2200);
    } catch (e) {
      console.warn("copy link failed:", e);
    }
  };

  const handleCommentsClick = () => {
    const target = isMobile
      ? mobileCommentsRef.current
      : desktopCommentsRef.current;

    target?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleCommentLike = async (commentId: string) => {
    if (!currentUser) {
      alert("コメントにいいねするには、ログインが必要です。");
      return;
    }

    const target = comments.find((c) => c.id === commentId);
    if (!target || commentLikingId === commentId) return;

    const wasLiked = !!target.has_liked;
    setCommentLikingId(commentId);

    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? {
              ...c,
              has_liked: !wasLiked,
              like_count: Math.max(
                0,
                Number(c.like_count ?? 0) + (wasLiked ? -1 : 1)
              ),
            }
          : c
      )
    );

    try {
      if (wasLiked) {
        const { error } = await supabase
          .from("deal_comment_likes")
          .delete()
          .eq("comment_id", commentId)
          .eq("user_id", currentUser.id);

        if (error) {
          console.error("delete comment like error:", error);
          await loadComments();
        }
      } else {
        const { error } = await supabase.from("deal_comment_likes").insert({
          comment_id: commentId,
          user_id: currentUser.id,
        });

        if (error && (error as any).code !== "23505") {
          console.error("insert comment like error:", error);
          await loadComments();
        }
      }
    } finally {
      setCommentLikingId(null);
    }
  };

  const handleReplyLike = async (replyId: string) => {
    if (!currentUser) {
      alert("返信にいいねするには、ログインが必要です。");
      return;
    }

    const targetReply = comments
      .flatMap((comment) => comment.replies ?? [])
      .find((reply) => reply.id === replyId);

    if (!targetReply || replyLikingId === replyId) return;

    const wasLiked = !!targetReply.has_liked;
    setReplyLikingId(replyId);

    setComments((prev) =>
      prev.map((comment) => ({
        ...comment,
        replies: (comment.replies ?? []).map((reply) =>
          reply.id === replyId
            ? {
                ...reply,
                has_liked: !wasLiked,
                like_count: Math.max(
                  0,
                  Number(reply.like_count ?? 0) + (wasLiked ? -1 : 1)
                ),
              }
            : reply
        ),
      }))
    );

    try {
      if (wasLiked) {
        const { error } = await supabase
          .from("deal_comment_reply_likes")
          .delete()
          .eq("reply_id", replyId)
          .eq("user_id", currentUser.id);

        if (error) {
          console.error("delete reply like error:", error);
          await loadComments();
        }
      } else {
        const { error } = await supabase
          .from("deal_comment_reply_likes")
          .insert({
            reply_id: replyId,
            user_id: currentUser.id,
          });

        if (error && (error as any).code !== "23505") {
          console.error("insert reply like error:", error);
          await loadComments();
        }
      }
    } finally {
      setReplyLikingId(null);
    }
  };

  const handleThreadToggle = (commentId: string) => {
    setExpandedReplyThreads((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  const handleReplyToReply = (
    commentId: string,
    _replyUsername?: string | null
  ) => {
    if (!currentUser) {
      alert("返信するには、ログインが必要です。");
      return;
    }

    setReplyOpenMap((prev) => ({
      ...prev,
      [commentId]: true,
    }));

    setReplyDrafts((prev) => ({
      ...prev,
      [commentId]: prev[commentId] ?? "",
    }));
  };

  const handleReplyToggle = (commentId: string) => {
    setReplyOpenMap((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  const handleReplyDraftChange = (commentId: string, value: string) => {
    setReplyDrafts((prev) => ({
      ...prev,
      [commentId]: value,
    }));
  };

  const handleReplySubmit = async (commentId: string) => {
    if (!currentUser) {
      alert("返信するには、ログインが必要です。");
      return;
    }

    const body = (replyDrafts[commentId] ?? "").trim();
    if (!body) return;

    setReplySubmittingId(commentId);

    try {
      const { error } = await supabase.from("deal_comment_replies").insert({
        comment_id: commentId,
        user_id: currentUser.id,
        body,
      });

      if (error) {
        console.error("insert reply error:", error);
        return;
      }

      setReplyDrafts((prev) => ({
        ...prev,
        [commentId]: "",
      }));
      setReplyOpenMap((prev) => ({
        ...prev,
        [commentId]: false,
      }));

      await loadComments();
    } finally {
      setReplySubmittingId(null);
    }
  };

  async function handleSubmitComment(e: React.FormEvent) {
    e.preventDefault();
    setCommentError(null);

    if (commentLoading) return;

    if (!currentUser) {
      setCommentError("コメントするにはログインが必要です。");
      return;
    }

    const body = commentBody.trim();
    if (!body) {
      setCommentError("コメントを入力してください。");
      return;
    }

    const prevCount = Number(deal?.comments_count ?? 0);

    try {
      setCommentLoading(true);

      const { data, error } = await supabase
        .from("deal_comments")
        .insert({
          deal_id: id,
          user_id: currentUser.id,
          body,
        })
        .select("id, created_at, body, user_id")
        .single();

      if (error) {
        console.error("insert comment error:", error);
        setCommentError("コメントの投稿に失敗しました。");
        return;
      }

      setCommentBody("");
      setMobileCommentComposer(null);
      setDesktopCommentComposer(null);

      setDeal((p) =>
        p ? { ...p, comments_count: Number(p.comments_count ?? 0) + 1 } : p
      );

      const { data: countRow, error: countErr } = await supabase
        .from("deals")
        .select("comments_count")
        .eq("id", id)
        .maybeSingle();

      if (!countErr && countRow && typeof (countRow as any).comments_count === "number") {
        setDeal((p) =>
          p ? { ...p, comments_count: (countRow as any).comments_count } : p
        );
      } else if (countErr) {
        setDeal((p) => (p ? { ...p, comments_count: prevCount } : p));
      }

      await loadSide();
      await loadComments();
    } finally {
      setCommentLoading(false);
    }
  }

  const renderCommunityVoting = (mobile = false) => {
    if (!deal) return null;

    const score =
      Number(deal.likes_count ?? 0) - Number(deal.dislikes_count ?? 0);
    const scoreLabel = score > 0 ? `+${score}` : String(score);

    return (
      <section
        className={
          mobile
            ? "mt-4 bg-white px-4 py-5 shadow-sm"
            : `mt-6 ${sectionCard}`
        }
      >
        <h2
          className={
            mobile
              ? "text-[20px] font-bold text-slate-950"
              : "text-[24px] font-bold text-slate-950"
          }
        >
          コミュニティ投票
        </h2>

        <div
          className={
            mobile
              ? "mt-4 flex flex-wrap items-center gap-3"
              : "mt-5 flex flex-wrap items-center gap-5"
          }
        >
          <div className="inline-flex overflow-hidden rounded-lg border border-amber-200 bg-amber-50">
            <div className="flex items-center bg-amber-100 px-3 py-2 text-center text-[11px] font-semibold leading-tight text-amber-900">
              Deal
              <br />
              Score
            </div>
            <div className="flex min-w-[58px] items-center justify-center px-3 text-[20px] font-bold text-slate-800">
              {scoreLabel}
            </div>
          </div>

          <button
            type="button"
            onClick={handleLike}
            disabled={liking}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full text-slate-800 disabled:cursor-wait disabled:opacity-60"
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 bg-white">
              <ThumbsUp
                className="h-6 w-6 text-[#006888]"
                fill={deal.has_liked ? "currentColor" : "none"}
              />
            </span>
            <span className="text-[14px] font-medium">おトク！</span>
          </button>

          <button
            type="button"
            onClick={handleBadDeal}
            disabled={disliking}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full text-slate-800 disabled:cursor-wait disabled:opacity-60"
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 bg-white">
              <ThumbsDown
                className="h-6 w-6 text-orange-500"
                fill={deal.has_disliked ? "currentColor" : "none"}
              />
            </span>
            <span className="text-[14px] font-medium">イマイチ</span>
          </button>

          {deal.deal_url ? (
            <a
              href={deal.deal_url}
              target="_blank"
              rel="noopener noreferrer"
              className={
                mobile
                  ? "inline-flex w-full cursor-pointer items-center justify-center rounded-full bg-[#006888] px-5 py-3 text-[16px] font-semibold text-white"
                  : "ml-auto inline-flex cursor-pointer items-center justify-center rounded-full bg-[#006888] px-6 py-3 text-[15px] font-semibold text-white hover:bg-[#00546d]"
              }
            >
              商品ページを見る
            </a>
          ) : null}
        </div>
      </section>
    );
  };

  type DiscussionItem =
    | {
        kind: "comment";
        id: string;
        created_at: string;
        body: string;
        username?: string | null;
        user_id: string | null;
        like_count?: number;
        has_liked?: boolean;
        comment: CommentRow;
      }
    | {
        kind: "reply";
        id: string;
        created_at: string;
        body: string;
        username?: string | null;
        user_id: string | null;
        like_count?: number;
        has_liked?: boolean;
        reply: ReplyRow;
        parent: CommentRow;
      };

  const totalDiscussionCount = useMemo(
    () =>
      comments.reduce(
        (total, comment) => total + 1 + (comment.replies?.length ?? 0),
        0
      ),
    [comments]
  );

  const visibleDiscussionItems = useMemo<DiscussionItem[]>(() => {
    const query = commentSearch.trim().toLowerCase();

    const items: DiscussionItem[] = [];

    comments.forEach((comment) => {
      items.push({
        kind: "comment",
        id: comment.id,
        created_at: comment.created_at,
        body: comment.body,
        username: comment.username,
        user_id: comment.user_id,
        like_count: comment.like_count,
        has_liked: comment.has_liked,
        comment,
      });

      (comment.replies ?? []).forEach((reply) => {
        items.push({
          kind: "reply",
          id: reply.id,
          created_at: reply.created_at,
          body: reply.body,
          username: reply.username,
          user_id: reply.user_id,
          like_count: reply.like_count,
          has_liked: reply.has_liked,
          reply,
          parent: comment,
        });
      });
    });

    const filtered = query
      ? items.filter((item) => {
          const username = (item.username ?? "").toLowerCase();
          const body = item.body.toLowerCase();

          if (item.kind === "reply") {
            const parentUsername = (item.parent.username ?? "").toLowerCase();
            const parentBody = item.parent.body.toLowerCase();

            return (
              username.includes(query) ||
              body.includes(query) ||
              parentUsername.includes(query) ||
              parentBody.includes(query)
            );
          }

          return username.includes(query) || body.includes(query);
        })
      : items;

    filtered.sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();

      if (commentSort === "popular") {
        const likeDifference =
          Number(b.like_count ?? 0) - Number(a.like_count ?? 0);

        if (likeDifference !== 0) {
          return likeDifference;
        }

        return bTime - aTime;
      }

      return commentSort === "oldest"
        ? aTime - bTime
        : bTime - aTime;
    });

    return filtered;
  }, [comments, commentSearch, commentSort]);

  const COMMENTS_PER_PAGE = 15;

  const commentTotalPages = Math.max(
    1,
    Math.ceil(visibleDiscussionItems.length / COMMENTS_PER_PAGE)
  );

  const paginatedDiscussionItems = useMemo(() => {
    const start = (commentPage - 1) * COMMENTS_PER_PAGE;
    return visibleDiscussionItems.slice(start, start + COMMENTS_PER_PAGE);
  }, [visibleDiscussionItems, commentPage]);

  useEffect(() => {
    setCommentPage(1);
  }, [commentSearch, commentSort, id]);

  useEffect(() => {
    if (commentPage > commentTotalPages) {
      setCommentPage(commentTotalPages);
    }
  }, [commentPage, commentTotalPages]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (comments.length === 0) return;

    const hash = window.location.hash;
    if (!hash.startsWith("#comment-")) return;

    const targetCommentId = decodeURIComponent(hash.slice("#comment-".length));
    if (!targetCommentId) return;

    const targetIndex = visibleDiscussionItems.findIndex(
      (item) =>
        (item.kind === "comment" && item.comment.id === targetCommentId) ||
        (item.kind === "reply" && item.parent.id === targetCommentId)
    );

    if (targetIndex < 0) return;

    const targetPage = Math.floor(targetIndex / COMMENTS_PER_PAGE) + 1;

    setExpandedReplyThreads((prev) =>
      prev[targetCommentId]
        ? prev
        : {
            ...prev,
            [targetCommentId]: true,
          }
    );

    if (commentPage !== targetPage) {
      setCommentPage(targetPage);
      return;
    }

    const scrollToTarget = () => {
      const target = document.getElementById(`comment-${targetCommentId}`);
      if (!target) return false;

      target.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      return true;
    };

    if (scrollToTarget()) return;

    const frameId = window.requestAnimationFrame(() => {
      scrollToTarget();
    });

    const timeoutId = window.setTimeout(() => {
      scrollToTarget();
    }, 150);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [comments, visibleDiscussionItems, commentPage]);

  const goToCommentPage = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), commentTotalPages);
    setCommentPage(nextPage);

    window.requestAnimationFrame(() => {
      const target = isMobile
        ? mobileCommentsRef.current
        : desktopCommentsRef.current;

      target?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const renderCommentPagination = (mobile = false) => {
    if (commentTotalPages <= 1) return null;

    const pageNumbers: number[] = [];
    const maxVisible = mobile ? 3 : 5;

    let startPage = Math.max(
      1,
      commentPage - Math.floor(maxVisible / 2)
    );
    let endPage = Math.min(
      commentTotalPages,
      startPage + maxVisible - 1
    );

    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let page = startPage; page <= endPage; page += 1) {
      pageNumbers.push(page);
    }

    const circleClass = mobile ? "h-9 w-9" : "h-10 w-10";
    const iconClass = mobile ? "h-4 w-4" : "h-5 w-5";

    return (
      <nav
        className={
          mobile
            ? "mt-5 flex items-center justify-center gap-1.5 border-t border-slate-200 pt-5"
            : "mt-6 flex items-center justify-center gap-2 border-t border-slate-200 pt-6"
        }
        aria-label="コメントのページ切り替え"
      >
        <button
          type="button"
          onClick={() => goToCommentPage(1)}
          disabled={commentPage === 1}
          className={`inline-flex ${circleClass} cursor-pointer items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:cursor-default disabled:bg-slate-50 disabled:text-slate-300`}
          aria-label="最初のページ"
        >
          <ChevronsLeft className={iconClass} />
        </button>

        <button
          type="button"
          onClick={() => goToCommentPage(commentPage - 1)}
          disabled={commentPage === 1}
          className={`inline-flex ${circleClass} cursor-pointer items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:cursor-default disabled:bg-slate-50 disabled:text-slate-300`}
          aria-label="前のページ"
        >
          <ChevronLeft className={iconClass} />
        </button>

        {pageNumbers.map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => goToCommentPage(page)}
            className={`inline-flex ${circleClass} cursor-pointer items-center justify-center rounded-full text-[14px] font-semibold ${
              page === commentPage
                ? "bg-[#006888] text-white"
                : "text-[#006888] hover:bg-[#eef7f9]"
            }`}
            aria-current={page === commentPage ? "page" : undefined}
          >
            {page}
          </button>
        ))}

        <button
          type="button"
          onClick={() => goToCommentPage(commentPage + 1)}
          disabled={commentPage === commentTotalPages}
          className={`inline-flex ${circleClass} cursor-pointer items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:cursor-default disabled:bg-slate-50 disabled:text-slate-300`}
          aria-label="次のページ"
        >
          <ChevronRight className={iconClass} />
        </button>

        <button
          type="button"
          onClick={() => goToCommentPage(commentTotalPages)}
          disabled={commentPage === commentTotalPages}
          className={`inline-flex ${circleClass} cursor-pointer items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:cursor-default disabled:bg-slate-50 disabled:text-slate-300`}
          aria-label="最後のページ"
        >
          <ChevronsRight className={iconClass} />
        </button>
      </nav>
    );
  };

  const renderCommentControls = (mobile = false) => {
    if (totalDiscussionCount === 0) return null;

    return (
    <div
      className={
        mobile
          ? "mb-4 space-y-3"
          : "mb-5 flex items-center justify-between gap-4"
      }
    >
      <div
        className={
          mobile
            ? "flex items-center justify-between gap-3"
            : "flex min-w-0 flex-1 items-center gap-4"
        }
      >
        <h4
          className={
            mobile
              ? "text-[18px] font-semibold text-slate-900"
              : "shrink-0 text-[24px] font-bold text-slate-950"
          }
        >
          {totalDiscussionCount} 件のコメント
        </h4>

        <select
          value={commentSort}
          onChange={(e) =>
            setCommentSort(e.target.value as "oldest" | "newest" | "popular")
          }
          className={
            mobile
              ? "h-10 rounded-full border border-slate-300 bg-white px-4 text-[13px] text-slate-700 focus:outline-none"
              : "order-3 h-10 min-w-[130px] rounded-full border border-slate-300 bg-white px-4 text-[13px] text-slate-700 focus:outline-none"
          }
        >
          <option value="oldest">古い順</option>
          <option value="newest">新しい順</option>
          <option value="popular">人気順</option>
        </select>

        {!mobile ? (
          <label className="order-2 flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-slate-300 bg-white px-4">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="search"
              value={commentSearch}
              onChange={(e) => setCommentSearch(e.target.value)}
              placeholder="コメントを検索"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
          </label>
        ) : null}
      </div>

      {mobile ? (
        <label className="flex h-10 items-center gap-2 rounded-full border border-slate-300 bg-white px-4">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            type="search"
            value={commentSearch}
            onChange={(e) => setCommentSearch(e.target.value)}
            placeholder="コメントを検索"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        </label>
      ) : null}
    </div>
    );
  };

  const renderReplyComposer = (
    commentId: string,
    mobile = false
  ) => {
    if (!replyOpenMap[commentId]) return null;

    return (
      <div className={mobile ? "mt-4 pl-12" : "mt-4 pl-[52px]"}>
        <textarea
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#001e43] focus:outline-none focus:ring-1 focus:ring-[#001e43]"
          rows={2}
          placeholder="返信を書く"
          value={replyDrafts[commentId] ?? ""}
          onChange={(e) =>
            handleReplyDraftChange(commentId, e.target.value)
          }
          disabled={!currentUser || replySubmittingId === commentId}
        />

        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => handleReplyToggle(commentId)}
            className="cursor-pointer rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            キャンセル
          </button>

          <button
            type="button"
            onClick={() => handleReplySubmit(commentId)}
            disabled={
              !currentUser ||
              replySubmittingId === commentId ||
              !(replyDrafts[commentId] ?? "").trim()
            }
            className="cursor-pointer rounded-full bg-[#001e43] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#002b66] disabled:cursor-wait disabled:opacity-60"
          >
            {replySubmittingId === commentId ? "送信中..." : "返信する"}
          </button>
        </div>
      </div>
    );
  };

  const renderNestedReply = (
    reply: ReplyRow,
    parent: CommentRow,
    mobile = false
  ) => (
    <div
      key={`thread-${reply.id}`}
      className={mobile ? "py-3" : "py-3"}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <CommentAvatar
            userId={reply.user_id}
            username={reply.username}
            size="small"
          />
          <div className="truncate text-[13px] font-semibold text-slate-800">
            {reply.username ?? "匿名ユーザー"}
          </div>
        </div>

        <div className="shrink-0 pt-1 text-[11px] text-slate-400">
          {fmtCommentDateTime(reply.created_at)}
        </div>
      </div>

      <p className="mt-1 whitespace-pre-wrap pl-10 text-[14px] leading-6 text-slate-800">
        {reply.body}
      </p>

      <div className="mt-2 flex items-center gap-2 pl-10">
        <button
          type="button"
          onClick={() => handleReplyLike(reply.id)}
          disabled={replyLikingId === reply.id}
          title={
            reply.has_liked
              ? "クリックしていいねを取り消す"
              : "いいね"
          }
          className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1 text-[12px] ${
            reply.has_liked
              ? "border-[#b8d9e2] bg-[#eef7f9] text-[#006888]"
              : "border-slate-300 text-slate-700 hover:bg-slate-50"
          } disabled:cursor-wait disabled:opacity-60`}
        >
          <ThumbsUp
            className="h-3.5 w-3.5"
            fill={reply.has_liked ? "currentColor" : "none"}
          />
          {Number(reply.like_count ?? 0)}
        </button>

        <button
          type="button"
          onClick={() =>
            handleReplyToReply(parent.id, reply.username)
          }
          className="cursor-pointer rounded-full border border-slate-300 px-3 py-1 text-[12px] text-slate-700 hover:bg-slate-50"
        >
          返信
        </button>
      </div>
    </div>
  );

  const renderCommentList = (mobile = false) => {
    if (totalDiscussionCount === 0) {
      return (
        <p className="mb-4 text-sm text-slate-500">
          {currentUser
            ? "まだコメントはありません。最初のコメントを書いてみましょう！"
            : "まだコメントはありません。ログインして最初のコメントを投稿してみましょう！"}
        </p>
      );
    }

    if (visibleDiscussionItems.length === 0) {
      return (
        <p className="mb-4 text-sm text-slate-500">
          検索条件に一致するコメントはありません。
        </p>
      );
    }

    return (
      <ul className={mobile ? "mb-6" : "mb-2"}>
        {paginatedDiscussionItems.map((item, idx) => {
          const rowClass =
            idx === 0
              ? mobile
                ? "pb-5"
                : "pb-6"
              : mobile
                ? "border-t border-slate-200 py-5"
                : "border-t border-slate-200 py-6";

          if (item.kind === "reply") {
            const reply = item.reply;
            const parent = item.parent;

            return (
              <li key={`reply-${reply.id}`} className={rowClass}>
                <div className="mb-2 flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <CommentAvatar
                      userId={reply.user_id}
                      username={reply.username}
                      size="normal"
                    />
                    <div className="min-w-0 text-[15px] font-semibold text-slate-800">
                      {reply.username ?? "匿名ユーザー"}
                    </div>
                  </div>

                  <div className="shrink-0 pt-1 text-right text-[12px] text-slate-500">
                    {fmtCommentDateTime(reply.created_at)}
                  </div>
                </div>

                <div
                  className={
                    mobile
                      ? "ml-12 rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-700"
                      : "ml-[52px] rounded-lg bg-slate-50 px-4 py-3 text-[13px] text-slate-700"
                  }
                >
                  <div className="mb-1 font-semibold">
                    {parent.username ?? "匿名ユーザー"}さんへの返信
                  </div>
                  <div className="line-clamp-3 whitespace-pre-wrap">
                    {parent.body}
                  </div>
                </div>

                <p
                  className={
                    mobile
                      ? "mt-3 whitespace-pre-wrap pl-12 text-[15px] leading-6 text-slate-900"
                      : "mt-3 whitespace-pre-wrap pl-[52px] text-[15px] leading-7 text-slate-800"
                  }
                >
                  {reply.body}
                </p>

                <div
                  className={
                    mobile
                      ? "mt-3 flex items-center gap-2 pl-12"
                      : "mt-4 flex items-center gap-3 pl-[52px]"
                  }
                >
                  <button
                    type="button"
                    onClick={() => handleReplyLike(reply.id)}
                    disabled={replyLikingId === reply.id}
                    title={
                      reply.has_liked
                        ? "クリックしていいねを取り消す"
                        : "いいね"
                    }
                    className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] ${
                      reply.has_liked
                        ? "border-[#b8d9e2] bg-[#eef7f9] text-[#006888]"
                        : "border-slate-300 text-slate-700 hover:bg-slate-50"
                    } disabled:cursor-wait disabled:opacity-60`}
                  >
                    <ThumbsUp
                      className="h-4 w-4"
                      fill={reply.has_liked ? "currentColor" : "none"}
                    />
                    {Number(reply.like_count ?? 0)}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleReplyToReply(parent.id, reply.username)
                    }
                    className="cursor-pointer rounded-full border border-slate-300 px-3 py-1.5 text-[13px] text-slate-700 hover:bg-slate-50"
                  >
                    返信
                  </button>
                </div>

                {renderReplyComposer(parent.id, mobile)}
              </li>
            );
          }

          const comment = item.comment;
          const replyCount = comment.replies?.length ?? 0;
          const threadExpanded = !!expandedReplyThreads[comment.id];

          return (
            <li
              key={`comment-${comment.id}`}
              id={`comment-${comment.id}`}
              className={`${rowClass} scroll-mt-24`}
            >
              <div className="mb-2 flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <CommentAvatar
                    userId={comment.user_id}
                    username={comment.username}
                    size="normal"
                  />
                  <div className="min-w-0 text-[15px] font-semibold text-slate-800">
                    {comment.username ?? "匿名ユーザー"}
                  </div>
                </div>

                <div className="shrink-0 pt-1 text-right text-[12px] text-slate-500">
                  {fmtCommentDateTime(comment.created_at)}
                </div>
              </div>

              <p
                className={
                  mobile
                    ? "whitespace-pre-wrap pl-12 text-[15px] leading-6 text-slate-900"
                    : "whitespace-pre-wrap pl-[52px] text-[15px] leading-7 text-slate-800"
                }
              >
                {comment.body}
              </p>

              <div
                className={
                  mobile
                    ? "mt-3 flex items-center gap-2 pl-12"
                    : "mt-4 flex items-center gap-3 pl-[52px]"
                }
              >
                <button
                  type="button"
                  onClick={() => handleCommentLike(comment.id)}
                  disabled={!currentUser || commentLikingId === comment.id}
                  title={
                    comment.has_liked
                      ? "クリックしていいねを取り消す"
                      : "いいね"
                  }
                  className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] ${
                    comment.has_liked
                      ? "border-[#b8d9e2] bg-[#eef7f9] text-[#006888]"
                      : "border-slate-300 text-slate-700 hover:bg-slate-50"
                  } disabled:cursor-wait disabled:opacity-60`}
                >
                  <ThumbsUp
                    className="h-4 w-4"
                    fill={comment.has_liked ? "currentColor" : "none"}
                  />
                  {Number(comment.like_count ?? 0)}
                </button>

                <button
                  type="button"
                  onClick={() => handleReplyToggle(comment.id)}
                  className="cursor-pointer rounded-full border border-slate-300 px-3 py-1.5 text-[13px] text-slate-700 hover:bg-slate-50"
                >
                  返信
                </button>
              </div>

              {replyCount > 0 ? (
                <button
                  type="button"
                  onClick={() => handleThreadToggle(comment.id)}
                  className={
                    mobile
                      ? "mt-3 ml-12 cursor-pointer text-[13px] font-medium text-[#006888]"
                      : "mt-3 ml-[52px] cursor-pointer text-[13px] font-medium text-[#006888]"
                  }
                >
                  {replyCount}件の返信 {threadExpanded ? "▲" : "▼"}
                </button>
              ) : null}

              {threadExpanded && replyCount > 0 ? (
                <div
                  className={
                    mobile
                      ? "mt-3 ml-12 border-l-2 border-slate-200 pl-3"
                      : "mt-3 ml-[52px] border-l-2 border-slate-200 pl-4"
                  }
                >
                  {(comment.replies ?? []).map((reply) =>
                    renderNestedReply(reply, comment, mobile)
                  )}
                </div>
              ) : null}

              {renderReplyComposer(comment.id, mobile)}
            </li>
          );
        })}
      </ul>
    );
  };

  const renderCommentLoginPrompt = () => (
    <div className="mt-3 flex flex-col gap-3 rounded-xl border border-[#b8d9e2] bg-[#eef7f9] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[13px] leading-5 text-slate-700">
        コメントするにはログインが必要です。
      </p>
      <Link
        href="/auth"
        className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#006888] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#00546d]"
      >
        ログイン / 新規登録
      </Link>
    </div>
  );

  const openMobileCommentComposer = (position: "top" | "bottom") => {
    if (!currentUser) {
      setCommentError("コメントするにはログインが必要です。");
      return;
    }

    setCommentError(null);
    setMobileCommentComposer(position);

    window.setTimeout(() => {
      mobileCommentInputRef.current?.focus();
    }, 0);
  };

  const renderMobileCommentComposer = (position: "top" | "bottom") => {
    const isOpen = mobileCommentComposer === position;

    if (!isOpen) {
      return (
        <div>
          <button
            type="button"
            onClick={() => openMobileCommentComposer(position)}
            className="inline-flex w-full cursor-pointer items-center justify-center rounded-full border border-[#006888] bg-white px-5 py-2.5 text-[15px] font-semibold text-[#006888] hover:bg-[#eef7f9]"
          >
            <span className="mr-2 text-[22px] leading-none">＋</span>
            コメントを追加
          </button>

          {!currentUser && commentError ? renderCommentLoginPrompt() : null}
        </div>
      );
    }

    return (
      <form onSubmit={handleSubmitComment} className="space-y-3">
        {commentError ? (
          <div className="rounded border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-700">
            {commentError}
          </div>
        ) : null}

        <div className="rounded-[24px] border border-slate-300 bg-white px-4 py-3 shadow-sm focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-200">
          <textarea
            ref={mobileCommentInputRef}
            className="min-h-[72px] w-full resize-none bg-transparent text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
            rows={3}
            placeholder="コメントを書く"
            value={commentBody}
            onChange={(e) => {
              setCommentBody(e.target.value);
              e.currentTarget.style.height = "auto";
              e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 220)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.stopPropagation();
              }
            }}
            disabled={!currentUser || commentLoading}
          />

          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setMobileCommentComposer(null);
                setCommentError(null);
              }}
              className="cursor-pointer rounded-full px-3 py-1.5 text-[13px] font-medium text-slate-500 hover:bg-slate-100"
            >
              キャンセル
            </button>

            <button
              type="submit"
              disabled={!currentUser || commentLoading || !commentBody.trim()}
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[#006888] text-[20px] font-semibold text-white hover:bg-[#00546d] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="コメントを投稿"
              title="コメントを投稿"
            >
              {commentLoading ? "…" : "↑"}
            </button>
          </div>
        </div>
      </form>
    );
  };

  const openDesktopCommentComposer = (position: "top" | "bottom") => {
    if (!currentUser) {
      setCommentError("コメントするにはログインが必要です。");
      return;
    }

    setCommentError(null);
    setDesktopCommentComposer(position);

    window.setTimeout(() => {
      desktopCommentInputRef.current?.focus();
    }, 0);
  };

  const renderDesktopCommentComposer = (position: "top" | "bottom") => {
    const isOpen = desktopCommentComposer === position;

    return (
      <div>
        {position === "top" ? (
          <div className="mb-4">
            <h2 className="text-[24px] font-bold text-slate-950">
              コメントに参加する
            </h2>
            <p className="mt-1 text-[14px] text-slate-600">
              トクミッケのみんなと情報を共有しましょう
            </p>
          </div>
        ) : (
          <div className="mb-4">
            <h3 className="text-[22px] font-bold text-slate-950">
              コメントに参加する
            </h3>
            <p className="mt-1 text-[14px] text-slate-600">
              トクミッケのみんなと情報を共有しましょう
            </p>
          </div>
        )}

        {!currentUser && commentError ? (
          <div className="mb-3">{renderCommentLoginPrompt()}</div>
        ) : commentError && isOpen ? (
          <div className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
            {commentError}
          </div>
        ) : null}

        {!isOpen ? (
          <button
            type="button"
            onClick={() => openDesktopCommentComposer(position)}
            className="flex h-[50px] w-full cursor-pointer items-center rounded-full border border-slate-400 bg-white px-5 text-left text-[14px] text-slate-600 shadow-sm transition hover:border-slate-500"
          >
            このディールについてコメントする
          </button>
        ) : (
          <form onSubmit={handleSubmitComment}>
            <div className="flex min-h-[50px] items-end gap-3 rounded-[25px] border border-slate-400 bg-white px-4 py-1 shadow-sm focus-within:border-slate-500">
              <textarea
                ref={desktopCommentInputRef}
                value={commentBody}
                onChange={(e) => {
                  setCommentBody(e.target.value);
                  e.currentTarget.style.height = "auto";
                  e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 180)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.stopPropagation();
                  }
                }}
                rows={1}
                placeholder="このディールについてコメントする"
                disabled={!currentUser || commentLoading}
                className="max-h-[180px] min-h-[24px] min-w-0 flex-1 resize-none overflow-y-auto bg-transparent py-1 text-[14px] leading-6 text-slate-900 placeholder:text-slate-500 focus:outline-none"
              />

              <button
                type="button"
                onClick={() => {
                  setDesktopCommentComposer(null);
                  setCommentError(null);
                }}
                className="cursor-pointer rounded-full px-2 py-1 text-[12px] font-medium text-slate-500 hover:bg-slate-100"
              >
                キャンセル
              </button>

              <button
                type="submit"
                disabled={!currentUser || commentLoading || !commentBody.trim()}
                className="inline-flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-full bg-[#006888] text-[22px] font-semibold text-white hover:bg-[#00546d] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="コメントを投稿"
                title="コメントを投稿"
              >
                {commentLoading ? "…" : "↑"}
              </button>
            </div>
          </form>
        )}
      </div>
    );
  };

  const renderCommentForm = (mobile = false) => {
    if (mobile) {
      return renderMobileCommentComposer("top");
    }

    return (
      <form onSubmit={handleSubmitComment} className="space-y-2">
        {commentError ? (
          <div className="rounded border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-700">
            {commentError}
          </div>
        ) : null}

        <textarea
          className="w-full rounded-lg border border-slate-300 px-4 py-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#001e43] focus:outline-none focus:ring-1 focus:ring-[#001e43]"
          rows={4}
          placeholder={
            currentUser
              ? "このディールについてコメントする"
              : "コメントするにはログインが必要です。右上の「ログイン」からログインしてください。"
          }
          value={commentBody}
          onChange={(e) => setCommentBody(e.target.value)}
          disabled={!currentUser || commentLoading}
        />

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={!currentUser || commentLoading}
            className="inline-flex cursor-pointer items-center justify-center rounded-full bg-[#006888] px-6 py-3 text-base font-semibold text-white hover:bg-[#00546d] disabled:opacity-60"
          >
            {commentLoading ? "送信中..." : "コメントを投稿"}
          </button>
        </div>
      </form>
    );
  };

  if (isMobile) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <ViewTracker
          dealId={id}
          enabled={!!deal && !loading && !errorMsg}
        />

        <main className="pb-28">
          {loading ? (
            <div className="px-4 py-6 text-sm text-slate-600">読み込み中…</div>
          ) : errorMsg ? (
            <div className="px-4 py-6 text-sm text-red-600">{errorMsg}</div>
          ) : !deal ? (
            <div className="px-4 py-6 text-sm text-slate-600">
              ディールが見つかりませんでした。
            </div>
          ) : (
            <>
              <div className="bg-white px-4 pt-3 pb-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="rounded bg-[#f5ecd1] px-2 py-[2px] text-[#7b6330]">
                    注目ディール
                  </span>
                  <span>{deal.author_username ?? "トクミッケ"}</span>
                  <span>·</span>
                  <span>{fmtShort(deal.created_at)}</span>
                </div>

                <div className="overflow-hidden rounded-lg bg-[#f6f6f6]">
                  <img
                    src={deal.image_url || PLACEHOLDER_IMG}
                    alt={deal.title ?? ""}
                    className="h-auto w-full object-cover"
                  />
                </div>

                <h1 className="mt-4 text-[17px] font-semibold leading-[1.38] text-slate-900">
                  {deal.title || "タイトル未設定"}
                </h1>

                <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2">
                  <div className="text-[26px] font-bold text-[#d70035]">
                    {yen(deal.price)}
                  </div>
                  {deal.orig_price ? (
                    <div className="text-[16px] text-slate-400 line-through">
                      {yen(deal.orig_price)}
                    </div>
                  ) : null}
                  {discountPercent ? (
                    <div className="text-[15px] font-semibold text-teal-700">
                      {discountPercent}% off
                    </div>
                  ) : null}
                  {deal.free_shipping ? <FreeShippingBadge compact /> : null}
                </div>

                {deal.market || deal.shop_name ? (
                  <div className="mt-2 flex items-center gap-2 text-[13px] text-slate-600">
                    {deal.market ? <MarketTag market={deal.market} /> : null}
                    {deal.shop_name ? (
                      <span className="truncate">{deal.shop_name}</span>
                    ) : null}
                  </div>
                ) : null}

                {deal.brand || expiryLabel ? (
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-600">
                    {deal.brand ? (
                      <span>
                        ブランド:{" "}
                        <span className="font-medium text-slate-800">
                          {deal.brand}
                        </span>
                      </span>
                    ) : null}
                    {expiryLabel ? (
                      <span
                        className={
                          isPastExpiry ? "font-semibold text-red-600" : ""
                        }
                      >
                        {isPastExpiry ? "終了日" : "セール終了日時"}: {expiryLabel}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <a
                  ref={mobilePrimaryCtaRef}
                  href={deal.deal_url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex w-full cursor-pointer items-center justify-center rounded-full bg-[#006888] px-4 py-3 text-[18px] font-semibold text-white"
                >
                  商品ページを見る
                </a>

                <div className="mt-5 flex items-start justify-between border-t border-slate-200 pt-4">
                  <div className="flex w-[76px] flex-none flex-col items-center gap-2 text-center text-slate-700">
                    <span className="inline-flex h-11 w-[76px] items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-white">
                      <button
                        type="button"
                        onClick={handleLike}
                        disabled={liking}
                        className="inline-flex h-full cursor-pointer items-center gap-1 px-2 disabled:cursor-wait disabled:opacity-60"
                        title={
                          !currentUser
                            ? "いいねするにはログインが必要です"
                            : deal.has_liked
                              ? "いいね済み"
                              : "いいね"
                        }
                      >
                        <ThumbsUp
                          className="h-5 w-5 text-[#006888]"
                          fill={deal.has_liked ? "currentColor" : "none"}
                        />
                        <span className="text-[14px] text-slate-700">
                          {Number(deal.likes_count ?? 0)}
                        </span>
                      </button>
                      <span className="h-5 w-px bg-slate-200" />
                      <button
                        type="button"
                        onClick={handleBadDeal}
                        disabled={disliking}
                        className="inline-flex h-full cursor-pointer items-center justify-center px-2 text-orange-500 disabled:cursor-wait disabled:opacity-60"
                        title={
                          deal.has_disliked
                            ? "クリックして「イマイチ」投票を取り消す"
                            : "イマイチ"
                        }
                        aria-label="イマイチ"
                      >
                        <ThumbsDown
                          className="h-5 w-5"
                          fill={deal.has_disliked ? "currentColor" : "none"}
                        />
                      </button>
                    </span>
                    <span className="text-center text-[12px]">おトク？</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCommentsClick}
                    className="flex w-[64px] flex-none cursor-pointer flex-col items-center gap-2 text-center text-slate-700"
                  >
                    <span className="inline-flex h-11 w-[60px] items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white px-2">
                      <MessageSquare className="h-5 w-5 text-slate-600" />
                      <span className="text-[14px] text-slate-700">
                        {totalDiscussionCount}
                      </span>
                    </span>
                    <span className="text-center text-[12px]">コメント</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex w-[52px] flex-none cursor-pointer flex-col items-center gap-2 text-center text-slate-700 disabled:cursor-wait disabled:opacity-60"
                  >
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white">
                      <Bookmark
                        className={`h-5 w-5 ${
                          deal.has_saved ? "text-[#006888]" : "text-slate-600"
                        }`}
                        fill={deal.has_saved ? "currentColor" : "none"}
                      />
                    </span>
                    <span className="text-center text-[12px]">保存</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShare}
                    className="flex w-[52px] flex-none cursor-pointer flex-col items-center gap-2 text-center text-slate-700"
                  >
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white">
                      <Forward className="h-5 w-5 text-slate-600" />
                    </span>
                    <span className="text-center text-[12px]">シェア</span>
                  </button>
                </div>
              </div>

              <div className="mt-4 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setOpenDealDetails((v) => !v)}
                  className="flex w-full cursor-pointer items-center justify-between px-4 py-5 text-left"
                >
                  <span className="text-[18px] font-semibold text-slate-900">
                    商品詳細
                  </span>
                  {openDealDetails ? (
                    <ChevronUp className="h-6 w-6 text-slate-700" />
                  ) : (
                    <ChevronDown className="h-6 w-6 text-slate-700" />
                  )}
                </button>

                {openDealDetails ? (
                  <div className="px-4 pb-5 text-[16px] leading-[1.8] text-slate-800">
                    {deal.item_description ? (
                      <div
                        className={`relative ${
                          productDetailsExpanded
                            ? ""
                            : "max-h-[240px] overflow-hidden"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{deal.item_description}</p>
                        {!productDetailsExpanded ? (
                          <button
                            type="button"
                            onClick={() => setProductDetailsExpanded(true)}
                            className="absolute inset-x-0 bottom-0 flex h-24 cursor-pointer items-end justify-center bg-gradient-to-b from-white/0 via-white/80 to-white pb-1 text-[15px] font-semibold text-[#006888]"
                          >
                            もっと見る
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-slate-500">
                        商品説明は登録されていません。
                      </p>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="mt-3 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setOpenPosterNote((v) => !v)}
                  className="flex w-full cursor-pointer items-center justify-between px-4 py-5 text-left"
                >
                  <span className="text-[18px] font-semibold text-slate-900">
                    投稿者メモ
                  </span>
                  {openPosterNote ? (
                    <ChevronUp className="h-6 w-6 text-slate-700" />
                  ) : (
                    <ChevronDown className="h-6 w-6 text-slate-700" />
                  )}
                </button>

                {openPosterNote ? (
                  <div className="px-4 pb-5 text-[16px] leading-[1.6] text-slate-800">
                    <ul className="list-disc pl-6">
                      <li>期間限定のディールです。在庫切れ前にご確認ください。</li>
                      <li>価格・送料・クーポン条件は遷移先で変わる場合があります。</li>
                      {deal.comment ? <li>{deal.comment}</li> : null}
                    </ul>
                  </div>
                ) : null}
              </div>

              <div className="mt-3 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setOpenProductInfo((v) => !v)}
                  className="flex w-full cursor-pointer items-center justify-between px-4 py-5 text-left"
                >
                  <span className="text-[18px] font-semibold text-slate-900">
                    製品情報
                  </span>
                  {openProductInfo ? (
                    <ChevronUp className="h-6 w-6 text-slate-700" />
                  ) : (
                    <ChevronDown className="h-6 w-6 text-slate-700" />
                  )}
                </button>

                {openProductInfo ? (
                  <div className="px-4 pb-5 text-[15px] leading-[1.6] text-slate-800">
                    <div className="grid grid-cols-[110px_1fr] gap-y-2">
                      <div className="text-slate-500">ショップ</div>
                      <div>{deal.shop_name || "未設定"}</div>

                      <div className="text-slate-500">マーケット</div>
                      <div>{deal.market || "未設定"}</div>

                      <div className="text-slate-500">投稿日</div>
                      <div>{fmtShort(deal.created_at)}</div>

                      <div className="text-slate-500">投稿者</div>
                      <div>{deal.author_username ?? "匿名ユーザー"}</div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-3 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setOpenAboutPoster((v) => !v)}
                  className="flex w-full cursor-pointer items-center justify-between px-4 py-5 text-left"
                >
                  <span className="text-[18px] font-semibold text-slate-900">
                    投稿者について
                  </span>
                  {openAboutPoster ? (
                    <ChevronUp className="h-6 w-6 text-slate-700" />
                  ) : (
                    <ChevronDown className="h-6 w-6 text-slate-700" />
                  )}
                </button>

                {openAboutPoster ? (
                  <div className="px-4 pb-5 text-[15px] leading-[1.6] text-slate-800">
                    <p>投稿者: {deal.author_username ?? "匿名ユーザー"}</p>
                    <p className="mt-2">
                      トクミッケ のコミュニティメンバーとしてディールを共有しています。
                    </p>
                  </div>
                ) : null}
              </div>

              <div
                id="comments"
                ref={mobileCommentsRef}
                className="mt-4 scroll-mt-24 bg-white px-4 py-5 shadow-sm"
              >
                <h3 className="text-[20px] font-bold text-slate-950">
                  コメントに参加する
                </h3>

                <div className="mt-4">
                  {renderMobileCommentComposer("top")}
                </div>

                <div className="mt-6">
                  {renderCommentControls(true)}

                  {renderCommentList(true)}

                  {renderCommentPagination(true)}

                  {totalDiscussionCount > 0 ? (
                    <div className="mt-5 border-t border-slate-200 pt-5">
                      {renderMobileCommentComposer("bottom")}
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </main>

        {shareCopied ? (
          <div className="fixed bottom-[88px] left-1/2 z-[120] -translate-x-1/2 md:bottom-6">
            <div className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-black px-5 py-3 text-[15px] font-semibold text-white shadow-xl">
              <CheckCircle2 className="h-5 w-5 text-emerald-300" />
              リンクをコピーしました
            </div>
          </div>
        ) : null}

        {!loading && !errorMsg && deal && showStickyMobileCta ? (
          <div className="fixed inset-x-0 bottom-[72px] z-40 border-t border-slate-200 bg-white px-3 py-2 shadow-[0_-6px_20px_rgba(0,0,0,0.08)]">
            <div className="mx-auto flex max-w-[720px] items-center gap-3">
              <div className="flex items-center gap-3 rounded-full border border-slate-200 px-3 py-2 text-[14px] text-slate-700">
                <div className="inline-flex items-center gap-1">
                  <ThumbsUp className="h-4 w-4 text-[#006888]" />
                  {Number(deal.likes_count ?? 0)}
                </div>
                <div className="inline-flex items-center gap-1">
                  <MessageSquare className="h-4 w-4 text-orange-500" />
                  {totalDiscussionCount}
                </div>
              </div>

              <a
                href={deal.deal_url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-1 cursor-pointer items-center justify-center rounded-full bg-[#006888] px-4 py-2 text-[16px] font-semibold text-white"
              >
                商品ページを見る
              </a>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <style jsx global>{`
        body[data-hide-global-site-header="true"] header {
          display: none !important;
        }
      `}</style>

      <ViewTracker
        dealId={id}
        enabled={!!deal && !loading && !errorMsg}
      />

      {shareCopied ? (
        <div className="fixed bottom-6 left-1/2 z-[120] -translate-x-1/2">
          <div className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-black px-5 py-3 text-[15px] font-semibold text-white shadow-xl">
            <CheckCircle2 className="h-5 w-5 text-emerald-300" />
            リンクをコピーしました
          </div>
        </div>
      ) : null}

      {!loading && !errorMsg && deal && showStickyDesktopCta ? (
        <div className="fixed inset-x-0 top-0 z-[100] border-b border-slate-200 bg-white shadow-[0_6px_20px_rgba(15,23,42,0.10)]">
          <div className="mx-auto flex max-w-[1500px] items-center gap-5 px-4 py-2.5">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                <img
                  src={deal.image_url || PLACEHOLDER_IMG}
                  alt={deal.title ?? ""}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="min-w-0">
                <div className="line-clamp-2 text-[14px] font-semibold leading-[1.3] text-slate-900">
                  {deal.title || "タイトル未設定"}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-baseline gap-2 whitespace-nowrap">
              <span className="text-[24px] font-bold leading-none text-slate-900">
                {yen(deal.price)}
              </span>
              {deal.orig_price ? (
                <span className="text-[16px] text-slate-400 line-through">
                  {yen(deal.orig_price)}
                </span>
              ) : null}
              {discountPercent ? (
                <span className="text-[17px] font-semibold text-teal-700">
                  {discountPercent}% off
                </span>
              ) : null}
            </div>

            <div className="hidden w-[145px] shrink-0 text-[12px] leading-[1.25] text-slate-500 xl:block">
              このディールがお得か
              <br />
              コミュニティに投票
            </div>

            <div className="inline-flex h-10 shrink-0 items-center overflow-hidden rounded-full border border-slate-300 bg-white">
              <button
                type="button"
                onClick={handleLike}
                disabled={liking || disliking}
                className={`inline-flex h-full cursor-pointer items-center gap-1.5 px-3 text-sm ${
                  deal.has_liked ? "text-[#006888]" : "text-slate-700"
                } disabled:cursor-wait disabled:opacity-60`}
                title={
                  deal.has_liked
                    ? "クリックして「お得」投票を取り消す"
                    : "お得"
                }
              >
                <ThumbsUp
                  className="h-4 w-4"
                  fill={deal.has_liked ? "currentColor" : "none"}
                />
                <span>{Number(deal.likes_count ?? 0)}</span>
              </button>

              <span className="h-5 w-px bg-slate-200" />

              <button
                type="button"
                onClick={handleBadDeal}
                disabled={liking || disliking}
                className={`inline-flex h-full cursor-pointer items-center justify-center px-3 ${
                  deal.has_disliked ? "text-orange-500" : "text-orange-500"
                } disabled:cursor-wait disabled:opacity-60`}
                title={
                  deal.has_disliked
                    ? "クリックして「イマイチ」投票を取り消す"
                    : "イマイチ"
                }
              >
                <ThumbsDown
                  className="h-4 w-4"
                  fill={deal.has_disliked ? "currentColor" : "none"}
                />
              </button>
            </div>

            {deal.deal_url ? (
              <a
                href={deal.deal_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#006888] px-6 py-3 text-[15px] font-semibold text-white hover:bg-[#00546d]"
              >
                商品ページを見る
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <main className="mx-auto max-w-[1500px] overflow-x-visible px-4 py-6">
        <div className="flex justify-center">
          <div className="flex w-full flex-row gap-6">
            <section className="min-w-0 flex-1">
              <Link href="/" className="text-xs text-slate-600 hover:underline">
                ← トップディール一覧に戻る
              </Link>

              {loading ? (
                <p className="mt-4 text-sm text-slate-600">読み込み中…</p>
              ) : errorMsg ? (
                <p className="mt-4 text-sm text-red-600">{errorMsg}</p>
              ) : !deal ? (
                <p className="mt-4 text-sm text-slate-600">
                  ディールが見つかりませんでした。
                </p>
              ) : (
                <>
                  <section className={`mt-4 ${sectionCard}`}>
                    <div className="flex flex-col gap-6 md:flex-row">
                      <div className="md:w-[48%]">
                        <div className="relative overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
                          <img
                            src={deal.image_url || PLACEHOLDER_IMG}
                            alt={deal.title ?? ""}
                            className={`w-full object-cover ${deal.is_expired ? "opacity-70" : ""}`}
                          />
                          {deal.is_expired && (
                            <span className="absolute left-2 top-2 rounded bg-slate-800/80 px-2 py-[2px] text-[11px] font-semibold text-white">
                              終了
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex-1 space-y-4">
                        <div>
                          <div className="inline-flex flex-wrap items-center gap-2">
                            <span className="text-xs text-slate-500">
                              {new Date(deal.created_at).toLocaleString("ja-JP", {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>

                            <span className="text-xs text-slate-500">
                              ・投稿者 {deal.author_username ?? "匿名ユーザー"}
                            </span>
                          </div>

                          <h1 className="mt-2 text-[20px] font-semibold leading-[1.38] text-slate-900 xl:text-[21px]">
                            {deal.title || "タイトル未設定"}
                          </h1>
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                            <span className="text-[32px] font-bold leading-none text-[#d70035]">
                              {yen(deal.price)}
                            </span>
                            {deal.orig_price ? (
                              <span className="text-[16px] text-slate-400 line-through">
                                {yen(deal.orig_price)}
                              </span>
                            ) : null}
                            {discountPercent ? (
                              <span className="text-[18px] font-semibold text-teal-700">
                                {discountPercent}% off
                              </span>
                            ) : null}
                            {deal.free_shipping ? <FreeShippingBadge /> : null}
                          </div>

                          {deal.market || deal.shop_name ? (
                            <div className="mt-3 flex items-center gap-2 text-[14px] text-slate-600">
                              {deal.market ? <MarketTag market={deal.market} /> : null}
                              {deal.shop_name ? (
                                <span className="truncate">{deal.shop_name}</span>
                              ) : null}
                            </div>
                          ) : null}

                          {deal.brand || expiryLabel ? (
                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                              {deal.brand ? (
                                <span>
                                  ブランド:{" "}
                                  <span className="font-medium text-slate-800">
                                    {deal.brand}
                                  </span>
                                </span>
                              ) : null}
                              {expiryLabel ? (
                                <span
                                  className={
                                    isPastExpiry
                                      ? "font-semibold text-red-600"
                                      : ""
                                  }
                                >
                                  {isPastExpiry ? "終了日" : "セール終了日時"}:{" "}
                                  {expiryLabel}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        {deal.deal_url ? (
                          <div className="pt-1">
                            <a
                              ref={desktopPrimaryCtaRef}
                              href={deal.deal_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex w-full cursor-pointer items-center justify-center rounded-full bg-[#006888] px-6 py-3.5 text-base font-semibold text-white hover:bg-[#00546d]"
                            >
                              商品ページを見る
                            </a>
                          </div>
                        ) : null}

                        <div className="mt-4 flex items-start justify-between border-t border-slate-200 pt-4">
                          <div className="flex w-[76px] flex-none flex-col items-center gap-1.5 text-center text-slate-700">
                            <span className="inline-flex h-10 w-[76px] items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-white">
                              <button
                                type="button"
                                onClick={handleLike}
                                disabled={liking}
                                className="inline-flex h-full cursor-pointer items-center gap-1 px-2 disabled:cursor-wait disabled:opacity-60"
                                title={
                                  !currentUser
                                    ? "いいねするにはログインが必要です"
                                    : deal.has_liked
                                      ? "クリックして投票を取り消す"
                                      : "いいね"
                                }
                              >
                                <ThumbsUp
                                  className="h-4 w-4 text-[#006888]"
                                  fill={deal.has_liked ? "currentColor" : "none"}
                                />
                                <span className="text-sm">
                                  {Number(deal.likes_count ?? 0)}
                                </span>
                              </button>
                              <span className="h-5 w-px bg-slate-200" />
                              <button
                                type="button"
                                onClick={handleBadDeal}
                                disabled={disliking}
                                className="inline-flex h-full cursor-pointer items-center justify-center px-2 text-orange-500 disabled:cursor-wait disabled:opacity-60"
                                title={
                                  deal.has_disliked
                                    ? "クリックして「イマイチ」投票を取り消す"
                                    : "イマイチ"
                                }
                                aria-label="イマイチ"
                              >
                                <ThumbsDown
                                  className="h-4 w-4"
                                  fill={deal.has_disliked ? "currentColor" : "none"}
                                />
                              </button>
                            </span>
                            <span className="text-center text-[12px]">おトク？</span>
                          </div>

                          <button
                            type="button"
                            onClick={handleCommentsClick}
                            className="flex w-[64px] flex-none cursor-pointer flex-col items-center gap-1.5 text-center text-slate-700"
                            title="コメントへ移動"
                          >
                            <span className="inline-flex h-10 w-[60px] items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white px-2">
                              <MessageSquare className="h-4 w-4" />
                              <span className="text-sm">
                                {totalDiscussionCount}
                              </span>
                            </span>
                            <span className="text-center text-[12px]">コメント</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="flex w-[52px] flex-none cursor-pointer flex-col items-center gap-1.5 text-center text-slate-700 disabled:cursor-wait disabled:opacity-60"
                            title={
                              !currentUser
                                ? "保存するにはログインが必要です"
                                : deal.has_saved
                                  ? "保存済み"
                                  : "保存"
                            }
                          >
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white">
                              <Bookmark
                                className={`h-4 w-4 ${
                                  deal.has_saved ? "text-[#006888]" : ""
                                }`}
                                fill={deal.has_saved ? "currentColor" : "none"}
                              />
                            </span>
                            <span className="text-center text-[12px]">
                              {deal.has_saved ? "保存済み" : "保存"}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={handleShare}
                            className="flex w-[52px] flex-none cursor-pointer flex-col items-center gap-1.5 text-center text-slate-700"
                            title="リンクをコピー"
                          >
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white">
                              <Forward className="h-4 w-4" />
                            </span>
                            <span className="text-center text-[12px]">シェア</span>
                          </button>
                        </div>

                      </div>
                    </div>
                  </section>

                  <section className={`mt-6 ${sectionCard}`}>
                    <div className="mb-4 border-b border-slate-200 pb-3">
                      <h2 className="text-lg font-semibold text-slate-900">
                        商品詳細
                      </h2>
                    </div>

                    {deal.item_description ? (
                      <div>
                        <div
                          className={`relative ${
                            productDetailsExpanded
                              ? ""
                              : "max-h-[280px] overflow-hidden"
                          }`}
                        >
                          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800">
                            {deal.item_description}
                          </p>

                          {!productDetailsExpanded ? (
                            <button
                              type="button"
                              onClick={() => setProductDetailsExpanded(true)}
                              className="absolute inset-x-0 bottom-0 flex h-28 cursor-pointer items-end justify-center bg-gradient-to-b from-white/0 via-white/80 to-white pb-2 text-sm font-semibold text-[#006888]"
                              aria-label="商品詳細をすべて表示"
                            >
                              もっと見る
                            </button>
                          ) : null}
                        </div>

                        {productDetailsExpanded ? (
                          <button
                            type="button"
                            onClick={() => setProductDetailsExpanded(false)}
                            className="mt-3 cursor-pointer text-sm font-semibold text-[#006888] hover:underline"
                          >
                            閉じる
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">
                        商品説明は登録されていません。
                      </p>
                    )}
                  </section>

                  {deal.comment ? (
                    <section className={`mt-6 ${sectionCard}`}>
                      <div className="mb-4 border-b border-slate-200 pb-3">
                        <h2 className="text-lg font-semibold text-slate-900">
                          投稿者コメント
                        </h2>
                      </div>

                      <div className="whitespace-pre-wrap text-sm leading-7 text-slate-800">
                        {deal.comment}
                      </div>
                    </section>
                  ) : null}

                  {renderCommunityVoting(false)}

                  <section
                    id="comments"
                    ref={desktopCommentsRef}
                    className={`mt-6 scroll-mt-24 ${sectionCard}`}
                  >
                    <div className="pb-7">
                      {renderDesktopCommentComposer("top")}
                    </div>

                    <div className="border-t border-slate-200 pt-6">
                      {renderCommentControls(false)}

                      {renderCommentList(false)}

                      {renderCommentPagination(false)}

                      {totalDiscussionCount > 0 ? (
                        <div className="mt-8 border-t border-slate-200 pt-7">
                          {renderDesktopCommentComposer("bottom")}
                        </div>
                      ) : null}
                    </div>
                  </section>
                </>
              )}
            </section>

            <aside className="sticky top-24 max-h-[calc(100vh-7rem)] w-72 flex-none self-start overflow-x-hidden overflow-y-auto overscroll-contain p-1">
              <RightSidebar
                popular={popular}
                trending={trending}
                endingSoon={endingSoon}
                className="w-full space-y-4"
                onLike={handleSidebarLike}
                onShare={handleSidebarShare}
                canLike={true}
              />
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}