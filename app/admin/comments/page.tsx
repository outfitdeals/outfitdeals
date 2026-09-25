"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  EyeOff,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type ModerationStatus = "visible" | "hidden";
type ItemType = "comment" | "reply";
type Filter = "all" | "hidden";

type CommentRow = {
  id: string;
  deal_id: string;
  user_id: string | null;
  body: string;
  created_at: string;
  moderation_status: ModerationStatus;
  moderated_at: string | null;
  moderation_reason: string | null;
};

type ReplyRow = {
  id: string;
  comment_id: string;
  user_id: string | null;
  body: string;
  created_at: string;
  moderation_status: ModerationStatus;
  moderated_at: string | null;
  moderation_reason: string | null;
};

type DealRow = {
  id: string;
  title: string | null;
  public_id: number | string | null;
  shop_id: string | null;
  item_id: string | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
};

type ManagedItem = {
  id: string;
  type: ItemType;
  dealId: string;
  parentCommentId: string;
  userId: string;
  username: string | null;
  body: string;
  createdAt: string;
  moderationStatus: ModerationStatus;
  moderatedAt: string | null;
  moderationReason: string | null;
  dealTitle: string | null;
  dealPath: string;
};

const PAGE_SIZE = 100;
const FETCH_CHUNK_SIZE = 1000;

function formatJapanDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatJapanDateTimeTwoLines(value: string | null) {
  if (!value) return { date: "—", time: "" };

  const date = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));

  const time = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));

  return { date, time };
}

function buildDealPath(deal: DealRow | undefined) {
  if (!deal) return "/";

  if (
    deal.public_id !== null &&
    deal.public_id !== undefined &&
    deal.shop_id &&
    deal.item_id
  ) {
    return `/deals/${deal.public_id}-${encodeURIComponent(
      deal.shop_id
    )}-${encodeURIComponent(deal.item_id)}`;
  }

  return `/deals/${deal.id}`;
}

