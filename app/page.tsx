"use client";

import { useMemo, useState, useEffect } from "react";
import { Search, MessageSquare, ThumbsUp, Bookmark } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// ---- ダミーデータ（楽天市場 / Yahoo!ショッピング）
const DEALS = [
  {
    id: 101,
    user: "rin",
    avatar:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&crop=faces&auto=format",
    time: "今日 11:05",
    title: "Levi's 501 オリジナルフィット デニム",
    price: 7990,
    orig: 12980,
    market: "楽天市場",
    shopName: "Levi's 公式 楽天市場店",
    image:
      "https://images.unsplash.com/photo-1503342452485-86ff0a2514d2?w=1200&auto=format&fit=crop",
    likes: 18,
    comments: 6,
  },
  {
    id: 102,
    user: "yuna",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&crop=faces&auto=format",
    time: "今日 09:42",
    title: "adidas Stan Smith（ホワイト/グリーン）",
    price: 6480,
    orig: 11000,
    market: "Yahoo!ショッピング",
    shopName: "ABC-MART Yahoo!店",
    image:
      "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=1200&auto=format&fit=crop",
    likes: 25,
    comments: 9,
  },
  {
    id: 103,
    user: "kaito",
    avatar:
      "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=80&h=80&crop=faces&auto=format",
    time: "今日 08:10",
    title: "Champion リバースウィーブ パーカー",
    price: 5980,
    orig: 9900,
    market: "楽天市場",
    shopName: "Sports Lab by atmos",
    image:
      "https://images.unsplash.com/photo-1520975922325-24e0b5922325?w=1200&auto=format&fit=crop",
    likes: 42,
    comments: 11,
  },
  {
    id: 104,
    user: "mika",
    avatar:
      "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=80&h=80&crop=faces&auto=format",
    time: "今日 13:20",
    title: "New Balance 327（ネイビー）",
    price: 8790,
    orig: 12980,
    market: "Yahoo!ショッピング",
    shopName: "New Balance 公式 Yahoo!店",
    image:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200&auto=format&fit=crop",
    likes: 7,
    comments: 0,
  },
  {
    id: 105,
    user: "sora",
    avatar:
      "https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=80&h=80&crop=faces&auto=format",
    time: "今日 09:55",
    title: "THE NORTH FACE マウンテンジャケット",
    price: 21990,
    orig: 39600,
    market: "楽天市場",
    shopName: "The North Face 楽天市場店",
    image:
      "https://images.unsplash.com/photo-1516826957135-700dedea698c?w=1200&auto=format&fit=crop",
    likes: 63,
    comments: 14,
  },
];

// ---- トップディール用ダミーデータ（100件用意して 1ページ50件ずつ表示）
const TOP_DEALS_ALL = Array.from({ length: 100 }, (_, i) => ({
  id: 200 + i,
  user: "sampleuser",
  avatar:
    "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=80&h=80&crop=faces&auto=format",
  time: "今日 10:00",
  title: `Sample トップディール ${i + 1}`,
  price: 4990 + (i % 5) * 500,
  orig: 8990 + (i % 5) * 500,
  market: i % 2 === 0 ? "楽天市場" : "Yahoo!ショッピング",
  shopName: `Sample Shop ${((i % 10) + 1).toString().padStart(2, "0")}`,
  image: "https://via.placeholder.com/600x600?text=Sample",
  likes: 10 + (i % 40),
  comments: 2 + (i % 10),
}));

// 右カラム用：人気順・コメント順
const POPULAR_DEALS = [...DEALS].sort((a, b) => b.likes - a.likes);
const TRENDING_DEALS = [...DEALS].sort((a, b) => b.comments - a.comments);

function yen(n: number) {
  return `${Number(n).toLocaleString("ja-JP")}円`;
}

function MarketTag({ market }: { market: string }) {
  const isRakuten = market === "楽天市場";
  const base = isRakuten
    ? { border: "#6c2735", text: "#6c2735", bg: "#f8eff1" }
    : { border: "#00533f", text: "#00533f", bg: "#e9f2ef" };
  return (
    <span
      style={{
        borderColor: base.border,
        color: base.text,
        backgroundColor: base.bg,
      }}
      className="inline-flex items-center px-1 py-[1px] text-[10px] font-medium border rounded-none"
    >
      {market}
    </span>
  );
}

