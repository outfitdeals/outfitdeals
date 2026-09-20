"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";

type Market = "楽天市場" | "Yahoo!ショッピング" | "ZOZOTOWN" | "";
type DealCategory =
  | "fashion_women"
  | "fashion_men"
  | "beauty"
  | "home"
  | "electronics"
  | "other";

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function japanDateTimeLocalToIso(value: string) {
  const match = value
    .trim()
    .match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const h = Number(hour);
  const min = Number(minute);

  if (
    m < 1 ||
    m > 12 ||
    d < 1 ||
    d > 31 ||
    h < 0 ||
    h > 23 ||
    min < 0 ||
    min > 59
  ) {
    return null;
  }

  const utcMs = Date.UTC(y, m - 1, d, h, min) - 9 * 60 * 60 * 1000;
  const check = new Date(utcMs + 9 * 60 * 60 * 1000);

  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== m - 1 ||
    check.getUTCDate() !== d ||
    check.getUTCHours() !== h ||
    check.getUTCMinutes() !== min
  ) {
    return null;
  }

  return new Date(utcMs).toISOString();
}

function isoToJapanDateTimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}/${part("month")}/${part("day")} ${part("hour")}:${part("minute")}`;
}

function pickerValueToDisplay(value: string) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
  );
  if (!match) return "";

  const [, year, month, day, hour, minute] = match;
  return `${year}/${month}/${day} ${hour}:${minute}`;
}

function displayValueToPicker(value: string) {
  const match = value
    .trim()
    .match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!match) return "";

  const [, year, month, day, hour, minute] = match;
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isRakutenAffiliateOrRedirectUrl(value: string) {
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();

    return (
      hostname === "hb.afl.rakuten.co.jp" ||
      hostname === "afl.rakuten.co.jp" ||
      hostname === "r10.to" ||
      hostname.endsWith(".r10.to")
    );
  } catch {
    return false;
  }
}

function normalizeRakutenProductUrl(value: string) {
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();

    if (hostname !== "item.rakuten.co.jp") {
      return "";
    }

    const pathParts = url.pathname.split("/").filter(Boolean);

    if (pathParts.length < 2) {
      return "";
    }

    const shopCode = pathParts[0];
    const itemCode = pathParts[1];

    if (!shopCode || !itemCode) {
      return "";
    }

    return `https://item.rakuten.co.jp/${shopCode}/${itemCode}/`;
  } catch {
    return "";
  }
}

function isDirectRakutenProductUrl(value: string) {
  if (!isValidHttpUrl(value) || isRakutenAffiliateOrRedirectUrl(value)) {
    return false;
  }

  return Boolean(normalizeRakutenProductUrl(value));
}

function recoverDirectRakutenUrl(value: string | null | undefined) {
  if (!value) return "";

  const normalizedDirectUrl = normalizeRakutenProductUrl(value);

  if (normalizedDirectUrl) {
    return normalizedDirectUrl;
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();

    if (
      hostname === "hb.afl.rakuten.co.jp" ||
      hostname === "afl.rakuten.co.jp"
    ) {
      const pc = url.searchParams.get("pc");

      if (pc) {
        return normalizeRakutenProductUrl(pc);
      }
    }
  } catch {
    // 旧データから元URLを復元できない場合は空欄にする
  }

  return "";
}