export default function AdminCommentsPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ManagedItem[]>([]);
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionItem, setActionItem] = useState<ManagedItem | null>(null);
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadItems = async () => {
    setLoading(true);
    setErrorMessage("");

    const fetchAllRows = async <T,>(
      table: "deal_comments" | "deal_comment_replies",
      columns: string
    ): Promise<{ data: T[]; error: unknown }> => {
      const allRows: T[] = [];
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from(table)
          .select(columns)
          .order("created_at", { ascending: false })
          .range(from, from + FETCH_CHUNK_SIZE - 1);

        if (error) return { data: allRows, error };

        const rows = (data ?? []) as T[];
        allRows.push(...rows);

        if (rows.length < FETCH_CHUNK_SIZE) break;
        from += FETCH_CHUNK_SIZE;
      }

      return { data: allRows, error: null };
    };

    const [commentsResult, repliesResult] = await Promise.all([
      fetchAllRows<CommentRow>(
        "deal_comments",
        "id, deal_id, user_id, body, created_at, moderation_status, moderated_at, moderation_reason"
      ),
      fetchAllRows<ReplyRow>(
        "deal_comment_replies",
        "id, comment_id, user_id, body, created_at, moderation_status, moderated_at, moderation_reason"
      ),
    ]);

    if (commentsResult.error || repliesResult.error) {
      console.error(
        "Admin comments load error:",
        commentsResult.error || repliesResult.error
      );
      setErrorMessage("コメント情報を取得できませんでした。");
      setLoading(false);
      return;
    }

    const comments = commentsResult.data;
    const replies = repliesResult.data;

    const parentCommentIds = Array.from(
      new Set(replies.map((reply) => reply.comment_id))
    );

    let parentComments: Pick<CommentRow, "id" | "deal_id">[] = [];
    if (parentCommentIds.length > 0) {
      const { data, error } = await supabase
        .from("deal_comments")
        .select("id, deal_id")
        .in("id", parentCommentIds);

      if (error) {
        console.error("Parent comments load error:", error);
        setErrorMessage(
          "コメント一覧は取得できましたが、一部の返信先情報を取得できませんでした。"
        );
      } else {
        parentComments = (data ?? []) as Pick<CommentRow, "id" | "deal_id">[];
      }
    }

    const parentMap = new Map(
      parentComments.map((comment) => [comment.id, comment.deal_id])
    );

    const dealIds = Array.from(
      new Set([
        ...comments.map((comment) => comment.deal_id),
        ...replies
          .map((reply) => parentMap.get(reply.comment_id))
          .filter((id): id is string => Boolean(id)),
      ])
    );

    const userIds = Array.from(
      new Set(
        [
          ...comments.map((comment) => comment.user_id),
          ...replies.map((reply) => reply.user_id),
        ].filter((id): id is string => Boolean(id))
      )
    );

    const [dealsResult, profilesResult] = await Promise.all([
      dealIds.length
        ? supabase
            .from("deals")
            .select("id, title, public_id, shop_id, item_id")
            .in("id", dealIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? supabase.from("profiles").select("id, username").in("id", userIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (dealsResult.error || profilesResult.error) {
      console.error(
        "Admin comments related data error:",
        dealsResult.error || profilesResult.error
      );
      setErrorMessage(
        "コメント一覧は取得できましたが、一部の関連情報を取得できませんでした。"
      );
    }

    const deals = (dealsResult.data ?? []) as DealRow[];
    const profiles = (profilesResult.data ?? []) as ProfileRow[];
    const dealMap = new Map(deals.map((deal) => [deal.id, deal]));
    const profileMap = new Map(
      profiles.map((profile) => [profile.id, profile.username])
    );

    const normalizedComments: ManagedItem[] = comments.map((comment) => {
      const deal = dealMap.get(comment.deal_id);
      const path = buildDealPath(deal);
      return {
        id: comment.id,
        type: "comment",
        dealId: comment.deal_id,
        parentCommentId: comment.id,
        userId: comment.user_id ?? "",
        username: comment.user_id
          ? profileMap.get(comment.user_id) ?? null
          : null,
        body: comment.body,
        createdAt: comment.created_at,
        moderationStatus: comment.moderation_status,
        moderatedAt: comment.moderated_at,
        moderationReason: comment.moderation_reason,
        dealTitle: deal?.title ?? null,
        dealPath: `${path}#comment-${comment.id}`,
      };
    });

    const normalizedReplies: ManagedItem[] = replies.map((reply) => {
      const dealId = parentMap.get(reply.comment_id) ?? "";
      const deal = dealMap.get(dealId);
      const path = buildDealPath(deal);
      return {
        id: reply.id,
        type: "reply",
        dealId,
        parentCommentId: reply.comment_id,
        userId: reply.user_id ?? "",
        username: reply.user_id
          ? profileMap.get(reply.user_id) ?? null
          : null,
        body: reply.body,
        createdAt: reply.created_at,
        moderationStatus: reply.moderation_status,
        moderatedAt: reply.moderated_at,
        moderationReason: reply.moderation_reason,
        dealTitle: deal?.title ?? null,
        dealPath: dealId ? `${path}#comment-${reply.comment_id}` : "/",
      };
    });

    setItems(
      [...normalizedComments, ...normalizedReplies].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    );
    setLoading(false);
  };

  useEffect(() => {
    void loadItems();
  }, []);


  const filteredItems = useMemo(() => {
    const keyword = searchText.trim().toLocaleLowerCase("ja-JP");

    return items.filter((item) => {
      if (filter === "hidden" && item.moderationStatus !== "hidden") return false;

      if (!keyword) return true;

      return [
        item.body,
        item.username ?? "",
        item.dealTitle ?? "",
        item.id,
        item.userId,
      ].some((value) => value.toLocaleLowerCase("ja-JP").includes(keyword));
    });
  }, [filter, items, searchText]);

  const hiddenCount = useMemo(
    () => items.filter((item) => item.moderationStatus === "hidden").length,
    [items]
  );

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * PAGE_SIZE;
  const paginatedItems = filteredItems.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchText]);

  const changePage = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages);
    setCurrentPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pageNumbers = Array.from(
    new Set(
      [1, safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, totalPages].filter(
        (page) => page >= 1 && page <= totalPages
      )
    )
  ).sort((a, b) => a - b);


  const closeDialog = () => {
    if (submitting) return;
    setActionItem(null);
    setReason("");
    setActionError("");
  };

  const handleModerationChange = async () => {
    if (!actionItem || submitting) return;

    const hiding = actionItem.moderationStatus === "visible";
    const trimmedReason = reason.trim();

    if (hiding && !trimmedReason) {
      setActionError("非表示にする理由を入力してください。");
      return;
    }

    setSubmitting(true);
    setActionError("");

    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();
    const adminUser = sessionData.session?.user ?? null;

    if (sessionError || !adminUser) {
      setActionError("ログイン状態を確認できませんでした。");
      setSubmitting(false);
      return;
    }

    const table =
      actionItem.type === "comment"
        ? "deal_comments"
        : "deal_comment_replies";
    const nextStatus: ModerationStatus = hiding ? "hidden" : "visible";

    const { error: updateError } = await supabase
      .from(table)
      .update({
        moderation_status: nextStatus,
        moderated_at: hiding ? new Date().toISOString() : null,
        moderation_reason: hiding ? trimmedReason : null,
      })
      .eq("id", actionItem.id);

    if (updateError) {
      console.error("Admin comment moderation update error:", updateError);
      setActionError("コメントの状態を変更できませんでした。");
      setSubmitting(false);
      return;
    }

    const { error: auditError } = await supabase
      .from("admin_audit_logs")
      .insert({
        admin_user_id: adminUser.id,
        action: hiding
          ? actionItem.type === "comment"
            ? "hide_comment"
            : "hide_reply"
          : actionItem.type === "comment"
          ? "restore_comment"
          : "restore_reply",
        target_type: actionItem.type,
        target_id: actionItem.id,
        details: {
          user_id: actionItem.userId,
          username: actionItem.username,
          deal_id: actionItem.dealId,
          body: actionItem.body,
          previous_status: actionItem.moderationStatus,
          new_status: nextStatus,
          reason: hiding ? trimmedReason : null,
        },
      });

    if (auditError) {
      console.error("Admin audit log insert error:", auditError);
      setActionError(
        "状態は変更されましたが、操作履歴の保存に失敗しました。"
      );
      setSubmitting(false);
      await loadItems();
      return;
    }

    setActionItem(null);
    setReason("");
    setSubmitting(false);
    await loadItems();
  };

  return (
    <>
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-[#001e43] sm:text-3xl">
          コメント管理
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          コメント・返信の確認とモデレーションを行います。
        </p>
      </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <SummaryCard label="全コメント" value={items.length} />
          <SummaryCard
            label="運営非表示"
            value={hiddenCount}
            emphasis={hiddenCount > 0}
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="本文・投稿者・ディール名・IDで検索"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-[#006888] focus:ring-2 focus:ring-[#006888]/10"
                />
              </div>

              <div className="flex gap-2">
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as Filter)}
                  className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#006888]"
                  aria-label="コメント状態で絞り込み"
                >
                  <option value="all">すべて</option>
                  <option value="hidden">運営非表示</option>
                </select>

                <button
                  type="button"
                  onClick={() => void loadItems()}
                  disabled={loading}
                  className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="再読み込み"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  />
                </button>
              </div>
            </div>
          </div>

          {errorMessage ? (
            <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              コメントを読み込んでいます...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="px-4 py-16 text-center text-sm text-slate-500">
              条件に一致するコメントはありません。
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <table className="w-full table-fixed text-left">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                    <tr>
                      <th className="w-[35%] px-2 py-3">本文</th>
                      <th className="w-[14%] px-2 py-3">投稿者</th>
                      <th className="w-[18%] px-2 py-3">対象ディール</th>
                      <th className="w-[13%] px-2 py-3">投稿日</th>
                      <th className="w-[10%] px-2 py-3">状態</th>
                      <th className="w-[10%] px-2 py-3 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedItems.map((item) => (
                      <tr key={`${item.type}-${item.id}`} className="hover:bg-slate-50/70">
                        <td className="min-w-0 px-2 py-4">
                          <Link
                            href={item.dealPath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="cursor-pointer text-sm font-semibold leading-5 text-[#001e43] hover:text-[#006888] hover:underline"
                          >
                            <span className="line-clamp-3 whitespace-pre-wrap">
                              {item.body}
                            </span>
                          </Link>
                          <div className="mt-1 truncate font-mono text-[10px] text-slate-400">
                            {item.id}
                          </div>
                        </td>
                        <td className="px-2 py-4">
                          {item.userId ? (
                            <Link
                              href={`/users/${item.userId}`}
                              className="block cursor-pointer truncate text-sm font-semibold text-slate-700 hover:text-[#006888] hover:underline"
                            >
                              {item.username || "ユーザー名未設定"}
                            </Link>
                          ) : (
                            <span className="text-sm font-semibold text-slate-400">
                              投稿者不明
                            </span>
                          )}
                        </td>
                        <td className="min-w-0 px-2 py-4">
                          {item.dealId ? (
                            <Link
                              href={item.dealPath}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex cursor-pointer items-start gap-1 text-xs font-semibold text-slate-600 hover:text-[#006888]"
                            >
                              <span className="line-clamp-2">
                                {item.dealTitle || "ディール"}
                              </span>
                              <ExternalLink className="mt-0.5 h-3 w-3 flex-none" />
                            </Link>
                          ) : (
                            <span className="text-xs text-slate-400">取得不可</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2 py-4 text-xs text-slate-600">
                          {(() => {
                            const postedAt = formatJapanDateTimeTwoLines(
                              item.createdAt
                            );
                            return (
                              <div className="leading-5">
                                <div>{postedAt.date}</div>
                                <div>{postedAt.time}</div>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-2 py-4">
                          <StatusBadge item={item} />
                        </td>
                        <td className="px-2 py-4 text-right">
                          <ModerationButton
                            item={item}
                            onClick={() => {
                              setActionError("");
                              setReason("");
                              setActionItem(item);
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-100 md:hidden">
                {paginatedItems.map((item) => (
                  <article key={`${item.type}-${item.id}`} className="p-4">
                    <div className="flex justify-end">
                      <StatusBadge item={item} />
                    </div>

                    <Link
                      href={item.dealPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 block cursor-pointer whitespace-pre-wrap text-sm font-semibold leading-6 text-[#001e43] hover:text-[#006888]"
                    >
                      {item.body}
                    </Link>

                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3">
                      <MobileInfo
                        label="投稿者"
                        value={
                          item.userId
                            ? item.username || "ユーザー名未設定"
                            : "投稿者不明"
                        }
                      />
                      <MobileInfo
                        label="投稿日"
                        value={formatJapanDateTime(item.createdAt)}
                      />
                    </div>

                    {item.dealId ? (
                      <Link
                        href={item.dealPath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 flex cursor-pointer items-start gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#006888]"
                      >
                        <ExternalLink className="mt-0.5 h-3.5 w-3.5 flex-none" />
                        <span className="line-clamp-2">
                          {item.dealTitle || "対象ディールを開く"}
                        </span>
                      </Link>
                    ) : null}

                    {item.moderationStatus === "hidden" &&
                    item.moderationReason ? (
                      <div className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                        <span className="font-semibold">非表示理由：</span>
                        {item.moderationReason}
                      </div>
                    ) : null}

                    <div className="mt-3 flex justify-end">
                      <ModerationButton
                        item={item}
                        onClick={() => {
                          setActionError("");
                          setReason("");
                          setActionItem(item);
                        }}
                      />
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          全{filteredItems.length.toLocaleString("ja-JP")}件中{" "}
          {filteredItems.length === 0 ? 0 : pageStart + 1}〜
          {Math.min(pageStart + PAGE_SIZE, filteredItems.length).toLocaleString("ja-JP")}件
          ・日時は日本時間です。
        </p>

        {totalPages > 1 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => changePage(safeCurrentPage - 1)}
              disabled={safeCurrentPage === 1}
              className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              前へ
            </button>

            {pageNumbers.map((page, index) => {
              const previous = pageNumbers[index - 1];
              return (
                <div key={page} className="flex items-center gap-1.5">
                  {previous && page - previous > 1 ? (
                    <span className="px-1 text-xs text-slate-400">…</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => changePage(page)}
                    className={`cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold ${
                      page === safeCurrentPage
                        ? "border-[#006888] bg-[#006888] text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {page}
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => changePage(safeCurrentPage + 1)}
              disabled={safeCurrentPage === totalPages}
              className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              次へ
            </button>
          </div>
        ) : null}
      </div>

      {actionItem ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <div
            className="w-full rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="comment-moderation-title"
          >
            <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
              <div className="flex items-start gap-3">
                <span
                  className={`inline-flex h-10 w-10 flex-none items-center justify-center rounded-full ${
                    actionItem.moderationStatus === "visible"
                      ? "bg-red-50 text-red-600"
                      : "bg-[#006888]/10 text-[#006888]"
                  }`}
                >
                  {actionItem.moderationStatus === "visible" ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <RotateCcw className="h-5 w-5" />
                  )}
                </span>
                <div className="min-w-0">
                  <h2
                    id="comment-moderation-title"
                    className="text-lg font-bold text-[#001e43]"
                  >
                    {actionItem.moderationStatus === "visible"
                      ? `${actionItem.type === "comment" ? "コメント" : "返信"}を非表示にする`
                      : `${actionItem.type === "comment" ? "コメント" : "返信"}を復元する`}
                  </h2>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-slate-500">
                    {actionItem.body}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-4 py-4 sm:px-5">
              {actionItem.moderationStatus === "visible" ? (
                <>
                  <label
                    htmlFor="comment-moderation-reason"
                    className="block text-sm font-semibold text-slate-700"
                  >
                    非表示にする理由
                  </label>
                  <textarea
                    id="comment-moderation-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={4}
                    maxLength={1000}
                    placeholder="例：誹謗中傷、スパム、規約違反"
                    className="mt-2 w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#006888] focus:ring-2 focus:ring-[#006888]/10"
                  />
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    物理削除はせず、管理画面からあとで復元できます。
                  </p>
                </>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-600">
                  この投稿を通常表示へ戻します。
                  {actionItem.moderationReason ? (
                    <div className="mt-2 text-xs">
                      <span className="font-semibold text-slate-700">
                        現在の非表示理由：
                      </span>
                      {actionItem.moderationReason}
                    </div>
                  ) : null}
                </div>
              )}

              {actionError ? (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                  <span>{actionError}</span>
                </div>
              ) : null}
            </div>

            <div className="flex gap-2 border-t border-slate-200 px-4 py-4 sm:justify-end sm:px-5">
              <button
                type="button"
                onClick={closeDialog}
                disabled={submitting}
                className="flex-1 cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => void handleModerationChange()}
                disabled={submitting}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none ${
                  actionItem.moderationStatus === "visible"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-[#006888] hover:bg-[#00566f]"
                }`}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : actionItem.moderationStatus === "visible" ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {actionItem.moderationStatus === "visible"
                  ? "非表示にする"
                  : "復元する"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function SummaryCard({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-white px-4 py-3 shadow-sm ${
        emphasis ? "border-red-200" : "border-slate-200"
      }`}
    >
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div
        className={`mt-1 text-2xl font-bold ${
          emphasis ? "text-red-600" : "text-[#001e43]"
        }`}
      >
        {value.toLocaleString("ja-JP")}
      </div>
    </div>
  );
}

function StatusBadge({ item }: { item: ManagedItem }) {
  if (item.moderationStatus === "hidden") {
    return (
      <div>
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
          <EyeOff className="h-3.5 w-3.5" />
          運営非表示
        </span>
        {item.moderatedAt ? (
          <div className="mt-1 text-[10px] text-slate-400">
            {formatJapanDateTime(item.moderatedAt)}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
      <CheckCircle2 className="h-3.5 w-3.5" />
      表示中
    </span>
  );
}

function ModerationButton({
  item,
  onClick,
}: {
  item: ManagedItem;
  onClick: () => void;
}) {
  const hidden = item.moderationStatus === "hidden";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-semibold transition ${
        hidden
          ? "border-[#006888]/30 bg-[#006888]/5 text-[#006888] hover:bg-[#006888]/10"
          : "border-red-200 bg-white text-red-600 hover:bg-red-50"
      }`}
    >
      {hidden ? (
        <RotateCcw className="h-3.5 w-3.5" />
      ) : (
        <EyeOff className="h-3.5 w-3.5" />
      )}
      {hidden ? "復元" : "非表示"}
    </button>
  );
}

function MobileInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold text-slate-400">{label}</div>
      <div className="mt-1 truncate text-xs font-bold text-slate-700">
        {value}
      </div>
    </div>
  );
}
