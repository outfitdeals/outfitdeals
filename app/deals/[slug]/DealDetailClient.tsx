// app/deals/[slug]/DealDetailClient.tsx
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
  Calendar,
  ArrowUp,
  MoreHorizontal,
  X,
} from "lucide-react";

import RightSidebar, { type SidebarDeal } from "@/app/components/RightSidebar";
import { MarketTag, yen } from "@/app/components/DealUI";
import ViewTracker from "@/app/components/ViewTracker";
import { likeDeal, saveDeal } from "@/lib/dealActions";

export type DealRow = {
  id: string;
  public_id?: number | null;
  created_at: string;
  title: string | null;
  price: number | null;
  orig_price: number | null;
  free_shipping: boolean | null;
  brand: string | null;
  expires_at: string | null;
  market: string | null;
  market_code?: string | null;
  shop_id?: string | null;
  item_id?: string | null;
  deal_number?: number | null;
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
  author_username?: string | null;
  author_joined_at?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  user_badge?: string | null;
  like_count?: number;
  has_liked?: boolean;
  reaction_type?: CommentReactionType | null;
  reaction_counts?: ReactionCounts;
  user_comment_count?: number;
  user_total_rating?: number;
  user_joined_at?: string | null;
};

type CommentRow = {
  id: string;
  created_at: string;
  body: string;
  user_id: string | null;
  author_username?: string | null;
  author_joined_at?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  user_badge?: string | null;
  like_count?: number;
  has_liked?: boolean;
  reaction_type?: CommentReactionType | null;
  reaction_counts?: ReactionCounts;
  user_comment_count?: number;
  user_total_rating?: number;
  user_joined_at?: string | null;
  replies?: ReplyRow[];
};

const PLACEHOLDER_IMG = "https://via.placeholder.com/900x900?text=No+Image";

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
  id: string;
  public_id?: number | null;
  shop_id?: string | null;
  item_id?: string | null;
}) {
  const publicId = deal.public_id;

  if (publicId == null) {
    return `/deals/${deal.id}`;
  }

  const suffix = [
    normalizeDealSlugPart(deal.shop_id),
    normalizeDealSlugPart(deal.item_id),
  ]
    .filter(Boolean)
    .join("-");

  return suffix
    ? `/deals/${publicId}-${suffix}`
    : `/deals/${publicId}`;
}

function fmtDealDateTime(dt: string) {
  try {
    const date = new Date(dt);
    if (Number.isNaN(date.getTime())) return dt;

    const now = new Date();

    const dateParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);

    const nowParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);

    const getPart = (
      parts: Intl.DateTimeFormatPart[],
      type: Intl.DateTimeFormatPartTypes
    ) => parts.find((part) => part.type === type)?.value ?? "";

    const year = getPart(dateParts, "year");
    const month = getPart(dateParts, "month");
    const day = getPart(dateParts, "day");
    const hour = getPart(dateParts, "hour");
    const minute = getPart(dateParts, "minute");

    const nowYear = getPart(nowParts, "year");
    const nowMonth = getPart(nowParts, "month");
    const nowDay = getPart(nowParts, "day");

    const targetDay = Date.UTC(Number(year), Number(month) - 1, Number(day));
    const today = Date.UTC(
      Number(nowYear),
      Number(nowMonth) - 1,
      Number(nowDay)
    );
    const diffDays = Math.round((today - targetDay) / 86400000);
    const time = `${hour}:${minute}`;

    if (diffDays === 0) return `今日 ${time}`;
    if (diffDays === 1) return `昨日 ${time}`;

    return `${year}/${month}/${day} ${time}`;
  } catch {
    return dt;
  }
}

function fmtCommentDateTime(dt: string) {
  try {
    const date = new Date(dt);
    if (Number.isNaN(date.getTime())) return dt;

    const now = new Date();

    const dateParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);

    const nowParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);

    const getPart = (
      parts: Intl.DateTimeFormatPart[],
      type: Intl.DateTimeFormatPartTypes
    ) => parts.find((part) => part.type === type)?.value ?? "";

    const year = getPart(dateParts, "year");
    const month = getPart(dateParts, "month");
    const day = getPart(dateParts, "day");
    const hour = getPart(dateParts, "hour");
    const minute = getPart(dateParts, "minute");

    const nowYear = getPart(nowParts, "year");
    const nowMonth = getPart(nowParts, "month");
    const nowDay = getPart(nowParts, "day");

    const targetDay = Date.UTC(Number(year), Number(month) - 1, Number(day));
    const today = Date.UTC(
      Number(nowYear),
      Number(nowMonth) - 1,
      Number(nowDay)
    );

    const diffDays = Math.round((today - targetDay) / 86400000);
    const time = `${hour}:${minute}`;

    if (diffDays === 0) return `今日 ${time}`;
    if (diffDays === 1) return `昨日 ${time}`;

    return `${year}年${Number(month)}月${Number(day)}日 ${time}`;
  } catch {
    return dt;
  }
}

function getCommentPostErrorMessage(error: any) {
  const message = String(error?.message ?? "");
  const details = String(error?.details ?? "");
  const hint = String(error?.hint ?? "");
  const combined = `${message} ${details} ${hint}`;

  if (combined.includes("EXTERNAL_URL_NOT_ALLOWED")) {
    return "コメントにはトクミッケ内のURLのみ掲載できます。";
  }

  if (combined.includes("COMMENT_RATE_LIMIT:")) {
    const reason = combined
      .split("COMMENT_RATE_LIMIT:")[1]
      ?.split(/\n|DETAIL:|HINT:/)[0]
      ?.trim();

    if (reason?.includes("短時間に投稿できるコメント数の上限に達しました。")) {
      return "短時間に投稿できるコメント数の上限に達しました。1分ほど時間をおいてからもう一度お試しください。";
    }

    return (
      reason ||
      "短時間に連続して投稿することはできません。少し時間をおいてからもう一度お試しください。"
    );
  }

  if (combined.includes("EMPTY_COMMENT")) {
    return "コメントを入力してください。";
  }

  if (combined.includes("AUTH_REQUIRED") || combined.includes("INVALID_USER")) {
    return "コメントするにはログインが必要です。";
  }

  return "コメントの投稿に失敗しました。もう一度お試しください。";
}

async function moderateCommentText(text: string) {
  const response = await fetch("/api/moderate-comment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.ok) {
    console.error("comment moderation error:", result ?? response.status);
    throw new Error("COMMENT_MODERATION_UNAVAILABLE");
  }

  return result.allowed === true;
}

function getDealVoteScore(
  deal: Pick<DealRow, "likes_count" | "dislikes_count">
) {
  return Number(deal.likes_count ?? 0) - Number(deal.dislikes_count ?? 0);
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

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  const hour = getPart("hour");
  const minute = getPart("minute");

  return `${year}/${month}/${day} ${hour}:${minute}`;
}

function CommentAvatar({
  userId,
  username,
  avatarUrl,
  size = "normal",
}: {
  userId: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  size?: "small" | "normal";
}) {
  const storagePublicUrl = userId
    ? supabase.storage.from("avatars").getPublicUrl(`${userId}/avatar.jpg`).data
        .publicUrl
    : null;
  const publicUrl = avatarUrl?.trim() || storagePublicUrl;

  const dimension = size === "small" ? "h-8 w-8" : "h-10 w-10";
  const iconSize = size === "small" ? "h-5 w-5" : "h-6 w-6";

  const avatar = (
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
          referrerPolicy="no-referrer"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : null}
    </span>
  );

  return userId ? (
    <Link
      href={`/users/${userId}`}
      className="relative z-10 inline-flex shrink-0 cursor-pointer"
      aria-label={`${username ?? "ユーザー"}のプロフィールを見る`}
    >
      {avatar}
    </Link>
  ) : (
    avatar
  );
}



