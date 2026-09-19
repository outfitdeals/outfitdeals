"use client";

import { useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

type Props = {
  dealId: string; // uuid
};

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
    // localStorageが使えない環境でも最低限動かす（毎回変わるが致命ではない）
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
    return true; // localStorage不可なら都度記録（最悪でもOK）
  }
}

export default function RecordDealView({ dealId }: Props) {
  useEffect(() => {
    if (!dealId) return;

    // 1ディールにつき、このブラウザで1回だけ記録（リロード連打で増えないように）
    if (!shouldRecordOncePerDeal(dealId)) return;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      console.warn("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
      return;
    }

    const supabase = createClient(url, anonKey);
    const sessionId = getOrCreateSessionId();

    // fire-and-forget（画面表示をブロックしない）
    void (async () => {
      try {
        const { error } = await supabase.rpc("record_deal_view", {
          p_deal_id: dealId,
          p_session_id: sessionId,
        });

        if (error) console.warn("record_deal_view rpc error:", error);
      } catch (e) {
        console.warn("record_deal_view rpc exception:", e);
      }
    })();
  }, [dealId]);

  return null;
}
