export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white text-center p-6">
      <h1 className="text-4xl font-bold text-[#003366] mb-4">
        Outfit Deals（アウトフィットディールズ）
      </h1>
      <p className="text-lg text-[#004d40] mb-8">
        ファッション好きのためのディール共有コミュニティ。<br />
        楽天・Yahoo!ショッピングのセール情報を中心にお届けします。
      </p>
      <div className="border border-[#004d40] rounded-xl px-6 py-4 shadow-md">
        <p className="text-xl text-[#003366] font-semibold">🔧 サイト改装中</p>
        <p className="text-[#004d40] mt-2">まもなくオープン予定です。お楽しみに！</p>
      </div>
      <p className="mt-2 text-sm text-gray-500">Last deployed: {new Date().toLocaleString()}</p>
    </main>
  );
}

