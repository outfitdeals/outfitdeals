"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  FileText,
  History,
  Loader2,
  MessageSquare,
  ShieldCheck,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const NAV_ITEMS = [
  { href: "/admin", label: "ダッシュボード", icon: BarChart3 },
  { href: "/admin/users", label: "ユーザー", icon: Users },
  { href: "/admin/deals", label: "投稿", icon: FileText },
  { href: "/admin/comments", label: "コメント", icon: MessageSquare },
  { href: "/admin/reports", label: "通報", icon: AlertTriangle },
  { href: "/admin/audit-logs", label: "操作履歴", icon: History },
];

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [pendingReports, setPendingReports] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (cancelled) return;

      if (sessionError || !sessionData.session?.user) {
        router.replace("/auth");
        return;
      }

      const { data: isAdmin, error: adminError } =
        await supabase.rpc("is_admin");

      if (cancelled) return;

      if (adminError || !isAdmin) {
        if (adminError) {
          console.error("Admin layout access check error:", adminError);
        }
        router.replace("/");
        return;
      }

      const { count, error: reportsError } = await supabase
        .from("comment_reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");

      if (!cancelled) {
        if (reportsError) {
          console.error("Admin pending reports count error:", reportsError);
        }
        setPendingReports(count ?? 0);
        setCheckingAccess(false);
      }
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  if (checkingAccess) {
    return (
      <main className="min-h-[60vh] bg-[#f7f8fa]">
        <div className="flex items-center justify-center px-4 py-20">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            管理者権限を確認しています...
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <div className="mx-auto max-w-[1500px] px-3 py-4 sm:px-4 sm:py-6">
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-[#006888] sm:mb-5">
          <ShieldCheck className="h-4 w-4" />
          トクミッケ運営管理
        </div>

        <div className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-6">
          <aside className="lg:sticky lg:top-[92px] lg:self-start">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="hidden border-b border-slate-200 px-4 py-4 lg:block">
                <div className="text-lg font-bold text-[#001e43]">管理画面</div>
                <div className="mt-1 text-xs text-slate-500">
                  サイト運営・モデレーション
                </div>
              </div>

              <nav
                className="flex overflow-x-auto p-2 lg:block"
                aria-label="管理メニュー"
              >
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active =
                    item.href === "/admin"
                      ? pathname === "/admin"
                      : pathname === item.href ||
                        pathname.startsWith(`${item.href}/`);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex flex-none cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition lg:w-full ${
                        active
                          ? "bg-[#006888]/10 text-[#006888]"
                          : "text-slate-600 hover:bg-slate-50 hover:text-[#001e43]"
                      }`}
                    >
                      <Icon className="h-4 w-4 flex-none" />
                      <span className="whitespace-nowrap">{item.label}</span>

                      {item.href === "/admin/reports" &&
                      pendingReports > 0 ? (
                        <span className="ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-5 text-white">
                          {pendingReports > 99 ? "99+" : pendingReports}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>

          <section className="min-w-0">{children}</section>
        </div>
      </div>
    </div>
  );
}
