// app/components/ViewTracker.tsx
"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

function getOrCreateSessionId(): string {
  const key = "od_session_id";
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;

    const sid =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    localStorage.setItem(key, sid);
    return sid;
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function shouldRecordOncePerDeal(dealId: string): boolean {
  const key = `od_viewed_${dealId}`;
  try {
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, "1");
    return true;
  } catch {
    return true;
  }
}

export default function ViewTracker(props: {
  dealId: string;
  enabled?: boolean; // データ取得後に true にする用
}) {
  const { dealId, enabled = true } = props;

  useEffect(() => {
    if (!enabled) return;
    if (!dealId) return;

    // 1ディールにつき、このブラウザで1回だけ記録（リロード連打で増えないように）
    if (!shouldRecordOncePerDeal(dealId)) return;

    const sessionId = getOrCreateSessionId();

    // fire-and-forget（失敗しても UI を壊さない）
    void (async () => {
      try {
        const { error } = await supabase.rpc("record_deal_view", {
          p_deal_id: dealId,
          p_session_id: sessionId,
        });

        if (error) console.warn("record_deal_view rpc error:", error);
      } catch (e) {
        console.warn("record_deal_view failed:", e);
      }
    })();
  }, [dealId, enabled]);

  return null;
}
