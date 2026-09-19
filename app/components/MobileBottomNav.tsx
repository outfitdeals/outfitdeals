"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Home,
  Search,
  Plus,
  Bookmark,
  UserRound,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const applySession = async (session: any | null) => {
      if (cancelled) return;

      const user = session?.user ?? null;
      setIsLoggedIn(!!user);

      if (!user) {
        setUnreadNotificationCount(0);
        return;
      }

      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null);

      if (cancelled) return;

      if (error) {
        console.warn("MobileBottomNav unread notifications warn:", error);
        setUnreadNotificationCount(0);
        return;
      }

      setUnreadNotificationCount(count ?? 0);
    };

    supabase.auth.getSession().then(({ data }) => {
      void applySession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const refreshUnreadNotifications = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user ?? null;

      if (!user) {
        setUnreadNotificationCount(0);
        return;
      }

      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null);

      if (error) {
        console.warn("MobileBottomNav unread refresh warn:", error);
        return;
      }

      setUnreadNotificationCount(count ?? 0);
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

  const currentTab = searchParams.get("tab");
  const searchQuery = searchParams.get("q")?.trim() ?? "";

  const isSearchActive = pathname === "/" && searchQuery.length > 0;
  const isHomeActive = pathname === "/" && !isSearchActive;
  const isPostActive = pathname === "/post";
  const isSavedActive =
    pathname === "/mypage" && currentTab === "saved";
  const isMyPageActive =
    pathname === "/mypage" && currentTab !== "saved";

  const focusSearch = () => {
    const input = document.getElementById(
      "site-search-input"
    ) as HTMLInputElement | null;

    if (!input) {
      router.push("/?focusSearch=1");
      return;
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

    window.setTimeout(() => {
      input.focus();
    }, 250);
  };

  const normalItemClass =
    "flex min-w-0 flex-1 flex-col items-center justify-center gap-[2px] text-[10px] font-medium";

  const iconClass = "h-[20px] w-[20px]";

  const handleHomeClick = (
    event: React.MouseEvent<HTMLAnchorElement>
  ) => {
    if (pathname !== "/" || searchQuery.length > 0) return;

    event.preventDefault();

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="mx-auto flex h-[58px] max-w-lg items-center">
        <Link
          href="/"
          onClick={handleHomeClick}
          aria-current={isHomeActive ? "page" : undefined}
          className={`${normalItemClass} ${
            isHomeActive
              ? "text-[#001e43]"
              : "text-slate-500"
          }`}
        >
          <Home
            className={iconClass}
            strokeWidth={isHomeActive ? 2.4 : 2}
          />
          <span>ホーム</span>
        </Link>

        <button
          type="button"
          onClick={focusSearch}
          aria-current={isSearchActive ? "page" : undefined}
          className={`${normalItemClass} ${
            isSearchActive
              ? "text-[#001e43]"
              : "text-slate-500"
          }`}
          aria-label="検索"
        >
          <Search
            className={iconClass}
            strokeWidth={isSearchActive ? 2.4 : 2}
          />
          <span>検索</span>
        </button>

        <div className="flex min-w-0 flex-1 justify-center">
          <Link
            href="/post"
            className="relative -mt-5 flex flex-col items-center justify-center"
            aria-label="ディールを投稿"
            aria-current={isPostActive ? "page" : undefined}
          >
            <span
              className={`flex h-[48px] w-[48px] items-center justify-center rounded-full text-white shadow-[0_5px_15px_-5px_rgba(0,30,67,0.65)] ${
                isPostActive
                  ? "bg-[#006888]"
                  : "bg-[#001e43]"
              }`}
            >
              <Plus className="h-7 w-7" strokeWidth={2.3} />
            </span>

            <span
              className={`mt-[2px] text-[10px] font-semibold ${
                isPostActive
                  ? "text-[#001e43]"
                  : "text-slate-500"
              }`}
            >
              投稿
            </span>
          </Link>
        </div>

        <Link
          href={isLoggedIn ? "/mypage?tab=saved" : "/auth"}
          aria-current={isSavedActive ? "page" : undefined}
          className={`${normalItemClass} ${
            isSavedActive
              ? "text-[#001e43]"
              : "text-slate-500"
          }`}
        >
          <Bookmark
            className={iconClass}
            strokeWidth={isSavedActive ? 2.4 : 2}
          />
          <span>保存</span>
        </Link>

        <Link
          href={
            isLoggedIn
              ? unreadNotificationCount > 0
                ? "/mypage?tab=notifications"
                : "/mypage"
              : "/auth"
          }
          aria-current={isMyPageActive ? "page" : undefined}
          className={`${normalItemClass} ${
            isMyPageActive
              ? "text-[#001e43]"
              : "text-slate-500"
          }`}
        >
          <span className="relative inline-flex">
            <UserRound
              className={iconClass}
              strokeWidth={isMyPageActive ? 2.4 : 2}
            />
            {isLoggedIn && unreadNotificationCount > 0 ? (
              <span className="absolute -right-3 -top-2 inline-flex min-w-[17px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-[17px] text-white ring-2 ring-white">
                {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
              </span>
            ) : null}
          </span>
          <span>マイページ</span>
        </Link>
      </div>
    </nav>
  );
}
