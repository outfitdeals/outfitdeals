"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Menu,
  X,
  PlusCircle,
  UserCircle2,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function SiteHeader() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [menuOpen, setMenuOpen] = useState(false);
  const [myPageHref, setMyPageHref] = useState("/auth");
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        console.warn("SiteHeader getSession warn:", error);
      }

      const user = data.session?.user ?? null;

      if (!user) {
        setMyPageHref("/auth");
        setUnreadNotificationCount(0);
        return;
      }

      const { count, error: notificationError } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null);

      if (!mounted) return;

      if (notificationError) {
        console.warn("SiteHeader unread notifications warn:", notificationError);
        setUnreadNotificationCount(0);
        setMyPageHref("/mypage");
        return;
      }

      const unread = count ?? 0;
      setUnreadNotificationCount(unread);
      setMyPageHref(unread > 0 ? "/mypage?tab=notifications" : "/mypage");
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;

      if (!user) {
        setMyPageHref("/auth");
        setUnreadNotificationCount(0);
        return;
      }

      void (async () => {
        const { count, error } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .is("read_at", null);

        if (!mounted) return;

        if (error) {
          console.warn("SiteHeader unread notifications warn:", error);
          setUnreadNotificationCount(0);
          setMyPageHref("/mypage");
          return;
        }

        const unread = count ?? 0;
        setUnreadNotificationCount(unread);
        setMyPageHref(unread > 0 ? "/mypage?tab=notifications" : "/mypage");
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const refreshUnreadNotifications = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user ?? null;

      if (!user) {
        setUnreadNotificationCount(0);
        setMyPageHref("/auth");
        return;
      }

      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null);

      if (error) {
        console.warn("SiteHeader unread refresh warn:", error);
        return;
      }

      const unread = count ?? 0;
      setUnreadNotificationCount(unread);
      setMyPageHref(unread > 0 ? "/mypage?tab=notifications" : "/mypage");
    };

    const handleNotificationsChanged = () => {
      void refreshUnreadNotifications();
    };

    window.addEventListener(
      "tokumikke:notifications-changed",
      handleNotificationsChanged
    );

    return () => {
      window.removeEventListener(
        "tokumikke:notifications-changed",
        handleNotificationsChanged
      );
    };
  }, []);

  useEffect(() => {
    setSearchText(searchParams.get("q") ?? "");
  }, [searchParams]);

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const keyword = searchText.trim();

    setMenuOpen(false);

    if (!keyword) {
      router.push("/");
      return;
    }

    router.push(`/?q=${encodeURIComponent(keyword)}`);
  };

  return (
    <div className="sticky top-0 z-40">
      <div
        className="w-full px-2 py-[3px] text-center sm:py-1"
        style={{
          backgroundColor: "#006888",
          color: "#ffffff",
        }}
      >
        <div
          className="whitespace-nowrap leading-none"
          style={{
            fontSize: "clamp(8px, 2.1vw, 12px)",
          }}
        >
          トクミッケは、みんなで“おトク”を見つけてシェアするコミュニティです。
        </div>
      </div>

      <header className="relative border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1500px] px-3 sm:px-4">
          <div className="flex h-14 items-center gap-2.5 sm:h-16 sm:gap-3">
            <Link
              href="/"
              className="inline-flex flex-none items-center"
              aria-label="トクミッケ ホーム"
            >
              <img
                src="/tokumikke_logo.png"
                alt="トクミッケ"
                className="block h-9 w-auto object-contain sm:h-11"
              />
            </Link>

            <div className="min-w-0 flex-1">
              <form onSubmit={handleSearch}>
                <div className="flex items-center gap-2 rounded-full border border-slate-300 bg-[#f7f8fa] px-3 py-1.5 shadow-sm transition focus-within:border-[#006888] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#006888]/10 sm:py-2">
                  <Search className="h-[15px] w-[15px] flex-none text-slate-500 sm:h-4 sm:w-4" />

                  <input
                    id="site-search-input"
                    type="search"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="w-full min-w-0 bg-transparent text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none sm:text-sm"
                    placeholder="お得なディールを検索"
                    aria-label="ディールを検索"
                  />
                </div>
              </form>
            </div>

            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/post"
                className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold text-[#001e43] hover:bg-[#006888]/10 hover:text-[#006888]"
              >
                <PlusCircle className="h-4 w-4" />
                投稿
              </Link>

              <Link
                href={myPageHref}
                className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold text-[#001e43] hover:bg-[#006888]/10 hover:text-[#006888]"
              >
                <span className="relative inline-flex">
                  <UserCircle2 className="h-4 w-4" />
                  {unreadNotificationCount > 0 ? (
                    <span className="absolute -right-3 -top-3 inline-flex min-w-[17px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-[17px] text-white ring-2 ring-white">
                      {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                    </span>
                  ) : null}
                </span>
                マイページ
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-md text-[#001e43] hover:bg-[#006888]/10 hover:text-[#006888] sm:h-10 sm:w-10 md:hidden"
              aria-label={
                menuOpen
                  ? "メニューを閉じる"
                  : "メニューを開く"
              }
              aria-expanded={menuOpen}
            >
              {menuOpen ? (
                <X className="h-[22px] w-[22px] sm:h-6 sm:w-6" />
              ) : (
                <Menu className="h-[22px] w-[22px] sm:h-6 sm:w-6" />
              )}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div className="absolute right-3 top-[58px] z-50 w-[280px] sm:right-4 sm:top-[68px] sm:w-[340px] md:hidden">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
              <div className="px-4 py-3">
                <div className="text-sm font-semibold text-[#001e43]">
                  メニュー
                </div>
              </div>

              <div className="border-t border-slate-200">
                <Link
                  href="/post"
                  className="flex items-center gap-3 px-4 py-4 hover:bg-slate-50"
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#001e43] text-white">
                    <PlusCircle className="h-5 w-5" />
                  </span>

                  <span className="text-[18px] font-semibold">
                    投稿
                  </span>
                </Link>

                <Link
                  href={myPageHref}
                  className="flex items-center gap-3 border-t border-slate-200 px-4 py-4 hover:bg-slate-50"
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#006888] text-white">
                    <UserCircle2 className="h-5 w-5" />
                  </span>

                  <span className="text-[18px] font-semibold">
                    マイページ
                  </span>
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </header>
    </div>
  );
}