function UserBadge({ badge }: { badge?: string | null }) {
  if (badge !== "staff") return null;

  return (
    <span className="inline-flex shrink-0 items-center rounded bg-[#006888]/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[#006888] ring-1 ring-inset ring-[#006888]/20">
      スタッフ
    </span>
  );
}


type CommentReactionType = "deal" | "helpful" | "funny" | "not_helpful";

type ReactionCounts = Record<CommentReactionType, number>;

const EMPTY_REACTION_COUNTS: ReactionCounts = {
  deal: 0,
  helpful: 0,
  funny: 0,
  not_helpful: 0,
};

const POSITIVE_COMMENT_REACTIONS: CommentReactionType[] = [
  "deal",
  "helpful",
  "funny",
];

const COMMENT_REACTIONS: Array<{
  type: CommentReactionType;
  label: string;
  emoji: string;
}> = [
  { type: "deal", label: "おトク！", emoji: "👍" },
  { type: "helpful", label: "なるほど", emoji: "💡" },
  { type: "funny", label: "おもしろい", emoji: "😂" },
  { type: "not_helpful", label: "イマイチ", emoji: "👎" },
];

function isPositiveCommentReaction(
  reaction: CommentReactionType | null | undefined
) {
  return !!reaction && POSITIVE_COMMENT_REACTIONS.includes(reaction);
}

