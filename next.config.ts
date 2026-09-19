// next.config.ts

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // 楽天アフィリエイト画像URL（表示用）
      {
        protocol: "https",
        hostname: "hbb.afl.rakuten.co.jp",
      },
      // リンク先（クリック用）が hb.afl を使う場合に備えて
      {
        protocol: "https",
        hostname: "hb.afl.rakuten.co.jp",
      },
      // アバターなど（必要なければ削除OK）
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      // ✅ 追加：Outfit Deals ロゴ用
      {
        protocol: "https",
        hostname: "outfitdeals.vercel.app",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
