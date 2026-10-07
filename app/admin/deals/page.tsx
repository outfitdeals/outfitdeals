"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  EyeOff,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type DealRow = {
  id: string;
  user_id: string | null;
  title: string | null;
  created_at: string | null;
  expires_at: string | null;
  is_expired: boolean | null;
  public_id: number | string | null;
  shop_id: string | null;
  item_id: string | null;
  moderation_status: "visible" | "hidden";
  likes_count: number | null;
  comments_count: number | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
};

type ManagedDeal = DealRow & {
  username: string | null;
};

type Filter = "all" | "visible" | "expired" | "hidden";
type SortKey = "title" | "created_at" | "expires_at" | "likes_count" | "comments_count" | "is_expired";
type SortDirection = "asc" | "desc";
type BulkAction = "publish" | "expire" | "hide" | "delete";
type HideReasonCode =
  | "not_deal"
  | "misleading"
  | "duplicate"
  | "prohibited"
  | "spam"
  | "other";

const HIDE_REASON_OPTIONS: Array<{
  value: HideReasonCode;
  label: string;
}> = [
  { value: "not_deal", label: "セール・お得情報ではない" },
  { value: "misleading", label: "価格・期限などの情報が不正確" },
  { value: "duplicate", label: "重複投稿" },
  { value: "prohibited", label: "規約違反・掲載不適切" },
  { value: "spam", label: "スパム・宣伝目的" },
  { value: "other", label: "その他" },
];

const PAGE_SIZE = 100;

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