function Card({ d }: { d: any }) {
  return (
    <article className="flex h-full flex-col rounded-lg bg-white ring-1 ring-slate-200 shadow-md hover:shadow-lg transition overflow-hidden">
      {/* ヘッダー */}
      <div className="px-3 pt-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <img
            src={d.avatar}
            alt=""
            className="h-6 w-6 rounded-full object-cover"
          />
          <div>
            <div className="text-slate-600">
              Posted by{" "}
              <span className="font-medium text-slate-700">{d.user}</span>
            </div>
            <div>{d.time}</div>
          </div>
        </div>
      </div>

      {/* 画像 */}
      <div className="px-3 pt-3">
        <div className="w-full rounded-lg bg-white ring-1 ring-slate-200/60 overflow-hidden">
          <div className="aspect-square w-full overflow-hidden">
            <img
              src={d.image}
              alt=""
              className="block w-full h-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* 本文 */}
      <div className="px-3 pt-2 pb-3">
        <div className="flex items-center gap-2">
          <MarketTag market={d.market} />
        </div>
        <h3 className="mt-2 text-[15px] leading-snug font-semibold text-slate-900 line-clamp-2">
          {d.title}
        </h3>
        <div className="mt-2 flex items-baseline gap-2">
          <div className="text-[20px] font-bold text-[#d70035]">
            {yen(d.price)}
          </div>
          {d.orig ? (
            <div className="text-sm text-slate-400 line-through">
              {yen(d.orig)}
            </div>
          ) : null}
        </div>
        <div className="mt-1 text-xs text-slate-600">{d.shopName}</div>
      </div>

      {/* フッター */}
      <div className="mt-auto border-t border-slate-200 px-3 py-2 text-slate-500">
        <div className="flex items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1">
            <ThumbsUp className="h-4 w-4" /> {d.likes}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="h-4 w-4" /> {d.comments}
          </span>
          <button className="ml-auto inline-flex items-center gap-1 hover:text-slate-700">
            <Bookmark className="h-4 w-4" /> Save
          </button>
        </div>
      </div>
    </article>
  );
}

type CardSize = "normal" | "small";

