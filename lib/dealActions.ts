// lib/dealActions.ts
"use client";

import { supabase } from "@/lib/supabaseClient";

type DealActionResult =
  | { ok: true; newCount?: number }
  | { ok: false; error: any };

export async function likeDeal(params: { dealId: string; userId: string }) {
  const { dealId, userId } = params;

  // 1) まず like 行を作る（ユニーク制約で二重防止）
  const { error } = await supabase.from("deal_likes").insert({
    user_id: userId,
    deal_id: dealId,
  });

  if (error) {
    // 既にいいね済み
    if ((error as any)?.code === "23505") return { ok: true } as DealActionResult;
    return { ok: false, error } as DealActionResult;
  }

  // 2) deals.likes_count の増加は DB 側（trigger/RPC 等）に任せる設計ならここで終わりでもOK
  //    ただ、あなたの構成は「DBの値を再取得して補正」する方針なので、ここでは補正用に取得
  const { data: row, error: fetchErr } = await supabase
    .from("deals")
    .select("likes_count")
    .eq("id", dealId)
    .single();

  if (fetchErr) return { ok: true } as DealActionResult;

  const newCount = Number((row as any)?.likes_count ?? NaN);
  return Number.isNaN(newCount)
    ? ({ ok: true } as DealActionResult)
    : ({ ok: true, newCount } as DealActionResult);
}

export async function saveDeal(params: { dealId: string; userId: string }) {
  const { dealId, userId } = params;

  // deal_saves が存在する前提（無い場合は UI 側で無効化 or warn する設計）
  const { error } = await supabase.from("deal_saves").insert({
    user_id: userId,
    deal_id: dealId,
  });

  if (error) {
    // 既に保存済み
    if ((error as any)?.code === "23505") return { ok: true } as DealActionResult;
    return { ok: false, error } as DealActionResult;
  }

  return { ok: true } as DealActionResult;
}

/**
 * ✅ 閲覧数を +1 する（DB: increment_deal_views RPC）
 * - 未ログインでも OK（userId は null で送る）
 * - sessionId を渡す（同一セッション内の重複抑止を将来やりたくなった時に使える）
 */
export async function viewDeal(params: {
  dealId: string;
  userId?: string | null;
  sessionId?: string | null;
}): Promise<DealActionResult> {
  const { dealId, userId = null, sessionId = null } = params;

  const { data, error } = await supabase.rpc("increment_deal_views", {
    p_deal_id: dealId,
    p_user_id: userId,
    p_session_id: sessionId,
  });

  if (error) return { ok: false, error };

  const newCount = Number(data ?? NaN);
  return Number.isNaN(newCount) ? { ok: true } : { ok: true, newCount };
}