function CommentReactionSummary({
  counts,
  selected,
}: {
  counts?: Partial<ReactionCounts>;
  selected?: CommentReactionType | null;
}) {
  const visible = COMMENT_REACTIONS.filter(
    (reaction) => Number(counts?.[reaction.type] ?? 0) > 0
  );

  if (visible.length === 0) {
    return (
      <>
        <ThumbsUp className="h-4 w-4" />
        <span>0</span>
      </>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      {visible.map((reaction) => (
        <span
          key={reaction.type}
          className={`inline-flex items-center gap-0.5 ${
            reaction.type === "deal"
              ? "text-blue-600"
              : reaction.type === "not_helpful"
                ? "text-red-500"
                : "text-slate-600"
          } ${selected === reaction.type ? "font-bold" : ""}`}
          title={reaction.label}
        >
          <span className="text-[14px] leading-none">{reaction.emoji}</span>
          <span>{Number(counts?.[reaction.type] ?? 0)}</span>
        </span>
      ))}
    </span>
  );
}

function CommentReactionPicker({
  selected,
  counts,
  disabled,
  onSelect,
}: {
  selected?: CommentReactionType | null;
  counts?: Partial<ReactionCounts>;
  disabled?: boolean;
  onSelect: (reaction: CommentReactionType) => void;
}) {
  return (
    <div className="flex items-start gap-1.5 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
      {COMMENT_REACTIONS.map((reaction) => {
        const active = selected === reaction.type;
        const count = Number(counts?.[reaction.type] ?? 0);

        return (
          <button
            key={reaction.type}
            type="button"
            disabled={disabled}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(reaction.type);
            }}
            className={`group/reaction flex min-w-[62px] cursor-pointer flex-col items-center rounded-xl px-2 py-1.5 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 ${
              active ? "bg-slate-100" : ""
            }`}
            aria-label={reaction.label}
            title={reaction.label}
          >
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-full text-[25px] transition group-hover/reaction:scale-110 ${
                active
                  ? reaction.type === "deal"
                    ? "bg-blue-50 ring-2 ring-blue-300"
                    : reaction.type === "helpful"
                      ? "bg-amber-50 ring-2 ring-amber-300"
                      : reaction.type === "funny"
                        ? "bg-orange-50 ring-2 ring-orange-300"
                        : "bg-red-50 ring-2 ring-red-300"
                  : "bg-slate-50"
              }`}
            >
              {reaction.emoji}
            </span>
            <span
              className={`mt-1 whitespace-nowrap text-[10px] font-semibold ${
                active
                  ? reaction.type === "deal"
                    ? "text-blue-600"
                    : reaction.type === "helpful"
                      ? "text-amber-600"
                      : reaction.type === "funny"
                        ? "text-orange-600"
                        : "text-red-600"
                  : "text-slate-600"
              }`}
            >
              {reaction.label}
            </span>
            {count > 0 ? (
              <span className="mt-0.5 text-[10px] leading-none text-slate-400">
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export default function DealDetailPage({ initialDeal }: { initialDeal: DealRow }) {
  const params = useParams<{ slug: string }>();
  const routeKey = typeof params?.slug === "string" ? params.slug : "";

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
  const flashedCommentHashRef = useRef<string | null>(null);

  const [shareCopied, setShareCopied] = useState(false);
  const [mobileCommentComposer, setMobileCommentComposer] = useState<
    "top" | "bottom" | null
  >(null);
  const [desktopCommentComposer, setDesktopCommentComposer] = useState<
    "top" | "bottom" | null
  >(null);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [myProfileUsername, setMyProfileUsername] = useState<string | null>(null);

  const [deal, setDeal] = useState<DealRow | null>(initialDeal);
  const [loading, setLoading] = useState(false);
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
  const [replyErrors, setReplyErrors] = useState<Record<string, string | null>>({});
  const [commentLikingId, setCommentLikingId] = useState<string | null>(null);
  const [replyLikingId, setReplyLikingId] = useState<string | null>(null);
  const [reactionPickerKey, setReactionPickerKey] = useState<string | null>(null);
  const [reportMenuKey, setReportMenuKey] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<{ type: "comment" | "reply"; id: string } | null>(null);
  const [reportReason, setReportReason] = useState<"harassment" | "sexual" | "spam" | "other" | "">("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSuccess, setReportSuccess] = useState(false);

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
  }, [routeKey]);

  useEffect(() => {
    return () => {
      if (shareToastTimerRef.current) {
        clearTimeout(shareToastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!reactionPickerKey) return;

    const closePicker = () => setReactionPickerKey(null);
    document.addEventListener("click", closePicker);

    return () => {
      document.removeEventListener("click", closePicker);
    };
  }, [reactionPickerKey]);

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

  useEffect(() => {
    let cancelled = false;

    if (!currentUser?.id) {
      setMyProfileUsername(null);
      return;
    }

    supabase
      .from("profiles")
      .select("username")
      .eq("id", currentUser.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.warn("load my profile username warn:", error);
          setMyProfileUsername(null);
          return;
        }

        setMyProfileUsername(data?.username?.trim() || null);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  const myDisplayName = useMemo(
    () => myProfileUsername ?? null,
    [myProfileUsername]
  );

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
    if (!routeKey || !initialDeal?.id) return;

    let cancelled = false;

    (async () => {
      // The Server Component already supplied the deal itself, so do not
      // blank the page and fetch the same row again on first paint.
      const withFlags = await attachHasLikedAndSaved([initialDeal]);
      if (cancelled) return;

      setDeal(withFlags[0] ?? initialDeal);
      setLoading(false);
      setErrorMsg(null);
    })();

    return () => {
      cancelled = true;
    };
  }, [routeKey, initialDeal, attachHasLikedAndSaved]);

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
      const [
        { data: allLikeRows, error: allLikesError },
        { data: allDislikeRows, error: allDislikesError },
        { data: routeRows, error: routeError },
      ] = await Promise.all([
        supabase
          .from("deal_likes")
          .select("deal_id, user_id")
          .in("deal_id", allIds),
        supabase
          .from("deal_dislikes")
          .select("deal_id, user_id")
          .in("deal_id", allIds),
        supabase
          .from("deals")
          .select("id, public_id, shop_id, item_id")
          .in("id", allIds),
      ]);

      if (allLikesError) {
        console.warn("sidebar like count warn:", allLikesError);
      }
      if (allDislikesError) {
        console.warn("sidebar dislike count warn:", allDislikesError);
      }
      if (routeError) {
        console.warn("sidebar route info warn:", routeError);
      }

      const routeById = new Map<string, any>(
        (routeRows ?? []).map((row: any) => [String(row.id), row])
      );
      const likeCountMap = new Map<string, number>();
      const dislikeCountMap = new Map<string, number>();
      const likedSet = new Set<string>();

      (allLikeRows ?? []).forEach((row: any) => {
        const dealId = String(row.deal_id);
        likeCountMap.set(dealId, (likeCountMap.get(dealId) ?? 0) + 1);

        if (currentUser && row.user_id === currentUser.id) {
          likedSet.add(dealId);
        }
      });

      (allDislikeRows ?? []).forEach((row: any) => {
        const dealId = String(row.deal_id);
        dislikeCountMap.set(dealId, (dislikeCountMap.get(dealId) ?? 0) + 1);
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
          .in("deal_id", allIds)
          .eq("moderation_status", "visible");

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
              .in("comment_id", commentIds)
              .eq("moderation_status", "visible");

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

      const patchSidebarDeal = (r: SidebarDeal): SidebarDeal => {
        const routeRow = routeById.get(r.id);

        return {
          ...r,
          detailUrl: routeRow
            ? buildDealDetailPath({
                id: r.id,
                public_id: routeRow.public_id ?? null,
                shop_id: routeRow.shop_id ?? null,
                item_id: routeRow.item_id ?? null,
              })
            : `/deals/${r.id}`,
          likes:
            (likeCountMap.get(r.id) ?? 0) - (dislikeCountMap.get(r.id) ?? 0),
          comments: commentCountMap.get(r.id) ?? 0,
          isLiked: likedSet.has(r.id),
          isSaved: savedSet.has(r.id),
          isCommented: commentedSet.has(r.id),
        };
      };

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
    if (!deal?.id) return;

    const { data: commentData, error: commentErrorRes } = await supabase
      .from("deal_comments")
      .select("id, body, created_at, user_id, author_username, author_joined_at")
      .eq("deal_id", deal.id)
      .eq("moderation_status", "visible")
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
          .select("id, comment_id, body, created_at, user_id, author_username, author_joined_at")
          .in("comment_id", commentIds)
          .eq("moderation_status", "visible")
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
    let avatarUrlMap: Record<string, string | null> = {};
    let joinedAtMap: Record<string, string | null> = {};
    let userBadgeMap: Record<string, string | null> = {};
    if (allUserIds.length > 0) {
      const { data: profs, error: pe } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, created_at, user_badge")
        .in("id", allUserIds);

      if (!pe) {
        usernameMap = Object.fromEntries(
          (profs ?? []).map((p: any) => [String(p.id), p.username ?? null])
        );
        avatarUrlMap = Object.fromEntries(
          (profs ?? []).map((p: any) => [String(p.id), p.avatar_url ?? null])
        );
        joinedAtMap = Object.fromEntries(
          (profs ?? []).map((p: any) => [String(p.id), p.created_at ?? null])
        );
        userBadgeMap = Object.fromEntries(
          (profs ?? []).map((p: any) => [String(p.id), p.user_badge ?? null])
        );
      }
    }

    const userCommentCountMap: Record<string, number> = {};
    const userTotalRatingMap: Record<string, number> = {};

    if (allUserIds.length > 0) {
      const [
        { data: authoredComments, error: authoredCommentsError },
        { data: authoredReplies, error: authoredRepliesError },
        { data: authoredDeals, error: authoredDealsError },
      ] = await Promise.all([
        supabase
          .from("deal_comments")
          .select("id, user_id")
          .in("user_id", allUserIds)
          .eq("moderation_status", "visible"),
        supabase
          .from("deal_comment_replies")
          .select("id, user_id")
          .in("user_id", allUserIds)
          .eq("moderation_status", "visible"),
        supabase
          .from("deals")
          .select("user_id, likes_count")
          .in("user_id", allUserIds),
      ]);

      if (authoredCommentsError) {
        console.warn("load commenter comment counts warn:", authoredCommentsError);
      }
      if (authoredRepliesError) {
        console.warn("load commenter reply counts warn:", authoredRepliesError);
      }
      if (authoredDealsError) {
        console.warn("load commenter deal likes warn:", authoredDealsError);
      }

      const authoredCommentOwnerMap: Record<string, string> = {};
      const authoredReplyOwnerMap: Record<string, string> = {};

      (authoredComments ?? []).forEach((row: any) => {
        if (!row.user_id) return;
        const uid = String(row.user_id);
        const cid = String(row.id);
        authoredCommentOwnerMap[cid] = uid;
        userCommentCountMap[uid] = (userCommentCountMap[uid] ?? 0) + 1;
      });

      (authoredReplies ?? []).forEach((row: any) => {
        if (!row.user_id) return;
        const uid = String(row.user_id);
        const rid = String(row.id);
        authoredReplyOwnerMap[rid] = uid;
        userCommentCountMap[uid] = (userCommentCountMap[uid] ?? 0) + 1;
      });

      (authoredDeals ?? []).forEach((row: any) => {
        if (!row.user_id) return;
        const uid = String(row.user_id);
        userTotalRatingMap[uid] =
          (userTotalRatingMap[uid] ?? 0) + Number(row.likes_count ?? 0);
      });

      const authoredCommentIds = Object.keys(authoredCommentOwnerMap);
      const authoredReplyIds = Object.keys(authoredReplyOwnerMap);

      const [
        { data: receivedCommentLikes, error: receivedCommentLikesError },
        { data: receivedReplyLikes, error: receivedReplyLikesError },
      ] = await Promise.all([
        authoredCommentIds.length
          ? supabase
              .from("deal_comment_likes")
              .select("comment_id")
              .in("comment_id", authoredCommentIds)
          : Promise.resolve({ data: [], error: null as any }),
        authoredReplyIds.length
          ? supabase
              .from("deal_comment_reply_likes")
              .select("reply_id")
              .in("reply_id", authoredReplyIds)
          : Promise.resolve({ data: [], error: null as any }),
      ]);

      if (receivedCommentLikesError) {
        console.warn("load commenter received comment likes warn:", receivedCommentLikesError);
      }
      if (receivedReplyLikesError) {
        console.warn("load commenter received reply likes warn:", receivedReplyLikesError);
      }

      (receivedCommentLikes ?? []).forEach((row: any) => {
        const reaction = (row.reaction_type ?? "deal") as CommentReactionType;
        if (!isPositiveCommentReaction(reaction)) return;
        const uid = authoredCommentOwnerMap[String(row.comment_id)];
        if (!uid) return;
        userTotalRatingMap[uid] = (userTotalRatingMap[uid] ?? 0) + 1;
      });

      (receivedReplyLikes ?? []).forEach((row: any) => {
        const reaction = (row.reaction_type ?? "deal") as CommentReactionType;
        if (!isPositiveCommentReaction(reaction)) return;
        const uid = authoredReplyOwnerMap[String(row.reply_id)];
        if (!uid) return;
        userTotalRatingMap[uid] = (userTotalRatingMap[uid] ?? 0) + 1;
      });
    }

    const { data: likeRows, error: likeRowsError } = commentIds.length
      ? await supabase
          .from("deal_comment_likes")
          .select("comment_id, user_id, reaction_type")
          .in("comment_id", commentIds)
      : { data: [], error: null as any };

    if (likeRowsError) {
      console.warn("load comment likes warn:", likeRowsError);
    }

    const likeCountMap: Record<string, number> = {};
    const commentReactionCountsMap: Record<string, ReactionCounts> = {};
    const myCommentReactionMap: Record<string, CommentReactionType> = {};

    (likeRows ?? []).forEach((row: any) => {
      const cid = String(row.comment_id);
      const reaction = (row.reaction_type ?? "deal") as CommentReactionType;

      if (!commentReactionCountsMap[cid]) {
        commentReactionCountsMap[cid] = { ...EMPTY_REACTION_COUNTS };
      }
      commentReactionCountsMap[cid][reaction] =
        (commentReactionCountsMap[cid][reaction] ?? 0) + 1;

      if (isPositiveCommentReaction(reaction)) {
        likeCountMap[cid] = (likeCountMap[cid] ?? 0) + 1;
      }

      if (currentUser && row.user_id === currentUser.id) {
        myCommentReactionMap[cid] = reaction;
      }
    });

    const replyIds = replies.map((r) => String(r.id));

    const { data: replyLikeRows, error: replyLikeRowsError } = replyIds.length
      ? await supabase
          .from("deal_comment_reply_likes")
          .select("reply_id, user_id, reaction_type")
          .in("reply_id", replyIds)
      : { data: [], error: null as any };

    if (replyLikeRowsError) {
      console.warn("load reply likes warn:", replyLikeRowsError);
    }

    const replyLikeCountMap: Record<string, number> = {};
    const replyReactionCountsMap: Record<string, ReactionCounts> = {};
    const myReplyReactionMap: Record<string, CommentReactionType> = {};

    (replyLikeRows ?? []).forEach((row: any) => {
      const replyId = String(row.reply_id);
      const reaction = (row.reaction_type ?? "deal") as CommentReactionType;

      if (!replyReactionCountsMap[replyId]) {
        replyReactionCountsMap[replyId] = { ...EMPTY_REACTION_COUNTS };
      }
      replyReactionCountsMap[replyId][reaction] =
        (replyReactionCountsMap[replyId][reaction] ?? 0) + 1;

      if (isPositiveCommentReaction(reaction)) {
        replyLikeCountMap[replyId] = (replyLikeCountMap[replyId] ?? 0) + 1;
      }

      if (currentUser && row.user_id === currentUser.id) {
        myReplyReactionMap[replyId] = reaction;
      }
    });

    const repliesByComment: Record<string, ReplyRow[]> = {};
    replies.forEach((r) => {
      const normalizedReply: ReplyRow = {
        ...r,
        username: r.user_id
          ? usernameMap[String(r.user_id)] ?? r.author_username ?? "匿名ユーザー"
          : r.author_username ?? "匿名ユーザー",
        avatar_url: r.user_id
          ? avatarUrlMap[String(r.user_id)] ?? null
          : null,
        user_badge: r.user_id
          ? userBadgeMap[String(r.user_id)] ?? null
          : null,
        like_count: replyLikeCountMap[String(r.id)] ?? 0,
        has_liked: isPositiveCommentReaction(myReplyReactionMap[String(r.id)]),
        reaction_type: myReplyReactionMap[String(r.id)] ?? null,
        reaction_counts:
          replyReactionCountsMap[String(r.id)] ?? { ...EMPTY_REACTION_COUNTS },
        user_comment_count: r.user_id
          ? userCommentCountMap[String(r.user_id)] ?? 0
          : 0,
        user_total_rating: r.user_id
          ? userTotalRatingMap[String(r.user_id)] ?? 0
          : 0,
        user_joined_at: r.user_id
          ? joinedAtMap[String(r.user_id)] ?? r.author_joined_at ?? null
          : r.author_joined_at ?? null,
      };

      if (!repliesByComment[String(r.comment_id)]) {
        repliesByComment[String(r.comment_id)] = [];
      }

      repliesByComment[String(r.comment_id)].push(normalizedReply);
    });

    const normalizedComments = baseComments.map((c) => {
      const nameFromProfiles = c.user_id ? usernameMap[String(c.user_id)] ?? null : null;
      const name = nameFromProfiles ?? c.author_username ?? "匿名ユーザー";

      return {
        ...c,
        username: name,
        avatar_url: c.user_id
          ? avatarUrlMap[String(c.user_id)] ?? null
          : null,
        user_badge: c.user_id
          ? userBadgeMap[String(c.user_id)] ?? null
          : null,
        like_count: likeCountMap[String(c.id)] ?? 0,
        has_liked: isPositiveCommentReaction(myCommentReactionMap[String(c.id)]),
        reaction_type: myCommentReactionMap[String(c.id)] ?? null,
        reaction_counts:
          commentReactionCountsMap[String(c.id)] ?? { ...EMPTY_REACTION_COUNTS },
        user_comment_count: c.user_id
          ? userCommentCountMap[String(c.user_id)] ?? 0
          : 0,
        user_total_rating: c.user_id
          ? userTotalRatingMap[String(c.user_id)] ?? 0
          : 0,
        user_joined_at: c.user_id
          ? joinedAtMap[String(c.user_id)] ?? c.author_joined_at ?? null
          : c.author_joined_at ?? null,
        replies: repliesByComment[String(c.id)] ?? [],
      };
    });

    setComments(normalizedComments);
  }, [deal?.id, currentUser, myDisplayName]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleLike = async () => {
    if (deal.user_id === currentUser?.id) return;
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
      trending.find((item) => item.id === dealId) ??
      endingSoon.find((item) => item.id === dealId);

    const url = `${window.location.origin}${sidebarDeal?.detailUrl ?? `/deals/${dealId}`}`;

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
    if (deal.user_id === currentUser?.id) return;
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

  const handleCommentReaction = async (
    commentId: string,
    reaction: CommentReactionType
  ) => {
    if (!currentUser) {
      alert("コメントにリアクションするには、ログインが必要です。");
      return;
    }

    const target = comments.find((c) => c.id === commentId);
    if (!target || commentLikingId === commentId) return;
    if (target.user_id === currentUser.id) return;

    const previous = target.reaction_type ?? null;
    const next = previous === reaction ? null : reaction;
    setCommentLikingId(commentId);
    setReactionPickerKey(null);

    try {
      if (!next) {
        const { error } = await supabase
          .from("deal_comment_likes")
          .delete()
          .eq("comment_id", commentId)
          .eq("user_id", currentUser.id);
        if (error) throw error;
      } else {
        if (previous) {
          const { error: deleteError } = await supabase
            .from("deal_comment_likes")
            .delete()
            .eq("comment_id", commentId)
            .eq("user_id", currentUser.id);
          if (deleteError) throw deleteError;
        }

        const { error } = await supabase.from("deal_comment_likes").insert({
          comment_id: commentId,
          user_id: currentUser.id,
          reaction_type: next,
        });
        if (error) throw error;
      }
    } catch (error) {
      console.error("comment reaction error:", error);
    } finally {
      await loadComments();
      setCommentLikingId(null);
    }
  };

  const handleReplyReaction = async (
    replyId: string,
    reaction: CommentReactionType
  ) => {
    if (!currentUser) {
      alert("返信にリアクションするには、ログインが必要です。");
      return;
    }

    const targetReply = comments
      .flatMap((comment) => comment.replies ?? [])
      .find((reply) => reply.id === replyId);

    if (!targetReply || replyLikingId === replyId) return;
    if (targetReply.user_id === currentUser.id) return;

    const previous = targetReply.reaction_type ?? null;
    const next = previous === reaction ? null : reaction;
    setReplyLikingId(replyId);
    setReactionPickerKey(null);

    try {
      if (!next) {
        const { error } = await supabase
          .from("deal_comment_reply_likes")
          .delete()
          .eq("reply_id", replyId)
          .eq("user_id", currentUser.id);
        if (error) throw error;
      } else {
        if (previous) {
          const { error: deleteError } = await supabase
            .from("deal_comment_reply_likes")
            .delete()
            .eq("reply_id", replyId)
            .eq("user_id", currentUser.id);
          if (deleteError) throw deleteError;
        }

        const { error } = await supabase
          .from("deal_comment_reply_likes")
          .insert({
            reply_id: replyId,
            user_id: currentUser.id,
            reaction_type: next,
          });
        if (error) throw error;
      }
    } catch (error) {
      console.error("reply reaction error:", error);
    } finally {
      await loadComments();
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
    setReplyErrors((prev) => ({
      ...prev,
      [commentId]: null,
    }));
  };

  const handleReplyDraftChange = (commentId: string, value: string) => {
    setReplyDrafts((prev) => ({
      ...prev,
      [commentId]: value,
    }));
    setReplyErrors((prev) => ({
      ...prev,
      [commentId]: null,
    }));
  };

  const handleReplySubmit = async (commentId: string) => {
    if (!currentUser) {
      alert("返信するには、ログインが必要です。");
      return;
    }

    const body = (replyDrafts[commentId] ?? "").trim();
    if (!body) return;

    setReplyErrors((prev) => ({
      ...prev,
      [commentId]: null,
    }));
    setReplySubmittingId(commentId);

    try {
      let allowed = false;

      try {
        allowed = await moderateCommentText(body);
      } catch (moderationError) {
        console.error("reply moderation error:", moderationError);
        setReplyErrors((prev) => ({
          ...prev,
          [commentId]:
            "コメント内容の確認に失敗しました。少し時間をおいてからもう一度お試しください。",
        }));
        return;
      }

      if (!allowed) {
        setReplyErrors((prev) => ({
          ...prev,
          [commentId]:
            "コミュニティガイドラインに抵触する可能性があるため、このコメントは投稿できません。",
        }));
        return;
      }

      const { data: insertedReply, error } = await supabase
        .from("deal_comment_replies")
        .insert({
          comment_id: commentId,
          user_id: currentUser.id,
          body,
        })
        .select("id")
        .single();

      if (error) {
        console.error("insert reply error:", error);
        setReplyErrors((prev) => ({
          ...prev,
          [commentId]: getCommentPostErrorMessage(error),
        }));
        return;
      }

      // The database trigger continues to create the in-site notification.
      // Email delivery is separate so an email failure never prevents the reply.
      if (insertedReply?.id) {
        try {
          const { data: { session } } = await supabase.auth.getSession();

          if (session?.access_token) {
            const response = await fetch("/api/reply-notification", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ replyId: insertedReply.id }),
            });

            if (!response.ok) {
              const result = await response.json().catch(() => null);
              console.warn("reply email notification warn:", result ?? response.status);
            }
          }
        } catch (emailError) {
          console.warn("reply email notification warn:", emailError);
        }
      }

      setReplyDrafts((prev) => ({
        ...prev,
        [commentId]: "",
      }));
      setReplyErrors((prev) => ({
        ...prev,
        [commentId]: null,
      }));
      setReplyOpenMap((prev) => ({
        ...prev,
        [commentId]: false,
      }));

      await loadComments();

      // Show the newly posted reply directly under the comment it belongs to.
      setExpandedReplyThreads((prev) => ({
        ...prev,
        [commentId]: true,
      }));
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

    if (!deal?.id) {
      setCommentError("ディール情報を取得できませんでした。");
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

      let allowed = false;

      try {
        allowed = await moderateCommentText(body);
      } catch (moderationError) {
        console.error("comment moderation error:", moderationError);
        setCommentError(
          "コメント内容の確認に失敗しました。少し時間をおいてからもう一度お試しください。"
        );
        return;
      }

      if (!allowed) {
        setCommentError(
          "コミュニティガイドラインに抵触する可能性があるため、このコメントは投稿できません。"
        );
        return;
      }

      const { data, error } = await supabase
        .from("deal_comments")
        .insert({
          deal_id: deal.id,
          user_id: currentUser.id,
          body,
        })
        .select("id, created_at, body, user_id")
        .single();

      if (error) {
        console.error("insert comment error:", error);
        setCommentError(getCommentPostErrorMessage(error));
        return;
      }

      setComments((prev) => [
        ...prev,
        {
          ...(data as any),
          username: myDisplayName ?? "匿名ユーザー",
          like_count: 0,
          has_liked: false,
          replies: [],
        },
      ]);

      setCommentBody("");
      setMobileCommentComposer(null);
      setDesktopCommentComposer(null);

      setDeal((p) =>
        p ? { ...p, comments_count: Number(p.comments_count ?? 0) + 1 } : p
      );

      const { data: countRow, error: countErr } = await supabase
        .from("deals")
        .select("comments_count")
        .eq("id", deal.id)
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

    const score = getDealVoteScore(deal);
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
              ? "mt-4 grid grid-cols-[128px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-2 gap-y-4"
              : "mt-5 flex flex-wrap items-center gap-5"
          }
        >
          <div className="inline-flex overflow-hidden rounded-lg border border-amber-200 bg-amber-50">
            <div className="flex items-center bg-amber-100 px-3 py-2 text-center text-[11px] font-semibold leading-tight text-amber-900">
              おトク
              <br />
              スコア
            </div>
            <div className="flex min-w-[58px] items-center justify-center px-3 text-[20px] font-bold text-slate-800">
              {scoreLabel}
            </div>
          </div>

          <button
            type="button"
            onClick={handleLike}
            disabled={liking}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-full text-slate-800 disabled:cursor-wait disabled:opacity-60 ${
              mobile ? "w-full min-w-0 justify-center gap-1" : ""
            }`}
          >
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white">
              <ThumbsUp
                className="h-6 w-6 text-[#006888]"
                fill={deal.has_liked ? "currentColor" : "none"}
              />
            </span>
            <span className="whitespace-nowrap text-[14px] font-medium">おトク！</span>
          </button>

          <button
            type="button"
            onClick={handleBadDeal}
            disabled={disliking}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-full text-slate-800 disabled:cursor-wait disabled:opacity-60 ${
              mobile ? "w-full min-w-0 justify-center gap-1" : ""
            }`}
          >
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white">
              <ThumbsDown
                className="h-6 w-6 text-orange-500"
                fill={deal.has_disliked ? "currentColor" : "none"}
              />
            </span>
            <span className="whitespace-nowrap text-[14px] font-medium">イマイチ</span>
          </button>

          {deal.deal_url ? (
            <a
              href={deal.deal_url}
              target="_blank"
              rel="noopener noreferrer"
              className={
                mobile
                  ? "col-span-3 inline-flex w-full cursor-pointer items-center justify-center rounded-full bg-[#006888] px-5 py-3 text-[16px] font-semibold text-white"
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
      const commentUsername = (comment.username ?? "").toLowerCase();
      const commentBody = comment.body.toLowerCase();

      if (
        !query ||
        commentUsername.includes(query) ||
        commentBody.includes(query)
      ) {
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
      }

      // A reply appears in BOTH places by design:
      // 1) as an independent item in the normal chronological discussion list
      // 2) inside the original parent comment's reply tree
      (comment.replies ?? []).forEach((reply) => {
        const replyUsername = (reply.username ?? "").toLowerCase();
        const replyBody = reply.body.toLowerCase();

        if (
          query &&
          !replyUsername.includes(query) &&
          !replyBody.includes(query)
        ) {
          return;
        }

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

    items.sort((a, b) => {
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

    return items;
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
  }, [commentSearch, commentSort, routeKey]);

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

      if (flashedCommentHashRef.current !== hash) {
        flashedCommentHashRef.current = hash;

        window.setTimeout(() => {
          target.animate(
            [
              { backgroundColor: "rgba(239, 246, 255, 0)" },
              { backgroundColor: "rgba(219, 234, 254, 1)" },
              { backgroundColor: "rgba(239, 246, 255, 0)" },
              { backgroundColor: "rgba(219, 234, 254, 1)" },
              { backgroundColor: "rgba(239, 246, 255, 0)" },
            ],
            {
              duration: 2200,
              easing: "ease-in-out",
            }
          );
        }, 700);
      }

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

        {replyErrors[commentId] ? (
          <p className="mt-2 text-sm leading-5 text-red-600" role="alert">
            {replyErrors[commentId]}
          </p>
        ) : null}

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

  const formatJoinedDate = (value?: string | null) => {
    if (!value) return "----年--月";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "----年--月";

    const parts = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "numeric",
    }).formatToParts(date);

    const year = parts.find((part) => part.type === "year")?.value ?? "";
    const month = parts.find((part) => part.type === "month")?.value ?? "";

    return `${year}年${month}月`;
  };

  const renderCommentUserMeta = (
    commentCount?: number,
    totalRating?: number,
    joinedAt?: string | null,
    compact = false
  ) => (
    <div
      className={`mt-0.5 flex flex-nowrap items-center gap-x-2 font-normal text-slate-500 md:gap-x-3 ${
        compact ? "text-[10px]" : "text-[10px] md:text-[11px]"
      }`}
    >
      <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
        <MessageSquare className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
        {Number(commentCount ?? 0)} コメント
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
        <ThumbsUp className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
        {Number(totalRating ?? 0)} 総合評価
      </span>
      <span className="hidden items-center gap-1 whitespace-nowrap md:inline-flex">
        <Calendar className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
        参加日 {formatJoinedDate(joinedAt)}
      </span>
    </div>
  );

  const openReportDialog = (type: "comment" | "reply", id: string) => {
    if (!currentUser) {
      alert("通報するには、ログインが必要です。");
      return;
    }
    setReportMenuKey(null);
    setReportTarget({ type, id });
    setReportReason("");
    setReportDetails("");
    setReportError(null);
    setReportSuccess(false);
  };

  const closeReportDialog = () => {
    if (reportSubmitting) return;
    setReportTarget(null);
    setReportReason("");
    setReportDetails("");
    setReportError(null);
    setReportSuccess(false);
  };

  const handleReportSubmit = async () => {
    if (!currentUser || !reportTarget || !reportReason || reportSubmitting) return;
    setReportSubmitting(true);
    setReportError(null);

    const { data: insertedReport, error } = await supabase
      .from("comment_reports")
      .insert({
        reporter_user_id: currentUser.id,
        comment_id: reportTarget.type === "comment" ? reportTarget.id : null,
        reply_id: reportTarget.type === "reply" ? reportTarget.id : null,
        reason: reportReason,
        details: reportDetails.trim() || null,
      })
      .select("id")
      .single();

    if (error) {
      if ((error as any).code === "23505") {
        setReportError("このコメントはすでに通報済みです。");
      } else {
        console.error("comment report error:", error);
        setReportError("通報の送信に失敗しました。もう一度お試しください。");
      }
      setReportSubmitting(false);
      return;
    }

    // 通報自体の保存を最優先にし、メール通知の失敗では通報を失敗扱いにしない。
    if (insertedReport?.id) {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.access_token) {
          const response = await fetch("/api/report-notification", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ reportId: insertedReport.id }),
          });

          if (!response.ok) {
            const result = await response.json().catch(() => null);
            console.warn(
              "report email notification warn:",
              result ?? response.status
            );
          }
        }
      } catch (emailError) {
        console.warn("report email notification warn:", emailError);
      }
    }

    setReportSuccess(true);
    setReportSubmitting(false);
  };

  const renderReportMenu = (
    type: "comment" | "reply",
    id: string,
    authorUserId: string | null,
    compact = false
  ) => {
    if (!currentUser || authorUserId === currentUser.id) return null;
    const key = `${type}-${id}`;
    const open = reportMenuKey === key;

    return (
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setReportMenuKey(open ? null : key)}
          className={`inline-flex cursor-pointer items-center justify-center rounded-full border border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-slate-700 ${compact ? "h-7 w-7" : "h-8 w-8"}`}
          aria-label="コメントメニュー"
          title="メニュー"
        >
          <MoreHorizontal className={compact ? "h-4 w-4" : "h-5 w-5"} />
        </button>
        {open ? (
          <div className="absolute right-0 top-full z-40 mt-1 w-32 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            <button
              type="button"
              onClick={() => openReportDialog(type, id)}
              className="block w-full cursor-pointer px-4 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50"
            >
              通報する
            </button>
          </div>
        ) : null}
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
            avatarUrl={reply.avatar_url}
            size="small"
          />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
{reply.user_id ? (
              <Link
                href={`/users/${reply.user_id}`}
                className="block w-fit cursor-pointer truncate text-[13px] font-semibold text-slate-800 hover:underline"
              >
                {reply.username ?? "匿名ユーザー"}
              </Link>
            ) : (
              <div className="truncate text-[13px] font-semibold text-slate-800">
                {reply.username ?? "匿名ユーザー"}
              </div>
            )}

              <UserBadge badge={reply.user_badge} />

            </div>
            {renderCommentUserMeta(
              reply.user_comment_count,
              reply.user_total_rating,
              reply.user_joined_at,
              true
            )}
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
        <div
                              className="group/reply-reaction relative inline-flex"
                              onMouseEnter={() => {
                                if (!isMobile && reply.user_id !== currentUser?.id) {
                                  setReactionPickerKey(`reply:${reply.id}`);
                                }
                              }}
                              onMouseLeave={() => {
                                if (!isMobile) setReactionPickerKey(null);
                              }}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <button
                                type="button"
                                disabled={
                                  replyLikingId === reply.id ||
                                  reply.user_id === currentUser?.id
                                }
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (reply.user_id === currentUser?.id) return;
                                  if (!currentUser) {
                                    alert("返信にリアクションするには、ログインが必要です。");
                                    return;
                                  }
                                  if (isMobile) {
                                    setReactionPickerKey((prev) =>
                                      prev === `reply:${reply.id}`
                                        ? null
                                        : `reply:${reply.id}`
                                    );
                                  }
                                }}
                                className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                  reply.reaction_type
                                    ? "text-[#006888]"
                                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                }`}
                                aria-label="リアクション"
                              >
                                <CommentReactionSummary
                                  counts={reply.reaction_counts}
                                  selected={reply.reaction_type}
                                />
                              </button>

                              {reactionPickerKey === `reply:${reply.id}` ? (
                                <div
                                  className="absolute bottom-full left-0 z-50 pb-1"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <CommentReactionPicker
                                    selected={reply.reaction_type}
                                    counts={reply.reaction_counts}
                                    disabled={replyLikingId === reply.id}
                                    onSelect={(reaction) =>
                                      handleReplyReaction(reply.id, reaction)
                                    }
                                  />
                                </div>
                              ) : null}
                            </div>

        <button
          type="button"
          onClick={() =>
            handleReplyToReply(parent.id, reply.username)
          }
          className="cursor-pointer rounded-full border border-slate-300 px-3 py-1 text-[12px] text-slate-700 hover:bg-slate-50"
        >
          返信
        </button>
        <div className="ml-auto">{renderReportMenu("reply", reply.id, reply.user_id, true)}</div>
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
                      avatarUrl={reply.avatar_url}
                      size="normal"
                    />
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-1.5">
{reply.user_id ? (
                        <Link
                          href={`/users/${reply.user_id}`}
                          className="block w-fit cursor-pointer text-[15px] font-semibold text-slate-800 hover:underline"
                        >
                          {reply.username ?? "匿名ユーザー"}
                        </Link>
                      ) : (
                        <div className="text-[15px] font-semibold text-slate-800">
                          {reply.username ?? "匿名ユーザー"}
                        </div>
                      )}

                        <UserBadge badge={reply.user_badge} />

                      </div>
                      {renderCommentUserMeta(
                        reply.user_comment_count,
                        reply.user_total_rating,
                        reply.user_joined_at
                      )}
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
                  <div
                              className="group/reply-reaction relative inline-flex"
                              onMouseEnter={() => {
                                if (!isMobile && reply.user_id !== currentUser?.id) {
                                  setReactionPickerKey(`reply:${reply.id}`);
                                }
                              }}
                              onMouseLeave={() => {
                                if (!isMobile) setReactionPickerKey(null);
                              }}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <button
                                type="button"
                                disabled={
                                  replyLikingId === reply.id ||
                                  reply.user_id === currentUser?.id
                                }
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (reply.user_id === currentUser?.id) return;
                                  if (!currentUser) {
                                    alert("返信にリアクションするには、ログインが必要です。");
                                    return;
                                  }
                                  if (isMobile) {
                                    setReactionPickerKey((prev) =>
                                      prev === `reply:${reply.id}`
                                        ? null
                                        : `reply:${reply.id}`
                                    );
                                  }
                                }}
                                className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                  reply.reaction_type
                                    ? "text-[#006888]"
                                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                }`}
                                aria-label="リアクション"
                              >
                                <CommentReactionSummary
                                  counts={reply.reaction_counts}
                                  selected={reply.reaction_type}
                                />
                              </button>

                              {reactionPickerKey === `reply:${reply.id}` ? (
                                <div
                                  className="absolute bottom-full left-0 z-50 pb-1"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <CommentReactionPicker
                                    selected={reply.reaction_type}
                                    counts={reply.reaction_counts}
                                    disabled={replyLikingId === reply.id}
                                    onSelect={(reaction) =>
                                      handleReplyReaction(reply.id, reaction)
                                    }
                                  />
                                </div>
                              ) : null}
                            </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleReplyToReply(parent.id, reply.username)
                    }
                    className="cursor-pointer rounded-full border border-slate-300 px-3 py-1.5 text-[13px] text-slate-700 hover:bg-slate-50"
                  >
                    返信
                  </button>
                  <div className="ml-auto">{renderReportMenu("reply", reply.id, reply.user_id)}</div>
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
                    avatarUrl={comment.avatar_url}
                    size="normal"
                  />
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1.5">
{comment.user_id ? (
                      <Link
                        href={`/users/${comment.user_id}`}
                        className="block w-fit cursor-pointer text-[15px] font-semibold text-slate-800 hover:underline"
                      >
                        {comment.username ?? "匿名ユーザー"}
                      </Link>
                    ) : (
                      <div className="text-[15px] font-semibold text-slate-800">
                        {comment.username ?? "匿名ユーザー"}
                      </div>
                    )}

                      <UserBadge badge={comment.user_badge} />

                    </div>
                    {renderCommentUserMeta(
                      comment.user_comment_count,
                      comment.user_total_rating,
                      comment.user_joined_at
                    )}
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
                <div
                              className="group/comment-reaction relative inline-flex"
                              onMouseEnter={() => {
                                if (!isMobile && comment.user_id !== currentUser?.id) {
                                  setReactionPickerKey(`comment:${comment.id}`);
                                }
                              }}
                              onMouseLeave={() => {
                                if (!isMobile) setReactionPickerKey(null);
                              }}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <button
                                type="button"
                                disabled={
                                  commentLikingId === comment.id ||
                                  comment.user_id === currentUser?.id
                                }
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (comment.user_id === currentUser?.id) return;
                                  if (!currentUser) {
                                    alert("コメントにリアクションするには、ログインが必要です。");
                                    return;
                                  }
                                  if (isMobile) {
                                    setReactionPickerKey((prev) =>
                                      prev === `comment:${comment.id}`
                                        ? null
                                        : `comment:${comment.id}`
                                    );
                                  }
                                }}
                                className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                  comment.reaction_type
                                    ? "text-[#006888]"
                                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                }`}
                                aria-label="リアクション"
                              >
                                <CommentReactionSummary
                                  counts={comment.reaction_counts}
                                  selected={comment.reaction_type}
                                />
                              </button>

                              {reactionPickerKey === `comment:${comment.id}` ? (
                                <div
                                  className="absolute bottom-full left-0 z-50 pb-1"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <CommentReactionPicker
                                    selected={comment.reaction_type}
                                    counts={comment.reaction_counts}
                                    disabled={commentLikingId === comment.id}
                                    onSelect={(reaction) =>
                                      handleCommentReaction(comment.id, reaction)
                                    }
                                  />
                                </div>
                              ) : null}
                            </div>

                <button
                  type="button"
                  onClick={() => handleReplyToggle(comment.id)}
                  className="cursor-pointer rounded-full border border-slate-300 px-3 py-1.5 text-[13px] text-slate-700 hover:bg-slate-50"
                >
                  返信
                </button>
                <div className="ml-auto">{renderReportMenu("comment", comment.id, comment.user_id)}</div>
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
              type="submit"
              disabled={!currentUser || commentLoading || !commentBody.trim()}
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[#1677ff] text-[20px] font-semibold text-white shadow-sm hover:bg-[#0f67df] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="コメントを投稿"
              title="コメントを投稿"
            >
              {commentLoading ? (
                "…"
              ) : (
                <ArrowUp className="h-[19px] w-[19px]" strokeWidth={2} />
              )}
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
              この商品やディール内容について意見をシェアしよう！
            </p>
          </div>
        ) : (
          <div className="mb-4">
            <h3 className="text-[22px] font-bold text-slate-950">
              コメントに参加する
            </h3>
            <p className="mt-1 text-[14px] text-slate-600">
              この商品やディール内容について意見をシェアしよう！
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
                type="submit"
                disabled={!currentUser || commentLoading || !commentBody.trim()}
                className="inline-flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-full bg-[#1677ff] text-[22px] font-semibold text-white shadow-sm hover:bg-[#0f67df] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="コメントを投稿"
                title="コメントを投稿"
              >
                {commentLoading ? (
                "…"
              ) : (
                <ArrowUp className="h-[19px] w-[19px]" strokeWidth={2} />
              )}
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
          dealId={deal?.id ?? ""}
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
                  {deal.user_id ? (
                    <Link
                      href={`/users/${deal.user_id}`}
                      className="cursor-pointer font-semibold text-[#006888] hover:underline"
                    >
                      {deal.author_username ?? "匿名ユーザー"}
                    </Link>
                  ) : (
                    <span>{deal.author_username ?? "トクミッケ"}</span>
                  )}
                  <span>·</span>
                  <span>{fmtDealDateTime(deal.created_at)}</span>
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
                          {getDealVoteScore(deal)}
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
                    {deal.comment ? (
                      <div className="whitespace-pre-wrap">{deal.comment}</div>
                    ) : (
                      <p className="text-slate-500">投稿者メモはありません。</p>
                    )}
                  </div>
                ) : null}
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
                            : "max-h-[76px] overflow-hidden"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{deal.item_description}</p>
                        {!productDetailsExpanded ? (
                          <button
                            type="button"
                            onClick={() => setProductDetailsExpanded(true)}
                            className="absolute inset-x-0 bottom-0 flex h-14 cursor-pointer items-end justify-center bg-gradient-to-b from-white/0 via-white/90 to-white pb-0.5 text-[15px] font-semibold text-[#006888]"
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

        {reportTarget ? (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4" onClick={closeReportDialog}>
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-bold text-slate-900">コメントを通報</h3>
                <button type="button" onClick={closeReportDialog} disabled={reportSubmitting} className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50" aria-label="閉じる">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {reportSuccess ? (
                <div className="mt-5">
                  <p className="text-sm leading-6 text-slate-700">通報を受け付けました。ご協力ありがとうございます。</p>
                  <div className="mt-5 flex justify-end">
                    <button type="button" onClick={closeReportDialog} className="cursor-pointer rounded-full bg-[#001e43] px-5 py-2 text-sm font-semibold text-white hover:bg-[#002b66]">閉じる</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-2 text-sm leading-6 text-slate-600">通報する理由を選択してください。</p>
                  <div className="mt-4 space-y-2">
                    {[
                      ["harassment", "誹謗中傷・嫌がらせ"],
                      ["sexual", "不適切・性的な内容"],
                      ["spam", "スパム・宣伝"],
                      ["other", "その他"],
                    ].map(([value, label]) => (
                      <label key={value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 hover:bg-slate-50">
                        <input type="radio" name="report-reason" value={value} checked={reportReason === value} onChange={() => setReportReason(value as "harassment" | "sexual" | "spam" | "other")} disabled={reportSubmitting} className="cursor-pointer" />
                        {label}
                      </label>
                    ))}
                  </div>
                  <textarea rows={3} value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} disabled={reportSubmitting} placeholder="補足があれば入力してください（任意）" className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#001e43] focus:outline-none focus:ring-1 focus:ring-[#001e43]" />
                  {reportError ? <p className="mt-3 text-sm leading-5 text-red-600" role="alert">{reportError}</p> : null}
                  <div className="mt-5 flex justify-end gap-2">
                    <button type="button" onClick={closeReportDialog} disabled={reportSubmitting} className="cursor-pointer rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">キャンセル</button>
                    <button type="button" onClick={handleReportSubmit} disabled={!reportReason || reportSubmitting} className="cursor-pointer rounded-full bg-[#001e43] px-5 py-2 text-sm font-semibold text-white hover:bg-[#002b66] disabled:cursor-not-allowed disabled:opacity-50">{reportSubmitting ? "送信中..." : "通報する"}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}

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
                <div className="inline-flex h-8 shrink-0 items-center overflow-hidden rounded-full border border-slate-200 bg-white">
              <button
                type="button"
                onClick={handleLike}
                disabled={liking || disliking || deal.user_id === currentUser?.id}
                className={`inline-flex h-full cursor-pointer items-center gap-1 px-2.5 text-[13px] transition disabled:cursor-wait disabled:opacity-60 ${
                  deal.has_liked ? "text-[#006888]" : "text-slate-600"
                }`}
                aria-label="おトク！"
              >
                <ThumbsUp
                  className="h-4 w-4 shrink-0"
                  fill={deal.has_liked ? "currentColor" : "none"}
                  strokeWidth={2}
                />
                <span>{getDealVoteScore(deal)}</span>
              </button>

              <span className="h-5 w-px shrink-0 bg-slate-200" aria-hidden="true" />

              <button
                type="button"
                onClick={handleBadDeal}
                disabled={liking || disliking || deal.user_id === currentUser?.id}
                className="inline-flex h-full cursor-pointer items-center px-2.5 text-orange-500 transition disabled:cursor-wait disabled:opacity-60"
                aria-label="イマイチ"
              >
                <ThumbsDown
                  className="h-4 w-4 shrink-0"
                  fill={deal.has_disliked ? "currentColor" : "none"}
                  strokeWidth={2}
                />
              </button>
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
        dealId={deal?.id ?? ""}
        enabled={!!deal && !loading && !errorMsg}
      />

      {reportTarget ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4" onClick={closeReportDialog}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-bold text-slate-900">コメントを通報</h3>
              <button type="button" onClick={closeReportDialog} disabled={reportSubmitting} className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50" aria-label="閉じる">
                <X className="h-5 w-5" />
              </button>
            </div>
            {reportSuccess ? (
              <div className="mt-5">
                <p className="text-sm leading-6 text-slate-700">通報を受け付けました。ご協力ありがとうございます。</p>
                <div className="mt-5 flex justify-end">
                  <button type="button" onClick={closeReportDialog} className="cursor-pointer rounded-full bg-[#001e43] px-5 py-2 text-sm font-semibold text-white hover:bg-[#002b66]">閉じる</button>
                </div>
              </div>
            ) : (
              <>
                <p className="mt-2 text-sm leading-6 text-slate-600">通報する理由を選択してください。</p>
                <div className="mt-4 space-y-2">
                  {[
                    ["harassment", "誹謗中傷・嫌がらせ"],
                    ["sexual", "不適切・性的な内容"],
                    ["spam", "スパム・宣伝"],
                    ["other", "その他"],
                  ].map(([value, label]) => (
                    <label key={value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 hover:bg-slate-50">
                      <input type="radio" name="report-reason" value={value} checked={reportReason === value} onChange={() => setReportReason(value as "harassment" | "sexual" | "spam" | "other")} disabled={reportSubmitting} className="cursor-pointer" />
                      {label}
                    </label>
                  ))}
                </div>
                <textarea rows={3} value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} disabled={reportSubmitting} placeholder="補足があれば入力してください（任意）" className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#001e43] focus:outline-none focus:ring-1 focus:ring-[#001e43]" />
                {reportError ? <p className="mt-3 text-sm leading-5 text-red-600" role="alert">{reportError}</p> : null}
                <div className="mt-5 flex justify-end gap-2">
                  <button type="button" onClick={closeReportDialog} disabled={reportSubmitting} className="cursor-pointer rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">キャンセル</button>
                  <button type="button" onClick={handleReportSubmit} disabled={!reportReason || reportSubmitting} className="cursor-pointer rounded-full bg-[#001e43] px-5 py-2 text-sm font-semibold text-white hover:bg-[#002b66] disabled:cursor-not-allowed disabled:opacity-50">{reportSubmitting ? "送信中..." : "通報する"}</button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

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
                disabled={liking || disliking || deal.user_id === currentUser?.id}
                className={`inline-flex h-full cursor-pointer items-center gap-1.5 px-3 text-sm ${
                  deal.has_liked ? "text-[#006888]" : "text-slate-700"
                } disabled:cursor-not-allowed disabled:opacity-60`}
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
                <span>{getDealVoteScore(deal)}</span>
              </button>

              <span className="h-5 w-px bg-slate-200" />

              <button
                type="button"
                onClick={handleBadDeal}
                disabled={liking || disliking || deal.user_id === currentUser?.id}
                className={`inline-flex h-full cursor-pointer items-center justify-center px-3 ${
                  deal.has_disliked ? "text-orange-500" : "text-orange-500"
                } disabled:cursor-not-allowed disabled:opacity-60`}
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
                              {fmtDealDateTime(deal.created_at)}
                            </span>

                            <span className="text-xs text-slate-500">
                              ・投稿者{" "}
                              {deal.user_id ? (
                                <Link
                                  href={`/users/${deal.user_id}`}
                                  className="cursor-pointer font-semibold text-[#006888] hover:underline"
                                >
                                  {deal.author_username ?? "匿名ユーザー"}
                                </Link>
                              ) : (
                                deal.author_username ?? "匿名ユーザー"
                              )}
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
                                  {getDealVoteScore(deal)}
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
                              : "max-h-[72px] overflow-hidden"
                          }`}
                        >
                          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800">
                            {deal.item_description}
                          </p>

                          {!productDetailsExpanded ? (
                            <button
                              type="button"
                              onClick={() => setProductDetailsExpanded(true)}
                              className="absolute inset-x-0 bottom-0 flex h-16 cursor-pointer items-end justify-center bg-gradient-to-b from-white/0 via-white/90 to-white pb-1 text-sm font-semibold text-[#006888]"
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