function inferCategoryFromRakuten(params: {
  title?: string | null;
  shopName?: string | null;
  url?: string | null;
}): DealCategory {
  const merged = normalizeText(
    `${params.title ?? ""} ${params.shopName ?? ""} ${params.url ?? ""}`
  );

  const hasAny = (words: string[]) => words.some((w) => merged.includes(w));

  if (
    hasAny([
      "iphone",
      "ipad",
      "applewatch",
      "airpods",
      "macbook",
      "pc",
      "ノートpc",
      "パソコン",
      "モニター",
      "ディスプレイ",
      "キーボード",
      "マウス",
      "イヤホン",
      "ヘッドホン",
      "スマホ",
      "タブレット",
      "ガジェット",
      "ssd",
      "hdd",
      "usb",
      "充電器",
      "モバイルバッテリー",
      "camera",
      "カメラ",
      "switch",
      "playstation",
      "ps5",
      "xbox",
      "テレビ",
      "tv",
      "冷蔵庫",
      "洗濯機",
      "掃除機",
    ])
  ) {
    return "electronics";
  }

  if (
    hasAny([
      "化粧水",
      "乳液",
      "美容液",
      "クリーム",
      "日焼け止め",
      "uv",
      "コスメ",
      "メイク",
      "ファンデ",
      "リップ",
      "口紅",
      "マスカラ",
      "アイシャドウ",
      "チーク",
      "クレンジング",
      "洗顔",
      "シャンプー",
      "トリートメント",
      "ヘアオイル",
      "香水",
      "beauty",
      "cosme",
      "skincare",
    ])
  ) {
    return "beauty";
  }

  if (
    hasAny([
      "収納",
      "キッチン",
      "台所",
      "食器",
      "鍋",
      "フライパン",
      "まな板",
      "タオル",
      "寝具",
      "布団",
      "枕",
      "クッション",
      "インテリア",
      "照明",
      "ライト",
      "洗剤",
      "掃除",
      "日用品",
      "home",
      "家具",
      "ラグ",
      "カーテン",
      "ハンガー",
      "ボックス",
      "水筒",
      "タンブラー",
    ])
  ) {
    return "home";
  }

  if (
    hasAny([
      "レディース",
      "女性",
      "婦人",
      "woman",
      "women",
      "ladies",
      "スカート",
      "ワンピース",
      "ブラウス",
      "パンプス",
      "ヒール",
      "スカンツ",
      "キャミ",
      "チュニック",
      "カーディガン",
      "パンツレディース",
      "レディースファッション",
      "ルームウェア",
      "パジャマ",
    ])
  ) {
    return "fashion_women";
  }

  if (
    hasAny([
      "メンズ",
      "男性",
      "紳士",
      "man",
      "men",
      "mens",
      "shirt",
      "tシャツ",
      "スウェット",
      "パーカー",
      "デニム",
      "スラックス",
      "ジャケット",
      "ブルゾン",
      "革靴",
      "スニーカー",
      "メンズファッション",
    ])
  ) {
    return "fashion_men";
  }

  return "other";
}

function PostPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const editId = searchParams.get("edit");
  const isEditMode = !!editId;

  const [productUrl, setProductUrl] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState<string>("");
  const [origPrice, setOrigPrice] = useState<string>("");
  const [market] = useState<Market>("楽天市場");
  const [shopName, setShopName] = useState("");
  const [dealUrl, setDealUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [comment, setComment] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [category, setCategory] = useState<DealCategory | "">("");
  const [brand, setBrand] = useState("");
  const [freeShipping, setFreeShipping] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const expiresAtPickerRef = useRef<HTMLInputElement>(null);

  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  const [manualMode, setManualMode] = useState(false);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [originalDealUrl, setOriginalDealUrl] = useState("");

  const initialEditSnapshotRef = useRef("");
  const allowEditNavigationRef = useRef(false);

  useEffect(() => {
    if (!editId) return;

    let cancelled = false;

    async function loadDealForEdit() {
      setApiError(null);
      setIsEditLoading(true);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          if (!cancelled) {
            setApiError("編集するにはログインが必要です。");
          }
          return;
        }

        const { data, error } = await supabase
          .from("deals")
          .select(
            "id, user_id, title, price, orig_price, market, shop_name, source_url, deal_url, image_url, comment, item_description, category, brand, free_shipping, expires_at"
          )
          .eq("id", editId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("edit deal load error:", error);
          if (!cancelled) {
            setApiError("ディール情報の読み込みに失敗しました。");
          }
          return;
        }

        if (!data) {
          if (!cancelled) {
            setApiError("このディールを編集する権限がないか、ディールが見つかりません。");
          }
          return;
        }

        if (cancelled) return;

        const loadedSourceUrl =
          data.source_url || recoverDirectRakutenUrl(data.deal_url);

        setProductUrl(loadedSourceUrl);
        setOriginalDealUrl(loadedSourceUrl);
        setTitle(data.title ?? "");
        setPrice(data.price != null ? String(data.price) : "");
        setOrigPrice(data.orig_price != null ? String(data.orig_price) : "");
        setShopName(data.shop_name ?? "");
        setDealUrl(data.deal_url ?? "");
        setImageUrl(data.image_url ?? "");
        setComment(data.comment ?? "");
        setItemDescription(data.item_description ?? "");
        setCategory((data.category as DealCategory) ?? "");
        setBrand(data.brand ?? "");
        setFreeShipping(Boolean(data.free_shipping));
        const loadedExpiresAt = data.expires_at
          ? isoToJapanDateTimeLocal(data.expires_at)
          : "";

        setExpiresAt(loadedExpiresAt);

        initialEditSnapshotRef.current = JSON.stringify({
          productUrl: loadedSourceUrl,
          title: data.title ?? "",
          price: data.price != null ? String(data.price) : "",
          origPrice: data.orig_price != null ? String(data.orig_price) : "",
          shopName: data.shop_name ?? "",
          imageUrl: data.image_url ?? "",
          comment: data.comment ?? "",
          itemDescription: data.item_description ?? "",
          category: (data.category as DealCategory) ?? "other",
          brand: data.brand ?? "",
          freeShipping: Boolean(data.free_shipping),
          expiresAt: loadedExpiresAt,
        });

        allowEditNavigationRef.current = false;
        setManualMode(true);
      } catch (err) {
        console.error("edit deal load unexpected error:", err);
        if (!cancelled) {
          setApiError("ディール情報の読み込み中にエラーが発生しました。");
        }
      } finally {
        if (!cancelled) {
          setIsEditLoading(false);
        }
      }
    }

    loadDealForEdit();

    return () => {
      cancelled = true;
    };
  }, [editId]);

  useEffect(() => {
    if (!isEditMode || !initialEditSnapshotRef.current) return;

    const currentSnapshot = JSON.stringify({
      productUrl,
      title,
      price,
      origPrice,
      shopName,
      imageUrl,
      comment,
      itemDescription,
      category,
      brand,
      freeShipping,
      expiresAt,
    });

    const hasUnsavedChanges =
      currentSnapshot !== initialEditSnapshotRef.current;

    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowEditNavigationRef.current) return;

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [
    isEditMode,
    productUrl,
    title,
    price,
    origPrice,
    shopName,
    imageUrl,
    comment,
    itemDescription,
    category,
    brand,
    freeShipping,
    expiresAt,
  ]);

  async function handleRakutenAutoFill() {
    setApiError(null);

    if (!productUrl) {
      setApiError("まず楽天の商品ページURLを入力してください。");
      return;
    }

    const normalizedProductUrl = normalizeRakutenProductUrl(productUrl);

    if (!normalizedProductUrl) {
      setApiError("楽天の商品ページURLを入力してください。");
      return;
    }

    try {
      setIsLoading(true);
      setManualMode(false);
      setProductUrl(normalizedProductUrl);

      const res = await fetch("/api/rakuten-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalizedProductUrl }),
      });

      const text = await res.text();

      if (!res.ok) {
        console.error("rakuten-preview error body:", text);

        let msg = "楽天商品の自動取得に失敗しました。";
        let code = "";

        try {
          const parsed = JSON.parse(text);
          if (parsed?.error) msg = String(parsed.error);
          if (parsed?.code) code = String(parsed.code);
        } catch {
          // JSON でない場合はそのまま
        }

        if (code === "RAKUTEN_MAINTENANCE") {
          setApiError(msg);
          setManualMode(false);
          return;
        }

        setApiError(
          msg +
            " タイトルや価格・ショップ名は手入力してください。アフィリエイトリンクは投稿時に自動付与されます。"
        );

        setManualMode(true);
        setTitle("");
        setPrice("");
        setOrigPrice("");
        setShopName("");
        setDealUrl("");
        setImageUrl("");
        setItemDescription("");
        setCategory("");
        return;
      }

      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("rakuten-preview json parse error:", e, text);
        setApiError("楽天商品の自動取得に失敗しました。");
        setManualMode(true);
        setCategory("");
        return;
      }

      if (!data || typeof data !== "object") {
        console.error("rakuten-preview invalid data:", data);
        setApiError(
          "楽天APIから無効なデータが返されました。手入力モードに切り替えます。"
        );
        setManualMode(true);
        setCategory("");
        return;
      }

      const nextTitle = data.title ?? "";
      const nextShopName = data.shopName ?? "";
      const nextDealUrl = data.dealUrl ?? data.itemUrl ?? productUrl;
      const nextImageUrl = data.imageUrl ?? "";
      const inferredCategory = inferCategoryFromRakuten({
        title: nextTitle,
        shopName: nextShopName,
        url: productUrl,
      });

      setTitle(nextTitle);
      setPrice(
        data.price != null && !Number.isNaN(Number(data.price))
          ? String(data.price)
          : ""
      );
      setOrigPrice("");
      setShopName(nextShopName);
      setDealUrl(nextDealUrl);
      setImageUrl(nextImageUrl);
      setItemDescription(
        typeof data.itemDescription === "string" ? data.itemDescription.trim() : ""
      );
      setCategory(inferredCategory);

      if (typeof data.freeShipping === "boolean") {
        setFreeShipping(data.freeShipping);
      }

      setManualMode(false);
    } catch (err: any) {
      console.error("rakuten-preview error:", err);
      setApiError(
        "楽天APIとの通信中にエラーが発生しました。時間をおいて再度お試しください。"
      );
    } finally {
      setIsLoading(false);
    }
  }

  function clearValidationErrorIfNeeded() {
    if (!showValidationErrors) return;

    if (
      apiError === "商品ページのURLは必須です。" ||
      apiError === "商品ページのURLの形式が正しくありません。" ||
      apiError === "アフィリエイトURLや短縮URLは使用できません。楽天の元の商品ページURLを入力してください。" ||
      apiError === "楽天の商品ページURLを入力してください。" ||
      apiError === "タイトルは必須です。" ||
      apiError === "価格は必須です。0より大きい金額を入力してください。" ||
      apiError === "コメントは必須です。" ||
      apiError === "カテゴリは必須です。" ||
      apiError === "ショップ名は必須です。"
    ) {
      setApiError(null);
    }
  }

  function focusInvalidField(fieldId: string) {
    requestAnimationFrame(() => {
      const field = document.getElementById(fieldId);

      if (!field) return;

      field.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLTextAreaElement ||
        field instanceof HTMLSelectElement
      ) {
        field.focus({ preventScroll: true });
      }
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError(null);
    setShowValidationErrors(true);

    if (!productUrl.trim()) {
      setApiError("商品ページのURLは必須です。");
      focusInvalidField("deal-product-url");
      return;
    }
    if (!isValidHttpUrl(productUrl)) {
      setApiError("商品ページのURLの形式が正しくありません。");
      focusInvalidField("deal-product-url");
      return;
    }
    if (isRakutenAffiliateOrRedirectUrl(productUrl)) {
      setApiError(
        "アフィリエイトURLや短縮URLは使用できません。楽天の元の商品ページURLを入力してください。"
      );
      focusInvalidField("deal-product-url");
      return;
    }
    if (!isDirectRakutenProductUrl(productUrl)) {
      setApiError("楽天の商品ページURLを入力してください。");
      focusInvalidField("deal-product-url");
      return;
    }
    if (!title.trim()) {
      setApiError("タイトルは必須です。");
      focusInvalidField("deal-title");
      return;
    }
    if (!price.trim() || Number(price) <= 0) {
      setApiError("価格は必須です。0より大きい金額を入力してください。");
      focusInvalidField("deal-price");
      return;
    }
    if (!comment.trim()) {
      setApiError("コメントは必須です。");
      focusInvalidField("deal-comment");
      return;
    }
    if (!category) {
      setApiError("カテゴリは必須です。");
      focusInvalidField("deal-category");
      return;
    }
    if (!shopName.trim()) {
      setApiError("ショップ名は必須です。");
      focusInvalidField("deal-shop-name");
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

      const trimmedProductUrl =
        normalizeRakutenProductUrl(productUrl) || productUrl.trim();
      let finalDealUrl = trimmedProductUrl;

      // 新規投稿・編集を問わず、保存時には必ず トクミッケ の
      // 楽天アフィリエイトURLを再生成する。
      // これにより、過去データで deal_url が通常の商品URLだった場合も修正される。
      const shouldCreateRakutenAffiliateUrl = true;

      if (shouldCreateRakutenAffiliateUrl) {
        try {
          const res = await fetch("/api/rakuten-affiliate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: trimmedProductUrl }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.affiliateUrl) {
              finalDealUrl = data.affiliateUrl;
            } else {
              setApiError(
                "アフィリエイトURLの生成に失敗しました。アフィリエイト設定をご確認ください。"
              );
              return;
            }
          } else {
            const text = await res.text();
            console.error("rakuten-affiliate error body:", text);

            let msg = "アフィリエイトURLの生成に失敗しました。";
            try {
              const parsed = JSON.parse(text);
              if (parsed?.error) msg = String(parsed.error);
            } catch {
              // JSON でない場合はそのまま
            }

            setApiError(
              msg + " アフィリエイトIDが正しく設定されているかご確認ください。"
            );
            return;
          }
        } catch (err) {
          console.error("rakuten-affiliate error:", err);
          setApiError(
            "アフィリエイトURLの生成中に予期せぬエラーが発生しました。時間をおいて再度お試しください。"
          );
          return;
        }
      }

      const payload = {
        title,
        price: price ? Number(price) : null,
        orig_price: origPrice ? Number(origPrice) : null,
        market: market || null,
        shop_name: shopName || null,
        source_url: trimmedProductUrl,
        deal_url: finalDealUrl,
        image_url: imageUrl || null,
        comment: comment || null,
        item_description: itemDescription || null,
        category,
        brand: brand.trim() || null,
        free_shipping: freeShipping,
        expires_at: expiresAt ? japanDateTimeLocalToIso(expiresAt) : null,
      };

      if (isEditMode && editId) {
        const { error } = await supabase
          .from("deals")
          .update(payload)
          .eq("id", editId)
          .eq("user_id", user.id);

        if (error) {
          console.error("update error:", error);
          setApiError("ディールの更新に失敗しました。時間をおいて再度お試しください。");
          return;
        }

        allowEditNavigationRef.current = true;
        router.push("/mypage?tab=deals&updated=1");
        return;
      }

      const { data: createdDeal, error } = await supabase
        .from("deals")
        .insert({
          user_id: user.id,
          ...payload,
          likes_count: 0,
          comments_count: 0,
        })
        .select("id")
        .single();

      if (error || !createdDeal?.id) {
        console.error("insert error:", error);
        setApiError("投稿の保存に失敗しました。時間をおいて再度お試しください。");
        return;
      }

      router.push(`/deals/${createdDeal.id}`);
    } catch (err) {
      console.error(err);
      setApiError("予期せぬエラーが発生しました。");
    } finally {
      setIsLoading(false);
    }
  }

  const placeholderClass = "placeholder:text-slate-400";
  const readOnlyBg = "bg-slate-100";
  const autoDisabled = !manualMode;

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <main className="mx-auto max-w-3xl px-0 py-0 sm:px-4 sm:py-8">
        <h1 className="hidden sm:mb-4 sm:block sm:text-2xl sm:font-bold sm:text-[#001e43]">
          {isEditMode ? "ディールを編集する" : "ディールを投稿する"}
        </h1>

        {apiError && (
          <div className="mx-4 mt-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 sm:mx-0 sm:mt-0 sm:mb-4">
            {apiError}
          </div>
        )}

        {isEditLoading && (
          <div className="mx-4 mt-4 rounded border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600 sm:mx-0 sm:mt-0 sm:mb-4">
            編集するディールを読み込んでいます...
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-5 bg-white px-4 py-5 sm:space-y-6 sm:rounded-lg sm:p-5 sm:shadow-md sm:ring-1 sm:ring-slate-200"
        >
          <div className="sm:hidden">
            <p className="text-[13px] leading-5 text-slate-500">
              {isEditMode
                ? "投稿したディールの内容を編集できます。"
                : "商品URLを入力してディール情報を追加してください。"}
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800">
              商品ページのURL <span className="text-red-500">*</span>
            </label>

            <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:gap-2">
              <input
                id="deal-product-url"
                type="url"
                className={`h-12 w-full rounded-md border px-3 text-[15px] text-slate-900 ${placeholderClass} ${
                  showValidationErrors &&
                  (!productUrl.trim() ||
                    !isValidHttpUrl(productUrl) ||
                    !isDirectRakutenProductUrl(productUrl))
                    ? "border-red-500 bg-red-50/30"
                    : "border-slate-300"
                } focus:border-[#001e43] focus:outline-none focus:ring-1 focus:ring-[#001e43] sm:h-auto sm:flex-1 sm:rounded sm:py-2 sm:text-sm`}
                placeholder="https://item.rakuten.co.jp/ショップ名/商品コード/"
                value={productUrl}
                onChange={(e) => {
                  const nextUrl = e.target.value;
                  setProductUrl(nextUrl);
                  clearValidationErrorIfNeeded();

                  if (isEditMode && nextUrl.trim() !== originalDealUrl.trim()) {
                    setDealUrl("");
                  }
                }}
              />

              <button
                type="button"
                onClick={handleRakutenAutoFill}
                disabled={isLoading || isEditLoading}
                className="h-11 w-full rounded-md bg-[#001e43] px-4 text-sm font-semibold text-white hover:bg-[#002b66] disabled:opacity-60 sm:h-auto sm:w-auto sm:whitespace-nowrap sm:rounded sm:px-3 sm:py-2 sm:text-xs cursor-pointer"
              >
                楽天から自動入力
              </button>
            </div>

            {showValidationErrors && !productUrl.trim() ? (
              <p className="mt-1 text-xs font-medium text-red-600">
                商品ページURLを入力してください。
              </p>
            ) : showValidationErrors && !isValidHttpUrl(productUrl) ? (
              <p className="mt-1 text-xs font-medium text-red-600">
                http:// または https:// から始まる正しいURLを入力してください。
              </p>
            ) : showValidationErrors &&
              isRakutenAffiliateOrRedirectUrl(productUrl) ? (
              <p className="mt-1 text-xs font-medium text-red-600">
                アフィリエイトURLや短縮URLではなく、楽天の元の商品ページURLを入力してください。
              </p>
            ) : showValidationErrors &&
              !isDirectRakutenProductUrl(productUrl) ? (
              <p className="mt-1 text-xs font-medium text-red-600">
                楽天の商品ページURLを入力してください。
              </p>
            ) : null}

            <p className="mt-1.5 hidden text-xs leading-5 text-slate-600 sm:block">
              {isEditMode
                ? "ここには元の商品ページURLを保存します。更新時にはトクミッケのアフィリエイトURLを再生成します。"
                : "楽天の商品ページURLをそのまま貼り付けてください。末尾に ?eid= などのパラメータが付いていても使用できます。トクミッケ側で正規の商品URLに整えます。アフィリエイトURLや短縮URLは使用できません。"}
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800">
              タイトル <span className="text-red-500">*</span>
            </label>
            <input
              id="deal-title"
              type="text"
              className={`mt-1.5 h-12 w-full rounded-md border px-3 text-[15px] text-slate-900 ${placeholderClass} ${
                showValidationErrors && !title.trim()
                  ? "border-red-500 bg-red-50/30"
                  : "border-slate-300"
              } ${
                autoDisabled ? readOnlyBg : ""
              } focus:border-[#001e43] focus:outline-none focus:ring-1 focus:ring-[#001e43] sm:h-auto sm:rounded sm:py-2 sm:text-sm`}
              placeholder="楽天から自動入力されます"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                clearValidationErrorIfNeeded();
              }}
              disabled={autoDisabled}
            />
            {showValidationErrors && !title.trim() ? (
              <p className="mt-1 text-xs font-medium text-red-600">
                タイトルを入力してください。
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-800">
                価格 <span className="text-red-500">*</span>
              </label>
              <div
                className={`mt-1.5 flex h-12 items-center overflow-hidden rounded-md border sm:h-auto sm:rounded ${
                  showValidationErrors &&
                  (!price.trim() || Number(price) <= 0)
                    ? "border-red-500 bg-red-50/30"
                    : "border-slate-300"
                }`}
              >
                <span className="flex h-full items-center border-r border-slate-300 px-3 text-sm text-slate-500">
                  ¥
                </span>
                <input
                  id="deal-price"
                  type="number"
                  className={`min-w-0 flex-1 border-0 px-3 text-[15px] text-slate-900 ${placeholderClass} ${
                    autoDisabled ? readOnlyBg : ""
                  } focus:outline-none sm:py-2 sm:text-sm`}
                  placeholder="0"
                  value={price}
                  min="1"
                  required
                  onChange={(e) => {
                    setPrice(e.target.value);
                    clearValidationErrorIfNeeded();
                  }}
                  disabled={autoDisabled}
                />
              </div>
              {showValidationErrors &&
              (!price.trim() || Number(price) <= 0) ? (
                <p className="mt-1 text-xs font-medium text-red-600">
                  価格を入力してください。
                </p>
              ) : null}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800">
                元値
              </label>
              <div className="mt-1.5 flex h-12 items-center overflow-hidden rounded-md border border-slate-300 sm:h-auto sm:rounded">
                <span className="flex h-full items-center border-r border-slate-300 px-3 text-sm text-slate-500">
                  ¥
                </span>
                <input
                  type="number"
                  className={`min-w-0 flex-1 border-0 px-3 text-[15px] text-slate-900 ${placeholderClass} ${
                    autoDisabled ? readOnlyBg : ""
                  } focus:outline-none sm:py-2 sm:text-sm`}
                  placeholder="0"
                  value={origPrice}
                  onChange={(e) => setOrigPrice(e.target.value)}
                  disabled={autoDisabled}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800">
              コメント <span className="text-red-500">*</span>
            </label>
            <textarea
              id="deal-comment"
              className={`mt-1.5 min-h-[122px] w-full rounded-md border px-3 py-3 text-[15px] text-slate-900 ${placeholderClass} ${
                showValidationErrors && !comment.trim()
                  ? "border-red-500 bg-red-50/30"
                  : "border-slate-300"
              } focus:border-[#001e43] focus:outline-none focus:ring-1 focus:ring-[#001e43] sm:rounded sm:text-sm`}
              rows={5}
              placeholder="価格情報、クーポン、サイズ感、注意点などを入力してください。"
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                clearValidationErrorIfNeeded();
              }}
            />
            {showValidationErrors && !comment.trim() ? (
              <p className="mt-1 text-xs font-medium text-red-600">
                コメントを入力してください。
              </p>
            ) : null}
          </div>

          <div>
              <label className="mb-1 block text-sm font-semibold text-slate-900">
                商品詳細
              </label>
              <textarea
                rows={6}
                value={itemDescription}
                placeholder="楽天から自動取得した商品説明がここに入ります"
                disabled
                className="w-full resize-none rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm leading-6 text-slate-600 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-100"
              />
              <p className="mt-1 text-xs text-slate-500">
                商品詳細は楽天から自動取得されます。手動入力・編集はできません。
              </p>
            </div>

            <div>
            <label className="block text-sm font-semibold text-slate-800">
              カテゴリ <span className="text-red-500">*</span>
            </label>
            <select
              id="deal-category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as DealCategory | "");
                clearValidationErrorIfNeeded();
              }}
              className={`mt-1.5 h-12 w-full rounded-md border px-3 text-[15px] text-slate-900 focus:border-[#001e43] focus:outline-none focus:ring-1 focus:ring-[#001e43] sm:h-auto sm:rounded sm:py-2 sm:text-sm ${
                showValidationErrors && !category
                  ? "border-red-500 bg-red-50/30"
                  : "border-slate-300 bg-white"
              }`}
            >
              <option value="" disabled>
                カテゴリを選択してください
              </option>
              <option value="fashion_women">レディースファッション</option>
              <option value="fashion_men">メンズファッション</option>
              <option value="beauty">ビューティー</option>
              <option value="home">日用品・ホーム</option>
              <option value="electronics">家電・ガジェット</option>
              <option value="other">その他</option>
            </select>
            {showValidationErrors && !category ? (
              <p className="mt-1 text-xs font-medium text-red-600">
                カテゴリを選択してください。
              </p>
            ) : null}
            <p className="mt-1 hidden text-xs text-slate-600 sm:block">
              楽天から自動入力した場合は、商品名などをもとに自動でカテゴリを推定します。
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-800">
                ショップ名 <span className="text-red-500">*</span>
              </label>
              <input
                id="deal-shop-name"
                type="text"
                className={`mt-1.5 h-12 w-full rounded-md border px-3 text-[15px] text-slate-900 ${placeholderClass} ${
                  showValidationErrors && !shopName.trim()
                    ? "border-red-500 bg-red-50/30"
                    : "border-slate-300"
                } ${
                  autoDisabled ? readOnlyBg : ""
                } focus:border-[#001e43] focus:outline-none focus:ring-1 focus:ring-[#001e43] sm:h-auto sm:rounded sm:py-2 sm:text-sm`}
                placeholder="楽天から自動入力されます"
                value={shopName}
                onChange={(e) => {
                  setShopName(e.target.value);
                  clearValidationErrorIfNeeded();
                }}
                disabled={autoDisabled}
              />
              {showValidationErrors && !shopName.trim() ? (
                <p className="mt-1 text-xs font-medium text-red-600">
                  ショップ名を入力してください。
                </p>
              ) : null}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800">
                ブランド
              </label>
              <input
                type="text"
                className={`mt-1.5 h-12 w-full rounded-md border border-slate-300 px-3 text-[15px] text-slate-900 ${placeholderClass} focus:border-[#001e43] focus:outline-none focus:ring-1 focus:ring-[#001e43] sm:h-auto sm:rounded sm:py-2 sm:text-sm`}
                placeholder="例：Nike、Apple、無印良品"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-800">
                モール
              </label>
              <select
                className={`mt-1.5 h-12 w-full rounded-md border border-slate-300 px-3 text-[15px] text-slate-900 ${placeholderClass} ${readOnlyBg} sm:h-auto sm:rounded sm:py-2 sm:text-sm`}
                value={market}
                disabled
              >
                <option value="楽天市場">楽天市場</option>
                <option value="Yahoo!ショッピング">Yahoo!ショッピング</option>
                <option value="ZOZOTOWN">ZOZOTOWN</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800">
                有効期限
              </label>
              <div className="relative mt-1.5">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="例：2026/09/19 23:59"
                  className="h-12 w-full rounded-md border border-slate-300 bg-white px-3 pr-12 text-[15px] text-slate-900 focus:border-[#001e43] focus:outline-none focus:ring-1 focus:ring-[#001e43] sm:h-auto sm:rounded sm:py-2 sm:text-sm"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
                <button
                  type="button"
                  aria-label="日時を選択"
                  title="日時を選択"
                  onClick={() => {
                    const picker = expiresAtPickerRef.current;
                    if (!picker) return;
                    picker.value = displayValueToPicker(expiresAt);
                    picker.showPicker?.();
                  }}
                  className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center text-slate-700 hover:text-[#006888]"
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-5 w-5 fill-none stroke-current"
                  >
                    <path
                      d="M7 3v3M17 3v3M4.5 8.5h15M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <input
                  ref={expiresAtPickerRef}
                  type="datetime-local"
                  lang="ja-JP"
                  tabIndex={-1}
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0 right-0 h-px w-px opacity-0"
                  onChange={(e) => {
                    const display = pickerValueToDisplay(e.target.value);
                    if (display) setExpiresAt(display);
                  }}
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                セール終了日時が分かる場合のみ（日本時間）
              </p>
            </div>
          </div>

          <div>
            <label className="flex cursor-pointer items-center gap-3 border-y border-slate-200 py-4 sm:rounded sm:border sm:border-slate-300 sm:px-3 sm:py-3">
              <input
                type="checkbox"
                checked={freeShipping}
                onChange={(e) => setFreeShipping(e.target.checked)}
                className="h-4 w-4 accent-[#001e43]"
              />
              <span className="text-sm font-semibold text-slate-800">
                送料無料
              </span>
            </label>
          </div>

          <div className="hidden sm:block">
            <label className="block text-sm font-semibold text-slate-800">
              ディールのリンク先URL
            </label>
            <input
              type="url"
              className={`mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 ${placeholderClass} ${readOnlyBg}`}
              placeholder="楽天APIから生成されたリンクが自動で入ります。編集はできません。"
              value={dealUrl}
              disabled
            />
            <p className="mt-1 text-xs text-slate-600">
              {isEditMode
                ? "現在保存されているトクミッケのアフィリエイトリンクです。更新時に再生成されます。"
                : "投稿時に、楽天アフィリエイトAPIでトクミッケのアフィリエイトURLへ自動変換されます。"}
            </p>
          </div>

          <div className="hidden sm:block">
            <label className="block text-sm font-semibold text-slate-800">
              商品画像URL
            </label>
            <input
              type="url"
              className={`mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 ${placeholderClass} ${readOnlyBg}`}
              placeholder="楽天APIから自動で入ります。編集はできません。"
              value={imageUrl}
              disabled
            />
          </div>

          <div className="pt-1 sm:pt-2">
            {isEditMode ? (
              <button
                type="button"
                onClick={() => {
                  const confirmed = window.confirm(
                    "編集中ですが、本当にキャンセルしますか？"
                  );

                  if (confirmed) {
                    allowEditNavigationRef.current = true;
                    router.push("/mypage?tab=deals");
                  }
                }}
                disabled={isLoading || isEditLoading}
                className="mb-2 inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-md border border-slate-300 bg-white px-5 text-[15px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:mb-0 sm:mr-2 sm:h-auto sm:w-auto sm:rounded sm:py-2 sm:text-sm"
              >
                キャンセル
              </button>
            ) : null}

            <button
              type="submit"
              disabled={isLoading || isEditLoading}
              className="inline-flex h-12 w-full items-center justify-center rounded-md bg-[#001e43] px-5 text-[15px] font-semibold text-white hover:bg-[#002b66] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 sm:h-auto sm:w-auto sm:rounded sm:py-2 sm:text-sm"
            >
              {isLoading
                ? isEditMode
                  ? "更新中..."
                  : "送信中..."
                : isEditMode
                  ? "この内容で更新する"
                  : "この内容で投稿する"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default function PostPage() {
  return (
    <Suspense fallback={null}>
      <PostPageContent />
    </Suspense>
  );
}
