"use client";

type Props = {
  visibleSkus: string[];
  totalVisibleCount: number;
  shownCount: number;
  displayLimit: number;
  onDisplayLimitChange: (next: number) => void;
  allChecked: boolean;
  someChecked: boolean;
  onToggleAll: (skus: string[]) => void;
  sortType: "fba" | "rsl";
  onSortTypeChange: (next: "fba" | "rsl") => void;
  filterDeliveryOnly: boolean;
  onToggleDeliveryFilter: () => void;
  expandedCount: number;
  onExpandAll: () => void;
  onCollapseAll: () => void;
};

export default function TableOperationBar({
  visibleSkus,
  totalVisibleCount,
  shownCount,
  displayLimit,
  onDisplayLimitChange,
  allChecked,
  someChecked,
  onToggleAll,
  sortType,
  onSortTypeChange,
  filterDeliveryOnly,
  onToggleDeliveryFilter,
  expandedCount,
  onExpandAll,
  onCollapseAll,
}: Props) {
  return (
    <div className="shrink-0 border-b border-gray-200 bg-gray-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
          <input
            type="checkbox"
            checked={allChecked}
            ref={(el) => {
              if (el) el.indeterminate = !allChecked && someChecked;
            }}
            onChange={() =>
              allChecked ? onToggleAll([]) : onToggleAll(visibleSkus)
            }
          />
          表示中の商品を選択
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-500">
            並び替え
            <select
              value={sortType}
              onChange={(e) => onSortTypeChange(e.target.value as "fba" | "rsl")}
              className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-bold text-gray-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="fba">FBA納品数 多い順</option>
              <option value="rsl">RSL納品数 多い順</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs font-bold text-gray-500">
            表示件数
            <select
              value={
                displayLimit >= totalVisibleCount && totalVisibleCount > 0
                  ? "all"
                  : String(displayLimit)
              }
              onChange={(e) => {
                const value = e.target.value;
                onDisplayLimitChange(
                  value === "all" ? Math.max(totalVisibleCount, 100) : Number(value)
                );
              }}
              className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-bold text-gray-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="100">100件</option>
              <option value="300">300件</option>
              <option value="1000">1000件</option>
              <option value="all">全件</option>
            </select>
          </label>

          <span className="text-xs font-semibold text-gray-500">
            {shownCount.toLocaleString()}/{totalVisibleCount.toLocaleString()}件表示
          </span>

          <button
            type="button"
            onClick={onToggleDeliveryFilter}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              filterDeliveryOnly
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}
          >
            納品推奨のみ
          </button>

          <button
            type="button"
            onClick={onExpandAll}
            disabled={visibleSkus.length === 0}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            すべて詳細を表示
          </button>

          <button
            type="button"
            onClick={onCollapseAll}
            disabled={expandedCount === 0}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            すべて閉じる
          </button>

          <div className="ml-1 text-xs text-gray-500">
            必要在庫は日販×総LTで自動計算します。
          </div>
        </div>
      </div>
    </div>
  );
}
