"use client";

import React, { Suspense, useMemo, useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { MessageSquare, ThumbsUp, Bookmark, SlidersHorizontal, Grid2X2, LayoutList, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X, Truck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useSearchParams } from "next/navigation";
import RightSidebar, { type SidebarDeal } from "@/app/components/RightSidebar";
import { MarketTag, yen } from "@/app/components/DealUI";
import { likeDeal, saveDeal } from "@/lib/dealActions";

type DealsRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  title: string | null;
  price: number | null;
  orig_price: number | null;
  market: string | null;
  shop_name: string | null;
  deal_url: string | null;
  image_url: string | null;
  likes_count: number | null;
  comments_count: number | null;
  comment: string | null;
  is_expired?: boolean | null;
  category?: string | null;
  brand?: string | null;
  free_shipping?: boolean | null;
  expires_at?: string | null;

  author_username?: string | null;
  author_avatar_url?: string | null;
  has_liked?: boolean | null;
  has_disliked?: boolean | null;
  dislikes_count?: number | null;
  has_commented?: boolean | null;
  has_saved?: boolean | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
  avatar_url: string | null;
};

type SidebarRpcRow = {
  kind: "popular" | "trending" | "ending_soon";
  id: string;
  title: string | null;
  price: number | null;
  market: string | null;
  image_url: string | null;
  likes_count: number | null;
  comments_count: number | null;
  views_count: number | null;
};

type SearchFacetItem = { value: string; count: number };

type CardSize = "normal" | "small";
type CategoryFilter =
  | "all"
  | "fashion_women"
  | "fashion_men"
  | "beauty"
  | "home"
  | "electronics"
  | "other";

const CATEGORY_TABS: Array<{ value: CategoryFilter; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "fashion_women", label: "レディース" },
  { value: "fashion_men", label: "メンズ" },
  { value: "beauty", label: "ビューティー" },
  { value: "home", label: "日用品・ホーム" },
  { value: "electronics", label: "家電・ガジェット" },
  { value: "other", label: "その他" },
];

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getCategoryLabel(category?: string | null) {
  switch (category) {
    case "fashion_women":
      return "レディース";
    case "fashion_men":
      return "メンズ";
    case "beauty":
      return "ビューティー";
    case "home":
      return "日用品・ホーム";
    case "electronics":
      return "家電・ガジェット";
    case "other":
      return "その他";
    default:
      return "";
  }
}

function matchesCategory(row: DealsRow, activeCategory: CategoryFilter) {
  if (activeCategory === "all") return true;
  return (row.category ?? "other") === activeCategory;
}

function FreeShippingBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={
        compact
          ? "inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-[1px] text-[9px] font-semibold leading-none text-emerald-700 ring-1 ring-inset ring-emerald-200"
          : "inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-[2px] text-[10px] font-semibold leading-none text-emerald-700 ring-1 ring-inset ring-emerald-200"
      }
    >
      <Truck className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      送料無料
    </span>
  );
}

