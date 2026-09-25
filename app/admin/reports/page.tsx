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
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type ReportStatus = "pending" | "reviewed" | "dismissed" | "actioned";
type TargetType = "comment" | "reply";
type Filter = "all" | ReportStatus;

type ReportRow = {
  id: string;
  reporter_user_id: string;
  comment_id: string | null;
  reply_id: string | null;
  reason: string;
  details: string | null;
  status: ReportStatus;
  created_at: string;
};

type CommentRow = {
  id: string;
  deal_id: string;
  user_id: string | null;
  body: string;
  moderation_status: "visible" | "hidden";
};

type ReplyRow = {
  id: string;
  comment_id: string;
  user_id: string | null;
  body: string;
  moderation_status: "visible" | "hidden";
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

type ManagedReport = ReportRow & {
  targetType: TargetType;
  targetId: string;
  targetBody: string;
  targetUserId: string | null;
  targetUsername: string | null;
  targetModerationStatus: "visible" | "hidden";
  reporterUsername: string | null;
  parentCommentId: string;
  dealId: string;
  dealTitle: string | null;
  dealPath: string;
};

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

function reasonLabel(reason: string) {
  switch (reason) {
    case "harassment":
      return "誹謗中傷・嫌がらせ";
    case "sexual":
      return "不適切・性的な内容";
    case "spam":
      return "スパム・宣伝";
    case "other":
      return "その他";
    default:
      return reason;
  }
}

function statusLabel(status: ReportStatus) {
  switch (status) {
    case "pending":
      return "未対応";
    case "reviewed":
      return "確認済み";
    case "dismissed":
      return "却下";
    case "actioned":
      return "対応済み";
  }
}

export default function AdminReportsPage() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ManagedReport[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filter, setFilter] = useState<Filter>("pending");
  const [searchText, setSearchText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [selected, setSelected] = useState<ManagedReport | null>(null);
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadReports = async (page = currentPage) => {
    setLoading(true);
    setErrorMessage("");

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const {
      data: reportRows,
      error: reportError,
      count,
    } = await supabase
      .from("comment_reports")
      .select(
        "id, reporter_user_id, comment_id, reply_id, reason, details, status, created_at",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (reportError) {
      console.error("Admin reports load error:", reportError);
      setErrorMessage("通報情報を取得できませんでした。");
      setLoading(false);
      return;
    }

    const rawReports = (reportRows ?? []) as ReportRow[];
    setTotalCount(count ?? 0);
    setCurrentPage(page);

    const commentIds = Array.from(
      new Set(
        rawReports
          .map((report) => report.comment_id)
          .filter((id): id is string => Boolean(id))
      )
    );
    const replyIds = Array.from(
      new Set(
        rawReports
          .map((report) => report.reply_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    const [commentsResult, repliesResult] = await Promise.all([
      commentIds.length
        ? supabase
            .from("deal_comments")
            .select("id, deal_id, user_id, body, moderation_status")
            .in("id", commentIds)
        : Promise.resolve({ data: [], error: null }),
      replyIds.length
        ? supabase
            .from("deal_comment_replies")
            .select("id, comment_id, user_id, body, moderation_status")
            .in("id", replyIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (commentsResult.error || repliesResult.error) {
      console.error(
        "Admin reports target load error:",
        commentsResult.error || repliesResult.error
      );
      setErrorMessage("通報対象のコメント情報を取得できませんでした。");
      setLoading(false);
      return;
    }

    const comments = (commentsResult.data ?? []) as CommentRow[];
    const replies = (repliesResult.data ?? []) as ReplyRow[];
    const commentMap = new Map(comments.map((row) => [row.id, row]));
    const replyMap = new Map(replies.map((row) => [row.id, row]));

    const missingParentIds = Array.from(
      new Set(
        replies
          .map((reply) => reply.comment_id)
          .filter((id) => !commentMap.has(id))
      )
    );

    if (missingParentIds.length > 0) {
      const { data, error } = await supabase
        .from("deal_comments")
        .select("id, deal_id, user_id, body, moderation_status")
        .in("id", missingParentIds);

      if (error) {
        console.error("Admin reports parent load error:", error);
      } else {
        for (const row of (data ?? []) as CommentRow[]) {
          commentMap.set(row.id, row);
        }
      }
    }

    const dealIds = new Set<string>();
    const userIds = new Set<string>();

    for (const report of rawReports) {
      if (report.reporter_user_id) userIds.add(report.reporter_user_id);

      if (report.comment_id) {
        const comment = commentMap.get(report.comment_id);
        if (comment?.deal_id) dealIds.add(comment.deal_id);
        if (comment?.user_id) userIds.add(comment.user_id);
      }

      if (report.reply_id) {
        const reply = replyMap.get(report.reply_id);
        if (reply?.user_id) userIds.add(reply.user_id);
        const parent = reply ? commentMap.get(reply.comment_id) : undefined;
        if (parent?.deal_id) dealIds.add(parent.deal_id);
      }
    }

    const [dealsResult, profilesResult] = await Promise.all([
      dealIds.size
        ? supabase
            .from("deals")
            .select("id, title, public_id, shop_id, item_id")
            .in("id", Array.from(dealIds))
        : Promise.resolve({ data: [], error: null }),
      userIds.size
        ? supabase
            .from("profiles")
            .select("id, username")
            .in("id", Array.from(userIds))
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (dealsResult.error || profilesResult.error) {
      console.error(
        "Admin reports related load error:",
        dealsResult.error || profilesResult.error
      );
      setErrorMessage(
        "通報一覧は取得できましたが、一部の関連情報を取得できませんでした。"
      );
    }

    const dealMap = new Map(
      ((dealsResult.data ?? []) as DealRow[]).map((deal) => [deal.id, deal])
    );
    const profileMap = new Map(
      ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [
        profile.id,
        profile.username,
      ])
    );

    const normalized = rawReports.flatMap<ManagedReport>((report): ManagedReport[] => {
      if (report.comment_id) {
        const target = commentMap.get(report.comment_id);
        if (!target) return [];

        const deal = dealMap.get(target.deal_id);
        const path = buildDealPath(deal);

        return [
          {
            ...report,
            targetType: "comment" as const,
            targetId: target.id,
            targetBody: target.body,
            targetUserId: target.user_id,
            targetUsername: target.user_id
              ? profileMap.get(target.user_id) ?? null
              : null,
            targetModerationStatus: target.moderation_status,
            reporterUsername:
              profileMap.get(report.reporter_user_id) ?? null,
            parentCommentId: target.id,
            dealId: target.deal_id,
            dealTitle: deal?.title ?? null,
            dealPath: `${path}#comment-${target.id}`,
          },
        ];
      }

      if (report.reply_id) {
        const target = replyMap.get(report.reply_id);
        if (!target) return [];

        const parent = commentMap.get(target.comment_id);
        const dealId = parent?.deal_id ?? "";
        const deal = dealMap.get(dealId);
        const path = buildDealPath(deal);

        return [
          {
            ...report,
            targetType: "reply" as const,
            targetId: target.id,
            targetBody: target.body,
            targetUserId: target.user_id,
            targetUsername: target.user_id
              ? profileMap.get(target.user_id) ?? null
              : null,
            targetModerationStatus: target.moderation_status,
            reporterUsername:
              profileMap.get(report.reporter_user_id) ?? null,
            parentCommentId: target.comment_id,
            dealId,
            dealTitle: deal?.title ?? null,
            dealPath: dealId
              ? `${path}#comment-${target.comment_id}`
              : "/",
          },
        ];
      }

      return [];
    });

    setReports(normalized);
    setLoading(false);
  };

  useEffect(() => {
    void loadReports(1);
  }, []);


  const filteredReports = useMemo(() => {
    const keyword = searchText.trim().toLocaleLowerCase("ja-JP");

    return reports.filter((report) => {
      if (filter !== "all" && report.status !== filter) return false;

      if (!keyword) return true;

      return [
        report.targetBody,
        report.details ?? "",
        report.targetUsername ?? "",
        report.reporterUsername ?? "",
        report.dealTitle ?? "",
        reasonLabel(report.reason),
        report.id,
      ].some((value) => value.toLocaleLowerCase("ja-JP").includes(keyword));
    });
  }, [filter, reports, searchText]);

  const counts = useMemo(
    () => ({
      pending: reports.filter((r) => r.status === "pending").length,
      reviewed: reports.filter((r) => r.status === "reviewed").length,
      actioned: reports.filter((r) => r.status === "actioned").length,
      dismissed: reports.filter((r) => r.status === "dismissed").length,
    }),
    [reports]
  );

  const closeDialog = () => {
    if (submitting) return;
    setSelected(null);
    setActionError("");
  };

  const writeAuditLog = async (
    adminUserId: string,
    action: string,
    report: ManagedReport,
    details: Record<string, unknown>
  ) => {
    return supabase.from("admin_audit_logs").insert({
      admin_user_id: adminUserId,
      action,
      target_type: "report",
      target_id: report.id,
      details,
    });
  };

  const updateReportStatus = async (
    report: ManagedReport,
    nextStatus: ReportStatus
  ) => {
    if (submitting) return;

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

    const { error: updateError } = await supabase
      .from("comment_reports")
      .update({ status: nextStatus })
      .eq("id", report.id);

    if (updateError) {
      console.error("Report status update error:", updateError);
      setActionError("通報ステータスを変更できませんでした。");
      setSubmitting(false);
      return;
    }

    const { error: auditError } = await writeAuditLog(
      adminUser.id,
      `report_${nextStatus}`,
      report,
      {
        previous_status: report.status,
        new_status: nextStatus,
        target_type: report.targetType,
        target_id: report.targetId,
      }
    );

    if (auditError) {
      console.error("Report audit log error:", auditError);
      setActionError(
        "通報ステータスは変更されましたが、操作履歴の保存に失敗しました。"
      );
      setSubmitting(false);
      await loadReports(currentPage);
      return;
    }

    setSelected(null);
    setSubmitting(false);
    await loadReports(currentPage);
  };

  const hideTargetAndActionReport = async (report: ManagedReport) => {
    if (submitting) return;

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
      report.targetType === "comment"
        ? "deal_comments"
        : "deal_comment_replies";

    if (report.targetModerationStatus !== "hidden") {
      const { error: targetError } = await supabase
        .from(table)
        .update({
          moderation_status: "hidden",
          moderated_at: new Date().toISOString(),
          moderation_reason: `通報対応：${reasonLabel(report.reason)}`,
        })
        .eq("id", report.targetId);

      if (targetError) {
        console.error("Reported target hide error:", targetError);
        setActionError("通報対象を非表示にできませんでした。");
        setSubmitting(false);
        return;
      }
    }

    const { error: reportError } = await supabase
      .from("comment_reports")
      .update({ status: "actioned" })
      .eq("id", report.id);

    if (reportError) {
      console.error("Report action status error:", reportError);
      setActionError(
        "対象は非表示になりましたが、通報ステータスの更新に失敗しました。"
      );
      setSubmitting(false);
      await loadReports(currentPage);
      return;
    }

    const { error: auditError } = await writeAuditLog(
      adminUser.id,
      "action_report_hide_target",
      report,
      {
        previous_report_status: report.status,
        new_report_status: "actioned",
        target_type: report.targetType,
        target_id: report.targetId,
        target_was_already_hidden:
          report.targetModerationStatus === "hidden",
        reason: report.reason,
      }
    );

    if (auditError) {
      console.error("Report action audit log error:", auditError);
      setActionError(
        "対応は完了しましたが、操作履歴の保存に失敗しました。"
      );
      setSubmitting(false);
      await loadReports(currentPage);
      return;
    }

    setSelected(null);
    setSubmitting(false);
    await loadReports(currentPage);
  };

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
    void loadReports(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-[#001e43] sm:text-3xl">
          通報管理
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          コメント・返信への通報を確認し、対応状況を管理します。
        </p>
      </div>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label="未対応" value={counts.pending} emphasis={counts.pending > 0} />
          <SummaryCard label="確認済み" value={counts.reviewed} />
          <SummaryCard label="対応済み" value={counts.actioned} />
          <SummaryCard label="却下" value={counts.dismissed} />
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
                  placeholder="本文・通報理由・ユーザー・ディール名で検索"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-[#006888] focus:ring-2 focus:ring-[#006888]/10"
                />
              </div>

              <div className="flex gap-2">
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as Filter)}
                  className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#006888]"
                >
                  <option value="pending">未対応</option>
                  <option value="reviewed">確認済み</option>
                  <option value="actioned">対応済み</option>
                  <option value="dismissed">却下</option>
                  <option value="all">すべて</option>
                </select>

                <button
                  type="button"
                  onClick={() => void loadReports(currentPage)}
                  disabled={loading}
                  className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="再読み込み"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
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
              通報を読み込んでいます...
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="px-4 py-16 text-center text-sm text-slate-500">
              条件に一致する通報はありません。
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <table className="w-full table-fixed text-left">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                    <tr>
                      <th className="w-[10%] px-2 py-3">状態</th>
                      <th className="w-[14%] px-2 py-3">通報理由</th>
                      <th className="w-[28%] px-2 py-3">対象内容</th>
                      <th className="w-[13%] px-2 py-3">対象ユーザー</th>
                      <th className="w-[12%] px-2 py-3">通報者</th>
                      <th className="w-[14%] px-2 py-3">通報日時</th>
                      <th className="w-[9%] px-2 py-3 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredReports.map((report) => (
                      <tr key={report.id} className="hover:bg-slate-50/70">
                        <td className="min-w-0 px-2 py-4">
                          <StatusBadge status={report.status} />
                        </td>
                        <td className="min-w-0 px-2 py-4 text-sm font-semibold text-slate-700">
                          {reasonLabel(report.reason)}
                        </td>
                        <td className="min-w-0 px-2 py-4">
                          <Link
                            href={report.dealPath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="cursor-pointer text-sm font-semibold leading-5 text-[#001e43] hover:text-[#006888] hover:underline"
                          >
                            <span className="line-clamp-3 whitespace-pre-wrap">
                              {report.targetBody}
                            </span>
                          </Link>
                          <div className="mt-1 text-[10px] text-slate-400">
                            {report.targetType === "comment" ? "コメント" : "返信"}
                            {report.targetModerationStatus === "hidden"
                              ? "・運営非表示済み"
                              : ""}
                          </div>
                        </td>
                        <td className="min-w-0 px-2 py-4 text-sm">
                          {report.targetUserId ? (
                            <Link
                              href={`/users/${report.targetUserId}`}
                              className="block cursor-pointer truncate font-semibold text-slate-700 hover:text-[#006888] hover:underline"
                            >
                              {report.targetUsername || "ユーザー名未設定"}
                            </Link>
                          ) : (
                            <span className="text-slate-400">投稿者不明</span>
                          )}
                        </td>
                        <td className="min-w-0 truncate px-2 py-4 text-sm text-slate-600">
                          {report.reporterUsername || "ユーザー名未設定"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-4 text-xs text-slate-600">
                          {formatJapanDateTime(report.created_at)}
                        </td>
                        <td className="px-2 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setActionError("");
                              setSelected(report);
                            }}
                            className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#001e43] transition hover:bg-slate-50"
                          >
                            詳細・対応
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-100 md:hidden">
                {filteredReports.map((report) => (
                  <article key={report.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <StatusBadge status={report.status} />
                      <span className="text-xs text-slate-400">
                        {formatJapanDateTime(report.created_at)}
                      </span>
                    </div>

                    <div className="mt-3 text-xs font-bold text-slate-500">
                      {reasonLabel(report.reason)}
                    </div>

                    <Link
                      href={report.dealPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block cursor-pointer whitespace-pre-wrap text-sm font-semibold leading-6 text-[#001e43] hover:text-[#006888]"
                    >
                      {report.targetBody}
                    </Link>

                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3">
                      <MobileInfo
                        label="対象ユーザー"
                        value={
                          report.targetUserId
                            ? report.targetUsername || "ユーザー名未設定"
                            : "投稿者不明"
                        }
                      />
                      <MobileInfo
                        label="通報者"
                        value={report.reporterUsername || "ユーザー名未設定"}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setActionError("");
                        setSelected(report);
                      }}
                      className="mt-3 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-[#001e43] transition hover:bg-slate-50"
                    >
                      詳細・対応
                    </button>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-400">
          全{totalCount.toLocaleString("ja-JP")}件中{" "}
          {pageStart.toLocaleString("ja-JP")}〜{pageEnd.toLocaleString("ja-JP")}件を表示・日時は日本時間です。
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

      {selected ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <div
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={selected.status} />
                    <span className="text-xs text-slate-400">
                      {formatJapanDateTime(selected.created_at)}
                    </span>
                  </div>
                  <h2 className="mt-3 text-lg font-bold text-[#001e43]">
                    {reasonLabel(selected.reason)}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={submitting}
                  className="cursor-pointer rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed"
                  aria-label="閉じる"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-4 px-4 py-4 sm:px-5">
              <InfoBlock
                label={`通報対象（${selected.targetType === "comment" ? "コメント" : "返信"}）`}
              >
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">
                  {selected.targetBody}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={selected.dealPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#001e43] hover:bg-slate-50"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    元のコメントを開く
                  </Link>
                  {selected.targetModerationStatus === "hidden" ? (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                      <EyeOff className="h-3.5 w-3.5" />
                      運営非表示済み
                    </span>
                  ) : null}
                </div>
              </InfoBlock>

              <div className="grid gap-3 sm:grid-cols-2">
                <InfoBlock label="対象ユーザー">
                  <p className="text-sm font-semibold text-slate-800">
                    {selected.targetUserId
                      ? selected.targetUsername || "ユーザー名未設定"
                      : "投稿者不明"}
                  </p>
                </InfoBlock>
                <InfoBlock label="通報者">
                  <p className="text-sm font-semibold text-slate-800">
                    {selected.reporterUsername || "ユーザー名未設定"}
                  </p>
                </InfoBlock>
              </div>

              <InfoBlock label="対象ディール">
                <Link
                  href={selected.dealPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex cursor-pointer items-start gap-1.5 text-sm font-semibold text-[#001e43] hover:text-[#006888] hover:underline"
                >
                  <span>{selected.dealTitle || "ディール情報を開く"}</span>
                  <ExternalLink className="mt-0.5 h-3.5 w-3.5 flex-none" />
                </Link>
              </InfoBlock>

              <InfoBlock label="通報者からの詳細">
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {selected.details?.trim() || "詳細の記入はありません。"}
                </p>
              </InfoBlock>

              {actionError ? (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                  <span>{actionError}</span>
                </div>
              ) : null}
            </div>

            <div className="border-t border-slate-200 px-4 py-4 sm:px-5">
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void updateReportStatus(selected, "reviewed")}
                  disabled={submitting || selected.status === "reviewed"}
                  className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  確認済みにする
                </button>

                <button
                  type="button"
                  onClick={() => void updateReportStatus(selected, "dismissed")}
                  disabled={submitting || selected.status === "dismissed"}
                  className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  通報を却下
                </button>

                <button
                  type="button"
                  onClick={() => void hideTargetAndActionReport(selected)}
                  disabled={
                    submitting ||
                    (selected.status === "actioned" &&
                      selected.targetModerationStatus === "hidden")
                  }
                  className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : selected.targetModerationStatus === "hidden" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                  {selected.targetModerationStatus === "hidden"
                    ? "対応済みにする"
                    : "対象を非表示にして対応済みにする"}
                </button>
              </div>
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

function StatusBadge({ status }: { status: ReportStatus }) {
  const classes =
    status === "pending"
      ? "bg-red-50 text-red-700"
      : status === "actioned"
      ? "bg-emerald-50 text-emerald-700"
      : status === "dismissed"
      ? "bg-slate-100 text-slate-600"
      : "bg-[#006888]/10 text-[#006888]";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      {statusLabel(status)}
    </span>
  );
}

function InfoBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-2 text-xs font-semibold text-slate-500">{label}</div>
      {children}
    </div>
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