export default function Page() {
  const [q, setQ] = useState("");
  const [cardSize, setCardSize] = useState<CardSize>("normal");
  const [cardsPerPage, setCardsPerPage] = useState<number>(5);
  const [currentPage, setCurrentPage] = useState<number>(0);

  // Supabase ログインユーザー
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  // トップディールのページ（1 or 2）
  const [topDealsPage, setTopDealsPage] = useState<1 | 2>(1);

  // このページで表示するトップディール 50件
  const topDealsForThisPage = TOP_DEALS_ALL.slice(
    (topDealsPage - 1) * 50,
    topDealsPage * 50
  );

  const filtered = useMemo(
    () =>
      DEALS.filter((d) =>
        q
          ? (d.title + " " + d.shopName)
              .toLowerCase()
              .includes(q.toLowerCase())
          : true
      ),
    [q]
  );

  // ---- レイアウト計算用の定数（px）
  const CARD_WIDTH_NORMAL = 220;
  const CARD_WIDTH_SMALL = 190;
  const CARD_GAP = 12; // gap-3
  const SIDEBAR_WIDTH = 288; // w-72
  const OUTER_GAP = 24; // gap-6
  const PADDING_X = 32; // main の px-4 * 2

  function decideLayout(viewportWidth: number) {
    type Combo = { size: CardSize; count: number; cardWidth: number };

    const combos: Combo[] = [
      { size: "normal", count: 5, cardWidth: CARD_WIDTH_NORMAL },
      { size: "small", count: 5, cardWidth: CARD_WIDTH_SMALL },
      { size: "normal", count: 4, cardWidth: CARD_WIDTH_NORMAL },
      { size: "small", count: 4, cardWidth: CARD_WIDTH_SMALL },
      { size: "normal", count: 3, cardWidth: CARD_WIDTH_NORMAL },
      { size: "small", count: 3, cardWidth: CARD_WIDTH_SMALL },
    ];

    const available = viewportWidth - PADDING_X;

    for (const c of combos) {
      const cardsWidth = c.count * c.cardWidth + (c.count - 1) * CARD_GAP;
      const totalWidth = cardsWidth + SIDEBAR_WIDTH + OUTER_GAP;

      if (totalWidth <= available) {
        setCardSize(c.size);
        setCardsPerPage(c.count);
        return;
      }
    }

    // どの組み合わせも入らない場合の最小レイアウト：スモール3枚
    setCardSize("small");
    setCardsPerPage(3);
  }

  // ウィンドウ幅を監視してレイアウト決定
  useEffect(() => {
    function handleResize() {
      if (typeof window === "undefined") return;
      decideLayout(window.innerWidth);
    }

    handleResize(); // 初回
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ページ数と currentPage の補正（あなたにおすすめ用）
  const totalPages = Math.max(
    1,
    cardsPerPage > 0 ? Math.ceil(filtered.length / cardsPerPage) : 1
  );

  useEffect(() => {
    if (currentPage > totalPages - 1) {
      setCurrentPage(totalPages - 1);
    }
  }, [totalPages, currentPage]);

  // 初回マウント時にログイン中のユーザーを取得
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data.user ?? null);
    });
  }, []);

  // 初回に ?page= を読む
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const p = params.get("page");
    setTopDealsPage(p === "2" ? 2 : 1);
  }, []);

  // フォント
  const fontJP = {
    fontFamily:
      '"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji"',
  } as const;

  // カード列 1 行分の実際の幅
  const cardWidthPx =
    cardSize === "normal" ? CARD_WIDTH_NORMAL : CARD_WIDTH_SMALL;

  const rowCardsWidth =
    cardsPerPage * cardWidthPx + (cardsPerPage - 1) * CARD_GAP;

  const layoutTotalWidth = rowCardsWidth + SIDEBAR_WIDTH + OUTER_GAP;

  const cardWidthClass =
    cardSize === "normal" ? "w-[220px]" : "w-[190px]";

  const handlePrev = () => {
    setCurrentPage((p) => Math.max(0, p - 1));
  };

  const handleNext = () => {
    setCurrentPage((p) => Math.min(totalPages - 1, p + 1));
  };

  // ログアウト処理
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    window.location.href = "/";
  };

  // 現在ページに表示するカード（あなたにおすすめ）
  const startIndex = currentPage * cardsPerPage;
  const visibleCards = filtered.slice(startIndex, startIndex + cardsPerPage);

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#fffafa", ...fontJP }}
    >
      {/* サイト説明帯 */}
      <div
        className="w-full text-center text-[12px] leading-tight py-1 px-2"
        style={{ backgroundColor: "#006888", color: "#ffffff" }}
      >
        アウトフィットディールズは、ファッション好きが“お得”をシェアし合うコミュニティです。セール情報に加えて、レビューやコーデ投稿でユーザー同士がつながれる場所です。
      </div>

      {/* ヘッダー */}
      <header
        className="sticky top-0 z-40 border-b border-slate-200"
        style={{ backgroundColor: "#001e43" }}
      >
        <div className="mx-auto max-w-[1500px] px-4 text-white">
          <div className="flex h-16 items-center gap-3">
            {/* 左：ロゴ */}
            <div className="flex items-center gap-3">
              <img
                src="https://outfitdeals.vercel.app/outfitdeals_logo2.png"
                alt="Outfit Deals"
                className="w-auto block h-8 md:h-10 lg:h-11"
              />
              <span className="sr-only">Outfit Deals</span>
            </div>

            {/* 中央：検索バー */}
            <div className="ml-4 hidden md:flex flex-1 items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2">
              <Search className="h-4 w-4 text-white/70" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full bg-transparent text-sm placeholder:text-white/70 focus:outline-none"
                placeholder="お得なディールを検索"
              />
            </div>

            {/* 右：投稿 + ログイン / マイページ + ログアウト */}
            <div className="flex items-center gap-3 ml-3">
              {/* 投稿する */}
              <button
                className="hidden sm:inline-flex items-center gap-1 text-white/90 hover:text-white"
                title="ディールを投稿"
                type="button"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span className="text-sm font-medium">投稿</span>
              </button>

              {currentUser ? (
                <>
                  {/* ログイン済：マイページリンク */}
                  <a
                    href="/mypage"
                    className="hidden sm:inline-flex items-center gap-1 text-white/90 hover:text-white"
                    title="マイページ"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5.121 17.804A13.937 13.937 0 0112 15c2.485 0 4.797.635 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <span className="text-sm font-medium">マイページ</span>
                  </a>

                  {/* ログアウト */}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1 rounded-full border border-white/40 px-3 py-1 text-xs font-medium text-white hover:bg-white/10"
                  >
                    ログアウト
                  </button>
                </>
              ) : (
                // 未ログイン：ログインボタン
                <a
                  href="/auth"
                  className="hidden sm:inline-flex items-center gap-1 text-white/90 hover:text-white"
                  title="ログイン"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5.121 17.804A13.937 13.937 0 0112 15c2.485 0 4.797.635 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span className="text-sm font-medium">ログイン</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* メイン */}
      <main className="mx-auto max-w-[1500px] px-4 py-6 overflow-x-auto">
        {/* レイアウト全体を shrink-to-fit させて中央寄せ */}
        <div className="flex justify-center">
          <div
            className="flex flex-row gap-6"
            style={{ minWidth: layoutTotalWidth }}
          >
            {/* 左：あなたにおすすめ + トップディール */}
            <section
              className="min-w-0 flex-none"
              style={{ width: rowCardsWidth }}
            >
              {/* 見出し + 矢印 */}
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-[#001e43] tracking-wide">
                  あなたにおすすめ
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrev}
                    disabled={currentPage === 0 || totalPages <= 1}
                    className="h-8 w-8 rounded-full border border-slate-300 bg-white flex items-center justify-center text-slate-600 disabled:opacity-30 disabled:cursor-default"
                    aria-label="前へ"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        d="M15 18l-6-6 6-6"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={
                      currentPage === totalPages - 1 || totalPages <= 1
                    }
                    className="h-8 w-8 rounded-full border border-slate-300 bg-white flex items-center justify-center text-slate-600 disabled:opacity-30 disabled:cursor-default"
                    aria-label="次へ"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        d="M9 6l6 6-6 6"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* あなたにおすすめ：1 行分のカード */}
              <div className="w-full">
                <div className="flex gap-3">
                  {visibleCards.map((d) => (
                    <div key={d.id} className={`${cardWidthClass} flex-none`}>
                      <Card d={d} />
                    </div>
                  ))}
                </div>
              </div>

              {/* トップディール：グリッド 3〜5 列・ページネーション付き */}
              <div className="mt-8">
                <h2 className="text-xl font-semibold text-[#001e43] tracking-wide">
                  トップディール
                </h2>
                <div className="mt-3">
                  <div
                    className="grid gap-3"
                    style={{
                      gridTemplateColumns: `repeat(${cardsPerPage}, ${cardWidthPx}px)`,
                    }}
                  >
                    {topDealsForThisPage.map((d) => (
                      <div key={d.id} className="flex-none">
                        <Card d={d} />
                      </div>
                    ))}
                  </div>

                  {/* Slickdeals風：右下「前へ」「次へ」 */}
                  <div className="mt-6 flex justify-end">
                    <div className="flex items-center gap-3">
                      {/* 前へ（page=1 のとき無効） */}
                      <a
                        href="/?page=1"
                        className={
                          topDealsPage === 1
                            ? "inline-flex items-center gap-1 px-4 py-1.5 rounded-full border border-slate-200 bg-slate-100 text-slate-400 cursor-default pointer-events-none text-sm"
                            : "inline-flex items-center gap-1 px-4 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-sm text-black"
                        }
                      >
                        前へ
                      </a>

                      {/* 次へ（page=2 のとき無効） */}
                      <a
                        href="/?page=2"
                        className={
                          topDealsPage === 2
                            ? "inline-flex items-center gap-1 px-4 py-1.5 rounded-full border border-slate-200 bg-slate-100 text-slate-400 cursor-default pointer-events-none text-sm"
                            : "inline-flex items-center gap-1 px-4 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-sm text-black"
                        }
                      >
                        次へ
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 右：サイドカラム */}
            <aside className="w-72 flex-none space-y-4 mt-[44px]">
              {/* 人気のディール */}
              <section className="rounded-lg bg-white shadow-md ring-1 ring-slate-200 overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
                  <h3 className="text-xs font-semibold text-slate-700 tracking-wide">
                    人気のディール
                  </h3>
                </div>
                <ol className="divide-y divide-slate-100 text-xs">
                  {POPULAR_DEALS.slice(0, 5).map((d, idx) => (
                    <li
                      key={d.id}
                      className="px-3 py-2 flex items-start gap-2 hover:bg-slate-50"
                    >
                      <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <MarketTag market={d.market} />
                        </div>
                        <div className="mt-0.5 text-[12px] text-slate-800 line-clamp-2">
                          {d.title}
                        </div>
                        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-slate-500">
                          <span>{yen(d.price)}</span>
                          <span className="inline-flex items-center gap-1">
                            <ThumbsUp className="h-3 w-3" /> {d.likes}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              {/* 人気急上昇中のディール */}
              <section className="rounded-lg bg-white shadow-md ring-1 ring-slate-200 overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
                  <h3 className="text-xs font-semibold text-slate-700 tracking-wide">
                    人気急上昇中のディール
                  </h3>
                </div>
                <ol className="divide-y divide-slate-100 text-xs">
                  {TRENDING_DEALS.slice(0, 5).map((d, idx) => (
                    <li
                      key={d.id}
                      className="px-3 py-2 flex items-start gap-2 hover:bg-slate-50"
                    >
                      <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <MarketTag market={d.market} />
                        </div>
                        <div className="mt-0.5 text-[12px] text-slate-800 line-clamp-2">
                          {d.title}
                        </div>
                        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-slate-500">
                          <span>{yen(d.price)}</span>
                          <span className="inline-flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" /> {d.comments}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
