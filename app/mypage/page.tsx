// app/mypage/page.tsx
"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  ThumbsUp,
  User as UserIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type DealRow = {
  id: string;
  created_at: string;
  user_id?: string | null;
  title: string | null;
  price: number | null;
  market: string | null;
  shop_name: string | null;
  deal_url: string | null;
  image_url: string | null;
  is_expired: boolean | null;
  likes_count?: number | null;
  comments_count?: number | null;
};

type MyCommentRow = {
  id: string;
  created_at: string;
  body: string;
  deal_id: string | null;
};

type MyReplyRow = {
  id: string;
  created_at: string;
  body: string;
  comment_id: string | null;
  deal_id: string | null;
};

type MyLikeRow = {
  id: string;
  created_at: string;
  deal_id: string | null;
};

type SavedRow = {
  id: string;
  created_at: string;
  deal_id: string | null;
};

type NotificationRow = {
  id: string;
  created_at: string;
  type: "reply" | "mention" | "like";
  user_id: string;
  actor_id: string;
  deal_id: string;
  comment_id: string | null;
  reply_id: string | null;
  read_at: string | null;
  actor_username: string;
  body: string;
};

type DealMini = {
  id: string;
  title: string | null;
  image_url: string | null;
  price?: number | null;
  shop_name?: string | null;
  is_expired?: boolean | null;
};

function yen(n: number | null) {
  if (n == null) return "";
  return `${Number(n).toLocaleString("ja-JP")}円`;
}

function clampText(s: string, max = 46) {
  const t = (s ?? "").trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function fmtJP(dt: string) {
  try {
    return new Date(dt).toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dt;
  }
}


function fmtJPDate(dt: string) {
  try {
    return new Date(dt).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return dt;
  }
}

const PLACEHOLDER_IMG = "https://via.placeholder.com/120x120?text=No+Image";


function ProfileAvatar({
  src,
  name,
  className,
}: {
  src: string;
  name: string;
  className: string;
}) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [src]);

  const trimmedName = name.trim();
  const initial = trimmedName ? trimmedName.charAt(0).toUpperCase() : "";

  return (
    <div
      className={`${className} flex items-center justify-center overflow-hidden border border-slate-200 bg-slate-100 text-slate-500`}
      aria-label={trimmedName ? `${trimmedName}のプロフィール画像` : "プロフィール画像"}
    >
      {src && !imageError ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : initial ? (
        <span className="select-none text-[0.42em] font-bold uppercase text-slate-600">
          {initial}
        </span>
      ) : (
        <UserIcon className="h-1/2 w-1/2" aria-hidden="true" />
      )}
    </div>
  );
}

async function resizeAndCompressImage(file: File): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("画像の読み込みに失敗しました。"));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("画像の解析に失敗しました。"));
    image.src = dataUrl;
  });

  const MAX_EDGE = 512;

  let width = img.width;
  let height = img.height;

  if (width > height) {
    if (width > MAX_EDGE) {
      height = Math.round((height * MAX_EDGE) / width);
      width = MAX_EDGE;
    }
  } else {
    if (height > MAX_EDGE) {
      width = Math.round((width * MAX_EDGE) / height);
      height = MAX_EDGE;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("画像処理に失敗しました。");
  }

  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.75);
  });

  if (!blob) {
    throw new Error("画像の圧縮に失敗しました。");
  }

  return blob;
}

type TopTab = "profile" | "deals" | "saved" | "notifications" | "settings";

function MyPageTabSync({
  onTabChange,
}: {
  onTabChange: (tab: TopTab) => void;
}) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get("tab");

    if (tab === "saved") {
      onTabChange("saved");
      return;
    }

    if (tab === "deals") {
      onTabChange("deals");
      return;
    }

    if (tab === "notifications") {
      onTabChange("notifications");
      return;
    }

    if (tab === "settings") {
      onTabChange("settings");
      return;
    }

    onTabChange("profile");
  }, [searchParams, onTabChange]);

  return null;
}

function MyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [user, setUser] = useState<any | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [topTab, setTopTab] = useState<TopTab>("profile");
  const [showUpdateSuccess, setShowUpdateSuccess] = useState(false);
  const [updateSuccessFading, setUpdateSuccessFading] = useState(false);
  const topTabsScrollRef = useRef<HTMLDivElement | null>(null);
  const [showLeftTabHint, setShowLeftTabHint] = useState(false);
  const [showRightTabHint, setShowRightTabHint] = useState(true);

  useEffect(() => {
    if (searchParams.get("updated") !== "1") return;

    setShowUpdateSuccess(true);
    setUpdateSuccessFading(false);

    const fadeTimer = window.setTimeout(() => {
      setUpdateSuccessFading(true);
    }, 2500);

    const hideTimer = window.setTimeout(() => {
      setShowUpdateSuccess(false);
      setUpdateSuccessFading(false);

      const nextParams = new URLSearchParams(window.location.search);
      nextParams.delete("updated");

      const query = nextParams.toString();
      router.replace(query ? `/mypage?${query}` : "/mypage", {
        scroll: false,
      });
    }, 3000);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [router, searchParams]);

  useEffect(() => {
    let scroller: HTMLDivElement | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let frameId = 0;

    const updateTabHints = () => {
      const current = topTabsScrollRef.current;
      if (!current) return;

      const maxScrollLeft = Math.max(
        0,
        current.scrollWidth - current.clientWidth
      );

      setShowLeftTabHint(current.scrollLeft > 4);
      setShowRightTabHint(current.scrollLeft < maxScrollLeft - 4);
    };

    const attach = () => {
      const current = topTabsScrollRef.current;

      if (!current) {
        frameId = window.requestAnimationFrame(attach);
        return;
      }

      scroller = current;
      updateTabHints();

      scroller.addEventListener("scroll", updateTabHints, { passive: true });
      window.addEventListener("resize", updateTabHints);

      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(updateTabHints);
        resizeObserver.observe(scroller);
      }
    };

    frameId = window.requestAnimationFrame(attach);

    return () => {
      window.cancelAnimationFrame(frameId);

      if (scroller) {
        scroller.removeEventListener("scroll", updateTabHints);
      }

      window.removeEventListener("resize", updateTabHints);
      resizeObserver?.disconnect();
    };
  }, []);

  const scrollTopTabs = (direction: "left" | "right") => {
    topTabsScrollRef.current?.scrollBy({
      left: direction === "right" ? 150 : -150,
      behavior: "smooth",
    });
  };

  const handleTopTabChange = (tab: TopTab) => {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (tab === "profile") {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", tab);
    }

    const query = nextParams.toString();
    const nextUrl = query ? `/mypage?${query}` : "/mypage";

    setTopTab(tab);
    router.push(nextUrl, { scroll: false });
  };

  const [username, setUsername] = useState<string>("");
  const [usernameDraft, setUsernameDraft] = useState<string>("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameMsg, setUsernameMsg] = useState<string | null>(null);

  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<string | null>(null);
  const [passwordResetSending, setPasswordResetSending] = useState(false);
  const [passwordResetMsg, setPasswordResetMsg] = useState<string | null>(null);
  const [linkedProviders, setLinkedProviders] = useState<string[]>([]);
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [googleLinkMsg, setGoogleLinkMsg] = useState<string | null>(null);
  const [linkingLine, setLinkingLine] = useState(false);
  const [lineLinkMsg, setLineLinkMsg] = useState<string | null>(null);

  const [myDeals, setMyDeals] = useState<DealRow[]>([]);
  const [myComments, setMyComments] = useState<MyCommentRow[]>([]);
  const [myReplies, setMyReplies] = useState<MyReplyRow[]>([]);
  const [myLikes, setMyLikes] = useState<MyLikeRow[]>([]);
  const [savedRows, setSavedRows] = useState<SavedRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [dealMiniMap, setDealMiniMap] = useState<Record<string, DealMini>>({});

  const [activityTab, setActivityTab] = useState<"all" | "comments" | "likes">(
    "all"
  );
  const [activityPage, setActivityPage] = useState(1);
  const ACTIVITY_PAGE_SIZE = 20;

  const [myDealsTab, setMyDealsTab] = useState<"active" | "expired" | "all">(
    "all"
  );
  const [myDealsPage, setMyDealsPage] = useState(1);
  const [savedPage, setSavedPage] = useState(1);
  const LIST_PAGE_SIZE = 20;

  const [removingSavedId, setRemovingSavedId] = useState<string | null>(null);
  const [updatingDealStatusId, setUpdatingDealStatusId] = useState<string | null>(
    null
  );

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoadingUser(true);

      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        setUser(null);
        setErrorMsg("マイページを表示するにはログインが必要です。");
        setLoadingUser(false);
        return;
      }

      setUser(data.user);

      const { data: identitiesData, error: identitiesError } =
        await supabase.auth.getUserIdentities();

      if (identitiesError) {
        console.warn("load user identities warn:", identitiesError);
      } else {
        setLinkedProviders(
          (identitiesData?.identities || []).map(
            (identity: any) => identity.provider
          )
        );
      }

      const meta = (data.user as any).user_metadata || {};

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) {
        console.warn("load mypage profile warn:", profileError);
      }

      const initialUsername = profile?.username || meta.username || "";
      const initialAvatar = profile?.avatar_url || "";

      setUsername(initialUsername);
      setUsernameDraft(initialUsername);
      setAvatarUrl(initialAvatar);

      setLoadingUser(false);
    })();
  }, []);

  const loadedDealMiniIdsRef = useRef<Set<string>>(new Set());

  const upsertDealMinis = useCallback(async (dealIds: string[]) => {
    const ids = Array.from(new Set(dealIds.filter(Boolean)));

    if (ids.length === 0) return;

    const unknown = ids.filter(
      (id) => !loadedDealMiniIdsRef.current.has(id)
    );

    if (unknown.length === 0) return;

    unknown.forEach((id) => {
      loadedDealMiniIdsRef.current.add(id);
    });

    const { data, error } = await supabase
      .from("deals")
      .select("id, title, image_url, price, shop_name, is_expired")
      .in("id", unknown);

    if (error) {
      unknown.forEach((id) => {
        loadedDealMiniIdsRef.current.delete(id);
      });

      console.warn("load deal minis warn:", error);
      return;
    }

    const patch: Record<string, DealMini> = {};

    (data ?? []).forEach((r: any) => {
      patch[String(r.id)] = {
        id: String(r.id),
        title: r.title ?? null,
        image_url: r.image_url ?? null,
        price: r.price ?? null,
        shop_name: r.shop_name ?? null,
        is_expired: r.is_expired ?? null,
      };
    });

    setDealMiniMap((prev) => ({
      ...prev,
      ...patch,
    }));
  }, []);

  const loadMyDeals = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("deals")
      .select(
        "id, created_at, user_id, title, price, market, shop_name, deal_url, image_url, is_expired, likes_count, comments_count"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("load my deals error:", error);
      setMyDeals([]);
      return;
    }

    const rows = (data ?? []).map((r: any) => ({
      id: String(r.id),
      created_at: r.created_at,
      user_id: r.user_id ?? null,
      title: r.title ?? null,
      price: r.price ?? null,
      market: r.market ?? null,
      shop_name: r.shop_name ?? null,
      deal_url: r.deal_url ?? null,
      image_url: r.image_url ?? null,
      is_expired: r.is_expired ?? null,
      likes_count: r.likes_count ?? null,
      comments_count: r.comments_count ?? null,
    })) as DealRow[];

    setMyDeals(rows);

    await upsertDealMinis(rows.map((d) => d.id));
  }, [user, upsertDealMinis]);

  const loadMyComments = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("deal_comments")
      .select("id, created_at, body, deal_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("load my comments error:", error);
      setMyComments([]);
      return;
    }

    const rows = (data ?? []).map((r: any) => ({
      id: String(r.id),
      created_at: r.created_at,
      body: r.body ?? "",
      deal_id: r.deal_id ? String(r.deal_id) : null,
    })) as MyCommentRow[];

    setMyComments(rows);

    const ids = rows
      .map((c) => c.deal_id)
      .filter((v): v is string => !!v);

    await upsertDealMinis(ids);
  }, [user, upsertDealMinis]);

  const loadMyReplies = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("deal_comment_replies")
      .select("id, created_at, body, comment_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("load my replies error:", error);
      setMyReplies([]);
      return;
    }

    const replyRows = (data ?? []).map((r: any) => ({
      id: String(r.id),
      created_at: r.created_at,
      body: r.body ?? "",
      comment_id: r.comment_id ? String(r.comment_id) : null,
      deal_id: null,
    })) as MyReplyRow[];

    const commentIds = replyRows
      .map((r) => r.comment_id)
      .filter((v): v is string => !!v);

    let commentToDealMap: Record<string, string | null> = {};

    if (commentIds.length > 0) {
      const { data: parentComments, error: parentError } = await supabase
        .from("deal_comments")
        .select("id, deal_id")
        .in("id", commentIds);

      if (parentError) {
        console.warn(
          "load parent comments for replies warn:",
          parentError
        );
      } else {
        commentToDealMap = Object.fromEntries(
          (parentComments ?? []).map((r: any) => [
            String(r.id),
            r.deal_id ? String(r.deal_id) : null,
          ])
        );
      }
    }

    const normalizedReplies = replyRows.map((r) => ({
      ...r,
      deal_id: r.comment_id
        ? commentToDealMap[r.comment_id] ?? null
        : null,
    }));

    setMyReplies(normalizedReplies);

    const ids = normalizedReplies
      .map((r) => r.deal_id)
      .filter((v): v is string => !!v);

    await upsertDealMinis(ids);
  }, [user, upsertDealMinis]);

  const loadMyLikes = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("deal_likes")
      .select("id, created_at, deal_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("load my likes error:", error);
      setMyLikes([]);
      return;
    }

    const rows = (data ?? []).map((r: any) => ({
      id: String(r.id),
      created_at: r.created_at,
      deal_id: r.deal_id ? String(r.deal_id) : null,
    })) as MyLikeRow[];

    setMyLikes(rows);

    const ids = rows
      .map((l) => l.deal_id)
      .filter((v): v is string => !!v);

    await upsertDealMinis(ids);
  }, [user, upsertDealMinis]);

  const loadNotifications = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("notifications")
      .select(
        "id, created_at, type, user_id, actor_id, deal_id, comment_id, reply_id, read_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("load notifications error:", error);
      setNotifications([]);
      return;
    }

    const rows = data ?? [];
    const actorIds = Array.from(
      new Set(rows.map((row: any) => String(row.actor_id)).filter(Boolean))
    );
    const replyIds = Array.from(
      new Set(
        rows
          .map((row: any) => (row.reply_id ? String(row.reply_id) : null))
          .filter((value): value is string => !!value)
      )
    );

    const actorMap: Record<string, string> = {};
    const replyBodyMap: Record<string, string> = {};

    if (actorIds.length > 0) {
      const { data: actors, error: actorsError } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", actorIds);

      if (actorsError) {
        console.warn("load notification actors warn:", actorsError);
      } else {
        (actors ?? []).forEach((actor: any) => {
          actorMap[String(actor.id)] = actor.username ?? "ユーザー";
        });
      }
    }

    if (replyIds.length > 0) {
      const { data: replies, error: repliesError } = await supabase
        .from("deal_comment_replies")
        .select("id, body")
        .in("id", replyIds);

      if (repliesError) {
        console.warn("load notification replies warn:", repliesError);
      } else {
        (replies ?? []).forEach((reply: any) => {
          replyBodyMap[String(reply.id)] = reply.body ?? "";
        });
      }
    }

    const normalized = rows.map((row: any) => ({
      id: String(row.id),
      created_at: row.created_at,
      type: row.type,
      user_id: String(row.user_id),
      actor_id: String(row.actor_id),
      deal_id: String(row.deal_id),
      comment_id: row.comment_id ? String(row.comment_id) : null,
      reply_id: row.reply_id ? String(row.reply_id) : null,
      read_at: row.read_at ?? null,
      actor_username: actorMap[String(row.actor_id)] ?? "ユーザー",
      body: row.reply_id ? replyBodyMap[String(row.reply_id)] ?? "" : "",
    })) as NotificationRow[];

    setNotifications(normalized);
    await upsertDealMinis(
      normalized.map((row) => row.deal_id).filter(Boolean)
    );
  }, [user, upsertDealMinis]);

  const loadSaved = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("deal_saves")
      .select("id, created_at, deal_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("load saved deals warn:", error);
      setSavedRows([]);
      return;
    }

    const rows = (data ?? []).map((r: any) => ({
      id: String(r.id),
      created_at: r.created_at,
      deal_id: r.deal_id ? String(r.deal_id) : null,
    })) as SavedRow[];

    setSavedRows(rows);

    const ids = rows
      .map((s) => s.deal_id)
      .filter((v): v is string => !!v);

    await upsertDealMinis(ids);
  }, [user, upsertDealMinis]);

  useEffect(() => {
    if (!user) return;

    setErrorMsg(null);

    (async () => {
      await Promise.all([
        loadMyDeals(),
        loadMyComments(),
        loadMyReplies(),
        loadMyLikes(),
        loadSaved(),
        loadNotifications(),
      ]);
    })();
  }, [
    user,
    loadMyDeals,
    loadMyComments,
    loadMyReplies,
    loadMyLikes,
    loadSaved,
    loadNotifications,
  ]);

  const unreadNotificationCount = useMemo(
    () => notifications.filter((item) => !item.read_at).length,
    [notifications]
  );

  const handleOpenNotification = async (item: NotificationRow) => {
    if (!item.read_at) {
      const readAt = new Date().toISOString();

      setNotifications((prev) =>
        prev.map((row) =>
          row.id === item.id ? { ...row, read_at: readAt } : row
        )
      );

      const { error } = await supabase
        .from("notifications")
        .update({ read_at: readAt })
        .eq("id", item.id);

      if (error) {
        console.warn("mark notification read warn:", error);
        setNotifications((prev) =>
          prev.map((row) =>
            row.id === item.id ? { ...row, read_at: null } : row
          )
        );
      } else {
        window.dispatchEvent(new Event("tokumikke:notifications-changed"));
      }
    }

    const anchor = item.comment_id ? `#comment-${item.comment_id}` : "";
    router.push(`/deals/${item.deal_id}${anchor}`);
  };

  const joinedAt = useMemo(() => {
    const raw = user?.created_at;

    if (!raw) return "";

    try {
      return new Date(raw).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        });
    } catch {
      return String(raw);
    }
  }, [user]);

  const lastActivityAt = useMemo(() => {
    const candidates = [
      myDeals[0]?.created_at,
      myComments[0]?.created_at,
      myReplies[0]?.created_at,
      myLikes[0]?.created_at,
      savedRows[0]?.created_at,
    ].filter(Boolean) as string[];

    if (candidates.length === 0) return "";

    const newest = candidates.sort(
      (a, b) => +new Date(b) - +new Date(a)
    )[0];

    return fmtJP(newest);
  }, [myDeals, myComments, myReplies, myLikes, savedRows]);

  const bestDeal = useMemo(() => {
    if (!myDeals || myDeals.length === 0) return null;

    const sorted = [...myDeals].sort((a, b) => {
      const la = Number(a.likes_count ?? 0);
      const lb = Number(b.likes_count ?? 0);

      if (lb !== la) return lb - la;

      return +new Date(b.created_at) - +new Date(a.created_at);
    });

    return sorted[0];
  }, [myDeals]);

  const savedDealsMini = useMemo(() => {
    return savedRows
      .map((saved) => {
        if (!saved.deal_id) return null;

        const deal = dealMiniMap[saved.deal_id];
        if (!deal) return null;

        return {
          ...deal,
          saved_at: saved.created_at,
        };
      })
      .filter(
        (
          item
        ): item is DealMini & {
          saved_at: string;
        } => !!item
      );
  }, [savedRows, dealMiniMap]);

  const savedTotalPages = Math.max(
    1,
    Math.ceil(savedDealsMini.length / LIST_PAGE_SIZE)
  );

  const savedPageItems = useMemo(() => {
    const start = (savedPage - 1) * LIST_PAGE_SIZE;
    return savedDealsMini.slice(start, start + LIST_PAGE_SIZE);
  }, [savedDealsMini, savedPage]);

  const savedPageNumbers = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, savedPage - 2);
    const end = Math.min(savedTotalPages, savedPage + 2);

    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    return pages;
  }, [savedPage, savedTotalPages]);

  useEffect(() => {
    if (savedPage > savedTotalPages) {
      setSavedPage(savedTotalPages);
    }
  }, [savedPage, savedTotalPages]);

  type ActivityItem =
    | {
        type: "like";
        id: string;
        created_at: string;
        deal_id: string;
      }
    | {
        type: "comment";
        id: string;
        created_at: string;
        deal_id: string;
        body: string;
      }
    | {
        type: "reply";
        id: string;
        created_at: string;
        deal_id: string;
        body: string;
      };

  const allActivity = useMemo(() => {
    const items: ActivityItem[] = [];

    myLikes.forEach((l) => {
      if (!l.deal_id) return;

      items.push({
        type: "like",
        id: l.id,
        created_at: l.created_at,
        deal_id: l.deal_id,
      });
    });

    myComments.forEach((c) => {
      if (!c.deal_id) return;

      items.push({
        type: "comment",
        id: c.id,
        created_at: c.created_at,
        deal_id: c.deal_id,
        body: c.body ?? "",
      });
    });

    myReplies.forEach((r) => {
      if (!r.deal_id) return;

      items.push({
        type: "reply",
        id: r.id,
        created_at: r.created_at,
        deal_id: r.deal_id,
        body: r.body ?? "",
      });
    });

    items.sort(
      (a, b) => +new Date(b.created_at) - +new Date(a.created_at)
    );

    return items;
  }, [myLikes, myComments, myReplies]);

  const activityFiltered = useMemo(() => {
    if (activityTab === "comments") {
      return allActivity.filter(
        (x) => x.type === "comment" || x.type === "reply"
      );
    }

    if (activityTab === "likes") {
      return allActivity.filter((x) => x.type === "like");
    }

    return allActivity;
  }, [allActivity, activityTab]);

  const activityTotalPages = Math.max(
    1,
    Math.ceil(activityFiltered.length / ACTIVITY_PAGE_SIZE)
  );

  const activityPageItems = useMemo(() => {
    const start = (activityPage - 1) * ACTIVITY_PAGE_SIZE;
    return activityFiltered.slice(start, start + ACTIVITY_PAGE_SIZE);
  }, [activityFiltered, activityPage]);

  useEffect(() => {
    setActivityPage(1);
  }, [activityTab]);

  useEffect(() => {
    if (activityPage > activityTotalPages) {
      setActivityPage(activityTotalPages);
    }
  }, [activityPage, activityTotalPages]);

  const activityPageNumbers = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, activityPage - 2);
    const end = Math.min(activityTotalPages, activityPage + 2);

    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    return pages;
  }, [activityPage, activityTotalPages]);

  const handleToggleDealExpired = async (
    dealId: string,
    nextExpired: boolean
  ) => {
    if (!user || updatingDealStatusId) return;

    try {
      setUpdatingDealStatusId(dealId);

      const { error } = await supabase
        .from("deals")
        .update({ is_expired: nextExpired })
        .eq("id", dealId)
        .eq("user_id", user.id);

      if (error) {
        console.error("update deal status error:", error);
        return;
      }

      setMyDeals((prev) =>
        prev.map((deal) =>
          deal.id === dealId
            ? {
                ...deal,
                is_expired: nextExpired,
              }
            : deal
        )
      );
    } finally {
      setUpdatingDealStatusId(null);
    }
  };

  const handleRemoveSaved = async (dealId: string) => {
    if (!user || removingSavedId) return;

    try {
      setRemovingSavedId(dealId);

      const { error } = await supabase
        .from("deal_saves")
        .delete()
        .eq("user_id", user.id)
        .eq("deal_id", dealId);

      if (error) {
        console.error("remove saved deal error:", error);
        return;
      }

      setSavedRows((prev) =>
        prev.filter((row) => row.deal_id !== dealId)
      );
    } finally {
      setRemovingSavedId(null);
    }
  };

  const handleSaveUsername = async () => {
    if (!user || savingUsername) return;

    const nextUsername = usernameDraft.trim();

    setUsernameMsg(null);

    if (nextUsername.length < 2 || nextUsername.length > 20) {
      setUsernameMsg("ユーザー名は2〜20文字で入力してください。");
      return;
    }

    const usernamePattern =
      /^[\p{L}\p{N}_\-ぁ-んァ-ヶ一-龠ー]+$/u;

    if (!usernamePattern.test(nextUsername)) {
      setUsernameMsg(
        "使用できるのは文字・数字・_（アンダーバー）・-（ハイフン）です。"
      );
      return;
    }

    if (nextUsername === username) {
      setUsernameMsg("現在のユーザー名と同じです。");
      return;
    }

    try {
      setSavingUsername(true);

      const { error } = await supabase.auth.updateUser({
        data: {
          username: nextUsername,
        },
      });

      if (error) {
        console.error("update username error:", error);
        setUsernameMsg("ユーザー名を更新できませんでした。");
        return;
      }

      setUsername(nextUsername);
      setUsernameDraft(nextUsername);
      setUser((prev: any) =>
        prev
          ? {
              ...prev,
              user_metadata: {
                ...(prev.user_metadata || {}),
                username: nextUsername,
              },
            }
          : prev
      );
      setUsernameMsg("ユーザー名を更新しました。");
    } finally {
      setSavingUsername(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email || passwordResetSending) return;

    try {
      setPasswordResetSending(true);
      setPasswordResetMsg(null);

      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/reset-password`
          : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo,
      });

      if (error) {
        console.error("password reset error:", error);
        setPasswordResetMsg("再設定メールを送信できませんでした。");
        return;
      }

      setPasswordResetMsg("パスワード設定・変更用メールを送信しました。");
    } finally {
      setPasswordResetSending(false);
    }
  };

  const handleGoogleLink = async () => {
    if (!user || linkingGoogle) return;

    try {
      setLinkingGoogle(true);
      setGoogleLinkMsg(null);

      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/mypage?tab=settings&linked=google`
          : undefined;

      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: {
          redirectTo,
        },
      });

      if (error) {
        console.error("Google identity link error:", error);
        setGoogleLinkMsg("Google連携を開始できませんでした。");
        setLinkingGoogle(false);
      }
    } catch (err) {
      console.error("Google identity link error:", err);
      setGoogleLinkMsg("Google連携を開始できませんでした。");
      setLinkingGoogle(false);
    }
  };

  const handleLineLink = async () => {
    if (!user || linkingLine) return;

    try {
      setLinkingLine(true);
      setLineLinkMsg(null);

      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/mypage?tab=settings&linked=line`
          : undefined;

      const { error } = await supabase.auth.linkIdentity({
        provider: "custom:line-oauth" as any,
        options: {
          redirectTo,
        },
      });

      if (error) {
        console.error("LINE identity link error:", error);
        setLineLinkMsg("LINE連携を開始できませんでした。");
        setLinkingLine(false);
      }
    } catch (err) {
      console.error("LINE identity link error:", err);
      setLineLinkMsg("LINE連携を開始できませんでした。");
      setLinkingLine(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const handleAvatarFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setAvatarMsg(null);

    if (!user) return;

    const file = e.target.files?.[0];

    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setAvatarMsg("JPEG / PNG / WebP の画像を選択してください。");
      e.target.value = "";
      return;
    }

    try {
      setSavingAvatar(true);

      const compressedBlob = await resizeAndCompressImage(file);
      const filePath = `${user.id}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, compressedBlob, {
          upsert: true,
          contentType: "image/jpeg",
        });

      if (uploadError) {
        console.error("upload avatar error:", uploadError);
        setAvatarMsg(
          "プロフィール写真のアップロードに失敗しました。"
        );
        e.target.value = "";
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData?.publicUrl ?? "";

      if (!publicUrl) {
        setAvatarMsg("プロフィール写真URLの取得に失敗しました。");
        e.target.value = "";
        return;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (updateError) {
        console.error("update profile avatar error:", updateError);
        setAvatarMsg("プロフィール写真の保存に失敗しました。");
        e.target.value = "";
        return;
      }

      setAvatarUrl(publicUrl);
      setAvatarMsg("プロフィール写真を更新しました。");
      e.target.value = "";
    } catch (err) {
      console.error("avatar process error:", err);
      setAvatarMsg("プロフィール写真の処理に失敗しました。");
      e.target.value = "";
    } finally {
      setSavingAvatar(false);
    }
  };

  const StatCard = ({
    icon,
    label,
    value,
  }: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
  }) => (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2 text-slate-600">
        <div className="h-4 w-4">{icon}</div>
        <div className="text-xs font-semibold">{label}</div>
      </div>

      <div className="mt-1 text-2xl font-bold text-slate-900">
        {value}
      </div>
    </div>
  );

  const TabButton = ({
    active,
    children,
    onClick,
    rightCount,
  }: {
    active: boolean;
    children: React.ReactNode;
    onClick: () => void;
    rightCount?: number | null;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`relative whitespace-nowrap px-1 py-2 text-sm font-semibold transition cursor-pointer ${
        active
          ? "text-[#006888]"
          : "text-slate-500 hover:text-slate-800"
      }`}
    >
      <span className="inline-flex items-center gap-1">
        {children}

        {typeof rightCount === "number" ? (
          <span className="text-slate-400 font-semibold">
            ({rightCount})
          </span>
        ) : null}
      </span>

      {active ? (
        <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#006888]" />
      ) : null}
    </button>
  );

  const countDeals = myDeals.length;
  const countComments = myComments.length + myReplies.length;
  const countLikes = myLikes.length;
  const countSaved = savedRows.length;

  const activeMyDeals = useMemo(
    () => myDeals.filter((deal) => !deal.is_expired),
    [myDeals]
  );

  const expiredMyDeals = useMemo(
    () => myDeals.filter((deal) => !!deal.is_expired),
    [myDeals]
  );

  const filteredMyDeals = useMemo(() => {
    if (myDealsTab === "active") return activeMyDeals;
    if (myDealsTab === "expired") return expiredMyDeals;
    return myDeals;
  }, [myDealsTab, activeMyDeals, expiredMyDeals, myDeals]);

  const myDealsTotalPages = Math.max(
    1,
    Math.ceil(filteredMyDeals.length / LIST_PAGE_SIZE)
  );

  const myDealsPageItems = useMemo(() => {
    const start = (myDealsPage - 1) * LIST_PAGE_SIZE;
    return filteredMyDeals.slice(start, start + LIST_PAGE_SIZE);
  }, [filteredMyDeals, myDealsPage]);

  const myDealsPageNumbers = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, myDealsPage - 2);
    const end = Math.min(myDealsTotalPages, myDealsPage + 2);

    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    return pages;
  }, [myDealsPage, myDealsTotalPages]);

  useEffect(() => {
    setMyDealsPage(1);
  }, [myDealsTab]);

  useEffect(() => {
    if (myDealsPage > myDealsTotalPages) {
      setMyDealsPage(myDealsTotalPages);
    }
  }, [myDealsPage, myDealsTotalPages]);

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <div className="mx-auto max-w-5xl px-4 py-10 text-slate-600">
          読み込み中…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="rounded-lg border border-slate-200 bg-white px-5 py-6 text-center shadow-sm">
            <p className="text-sm text-slate-700">
              {errorMsg ??
                "マイページを表示するにはログインが必要です。"}
            </p>

            <Link
              href="/auth"
              className="mt-5 inline-flex items-center justify-center rounded-full bg-[#006888] px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer"
            >
              ログイン / 新規登録
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      {showUpdateSuccess ? (
        <div
          role="status"
          aria-live="polite"
          className={`fixed left-1/2 top-20 z-[70] -translate-x-1/2 px-4 transition-all duration-500 ease-out sm:top-24 ${
            updateSuccessFading
              ? "pointer-events-none -translate-y-2 opacity-0"
              : "translate-y-0 opacity-100"
          }`}
        >
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 shadow-lg">
            <CheckCircle2 className="h-5 w-5 flex-none text-emerald-600" />
            <span>ディールを更新しました。</span>
          </div>
        </div>
      ) : null}

      <Suspense fallback={null}>
        <MyPageTabSync onTabChange={setTopTab} />
      </Suspense>

      <main className="mx-auto w-full max-w-[1180px] px-0 pb-10 pt-0 sm:px-4 sm:pt-6">
        <section className="border-b border-slate-200 bg-white sm:rounded-t-xl sm:border sm:border-slate-200">
          <div className="flex items-center gap-4 px-4 py-4 sm:px-6">
            <ProfileAvatar
              src={avatarUrl}
              name={username}
              className="h-12 w-12 flex-none rounded-full text-[56px] sm:h-14 sm:w-14"
            />

            <div className="min-w-0">
              <div className="truncate text-lg font-bold text-slate-900">
                {username || "ユーザー名未設定"}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                トクミッケ メンバー
              </div>
            </div>
          </div>

          <div className="relative border-t border-slate-100">
            <div
              ref={topTabsScrollRef}
              className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <div className="flex min-w-max items-center px-2 sm:justify-center sm:px-4">
                {(
                  [
                    ["profile", "プロフィール"],
                    ["deals", "投稿したディール"],
                    ["saved", `保存したディール${countSaved ? ` (${countSaved})` : ""}`],
                    [
                      "notifications",
                      `通知${unreadNotificationCount ? ` (${unreadNotificationCount})` : ""}`,
                    ],
                    ["settings", "設定"],
                  ] as Array<[TopTab, string]>
                ).map(([tab, label]) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => handleTopTabChange(tab)}
                    className={`relative cursor-pointer whitespace-nowrap px-5 py-3 text-sm font-semibold transition sm:px-8 ${
                      topTab === tab
                        ? "text-[#006888]"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {label}
                    {topTab === tab ? (
                      <span className="absolute bottom-0 left-4 right-4 h-[3px] bg-[#006888] sm:left-6 sm:right-6" />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>

            {showLeftTabHint ? (
              <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-14 items-center justify-start bg-gradient-to-r from-white via-white/95 to-transparent pl-1 md:hidden">
                <button
                  type="button"
                  onClick={() => scrollTopTabs("left")}
                  aria-label="左のメニューを見る"
                  className="pointer-events-auto inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm"
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={2.4} />
                </button>
              </div>
            ) : null}

            {(showRightTabHint || !showLeftTabHint) ? (
              <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex w-16 items-center justify-end bg-gradient-to-l from-white via-white/95 to-transparent pr-2 md:hidden">
                <button
                  type="button"
                  onClick={() => scrollTopTabs("right")}
                  aria-label="右のメニューを見る"
                  className="pointer-events-auto relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-[#006888] shadow-md"
                >
                  <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
                  {unreadNotificationCount > 0 ? (
                    <span
                      className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#006888] ring-2 ring-white"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              </div>
            ) : null}
          </div>
        </section>

        {topTab === "profile" ? (
          <>
            <section className="bg-white sm:mt-4 sm:rounded-xl sm:border sm:border-slate-200">
              <div className="grid gap-0 lg:grid-cols-[290px_minmax(0,1fr)]">
                <div className="border-b border-slate-200 px-4 py-5 sm:px-6 lg:border-b-0 lg:border-r">
                  <div className="flex items-center gap-4 lg:flex-col lg:items-start">
                    <ProfileAvatar
                      src={avatarUrl}
                      name={username}
                      className="h-24 w-24 flex-none rounded-lg text-[96px] lg:h-32 lg:w-32 lg:text-[128px]"
                    />

                    <div className="min-w-0">
                      <div className="text-xl font-bold text-slate-900">
                        {username || "ユーザー名未設定"}
                      </div>

                      <div className="mt-2 space-y-1 text-xs text-slate-500">
                        <div>
                          <span className="font-semibold text-slate-700">
                            登録日
                          </span>{" "}
                          {joinedAt || "-"}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-700">
                            最終アクティビティ
                          </span>{" "}
                          {lastActivityAt || "-"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-4 py-5 sm:px-6">
                  <div className="mb-4">
                    <h1 className="text-lg font-bold text-slate-900">
                      プロフィール概要
                    </h1>
                    <p className="mt-1 text-xs text-slate-500">
                      トクミッケでの投稿・保存・リアクション状況
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-5">
                    <div className="bg-white px-3 py-4 text-center">
                      <div className="text-2xl font-bold text-slate-900">
                        {countDeals}
                      </div>
                      <div className="mt-1 text-[11px] font-medium text-slate-500">
                        投稿
                      </div>
                    </div>

                    <div className="bg-white px-3 py-4 text-center">
                      <div className="text-2xl font-bold text-slate-900">
                        {countComments}
                      </div>
                      <div className="mt-1 text-[11px] font-medium text-slate-500">
                        コメント
                      </div>
                    </div>

                    <div className="bg-white px-3 py-4 text-center">
                      <div className="text-2xl font-bold text-slate-900">
                        {countLikes}
                      </div>
                      <div className="mt-1 text-[11px] font-medium text-slate-500">
                        いいね
                      </div>
                    </div>

                    <div className="bg-white px-3 py-4 text-center">
                      <div className="text-2xl font-bold text-slate-900">
                        {countSaved}
                      </div>
                      <div className="mt-1 text-[11px] font-medium text-slate-500">
                        保存
                      </div>
                    </div>

                    <div className="col-span-2 bg-white px-3 py-4 text-center sm:col-span-1">
                      <div className="text-2xl font-bold text-slate-900">
                        {myDeals.reduce(
                          (sum, deal) => sum + Number(deal.likes_count ?? 0),
                          0
                        )}
                      </div>
                      <div className="mt-1 text-[11px] font-medium text-slate-500">
                        投稿にもらったいいね
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-4 bg-white sm:rounded-xl sm:border sm:border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    ベストディール
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    これまでの投稿の中で最も反応の良いディール
                  </p>
                </div>

              </div>

              {!bestDeal ? (
                <div className="flex flex-col gap-3 px-4 py-5 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <span>
                    まだ投稿がありません。最初のディールを投稿してみましょう！
                  </span>

                  <Link
                    href="/post"
                    className="inline-flex w-fit items-center justify-center rounded-full bg-[#f59e0b] px-5 py-2 text-xs font-semibold text-white hover:opacity-90 cursor-pointer"
                  >
                    ディールを投稿
                  </Link>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-4 sm:px-6">
                  <Link
                    href={`/deals/${bestDeal.id}`}
                    className="h-20 w-20 flex-none overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200 cursor-pointer"
                  >
                    <img
                      src={bestDeal.image_url || PLACEHOLDER_IMG}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/deals/${bestDeal.id}`}
                      className="line-clamp-2 text-sm font-semibold text-slate-900 hover:underline sm:text-base cursor-pointer"
                    >
                      {bestDeal.title || "タイトル未設定"}
                    </Link>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="font-semibold text-slate-800">
                        {yen(bestDeal.price)}
                      </span>
                      {bestDeal.shop_name ? <span>{bestDeal.shop_name}</span> : null}
                      <span>{fmtJP(bestDeal.created_at)}</span>
                    </div>

                    <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <ThumbsUp className="h-3.5 w-3.5" />
                        {Number(bestDeal.likes_count ?? 0)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {Number(bestDeal.comments_count ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="mt-4 bg-white sm:rounded-xl sm:border sm:border-slate-200">
              <div className="border-b border-slate-200 pt-4">
                <div className="border-b border-slate-200 px-4 pb-4 sm:px-6">
                  <h2 className="text-xl font-bold text-slate-900">
                    アクティビティ
                  </h2>
                </div>

                <div className="flex gap-6 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-6">
                  <TabButton
                    active={activityTab === "all"}
                    onClick={() => {
                      setActivityTab("all");
                      setActivityPage(1);
                    }}
                  >
                    全アクティビティ
                  </TabButton>

                  <TabButton
                    active={activityTab === "comments"}
                    onClick={() => {
                      setActivityTab("comments");
                      setActivityPage(1);
                    }}
                    rightCount={countComments}
                  >
                    コメント
                  </TabButton>

                  <TabButton
                    active={activityTab === "likes"}
                    onClick={() => {
                      setActivityTab("likes");
                      setActivityPage(1);
                    }}
                    rightCount={countLikes}
                  >
                    いいね
                  </TabButton>
                </div>
              </div>

              {activityFiltered.length === 0 ? (
                <div className="px-4 py-5 text-sm text-slate-600 sm:px-6">
                  まだアクティビティはありません。
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {activityPageItems.map((item) => {
                    const mini = dealMiniMap[item.deal_id];
                    return (
                      <li
                        key={`${item.type}:${item.id}`}
                        className="px-4 py-4 sm:px-6"
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className={`mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full ${
                              item.type === "like"
                                ? "bg-rose-50 text-rose-500"
                                : "bg-[#006888]/10 text-[#006888]"
                            }`}
                          >
                            {item.type === "like" ? (
                              <ThumbsUp className="h-5 w-5" />
                            ) : (
                              <MessageSquare className="h-5 w-5" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-slate-900">
                              {item.type === "like"
                                ? "いいねしました"
                                : item.type === "comment"
                                  ? "コメントしました"
                                  : "返信しました"}
                            </div>

                            <Link
                              href={`/deals/${item.deal_id}`}
                              className="mt-1 block truncate text-sm font-medium text-[#006888] hover:underline cursor-pointer"
                            >
                              {mini?.title || "タイトル未設定"}
                            </Link>

                            {item.type !== "like" && item.body ? (
                              <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-slate-700">
                                {item.body}
                              </p>
                            ) : null}

                            <div className="mt-1.5 text-xs text-slate-400">
                              {fmtJP(item.created_at)}
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {activityFiltered.length > 0 ? (
                <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="text-xs font-medium text-slate-600">
                    {activityTotalPages}ページ中 {activityPage}ページ
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setActivityPage((page) => Math.max(1, page - 1))
                      }
                      disabled={activityPage === 1}
                      className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      前へ
                    </button>

                    {activityPageNumbers[0] > 1 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setActivityPage(1)}
                          className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          1
                        </button>
                        {activityPageNumbers[0] > 2 ? (
                          <span className="px-1 text-xs text-slate-400">…</span>
                        ) : null}
                      </>
                    ) : null}

                    {activityPageNumbers.map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setActivityPage(page)}
                        className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-semibold ${
                          activityPage === page
                            ? "border-[#001e43] bg-[#001e43] text-white"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {page}
                      </button>
                    ))}

                    {activityPageNumbers[
                      activityPageNumbers.length - 1
                    ] < activityTotalPages ? (
                      <>
                        {activityPageNumbers[
                          activityPageNumbers.length - 1
                        ] <
                        activityTotalPages - 1 ? (
                          <span className="px-1 text-xs text-slate-400">…</span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setActivityPage(activityTotalPages)}
                          className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {activityTotalPages}
                        </button>
                      </>
                    ) : null}

                    <button
                      type="button"
                      onClick={() =>
                        setActivityPage((page) =>
                          Math.min(activityTotalPages, page + 1)
                        )
                      }
                      disabled={activityPage === activityTotalPages}
                      className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      次へ
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          </>
        ) : topTab === "deals" ? (
          <section className="bg-white sm:mt-4 sm:rounded-xl sm:border sm:border-slate-200">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h1 className="text-xl font-bold text-slate-900">投稿したディール</h1>
                <p className="mt-1 text-xs text-slate-500">
                  あなたが投稿したディール {countDeals}件
                </p>
              </div>

            </div>

            <div className="border-b border-slate-200 px-4 pb-px sm:px-6">
              <div className="flex gap-6 overflow-x-auto overflow-y-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <TabButton
                  active={myDealsTab === "all"}
                  onClick={() => {
                    setMyDealsTab("all");
                    setMyDealsPage(1);
                  }}
                  rightCount={countDeals}
                >
                  すべて
                </TabButton>

                <TabButton
                  active={myDealsTab === "active"}
                  onClick={() => {
                    setMyDealsTab("active");
                    setMyDealsPage(1);
                  }}
                  rightCount={activeMyDeals.length}
                >
                  公開中
                </TabButton>

                <TabButton
                  active={myDealsTab === "expired"}
                  onClick={() => {
                    setMyDealsTab("expired");
                    setMyDealsPage(1);
                  }}
                  rightCount={expiredMyDeals.length}
                >
                  期限切れ
                </TabButton>
              </div>
            </div>

            {filteredMyDeals.length === 0 ? (
              <div className="px-4 py-10 text-center sm:px-6">
                <div className="text-sm font-semibold text-slate-800">
                  {myDealsTab === "active"
                    ? "公開中のディールはありません。"
                    : myDealsTab === "expired"
                      ? "終了したディールはありません。"
                      : "まだ投稿したディールはありません。"}
                </div>

                {countDeals === 0 ? (
                  <Link
                    href="/post"
                    className="mt-4 inline-flex items-center justify-center rounded-full bg-[#f59e0b] px-5 py-2 text-xs font-semibold text-white hover:opacity-90 cursor-pointer"
                  >
                    最初のディールを投稿
                  </Link>
                ) : null}
              </div>
            ) : (
              <ul className="divide-y divide-slate-200">
                {myDealsPageItems.map((deal) => (
                  <li
                    key={deal.id}
                    className="px-4 py-4 sm:px-6 sm:py-5"
                  >
                    <div className="flex items-center gap-3 sm:grid sm:grid-cols-[112px_minmax(0,1fr)_190px] sm:items-center sm:gap-5">
                      <Link
                        href={`/deals/${deal.id}`}
                        className="h-16 w-16 flex-none overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200 sm:h-24 sm:w-28 cursor-pointer"
                      >
                        <img
                          src={deal.image_url || PLACEHOLDER_IMG}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </Link>

                      <div className="min-w-0">
                        <Link
                          href={`/deals/${deal.id}`}
                          className="line-clamp-2 text-sm font-semibold text-blue-700 hover:underline sm:text-[15px] cursor-pointer"
                        >
                          {deal.title || "タイトル未設定"}
                        </Link>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span className="font-bold text-slate-900">
                            {yen(deal.price)}
                          </span>
                          {deal.shop_name ? <span>{deal.shop_name}</span> : null}

                        </div>

                        <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <ThumbsUp className="h-3.5 w-3.5" />
                            {Number(deal.likes_count ?? 0)}
                          </span>

                          <span className="inline-flex items-center gap-1">
                            <MessageSquare className="h-3.5 w-3.5" />
                            {Number(deal.comments_count ?? 0)}
                          </span>

                          <span className="sm:hidden">
                            {fmtJP(deal.created_at)}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center gap-3 sm:hidden">
                          <Link
                            href={`/post?edit=${deal.id}`}
                            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700 cursor-pointer"
                          >
                            編集
                          </Link>

                          <label className="flex cursor-pointer items-center gap-2">
                            <span className="relative inline-flex h-6 w-11 flex-none items-center">
                              <input
                                type="checkbox"
                                checked={!deal.is_expired}
                                onChange={(e) =>
                                  handleToggleDealExpired(
                                    deal.id,
                                    !e.target.checked
                                  )
                                }
                                disabled={updatingDealStatusId === deal.id}
                                className="peer sr-only"
                                aria-label={
                                  deal.is_expired ? "公開に戻す" : "公開中"
                                }
                              />
                              <span className="absolute inset-0 rounded-full bg-slate-300 transition peer-checked:bg-emerald-500 peer-disabled:opacity-50" />
                              <span className="absolute left-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                            </span>

                            <span
                              className={`min-w-[36px] text-[11px] font-semibold ${
                                deal.is_expired
                                  ? "text-slate-400"
                                  : "text-emerald-700"
                              }`}
                            >
                              {updatingDealStatusId === deal.id
                                ? "更新中"
                                : deal.is_expired
                                  ? "終了"
                                  : "公開中"}
                            </span>
                          </label>
                        </div>
                      </div>

                      <div className="hidden self-stretch sm:flex sm:flex-col sm:items-end sm:justify-center">
                        <div className="text-xs text-slate-400">
                          投稿日 {fmtJPDate(deal.created_at)}
                        </div>

                        <Link
                          href={`/post?edit=${deal.id}`}
                          className="mt-3 inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700 cursor-pointer"
                        >
                          編集
                        </Link>

                        <label className="mt-3 flex cursor-pointer items-center gap-2">

                          <span className="relative inline-flex h-6 w-11 flex-none items-center">
                            <input
                              type="checkbox"
                              checked={!deal.is_expired}
                              onChange={(e) =>
                                handleToggleDealExpired(
                                  deal.id,
                                  !e.target.checked
                                )
                              }
                              disabled={updatingDealStatusId === deal.id}
                              className="peer sr-only"
                              aria-label={
                                deal.is_expired ? "公開に戻す" : "公開中"
                              }
                            />
                            <span className="absolute inset-0 rounded-full bg-slate-300 transition peer-checked:bg-emerald-500 peer-disabled:opacity-50" />
                            <span className="absolute left-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                          </span>

                          <span
                            className={`min-w-[36px] text-[11px] font-semibold ${
                              deal.is_expired
                                ? "text-slate-400"
                                : "text-emerald-700"
                            }`}
                          >
                            {updatingDealStatusId === deal.id
                              ? "更新中"
                              : deal.is_expired
                                ? "終了"
                                : "公開中"}
                          </span>
                        </label>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {filteredMyDeals.length > 0 ? (
              <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="text-xs font-medium text-slate-600">
                  {myDealsTotalPages}ページ中 {myDealsPage}ページ
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setMyDealsPage((page) => Math.max(1, page - 1))
                    }
                    disabled={myDealsPage === 1}
                    className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    前へ
                  </button>

                  {myDealsPageNumbers[0] > 1 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setMyDealsPage(1)}
                        className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        1
                      </button>
                      {myDealsPageNumbers[0] > 2 ? (
                        <span className="px-1 text-xs text-slate-400">…</span>
                      ) : null}
                    </>
                  ) : null}

                  {myDealsPageNumbers.map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setMyDealsPage(page)}
                      className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-semibold ${
                        myDealsPage === page
                          ? "border-[#001e43] bg-[#001e43] text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {page}
                    </button>
                  ))}

                  {myDealsPageNumbers[myDealsPageNumbers.length - 1] <
                  myDealsTotalPages ? (
                    <>
                      {myDealsPageNumbers[myDealsPageNumbers.length - 1] <
                      myDealsTotalPages - 1 ? (
                        <span className="px-1 text-xs text-slate-400">…</span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setMyDealsPage(myDealsTotalPages)}
                        className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {myDealsTotalPages}
                      </button>
                    </>
                  ) : null}

                  <button
                    type="button"
                    onClick={() =>
                      setMyDealsPage((page) =>
                        Math.min(myDealsTotalPages, page + 1)
                      )
                    }
                    disabled={myDealsPage === myDealsTotalPages}
                    className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    次へ
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : topTab === "saved" ? (
          <section className="bg-white sm:mt-4 sm:rounded-xl sm:border sm:border-slate-200">
            <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
              <h1 className="text-xl font-bold text-slate-900">保存したディール</h1>
              <p className="mt-1 text-xs text-slate-500">
                保存したディール {countSaved}件
              </p>
            </div>

            {savedDealsMini.length === 0 ? (
              <div className="px-4 py-10 text-center sm:px-6">
                <div className="text-sm font-semibold text-slate-800">
                  保存したディールはありません。
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  気になるディールを保存すると、ここからいつでも見返せます。
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-200">
                {savedPageItems.map((deal) => (
                  <li
                    key={deal.id}
                    className="px-4 py-4 sm:px-6 sm:py-5"
                  >
                    <div className="flex items-center gap-3 sm:grid sm:grid-cols-[112px_minmax(0,1fr)_170px] sm:items-center sm:gap-5">
                      <Link
                        href={`/deals/${deal.id}`}
                        className="h-16 w-16 flex-none overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200 sm:h-24 sm:w-28 cursor-pointer"
                      >
                        <img
                          src={deal.image_url || PLACEHOLDER_IMG}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </Link>

                      <div className="min-w-0">
                        <Link
                          href={`/deals/${deal.id}`}
                          className="line-clamp-2 text-sm font-semibold text-blue-700 hover:underline sm:text-[15px] cursor-pointer"
                        >
                          {deal.title || "タイトル未設定"}
                        </Link>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          {deal.price != null ? (
                            <span className="font-bold text-slate-900">
                              {yen(deal.price)}
                            </span>
                          ) : null}

                          {deal.shop_name ? <span>{deal.shop_name}</span> : null}

                          {deal.is_expired ? (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-500">
                              期限切れ
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                              公開中
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex items-center gap-3 sm:hidden">
                          <span className="text-xs text-slate-400">
                            保存 {fmtJPDate(deal.saved_at)}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleRemoveSaved(deal.id)}
                            disabled={removingSavedId === deal.id}
                            className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                          >
                            {removingSavedId === deal.id ? "削除中…" : "削除"}
                          </button>
                        </div>
                      </div>

                      <div className="hidden self-stretch sm:flex sm:flex-col sm:items-end sm:justify-center">
                        <div className="text-xs text-slate-400">
                          保存 {fmtJPDate(deal.saved_at)}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveSaved(deal.id)}
                          disabled={removingSavedId === deal.id}
                          className="mt-3 rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                        >
                          {removingSavedId === deal.id ? "削除中…" : "削除"}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {savedDealsMini.length > 0 ? (
              <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="text-xs font-medium text-slate-600">
                  {savedTotalPages}ページ中 {savedPage}ページ
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setSavedPage((page) => Math.max(1, page - 1))
                    }
                    disabled={savedPage === 1}
                    className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    前へ
                  </button>

                  {savedPageNumbers[0] > 1 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setSavedPage(1)}
                        className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        1
                      </button>
                      {savedPageNumbers[0] > 2 ? (
                        <span className="px-1 text-xs text-slate-400">…</span>
                      ) : null}
                    </>
                  ) : null}

                  {savedPageNumbers.map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setSavedPage(page)}
                      className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-semibold ${
                        savedPage === page
                          ? "border-[#001e43] bg-[#001e43] text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {page}
                    </button>
                  ))}

                  {savedPageNumbers[savedPageNumbers.length - 1] <
                  savedTotalPages ? (
                    <>
                      {savedPageNumbers[savedPageNumbers.length - 1] <
                      savedTotalPages - 1 ? (
                        <span className="px-1 text-xs text-slate-400">…</span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setSavedPage(savedTotalPages)}
                        className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {savedTotalPages}
                      </button>
                    </>
                  ) : null}

                  <button
                    type="button"
                    onClick={() =>
                      setSavedPage((page) =>
                        Math.min(savedTotalPages, page + 1)
                      )
                    }
                    disabled={savedPage === savedTotalPages}
                    className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    次へ
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : topTab === "notifications" ? (
          <section className="bg-white sm:mt-4 sm:rounded-xl sm:border sm:border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
              <div>
                <h1 className="text-xl font-bold text-slate-900">通知</h1>
                <p className="mt-1 text-xs text-slate-500">
                  コメントへの返信など、あなた宛ての通知
                </p>
              </div>

              {unreadNotificationCount > 0 ? (
                <span className="rounded-full bg-[#006888] px-2.5 py-1 text-xs font-bold text-white">
                  未読 {unreadNotificationCount}
                </span>
              ) : null}
            </div>

            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center sm:px-6">
                <Bell className="mx-auto h-7 w-7 text-slate-300" />
                <div className="mt-3 text-sm font-semibold text-slate-800">
                  通知はありません。
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  コメントへの返信などがあると、ここに表示されます。
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-200">
                {notifications.map((item) => {
                  const deal = dealMiniMap[item.deal_id];
                  const isUnread = !item.read_at;

                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => void handleOpenNotification(item)}
                        className={`flex w-full cursor-pointer items-start gap-3 px-4 py-4 text-left transition hover:bg-slate-50 sm:px-6 ${
                          isUnread ? "bg-[#006888]/[0.05]" : "bg-white"
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full ${
                            isUnread
                              ? "bg-[#006888]/10 text-[#006888]"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm text-slate-800">
                              <span className="font-bold text-slate-900">
                                {item.actor_username}
                              </span>
                              さんがあなたのコメントに返信しました
                            </p>

                            {isUnread ? (
                              <span
                                className="mt-1.5 h-2 w-2 flex-none rounded-full bg-[#006888]"
                                aria-label="未読"
                              />
                            ) : null}
                          </div>

                          {item.body ? (
                            <p className="mt-1 line-clamp-2 text-sm text-slate-700">
                              「{item.body}」
                            </p>
                          ) : null}

                          {deal?.title ? (
                            <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                              {deal.title}
                            </p>
                          ) : null}

                          <div className="mt-1.5 text-[11px] text-slate-400">
                            {fmtJP(item.created_at)}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : (
          <section className="bg-white sm:mt-4 sm:rounded-xl sm:border sm:border-slate-200">
            <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
              <h1 className="text-xl font-bold text-slate-900">
                設定・オプション
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                アカウントとプロフィールの基本設定
              </p>
            </div>

            <div className="divide-y divide-slate-200">
              <div className="grid gap-4 px-4 py-6 sm:grid-cols-[220px_minmax(0,1fr)] sm:px-6">
                <div>
                  <div className="text-sm font-bold text-slate-900">プロフィール画像</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    マイページや投稿に表示されるプロフィール画像です。
                  </p>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <ProfileAvatar
                    src={avatarUrl}
                    name={username}
                    className="h-20 w-20 flex-none rounded-lg text-[80px]"
                  />

                  <div className="min-w-0">
                    <label
                      className={`inline-flex cursor-pointer items-center justify-center rounded-md bg-[#001e43] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#002b66] ${
                        savingAvatar ? "pointer-events-none opacity-60" : ""
                      }`}
                    >
                      {savingAvatar ? "アップロード中…" : "画像を選択"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleAvatarFileChange}
                        disabled={savingAvatar}
                        className="sr-only"
                      />
                    </label>
                    <p className="mt-2 text-xs text-slate-500">JPEG・PNG・WebP</p>
                    {avatarMsg ? (
                      <p className="mt-2 text-xs font-medium text-slate-700">
                        {avatarMsg}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 px-4 py-6 sm:grid-cols-[220px_minmax(0,1fr)] sm:px-6">
                <div>
                  <div className="text-sm font-bold text-slate-900">ユーザー名</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    トクミッケ上で表示される名前です。
                  </p>
                </div>

                <div className="max-w-xl">
                  <div className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                    {username || "-"}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    ユーザー名は登録後に変更できません。
                  </p>
                </div>
              </div>

              <div className="grid gap-4 px-4 py-6 sm:grid-cols-[220px_minmax(0,1fr)] sm:px-6">
                <div>
                  <div className="text-sm font-bold text-slate-900">メールアドレス</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    ログインに使用しているメールアドレスです。
                  </p>
                </div>

                <div className="w-full max-w-xl self-start rounded-md border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm leading-5 text-slate-700">
                  {user.email || "-"}
                </div>
              </div>

              <div className="grid gap-4 px-4 py-6 sm:grid-cols-[220px_minmax(0,1fr)] sm:px-6">
                <div>
                  <div className="text-sm font-bold text-slate-900">ログイン方法</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    同じトクミッケアカウントにログイン方法を追加できます。
                  </p>
                </div>

                <div className="max-w-xl">
                  <div className="flex flex-wrap items-center gap-2">
                    {linkedProviders.includes("email") ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                        メール 連携済み
                      </span>
                    ) : null}

                    {linkedProviders.includes("google") ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                        Google 連携済み
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleGoogleLink}
                        disabled={linkingGoogle}
                        className="inline-flex cursor-pointer items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {linkingGoogle ? "Googleへ移動中…" : "Googleを連携"}
                      </button>
                    )}

                    {linkedProviders.includes("custom:line-oauth") ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                        LINE 連携済み
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleLineLink}
                        disabled={linkingLine}
                        className="inline-flex cursor-pointer items-center justify-center rounded-md bg-[#06C755] px-4 py-2.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {linkingLine ? "LINEへ移動中…" : "LINEを連携"}
                      </button>
                    )}
                  </div>

                  {googleLinkMsg ? (
                    <p className="mt-2 text-xs font-medium text-slate-700">
                      {googleLinkMsg}
                    </p>
                  ) : null}

                  {lineLinkMsg ? (
                    <p className="mt-2 text-xs font-medium text-slate-700">
                      {lineLinkMsg}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 px-4 py-6 sm:grid-cols-[220px_minmax(0,1fr)] sm:px-6">
                <div>
                  <div className="text-sm font-bold text-slate-900">パスワード</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    登録メールアドレスのパスワードを設定・変更できます。
                  </p>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={passwordResetSending || !user.email}
                    className="inline-flex cursor-pointer items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {passwordResetSending
                      ? "送信中…"
                      : "パスワードを設定・変更"}
                  </button>

                  {passwordResetMsg ? (
                    <p className="mt-2 text-xs font-medium text-slate-700">
                      {passwordResetMsg}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 px-4 py-6 sm:grid-cols-[220px_minmax(0,1fr)] sm:px-6">
                <div>
                  <div className="text-sm font-bold text-slate-900">アカウント</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    この端末のトクミッケからログアウトします。
                  </p>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    ログアウト
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default function MyPage() {
  return (
    <Suspense fallback={null}>
      <MyPageContent />
    </Suspense>
  );
}
