"use client";

import Link from "next/link";
import { MessageSquare, ThumbsUp } from "lucide-react";
import { yen } from "@/app/components/DealUI";

type MobileDealRowProps = {
  d: any;
  onLike?: () => void;
  canLike?: boolean;
  isLiked?: boolean;
};

export default function MobileDealRow({
  d,
  onLike,
  canLike = false,
  isLiked = false,
}: MobileDealRowProps) {
  const imageSrc: string =
    d.imageUrl ?? d.image ?? "https://via.placeholder.com/160x160?text=No+Image";

  const likeCount = Number(d.likes ?? 0);
  const likeDisabled = !canLike;
  return (
    <article className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-[0_5px_14px_-8px_rgba(15,23,42,0.38)]">
      <div className="flex items-start gap-3">
        <Link
          href={d.detailUrl}
          className="h-[84px] w-[84px] flex-none self-center overflow-hidden rounded-md bg-slate-100"
        >
          <img
            src={imageSrc}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </Link>

        <div className="min-w-0 flex-1">

          <h3 className="line-clamp-2 text-[13px] font-semibold leading-[1.2] text-slate-800">
            <Link href={d.detailUrl} className="cursor-pointer hover:underline">
              {d.title}
            </Link>
          </h3>

          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="text-[17px] font-bold leading-none text-[#d70035]">
              {yen(d.price)}
            </span>
            {d.orig ? (
              <span className="text-[11px] text-slate-400 line-through">
                {yen(d.orig)}
              </span>
            ) : null}
            {d.isNew ? <span className="inline-flex self-center items-center rounded bg-[#d43b16] px-1.5 py-[1px] text-[9px] font-bold leading-none text-white">NEW</span> : null}
          </div>

          <div className="mt-1 truncate text-[11px] text-slate-400">
            {d.shopName}
          </div>

          <div className="mt-1 flex items-center gap-4 text-[11px] text-slate-500">
            <button
              type="button"
              onClick={onLike}
              disabled={likeDisabled}
              className={
                isLiked
                  ? "inline-flex cursor-pointer items-center gap-1 text-[#006888]"
                  : !canLike
                    ? "inline-flex items-center gap-1 text-slate-400"
                    : "inline-flex items-center gap-1 hover:text-slate-700"
              }
              aria-label="いいね"
            >
              <ThumbsUp
                className="h-3.5 w-3.5"
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
                className="h-3.5 w-3.5"
                fill={d.hasCommented ? "currentColor" : "none"}
              />
              {Number(d.comments ?? 0)}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
