// app/post/page.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type Market = "楽天市場" | "Yahoo!ショッピング" | "ZOZOTOWN" | "";

export default function PostPage() {
  const router = useRouter();

  // ユーザーが入力できる項目
  const [productUrl, setProductUrl] = useState("");
  const [comment, setComment] = useState("");

  // 自動入力される項目（編集不可）
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState<string>("");
  const [origPrice] = useState<string>(""); // 将来用（今は常に空）
  const [market, setMarket] = useState<Market>("楽天市場");
  const [shopName, setShopName] = useState("");
  const [dealUrl, setDealUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const enabledInputBase =
    "rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-[#001e43] focus:outline-none focus:ring-1 focus:ring-[#001e43]";
  const disabledInputBase =
    "rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 bg-slate-100 cursor-not-allowed";

  // 楽天から自動入力
  async function handleRakutenAutoFill() {
    setApiError(null);

    if (!productUrl) {
      setApiError("まず楽天の商品ページURLを入力してください。");
      return;
    }

    try {
      setIsLoading(true);

      const res = await fetch("/api/rakuten-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: productUrl }),
      });

      // HTTPレベルのエラー（400/500など）
      if (!res.ok) {
        const text = await res.text();
        console.error("rakuten-preview http error body:", text);
        setApiError(`Rakuten API error: status ${res.status}`);
        return;
      }

      const data = await res.json();
      console.log("rakuten-preview data:", data);

      // data は preview オブジェクトそのもの（title, price, shopName など）
      setTitle(data.title ?? "");
      setPrice(
        data.price !== null && data.price !== undefined
          ? String(data.price)
          : ""
      );
      setMarket("楽天市場");
      setShopName(data.shopName ?? "");
      setDealUrl(data.dealUrl ?? productUrl);
      setImageUrl(data.imageUrl ?? "");
    } catch (err: any) {
      console.error("rakuten-preview error:", err);
      setApiError(
        "楽天APIとの通信中にエラーが発生しました。時間をおいて再度お試しください。"
      );
    } finally {
      setIsLoading(false);
    }
  }

  // 投稿処理
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError(null);

    if (!productUrl) {
      setApiError("商品ページのURLは必須です。");
      return;
    }
    if (!comment.trim()) {
      setApiError("コメントは必須です。");
      return;
    }

    try {
      setIsLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setApiError("投稿するにはログインが必要です。");
        return;
      }

      const { error } = await supabase.from("deals").insert({
        user_id: user.id,
        title,
        price: price ? Number(price) : null,
        orig_price: origPrice ? Number(origPrice) : null,
        market: market || null,
        shop_name: shopName || null,
        deal_url: dealUrl || productUrl,
        image_url: imageUrl || null,
        likes_count: 0,
        comments_count: 0,
        comment: comment || null,
      });

      if (error) {
        console.error("insert error:", error);
        setApiError("投稿の保存に失敗しました。時間をおいて再度お試しください。");
        return;
      }

      router.push("/mypage");
    } catch (err) {
      console.error(err);
      setApiError("予期せぬエラーが発生しました。");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fffafa]">
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold text-[#001e43] mb-4">
          ディールを投稿する
        </h1>

        {apiError && (
          <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {apiError}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-lg bg-white p-5 shadow-md ring-1 ring-slate-200"
        >
          {/* 商品ページURL（必須・編集可能） */}
          <div>
            <label className="block text-sm font-semibold text-slate-800">
              商品ページのURL <span className="text-red-600">*</span>
            </label>
            <div className="mt-1 flex gap-2">
              <input
                type="url"
                className={`flex-1 ${enabledInputBase}`}
                placeholder="https://item.rakuten.co.jp/ショップ名/商品コード/ など"
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
              />
              <button
                type="button"
                onClick={handleRakutenAutoFill}
                disabled={isLoading}
                className="whitespace-nowrap rounded bg-[#001e43] px-3 py-2 text-xs font-semibold text-white hover:bg-[#002b66] disabled:opacity-60"
              >
                楽天から自動入力
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              まず楽天の商品URLを貼り付け、「楽天から自動入力」を押すとタイトルや価格などが自動取得されます。
            </p>
          </div>

          {/* タイトル（自動入力・編集不可） */}
          <div>
            <label className="block text-sm font-semibold text-slate-800">
              タイトル
            </label>
            <input
              type="text"
              className={`mt-1 w-full ${disabledInputBase}`}
              placeholder="楽天から自動入力されます"
              value={title}
              disabled
              readOnly
            />
          </div>

          {/* 価格・元値（自動入力・編集不可） */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-slate-800">
                価格（現在の販売価格）
              </label>
              <div className="mt-1 flex items-center gap-1">
                <input
                  type="number"
                  className={`w-full ${disabledInputBase}`}
                  placeholder="楽天から自動入力されます"
                  value={price}
                  disabled
                  readOnly
                />
                <span className="text-sm text-slate-700">円</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-800">
                元値
              </label>
              <div className="mt-1 flex items-center gap-1">
                <input
                  type="number"
                  className={`w-full ${disabledInputBase}`}
                  placeholder="必要に応じて今後対応予定"
                  value={origPrice}
                  disabled
                  readOnly
                />
                <span className="text-sm text-slate-700">円</span>
              </div>
            </div>
          </div>

          {/* モール・ショップ名（自動入力・編集不可） */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-slate-800">
                モール
              </label>
              <select
                className={`mt-1 w-full ${disabledInputBase}`}
                value={market}
                disabled
                readOnly
              >
                <option value="楽天市場">楽天市場</option>
                <option value="Yahoo!ショッピング">Yahoo!ショッピング</option>
                <option value="ZOZOTOWN">ZOZOTOWN</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-800">
                ショップ名
              </label>
              <input
                type="text"
                className={`mt-1 w-full ${disabledInputBase}`}
                placeholder="楽天から自動入力されます"
                value={shopName}
                disabled
                readOnly
              />
            </div>
          </div>

          {/* ディールのリンク先URL（自動入力・編集不可） */}
          <div>
            <label className="block text-sm font-semibold text-slate-800">
              ディールのリンク先URL
            </label>
            <input
              type="url"
              className={`mt-1 w-full ${disabledInputBase}`}
              placeholder="楽天APIから生成されたリンクが自動で入ります。編集はできません。"
              value={dealUrl || productUrl}
              disabled
              readOnly
            />
            <p className="mt-1 text-xs text-slate-600">
              空欄の場合は上の「商品ページのURL」がそのまま保存されます。
            </p>
          </div>

          {/* 商品画像URL（自動入力・編集不可） */}
          <div>
            <label className="block text-sm font-semibold text-slate-800">
              商品画像URL
            </label>
            <input
              type="url"
              className={`mt-1 w-full ${disabledInputBase}`}
              placeholder="楽天APIから自動で入ります。編集はできません。"
              value={imageUrl}
              disabled
              readOnly
            />
          </div>

          {/* コメント（必須・編集可能） */}
          <div>
            <label className="block text-sm font-semibold text-slate-800">
              コメント <span className="text-red-600">*</span>
            </label>
            <textarea
              className={`mt-1 w-full ${enabledInputBase}`}
              placeholder="サイズ感、履き心地、注意点など自由にどうぞ。（例：普段27cmですが、これはハーフサイズ上げてちょうど良かったです）"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center justify-center rounded bg-[#001e43] px-5 py-2 text-sm font-semibold text-white hover:bg-[#002b66] disabled:opacity-60"
            >
              {isLoading ? "送信中..." : "この内容で投稿する"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
