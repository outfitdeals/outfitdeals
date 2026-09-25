"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type DealRow = {
  id: string;
  user_id: string | null;
  title: string | null;
  created_at: string | null;
  is_expired: boolean | null;
  public_id: number | string | null;
  shop_id: string | null;
  item_id: string | null;
  moderation_status: "visible" | "hidden";
};

type ProfileRow = {
  id: string;
  username: string | null;
};

type ManagedDeal = DealRow & {
  username: string | null;
};

type Filter = "all" | "visible" | "expired";
type BulkAction = "publish" | "expire" | "delete";

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
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [errorMessage, setErrorMessage] = useState("");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<BulkAction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");

  const loadDeals = async (page = currentPage) => {
    setLoading(true);
    setErrorMessage("");

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data: dealRows, error: dealsError, count } = await supabase
      .from("deals")
      .select(
        "id, user_id, title, created_at, is_expired, public_id, shop_id, item_id, moderation_status",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (dealsError) {
      console.error("Admin deals load error:", dealsError);
      setErrorMessage("投稿情報を取得できませんでした。");
      setLoading(false);
      return;
    }

    const rows = (dealRows ?? []) as DealRow[];
    setTotalCount(count ?? 0);

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
      if (filter === "expired" && !deal.is_expired) return false;
      if (filter === "visible" && deal.is_expired) return false;

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

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

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

  const expiredCount = useMemo(
    () => deals.filter((deal) => Boolean(deal.is_expired)).length,
    [deals]
  );

  const visibleCount = useMemo(
    () => deals.filter((deal) => !deal.is_expired).length,
    [deals]
  );

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
        : "削除する";

  const closeActionDialog = () => {
    if (submitting) return;
    setPendingAction(null);
    setActionError("");
  };

  const runBulkAction = async () => {
    if (!pendingAction || selectedIds.size === 0 || submitting) return;

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
    } else {
      const result = await supabase.from("deals").delete().in("id", ids);
      operationError = result.error;
    }

    if (operationError) {
      console.error("Admin bulk deal action error:", operationError);

      if (pendingAction === "delete") {
        setActionError(
          "削除できませんでした。コメント・いいね等の関連データが残っている可能性があります。DB側の削除ルールを確認してから安全に削除できるようにします。"
        );
      } else {
        setActionError("選択した投稿の状態を変更できませんでした。");
      }

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
            : pendingAction === "expire",
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
    setSelectedIds(new Set());
    setSubmitting(false);

    const remainingCount =
      pendingAction === "delete"
        ? Math.max(0, totalCount - ids.length)
        : totalCount;
    const nextTotalPages = Math.max(1, Math.ceil(remainingCount / PAGE_SIZE));
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
          ディールを公開中・期限切れに変更したり、不要な投稿を削除できます。
        </p>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <SummaryCard label="全投稿" value={totalCount} />
        <SummaryCard label="公開中" value={visibleCount} />
        <SummaryCard label="期限切れ" value={expiredCount} />
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
                  onChange={(event) =>
                    setFilter(event.target.value as Filter)
                  }
                  className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#006888]"
                  aria-label="投稿状態で絞り込み"
                >
                  <option value="all">すべて</option>
                  <option value="visible">公開中</option>
                  <option value="expired">期限切れ</option>
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
                    setPendingAction("delete");
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  削除する
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
                    <th className="w-[45%] px-3 py-3">投稿</th>
                    <th className="w-[18%] px-3 py-3">投稿者</th>
                    <th className="w-[19%] px-3 py-3">投稿日</th>
                    <th className="w-[13%] px-3 py-3">状態</th>
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
          全{totalCount.toLocaleString("ja-JP")}件中{" "}
          {totalCount === 0
            ? 0
            : ((currentPage - 1) * PAGE_SIZE + 1).toLocaleString("ja-JP")}
          〜
          {Math.min(currentPage * PAGE_SIZE, totalCount).toLocaleString("ja-JP")}
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
                  ? "選択した投稿を公開中に戻します。詳細ページは引き続き公開されます。"
                  : pendingAction === "expire"
                    ? "選択した投稿を期限切れにします。投稿は削除されず、検索結果や詳細ページから引き続き閲覧できます。"
                    : "選択した投稿を完全に削除します。この操作は元に戻せません。"}
              </p>

              {pendingAction === "delete" ? (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                  <span>
                    コメント・いいねなど関連データのDB制約によっては削除が拒否される場合があります。その場合はデータを壊さず停止します。
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
                ) : pendingAction === "publish" ? (
                  <CheckCircle2 className="h-4 w-4" />
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
