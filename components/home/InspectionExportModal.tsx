"use client";

import type { ComputedSkuRow, ProductMasterItem } from "@/types";
import {
  INSPECTION_ITEMS,
  type InspectionItem,
  type InspectionSelections,
} from "@/lib/csv";

export default function InspectionExportModal({
  open,
  rows,
  selections,
  onChange,
  orderQty,
  onOrderQtyChange,
  productMasters,
  onClose,
  onConfirm,
}: {
  open: boolean;
  rows: ComputedSkuRow[];
  selections: InspectionSelections;
  onChange: (next: InspectionSelections) => void;
  orderQty: Record<string, number>;
  onOrderQtyChange: (next: Record<string, number>) => void;
  productMasters: Record<string, ProductMasterItem>;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  const toggleItem = (sku: string, item: InspectionItem) => {
    const current = selections[sku] ?? [];
    const nextItems = current.includes(item)
      ? current.filter((v) => v !== item)
      : [...current, item];

    onChange({
      ...selections,
      [sku]: nextItems,
    });
  };

  const setAllForItem = (item: InspectionItem, checked: boolean) => {
    const next: InspectionSelections = { ...selections };
    rows.forEach((row) => {
      const current = next[row.sku] ?? [];
      next[row.sku] = checked
        ? Array.from(new Set([...current, item]))
        : current.filter((v) => v !== item);
    });
    onChange(next);
  };


  const setOrderQtyForRow = (sku: string, value: string) => {
    const numericValue = Number(value);
    onOrderQtyChange({
      ...orderQty,
      [sku]: Number.isFinite(numericValue)
        ? Math.max(0, Math.floor(numericValue))
        : 0,
    });
  };

  const allCheckedForItem = (item: InspectionItem) =>
    rows.length > 0 &&
    rows.every((row) => (selections[row.sku] ?? []).includes(item));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              検品項目を選択してCSV出力
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              選択した検品項目は、発注CSVの各SKU行に反映されます。
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            閉じる
          </button>
        </div>

        <div className="overflow-auto p-6">
          {rows.length === 0 ? (
            <p className="text-sm text-gray-500">選択中のSKUがありません。</p>
          ) : (
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="px-3 py-3">画像</th>
                  <th className="px-3 py-3">SKU</th>
                  <th className="px-3 py-3">商品名</th>
                  <th className="px-3 py-3 text-right">発注数（個・バラ）</th>
                  {INSPECTION_ITEMS.map((item) => (
                    <th key={item} className="px-3 py-3 text-center">
                      <label className="flex cursor-pointer flex-col items-center gap-1">
                        <input
                          type="checkbox"
                          checked={allCheckedForItem(item)}
                          onChange={(e) =>
                            setAllForItem(item, e.target.checked)
                          }
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                        />
                        <span className="whitespace-nowrap">{item}</span>
                      </label>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => {
                  const selectedItems = selections[row.sku] ?? [];

                  return (
                    <tr
                      key={row.sku}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-3 py-3">
                        {productMasters[row.sku]?.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={productMasters[row.sku].image_url} alt="" className="h-12 w-12 rounded-lg border border-gray-200 object-cover" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-gray-300 text-[10px] text-gray-400">no image</div>
                        )}
                      </td>
                      <td className="px-3 py-3 font-mono font-bold text-gray-900">
                        {row.sku}
                        <button
                          type="button"
                          onClick={() =>
                            onChange({
                              ...selections,
                              [row.sku]: (productMasters[row.sku]?.default_inspection_items ?? []).filter((item): item is InspectionItem =>
                                (INSPECTION_ITEMS as readonly string[]).includes(item)
                              ),
                            })
                          }
                          className="mt-1 block rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] font-bold text-gray-600 hover:bg-gray-100"
                        >
                          マスタ検品を反映
                        </button>
                      </td>
                      <td className="max-w-[260px] truncate px-3 py-3 text-gray-700">
                        {row.product_name}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={orderQty[row.sku] ?? row.recommended_order_qty}
                          onChange={(e) => setOrderQtyForRow(row.sku, e.target.value)}
                          className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-right font-bold text-red-600 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        />
                      </td>
                      {INSPECTION_ITEMS.map((item) => (
                        <td key={item} className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedItems.includes(item)}
                            onChange={() => toggleItem(row.sku, item)}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-4">
          <p className="text-xs text-gray-500">
            発注数は個（バラ）単位です。この画面で任意変更できます。CSVには inspection_items と各検品項目の列が追加されます。
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100"
            >
              キャンセル
            </button>
            <button
              onClick={onConfirm}
              disabled={rows.length === 0}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              この内容でCSVダウンロード
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
