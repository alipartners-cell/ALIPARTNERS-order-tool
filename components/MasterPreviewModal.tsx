"use client";

import type { ComputedSkuRow, ProductMasterItem } from "@/types";

function getUnitPerSet(row: ComputedSkuRow, master?: ProductMasterItem) {
  const raw =
    (row as unknown as { unit_per_set?: unknown }).unit_per_set ??
    (master as unknown as { unit_per_set?: unknown } | undefined)?.unit_per_set ??
    1;

  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function deliveryUnit(unitPerSet: number) {
  return unitPerSet > 1 ? "セット" : "個";
}

function setDescription(unitPerSet: number) {
  return unitPerSet > 1 ? `1セット=${unitPerSet}個` : "";
}

export default function MasterPreviewModal({ row, master, onClose, onOpenMaster }: { row: ComputedSkuRow; master?: ProductMasterItem; onClose: () => void; onOpenMaster?: (sku: string) => void }) {
  const productUrl = master?.product_url || "";
  const unitPerSet = getUnitPerSet(row, master);
  const deliveryUnitLabel = deliveryUnit(unitPerSet);
  const deliverySubLabel = setDescription(unitPerSet);
  const chinaOrderQtyBara = Math.max(0, Number(row.recommended_order_qty || 0));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">商品マスタ情報</h2>
            <p className="mt-1 text-xs text-gray-500">一覧からマスタ情報を確認しています。</p>
          </div>
          <button onClick={onClose} className="rounded-lg px-3 py-1 text-sm font-bold text-gray-500 hover:bg-gray-100">✕</button>
        </div>
        <div className="flex gap-4">
          {master?.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={master.image_url} alt="" className="h-24 w-24 rounded-xl border border-gray-200 object-cover" />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-dashed border-gray-300 text-xs text-gray-400">no image</div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-base font-bold text-gray-900">{master?.product_name || row.product_name || "商品名未設定"}</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
              <PreviewInfo label="SKU" value={row.sku} />
              <PreviewInfo label="JAN" value={master?.jan || row.jan || "-"} />
              <PreviewInfo label="ASIN" value={(master as any)?.asin || "-"} />
              <PreviewInfo label="仕入単価" value={`${Number(master?.cost_rmb || 0).toLocaleString()}元`} />
              <PreviewInfo label="色" value={master?.color || "-"} />
              <PreviewInfo label="サイズ" value={master?.size || "-"} />
              <PreviewInfo label="MOQ" value={Number(master?.moq || row.moq || 0).toLocaleString()} />
              <PreviewInfo label="FBA推奨納品数" value={`${row.fba_recommended_delivery_qty.toLocaleString()} ${deliveryUnitLabel}${deliverySubLabel ? `（${deliverySubLabel}）` : ""}`} />
              <PreviewInfo label="RSL推奨納品数" value={`${row.rsl_recommended_delivery_qty.toLocaleString()} ${deliveryUnitLabel}${deliverySubLabel ? `（${deliverySubLabel}）` : ""}`} />
              <PreviewInfo label="中国発注数" value={`${chinaOrderQtyBara.toLocaleString()} 個（バラ）`} />
            </div>
            <div className="mt-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
              <div className="font-bold text-gray-500">検品項目</div>
              <div className="mt-1">{master?.default_inspection_items?.length ? master.default_inspection_items.join(" / ") : "-"}</div>
            </div>
            <div className="mt-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
              <div className="font-bold text-gray-500">備考</div>
              <div className="mt-1 whitespace-pre-wrap">{master?.memo || "-"}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {onOpenMaster && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenMaster(row.sku);
                  }}
                  className="inline-flex rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white hover:bg-gray-700"
                >
                  商品マスタで編集
                </button>
              )}
              {productUrl && (
                <a href={productUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-500">1688URLを開く</a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-2.5 py-2">
      <div className="text-[10px] font-bold text-gray-400">{label}</div>
      <div className="mt-0.5 truncate font-bold text-gray-700">{value}</div>
    </div>
  );
}
