"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  ChevronRight,
  FileText,
  History,
  MessageSquare,
  ShieldCheck,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type DashboardStats = {
  users: number;
  deals: number;
  comments: number;
  replies: number;
  pendingReports: number;
  views: number;
};

const EMPTY_STATS: DashboardStats = {
  users: 0,
  deals: 0,
  comments: 0,
  replies: 0,
  pendingReports: 0,
  views: 0,
};

export default function AdminPage() {
  const [loadingStats, setLoadingStats] = useState(true);
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadStats = async () => {
      setLoadingStats(true);
      setErrorMessage("");

      const [
        usersResult,
        dealsResult,
        commentsResult,
        repliesResult,
        reportsResult,
        viewsResult,
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("deals").select("id", { count: "exact", head: true }),
        supabase
          .from("deal_comments")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("deal_comment_replies")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("comment_reports")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("deal_views")
          .select("id", { count: "exact", head: true }),
      ]);

      if (cancelled) return;

      const results = [
        usersResult,
        dealsResult,
        commentsResult,
        repliesResult,
        reportsResult,
        viewsResult,
      ];

      const firstError = results.find((result) => result.error)?.error;

      if (firstError) {
        console.error("Admin dashboard stats error:", firstError);
        setErrorMessage(
          "一部の管理データを取得できませんでした。ページを再読み込みしてください。"
        );
      }

      setStats({
        users: usersResult.count ?? 0,
        deals: dealsResult.count ?? 0,
        comments: commentsResult.count ?? 0,
        replies: repliesResult.count ?? 0,
        pendingReports: reportsResult.count ?? 0,
        views: viewsResult.count ?? 0,
      });

      setLoadingStats(false);
    };

    void loadStats();

    return () => {
      cancelled = true;
    };
  }, []);

  const totalDiscussion = useMemo(
    () => stats.comments + stats.replies,
    [stats.comments, stats.replies]
  );

  return (
    <>
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-[#001e43] sm:text-3xl">
          ダッシュボード
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          トクミッケ全体の状況を確認できます。
        </p>
      </div>

      {errorMessage ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <StatCard label="ユーザー" value={stats.users} loading={loadingStats} icon={<Users className="h-5 w-5" />} />
        <StatCard label="投稿" value={stats.deals} loading={loadingStats} icon={<FileText className="h-5 w-5" />} />
        <StatCard
          label="コメント"
          value={totalDiscussion}
          loading={loadingStats}
          icon={<MessageSquare className="h-5 w-5" />}
          note={`コメント ${stats.comments.toLocaleString("ja-JP")} / 返信 ${stats.replies.toLocaleString("ja-JP")}`}
        />
        <StatCard
          label="未対応通報"
          value={stats.pendingReports}
          loading={loadingStats}
          icon={<AlertTriangle className="h-5 w-5" />}
          emphasis={stats.pendingReports > 0}
        />
        <StatCard label="総閲覧" value={stats.views} loading={loadingStats} icon={<BarChart3 className="h-5 w-5" />} />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
            <h2 className="font-bold text-[#001e43]">管理メニュー</h2>
            <p className="mt-1 text-xs text-slate-500">
              管理したい項目を選択してください。
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            <DashboardLink href="/admin/users" title="ユーザー管理" description="登録ユーザーの確認・利用停止・復旧" icon={<Users className="h-5 w-5" />} />
            <DashboardLink href="/admin/deals" title="投稿管理" description="全ディールの確認・運営による非表示" icon={<FileText className="h-5 w-5" />} />
            <DashboardLink href="/admin/comments" title="コメント管理" description="コメント・返信の確認とモデレーション" icon={<MessageSquare className="h-5 w-5" />} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
            <h2 className="font-bold text-[#001e43]">モデレーション</h2>
            <p className="mt-1 text-xs text-slate-500">
              通報と運営操作を確認します。
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            <DashboardLink
              href="/admin/reports"
              title="通報管理"
              description={
                stats.pendingReports > 0
                  ? `未対応の通報が ${stats.pendingReports.toLocaleString("ja-JP")} 件あります`
                  : "現在、未対応の通報はありません"
              }
              icon={<AlertTriangle className="h-5 w-5" />}
              emphasis={stats.pendingReports > 0}
            />
            <DashboardLink href="/admin/audit-logs" title="管理操作履歴" description="運営による変更・対応履歴を確認" icon={<History className="h-5 w-5" />} />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#006888]/10 text-[#006888]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#001e43]">
              管理者専用ページ
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              このページはSupabaseの管理者判定を通過したアカウントだけが表示できます。
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  loading,
  icon,
  note,
  emphasis = false,
}: {
  label: string;
  value: number;
  loading: boolean;
  icon: React.ReactNode;
  note?: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${emphasis ? "border-red-200" : "border-slate-200"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-500">{label}</span>
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${emphasis ? "bg-red-50 text-red-600" : "bg-[#006888]/10 text-[#006888]"}`}>
          {icon}
        </span>
      </div>
      <div className={`mt-3 text-2xl font-bold ${emphasis ? "text-red-600" : "text-[#001e43]"}`}>
        {loading ? <span className="inline-block h-7 w-14 animate-pulse rounded bg-slate-100" /> : value.toLocaleString("ja-JP")}
      </div>
      {note && !loading ? <div className="mt-1 text-[11px] leading-4 text-slate-400">{note}</div> : null}
    </div>
  );
}

function DashboardLink({
  href,
  title,
  description,
  icon,
  emphasis = false,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <Link href={href} className="group flex cursor-pointer items-center gap-3 px-4 py-4 transition hover:bg-slate-50 sm:px-5">
      <span className={`inline-flex h-10 w-10 flex-none items-center justify-center rounded-full ${emphasis ? "bg-red-50 text-red-600" : "bg-[#006888]/10 text-[#006888]"}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-[#001e43]">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span>
      </span>
      <ChevronRight className="h-4 w-4 flex-none text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#006888]" />
    </Link>
  );
}
