"use client";

import { useMemo, useState } from "react";
import { Search, MessageSquare, ThumbsUp, Bookmark } from "lucide-react";

// ---- ダミーデータ（楽天市場 / Yahoo!ショッピング）
const DEALS = [
  {
    id: 101,
    user: "rin",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&crop=faces&auto=format",
    time: "今日 11:05",
    title: "Levi's 501 オリジナルフィット デニム",
    price: 7990,
    orig: 12980,
    market: "楽天市場",
    shopName: "Levi's 公式 楽天市場店",
    image: "https://images.unsplash.com/photo-1503342452485-86ff0a2514d2?w=1200&auto=format&fit=crop",
    likes: 18,
    comments: 6
  },
  {
    id: 102,
    user: "yuna",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&crop=faces&auto=format",
    time: "今日 09:42",
    title: "adidas Stan Smith（ホワイト/グリーン）",
    price: 6480,
    orig: 11000,
    market: "Yahoo!ショッピング",
    shopName: "ABC-MART Yahoo!店",
    image: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=1200&auto=format&fit=crop",
    likes: 25,
    comments: 9
  },
  {
    id: 103,
    user: "kaito",
    avatar: "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=80&h=80&crop=faces&auto=format",
    time: "今日 08:10",
    title: "Champion リバースウィーブ パーカー",
    price: 5980,
    orig: 9900,
    market: "楽天市場",
    shopName: "Sports Lab by atmos",
    image: "https://images.unsplash.com/photo-1520975922325-24e0b592f43f?w=1200&auto=format&fit=crop",
    likes: 42,
    comments: 11
  },
  {
    id: 104,
    user: "mika",
    avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=80&h=80&crop=faces&auto=format",
    time: "今日 13:20",
    title: "New Balance 327（ネイビー）",
    price: 8790,
    orig: 12980,
    market: "Yahoo!ショッピング",
    shopName: "New Balance 公式 Yahoo!店",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200&auto=format&fit=crop",
    likes: 7,
    comments: 0
  },
  {
    id: 105,
    user: "sora",
    avatar: "https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=80&h=80&crop=faces&auto=format",
    time: "今日 09:55",
    title: "THE NORTH FACE マウンテンジャケット",
    price: 21990,
    orig: 39600,
    market: "楽天市場",
    shopName: "The North Face 楽天市場店",
    image: "https://images.unsplash.com/photo-1516826957135-700dedea698c?w=1200&auto=format&fit=crop",
    likes: 63,
    comments: 14
  }
];

function yen(n: number){
  return `${Number(n).toLocaleString('ja-JP')}円`;
}

function MarketTag({ market }: { market: string }){
  const isRakuten = market === "楽天市場";
  const base = isRakuten
    ? { border:'#6c2735', text:'#6c2735', bg:'#f8eff1' }
    : { border:'#00533f', text:'#00533f', bg:'#e9f2ef' };
  return (
    <span
      style={{ borderColor: base.border, color: base.text, backgroundColor: base.bg }}
      className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium border rounded-none"
    >
      {market}
    </span>
  );
}

function Card({ d }: { d: any }){
  return (
    <article className="flex flex-col rounded-lg bg-white ring-1 ring-slate-200 shadow-md hover:shadow-lg transition overflow-hidden">
      {/* ヘッダー（ユーザー/時刻） */}
      <div className="px-3 pt-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <img src={d.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
          <div>
            <div className="text-slate-600">Posted by <span className="font-medium text-slate-700">{d.user}</span></div>
            <div>{d.time}</div>
          </div>
        </div>
      </div>

      {/* 画像（正方形固定） */}
      <div className="px-3 pt-3">
        <div className="w-full rounded-lg bg-white ring-1 ring-slate-200/60 overflow-hidden">
          <div className="aspect-square w-full overflow-hidden">
            <img src={d.image} alt="" className="block w-full h-full object-cover" />
          </div>
        </div>
      </div>

      {/* 本文 */}
      <div className="px-3 pt-2 pb-3">
        <div className="flex items-center gap-2">
          <MarketTag market={d.market} />
        </div>
        <h3 className="mt-2 text-[15px] leading-snug font-semibold text-slate-900 line-clamp-2">{d.title}</h3>
        <div className="mt-2 flex items-baseline gap-2">
          <div className="text-[20px] font-bold text-[#d70035]">{yen(d.price)}</div>
          {d.orig ? <div className="text-sm text-slate-400 line-through">{yen(d.orig)}</div> : null}
        </div>
        <div className="mt-1 text-xs text-slate-600">{d.shopName}</div>
      </div>

      {/* フッター */}
      <div className="mt-auto border-t border-slate-200 px-3 py-2 text-slate-500">
        <div className="flex items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1"><ThumbsUp className="h-4 w-4" /> {d.likes}</span>
          <span className="inline-flex items-center gap-1"><MessageSquare className="h-4 w-4" /> {d.comments}</span>
          <button className="ml-auto inline-flex items-center gap-1 hover:text-slate-700"><Bookmark className="h-4 w-4" /> Save</button>
        </div>
      </div>
    </article>
  );
}

export default function Page(){
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    return DEALS.filter(d => (q ? (d.title + " " + d.shopName).toLowerCase().includes(q.toLowerCase()) : true));
  }, [q]);

  // 全体フォント（ヒラギノ系）
  const fontJP = {
    fontFamily: '"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji"'
  } as const;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#fffafa', ...fontJP }}>
      {/* サイト説明帯 */}
      <div className="w-full text-center text-[12px] leading-tight py-1 px-2" style={{ backgroundColor:'#006888', color:'#ffffff' }}>
        アウトフィットディールズは、ファッション好きが“お得”をシェアし合うコミュニティです。セール情報に加えて、レビューやコーデ投稿でユーザー同士がつながれる場所です。
      </div>

      {/* ヘッダー */}
<header className="sticky top-0 z-40 border-b border-slate-200" style={{ backgroundColor: '#001e43' }}>
  <div className="mx-auto max-w-7xl px-4 text-white">
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
          onChange={(e)=>setQ(e.target.value)}
          className="w-full bg-transparent text-sm placeholder:text-white/70 focus:outline-none"
          placeholder="お得なディールを検索"
        />
      </div>

      {/* 右：アイコン（投稿・マイページ） */}
      <div className="flex items-center gap-3 ml-3">
        {/* 投稿する */}
        <button
          className="hidden sm:inline-flex items-center gap-1 text-white/90 hover:text-white"
          title="ディールを投稿"
          type="button"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-sm font-medium">投稿</span>
        </button>

        {/* マイページ */}
        <button
          className="hidden sm:inline-flex items-center gap-1 text-white/90 hover:text-white"
          title="マイページ"
          type="button"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 15c2.485 0 4.797.635 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm font-medium">マイページ</span>
        </button>
      </div>

    </div>
  </div>
</header>


      {/* グリッド */}
      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* ★ ここだけ変更: tracking-wide を追加 */}
        <h2 className="mb-3 text-xl font-semibold text-[#001e43] tracking-wide">あなたにおすすめ</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map(d => (
            <Card key={d.id} d={d} />
          ))}
        </div>
      </main>
    </div>
  );
}
