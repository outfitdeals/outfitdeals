// app/users/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  MessageSquare,
  ThumbsUp,
  User as UserIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type ProfileRow = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  created_at: string | null;
  user_badge: string | null;
};

type DealRow = {
  id: string;
  public_id: number | null;
  shop_id: string | null;
  item_id: string | null;
  created_at: string;
  title: string | null;
  price: number | null;
  market: string | null;
  shop_name: string | null;
  image_url: string | null;
  is_expired: boolean | null;
  likes_count: number | null;
  comments_count: number | null;
};

type CommentRow = {
  id: string;
  deal_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

type ReplyRow = {
  id: string;
  comment_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

type ActivityItem = {
  id: string;
  kind: "comment" | "reply";
  body: string;
  created_at: string;
  deal: DealRow | null;
  targetCommentId: string;
  likeCount: number;
};

type Tab = "deals" | "comments";

const PLACEHOLDER_IMG = "https://via.placeholder.com/160x160?text=No+Image";
const PAGE_SIZE = 20;

function normalizeDealSlugPart(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._~-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildDealDetailPath(deal: DealRow) {
  if (deal.public_id == null) return `/deals/${deal.id}`;

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

function yen(value: number | null) {
  if (value == null) return "";
  return `${Number(value).toLocaleString("ja-JP")}円`;
}

function fmtJPDate(value: string | null) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleDateString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return value;
  }
}

function fmtJPDateTime(value: string | null) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return value;
  }
}

function ProfileAvatar({
  src,
  name,
}: {
  src: string;
  name: string;
}) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [src]);

  const trimmedName = name.trim();
  const initial = trimmedName ? trimmedName.charAt(0).toUpperCase() : "";

  return (
    <div
      className="flex h-20 w-20 flex-none items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-slate-500 sm:h-24 sm:w-24"
      aria-label={
        trimmedName ? `${trimmedName}のプロフィール画像` : "プロフィール画像"
      }
    >
      {src && !imageError ? (
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : initial ? (
        <span className="select-none text-3xl font-bold uppercase text-slate-600">
          {initial}
        </span>
      ) : (
        <UserIcon className="h-10 w-10" aria-hidden="true" />
      )}
    </div>
  );
}