function getTopDealScore(row: DealsRow) {
  const likes = Number(row.likes_count ?? 0);
  const comments = Number(row.comments_count ?? 0);

  const createdAtMs = new Date(row.created_at).getTime();
  const nowMs = Date.now();
  const ageHours = Number.isFinite(createdAtMs)
    ? Math.max(0, (nowMs - createdAtMs) / (1000 * 60 * 60))
    : 9999;

  let freshnessBoost = 0;
  if (ageHours <= 6) freshnessBoost = 24;
  else if (ageHours <= 24) freshnessBoost = 18;
  else if (ageHours <= 72) freshnessBoost = 12;
  else if (ageHours <= 168) freshnessBoost = 6;

  return likes * 5 + comments * 4 + freshnessBoost;
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

function Card({
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
    <Link href={d.detailUrl} className="block">
      {imageBlock}
    </Link>
  ) : d.linkUrl ? (
    <a
      href={d.linkUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
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
      <div className="px-3 pt-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <img
            src={d.avatar}
            alt=""
            className="h-6 w-6 rounded-full object-cover"
          />
          <div>
            <div className="text-slate-600">
              投稿者{" "}
              <span className="font-medium text-slate-700">{d.user}</span>
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
            <Link href={d.detailUrl} className="hover:underline">
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
          {d.freeShipping ? <FreeShippingBadge /> : null}
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
                ? "inline-flex cursor-pointer items-center gap-1 text-[#f59e0b]"
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
                ? "inline-flex cursor-pointer items-center gap-1 text-[#006888] hover:text-[#00546d]"
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

type MobileRecommendCardProps = {
  d: any;
  onLike?: () => void;
  canLike?: boolean;
  isLiked?: boolean;
};

function MobileRecommendCard({
  d,
  onLike,
  canLike = false,
  isLiked = false,
}: MobileRecommendCardProps) {
  const imageSrc: string =
    d.imageUrl ?? d.image ?? "https://via.placeholder.com/320x320?text=No+Image";

  const likeCount = Number(d.likes ?? 0);
  const likeDisabled = !canLike;
  const categoryLabel = getCategoryLabel(d.category);

  return (
    <article className="w-[154px] flex-none snap-start overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_6px_16px_-10px_rgba(15,23,42,0.28)] min-[390px]:w-[158px]">
      <Link href={d.detailUrl} className="block p-1.5 pb-0">
        <div className="overflow-hidden rounded-md bg-slate-50">
          <img
            src={imageSrc}
            alt=""
            className="aspect-square h-auto w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>
      </Link>

      <div className="px-2 pb-2 pt-1.5">
        {categoryLabel ? (
          <div className="mb-1">
            <span className="inline-block rounded bg-slate-100 px-1.5 py-[1px] text-[9px] font-semibold text-slate-500">
              {categoryLabel}
            </span>
          </div>
        ) : null}

        <h3 className="line-clamp-2 min-h-[32px] text-[12px] font-medium leading-[1.35] text-slate-800">
          <Link href={d.detailUrl} className="hover:underline">
            {d.title}
          </Link>
        </h3>

        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="text-[15px] font-bold leading-none text-[#d70035]">
            {yen(d.price)}
          </span>
          {d.orig ? (
            <span className="text-[10px] font-normal text-slate-400 line-through">
              {yen(d.orig)}
            </span>
          ) : null}
          {d.freeShipping ? <FreeShippingBadge compact /> : null}
        </div>

        <div className="mt-1 truncate text-[10px] text-slate-400">{d.shopName}</div>

        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-slate-500">
          <button
            type="button"
            onClick={onLike}
            disabled={likeDisabled}
            className={
              isLiked
                ? "inline-flex cursor-pointer items-center gap-1 text-[#f59e0b]"
                : !canLike
                  ? "inline-flex items-center gap-1 text-slate-400"
                  : "inline-flex items-center gap-1 hover:text-slate-700"
            }
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
                ? "inline-flex cursor-pointer items-center gap-1 text-[#006888] hover:text-[#00546d]"
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
    </article>
  );
}

type MobileDealRowProps = {
  d: any;
  onLike?: () => void;
  canLike?: boolean;
  isLiked?: boolean;
};

function MobileDealRow({
  d,
  onLike,
  canLike = false,
  isLiked = false,
}: MobileDealRowProps) {
  const imageSrc: string =
    d.imageUrl ?? d.image ?? "https://via.placeholder.com/160x160?text=No+Image";

  const likeCount = Number(d.likes ?? 0);
  const likeDisabled = !canLike;
  const categoryLabel = getCategoryLabel(d.category);

  return (
    <article className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-[0_5px_14px_-8px_rgba(15,23,42,0.38)]">
      <div className="flex items-start gap-3">
        <Link
          href={d.detailUrl}
          className="h-[84px] w-[84px] flex-none overflow-hidden rounded-md bg-slate-100"
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
          {categoryLabel ? (
            <div className="mb-1">
              <span className="inline-block rounded bg-slate-100 px-2 py-[2px] text-[10px] font-semibold leading-none text-slate-600">
                {categoryLabel}
              </span>
            </div>
          ) : null}

          <h3 className="line-clamp-2 text-[14px] font-semibold leading-[1.22] text-slate-800">
            <Link href={d.detailUrl} className="hover:underline">
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
            {d.freeShipping ? <FreeShippingBadge compact /> : null}
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
                  ? "inline-flex cursor-pointer items-center gap-1 text-[#f59e0b]"
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
                  ? "inline-flex cursor-pointer items-center gap-1 text-[#006888] hover:text-[#00546d]"
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


type SearchDealRowProps = {
  row: DealsRow;
  onLike: () => void;
  canLike: boolean;
  isLiked: boolean;
  onSave: () => void;
  canSave: boolean;
  isSaved: boolean;
};

function SearchDealRow({
  row,
  onLike,
  canLike,
  isLiked,
  onSave,
  canSave,
  isSaved,
}: SearchDealRowProps) {
  const imageSrc =
    row.image_url ?? "https://via.placeholder.com/240x240?text=No+Image";
  const price = Number(row.price ?? 0);
  const origPrice = Number(row.orig_price ?? 0);
  const discountPercent =
    origPrice > price && origPrice > 0
      ? Math.round(((origPrice - price) / origPrice) * 100)
      : null;

  return (
    <article className="border-b border-slate-200 bg-white py-4 last:border-b-0">
      <div className="flex gap-3 sm:gap-4">
        <Link
          href={`/deals/${row.id}`}
          className="relative h-[104px] w-[104px] flex-none overflow-hidden rounded-lg bg-slate-50 sm:h-[124px] sm:w-[124px]"
        >
          <img
            src={imageSrc}
            alt=""
            className={`h-full w-full object-contain ${row.is_expired ? "opacity-45 grayscale-[35%]" : ""}`}
            loading="lazy"
            decoding="async"
          />
          {row.is_expired ? (
            <span className="absolute left-2 top-2 rounded bg-slate-700 px-2 py-1 text-xs font-bold leading-none text-white shadow-sm">
              終了
            </span>
          ) : null}
        </Link>

        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 text-[15px] font-medium leading-[1.35] text-slate-900 sm:text-[16px]">
            <Link href={`/deals/${row.id}`} className="hover:underline">
              {row.title ?? "タイトル未設定"}
            </Link>
          </h2>

          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[18px] font-bold leading-none text-slate-950">
              {yen(price)}
            </span>

            {origPrice > price ? (
              <span className="text-[13px] text-slate-400 line-through">
                {yen(origPrice)}
              </span>
            ) : null}

            {discountPercent !== null ? (
              <span className="text-[13px] font-semibold text-[#006888]">
                {discountPercent}% OFF
              </span>
            ) : null}

            {row.free_shipping ? <FreeShippingBadge /> : null}
          </div>

          <div className="mt-1.5 truncate text-[13px] text-slate-700">
            {row.shop_name || row.market || "ショップ未設定"}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 text-[12px] text-slate-500">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={onLike}
                disabled={!canLike}
                className={
                  isLiked
                    ? "inline-flex cursor-pointer items-center gap-1 text-[#f59e0b]"
                    : !canLike
                      ? "inline-flex items-center gap-1 text-slate-400"
                      : "inline-flex items-center gap-1 hover:text-slate-700"
                }
                aria-label="いいね"
              >
                <ThumbsUp
                  className="h-4 w-4"
                  fill={isLiked ? "currentColor" : "none"}
                />
                {Number(row.likes_count ?? 0)}
              </button>

              <Link
                href={`/deals/${row.id}#comments`}
                className={
                  row.has_commented
                    ? "inline-flex items-center gap-1 text-[#006888] hover:text-[#00546d]"
                    : "inline-flex items-center gap-1 hover:text-slate-700"
                }
                title={row.has_commented ? "コメント済み" : "コメント"}
              >
                <MessageSquare
                  className="h-4 w-4"
                  fill={row.has_commented ? "currentColor" : "none"}
                />
                {Number(row.comments_count ?? 0)}
              </Link>

              <button
                type="button"
                onClick={onSave}
                className="inline-flex cursor-pointer items-center text-slate-500 hover:text-slate-700"
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

            <time className="flex-none text-[10px] text-slate-400 sm:text-[11px]">
              {new Date(row.created_at).toLocaleString("ja-JP", {
                month: "2-digit",
                day: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </div>
        </div>
      </div>
    </article>
  );
}


type SearchDealGridCardProps = {
  row: DealsRow;
  onLike: () => void;
  canLike: boolean;
  isLiked: boolean;
  onSave: () => void;
  canSave: boolean;
  isSaved: boolean;
};

function SearchDealGridCard({
  row,
  onLike,
  canLike,
  isLiked,
  onSave,
  canSave,
  isSaved,
}: SearchDealGridCardProps) {
  const imageSrc =
    row.image_url ?? "https://via.placeholder.com/320x320?text=No+Image";
  const price = Number(row.price ?? 0);
  const origPrice = Number(row.orig_price ?? 0);
  const discountPercent =
    origPrice > price && origPrice > 0
      ? Math.round(((origPrice - price) / origPrice) * 100)
      : null;

  return (
    <article className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-[0_8px_18px_-10px_rgba(15,23,42,0.28)] transition hover:shadow-[0_12px_24px_-10px_rgba(15,23,42,0.34)]">
      <Link
        href={`/deals/${row.id}`}
        className="relative block aspect-square w-full overflow-hidden rounded-lg bg-slate-50"
      >
        <img
          src={imageSrc}
          alt=""
          className={`h-full w-full object-contain ${row.is_expired ? "opacity-45 grayscale-[35%]" : ""}`}
          loading="lazy"
          decoding="async"
        />
        {row.is_expired ? (
          <span className="absolute left-2.5 top-2.5 rounded bg-slate-700 px-2.5 py-1 text-xs font-bold leading-none text-white shadow-sm">
            終了
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col pt-2.5">
        <h2 className="line-clamp-2 min-h-[38px] text-[14px] font-medium leading-[1.35] text-slate-900 sm:text-[15px]">
          <Link href={`/deals/${row.id}`} className="hover:underline">
            {row.title ?? "タイトル未設定"}
          </Link>
        </h2>

        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className="text-[19px] font-bold leading-none text-slate-950">
            {yen(price)}
          </span>

          {origPrice > price ? (
            <span className="text-[12px] text-slate-400 line-through">
              {yen(origPrice)}
            </span>
          ) : null}

          {row.free_shipping ? <FreeShippingBadge compact /> : null}
        </div>

        {discountPercent !== null ? (
          <div className="mt-1 text-[12px] font-semibold text-[#006888]">
            {discountPercent}% OFF
          </div>
        ) : null}

        <div className="mt-1 truncate text-[12px] text-slate-500">
          {row.shop_name || row.market || "ショップ未設定"}
        </div>

        <div className="mt-auto flex items-center gap-3 pt-3 text-[12px] text-slate-500">
          <button
            type="button"
            onClick={onLike}
            disabled={!canLike}
            className={
              isLiked
                ? "inline-flex cursor-pointer items-center gap-1 text-[#f59e0b]"
                : !canLike
                  ? "inline-flex items-center gap-1 text-slate-400"
                  : "inline-flex items-center gap-1 hover:text-slate-700"
            }
            aria-label="いいね"
          >
            <ThumbsUp
              className="h-4 w-4"
              fill={isLiked ? "currentColor" : "none"}
            />
            {Number(row.likes_count ?? 0)}
          </button>

          <Link
            href={`/deals/${row.id}#comments`}
            className={
              row.has_commented
                ? "inline-flex items-center gap-1 text-[#006888] hover:text-[#00546d]"
                : "inline-flex items-center gap-1 hover:text-slate-700"
            }
            title={row.has_commented ? "コメント済み" : "コメント"}
          >
            <MessageSquare
              className="h-4 w-4"
              fill={row.has_commented ? "currentColor" : "none"}
            />
            {Number(row.comments_count ?? 0)}
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

type CategoryTabsProps = {
  active: CategoryFilter;
  onChange: (value: CategoryFilter) => void;
  compact?: boolean;
};

function CategoryTabs({ active, onChange, compact = false }: CategoryTabsProps) {
  return (
    <div
      className={
        compact
          ? "-mx-4 mb-3 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "-mx-4 mb-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0"
      }
    >
      <div className={compact ? "flex min-w-max gap-1.5" : "flex min-w-max gap-2"}>
        {CATEGORY_TABS.map((tab) => {
          const isActive = active === tab.value;
          const sizeClass = compact
            ? "px-3 py-1.5 text-[13px]"
            : "px-4 py-2 text-sm";

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onChange(tab.value)}
              className={
                isActive
                  ? `inline-flex items-center rounded-full bg-[#006888] font-semibold text-white ${sizeClass}`
                  : `inline-flex items-center rounded-full border border-slate-300 bg-white font-semibold text-slate-700 hover:bg-slate-50 ${sizeClass}`
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}


type FilterOption<T extends string | number | null> = {
  value: T;
  label: string;
};

function FilterSection({
  title,
  children,
  collapsible = true,
}: {
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(true);

  return (
    <section className="border-b border-slate-300 py-5">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="mb-3 flex w-full items-center justify-between text-left"
          aria-expanded={open}
        >
          <h2 className="text-[20px] font-bold text-slate-800">{title}</h2>
          <ChevronDown
            className={`h-5 w-5 text-slate-700 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
      ) : (
        <h2 className="mb-3 text-[20px] font-bold text-slate-800">{title}</h2>
      )}

      {!collapsible || open ? children : null}
    </section>
  );
}

function RadioFilter<T extends string | number | null>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<FilterOption<T>>;
  onChange: (value: T) => void;
}) {
  return (
    <div>
      {options.map((option, index) => (
        <label
          key={`${String(option.value)}-${index}`}
          className="flex cursor-pointer items-center gap-3 py-1.5 text-[15px] text-slate-700"
        >
          <input
            type="radio"
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="h-4 w-4 accent-[#006888]"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

function CheckboxFilter({
  options,
  selected,
  onToggle,
}: {
  options: Array<{ value: string; label: string; count?: number }>;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      {options.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer items-center gap-3 py-1.5 text-[15px] text-slate-700"
        >
          <input
            type="checkbox"
            checked={selected.includes(option.value)}
            onChange={() => onToggle(option.value)}
            className="h-4 w-4 accent-[#006888]"
          />
          <span className="min-w-0 break-words">
            {option.label}
            {typeof option.count === "number" ? (
              <span className="ml-1 text-slate-400">({option.count})</span>
            ) : null}
          </span>
        </label>
      ))}
    </div>
  );
}

function formatDealPostedAt(value: string) {
  const date = new Date(value);
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfPostedDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round(
    (startOfToday.getTime() - startOfPostedDay.getTime()) / 86_400_000
  );
  const time = date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (dayDiff === 0) return `今日 ${time}`;
  if (dayDiff === 1) return `昨日 ${time}`;

  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function PageContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const shouldFocusSearch = searchParams.get("focusSearch") === "1";

  const handleShareDeal = useCallback(async (dealId: string, title?: string | null) => {
    if (typeof window === "undefined") return;

    const url = `${window.location.origin}/deals/${dealId}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: title || "トクミッケ",
          url,
        });
        return;
      }

      await navigator.clipboard.writeText(url);
      window.alert("リンクをコピーしました。");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("share deal error:", error);
    }
  }, []);

  const [viewportWidth, setViewportWidth] = useState<number>(1600);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");

  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [topDeals, setTopDeals] = useState<DealsRow[]>([]);
  const [recommendDeals, setRecommendDeals] = useState<DealsRow[]>([]);
  const [searchDeals, setSearchDeals] = useState<DealsRow[]>([]);
  const [searchTotalCount, setSearchTotalCount] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [searchCategoryFacets, setSearchCategoryFacets] = useState<SearchFacetItem[]>([]);
  const [searchStoreFacets, setSearchStoreFacets] = useState<SearchFacetItem[]>([]);
  const [searchBrandFacets, setSearchBrandFacets] = useState<SearchFacetItem[]>([]);
  const [sidePopular, setSidePopular] = useState<DealsRow[]>([]);
  const [sideTrending, setSideTrending] = useState<DealsRow[]>([]);
  const [sideEndingSoon, setSideEndingSoon] = useState<DealsRow[]>([]);
  const [topDealsPage, setTopDealsPage] = useState<1 | 2>(1);
  const [likingId, setLikingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [searchSort, setSearchSort] = useState<"relevance" | "newest" | "oldest">("relevance");
  const [searchFilterOpen, setSearchFilterOpen] = useState(false);
  const [desktopFiltersVisible, setDesktopFiltersVisible] = useState(true);
  const [searchView, setSearchView] = useState<"list" | "grid">("list");
  const [searchPage, setSearchPage] = useState(1);

  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [dateFilter, setDateFilter] = useState<"all" | "24h" | "week" | "month" | "3months" | "year">("all");
  const [discountFilter, setDiscountFilter] = useState<number | null>(null);
  const [minPriceFilter, setMinPriceFilter] = useState("");
  const [maxPriceFilter, setMaxPriceFilter] = useState("");
  const [debouncedMinPriceFilter, setDebouncedMinPriceFilter] = useState("");
  const [debouncedMaxPriceFilter, setDebouncedMaxPriceFilter] = useState("");
  const priceRangeInvalid = (() => {
    if (!minPriceFilter.trim() || !maxPriceFilter.trim()) return false;

    const minPrice = Number(minPriceFilter);
    const maxPrice = Number(maxPriceFilter);

    return (
      Number.isFinite(minPrice) &&
      Number.isFinite(maxPrice) &&
      minPrice > maxPrice
    );
  })();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [freeShippingOnly, setFreeShippingOnly] = useState(false);
  const [hideExpired, setHideExpired] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedMinPriceFilter(minPriceFilter);
      setDebouncedMaxPriceFilter(maxPriceFilter);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [minPriceFilter, maxPriceFilter]);

  const CARD_WIDTH_NORMAL = 220;
  const CARD_WIDTH_SMALL = 190;
  const CARD_WIDTH_XS = 160;
  const CARD_GAP = 12;
  const SIDEBAR_WIDTH = 288;
  const OUTER_GAP = 24;
  const PADDING_X = 32;

  useEffect(() => {
    if (!shouldFocusSearch || typeof window === "undefined") return;

    let timeoutId: number | null = null;
    let frameId = 0;

    const focusSearchInput = () => {
      const input = document.getElementById(
        "site-search-input"
      ) as HTMLInputElement | null;

      if (!input) {
        timeoutId = window.setTimeout(focusSearchInput, 100);
        return;
      }

      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "auto",
      });

      input.focus({
        preventScroll: true,
      });

      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("focusSearch");
      window.history.replaceState(
        window.history.state,
        "",
        `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`
      );
    };

    frameId = window.requestAnimationFrame(focusSearchInput);

    return () => {
      window.cancelAnimationFrame(frameId);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [shouldFocusSearch]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    let frameId = 0;
    let secondFrameId = 0;

    const getViewportWidth = () =>
      Math.round(window.visualViewport?.width ?? window.innerWidth);

    const syncViewportWidth = () => {
      setViewportWidth(getViewportWidth());
    };

    const syncAfterNavigation = () => {
      syncViewportWidth();

      window.cancelAnimationFrame(frameId);
      window.cancelAnimationFrame(secondFrameId);

      frameId = window.requestAnimationFrame(() => {
        syncViewportWidth();
        secondFrameId = window.requestAnimationFrame(syncViewportWidth);
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncAfterNavigation();
      }
    };

    syncAfterNavigation();

    window.addEventListener("resize", syncAfterNavigation);
    window.addEventListener("orientationchange", syncAfterNavigation);
    window.addEventListener("pageshow", syncAfterNavigation);
    window.addEventListener("popstate", syncAfterNavigation);
    window.addEventListener("focus", syncAfterNavigation);
    window.visualViewport?.addEventListener("resize", syncAfterNavigation);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.cancelAnimationFrame(secondFrameId);
      window.removeEventListener("resize", syncAfterNavigation);
      window.removeEventListener("orientationchange", syncAfterNavigation);
      window.removeEventListener("pageshow", syncAfterNavigation);
      window.removeEventListener("popstate", syncAfterNavigation);
      window.removeEventListener("focus", syncAfterNavigation);
      window.visualViewport?.removeEventListener("resize", syncAfterNavigation);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, []);

  useEffect(() => {
    if (!searchFilterOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [searchFilterOpen]);

  const desktopLayout = useMemo(() => {
    const available = viewportWidth - PADDING_X - SIDEBAR_WIDTH - OUTER_GAP;

    const width5Normal = 5 * CARD_WIDTH_NORMAL + 4 * CARD_GAP;
    const width5Small = 5 * CARD_WIDTH_SMALL + 4 * CARD_GAP;
    const width4Normal = 4 * CARD_WIDTH_NORMAL + 3 * CARD_GAP;
    const width4Small = 4 * CARD_WIDTH_SMALL + 3 * CARD_GAP;
    const width3Normal = 3 * CARD_WIDTH_NORMAL + 2 * CARD_GAP;
    const width3Small = 3 * CARD_WIDTH_SMALL + 2 * CARD_GAP;

    if (available >= width5Normal) {
      return { cardSize: "normal" as CardSize, cardsPerPage: 5 };
    }
    if (available >= width5Small) {
      return { cardSize: "small" as CardSize, cardsPerPage: 5 };
    }
    if (available >= width4Normal) {
      return { cardSize: "normal" as CardSize, cardsPerPage: 4 };
    }
    if (available >= width4Small) {
      return { cardSize: "small" as CardSize, cardsPerPage: 4 };
    }
    if (available >= width3Normal) {
      return { cardSize: "normal" as CardSize, cardsPerPage: 3 };
    }
    return { cardSize: "small" as CardSize, cardsPerPage: 3 };
  }, [
    viewportWidth,
    PADDING_X,
    SIDEBAR_WIDTH,
    OUTER_GAP,
    CARD_WIDTH_NORMAL,
    CARD_WIDTH_SMALL,
    CARD_GAP,
  ]);

  const mobileSwitchWidth =
    PADDING_X + SIDEBAR_WIDTH + OUTER_GAP + (3 * CARD_WIDTH_SMALL + 2 * CARD_GAP);

  const isMobileMode = viewportWidth < mobileSwitchWidth;
  const { cardSize, cardsPerPage } = desktopLayout;

  const currentUserIdRef = useRef<string | null>(null);
  const refreshInFlightRef = useRef(false);
  const lastRefreshAtRef = useRef(0);
  const searchResultsTopRef = useRef<HTMLDivElement | null>(null);
  const searchRequestIdRef = useRef(0);
  const searchFacetRequestIdRef = useRef(0);
  const previousSearchCriteriaKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const applyUser = (user: any | null) => {
      if (cancelled) return;
      currentUserIdRef.current = user?.id ?? null;
      setCurrentUser(user);
      setAuthReady(true);
    };

    (async () => {
      const { data, error } = await supabase.auth.getSession();

      if (cancelled) return;

      if (error) {
        console.warn("getSession warn:", error);
      }

      applyUser(data.session?.user ?? null);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const p = params.get("page");
    setTopDealsPage(p === "2" ? 2 : 1);
  }, []);

  const attachAuthorUsername = useCallback(async (rows: any[]) => {
    const userIds = Array.from(
      new Set(
        rows
          .map((r: any) => r.user_id)
          .filter((v: string | null): v is string => !!v)
      )
    );

    let usernameMap: Record<string, string | null> = {};
    let avatarMap: Record<string, string | null> = {};
    if (userIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", userIds);

      if (profilesError) {
        console.error("attachAuthorUsername profiles error:", profilesError);
      } else {
        usernameMap = Object.fromEntries(
          (profilesData ?? []).map((p: ProfileRow) => [p.id, p.username])
        );
        avatarMap = Object.fromEntries(
          (profilesData ?? []).map((p: ProfileRow) => [p.id, p.avatar_url])
        );
      }
    }

    return (rows ?? []).map((row: any) => ({
      id: String(row.id),
      created_at: row.created_at,
      user_id: row.user_id,
      title: row.title,
      price: row.price,
      orig_price: row.orig_price,
      market: row.market,
      shop_name: row.shop_name,
      deal_url: row.deal_url,
      image_url: row.image_url,
      likes_count: row.likes_count,
      comments_count: row.comments_count,
      comment: row.comment,
      is_expired: row.is_expired,
      category: row.category ?? null,
      brand: row.brand ?? null,
      free_shipping: row.free_shipping ?? false,
      expires_at: row.expires_at ?? null,
      author_username: row.user_id ? usernameMap[row.user_id] ?? null : null,
      author_avatar_url: row.user_id ? avatarMap[row.user_id] ?? null : null,
    })) as DealsRow[];
  }, []);

  const attachInteractionFlags = useCallback(
    async (rows: DealsRow[], userId: string | null) => {
      if (rows.length === 0) return rows;

      const ids = Array.from(new Set(rows.map((r) => r.id)));

      const likesPromise = userId
        ? supabase
            .from("deal_likes")
            .select("deal_id")
            .eq("user_id", userId)
            .in("deal_id", ids)
        : Promise.resolve({ data: [], error: null } as any);

      const dislikesPromise = userId
        ? supabase
            .from("deal_dislikes")
            .select("deal_id")
            .eq("user_id", userId)
            .in("deal_id", ids)
        : Promise.resolve({ data: [], error: null } as any);

      const savesPromise = userId
        ? supabase
            .from("deal_saves")
            .select("deal_id")
            .eq("user_id", userId)
            .in("deal_id", ids)
        : Promise.resolve({ data: [], error: null } as any);

      const commentsPromise = supabase
        .from("deal_comments")
        .select("id, deal_id, user_id")
        .in("deal_id", ids);

      const [
        { data: likeRows, error: likesError },
        { data: dislikeRows, error: dislikesError },
        { data: saveRows, error: saveError },
        { data: commentRows, error: commentsError },
      ] = await Promise.all([
        likesPromise,
        dislikesPromise,
        savesPromise,
        commentsPromise,
      ]);

      if (likesError) {
        console.error("attachInteractionFlags likes error:", likesError);
      }

      if (dislikesError) {
        console.error("attachInteractionFlags dislikes error:", dislikesError);
      }

      if (saveError) {
        console.warn("attachInteractionFlags saves warn:", saveError);
      }

      if (commentsError) {
        console.warn(
          "attachInteractionFlags comments warn:",
          commentsError
        );
      }

      const likedSet = new Set(
        (likeRows ?? []).map((r: any) => String(r.deal_id))
      );
      const dislikedSet = new Set(
        (dislikeRows ?? []).map((r: any) => String(r.deal_id))
      );

      const savedSet = new Set(
        (saveRows ?? []).map((r: any) => String(r.deal_id))
      );

      const commentCountMap = new Map<string, number>();
      const commentToDealMap = new Map<string, string>();
      const commentedSet = new Set<string>();

      if (userId) {
        const { data: ownCommentRows, error: ownCommentsError } = await supabase
          .from("deal_comments")
          .select("deal_id")
          .eq("user_id", userId)
          .in("deal_id", ids);

        if (ownCommentsError) {
          console.warn("attachInteractionFlags own comments warn:", ownCommentsError);
        } else {
          (ownCommentRows ?? []).forEach((r: any) => {
            commentedSet.add(String(r.deal_id));
          });
        }
      }

      (commentRows ?? []).forEach((r: any) => {
        const dealId = String(r.deal_id);
        const commentId = String(r.id);

        commentToDealMap.set(commentId, dealId);
        commentCountMap.set(
          dealId,
          (commentCountMap.get(dealId) ?? 0) + 1
        );

        if (userId && r.user_id === userId) {
          commentedSet.add(dealId);
        }
      });

      if (!commentsError && commentToDealMap.size > 0) {
        const commentIds = Array.from(commentToDealMap.keys());

        const { data: replyRows, error: repliesError } = await supabase
          .from("deal_comment_replies")
          .select("comment_id, user_id")
          .in("comment_id", commentIds);

        if (repliesError) {
          console.warn(
            "attachInteractionFlags replies warn:",
            repliesError
          );
        } else {
          (replyRows ?? []).forEach((r: any) => {
            const dealId = commentToDealMap.get(String(r.comment_id));
            if (!dealId) return;

            commentCountMap.set(
              dealId,
              (commentCountMap.get(dealId) ?? 0) + 1
            );

            if (userId && r.user_id === userId) {
              commentedSet.add(dealId);
            }
          });
        }
      }

      return rows.map((r) => {
        return {
          ...r,
          likes_count: Number(r.likes_count ?? 0),
          dislikes_count: Number(r.dislikes_count ?? 0),
          comments_count: Number(r.comments_count ?? 0),
          has_commented: userId ? commentedSet.has(r.id) : false,
          has_liked: Boolean(userId) && !likesError && likedSet.has(r.id),
          has_disliked: Boolean(userId) && !dislikesError && dislikedSet.has(r.id),
          has_saved: userId
            ? saveError
              ? r.has_saved
              : savedSet.has(r.id)
            : false,
        };
      });
    },
    []
  );

  const loadMainDeals = useCallback(
    async (userId: string | null) => {
      const { data: dealsData, error: dealsError } = await supabase
        .from("deals")
        .select(`
          id,
          created_at,
          user_id,
          title,
          price,
          orig_price,
          market,
          shop_name,
          deal_url,
          image_url,
          likes_count,
          comments_count,
          comment,
          is_expired,
          category,
          brand,
          free_shipping,
          expires_at
        `)
        .eq("is_expired", false)
        .order("created_at", { ascending: false })
        .limit(200);

      if (dealsError) {
        console.error("loadMainDeals error:", dealsError);
        setTopDeals([]);
        setRecommendDeals([]);
        return;
      }

      let normalized = await attachAuthorUsername(dealsData ?? []);
      normalized = await attachInteractionFlags(normalized, userId);

      const sorted = [...normalized].sort((a, b) => {
        const scoreDiff = getTopDealScore(b) - getTopDealScore(a);
        if (scoreDiff !== 0) return scoreDiff;

        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return bTime - aTime;
      });

      setTopDeals(sorted);
      setRecommendDeals(shuffle(normalized).slice(0, 15));
    },
    [attachAuthorUsername, attachInteractionFlags]
  );

  const loadSearchDeals = useCallback(
    async (userId: string | null) => {
      const requestId = ++searchRequestIdRef.current;

      if (priceRangeInvalid) {
        setSearchLoading(false);
        setSearchError(false);
        return;
      }

      setSearchLoading(true);
      setSearchError(false);
      const now = Date.now();

      const dateFrom = (() => {
        switch (dateFilter) {
          case "24h":
            return new Date(now - 24 * 60 * 60 * 1000).toISOString();
          case "week":
            return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
          case "month":
            return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
          case "3months":
            return new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
          case "year":
            return new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString();
          default:
            return null;
        }
      })();

      const parsedMinPrice =
        debouncedMinPriceFilter.trim() === "" ? null : Number(debouncedMinPriceFilter);
      const parsedMaxPrice =
        debouncedMaxPriceFilter.trim() === "" ? null : Number(debouncedMaxPriceFilter);

      const { data: rpcRows, error: rpcError } = await supabase.rpc(
        "search_deals",
        {
          p_query: q.trim(),
          p_sort: searchSort,
          p_min_likes: ratingFilter,
          p_date_from: dateFrom,
          p_min_discount: discountFilter,
          p_min_price:
            parsedMinPrice !== null && Number.isFinite(parsedMinPrice)
              ? parsedMinPrice
              : null,
          p_max_price:
            parsedMaxPrice !== null && Number.isFinite(parsedMaxPrice)
              ? parsedMaxPrice
              : null,
          p_categories:
            selectedCategories.length > 0 ? selectedCategories : null,
          p_stores: selectedStores.length > 0 ? selectedStores : null,
          p_brands: selectedBrands.length > 0 ? selectedBrands : null,
          p_free_shipping_only: freeShippingOnly,
          p_hide_expired: hideExpired,
          p_page: searchPage,
          p_page_size: 40,
        }
      );

      if (rpcError) {
        console.error("loadSearchDeals rpc error:", rpcError);
        if (requestId === searchRequestIdRef.current) {
          setSearchDeals([]);
          setSearchTotalCount(0);
          setSearchError(true);
          setSearchLoading(false);
        }
        return;
      }

      const rows = (rpcRows ?? []) as Array<DealsRow & {
        relevance_score?: number | null;
        total_count?: number | string | null;
      }>;

      const totalCount =
        rows.length > 0 ? Number(rows[0].total_count ?? 0) : 0;

      let normalized = await attachAuthorUsername(rows);
      normalized = await attachInteractionFlags(normalized, userId);

      if (requestId !== searchRequestIdRef.current) return;

      setSearchDeals(normalized);
      setSearchTotalCount(Number.isFinite(totalCount) ? totalCount : 0);
      setSearchError(false);
      setSearchLoading(false);
    },
    [
      attachAuthorUsername,
      attachInteractionFlags,
      q,
      searchSort,
      ratingFilter,
      dateFilter,
      discountFilter,
      debouncedMinPriceFilter,
      debouncedMaxPriceFilter,
      priceRangeInvalid,
      selectedCategories,
      selectedStores,
      selectedBrands,
      freeShippingOnly,
      hideExpired,
      searchPage,
    ]
  );

  const loadSearchFacets = useCallback(async () => {
    const requestId = ++searchFacetRequestIdRef.current;

    if (priceRangeInvalid) return;

    const now = Date.now();

    const dateFrom = (() => {
      switch (dateFilter) {
        case "24h":
          return new Date(now - 24 * 60 * 60 * 1000).toISOString();
        case "week":
          return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
        case "month":
          return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
        case "3months":
          return new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
        case "year":
          return new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString();
        default:
          return null;
      }
    })();

    const parsedMinPrice =
      debouncedMinPriceFilter.trim() === "" ? null : Number(debouncedMinPriceFilter);
    const parsedMaxPrice =
      debouncedMaxPriceFilter.trim() === "" ? null : Number(debouncedMaxPriceFilter);

    const { data, error } = await supabase.rpc("get_search_deal_facets", {
      p_query: q.trim(),
      p_min_likes: ratingFilter,
      p_date_from: dateFrom,
      p_min_discount: discountFilter,
      p_min_price:
        parsedMinPrice !== null && Number.isFinite(parsedMinPrice)
          ? parsedMinPrice
          : null,
      p_max_price:
        parsedMaxPrice !== null && Number.isFinite(parsedMaxPrice)
          ? parsedMaxPrice
          : null,
      p_categories:
        selectedCategories.length > 0 ? selectedCategories : null,
      p_stores: selectedStores.length > 0 ? selectedStores : null,
      p_brands: selectedBrands.length > 0 ? selectedBrands : null,
      p_free_shipping_only: freeShippingOnly,
      p_hide_expired: hideExpired,
    });

    if (error) {
      if (requestId !== searchFacetRequestIdRef.current) return;

      console.error("loadSearchFacets rpc error:", error);
      setSearchCategoryFacets([]);
      setSearchStoreFacets([]);
      setSearchBrandFacets([]);
      return;
    }

    const payload = (data ?? {}) as {
      categories?: SearchFacetItem[];
      stores?: SearchFacetItem[];
      brands?: SearchFacetItem[];
    };

    const normalizeFacets = (items: SearchFacetItem[] | undefined) =>
      (items ?? [])
        .map((item) => ({
          value: String(item.value ?? ""),
          count: Number(item.count ?? 0),
        }))
        .filter((item) => item.value);

    if (requestId !== searchFacetRequestIdRef.current) return;

    setSearchCategoryFacets(normalizeFacets(payload.categories));
    setSearchStoreFacets(normalizeFacets(payload.stores));
    setSearchBrandFacets(normalizeFacets(payload.brands));
  }, [
    q,
    ratingFilter,
    dateFilter,
    discountFilter,
    debouncedMinPriceFilter,
    debouncedMaxPriceFilter,
    priceRangeInvalid,
    selectedCategories,
    selectedStores,
    selectedBrands,
    freeShippingOnly,
    hideExpired,
  ]);

  const loadSideDeals = useCallback(
    async (userId: string | null) => {
      const { data: rpcRows, error: rpcError } = await supabase.rpc(
        "get_sidebar_deals_by_views",
        {
          p_popular_days: 7,
          p_trending_hours: 24,
          p_limit: 5,
        }
      );

      if (rpcError) {
        console.error("loadSideDeals rpc error:", rpcError);
        setSidePopular([]);
        setSideTrending([]);
        setSideEndingSoon([]);
        return;
      }

      const rows = (rpcRows ?? []) as SidebarRpcRow[];

      const popularRows = rows.filter((r) => r.kind === "popular");
      const trendingRows = rows.filter((r) => r.kind === "trending");

      const popular: DealsRow[] = popularRows.map((r) => ({
        id: String(r.id),
        created_at: new Date().toISOString(),
        user_id: null,
        title: r.title ?? null,
        price: r.price ?? null,
        orig_price: null,
        market: r.market ?? null,
        shop_name: null,
        deal_url: null,
        image_url: r.image_url ?? null,
        likes_count: r.likes_count ?? 0,
        comments_count: r.comments_count ?? 0,
        comment: null,
        is_expired: false,
        category: null,
        brand: null,
        free_shipping: false,
        expires_at: null,
        author_username: null,
      }));

      const trending: DealsRow[] = trendingRows.map((r) => ({
        id: String(r.id),
        created_at: new Date().toISOString(),
        user_id: null,
        title: r.title ?? null,
        price: r.price ?? null,
        orig_price: null,
        market: r.market ?? null,
        shop_name: null,
        deal_url: null,
        image_url: r.image_url ?? null,
        likes_count: r.likes_count ?? 0,
        comments_count: r.comments_count ?? 0,
        comment: null,
        is_expired: false,
        category: null,
        brand: null,
        free_shipping: false,
        expires_at: null,
        author_username: null,
      }));

      const endingSoonRows = rows.filter((r) => r.kind === "ending_soon");

      const endingSoon: DealsRow[] = endingSoonRows.map((r) => ({
        id: String(r.id),
        created_at: new Date().toISOString(),
        user_id: null,
        title: r.title ?? null,
        price: r.price ?? null,
        orig_price: null,
        market: r.market ?? null,
        shop_name: null,
        deal_url: null,
        image_url: r.image_url ?? null,
        likes_count: r.likes_count ?? 0,
        comments_count: r.comments_count ?? 0,
        comment: null,
        is_expired: false,
        category: null,
        brand: null,
        free_shipping: false,
        expires_at: null,
        author_username: null,
      }));

      const uniqueById = Array.from(
        new Map(
          [...popular, ...trending, ...endingSoon].map((r) => [r.id, r])
        ).values()
      );
      const withFlags = await attachInteractionFlags(uniqueById, userId);
      const flagsById = new Map(withFlags.map((r) => [r.id, r]));

      const applyFlags = (rows: DealsRow[]) =>
        rows.map((r) => flagsById.get(r.id) ?? r);

      setSidePopular(applyFlags(popular));
      setSideTrending(applyFlags(trending));
      setSideEndingSoon(applyFlags(endingSoon));
    },
    [attachInteractionFlags]
  );

  const refreshHomeData = useCallback(
    async (userId: string | null, force = false) => {
      const now = Date.now();
      const MIN_REFRESH_INTERVAL_MS = 60_000;

      if (refreshInFlightRef.current) return;

      if (
        !force &&
        now - lastRefreshAtRef.current < MIN_REFRESH_INTERVAL_MS
      ) {
        return;
      }

      refreshInFlightRef.current = true;

      try {
        await Promise.all([
          loadMainDeals(userId),
          loadSideDeals(userId),
        ]);
      } finally {
        lastRefreshAtRef.current = Date.now();
        refreshInFlightRef.current = false;
      }
    },
    [loadMainDeals, loadSideDeals]
  );

  useEffect(() => {
    if (!authReady) return;

    void refreshHomeData(currentUserIdRef.current, true);
  }, [authReady, refreshHomeData]);

  const searchCriteriaKey = useMemo(
    () =>
      JSON.stringify({
        q: q.trim(),
        searchSort,
        ratingFilter,
        dateFilter,
        discountFilter,
        minPriceFilter: debouncedMinPriceFilter,
        maxPriceFilter: debouncedMaxPriceFilter,
        selectedCategories,
        selectedStores,
        selectedBrands,
        freeShippingOnly,
        hideExpired,
      }),
    [
      q,
      searchSort,
      ratingFilter,
      dateFilter,
      discountFilter,
      debouncedMinPriceFilter,
      debouncedMaxPriceFilter,
      selectedCategories,
      selectedStores,
      selectedBrands,
      freeShippingOnly,
      hideExpired,
    ]
  );

  useEffect(() => {
    if (!authReady || !q.trim()) {
      previousSearchCriteriaKeyRef.current = searchCriteriaKey;
      searchRequestIdRef.current += 1;
      setSearchDeals([]);
      setSearchTotalCount(0);
      setSearchError(false);
      setSearchLoading(false);
      return;
    }

    const criteriaChanged =
      previousSearchCriteriaKeyRef.current !== searchCriteriaKey;
    previousSearchCriteriaKeyRef.current = searchCriteriaKey;

    if (criteriaChanged && searchPage !== 1) {
      setSearchPage(1);
      return;
    }

    void loadSearchDeals(currentUserIdRef.current);
  }, [
    authReady,
    q,
    searchCriteriaKey,
    searchPage,
    loadSearchDeals,
  ]);

  useEffect(() => {
    if (!q.trim()) {
      searchFacetRequestIdRef.current += 1;
      setSearchCategoryFacets([]);
      setSearchStoreFacets([]);
      setSearchBrandFacets([]);
      return;
    }

    void loadSearchFacets();
  }, [q, loadSearchFacets]);

  const refreshAfterInteraction = useCallback(
    async (userId: string | null) => {
      await refreshHomeData(userId, true);
      if (q.trim()) {
        await loadSearchDeals(userId);
      }
    },
    [refreshHomeData, loadSearchDeals, q]
  );

  useEffect(() => {
    if (!authReady) return;

    const refreshIfNeeded = () => {
      if (document.visibilityState !== "visible") return;

      void refreshHomeData(currentUserIdRef.current, false);
    };

    window.addEventListener("focus", refreshIfNeeded);
    document.addEventListener("visibilitychange", refreshIfNeeded);

    return () => {
      window.removeEventListener("focus", refreshIfNeeded);
      document.removeEventListener("visibilitychange", refreshIfNeeded);
    };
  }, [authReady, refreshHomeData]);

  const cardWidthPx = cardSize === "normal" ? CARD_WIDTH_NORMAL : CARD_WIDTH_SMALL;
  const rowCardsWidth = cardsPerPage * cardWidthPx + (cardsPerPage - 1) * CARD_GAP;
  const layoutTotalWidth = rowCardsWidth + SIDEBAR_WIDTH + OUTER_GAP;
  const cardWidthClass = cardSize === "normal" ? "w-[220px]" : "w-[190px]";

  // 「あなたにおすすめ」はメインのトップディールより常に1段小さくする。
  // M（normal）→ S（190px）、S（small）→ XS（160px）。
  // 表示枠の幅はメインと同じままなので、右端に次のカードが少し見え、
  // 横スクロールできることが直感的に分かる。
  const recommendCardWidthPx =
    cardSize === "normal" ? CARD_WIDTH_SMALL : CARD_WIDTH_XS;
  const recommendCardWidthClass =
    cardSize === "normal" ? "w-[190px]" : "w-[160px]";

  const normalizedQuery = q.trim().toLowerCase();

  const recommendFiltered = useMemo(() => {
    return recommendDeals.filter(
      (d) =>
        matchesCategory(d, activeCategory) &&
        (normalizedQuery
          ? `${d.title ?? ""} ${d.shop_name ?? ""} ${d.brand ?? ""}`
              .toLowerCase()
              .includes(normalizedQuery)
          : true)
    );
  }, [recommendDeals, normalizedQuery, activeCategory]);

  const topDealsFiltered = useMemo(() => {
    return topDeals.filter(
      (d) =>
        matchesCategory(d, activeCategory) &&
        (normalizedQuery
          ? `${d.title ?? ""} ${d.shop_name ?? ""} ${d.brand ?? ""}`
              .toLowerCase()
              .includes(normalizedQuery)
          : true)
    );
  }, [topDeals, normalizedQuery, activeCategory]);

  const categoryFilterOptions = useMemo(() => {
    const countMap = new Map(
      searchCategoryFacets.map((item) => [item.value, item.count])
    );

    return CATEGORY_TABS.filter((tab) => tab.value !== "all").map((tab) => ({
      value: tab.value,
      label: tab.label,
      count: countMap.get(tab.value) ?? 0,
    }));
  }, [searchCategoryFacets]);

  const storeFilterOptions = useMemo(
    () => searchStoreFacets.map((item) => [item.value, item.count] as [string, number]),
    [searchStoreFacets]
  );

  const brandFilterOptions = useMemo(
    () => searchBrandFacets.map((item) => [item.value, item.count] as [string, number]),
    [searchBrandFacets]
  );

  const activeSearchFilterCount =
    (ratingFilter !== null ? 1 : 0) +
    (dateFilter !== "all" ? 1 : 0) +
    (discountFilter !== null ? 1 : 0) +
    (minPriceFilter.trim() ? 1 : 0) +
    (maxPriceFilter.trim() ? 1 : 0) +
    selectedCategories.length +
    selectedStores.length +
    selectedBrands.length +
    (freeShippingOnly ? 1 : 0) +
    (!hideExpired ? 1 : 0);

  const activeSearchFilterChips = useMemo(() => {
    const chips: Array<{
      key: string;
      label: string;
      onRemove: () => void;
    }> = [];

    if (ratingFilter !== null) {
      chips.push({
        key: "rating",
        label: `${ratingFilter}+ いいね`,
        onRemove: () => setRatingFilter(null),
      });
    }

    if (dateFilter !== "all") {
      const labelMap: Record<typeof dateFilter, string> = {
        "24h": "過去24時間",
        week: "過去1週間",
        month: "過去1か月",
        "3months": "過去3か月",
        year: "過去1年",
      };

      chips.push({
        key: "date",
        label: labelMap[dateFilter],
        onRemove: () => setDateFilter("all"),
      });
    }

    if (discountFilter !== null) {
      chips.push({
        key: "discount",
        label: `${discountFilter}%以上OFF`,
        onRemove: () => setDiscountFilter(null),
      });
    }

    if (minPriceFilter.trim()) {
      chips.push({
        key: "min-price",
        label: `¥${Number(minPriceFilter).toLocaleString()}以上`,
        onRemove: () => setMinPriceFilter(""),
      });
    }

    if (maxPriceFilter.trim()) {
      chips.push({
        key: "max-price",
        label: `¥${Number(maxPriceFilter).toLocaleString()}以下`,
        onRemove: () => setMaxPriceFilter(""),
      });
    }

    selectedCategories.forEach((value) => {
      const label =
        CATEGORY_TABS.find((item) => item.value === value)?.label ?? value;

      chips.push({
        key: `category-${value}`,
        label,
        onRemove: () =>
          setSelectedCategories((current) =>
            current.filter((item) => item !== value)
          ),
      });
    });

    selectedStores.forEach((value) => {
      chips.push({
        key: `store-${value}`,
        label: value,
        onRemove: () =>
          setSelectedStores((current) =>
            current.filter((item) => item !== value)
          ),
      });
    });

    selectedBrands.forEach((value) => {
      chips.push({
        key: `brand-${value}`,
        label: value,
        onRemove: () =>
          setSelectedBrands((current) =>
            current.filter((item) => item !== value)
          ),
      });
    });

    if (freeShippingOnly) {
      chips.push({
        key: "free-shipping",
        label: "送料無料",
        onRemove: () => setFreeShippingOnly(false),
      });
    }

    if (!hideExpired) {
      chips.push({
        key: "show-expired",
        label: "期限切れも表示",
        onRemove: () => setHideExpired(true),
      });
    }

    return chips;
  }, [
    ratingFilter,
    dateFilter,
    discountFilter,
    minPriceFilter,
    maxPriceFilter,
    selectedCategories,
    selectedStores,
    selectedBrands,
    freeShippingOnly,
    hideExpired,
  ]);

  const clearSearchFilters = () => {
    setRatingFilter(null);
    setDateFilter("all");
    setDiscountFilter(null);
    setMinPriceFilter("");
    setMaxPriceFilter("");
    setSelectedCategories([]);
    setSelectedStores([]);
    setSelectedBrands([]);
    setFreeShippingOnly(false);
    setHideExpired(true);
    setSearchSort("relevance");
  };

  const toggleStringFilter = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  };

  const SEARCH_PAGE_SIZE = 40;

  const searchResultRows = searchDeals;
  const paginatedSearchResultRows = searchDeals;

  const searchTotalPages = Math.max(
    1,
    Math.ceil(searchTotalCount / SEARCH_PAGE_SIZE)
  );

  useEffect(() => {
    if (searchPage > searchTotalPages) {
      setSearchPage(searchTotalPages);
    }
  }, [searchPage, searchTotalPages]);

  const goToSearchPage = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), searchTotalPages);
    setSearchPage(nextPage);

    window.requestAnimationFrame(() => {
      searchResultsTopRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const renderSearchPagination = (mobile = false) => {
    if (searchTotalPages <= 1) return null;

    const pageNumbers: number[] = [];
    const maxVisible = mobile ? 3 : 5;

    let startPage = Math.max(
      1,
      searchPage - Math.floor(maxVisible / 2)
    );
    let endPage = Math.min(
      searchTotalPages,
      startPage + maxVisible - 1
    );

    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let page = startPage; page <= endPage; page += 1) {
      pageNumbers.push(page);
    }

    const circleClass = mobile ? "h-9 w-9" : "h-10 w-10";
    const iconClass = mobile ? "h-4 w-4" : "h-5 w-5";

    return (
      <nav
        className={
          mobile
            ? "mt-5 flex items-center justify-center gap-1.5 border-t border-slate-200 pt-5"
            : "mt-6 flex items-center justify-center gap-2 border-t border-slate-200 pt-6"
        }
        aria-label="検索結果のページ切り替え"
      >
        <button
          type="button"
          onClick={() => goToSearchPage(1)}
          disabled={searchPage === 1}
          className={`inline-flex ${circleClass} cursor-pointer items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:cursor-default disabled:bg-slate-50 disabled:text-slate-300`}
          aria-label="最初のページ"
        >
          <ChevronsLeft className={iconClass} />
        </button>

        <button
          type="button"
          onClick={() => goToSearchPage(searchPage - 1)}
          disabled={searchPage === 1}
          className={`inline-flex ${circleClass} cursor-pointer items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:cursor-default disabled:bg-slate-50 disabled:text-slate-300`}
          aria-label="前のページ"
        >
          <ChevronLeft className={iconClass} />
        </button>

        {pageNumbers.map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => goToSearchPage(page)}
            className={`inline-flex ${circleClass} cursor-pointer items-center justify-center rounded-full text-[14px] font-semibold ${
              page === searchPage
                ? "bg-[#006888] text-white"
                : "text-[#006888] hover:bg-[#eef7f9]"
            }`}
            aria-current={page === searchPage ? "page" : undefined}
          >
            {page}
          </button>
        ))}

        <button
          type="button"
          onClick={() => goToSearchPage(searchPage + 1)}
          disabled={searchPage === searchTotalPages}
          className={`inline-flex ${circleClass} cursor-pointer items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:cursor-default disabled:bg-slate-50 disabled:text-slate-300`}
          aria-label="次のページ"
        >
          <ChevronRight className={iconClass} />
        </button>

        <button
          type="button"
          onClick={() => goToSearchPage(searchTotalPages)}
          disabled={searchPage === searchTotalPages}
          className={`inline-flex ${circleClass} cursor-pointer items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:cursor-default disabled:bg-slate-50 disabled:text-slate-300`}
          aria-label="最後のページ"
        >
          <ChevronsRight className={iconClass} />
        </button>
      </nav>
    );
  };

  const recommendTotalPages = Math.max(
    1,
    cardsPerPage > 0 ? Math.ceil(recommendFiltered.length / cardsPerPage) : 1
  );

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, Math.max(0, recommendTotalPages - 1)));
  }, [recommendTotalPages]);

  useEffect(() => {
    setCurrentPage(0);
    setTopDealsPage(1);
  }, [activeCategory, q]);

  const handlePrev = () => setCurrentPage((p) => Math.max(0, p - 1));
  const handleNext = () =>
    setCurrentPage((p) => Math.min(recommendTotalPages - 1, p + 1));

  const handleLikeAny = async (dealIdRaw: string) => {
    const dealId = String(dealIdRaw);

    if (!currentUser) {
      alert("いいね機能を使うには、ログインが必要です。");
      return;
    }

    if (likingId === dealId) return;

    const matchingDeal =
      topDeals.find((d) => d.id === dealId) ??
      recommendDeals.find((d) => d.id === dealId) ??
      searchDeals.find((d) => d.id === dealId) ??
      sidePopular.find((d) => d.id === dealId) ??
      sideTrending.find((d) => d.id === dealId) ??
      sideEndingSoon.find((d) => d.id === dealId);

    const wasLiked = !!matchingDeal?.has_liked;
    const wasDisliked = !!matchingDeal?.has_disliked;

    setLikingId(dealId);

    const optimistic = (rows: DealsRow[]) =>
      rows.map((r) => {
        if (r.id !== dealId) return r;

        const scoreDelta = wasLiked ? -1 : wasDisliked ? 2 : 1;

        return {
          ...r,
          has_liked: !wasLiked,
          has_disliked: wasLiked ? r.has_disliked : false,
          likes_count: Number(r.likes_count ?? 0) + scoreDelta,
        };
      });

    setTopDeals((p) => optimistic(p));
    setRecommendDeals((p) => optimistic(p));
    setSearchDeals((p) => optimistic(p));
    setSidePopular((p) => optimistic(p));
    setSideTrending((p) => optimistic(p));
    setSideEndingSoon((p) => optimistic(p));

    try {
      if (wasLiked) {
        const { error } = await supabase
          .from("deal_likes")
          .delete()
          .eq("user_id", currentUser.id)
          .eq("deal_id", dealId);

        if (error) {
          console.error("unlike error:", error);
          await refreshAfterInteraction(currentUser.id);
          return;
        }
      } else {
        if (wasDisliked) {
          const { error: removeDislikeError } = await supabase
            .from("deal_dislikes")
            .delete()
            .eq("user_id", currentUser.id)
            .eq("deal_id", dealId);

          if (removeDislikeError) {
            console.error(
              "remove dislike before like error:",
              removeDislikeError
            );
            await refreshAfterInteraction(currentUser.id);
            return;
          }
        }

        const result = await likeDeal({
          userId: currentUser.id,
          dealId,
        });

        if (!result.ok) {
          console.error("likeDeal error:", result.error);
          await refreshAfterInteraction(currentUser.id);
          return;
        }
      }

      const [
        { count: exactLikeCount, error: likeCountError },
        { count: exactDislikeCount, error: dislikeCountError },
      ] = await Promise.all([
        supabase
          .from("deal_likes")
          .select("*", { count: "exact", head: true })
          .eq("deal_id", dealId),
        supabase
          .from("deal_dislikes")
          .select("*", { count: "exact", head: true })
          .eq("deal_id", dealId),
      ]);

      if (
        !likeCountError &&
        !dislikeCountError &&
        typeof exactLikeCount === "number" &&
        typeof exactDislikeCount === "number"
      ) {
        const exactScore = exactLikeCount - exactDislikeCount;

        const patchCount = (rows: DealsRow[]) =>
          rows.map((r) =>
            r.id === dealId
              ? {
                  ...r,
                  has_liked: !wasLiked,
                  has_disliked: false,
                  likes_count: exactScore,
                  dislikes_count: exactDislikeCount,
                }
              : r
          );

        setTopDeals((p) => patchCount(p));
        setRecommendDeals((p) => patchCount(p));
        setSearchDeals((p) => patchCount(p));
        setSidePopular((p) => patchCount(p));
        setSideTrending((p) => patchCount(p));
        setSideEndingSoon((p) => patchCount(p));
      } else {
        await refreshAfterInteraction(currentUser.id);
      }
    } catch (err) {
      console.error("vote toggle exception:", err);
      await refreshAfterInteraction(currentUser.id);
    } finally {
      setLikingId(null);
    }
  };

  const handleSaveAny = async (dealIdRaw: string) => {
    const dealId = String(dealIdRaw);

    if (!currentUser) {
      alert("セーブするには、ログインが必要です。");
      return;
    }

    const alreadySaved =
      topDeals.find((d) => d.id === dealId)?.has_saved ||
      recommendDeals.find((d) => d.id === dealId)?.has_saved ||
      searchDeals.find((d) => d.id === dealId)?.has_saved ||
      sidePopular.find((d) => d.id === dealId)?.has_saved ||
      sideTrending.find((d) => d.id === dealId)?.has_saved ||
      sideEndingSoon.find((d) => d.id === dealId)?.has_saved;

    setSavingId(dealId);

    const optimistic = (rows: DealsRow[]) =>
      rows.map((r) =>
        r.id === dealId ? { ...r, has_saved: !alreadySaved } : r
      );

    setTopDeals((p) => optimistic(p));
    setRecommendDeals((p) => optimistic(p));
    setSearchDeals((p) => optimistic(p));
    setSidePopular((p) => optimistic(p));
    setSideTrending((p) => optimistic(p));
    setSideEndingSoon((p) => optimistic(p));

    try {
      if (alreadySaved) {
        const { error } = await supabase
          .from("deal_saves")
          .delete()
          .eq("user_id", currentUser.id)
          .eq("deal_id", dealId);

        if (error) {
          console.error("unsave error:", error);
          await refreshAfterInteraction(currentUser?.id ?? null);
        }
      } else {
        const result = await saveDeal({
          userId: currentUser.id,
          dealId,
        });

        if (!result.ok) {
          console.error("saveDeal error:", result.error);
          await refreshAfterInteraction(currentUser?.id ?? null);
        }
      }
    } catch (err) {
      console.error("save toggle exception:", err);
      await refreshAfterInteraction(currentUser?.id ?? null);
    } finally {
      setSavingId(null);
    }
  };

  const TOP_PAGE_SIZE = 50;
  const topDealsForThisPageRows = topDealsFiltered.slice(
    (topDealsPage - 1) * TOP_PAGE_SIZE,
    topDealsPage * TOP_PAGE_SIZE
  );

  const toSideVM = (r: DealsRow): SidebarDeal => ({
    id: r.id,
    title: r.title ?? "タイトル未設定",
    price: r.price ?? 0,
    market: r.market ?? "",
    imageUrl: r.image_url ?? null,
    likes: Number(r.likes_count ?? 0),
    comments: Number(r.comments_count ?? 0),
    isLiked: r.has_liked === true,
    isSaved: !!r.has_saved,
    isCommented: !!r.has_commented,
  });

  const sidePopularVM = sidePopular.map(toSideVM);
  const sideTrendingVM = sideTrending.map(toSideVM);
  const sideEndingSoonVM = sideEndingSoon.map(toSideVM);

  const recommendMobileRows = recommendFiltered.slice(0, 15);
  const topDealsMobileRows = topDealsForThisPageRows;

  const recommendPageStep =
    cardsPerPage * (recommendCardWidthPx + CARD_GAP);
  const recommendTranslateX = currentPage * recommendPageStep;

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      {q ? (
        <main
          className="mx-auto w-full px-4 pb-8 pt-5 sm:px-6 sm:pt-7"
          style={
            !isMobileMode
              ? {
                  maxWidth: `${
                    PADDING_X + SIDEBAR_WIDTH + OUTER_GAP + rowCardsWidth
                  }px`,
                }
              : undefined
          }
        >
          <div className="min-w-0 bg-white">
          <div ref={searchResultsTopRef} className="mb-5 scroll-mt-24">
            <h1 className="text-[20px] font-bold leading-tight text-slate-950 sm:text-[24px]">
              「{q}」の検索結果
              <span className="ml-2 text-[16px] font-semibold text-slate-500 sm:text-[18px]">
                ({searchTotalCount})
              </span>
            </h1>
          </div>

          <div className="mb-2 flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
            {isMobileMode ? (
              <button
                type="button"
                onClick={() => setSearchFilterOpen((v) => !v)}
                className={`inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition ${
                  searchFilterOpen || activeSearchFilterCount > 0
                    ? "border-[#006888] bg-[#006888] text-white"
                    : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                絞り込み
                {activeSearchFilterCount > 0 ? (
                  <span className="ml-0.5 rounded-full bg-white/20 px-1.5 text-[11px]">
                    {activeSearchFilterCount}
                  </span>
                ) : null}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setDesktopFiltersVisible((v) => !v)}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-[#111] px-4 text-[13px] font-semibold text-white transition hover:bg-black"
              >
                <SlidersHorizontal className="h-4 w-4" />
                {desktopFiltersVisible ? "絞り込みを隠す" : "絞り込みを表示"}
              </button>
            )}

            <div className="flex items-center gap-2">
              {!isMobileMode ? (
                <label className="mr-1 inline-flex cursor-pointer items-center gap-2 text-[13px] font-medium text-slate-700">
                  <span>期限切れ非表示</span>
                  <span className="relative inline-flex h-6 w-11 flex-none items-center">
                    <input
                      type="checkbox"
                      checked={hideExpired}
                      onChange={(e) => setHideExpired(e.target.checked)}
                      className="peer sr-only"
                    />
                    <span className="absolute inset-0 rounded-full bg-slate-200 transition peer-checked:bg-[#006888]" />
                    <span className="absolute left-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                  </span>
                </label>
              ) : null}

              <label className="relative">
                <select
                  value={searchSort}
                  onChange={(e) =>
                    setSearchSort(e.target.value as "relevance" | "newest" | "oldest")
                  }
                  className="h-9 appearance-none rounded-full border border-slate-300 bg-white py-0 pl-4 pr-9 text-[13px] text-slate-800 outline-none hover:bg-slate-50"
                  aria-label="検索結果の並び順"
                >
                  <option value="relevance">関連度</option>
                  <option value="newest">新着順</option>
                  <option value="oldest">古い順</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
              </label>

              <button
                type="button"
                onClick={() =>
                  setSearchView((current) =>
                    current === "list" ? "grid" : "list"
                  )
                }
                className={
                  isMobileMode
                    ? "flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    : "flex h-9 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
                }
                aria-label={
                  searchView === "list" ? "グリッド表示に切り替え" : "リスト表示に切り替え"
                }
                title={
                  searchView === "list" ? "グリッド表示" : "リスト表示"
                }
              >
                {searchView === "list" ? (
                  <>
                    <Grid2X2 className="h-4 w-4" />
                    {!isMobileMode ? <span>グリッド表示</span> : null}
                  </>
                ) : (
                  <>
                    <LayoutList className="h-4 w-4" />
                    {!isMobileMode ? <span>リスト表示</span> : null}
                  </>
                )}
              </button>
            </div>
          </div>

          {isMobileMode && activeSearchFilterChips.length > 0 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {activeSearchFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.onRemove}
                  className="flex h-8 flex-none items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 text-[12px] font-medium text-slate-700 shadow-sm"
                  aria-label={`${chip.label}を解除`}
                >
                  <span>{chip.label}</span>
                  <X className="h-3.5 w-3.5" />
                </button>
              ))}

              <button
                type="button"
                onClick={clearSearchFilters}
                className="h-8 flex-none px-1 text-[12px] font-medium text-[#006888]"
              >
                すべてクリア
              </button>
            </div>
          ) : null}

          {isMobileMode && searchFilterOpen ? (
            <div className="fixed inset-0 z-[70] bg-white md:left-1/2 md:top-1/2 md:h-[90vh] md:max-h-[820px] md:w-[520px] md:-translate-x-1/2 md:-translate-y-1/2 md:overflow-hidden md:rounded-2xl md:border md:border-slate-200 md:shadow-2xl">
              <div className="flex h-full flex-col bg-[#f6f6f6]">
                <div className="flex h-[58px] flex-none items-center justify-between border-b border-slate-200 bg-white px-4">
                  <button
                    type="button"
                    onClick={clearSearchFilters}
                    className="text-[14px] font-medium text-[#006888]"
                  >
                    すべてクリア
                  </button>

                  <div className="text-[18px] font-bold text-slate-900">
                    絞り込み & 並び順
                  </div>

                  <button
                    type="button"
                    onClick={() => setSearchFilterOpen(false)}
                    className="flex h-9 w-9 items-center justify-center text-slate-700"
                    aria-label="閉じる"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-28">
                  <FilterSection title="並び順" collapsible={false}>
                    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {[
                        ["relevance", "関連度"],
                        ["newest", "新着順"],
                        ["oldest", "古い順"],
                      ].map(([value, label]) => {
                        const active = searchSort === value;

                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() =>
                              setSearchSort(
                                value as "relevance" | "newest" | "oldest"
                              )
                            }
                            className={`flex-none rounded-full px-4 py-2 text-sm font-medium ${
                              active
                                ? "bg-slate-900 text-white"
                                : "bg-[#e9e9e9] text-slate-700"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </FilterSection>

                  <FilterSection title="評価">
                    <RadioFilter
                      value={ratingFilter}
                      options={[
                        { value: 10, label: "10+ いいね" },
                        { value: 5, label: "5+ いいね" },
                        { value: 3, label: "3+ いいね" },
                        { value: 2, label: "2+ いいね" },
                        { value: 1, label: "1+ いいね" },
                        { value: null, label: "すべて" },
                      ]}
                      onChange={setRatingFilter}
                    />
                  </FilterSection>

                  <FilterSection title="投稿日">
                    <RadioFilter
                      value={dateFilter}
                      options={[
                        { value: "24h", label: "過去24時間" },
                        { value: "week", label: "過去1週間" },
                        { value: "month", label: "過去1か月" },
                        { value: "3months", label: "過去3か月" },
                        { value: "year", label: "過去1年" },
                        { value: "all", label: "すべて" },
                      ]}
                      onChange={(value) =>
                        setDateFilter(
                          value as
                            | "all"
                            | "24h"
                            | "week"
                            | "month"
                            | "3months"
                            | "year"
                        )
                      }
                    />
                  </FilterSection>

                  <FilterSection title="割引率">
                    <RadioFilter
                      value={discountFilter}
                      options={[
                        { value: 10, label: "10%以上" },
                        { value: 25, label: "25%以上" },
                        { value: 50, label: "50%以上" },
                        { value: 75, label: "75%以上" },
                        { value: null, label: "指定なし" },
                      ]}
                      onChange={setDiscountFilter}
                    />
                  </FilterSection>

                  <FilterSection title="価格">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={minPriceFilter}
                        onChange={(e) => setMinPriceFilter(e.target.value)}
                        placeholder="¥ 最低"
                        className="h-11 min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#006888]"
                      />
                      <span className="text-sm text-slate-500">〜</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={maxPriceFilter}
                        onChange={(e) => setMaxPriceFilter(e.target.value)}
                        placeholder="¥ 最高"
                        className="h-11 min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#006888]"
                      />
                    </div>
                    {priceRangeInvalid ? (
                      <p className="mt-2 text-xs font-medium text-red-600">
                        最低価格は最高価格以下にしてください。
                      </p>
                    ) : null}
                  </FilterSection>

                  <FilterSection title="カテゴリ">
                    <CheckboxFilter
                      options={categoryFilterOptions.map((item) => ({
                        value: item.value,
                        label: item.label,
                        count: item.count,
                      }))}
                      selected={selectedCategories}
                      onToggle={(value) =>
                        toggleStringFilter(value, setSelectedCategories)
                      }
                    />
                  </FilterSection>

                  <FilterSection title="ショップ">
                    {storeFilterOptions.length > 0 ? (
                      <CheckboxFilter
                        options={storeFilterOptions.map(([value, count]) => ({
                          value,
                          label: value,
                          count,
                        }))}
                        selected={selectedStores}
                        onToggle={(value) =>
                          toggleStringFilter(value, setSelectedStores)
                        }
                      />
                    ) : (
                      <div className="text-sm text-slate-400">
                        ショップ情報がありません
                      </div>
                    )}
                  </FilterSection>

                  <FilterSection title="ブランド">
                    {brandFilterOptions.length > 0 ? (
                      <CheckboxFilter
                        options={brandFilterOptions.map(([value, count]) => ({
                          value,
                          label: value,
                          count,
                        }))}
                        selected={selectedBrands}
                        onToggle={(value) =>
                          toggleStringFilter(value, setSelectedBrands)
                        }
                      />
                    ) : (
                      <div className="text-sm text-slate-400">
                        ブランド情報がありません
                      </div>
                    )}
                  </FilterSection>

                  <FilterSection title="配送・表示">
                    <label className="flex cursor-pointer items-center gap-3 py-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={freeShippingOnly}
                        onChange={(e) =>
                          setFreeShippingOnly(e.target.checked)
                        }
                        className="h-4 w-4 accent-[#006888]"
                      />
                      送料無料のみ
                    </label>

                    <label className="flex cursor-pointer items-center gap-3 py-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={hideExpired}
                        onChange={(e) => setHideExpired(e.target.checked)}
                        className="h-4 w-4 accent-[#006888]"
                      />
                      期限切れのディールを非表示
                    </label>
                  </FilterSection>
                </div>

                <div className="absolute inset-x-0 bottom-0 border-t border-slate-200 bg-white px-4 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3">
                  <button
                    type="button"
                    onClick={() => setSearchFilterOpen(false)}
                    className="flex h-12 w-full items-center justify-center rounded-full bg-[#1976f3] text-[16px] font-bold text-white"
                  >
                    {searchTotalCount}件の結果を表示
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div
            className={!isMobileMode ? "grid items-start gap-6 pt-3" : ""}
            style={
              !isMobileMode
                ? {
                    gridTemplateColumns: desktopFiltersVisible
                      ? `${SIDEBAR_WIDTH}px ${rowCardsWidth}px`
                      : `${rowCardsWidth}px`,
                  }
                : undefined
            }
          >
            {!isMobileMode && desktopFiltersVisible ? (
              <aside className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-xl bg-[#f7f7f7] px-5 py-2 [scrollbar-width:thin] [&_h2]:text-[17px] [&_label]:text-[13px] [&_section]:py-4">
                <div className="border-b border-slate-300 py-4">
                  <button
                    type="button"
                    onClick={clearSearchFilters}
                    className="text-[13px] font-semibold text-[#006888] hover:underline"
                  >
                    すべてクリア
                  </button>
                </div>

                <FilterSection title="評価">
                  <RadioFilter
                    value={ratingFilter}
                    options={[
                      { value: 10, label: "10+ いいね" },
                      { value: 5, label: "5+ いいね" },
                      { value: 3, label: "3+ いいね" },
                      { value: 2, label: "2+ いいね" },
                      { value: 1, label: "1+ いいね" },
                      { value: null, label: "すべて" },
                    ]}
                    onChange={setRatingFilter}
                  />
                </FilterSection>

                <FilterSection title="投稿日">
                  <RadioFilter
                    value={dateFilter}
                    options={[
                      { value: "24h", label: "過去24時間" },
                      { value: "week", label: "過去1週間" },
                      { value: "month", label: "過去1か月" },
                      { value: "3months", label: "過去3か月" },
                      { value: "year", label: "過去1年" },
                      { value: "all", label: "すべて" },
                    ]}
                    onChange={(value) =>
                      setDateFilter(
                        value as
                          | "all"
                          | "24h"
                          | "week"
                          | "month"
                          | "3months"
                          | "year"
                      )
                    }
                  />
                </FilterSection>

                <FilterSection title="割引率">
                  <RadioFilter
                    value={discountFilter}
                    options={[
                      { value: 10, label: "10%以上" },
                      { value: 25, label: "25%以上" },
                      { value: 50, label: "50%以上" },
                      { value: 75, label: "75%以上" },
                      { value: null, label: "指定なし" },
                    ]}
                    onChange={setDiscountFilter}
                  />
                </FilterSection>

                <FilterSection title="価格">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={minPriceFilter}
                      onChange={(e) => setMinPriceFilter(e.target.value)}
                      placeholder="¥ 最低"
                      className="h-9 min-w-0 rounded-md border border-slate-300 bg-white px-2 text-[12px] text-slate-900 outline-none focus:border-[#006888]"
                    />
                    <span className="text-xs text-slate-500">〜</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={maxPriceFilter}
                      onChange={(e) => setMaxPriceFilter(e.target.value)}
                      placeholder="¥ 最高"
                      className="h-9 min-w-0 rounded-md border border-slate-300 bg-white px-2 text-[12px] text-slate-900 outline-none focus:border-[#006888]"
                    />
                  </div>
                  {priceRangeInvalid ? (
                    <p className="mt-2 text-[11px] font-medium text-red-600">
                      最低価格は最高価格以下にしてください。
                    </p>
                  ) : null}
                </FilterSection>

                <FilterSection title="カテゴリ">
                  <CheckboxFilter
                    options={categoryFilterOptions.map((item) => ({
                      value: item.value,
                      label: item.label,
                      count: item.count,
                    }))}
                    selected={selectedCategories}
                    onToggle={(value) =>
                      toggleStringFilter(value, setSelectedCategories)
                    }
                  />
                </FilterSection>

                <FilterSection title="ショップ">
                  {storeFilterOptions.length > 0 ? (
                    <CheckboxFilter
                      options={storeFilterOptions.map(([value, count]) => ({
                        value,
                        label: value,
                        count,
                      }))}
                      selected={selectedStores}
                      onToggle={(value) =>
                        toggleStringFilter(value, setSelectedStores)
                      }
                    />
                  ) : (
                    <div className="text-[13px] text-slate-400">
                      ショップ情報がありません
                    </div>
                  )}
                </FilterSection>

                <FilterSection title="ブランド">
                  {brandFilterOptions.length > 0 ? (
                    <CheckboxFilter
                      options={brandFilterOptions.map(([value, count]) => ({
                        value,
                        label: value,
                        count,
                      }))}
                      selected={selectedBrands}
                      onToggle={(value) =>
                        toggleStringFilter(value, setSelectedBrands)
                      }
                    />
                  ) : (
                    <div className="text-[13px] text-slate-400">
                      ブランド情報がありません
                    </div>
                  )}
                </FilterSection>

                <FilterSection title="配送・表示">
                  <label className="flex cursor-pointer items-center gap-3 py-2 text-slate-700">
                    <input
                      type="checkbox"
                      checked={freeShippingOnly}
                      onChange={(e) => setFreeShippingOnly(e.target.checked)}
                      className="h-4 w-4 accent-[#006888]"
                    />
                    送料無料のみ
                  </label>

                  <label className="flex cursor-pointer items-center gap-3 py-2 text-slate-700">
                    <input
                      type="checkbox"
                      checked={hideExpired}
                      onChange={(e) => setHideExpired(e.target.checked)}
                      className="h-4 w-4 accent-[#006888]"
                    />
                    期限切れを非表示
                  </label>
                </FilterSection>
              </aside>
            ) : null}

            <div className="min-w-0">
          {searchLoading ? (
            <div className="py-16 text-center">
              <div className="text-[17px] font-semibold text-slate-800">
                検索中...
              </div>
              <div className="mt-2 text-sm text-slate-500">
                検索結果を更新しています。
              </div>
            </div>
          ) : searchError ? (
            <div className="py-16 text-center">
              <div className="text-[17px] font-semibold text-slate-800">
                検索結果を取得できませんでした
              </div>
              <div className="mt-2 text-sm text-slate-500">
                しばらくしてからもう一度お試しください。
              </div>
            </div>
          ) : searchTotalCount > 0 ? (
            searchView === "list" ? (
              <div>
                {paginatedSearchResultRows.map((row) => {
                  const isLiked = row.has_liked === true;
                  const canLike = likingId !== row.id;
                  const isSaved = !!row.has_saved;
                  const canSave = !!currentUser && savingId !== row.id;

                  return (
                    <SearchDealRow
                      key={row.id}
                      row={row}
                      onLike={() => handleLikeAny(row.id)}
                      canLike={canLike}
                      isLiked={isLiked}
                      onSave={() => handleShareDeal(row.id, row.title)}
                      canSave={canSave}
                      isSaved={isSaved}
                    />
                  );
                })}
              </div>
            ) : (
              <div
                className={
                  isMobileMode
                    ? "grid grid-cols-2 gap-3 pt-3 sm:grid-cols-3"
                    : "grid gap-3"
                }
                style={
                  !isMobileMode
                    ? {
                        gridTemplateColumns: `repeat(${cardsPerPage}, ${cardWidthPx}px)`,
                      }
                    : undefined
                }
              >
                {paginatedSearchResultRows.map((row) => {
                  const isLiked = row.has_liked === true;
                  const canLike = likingId !== row.id;
                  const isSaved = !!row.has_saved;
                  const canSave = !!currentUser && savingId !== row.id;

                  return (
                    <SearchDealGridCard
                      key={row.id}
                      row={row}
                      onLike={() => handleLikeAny(row.id)}
                      canLike={canLike}
                      isLiked={isLiked}
                      onSave={() => handleShareDeal(row.id, row.title)}
                      canSave={canSave}
                      isSaved={isSaved}
                    />
                  );
                })}
              </div>
            )
          ) : (
            <div className="py-16 text-center">
              <div className="text-[17px] font-semibold text-slate-800">
                該当するディールが見つかりませんでした
              </div>
              <div className="mt-2 text-sm text-slate-500">
                {activeSearchFilterCount > 0
                  ? "絞り込み条件を変更してみてください。"
                  : "別のキーワードで検索してみてください。"}
              </div>
            </div>
          )}

          {!searchLoading && searchTotalCount > 0
            ? renderSearchPagination(isMobileMode)
            : null}
            </div>
          </div>

          </div>
        </main>
      ) : isMobileMode ? (
        <main className="mx-auto max-w-full px-0 py-4">
          <section className="px-4">
            <h2 className="mb-2 text-[19px] font-bold tracking-[0.01em] text-[#001e43]">
              あなたにおすすめ
            </h2>

            <CategoryTabs
              active={activeCategory}
              onChange={setActiveCategory}
              compact
            />

            <div className="-mx-4 overflow-x-auto px-4 pb-1.5 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex gap-2.5">
                {recommendMobileRows.map((row) => {
                  const cardData = {
                    id: row.id,
                    user: row.author_username ?? "匿名ユーザー",
                    avatar: row.author_avatar_url || "/tokumikke_logo.png",
                    time: formatDealPostedAt(row.created_at),
                    title: row.title ?? "タイトル未設定",
                    price: row.price ?? 0,
                    orig: row.orig_price ?? undefined,
                    market: row.market ?? "",
                    shopName: row.shop_name ?? "",
                    imageUrl: row.image_url ?? null,
                    likes: Number(row.likes_count ?? 0),
                    comments: Number(row.comments_count ?? 0),
                    hasCommented: !!row.has_commented,
                    detailUrl: `/deals/${row.id}`,
                    linkUrl: undefined,
                    category: row.category ?? null,
                    freeShipping: !!row.free_shipping,
                  };

                  const isLiked = row.has_liked === true;
                  const canLike = likingId !== row.id;

                  return (
                    <MobileRecommendCard
                      key={row.id}
                      d={cardData}
                      onLike={() => handleLikeAny(row.id)}
                      canLike={canLike}
                      isLiked={isLiked}
                    />
                  );
                })}
              </div>
            </div>
          </section>

          <section className="mt-6">
            <div className="px-4">
              <h2 className="text-xl font-semibold tracking-wide text-[#001e43]">
                トップディール
              </h2>
            </div>

            <div className="mt-3 space-y-2.5">
              {topDealsMobileRows.map((row) => {
                const cardData = {
                  id: row.id,
                  user: row.author_username ?? "匿名ユーザー",
                  avatar: row.author_avatar_url || "/tokumikke_logo.png",
                  time: formatDealPostedAt(row.created_at),
                  title: row.title ?? "タイトル未設定",
                  price: row.price ?? 0,
                  orig: row.orig_price ?? undefined,
                  market: row.market ?? "",
                  shopName: row.shop_name ?? "",
                  imageUrl: row.image_url ?? null,
                  likes: Number(row.likes_count ?? 0),
                  comments: Number(row.comments_count ?? 0),
                  hasCommented: !!row.has_commented,
                  detailUrl: `/deals/${row.id}`,
                  linkUrl: undefined,
                  category: row.category ?? null,
                  freeShipping: !!row.free_shipping,
                };

                const isLiked = row.has_liked === true;
                const canLike = likingId !== row.id;

                return (
                  <MobileDealRow
                    key={row.id}
                    d={cardData}
                    onLike={() => handleLikeAny(row.id)}
                    canLike={canLike}
                    isLiked={isLiked}
                  />
                );
              })}
            </div>

            <div className="mt-4 flex justify-end px-4">
              <div className="flex items-center gap-3">
                <a
                  href="/?page=1"
                  className={
                    topDealsPage === 1
                      ? "pointer-events-none inline-flex cursor-default items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-4 py-1.5 text-sm text-slate-400"
                      : "inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm text-black hover:bg-slate-50"
                  }
                >
                  前へ
                </a>

                <a
                  href="/?page=2"
                  className={
                    topDealsPage === 2
                      ? "pointer-events-none inline-flex cursor-default items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-4 py-1.5 text-sm text-slate-400"
                      : "inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm text-black hover:bg-slate-50"
                  }
                >
                  次へ
                </a>
              </div>
            </div>
          </section>
        </main>
      ) : (
        <main className="mx-auto overflow-x-visible px-4 py-6">
          <div className="flex justify-center">
            <div className="flex flex-row gap-6" style={{ minWidth: layoutTotalWidth }}>
              <section className="min-w-0 flex-none" style={{ width: rowCardsWidth }}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xl font-semibold tracking-wide text-[#001e43]">
                    あなたにおすすめ
                  </h2>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePrev}
                      disabled={currentPage === 0 || recommendTotalPages <= 1}
                      className={`flex h-10 w-10 items-center justify-center rounded-full border text-slate-700 transition ${
                        currentPage === 0 || recommendTotalPages <= 1
                          ? "cursor-default border-slate-100 bg-slate-100 text-slate-400"
                          : "cursor-pointer border-slate-300 bg-white shadow-sm hover:bg-slate-50"
                      }`}
                      aria-label="前へ"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
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
                        currentPage === recommendTotalPages - 1 || recommendTotalPages <= 1
                      }
                      className={`flex h-10 w-10 items-center justify-center rounded-full border text-slate-700 transition ${
                        currentPage === recommendTotalPages - 1 || recommendTotalPages <= 1
                          ? "cursor-default border-slate-100 bg-slate-100 text-slate-400"
                          : "cursor-pointer border-slate-300 bg-white shadow-sm hover:bg-slate-50"
                      }`}
                      aria-label="次へ"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
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

                <CategoryTabs
                  active={activeCategory}
                  onChange={setActiveCategory}
                />

                <div
                  className="relative"
                  style={{ width: rowCardsWidth }}
                >
                  <div className="overflow-hidden py-2">
                    <div
                      className="flex gap-3 transition-transform duration-500 ease-out"
                    style={{
                      transform: `translateX(-${recommendTranslateX}px)`,
                    }}
                  >
                    {recommendFiltered.map((row) => {
                      const cardData = {
                        id: row.id,
                        user: row.author_username ?? "匿名ユーザー",
                        avatar: row.author_avatar_url || "/tokumikke_logo.png",
                        time: formatDealPostedAt(row.created_at),
                        title: row.title ?? "タイトル未設定",
                        price: row.price ?? 0,
                        orig: row.orig_price ?? undefined,
                        market: row.market ?? "",
                        shopName: row.shop_name ?? "",
                        imageUrl: row.image_url ?? null,
                        likes: Number(row.likes_count ?? 0),
                        comments: Number(row.comments_count ?? 0),
                        hasCommented: !!row.has_commented,
                        detailUrl: `/deals/${row.id}`,
                        linkUrl: undefined,
                        category: row.category ?? null,
                        freeShipping: !!row.free_shipping,
                      };

                      const isLiked = row.has_liked === true;
                      const canLike = likingId !== row.id;
                      const isSaved = !!row.has_saved;
                      const canSave = !!currentUser && savingId !== row.id;

                      return (
                        <div
                          key={row.id}
                          className={`${recommendCardWidthClass} flex-none`}
                        >
                          <Card
                            d={cardData}
                            onLike={() => handleLikeAny(row.id)}
                            canLike={canLike}
                            isLiked={isLiked}
                            onSave={() => handleShareDeal(row.id, row.title)}
                            canSave={canSave}
                            isSaved={isSaved}
                          />
                        </div>
                      );
                    })}
                    </div>
                  </div>

                  {currentPage < recommendTotalPages - 1 ? (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-2 right-0 z-10 w-20 bg-gradient-to-r from-transparent to-white"
                    />
                  ) : null}
                </div>

                <div className="mt-8">
                  <h2 className="text-xl font-semibold tracking-wide text-[#001e43]">
                    トップディール
                  </h2>

                  <div
                    className="mt-3 grid gap-3"
                    style={{
                      gridTemplateColumns: `repeat(${cardsPerPage}, ${cardWidthPx}px)`,
                    }}
                  >
                    {topDealsForThisPageRows.map((row) => {
                      const cardData = {
                        id: row.id,
                        user: row.author_username ?? "匿名ユーザー",
                        avatar: row.author_avatar_url || "/tokumikke_logo.png",
                        time: formatDealPostedAt(row.created_at),
                        title: row.title ?? "タイトル未設定",
                        price: row.price ?? 0,
                        orig: row.orig_price ?? undefined,
                        market: row.market ?? "",
                        shopName: row.shop_name ?? "",
                        imageUrl: row.image_url ?? null,
                        likes: Number(row.likes_count ?? 0),
                        comments: Number(row.comments_count ?? 0),
                        hasCommented: !!row.has_commented,
                        detailUrl: `/deals/${row.id}`,
                        linkUrl: undefined,
                        category: row.category ?? null,
                        freeShipping: !!row.free_shipping,
                      };

                      const isLiked = row.has_liked === true;
                      const canLike = likingId !== row.id;
                      const isSaved = !!row.has_saved;
                      const canSave = !!currentUser && savingId !== row.id;

                      return (
                        <div key={row.id} className="flex-none">
                          <Card
                            d={cardData}
                            onLike={() => handleLikeAny(row.id)}
                            canLike={canLike}
                            isLiked={isLiked}
                            onSave={() => handleShareDeal(row.id, row.title)}
                            canSave={canSave}
                            isSaved={isSaved}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-6 flex justify-end">
                    <div className="flex items-center gap-3">
                      <a
                        href="/?page=1"
                        className={
                          topDealsPage === 1
                            ? "pointer-events-none inline-flex cursor-default items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-4 py-1.5 text-sm text-slate-400"
                            : "inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm text-black hover:bg-slate-50"
                        }
                      >
                        前へ
                      </a>

                      <a
                        href="/?page=2"
                        className={
                          topDealsPage === 2
                            ? "pointer-events-none inline-flex cursor-default items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-4 py-1.5 text-sm text-slate-400"
                            : "inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm text-black hover:bg-slate-50"
                        }
                      >
                        次へ
                      </a>
                    </div>
                  </div>
                </div>
              </section>

              <RightSidebar
                popular={sidePopularVM}
                trending={sideTrendingVM}
                endingSoon={sideEndingSoonVM}
                className="sticky top-24 max-h-[calc(100vh-7rem)] w-72 flex-none self-start space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain mt-[44px] pl-1 pt-1 pr-2 pb-2"
                onLike={(id) => handleLikeAny(id)}
                onShare={(id) => {
                  const deal = [...sidePopularVM, ...sideTrendingVM, ...sideEndingSoonVM].find(
                    (item) => item.id === id,
                  );
                  void handleShareDeal(id, deal?.title);
                }}
                canLike={true}
                showRank={false}
              />
            </div>
          </div>
        </main>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageContent />
    </Suspense>
  );
}
