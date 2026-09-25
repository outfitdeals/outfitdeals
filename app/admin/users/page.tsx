"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  FileText,
  History,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type ProfileRow = {
  id: string;
  username: string | null;
  created_at: string | null;
  account_status: "active" | "suspended";
  suspended_at: string | null;
  suspended_reason: string | null;
};

type UserStats = {
  deals: number;
  comments: number;
  replies: number;
};

type ManagedUser = ProfileRow & UserStats;

const PAGE_SIZE = 50;

function formatJapanDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

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

export default function AdminUsersPage() {
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "suspended"
  >("all");
  const [errorMessage, setErrorMessage] = useState("");
  const [actionUser, setActionUser] = useState<ManagedUser | null>(null);
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = async (page = currentPage) => {
    setLoading(true);
    setErrorMessage("");

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const {
      data: profileRows,
      error: profilesError,
      count,
    } = await supabase
      .from("profiles")
      .select(
        "id, username, created_at, account_status, suspended_at, suspended_reason",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (profilesError) {
      console.error("Admin users load error:", profilesError);
      setErrorMessage("ユーザー情報を取得できませんでした。");
      setLoading(false);
      return;
    }

    const profiles = (profileRows ?? []) as ProfileRow[];
    setTotalCount(count ?? 0);
    setCurrentPage(page);

    if (profiles.length === 0) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const ids = profiles.map((profile) => profile.id);

    const [
      dealsResult,
      commentsResult,
      repliesResult,
    ] = await Promise.all([
      supabase.from("deals").select("user_id").in("user_id", ids),
      supabase.from("deal_comments").select("user_id").in("user_id", ids),
      supabase
        .from("deal_comment_replies")
        .select("user_id")
        .in("user_id", ids),
    ]);

    const firstError =
      dealsResult.error || commentsResult.error || repliesResult.error;

    if (firstError) {
      console.error("Admin user stats load error:", firstError);
      setErrorMessage(
        "ユーザー一覧は取得できましたが、一部の活動件数を取得できませんでした。"
      );
    }

    const stats = new Map<string, UserStats>();

    for (const id of ids) {
      stats.set(id, { deals: 0, comments: 0, replies: 0 });
    }

    for (const row of dealsResult.data ?? []) {
      if (!row.user_id) continue;
      const current = stats.get(row.user_id);
      if (current) current.deals += 1;
    }

    for (const row of commentsResult.data ?? []) {
      if (!row.user_id) continue;
      const current = stats.get(row.user_id);
      if (current) current.comments += 1;
    }

    for (const row of repliesResult.data ?? []) {
      if (!row.user_id) continue;
      const current = stats.get(row.user_id);
      if (current) current.replies += 1;
    }

    setUsers(
      profiles.map((profile) => ({
        ...profile,
        ...(stats.get(profile.id) ?? {
          deals: 0,
          comments: 0,
          replies: 0,
        }),
      }))
    );

    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      const { data: sessionData } = await supabase.auth.getSession();

      if (cancelled) return;

      setCurrentAdminId(sessionData.session?.user?.id ?? null);
      await loadUsers(1);
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, []);


  const filteredUsers = useMemo(() => {
    const keyword = searchText.trim().toLocaleLowerCase("ja-JP");

    return users.filter((user) => {
      if (statusFilter !== "all" && user.account_status !== statusFilter) {
        return false;
      }

      if (!keyword) return true;

      return (
        (user.username ?? "").toLocaleLowerCase("ja-JP").includes(keyword) ||
        user.id.toLocaleLowerCase("ja-JP").includes(keyword)
      );
    });
  }, [searchText, statusFilter, users]);

  const suspendedCount = useMemo(
    () => users.filter((user) => user.account_status === "suspended").length,
    [users]
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pageStart = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, totalCount);

  const pageNumbers = useMemo(() => {
    const values = new Set<number>([
      1,
      totalPages,
      currentPage - 1,
      currentPage,
      currentPage + 1,
    ]);

    return Array.from(values)
      .filter((page) => page >= 1 && page <= totalPages)
      .sort((a, b) => a - b);
  }, [currentPage, totalPages]);

  const changePage = (page: number) => {
    if (loading || page < 1 || page > totalPages || page === currentPage) return;
    void loadUsers(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeActionDialog = () => {
    if (submitting) return;
    setActionUser(null);
    setReason("");
    setActionError("");
  };

  const handleAccountStatusChange = async () => {
    if (!actionUser || submitting) return;

    if (currentAdminId && actionUser.id === currentAdminId) {
      setActionError("現在ログイン中の管理者アカウントは利用停止できません。");
      return;
    }

    const suspending = actionUser.account_status === "active";
    const trimmedReason = reason.trim();

    if (suspending && !trimmedReason) {
      setActionError("利用停止の理由を入力してください。");
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

    const nextStatus = suspending ? "suspended" : "active";
    const suspendedAt = suspending ? new Date().toISOString() : null;
    const suspendedReason = suspending ? trimmedReason : null;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        account_status: nextStatus,
        suspended_at: suspendedAt,
        suspended_reason: suspendedReason,
      })
      .eq("id", actionUser.id);

    if (updateError) {
      console.error("Admin user status update error:", updateError);
      setActionError("アカウント状態を変更できませんでした。");
      setSubmitting(false);
      return;
    }

    const { error: auditError } = await supabase
      .from("admin_audit_logs")
      .insert({
        admin_user_id: adminUser.id,
        action: suspending ? "suspend_user" : "restore_user",
        target_type: "user",
        target_id: actionUser.id,
        details: {
          username: actionUser.username,
          previous_status: actionUser.account_status,
          new_status: nextStatus,
          reason: suspending ? trimmedReason : null,
        },
      });

    if (auditError) {
      console.error("Admin audit log insert error:", auditError);
      setActionError(
        "アカウント状態は変更されましたが、操作履歴の保存に失敗しました。"
      );
      setSubmitting(false);
      await loadUsers(currentPage);
      return;
    }

    setActionUser(null);
    setReason("");
    setSubmitting(false);
    await loadUsers(currentPage);
  };

  return (
    <>
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-[#001e43] sm:text-3xl">
          ユーザー管理
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          登録ユーザーの確認・利用停止・復旧を行います。
        </p>
      </div>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-[500px]">
          <SummaryCard label="全ユーザー" value={totalCount} />
          <SummaryCard
            label="利用停止"
            value={suspendedCount}
            emphasis={suspendedCount > 0}
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
                  placeholder="ユーザー名またはIDで検索"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-[#006888] focus:ring-2 focus:ring-[#006888]/10"
                />
              </div>

              <div className="flex gap-2">
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value as "all" | "active" | "suspended"
                    )
                  }
                  className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#006888]"
                  aria-label="アカウント状態で絞り込み"
                >
                  <option value="all">すべて</option>
                  <option value="active">通常</option>
                  <option value="suspended">利用停止</option>
                </select>

                <button
                  type="button"
                  onClick={() => void loadUsers(currentPage)}
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
              ユーザーを読み込んでいます...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="px-4 py-16 text-center text-sm text-slate-500">
              条件に一致するユーザーはいません。
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <table className="w-full table-fixed text-left">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                    <tr>
                      <th className="w-[30%] px-2 py-3">ユーザー</th>
                      <th className="w-[16%] px-2 py-3">登録日</th>
                      <th className="w-[9%] px-2 py-3 text-center">投稿</th>
                      <th className="w-[12%] px-2 py-3 text-center">コメント</th>
                      <th className="w-[17%] px-2 py-3">状態</th>
                      <th className="w-[16%] px-2 py-3 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/70">
                        <td className="px-2 py-4">
                          <Link
                            href={`/users/${user.id}`}
                            className="block min-w-0 cursor-pointer truncate font-semibold text-[#001e43] hover:text-[#006888] hover:underline"
                          >
                            {user.username || "ユーザー名未設定"}
                          </Link>
                          {user.id === currentAdminId ? (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[#001e43]/10 px-2 py-0.5 align-middle text-[10px] font-bold text-[#001e43]">
                              <ShieldCheck className="h-3 w-3" />
                              管理者
                            </span>
                          ) : null}
                          <div className="mt-1 truncate font-mono text-[10px] text-slate-400">
                            {user.id}
                          </div>
                        </td>
                        <td className="px-2 py-4 text-sm text-slate-600">
                          {formatJapanDate(user.created_at)}
                        </td>
                        <td className="px-2 py-4 text-center text-sm font-semibold text-slate-700">
                          {user.deals.toLocaleString("ja-JP")}
                        </td>
                        <td className="px-2 py-4 text-center text-sm font-semibold text-slate-700">
                          {(user.comments + user.replies).toLocaleString(
                            "ja-JP"
                          )}
                        </td>
                        <td className="px-2 py-4">
                          <StatusBadge status={user.account_status} />
                          {user.account_status === "suspended" &&
                          user.suspended_at ? (
                            <div className="mt-1 text-[10px] text-slate-400">
                              {formatJapanDateTime(user.suspended_at)}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-2 py-4 text-right">
                          <ActionButton
                            user={user}
                            protectedAdmin={user.id === currentAdminId}
                            onClick={() => {
                              setActionError("");
                              setReason("");
                              setActionUser(user);
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-100 md:hidden">
                {filteredUsers.map((user) => (
                  <div key={user.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/users/${user.id}`}
                          className="cursor-pointer break-words font-bold text-[#001e43] hover:text-[#006888]"
                        >
                          {user.username || "ユーザー名未設定"}
                        </Link>
                        {user.id === currentAdminId ? (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[#001e43]/10 px-2 py-0.5 align-middle text-[10px] font-bold text-[#001e43]">
                            <ShieldCheck className="h-3 w-3" />
                            管理者
                          </span>
                        ) : null}
                        <div className="mt-1 truncate font-mono text-[10px] text-slate-400">
                          {user.id}
                        </div>
                      </div>
                      <StatusBadge status={user.account_status} />
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3">
                      <MobileStat
                        label="登録日"
                        value={formatJapanDate(user.created_at)}
                      />
                      <MobileStat
                        label="投稿"
                        value={user.deals.toLocaleString("ja-JP")}
                      />
                      <MobileStat
                        label="コメント"
                        value={(user.comments + user.replies).toLocaleString(
                          "ja-JP"
                        )}
                      />
                    </div>

                    {user.account_status === "suspended" &&
                    user.suspended_reason ? (
                      <div className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                        <span className="font-semibold">停止理由：</span>
                        {user.suspended_reason}
                      </div>
                    ) : null}

                    <div className="mt-3 flex justify-end">
                      <ActionButton
                        user={user}
                        protectedAdmin={user.id === currentAdminId}
                        onClick={() => {
                          setActionError("");
                          setReason("");
                          setActionUser(user);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-400">
          全{totalCount.toLocaleString("ja-JP")}人中{" "}
          {pageStart.toLocaleString("ja-JP")}〜{pageEnd.toLocaleString("ja-JP")}人を表示・日時は日本時間です。
        </p>

        {totalPages > 1 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => changePage(currentPage - 1)}
              disabled={loading || currentPage === 1}
              className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#001e43] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              前へ
            </button>

            {pageNumbers.map((page, index) => {
              const previous = pageNumbers[index - 1];
              const showEllipsis = previous !== undefined && page - previous > 1;

              return (
                <span key={page} className="contents">
                  {showEllipsis ? (
                    <span className="px-1 text-xs text-slate-400">…</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => changePage(page)}
                    disabled={loading}
                    className={`cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      page === currentPage
                        ? "border-[#006888] bg-[#006888] text-white"
                        : "border-slate-300 bg-white text-[#001e43] hover:bg-slate-50"
                    }`}
                  >
                    {page}
                  </button>
                </span>
              );
            })}

            <button
              type="button"
              onClick={() => changePage(currentPage + 1)}
              disabled={loading || currentPage === totalPages}
              className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#001e43] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              次へ
            </button>
          </div>
        ) : null}
      </div>

      {actionUser ? (
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
            aria-labelledby="account-action-title"
          >
            <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
              <div className="flex items-start gap-3">
                <span
                  className={`inline-flex h-10 w-10 flex-none items-center justify-center rounded-full ${
                    actionUser.account_status === "active"
                      ? "bg-red-50 text-red-600"
                      : "bg-emerald-50 text-emerald-600"
                  }`}
                >
                  {actionUser.account_status === "active" ? (
                    <Ban className="h-5 w-5" />
                  ) : (
                    <UserRoundCheck className="h-5 w-5" />
                  )}
                </span>

                <div className="min-w-0">
                  <h2
                    id="account-action-title"
                    className="text-lg font-bold text-[#001e43]"
                  >
                    {actionUser.account_status === "active"
                      ? "ユーザーを利用停止"
                      : "ユーザーの利用を復旧"}
                  </h2>
                  <p className="mt-1 break-words text-sm text-slate-500">
                    {actionUser.username || "ユーザー名未設定"}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-4 py-4 sm:px-5">
              {actionUser.account_status === "active" ? (
                <>
                  <label
                    htmlFor="suspension-reason"
                    className="block text-sm font-semibold text-slate-700"
                  >
                    利用停止の理由
                  </label>
                  <textarea
                    id="suspension-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={4}
                    maxLength={1000}
                    placeholder="例：繰り返しのスパム投稿"
                    className="mt-2 w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#006888] focus:ring-2 focus:ring-[#006888]/10"
                  />
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    利用停止すると、新規ディール投稿、コメント・返信、リアクション、保存がDB側で拒否されます。
                  </p>
                </>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-600">
                  このユーザーを通常状態に戻します。
                  {actionUser.suspended_reason ? (
                    <div className="mt-2 text-xs">
                      <span className="font-semibold text-slate-700">
                        現在の停止理由：
                      </span>
                      {actionUser.suspended_reason}
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
                onClick={closeActionDialog}
                disabled={submitting}
                className="flex-1 cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
              >
                キャンセル
              </button>

              <button
                type="button"
                onClick={() => void handleAccountStatusChange()}
                disabled={submitting}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none ${
                  actionUser.account_status === "active"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-[#006888] hover:bg-[#00566f]"
                }`}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : actionUser.account_status === "active" ? (
                  <Ban className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {actionUser.account_status === "active"
                  ? "利用停止する"
                  : "復旧する"}
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

function StatusBadge({ status }: { status: "active" | "suspended" }) {
  if (status === "suspended") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
        <Ban className="h-3.5 w-3.5" />
        利用停止
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
      <CheckCircle2 className="h-3.5 w-3.5" />
      通常
    </span>
  );
}

function ActionButton({
  user,
  protectedAdmin = false,
  onClick,
}: {
  user: ManagedUser;
  protectedAdmin?: boolean;
  onClick: () => void;
}) {
  const suspended = user.account_status === "suspended";

  if (protectedAdmin) {
    return (
      <button
        type="button"
        disabled
        title="現在ログイン中の管理者アカウントは利用停止できません"
        className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-400"
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        管理者
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
        suspended
          ? "border-[#006888]/30 bg-[#006888]/5 text-[#006888] hover:bg-[#006888]/10"
          : "border-red-200 bg-white text-red-600 hover:bg-red-50"
      }`}
    >
      {suspended ? (
        <UserRoundCheck className="h-3.5 w-3.5" />
      ) : (
        <Ban className="h-3.5 w-3.5" />
      )}
      {suspended ? "復旧" : "利用停止"}
    </button>
  );
}

function MobileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 text-center">
      <div className="text-[10px] font-semibold text-slate-400">{label}</div>
      <div className="mt-1 truncate text-xs font-bold text-slate-700">
        {value}
      </div>
    </div>
  );
}