function Stat({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <div className="min-w-0 px-2 py-3 text-center sm:px-3">
      <div className="text-lg font-bold leading-none text-slate-900 sm:text-xl">
        {value.toLocaleString("ja-JP")}
      </div>
      <div className="mt-1.5 text-[10px] leading-tight text-slate-500 sm:text-xs">
        {label}
      </div>
    </div>
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

export default function PublicUserPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = typeof params?.id === "string" ? params.id : "";
  const tabParam = searchParams.get("tab");
  const requestedTab: Tab = tabParam === "comments" ? "comments" : "deals";

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("deals");
  const [page, setPage] = useState(1);
  const [commentPage, setCommentPage] = useState(1);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setNotFound(false);

      const [
        { data: profileData, error: profileError },
        { data: dealData, error: dealError },
        { data: commentData, error: commentError },
        { data: replyData, error: replyError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, avatar_url, created_at, user_badge")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("deals")
          .select(
            "id, public_id, shop_id, item_id, created_at, title, price, market, shop_name, image_url, is_expired, likes_count, comments_count"
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("deal_comments")
          .select("id, deal_id, user_id, body, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("deal_comment_replies")
          .select("id, comment_id, user_id, body, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) return;

      if (profileError) console.warn("load public profile warn:", profileError);
      if (dealError) console.warn("load public profile deals warn:", dealError);
      if (commentError)
        console.warn("load public profile comments warn:", commentError);
      if (replyError)
        console.warn("load public profile replies warn:", replyError);

      if (!profileData) {
        setProfile(null);
        setDeals([]);
        setActivities([]);
        setNotFound(true);
        setLoading(false);
        return;
      }

      const mappedDeals: DealRow[] = (dealData ?? []).map((deal: any) => ({
        id: String(deal.id),
        public_id: deal.public_id == null ? null : Number(deal.public_id),
        shop_id: deal.shop_id ?? null,
        item_id: deal.item_id ?? null,
        created_at: deal.created_at,
        title: deal.title ?? null,
        price: deal.price ?? null,
        market: deal.market ?? null,
        shop_name: deal.shop_name ?? null,
        image_url: deal.image_url ?? null,
        is_expired: deal.is_expired ?? null,
        likes_count: deal.likes_count ?? null,
        comments_count: deal.comments_count ?? null,
      }));

      const comments = (commentData ?? []) as CommentRow[];
      const replies = (replyData ?? []) as ReplyRow[];

      const parentCommentIds = Array.from(
        new Set(replies.map((reply) => reply.comment_id).filter(Boolean))
      );

      let parentComments: Array<{ id: string; deal_id: string }> = [];
      if (parentCommentIds.length > 0) {
        const { data, error } = await supabase
          .from("deal_comments")
          .select("id, deal_id")
          .in("id", parentCommentIds);

        if (error) {
          console.warn("load reply parent comments warn:", error);
        } else {
          parentComments = (data ?? []) as Array<{
            id: string;
            deal_id: string;
          }>;
        }
      }

      const parentById = new Map(
        parentComments.map((comment) => [comment.id, comment])
      );

      const activityDealIds = Array.from(
        new Set([
          ...comments.map((comment) => comment.deal_id),
          ...replies
            .map((reply) => parentById.get(reply.comment_id)?.deal_id ?? null)
            .filter((value): value is string => !!value),
        ])
      );

      let activityDeals: DealRow[] = [];
      if (activityDealIds.length > 0) {
        const { data, error } = await supabase
          .from("deals")
          .select(
            "id, public_id, shop_id, item_id, created_at, title, price, market, shop_name, image_url, is_expired, likes_count, comments_count"
          )
          .in("id", activityDealIds);

        if (error) {
          console.warn("load activity deals warn:", error);
        } else {
          activityDeals = (data ?? []).map((deal: any) => ({
            id: String(deal.id),
            public_id: deal.public_id == null ? null : Number(deal.public_id),
            shop_id: deal.shop_id ?? null,
            item_id: deal.item_id ?? null,
            created_at: deal.created_at,
            title: deal.title ?? null,
            price: deal.price ?? null,
            market: deal.market ?? null,
            shop_name: deal.shop_name ?? null,
            image_url: deal.image_url ?? null,
            is_expired: deal.is_expired ?? null,
            likes_count: deal.likes_count ?? null,
            comments_count: deal.comments_count ?? null,
          }));
        }
      }

      const dealById = new Map(activityDeals.map((deal) => [deal.id, deal]));

      const commentIds = comments.map((comment) => comment.id);
      const replyIds = replies.map((reply) => reply.id);

      const [
        { data: commentLikeData, error: commentLikeError },
        { data: replyLikeData, error: replyLikeError },
      ] = await Promise.all([
        commentIds.length > 0
          ? supabase
              .from("deal_comment_likes")
              .select("comment_id, reaction_type")
              .in("comment_id", commentIds)
              .in("reaction_type", ["deal", "helpful", "funny"])
          : Promise.resolve({ data: [], error: null } as any),
        replyIds.length > 0
          ? supabase
              .from("deal_comment_reply_likes")
              .select("reply_id, reaction_type")
              .in("reply_id", replyIds)
              .in("reaction_type", ["deal", "helpful", "funny"])
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (commentLikeError)
        console.warn("load comment likes warn:", commentLikeError);
      if (replyLikeError)
        console.warn("load reply likes warn:", replyLikeError);

      const commentLikeCounts = new Map<string, number>();
      (commentLikeData ?? []).forEach((row: any) => {
        const id = String(row.comment_id);
        commentLikeCounts.set(id, (commentLikeCounts.get(id) ?? 0) + 1);
      });

      const replyLikeCounts = new Map<string, number>();
      (replyLikeData ?? []).forEach((row: any) => {
        const id = String(row.reply_id);
        replyLikeCounts.set(id, (replyLikeCounts.get(id) ?? 0) + 1);
      });

      const nextActivities: ActivityItem[] = [
        ...comments.map((comment) => ({
          id: comment.id,
          kind: "comment" as const,
          body: comment.body,
          created_at: comment.created_at,
          deal: dealById.get(comment.deal_id) ?? null,
          targetCommentId: comment.id,
          likeCount: commentLikeCounts.get(comment.id) ?? 0,
        })),
        ...replies.map((reply) => {
          const parent = parentById.get(reply.comment_id);
          return {
            id: reply.id,
            kind: "reply" as const,
            body: reply.body,
            created_at: reply.created_at,
            deal: parent ? dealById.get(parent.deal_id) ?? null : null,
            targetCommentId: reply.comment_id,
            likeCount: replyLikeCounts.get(reply.id) ?? 0,
          };
        }),
      ].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setProfile({
        id: String(profileData.id),
        username: profileData.username ?? null,
        avatar_url: profileData.avatar_url ?? null,
        created_at: profileData.created_at ?? null,
        user_badge: profileData.user_badge ?? null,
      });
      setDeals(mappedDeals);
      setActivities(nextActivities);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    setPage(1);
    setCommentPage(1);
  }, [userId]);

  useEffect(() => {
    setActiveTab(requestedTab);
  }, [requestedTab]);

  const scrollToTabTop = () => {
    window.requestAnimationFrame(() => {
      document.getElementById("profile-activity-tabs")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);

    const nextParams = new URLSearchParams(searchParams.toString());

    if (tab === "comments") {
      nextParams.set("tab", "comments");
    } else {
      nextParams.delete("tab");
    }

    const query = nextParams.toString();
    router.replace(query ? `/users/${userId}?${query}` : `/users/${userId}`, {
      scroll: false,
    });
  };

  const totalPages = Math.max(1, Math.ceil(deals.length / PAGE_SIZE));
  const commentTotalPages = Math.max(
    1,
    Math.ceil(activities.length / PAGE_SIZE)
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (commentPage > commentTotalPages) {
      setCommentPage(commentTotalPages);
    }
  }, [commentPage, commentTotalPages]);

  const pageDeals = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return deals.slice(start, start + PAGE_SIZE);
  }, [deals, page]);

  const pageActivities = useMemo(() => {
    const start = (commentPage - 1) * PAGE_SIZE;
    return activities.slice(start, start + PAGE_SIZE);
  }, [activities, commentPage]);

  const dealLikesReceived = useMemo(
    () =>
      deals.reduce(
        (sum, deal) => sum + Math.max(0, Number(deal.likes_count ?? 0)),
        0
      ),
    [deals]
  );

  const commentLikesReceived = useMemo(
    () =>
      activities.reduce(
        (sum, item) => sum + Math.max(0, Number(item.likeCount ?? 0)),
        0
      ),
    [activities]
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f8fa]">
        <div className="mx-auto max-w-[760px] px-4 py-10 text-sm text-slate-500">
          読み込み中…
        </div>
      </main>
    );
  }

  if (notFound || !profile) {
    return (
      <main className="min-h-screen bg-[#f7f8fa]">
        <div className="mx-auto max-w-[760px] px-4 py-10">
          <section className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <h1 className="text-lg font-bold text-slate-900">
              ユーザーが見つかりません
            </h1>
            <Link
              href="/"
              className="mt-5 inline-flex cursor-pointer rounded-md bg-[#006888] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              トップへ戻る
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const username = profile.username?.trim() || "匿名ユーザー";

  return (
    <main className="min-h-screen bg-[#f7f8fa]">
      <div className="mx-auto w-full max-w-[760px] px-0 pb-10 pt-0 sm:px-4 sm:pt-6">
        <section className="border-b border-slate-200 bg-white sm:rounded-xl sm:border sm:shadow-sm">
          <div className="flex items-center gap-4 px-4 py-5 sm:px-6">
            <ProfileAvatar src={profile.avatar_url ?? ""} name={username} />

            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="truncate text-xl font-bold text-slate-900 sm:text-2xl">
                  {username}
                </h1>
                <UserBadge badge={profile.user_badge} />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                トクミッケ メンバー
              </p>
              <p className="mt-2 text-xs text-slate-500">
                登録日 {fmtJPDate(profile.created_at)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 border-t border-slate-200">
            <Stat value={deals.length} label="投稿" />
            <Stat value={activities.length} label="コメント" />
            <Stat value={dealLikesReceived} label="投稿へのいいね" />
            <Stat value={commentLikesReceived} label="コメントへのいいね" />
          </div>
        </section>

        <section
          id="profile-activity-tabs"
          className="mt-4 scroll-mt-4 bg-white sm:rounded-xl sm:border sm:border-slate-200 sm:shadow-sm"
        >
          <div className="grid grid-cols-2 border-b border-slate-200">
            <button
              type="button"
              onClick={() => handleTabChange("deals")}
              className={`relative cursor-pointer px-4 py-3.5 text-sm font-semibold transition ${
                activeTab === "deals"
                  ? "text-[#006888]"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              投稿したディール
              <span className="ml-1.5 text-xs font-normal text-slate-400">
                {deals.length}
              </span>
              {activeTab === "deals" ? (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#006888]" />
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("comments")}
              className={`relative cursor-pointer px-4 py-3.5 text-sm font-semibold transition ${
                activeTab === "comments"
                  ? "text-[#006888]"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              コメント
              <span className="ml-1.5 text-xs font-normal text-slate-400">
                {activities.length}
              </span>
              {activeTab === "comments" ? (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#006888]" />
              ) : null}
            </button>
          </div>

          {activeTab === "deals" ? (
            <>
              {pageDeals.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-slate-500 sm:px-6">
                  まだ投稿したディールはありません。
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {pageDeals.map((deal) => (
                    <Link
                      key={deal.id}
                      href={buildDealDetailPath(deal)}
                      className="group flex cursor-pointer gap-3 px-4 py-4 transition hover:bg-slate-50 sm:gap-4 sm:px-6"
                    >
                      <div className="h-20 w-20 flex-none overflow-hidden rounded-lg border border-slate-200 bg-white sm:h-24 sm:w-24">
                        <img
                          src={deal.image_url || PLACEHOLDER_IMG}
                          alt=""
                          className="h-full w-full object-contain"
                          onError={(event) => {
                            event.currentTarget.src = PLACEHOLDER_IMG;
                          }}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {deal.market ? (
                            <span className="text-[11px] font-semibold text-[#006888]">
                              {deal.market}
                            </span>
                          ) : null}
                          {deal.is_expired ? (
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                              終了
                            </span>
                          ) : null}
                        </div>

                        <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-slate-900 group-hover:text-[#006888]">
                          {deal.title || "タイトル未設定"}
                        </h3>

                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span className="text-base font-bold text-[#d90429]">
                            {yen(deal.price)}
                          </span>

                          {deal.shop_name ? (
                            <span className="truncate text-xs text-slate-500">
                              {deal.shop_name}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <ThumbsUp className="h-3.5 w-3.5" />
                            {Number(deal.likes_count ?? 0)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MessageSquare className="h-3.5 w-3.5" />
                            {Number(deal.comments_count ?? 0)}
                          </span>
                          <span>{fmtJPDate(deal.created_at)}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {totalPages > 1 ? (
                <div className="flex items-center justify-center gap-2 border-t border-slate-200 px-4 py-5">
                  <button
                    type="button"
                    onClick={() => {
                      setPage((current) => Math.max(1, current - 1));
                      scrollToTabTop();
                    }}
                    disabled={page === 1}
                    className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    前へ
                  </button>
                  <span className="px-2 text-xs font-semibold text-slate-600">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPage((current) =>
                        Math.min(totalPages, current + 1)
                      );
                      scrollToTabTop();
                    }}
                    disabled={page === totalPages}
                    className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    次へ
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <>
              {pageActivities.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-slate-500 sm:px-6">
                  まだコメントはありません。
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {pageActivities.map((item) => {
                    const href = item.deal
                      ? `${buildDealDetailPath(item.deal)}#comment-${item.targetCommentId}`
                      : null;

                    const content = (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 truncate text-xs font-semibold text-[#006888]">
                            {item.deal?.title || "ディール"}
                          </div>
                          <div className="flex-none text-[11px] text-slate-400">
                            {fmtJPDateTime(item.created_at)}
                          </div>
                        </div>

                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
                          {item.body}
                        </p>

                        <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                          {item.kind === "reply" ? (
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                              返信
                            </span>
                          ) : null}
                          <span className="inline-flex items-center gap-1">
                            <ThumbsUp className="h-3.5 w-3.5" />
                            {item.likeCount}
                          </span>
                        </div>
                      </>
                    );

                    return href ? (
                      <Link
                        key={`${item.kind}-${item.id}`}
                        href={href}
                        className="group block cursor-pointer px-4 py-4 transition hover:bg-slate-50 sm:px-6"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div
                        key={`${item.kind}-${item.id}`}
                        className="px-4 py-4 sm:px-6"
                      >
                        {content}
                      </div>
                    );
                  })}
                </div>
              )}

              {commentTotalPages > 1 ? (
                <div className="flex items-center justify-center gap-2 border-t border-slate-200 px-4 py-5">
                  <button
                    type="button"
                    onClick={() => {
                      setCommentPage((current) => Math.max(1, current - 1));
                      scrollToTabTop();
                    }}
                    disabled={commentPage === 1}
                    className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    前へ
                  </button>
                  <span className="px-2 text-xs font-semibold text-slate-600">
                    {commentPage} / {commentTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCommentPage((current) =>
                        Math.min(commentTotalPages, current + 1)
                      );
                      scrollToTabTop();
                    }}
                    disabled={commentPage === commentTotalPages}
                    className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    次へ
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
