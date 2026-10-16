// app/components/DealUI.tsx
"use client";

export function yen(n: number | null | undefined) {
  if (n == null) return "";
  return `${Number(n).toLocaleString("ja-JP")}円`;
}

export function MarketTag({ market }: { market: string }) {
  const isRakuten = market === "楽天市場";
  const isAmazon = market === "Amazon";
  const isYahoo = market === "Yahoo!ショッピング";

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

  if (isAmazon) {
    return (
      <span
        aria-label="Amazon"
        title="Amazon"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-black text-[12px] font-bold leading-none text-[#ff9900]"
      >
        a
      </span>
    );
  }

  if (isYahoo) {
    return (
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center" title="Yahoo!ショッピング">
        <img
          src="/yahoo-market.svg"
          alt="Yahoo!ショッピング"
          width={16}
          height={16}
          className="block h-4 w-4 shrink-0 object-contain"
        />
      </span>
    );
  }

  const base = { border: "#00533f", text: "#00533f", bg: "#e9f2ef" };

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
