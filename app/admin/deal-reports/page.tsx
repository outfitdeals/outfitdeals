"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  EyeOff,
  Loader2,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type ReportStatus = "pending" | "reviewed" | "actioned" | "dismissed";
type ReportReason =
  | "expired"
  | "price_wrong"
  | "not_deal"
  | "duplicate"
  | "inappropriate"
  | "other";

type DealReportRow = {
  id: string;
  reporter_user_id: string;
  deal_id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  created_at: string;
};

type DealRow = {
  id: string;
  public_id: number | string | null;
  shop_id: string | null;
  item_id: string | null;
  title: string | null;
  user_id: string | null;
  is_expired: boolean | null;
  moderation_status: "visible" | "hidden";
};

type ManagedReport = DealReportRow & {
  reporterUsername: string | null;
  deal: DealRow | null;
};

type Filter = "all" | ReportStatus;
const PAGE_SIZE = 200;

function fmtJP(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function reasonLabel(reason: ReportReason) {
  return {
    expired: "期限切れ",
    price_wrong: "価格・割引情報が違う",
    not_deal: "セール・お得情報ではない",
    duplicate: "重複投稿",
    inappropriate: "不適切・規約違反",
    other: "その他",
  }[reason];
}

function statusLabel(status: ReportStatus) {
  return {
    pending: "未対応",
    reviewed: "確認済み",
    actioned: "対応済み",
    dismissed: "却下",
  }[status];
}

function buildDealPath(deal: DealRow | null) {
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

export default function AdminDealReportsPage() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ManagedReport[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");
  const [searchText, setSearchText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [selected, setSelected] = useState<ManagedReport | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");

  const loadReports = async () => {
    setLoading(true);
    setErrorMessage("");

    const { data: reportRows, error: reportError } = await supabase
      .from("deal_reports")
      .select("id, reporter_user_id, deal_id, reason, details, status, created_at")
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (reportError) {
      console.error("Admin deal reports load error:", reportError);
      setErrorMessage("商品通報を取得できませんでした。");
      setLoading(false);
      return;
    }

    const raw = (reportRows ?? []) as DealReportRow[];
    const dealIds = Array.from(new Set(raw.map((row) => row.deal_id)));
    const reporterIds = Array.from(new Set(raw.map((row) => row.reporter_user_id)));

    const [dealsResult, profilesResult] = await Promise.all([
      dealIds.length
        ? supabase
            .from("deals")
            .select("id, public_id, shop_id, item_id, title, user_id, is_expired, moderation_status")
            .in("id", dealIds)
        : Promise.resolve({ data: [], error: null } as any),
      reporterIds.length
        ? supabase.from("profiles").select("id, username").in("id", reporterIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    const dealMap = new Map(
      ((dealsResult.data ?? []) as DealRow[]).map((deal) => [deal.id, deal])
    );
    const profileMap = new Map(
      ((profilesResult.data ?? []) as Array<{ id: string; username: string | null }>).map(
        (profile) => [profile.id, profile.username]
      )
    );

    setReports(
      raw.map((report) => ({
        ...report,
        reporterUsername: profileMap.get(report.reporter_user_id) ?? null,
        deal: dealMap.get(report.deal_id) ?? null,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    void loadReports();
  }, []);

  const filtered = useMemo(() => {
    const keyword = searchText.trim().toLocaleLowerCase("ja-JP");
    return reports.filter((report) => {
      if (filter !== "all" && report.status !== filter) return false;
      if (!keyword) return true;
      return [
        report.deal?.title ?? "",
        report.reporterUsername ?? "",
        report.details ?? "",
        reasonLabel(report.reason),
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

  const adminUser = async () => {
    const { data, error } = await supabase.auth.getSession();
    return error ? null : data.session?.user ?? null;
  };

  const audit = async (
    adminUserId: string,
    action: string,
    report: ManagedReport,
    details: Record<string, unknown>
  ) =>
    supabase.from("admin_audit_logs").insert({
      admin_user_id: adminUserId,
      action,
      target_type: "report",
      target_id: report.id,
      details,
    });

  const setStatus = async (report: ManagedReport, status: ReportStatus) => {
    if (submitting) return;
    setSubmitting(true);
    setActionError("");

    const user = await adminUser();
    if (!user) {
      setActionError("ログイン状態を確認できませんでした。");
      setSubmitting(false);
      return;
    }

    const { error } = await supabase
      .from("deal_reports")
      .update({ status })
      .eq("id", report.id);

    if (error) {
      setActionError("通報ステータスを更新できませんでした。");
      setSubmitting(false);
      return;
    }

    await audit(user.id, `deal_report_${status}`, report, {
      previous_status: report.status,
      new_status: status,
      deal_id: report.deal_id,
      reason: report.reason,
    });

    setSelected(null);
    setSubmitting(false);
    await loadReports();
  };

  const moderateDeal = async (
    report: ManagedReport,
    action: "expire" | "hide"
  ) => {
    if (submitting || !report.deal) return;
    setSubmitting(true);
    setActionError("");

    const user = await adminUser();
    if (!user) {
      setActionError("ログイン状態を確認できませんでした。");
      setSubmitting(false);
      return;
    }

    const payload =
      action === "expire"
        ? { is_expired: true }
        : {
            moderation_status: "hidden",
            moderated_at: new Date().toISOString(),
            moderation_reason: `【通報対応】${reasonLabel(report.reason)}${
              report.details ? `：${report.details}` : ""
            }`,
          };

    const { error: dealError } = await supabase
      .from("deals")
      .update(payload)
      .eq("id", report.deal.id);

    if (dealError) {
      setActionError("投稿の状態を変更できませんでした。");
      setSubmitting(false);
      return;
    }

    const { error: reportError } = await supabase
      .from("deal_reports")
      .update({ status: "actioned" })
      .eq("id", report.id);

    if (reportError) {
      setActionError("投稿は変更されましたが、通報状態の更新に失敗しました。");
      setSubmitting(false);
      await loadReports();
      return;
    }

    await audit(
      user.id,
      action === "expire" ? "action_deal_report_expire" : "action_deal_report_hide",
      report,
      {
        previous_status: report.status,
        new_status: "actioned",
        deal_id: report.deal.id,
        reason: report.reason,
      }
    );

    setSelected(null);
    setSubmitting(false);
    await loadReports();
  };

  return (
    <>
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-[#001e43] sm:text-3xl">
          商品通報
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          期限切れ、価格違い、非セール商品などの報告を確認します。
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Summary label="未対応" value={counts.pending} />
        <Summary label="確認済み" value={counts.reviewed} />
        <Summary label="対応済み" value={counts.actioned} />
        <Summary label="却下" value={counts.dismissed} />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="商品名・理由・報告者で検索"
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#006888]"
              />
            </div>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as Filter)}
              className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
            >
              <option value="pending">未対応</option>
              <option value="reviewed">確認済み</option>
              <option value="actioned">対応済み</option>
              <option value="dismissed">却下</option>
              <option value="all">すべて</option>
            </select>
            <button
              type="button"
              onClick={() => void loadReports()}
              disabled={loading}
              className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="再読み込み"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
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
            商品通報を読み込んでいます...
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-16 text-center text-sm text-slate-500">
            条件に一致する商品通報はありません。
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((report) => (
              <article
                key={report.id}
                className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_150px_130px_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                      {reasonLabel(report.reason)}
                    </span>
                    <span className="text-xs text-slate-400">
                      {fmtJP(report.created_at)}
                    </span>
                  </div>
                  {report.deal ? (
                    <Link
                      href={buildDealPath(report.deal)}
                      target="_blank"
                      className="mt-2 flex w-fit max-w-full cursor-pointer items-center gap-1.5 font-bold text-[#001e43] hover:text-[#006888] hover:underline"
                    >
                      <span className="truncate">{report.deal.title || "タイトルなし"}</span>
                      <ExternalLink className="h-3.5 w-3.5 flex-none" />
                    </Link>
                  ) : (
                    <div className="mt-2 font-bold text-slate-500">削除済みの商品</div>
                  )}
                  {report.details ? (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                      {report.details}
                    </p>
                  ) : null}
                </div>

                <div className="text-xs text-slate-600">
                  報告者
                  <div className="mt-1 truncate font-semibold text-slate-800">
                    {report.reporterUsername || "ユーザー"}
                  </div>
                </div>

                <div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {statusLabel(report.status)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActionError("");
                    setSelected(report);
                  }}
                  className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  確認
                </button>
              </article>
            ))}
          </div>
        )}
      </div>

      {selected ? (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/45 sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submitting) setSelected(null);
          }}
        >
          <div className="w-full rounded-t-2xl bg-white shadow-2xl sm:max-w-xl sm:rounded-2xl">
            <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
              <h2 className="text-lg font-bold text-[#001e43]">商品通報を確認</h2>
              <p className="mt-1 text-sm font-semibold text-amber-800">
                {reasonLabel(selected.reason)}
              </p>
            </div>

            <div className="space-y-3 px-4 py-4 sm:px-5">
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <div className="text-xs text-slate-500">対象商品</div>
                <div className="mt-1 font-bold text-slate-900">
                  {selected.deal?.title || "削除済みの商品"}
                </div>
              </div>
              {selected.details ? (
                <div className="rounded-lg border border-slate-200 px-3 py-3 text-sm leading-6 text-slate-700">
                  {selected.details}
                </div>
              ) : null}
              {actionError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {actionError}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-slate-200 px-4 py-4 sm:px-5">
              <button
                type="button"
                onClick={() => void setStatus(selected, "reviewed")}
                disabled={submitting}
                className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                確認済み
              </button>
              <button
                type="button"
                onClick={() => void setStatus(selected, "dismissed")}
                disabled={submitting}
                className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed"
              >
                <XCircle className="mr-1 inline h-3.5 w-3.5" />
                却下
              </button>
              {selected.deal ? (
                <>
                  <button
                    type="button"
                    onClick={() => void moderateDeal(selected, "expire")}
                    disabled={submitting}
                    className="cursor-pointer rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed"
                  >
                    <Clock3 className="mr-1 inline h-3.5 w-3.5" />
                    期限切れにする
                  </button>
                  <button
                    type="button"
                    onClick={() => void moderateDeal(selected, "hide")}
                    disabled={submitting}
                    className="cursor-pointer rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed"
                  >
                    <EyeOff className="mr-1 inline h-3.5 w-3.5" />
                    運営非表示
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => setSelected(null)}
                disabled={submitting}
                className="ml-auto cursor-pointer rounded-lg px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-[#001e43]">
        {value.toLocaleString("ja-JP")}
      </div>
    </div>
  );
}
