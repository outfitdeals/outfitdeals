"use client";

import React from "react";
import Link from "next/link";
import { MessageSquare, ThumbsUp } from "lucide-react";
import { MarketTag, yen } from "@/app/components/DealUI";

function getCategoryLabel(category?: string | null) {
  switch (category) {
    case "fashion_women":
      return "レディース";
    case "fashion_men":
      return "メンズ";
    case "food":
      return "食品・飲料";
    case "beauty":
      return "ビューティー";
    case "home":
      return "日用品・ホーム";
    case "interior":
      return "インテリア・家具";
    case "electronics":
      return "家電・ガジェット";
    case "sports":
      return "スポーツ・アウトドア";
    case "shoes":
      return "靴・シューズ";
    case "other":
      return "その他";
    default:
      return "";
  }
}

function NewBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={
        compact
          ? "inline-flex self-center items-center rounded bg-[#d43b16] px-1.5 py-[1px] text-[9px] font-bold leading-none text-white"
          : "inline-flex self-center items-center rounded bg-[#d43b16] px-2 py-[2px] text-[10px] font-bold leading-none text-white"
      }
    >
      NEW
    </span>
  );
}


type CardProps = {
  d: any;
  onLike?: () => void;
  canLike?: boolean;
  isLiked?: boolean;
  onSave?: () => void;
  canSave?: boolean;
  isSaved?: boolean;
};

export default function DealCard({
  d,
  onLike,
  canLike = false,
  isLiked = false,
  onSave,
  canSave = false,
  isSaved = false,
}: CardProps) {
  const imageSrc: string =
    d.imageUrl ?? d.image ?? "https://via.placeholder.com/600x600?text=No+Image";

  const imageBlock = (
    <div className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="aspect-square w-full overflow-hidden">
        <img
          src={imageSrc}
          alt=""
          className="block h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  );

  const imageWrapper = d.detailUrl ? (
    <Link href={d.detailUrl} className="block cursor-pointer">
      {imageBlock}
    </Link>
  ) : d.linkUrl ? (
    <a
      href={d.linkUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block cursor-pointer"
    >
      {imageBlock}
    </a>
  ) : (
    imageBlock
  );

  const likeCount = Number(d.likes ?? 0);
  const likeDisabled = !canLike;
  const saveDisabled = !canSave;
  const categoryLabel = getCategoryLabel(d.category);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_8px_18px_-10px_rgba(15,23,42,0.28)] transition hover:shadow-[0_12px_24px_-10px_rgba(15,23,42,0.34)]">
      <div className="px-3 pt-3 text-[11.5px] leading-[1.35] text-slate-500">
        <div className="flex items-center gap-2">
          {d.userId ? (
            <Link
              href={`/users/${d.userId}`}
              className="block cursor-pointer"
              aria-label={`${d.user}のプロフィールを見る`}
            >
              <img
                src={d.avatar}
                alt=""
                referrerPolicy="no-referrer"
                className="h-6 w-6 rounded-full object-cover"
              />
            </Link>
          ) : (
            <img
              src={d.avatar}
              alt=""
              referrerPolicy="no-referrer"
              className="h-6 w-6 rounded-full object-cover"
            />
          )}
          <div>
            <div className="text-slate-600">
              投稿者{" "}
              {d.userId ? (
                <Link
                  href={`/users/${d.userId}`}
                  className="inline-block max-w-[86px] truncate align-bottom cursor-pointer font-medium text-slate-700 hover:text-[#006888] hover:underline"
                  title={d.user}
                >
                  {d.user}
                </Link>
              ) : (
                <span
                  className="inline-block max-w-[86px] truncate align-bottom font-medium text-slate-700"
                  title={d.user}
                >
                  {d.user}
                </span>
              )}
            </div>
            <div>{d.time}</div>
          </div>
        </div>
      </div>

      <div className="px-3 pt-3">{imageWrapper}</div>

      <div className="px-3 pb-3 pt-2">
        {categoryLabel ? (
          <div className="mb-1">
            <span className="inline-block rounded bg-slate-100 px-2 py-[2px] text-[10px] font-semibold text-slate-600">
              {categoryLabel}
            </span>
          </div>
        ) : null}

        <h3 className="line-clamp-3 text-[14px] font-semibold leading-snug text-slate-900">
          {d.detailUrl ? (
            <Link href={d.detailUrl} className="cursor-pointer hover:underline">
              {d.title}
            </Link>
          ) : (
            d.title
          )}
        </h3>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <div className="text-[18px] font-bold text-[#d70035]">
            {yen(d.price)}
          </div>
          {d.orig ? (
            <div className="text-sm text-slate-400 line-through">
              {yen(d.orig)}
            </div>
          ) : null}
          {d.isNew ? <NewBadge /> : null}
        </div>

        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="min-w-0 truncate text-xs text-slate-600">
            {d.shopName}
          </div>
          <div className="flex-shrink-0">
            <MarketTag market={d.market} />
          </div>
        </div>
      </div>

      <div className="mt-auto border-t border-slate-200 px-3 py-2 text-slate-500">
        <div className="flex items-center gap-4 text-xs">
          <button
            type="button"
            onClick={onLike}
            disabled={likeDisabled}
            className={
              isLiked
                ? "inline-flex cursor-pointer items-center gap-1 text-[#006888]"
                : !canLike
                  ? "inline-flex items-center gap-1 cursor-default text-slate-400"
                  : "inline-flex items-center gap-1 cursor-pointer hover:text-slate-700"
            }
            aria-label="いいね"
            title={
              !canLike
                ? "いいねするにはログインが必要です"
                : isLiked
                  ? "いいね済み"
                  : "いいね"
            }
          >
            <ThumbsUp
              className="h-4 w-4"
              fill={isLiked ? "currentColor" : "none"}
            />
            {likeCount}
          </button>

          <Link
            href={`${d.detailUrl}#comments`}
            className={
              d.hasCommented
                ? "inline-flex cursor-pointer items-center gap-1 text-[#001e43] hover:text-[#001e43]"
                : "inline-flex cursor-pointer items-center gap-1 hover:text-slate-700"
            }
            title={d.hasCommented ? "コメント済み" : "コメントを見る"}
            aria-label="コメントを見る"
          >
            <MessageSquare
              className="h-4 w-4"
              fill={d.hasCommented ? "currentColor" : "none"}
            />
            {Number(d.comments ?? 0)}
          </Link>

          <button
            type="button"
            onClick={onSave}
            className="ml-auto inline-flex cursor-pointer items-center text-slate-500 hover:text-slate-700"
            aria-label="シェア"
            title="シェア"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-4 w-4 fill-current"
            >
              <path d="M21.55 9.17 14.83 3.5a.75.75 0 0 0-1.23.57v3.06C7.5 7.63 3.25 10.72 2.1 16.8a.75.75 0 0 0 1.28.65c2.52-2.7 5.57-4.12 10.22-4.22v3.2a.75.75 0 0 0 1.23.57l6.72-5.67a1.4 1.4 0 0 0 0-2.16Z" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
}

