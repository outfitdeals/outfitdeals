"use client";

import { useEffect, useState } from "react";
import DealCard from "@/app/components/DealCard";
import MobileDealRow from "@/app/components/MobileDealRow";
import { supabase } from "@/lib/supabaseClient";
import { likeDeal } from "@/lib/dealActions";

type Deal = {
  id: string;
  user_id: string | null;
  category: string | null;
  created_at: string;
  title: string | null;
  price: number | null;
  orig_price: number | null;
  market: string | null;
  shop_name: string | null;
  image_url: string | null;
  likes_count: number | null;
  dislikes_count: number | null;
  comments_count: number | null;
  detailUrl: string;
  username: string;
  avatar: string;
};

function postedAt(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const dateKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  });
  const posted = dateKey.format(date);
  const time = date.toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });
  if (posted === dateKey.format(now)) return `今日 ${time}`;
  if (posted === dateKey.format(new Date(now.getTime() - 86_400_000))) return `昨日 ${time}`;
  return date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function CategoryDealCard({ deal }: { deal: Deal }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [likes, setLikes] = useState(Number(deal.likes_count ?? 0));
  const [dislikes, setDislikes] = useState(Number(deal.dislikes_count ?? 0));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      const id = data.user?.id ?? null;
      setUserId(id);
      if (!id) return;
      const [{ data: likeRows }, { data: dislikeRows }] = await Promise.all([
        supabase.from("deal_likes").select("deal_id").eq("user_id", id).eq("deal_id", deal.id).limit(1),
        supabase.from("deal_dislikes").select("deal_id").eq("user_id", id).eq("deal_id", deal.id).limit(1),
      ]);
      if (active) { setLiked(!!likeRows?.length); setDisliked(!!dislikeRows?.length); }
    });
    return () => { active = false; };
  }, [deal.id]);

  async function toggleLike() {
    if (!userId) { window.alert("いいね機能を使うには、ログインが必要です。"); return; }
    if (busy) return;
    setBusy(true);
    const previousLiked = liked;
    const previousDisliked = disliked;
    setLiked(!previousLiked);
    setLikes(v => Math.max(0, v + (previousLiked ? -1 : 1)));
    if (!previousLiked && previousDisliked) { setDisliked(false); setDislikes(v => Math.max(0, v - 1)); }
    try {
      if (previousLiked) {
        const { error } = await supabase.from("deal_likes").delete().eq("user_id", userId).eq("deal_id", deal.id);
        if (error) throw error;
      } else {
        if (previousDisliked) {
          const { error } = await supabase.from("deal_dislikes").delete().eq("user_id", userId).eq("deal_id", deal.id);
          if (error) throw error;
        }
        const result = await likeDeal({ userId, dealId: deal.id });
        if (!result.ok) throw result.error;
      }
      const [{ count: likeCount }, { count: dislikeCount }] = await Promise.all([
        supabase.from("deal_likes").select("*", { count: "exact", head: true }).eq("deal_id", deal.id),
        supabase.from("deal_dislikes").select("*", { count: "exact", head: true }).eq("deal_id", deal.id),
      ]);
      if (likeCount !== null) setLikes(likeCount);
      if (dislikeCount !== null) setDislikes(dislikeCount);
    } catch (error) {
      console.error("category like error:", error);
      setLiked(previousLiked);
      setDisliked(previousDisliked);
      setLikes(Number(deal.likes_count ?? 0));
      setDislikes(Number(deal.dislikes_count ?? 0));
      window.alert("いいねの更新に失敗しました。再度お試しください。");
    } finally { setBusy(false); }
  }

  async function share() {
    const url = `${window.location.origin}${deal.detailUrl}`;
    try {
      if (navigator.share) { await navigator.share({ title: deal.title || "トクミッケ", url }); return; }
      await navigator.clipboard.writeText(url);
      window.alert("リンクをコピーしました。");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("category share error:", error);
    }
  }

  const age = Date.now() - new Date(deal.created_at).getTime();
  const cardData = {
        id: deal.id, userId: deal.user_id, user: deal.username, avatar: deal.avatar,
        time: postedAt(deal.created_at), title: deal.title || "タイトル未設定",
        price: deal.price ?? 0, orig: deal.orig_price ?? undefined,
        market: deal.market ?? "", shopName: deal.shop_name ?? "",
        imageUrl: deal.image_url, likes: likes - dislikes,
        comments: Number(deal.comments_count ?? 0), hasCommented: false,
        detailUrl: deal.detailUrl, category: deal.category,
        isNew: age >= 0 && age < 86_400_000,
  };
  return (
    <>
      <div className="md:hidden">
        <MobileDealRow d={cardData} onLike={toggleLike} canLike={!busy} isLiked={liked} />
      </div>
      <div className="hidden md:block h-full">
        <DealCard d={cardData} onLike={toggleLike} canLike={!busy} isLiked={liked}
          onSave={share} canSave={true} isSaved={false} />
      </div>
    </>
  );
}
