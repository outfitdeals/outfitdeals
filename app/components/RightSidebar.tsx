// app/components/RightSidebar.tsx
"use client";

import React from "react";
import Link from "next/link";
import { MessageSquare, ThumbsUp } from "lucide-react";
import { yen } from "./DealUI";

export type SidebarDeal = {
  id: string;
  title: string;
  price: number;
  market: string;
  imageUrl?: string | null;
  likes?: number;
  comments?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  isCommented?: boolean;
};

type Props = {
  /** 右上：人気のディール */
  popular?: SidebarDeal[];
  /** 右下：人気急上昇中のディール */
  trending?: SidebarDeal[];
  /** まもなく終了 */
  endingSoon?: SidebarDeal[];

  /** いいね（任意） */
  onLike?: (id: string) => void;
  /** シェア（任意） */
  onShare?: (id: string) => void;

  /** 既存の呼び出し側との互換性のため残す */
  canLike?: boolean;

  /** topページで見た目を合わせたいとき用 */
  className?: string;

  /** ランキング番号を出す（デフォルト false） */
  showRank?: boolean;

  /** サムネが無い時のプレースホルダー */
  placeholderImg?: string;
};

const DEFAULT_PLACEHOLDER = "https://via.placeholder.com/80x80?text=No+Image";

function clamp3Style(): React.CSSProperties {
  return {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical" as any,
    WebkitLineClamp: 3 as any,
    overflow: "hidden",
  };
}

export default function RightSidebar({
  popular = [],
  trending = [],
  endingSoon = [],
  onLike,
  onShare,
  canLike: _canLike,
  className = "w-72 flex-none space-y-4 mt-[44px]",
  showRank = false,
  placeholderImg = DEFAULT_PLACEHOLDER,
}: Props) {
  const clampStyle = clamp3Style();

  const renderList = (items: SidebarDeal[]) => {
    if (!items || items.length === 0) {
      return (
        <div className="px-3 py-3 text-xs text-slate-500">
          ディールがありません。
        </div>
      );
    }

    return (
      <ol className="divide-y divide-slate-100 text-xs">
        {items.map((d, idx) => {
          const likeDisabled = !onLike;
          const isLiked = d.isLiked === true;

          return (
            <li
              key={d.id}
              className="flex items-start gap-2 px-3 py-2 hover:bg-slate-50"
            >
              {showRank ? (
                <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">
                  {idx + 1}
                </span>
              ) : null}

              <Link
                href={`/deals/${d.id}`}
                className="h-20 w-20 flex-none overflow-hidden rounded-md bg-white ring-1 ring-slate-200"
                title="詳細を見る"
              >
                <img
                  src={d.imageUrl ?? placeholderImg}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </Link>

              <div className="min-w-0 flex-1">
                <Link
                  href={`/deals/${d.id}`}
                  className="block text-[12px] text-slate-800 hover:underline"
                  style={clampStyle}
                >
                  {d.title}
                </Link>

                <div className="mt-0.5 text-[11px] text-[#d90429]">
                  {yen(d.price)}
                </div>

                <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
                  <button
                    type="button"
                    onClick={() => onLike?.(d.id)}
                    disabled={likeDisabled}
                    className={
                      likeDisabled
                        ? "inline-flex cursor-default items-center gap-1 text-slate-400"
                        : isLiked
                          ? "inline-flex cursor-pointer items-center gap-1 text-[#f59e0b]"
                          : "inline-flex cursor-pointer items-center gap-1 text-slate-500 hover:text-[#f59e0b]"
                    }
                    aria-label={isLiked ? "いいねを取り消す" : "いいね"}
                    title={
                      likeDisabled
                        ? "いいねできません"
                        : isLiked
                          ? "クリックしていいねを取り消す"
                          : "いいね"
                    }
                  >
                    <ThumbsUp
                      className="h-3 w-3"
                      fill={isLiked ? "currentColor" : "none"}
                    />
                    {Number(d.likes ?? 0)}
                  </button>

                  <Link
                    href={`/deals/${d.id}#comments`}
                    className={
                      d.isCommented
                        ? "inline-flex cursor-pointer items-center gap-1 text-[#006888] hover:text-[#00546d]"
                        : "inline-flex cursor-pointer items-center gap-1 text-slate-500 hover:text-[#006888]"
                    }
                    title={d.isCommented ? "コメント済み" : "コメントを見る"}
                    aria-label="コメントを見る"
                  >
                    <MessageSquare
                      className="h-3 w-3"
                      fill={d.isCommented ? "currentColor" : "none"}
                    />
                    {Number(d.comments ?? 0)}
                  </Link>

                  <button
                    type="button"
                    onClick={() => onShare?.(d.id)}
                    className="ml-auto inline-flex cursor-pointer items-center text-slate-500 hover:text-[#006888]"
                    aria-label="シェア"
                    title="シェア"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-3.5 w-3.5 fill-current"
                    >
                      <path d="M21.55 9.17 14.83 3.5a.75.75 0 0 0-1.23.57v3.06C7.5 7.63 3.25 10.72 2.1 16.8a.75.75 0 0 0 1.28.65c2.52-2.7 5.57-4.12 10.22-4.22v3.2a.75.75 0 0 0 1.23.57l6.72-5.67a1.4 1.4 0 0 0 0-2.16Z" />
                    </svg>
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    );
  };

  return (
    <aside className={className}>
      <section className="overflow-hidden rounded-lg bg-white shadow-md ring-1 ring-slate-200">
        <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
          <h3 className="text-xs font-semibold tracking-wide text-slate-700">
            人気のディール
          </h3>
        </div>
        {renderList(popular)}
      </section>

      <section className="overflow-hidden rounded-lg bg-white shadow-md ring-1 ring-slate-200">
        <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
          <h3 className="text-xs font-semibold tracking-wide text-slate-700">
            人気急上昇中のディール
          </h3>
        </div>
        {renderList(trending)}
      </section>

      <section className="overflow-hidden rounded-lg bg-white shadow-md ring-1 ring-slate-200">
        <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
          <h3 className="text-xs font-semibold tracking-wide text-slate-700">
            まもなく終了
          </h3>
        </div>
        {renderList(endingSoon)}
      </section>
    </aside>
  );
}