function buildDealPath(deal: DealRow) {
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

export default function AdminDealsPage() {
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<ManagedDeal[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filteredTotalCount, setFilteredTotalCount] = useState(0);
  const [visibleCount, setVisibleCount] = useState(0);
  const [expiredCount, setExpiredCount] = useState(0);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [errorMessage, setErrorMessage] = useState("");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<BulkAction | null>(null);
  const [hideReasonCode, setHideReasonCode] =
    useState<HideReasonCode>("not_deal");
  const [hideReasonDetails, setHideReasonDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");

  const loadDeals = async (
    page = currentPage,
    activeFilter: Filter = filter,
    activeSortKey: SortKey = sortKey,
    activeSortDirection: SortDirection = sortDirection
  ) => {
    setLoading(true);
    setErrorMessage("");

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let dealsQuery = supabase
      .from("deals")
      .select(
        "id, user_id, title, created_at, expires_at, is_expired, public_id, shop_id, item_id, moderation_status, likes_count, comments_count",
        { count: "exact" }
      )
      .order(activeSortKey, {
        ascending: activeSortDirection === "asc",
        nullsFirst: false,
      });

    if (activeFilter === "expired") {
      dealsQuery = dealsQuery
        .eq("moderation_status", "visible")
        .eq("is_expired", true);
    } else if (activeFilter === "visible") {
      dealsQuery = dealsQuery
        .eq("moderation_status", "visible")
        .eq("is_expired", false);
    } else if (activeFilter === "hidden") {
      dealsQuery = dealsQuery.eq("moderation_status", "hidden");
    }

    const [
      { data: dealRows, error: dealsError, count: filteredCount },
      { count: allTotal, error: totalCountError },
      { count: visibleTotal, error: visibleCountError },
      { count: expiredTotal, error: expiredCountError },
      { count: hiddenTotal, error: hiddenCountError },
    ] = await Promise.all([
      dealsQuery.range(from, to),
      supabase.from("deals").select("id", { count: "exact", head: true }),
      supabase
        .from("deals")
        .select("id", { count: "exact", head: true })
        .eq("moderation_status", "visible")
        .eq("is_expired", false),
      supabase
        .from("deals")
        .select("id", { count: "exact", head: true })
        .eq("moderation_status", "visible")
        .eq("is_expired", true),
      supabase
        .from("deals")
        .select("id", { count: "exact", head: true })
        .eq("moderation_status", "hidden"),
    ]);

    if (dealsError) {
      console.error("Admin deals load error:", dealsError);
      setErrorMessage("投稿情報を取得できませんでした。");
      setLoading(false);
      return;
    }

    if (
      totalCountError ||
      visibleCountError ||
      expiredCountError ||
      hiddenCountError
    ) {
      console.error(
        "Admin deal summary count error:",
        totalCountError ??
          visibleCountError ??
          expiredCountError ??
          hiddenCountError
      );
      setErrorMessage("投稿件数を取得できませんでした。");
      setLoading(false);
      return;
    }

    const rows = (dealRows ?? []) as DealRow[];
    setTotalCount(allTotal ?? 0);
    setFilteredTotalCount(filteredCount ?? 0);
    setVisibleCount(visibleTotal ?? 0);
    setExpiredCount(expiredTotal ?? 0);
    setHiddenCount(hiddenTotal ?? 0);

    const userIds = Array.from(
      new Set(
        rows
          .map((deal) => deal.user_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    let profileMap = new Map<string, string | null>();

    if (userIds.length > 0) {
      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", userIds);

      if (profilesError) {
        console.error("Admin deal profiles load error:", profilesError);
        setErrorMessage(
          "投稿一覧は取得できましたが、一部の投稿者情報を取得できませんでした。"
        );
      } else {
        profileMap = new Map(
          ((profileRows ?? []) as ProfileRow[]).map((profile) => [
            profile.id,
            profile.username,
          ])
        );
      }
    }

    setDeals(
      rows.map((deal) => ({
        ...deal,
        username: deal.user_id ? profileMap.get(deal.user_id) ?? null : null,
      }))
    );

    setSelectedIds(new Set());
    setLoading(false);
  };

  useEffect(() => {
    void loadDeals(1);
  }, []);

  const filteredDeals = useMemo(() => {
    const keyword = searchText.trim().toLocaleLowerCase("ja-JP");

    return deals.filter((deal) => {
      if (
        filter === "expired" &&
        !(deal.moderation_status === "visible" && deal.is_expired)
      ) {
        return false;
      }
      if (
        filter === "visible" &&
        !(deal.moderation_status === "visible" && !deal.is_expired)
      ) {
        return false;
      }
      if (filter === "hidden" && deal.moderation_status !== "hidden") {
        return false;
      }

      if (!keyword) return true;

      return [
        deal.title ?? "",
        deal.username ?? "",
        deal.id,
        deal.public_id?.toString() ?? "",
        deal.shop_id ?? "",
        deal.item_id ?? "",
      ].some((value) => value.toLocaleLowerCase("ja-JP").includes(keyword));
    });
  }, [deals, filter, searchText]);

  const totalPages = Math.max(1, Math.ceil(filteredTotalCount / PAGE_SIZE));

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);

    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    return pages;
  }, [currentPage, totalPages]);

  const changePage = async (page: number) => {
    if (loading || page < 1 || page > totalPages || page === currentPage) return;
    setCurrentPage(page);
    await loadDeals(page);

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const changeSort = async (nextSortKey: SortKey) => {
    if (loading) return;

    const nextDirection: SortDirection =
      sortKey === nextSortKey && sortDirection === "desc" ? "asc" : "desc";

    setSortKey(nextSortKey);
    setSortDirection(nextDirection);
    setCurrentPage(1);
    await loadDeals(1, filter, nextSortKey, nextDirection);
  };

  const visibleFilteredIds = useMemo(
    () => filteredDeals.map((deal) => deal.id),
    [filteredDeals]
  );

  const allFilteredSelected =
    visibleFilteredIds.length > 0 &&
    visibleFilteredIds.every((id) => selectedIds.has(id));

  const toggleDeal = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (allFilteredSelected) {
        visibleFilteredIds.forEach((id) => next.delete(id));
      } else {
        visibleFilteredIds.forEach((id) => next.add(id));
      }

      return next;
    });
  };

  const selectedDeals = useMemo(
    () => deals.filter((deal) => selectedIds.has(deal.id)),
    [deals, selectedIds]
  );

  const actionLabel =
    pendingAction === "publish"
      ? "公開する"
      : pendingAction === "expire"
        ? "期限切れにする"
        : pendingAction === "hide"
          ? "運営非表示にする"
          : "完全削除する";

  const closeActionDialog = () => {
    if (submitting) return;
    setPendingAction(null);
    setHideReasonCode("not_deal");
    setHideReasonDetails("");
    setActionError("");
  };

  const runBulkAction = async () => {
    if (!pendingAction || selectedIds.size === 0 || submitting) return;

    if (
      pendingAction === "hide" &&
      hideReasonCode === "other" &&
      !hideReasonDetails.trim()
    ) {
      setActionError("「その他」を選んだ場合は理由を入力してください。");
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

    const ids = Array.from(selectedIds);
    let operationError: any = null;

    if (pendingAction === "publish") {
      const result = await supabase
        .from("deals")
        .update({
          is_expired: false,
          moderation_status: "visible",
          moderated_at: null,
          moderation_reason: null,
        })
        .in("id", ids);

      operationError = result.error;
    } else if (pendingAction === "expire") {
      const result = await supabase
        .from("deals")
        .update({
          is_expired: true,
          moderation_status: "visible",
          moderated_at: null,
          moderation_reason: null,
        })
        .in("id", ids);

      operationError = result.error;
    } else if (pendingAction === "hide") {
      const selectedReasonLabel =
        HIDE_REASON_OPTIONS.find((option) => option.value === hideReasonCode)
          ?.label ?? "その他";
      const trimmedDetails = hideReasonDetails.trim();
      const moderationReason = trimmedDetails
        ? `【${selectedReasonLabel}】${trimmedDetails}`
        : `【${selectedReasonLabel}】`;

      const result = await supabase
        .from("deals")
        .update({
          moderation_status: "hidden",
          moderated_at: new Date().toISOString(),
          moderation_reason: moderationReason,
        })
        .in("id", ids);

      operationError = result.error;
    } else {
      const result = await supabase.rpc("admin_delete_deals", {
        p_deal_ids: ids,
      });

      operationError = result.error;
    }

    if (operationError) {
      console.error("Admin bulk deal action error:", operationError);
      setActionError(
        pendingAction === "delete"
          ? "削除できませんでした。コメント・いいね等の関連データが残っている場合は、DB側の削除ルールにより拒否されることがあります。"
          : "選択した投稿の状態を変更できませんでした。"
      );
      setSubmitting(false);
      return;
    }

    const auditRows = selectedDeals.map((deal) => ({
      admin_user_id: adminUser.id,
      action:
        pendingAction === "publish"
          ? "publish_deal"
          : pendingAction === "expire"
            ? "expire_deal"
            : pendingAction === "hide"
              ? "hide_deal"
              : "delete_deal",
      target_type: "deal",
      target_id: deal.id,
      details: {
        title: deal.title,
        user_id: deal.user_id,
        username: deal.username,
        previous_is_expired: Boolean(deal.is_expired),
        new_is_expired:
          pendingAction === "delete"
            ? null
            : pendingAction === "hide"
              ? Boolean(deal.is_expired)
              : pendingAction === "expire",
        previous_status: deal.moderation_status,
        new_status:
          pendingAction === "delete"
            ? null
            : pendingAction === "hide"
              ? "hidden"
              : "visible",
        reason_code:
          pendingAction === "hide" ? hideReasonCode : null,
        reason:
          pendingAction === "hide"
            ? hideReasonDetails.trim() || null
            : pendingAction === "delete"
              ? "管理者による完全削除"
              : null,
        bulk_action: ids.length > 1,
      },
    }));

    if (auditRows.length > 0) {
      const { error: auditError } = await supabase
        .from("admin_audit_logs")
        .insert(auditRows);

      if (auditError) {
        console.error("Admin audit log insert error:", auditError);
        setActionError(
          "投稿への操作は完了しましたが、操作履歴の保存に失敗しました。"
        );
        setSubmitting(false);
        await loadDeals(currentPage);
        return;
      }
    }

    setPendingAction(null);
    setHideReasonCode("not_deal");
    setHideReasonDetails("");
    setSelectedIds(new Set());
    setSubmitting(false);

    const selectedLeavingCurrentFilter =
      pendingAction === "delete" ||
      (filter === "hidden" && pendingAction === "publish") ||
      (filter === "expired" &&
        (pendingAction === "publish" || pendingAction === "hide")) ||
      (filter === "visible" &&
        (pendingAction === "expire" || pendingAction === "hide"))
        ? ids.length
        : 0;
    const remainingFilteredCount = Math.max(
      0,
      filteredTotalCount - selectedLeavingCurrentFilter
    );
    const nextTotalPages = Math.max(
      1,
      Math.ceil(remainingFilteredCount / PAGE_SIZE)
    );
    const pageToLoad = Math.min(currentPage, nextTotalPages);

    if (pageToLoad !== currentPage) setCurrentPage(pageToLoad);
    await loadDeals(pageToLoad);
  };

  return (
    <>
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-[#001e43] sm:text-3xl">
          投稿管理
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          ディールを公開中・期限切れ・運営非表示に変更できます。物理削除は原則行いません。
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="全投稿" value={totalCount} />
        <SummaryCard label="公開中" value={visibleCount} />
        <SummaryCard label="期限切れ" value={expiredCount} />
        <SummaryCard label="運営非表示" value={hiddenCount} />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-3 sm:p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="タイトル・投稿者・ID・ショップで検索"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-[#006888] focus:ring-2 focus:ring-[#006888]/10"
                />
              </div>

              <div className="flex gap-2">
                <select
                  value={filter}
                  onChange={(event) => {
                    const nextFilter = event.target.value as Filter;
                    setFilter(nextFilter);
                    setCurrentPage(1);
                    void loadDeals(1, nextFilter);
                  }}
                  className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#006888]"
                  aria-label="投稿状態で絞り込み"
                >
                  <option value="all">すべて</option>
                  <option value="visible">公開中</option>
                  <option value="expired">期限切れ</option>
                  <option value="hidden">運営非表示</option>
                </select>

                <button
                  type="button"
                  onClick={() => void loadDeals(currentPage)}
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

            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs font-semibold text-slate-600">
                {selectedIds.size > 0
                  ? `${selectedIds.size.toLocaleString("ja-JP")}件を選択中`
                  : "左のチェックボックスで投稿を選択"}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={selectedIds.size === 0 || loading}
                  onClick={() => {
                    setActionError("");
                    setPendingAction("publish");
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  公開する
                </button>

                <button
                  type="button"
                  disabled={selectedIds.size === 0 || loading}
                  onClick={() => {
                    setActionError("");
                    setPendingAction("expire");
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  期限切れにする
                </button>

                <button
                  type="button"
                  disabled={selectedIds.size === 0 || loading}
                  onClick={() => {
                    setActionError("");
                    setHideReasonCode("not_deal");
                    setHideReasonDetails("");
                    setPendingAction("hide");
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <EyeOff className="h-3.5 w-3.5" />
                  運営非表示
                </button>

                <button
                  type="button"
                  disabled={selectedIds.size === 0 || loading}
                  onClick={() => {
                    setActionError("");
                    setPendingAction("delete");
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  完全削除
                </button>
              </div>
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
            投稿を読み込んでいます...
          </div>
        ) : filteredDeals.length === 0 ? (
          <div className="px-4 py-16 text-center text-sm text-slate-500">
            条件に一致する投稿はありません。
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <table className="w-full table-fixed text-left">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="w-[5%] px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleAllFiltered}
                        className="h-4 w-4 cursor-pointer accent-[#006888]"
                        aria-label="表示中の投稿をすべて選択"
                      />
                    </th>
                    <SortableHeader
                      label="投稿"
                      sortKey="title"
                      activeSortKey={sortKey}
                      direction={sortDirection}
                      onSort={changeSort}
                      className="w-[25%]"
                    />
                    <th className="w-[13%] px-3 py-3">投稿者</th>
                    <SortableHeader
                      label="投稿日"
                      sortKey="created_at"
                      activeSortKey={sortKey}
                      direction={sortDirection}
                      onSort={changeSort}
                      className="w-[13%]"
                    />
                    <SortableHeader
                      label="販売終了日時"
                      sortKey="expires_at"
                      activeSortKey={sortKey}
                      direction={sortDirection}
                      onSort={changeSort}
                      className="w-[15%]"
                    />
                    <SortableHeader
                      label="いいね"
                      sortKey="likes_count"
                      activeSortKey={sortKey}
                      direction={sortDirection}
                      onSort={changeSort}
                      className="w-[8%] text-center"
                      centered
                    />
                    <SortableHeader
                      label="コメント"
                      sortKey="comments_count"
                      activeSortKey={sortKey}
                      direction={sortDirection}
                      onSort={changeSort}
                      className="w-[9%] text-center"
                      centered
                    />
                    <SortableHeader
                      label="状態"
                      sortKey="is_expired"
                      activeSortKey={sortKey}
                      direction={sortDirection}
                      onSort={changeSort}
                      className="w-[12%]"
                    />
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredDeals.map((deal) => (
                    <tr
                      key={deal.id}
                      className={
                        selectedIds.has(deal.id)
                          ? "bg-[#006888]/5"
                          : "hover:bg-slate-50/70"
                      }
                    >
                      <td className="px-3 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(deal.id)}
                          onChange={() => toggleDeal(deal.id)}
                          className="h-4 w-4 cursor-pointer accent-[#006888]"
                          aria-label={`${deal.title || "投稿"}を選択`}
                        />
                      </td>

                      <td className="min-w-0 px-3 py-4">
                        <Link
                          href={buildDealPath(deal)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-w-0 cursor-pointer items-start gap-1.5 font-semibold text-[#001e43] hover:text-[#006888] hover:underline"
                        >
                          <span className="line-clamp-2">
                            {deal.title || "タイトルなし"}
                          </span>
                          <ExternalLink className="mt-0.5 h-3.5 w-3.5 flex-none" />
                        </Link>

                        <div className="mt-1 truncate font-mono text-[10px] text-slate-400">
                          {deal.id}
                        </div>
                      </td>

                      <td className="min-w-0 px-3 py-4 text-sm">
                        {deal.user_id ? (
                          <Link
                            href={`/users/${deal.user_id}`}
                            className="block cursor-pointer truncate font-semibold text-slate-700 hover:text-[#006888] hover:underline"
                          >
                            {deal.username || "ユーザー名未設定"}
                          </Link>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-3 py-4 text-xs text-slate-600">
                        {formatJapanDateTime(deal.created_at)}
                      </td>

                      <td className="whitespace-nowrap px-3 py-4 text-xs text-slate-600">
                        {formatJapanDateTime(deal.expires_at)}
                      </td>

                      <td className="px-3 py-4 text-center text-sm font-semibold text-slate-700">
                        {Math.max(0, Number(deal.likes_count ?? 0)).toLocaleString("ja-JP")}
                      </td>

                      <td className="px-3 py-4 text-center text-sm font-semibold text-slate-700">
                        {Math.max(0, Number(deal.comments_count ?? 0)).toLocaleString("ja-JP")}
                      </td>

                      <td className="px-3 py-4">
                        <DealStatus deal={deal} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {filteredDeals.map((deal) => (
                <article
                  key={deal.id}
                  className={
                    selectedIds.has(deal.id)
                      ? "bg-[#006888]/5 p-4"
                      : "p-4"
                  }
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(deal.id)}
                      onChange={() => toggleDeal(deal.id)}
                      className="mt-1 h-4 w-4 flex-none cursor-pointer accent-[#006888]"
                      aria-label={`${deal.title || "投稿"}を選択`}
                    />

                    <div className="min-w-0 flex-1">
                      <Link
                        href={buildDealPath(deal)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex cursor-pointer items-start gap-1.5 font-bold leading-5 text-[#001e43] hover:text-[#006888]"
                      >
                        <span className="line-clamp-2">
                          {deal.title || "タイトルなし"}
                        </span>
                        <ExternalLink className="mt-0.5 h-3.5 w-3.5 flex-none" />
                      </Link>

                      <div className="mt-2">
                        <DealStatus deal={deal} />
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3">
                        <MobileInfo
                          label="投稿者"
                          value={deal.username || "ユーザー名未設定"}
                        />
                        <MobileInfo
                          label="投稿日"
                          value={formatJapanDateTime(deal.created_at)}
                        />
                        <MobileInfo
                          label="販売終了日時"
                          value={formatJapanDateTime(deal.expires_at)}
                        />
                        <MobileInfo
                          label="いいね"
                          value={Math.max(0, Number(deal.likes_count ?? 0)).toLocaleString("ja-JP")}
                        />
                        <MobileInfo
                          label="コメント"
                          value={Math.max(0, Number(deal.comments_count ?? 0)).toLocaleString("ja-JP")}
                        />
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-400">
          全{filteredTotalCount.toLocaleString("ja-JP")}件中{" "}
          {filteredTotalCount === 0
            ? 0
            : ((currentPage - 1) * PAGE_SIZE + 1).toLocaleString("ja-JP")}
          〜
          {Math.min(currentPage * PAGE_SIZE, filteredTotalCount).toLocaleString("ja-JP")}
          件を表示しています。日時は日本時間です。
        </p>

        {totalPages > 1 ? (
          <nav
            className="flex flex-wrap items-center gap-1.5"
            aria-label="投稿管理ページネーション"
          >
            <button
              type="button"
              onClick={() => void changePage(currentPage - 1)}
              disabled={loading || currentPage === 1}
              className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              前へ
            </button>

            {pageNumbers[0] > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => void changePage(1)}
                  disabled={loading}
                  className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  1
                </button>
                {pageNumbers[0] > 2 ? (
                  <span className="px-1 text-xs text-slate-400">…</span>
                ) : null}
              </>
            ) : null}

            {pageNumbers.map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => void changePage(page)}
                disabled={loading}
                aria-current={page === currentPage ? "page" : undefined}
                className={`cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  page === currentPage
                    ? "border-[#006888] bg-[#006888] text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {page}
              </button>
            ))}

            {pageNumbers[pageNumbers.length - 1] < totalPages ? (
              <>
                {pageNumbers[pageNumbers.length - 1] < totalPages - 1 ? (
                  <span className="px-1 text-xs text-slate-400">…</span>
                ) : null}
                <button
                  type="button"
                  onClick={() => void changePage(totalPages)}
                  disabled={loading}
                  className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {totalPages}
                </button>
              </>
            ) : null}

            <button
              type="button"
              onClick={() => void changePage(currentPage + 1)}
              disabled={loading || currentPage === totalPages}
              className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              次へ
            </button>
          </nav>
        ) : null}
      </div>

      {pendingAction ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeActionDialog();
          }}
        >
          <div
            className="w-full rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deal-action-title"
          >
            <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
              <h2
                id="deal-action-title"
                className="text-lg font-bold text-[#001e43]"
              >
                選択した{selectedIds.size.toLocaleString("ja-JP")}件を
                {actionLabel}
              </h2>
            </div>

            <div className="px-4 py-4 sm:px-5">
              <p className="text-sm leading-6 text-slate-600">
                {pendingAction === "publish"
                  ? "選択した投稿を公開中に戻します。運営非表示の投稿も復元できます。"
                  : pendingAction === "expire"
                    ? "選択した投稿を期限切れにします。投稿記録は残り、通常一覧から除外されます。"
                    : pendingAction === "hide"
                      ? "選択した投稿を運営非表示にします。一般ユーザーには表示されず、あとから復元できます。"
                      : "選択した投稿を完全に削除します。テスト投稿など、履歴を残す必要がないものだけに使用してください。"}
              </p>

              {pendingAction === "hide" ? (
                <div className="mt-4 space-y-3">
                  <div>
                    <label
                      htmlFor="deal-hide-reason"
                      className="block text-sm font-semibold text-slate-700"
                    >
                      非表示理由
                    </label>
                    <select
                      id="deal-hide-reason"
                      value={hideReasonCode}
                      onChange={(event) =>
                        setHideReasonCode(event.target.value as HideReasonCode)
                      }
                      className="mt-2 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#006888]"
                    >
                      {HIDE_REASON_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="deal-hide-details"
                      className="block text-sm font-semibold text-slate-700"
                    >
                      補足
                      {hideReasonCode === "other" ? "（必須）" : "（任意）"}
                    </label>
                    <textarea
                      id="deal-hide-details"
                      value={hideReasonDetails}
                      onChange={(event) =>
                        setHideReasonDetails(event.target.value)
                      }
                      rows={3}
                      maxLength={1000}
                      placeholder="必要に応じて判断理由を記録"
                      className="mt-2 w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#006888] focus:ring-2 focus:ring-[#006888]/10"
                    />
                  </div>

                  <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">
                    <EyeOff className="mt-0.5 h-4 w-4 flex-none" />
                    <span>
                      物理削除はしません。投稿データと関連履歴を保持したまま公開対象から外します。
                    </span>
                  </div>
                </div>
              ) : null}

              {pendingAction === "delete" ? (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                  <span>
                    完全削除は元に戻せません。通常の不適切投稿には「運営非表示」を使い、テスト投稿・誤作成など削除して問題ないものだけに使用してください。
                  </span>
                </div>
              ) : null}

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
                onClick={closeActionDialog}
                disabled={submitting}
                className="flex-1 cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
              >
                キャンセル
              </button>

              <button
                type="button"
                onClick={() => void runBulkAction()}
                disabled={submitting}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none ${
                  pendingAction === "delete"
                    ? "bg-red-700 hover:bg-red-800"
                    : pendingAction === "hide"
                      ? "bg-red-600 hover:bg-red-700"
                      : pendingAction === "expire"
                      ? "bg-slate-700 hover:bg-slate-800"
                      : "bg-[#006888] hover:bg-[#00566f]"
                }`}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : pendingAction === "delete" ? (
                  <Trash2 className="h-4 w-4" />
                ) : pendingAction === "hide" ? (
                  <EyeOff className="h-4 w-4" />
                ) : pendingAction === "publish" ? (
                  <RotateCcw className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                {actionLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function SortableHeader({
  label,
  sortKey,
  activeSortKey,
  direction,
  onSort,
  className = "",
  centered = false,
}: {
  label: string;
  sortKey: SortKey;
  activeSortKey: SortKey;
  direction: SortDirection;
  onSort: (sortKey: SortKey) => void | Promise<void>;
  className?: string;
  centered?: boolean;
}) {
  const active = activeSortKey === sortKey;

  return (
    <th className={`${className} px-3 py-3`}>
      <button
        type="button"
        onClick={() => void onSort(sortKey)}
        className={`inline-flex cursor-pointer items-center gap-1 transition hover:text-[#006888] ${
          centered ? "justify-center" : "justify-start"
        } ${active ? "text-[#006888]" : ""}`}
        aria-label={`${label}で${
          active && direction === "desc" ? "昇順" : "降順"
        }に並び替え`}
      >
        <span>{label}</span>
        {active ? (
          direction === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5 flex-none" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 flex-none" />
          )
        ) : (
          <ChevronDown className="h-3.5 w-3.5 flex-none opacity-25" />
        )}
      </button>
    </th>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-[#001e43]">
        {value.toLocaleString("ja-JP")}
      </div>
    </div>
  );
}

function DealStatus({ deal }: { deal: ManagedDeal }) {
  if (deal.moderation_status === "hidden") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
        <EyeOff className="h-3.5 w-3.5" />
        運営非表示
      </span>
    );
  }

  if (deal.is_expired) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
        期限切れ
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
      <CheckCircle2 className="h-3.5 w-3.5" />
      公開中
    </span>
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