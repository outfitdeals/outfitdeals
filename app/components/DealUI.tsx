// app/components/DealUI.tsx
"use client";

export function yen(n: number | null | undefined) {
  if (n == null) return "";
  return `${Number(n).toLocaleString("ja-JP")}円`;
}

export function MarketTag({ market }: { market: string }) {
  const isRakuten = market === "楽天市場";

  if (isRakuten) {
    return (
      <span className="inline-flex items-center">
        <img
          src="/rakuten.png"
          alt="楽天市場"
          className="h-4 w-auto object-contain"
        />
      </span>
    );
  }

  const base =
    market === "Yahoo!ショッピング"
      ? { border: "#6c2735", text: "#6c2735", bg: "#f8eff1" }
      : { border: "#00533f", text: "#00533f", bg: "#e9f2ef" };

  return (
    <span
      style={{
        borderColor: base.border,
        color: base.text,
        backgroundColor: base.bg,
      }}
      className="inline-flex items-center px-1 py-[1px] text-[10px] font-medium border rounded-none"
    >
      {market}
    </span>
  );
}