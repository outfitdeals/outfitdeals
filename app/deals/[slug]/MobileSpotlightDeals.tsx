// app/deals/[slug]/MobileSpotlightDeals.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ThumbsUp, MessageSquare } from "lucide-react";
import { yen } from "@/app/components/DealUI";
import type { SidebarDeal } from "@/app/components/RightSidebar";

type MobileSpotlightTab = "popular" | "trending" | "endingSoon";

export default function MobileSpotlightDeals({
  popular,
  trending,
  endingSoon,
  onLike,
  onShare,
}: {
  popular: SidebarDeal[];
  trending: SidebarDeal[];
  endingSoon: SidebarDeal[];
  onLike: (id: string) => void;
  onShare: (id: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<MobileSpotlightTab>("popular");
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (activeTab !== "endingSoon") return;

    const timerId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [activeTab]);

  const tabs: Array<{
    value: MobileSpotlightTab;
    label: string;
    items: SidebarDeal[];
  }> = [
    { value: "popular", label: "人気", items: popular },
    { value: "trending", label: "急上昇", items: trending },
    { value: "endingSoon", label: "まもなく終了", items: endingSoon },
  ];

  const activeItems =
    tabs.find((tab) => tab.value === activeTab)?.items.slice(0, 3) ?? [];

  const formatCountdown = (expiresAt?: string | null) => {
    if (!expiresAt) return null;

    const expiresMs = new Date(expiresAt).getTime();
    if (!Number.isFinite(expiresMs)) return null;

    const remainingMs = expiresMs - nowMs;
    if (remainingMs <= 0) return "終了";

    const totalSeconds = Math.floor(remainingMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const hh = String(hours).padStart(2, "0");
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");

    return days > 0
      ? `残り ${days}日 ${hh}:${mm}:${ss}`
      : `残り ${hh}:${mm}:${ss}`;
  };

  return (
    <section className="mt-5 w-full bg-white px-4 py-5 shadow-sm" aria-label="注目のディール">
      <h2 className="text-[19px] font-bold tracking-[0.01em] text-[#001e43]">
        注目のディール
      </h2>

      <div className="mt-2 flex rounded-lg bg-slate-100 p-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.value;

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={
                isActive
                  ? "flex-1 cursor-pointer rounded-md bg-white px-2 py-2 text-[12px] font-semibold text-[#006888] shadow-sm"
                  : "flex-1 cursor-pointer rounded-md px-2 py-2 text-[12px] font-semibold text-slate-600"
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 space-y-2">
        {activeItems.length > 0 ? (
          activeItems.map((deal) => {
            const detailUrl = deal.detailUrl ?? `/deals/${deal.id}`;
            const countdown =
              activeTab === "endingSoon"
                ? formatCountdown(deal.expiresAt)
                : null;

            return (
              <article
                key={deal.id}
                className="flex gap-3 rounded-lg border border-slate-200 bg-white p-2.5 shadow-[0_5px_14px_-8px_rgba(15,23,42,0.38)]"
              >
                <Link
                  href={detailUrl}
                  className="h-[76px] w-[76px] flex-none cursor-pointer overflow-hidden rounded-md bg-slate-100"
                >
                  <img
                    src={
                      deal.imageUrl ??
                      "https://via.placeholder.com/160x160?text=No+Image"
                    }
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </Link>

                <div className="min-w-0 flex-1">
                  <Link
                    href={detailUrl}
                    className="line-clamp-2 cursor-pointer text-[13px] font-semibold leading-[1.25] text-slate-800 hover:underline"
                  >
                    {deal.title}
                  </Link>

                  <div className="mt-1 flex items-baseline justify-between gap-2">
                    <span className="text-[16px] font-bold leading-none text-[#d90429]">
                      {yen(deal.price)}
                    </span>

                    {countdown ? (
                      <span
                        className={
                          countdown === "終了"
                            ? "flex-none text-right text-[10px] font-medium tabular-nums text-slate-500"
                            : "flex-none text-right text-[10px] font-medium tabular-nums text-[#001e43]"
                        }
                      >
                        {countdown}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-2 flex items-center gap-4 text-[11px] text-slate-500">
                    <button
                      type="button"
                      onClick={() => onLike(deal.id)}
                      className={
                        deal.isLiked
                          ? "inline-flex cursor-pointer items-center gap-1 text-[#006888]"
                          : "inline-flex cursor-pointer items-center gap-1 hover:text-[#006888]"
                      }
                      aria-label={deal.isLiked ? "いいねを取り消す" : "いいね"}
                    >
                      <ThumbsUp
                        className="h-3.5 w-3.5"
                        fill={deal.isLiked ? "currentColor" : "none"}
                      />
                      {Number(deal.likes ?? 0)}
                    </button>

                    <Link
                      href={`${detailUrl}#comments`}
                      className={
                        deal.isCommented
                          ? "inline-flex cursor-pointer items-center gap-1 text-[#001e43]"
                          : "inline-flex cursor-pointer items-center gap-1 hover:text-[#006888]"
                      }
                      aria-label="コメントを見る"
                    >
                      <MessageSquare
                        className="h-3.5 w-3.5"
                        fill={deal.isCommented ? "currentColor" : "none"}
                      />
                      {Number(deal.comments ?? 0)}
                    </Link>

                    <button
                      type="button"
                      onClick={() => onShare(deal.id)}
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
              </article>
            );
          })
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-4 text-center text-xs text-slate-500">
            ディールがありません。
          </div>
        )}
      </div>
    </section>
  );
}

