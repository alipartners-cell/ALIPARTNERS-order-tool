"use client";

export default function TopTabs({
  viewMode,
  onChange,
}: {
  viewMode: "table" | "calendar" | "master" | "apStock" | "purchase";
  onChange: (next: "table" | "calendar" | "master" | "apStock" | "purchase") => void;
}) {
  const tabs: { label: string; value: "table" | "calendar" | "master" | "apStock" | "purchase" }[] = [
    { label: "販売管理", value: "table" },
    { label: "発注管理", value: "purchase" },
    { label: "発注計画カレンダー", value: "calendar" },
    { label: "商品マスタ", value: "master" },
    { label: "AP在庫", value: "apStock" },
  ];

  return (
    <nav className="shrink-0 border-b border-gray-200 bg-white px-6 py-2">
      <div className="flex w-fit rounded-xl bg-gray-100 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
              viewMode === tab.value
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
