"use client";

import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ProductMasterItem, PurchaseSkuItem } from "@/types";
import type {
  PurchaseBreakdownRow,
  PurchaseSkuSummaryRow,
} from "@/lib/purchaseEngine";

type Props = {
  purchaseSkus: PurchaseSkuItem[];
  setPurchaseSkus: Dispatch<SetStateAction<PurchaseSkuItem[]>>;
  purchaseBreakdownRows: PurchaseBreakdownRow[];
  purchaseSkuSummaryRows: PurchaseSkuSummaryRow[];
  manualPurchaseOrders: Record<string, number>;
  setManualPurchaseOrders: Dispatch<SetStateAction<Record<string, number>>>;
  onOpenMaster?: (sku: string) => void;
  productMasters?: Record<string, ProductMasterItem>;
};

const EMPTY_PURCHASE_SKU_FORM: PurchaseSkuItem = {
  purchase_sku: "",
  parent_jan: "",
  color: "",
  size: "",
  ap_stock: 0,
  moq: 0,
  order_unit: 0,
  recommended_order_qty: 0,
  url_1688: "",
  enabled: true,
} as PurchaseSkuItem;

function getText(value: unknown) {
  return String(value ?? "").trim();
}

function getNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function getFormNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function escapeCsvValue(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function downloadTextFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}


function formatQty(value: number) {
  return Number(value || 0).toLocaleString();
}


type PurchasePreviewState = {
  masterSku: string;
  purchaseSku: string;
  displayJan: string;
  productName: string;
  imageUrl: string;
  color: string;
  size: string;
  url1688: string;
  chinaOrderQty: number;
  moq: number;
  orderUnit: number;
};

function PreviewBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 px-4 py-3">
      <div className="text-xs font-black text-gray-400">{label}</div>
      <div className="mt-1 truncate text-sm font-black text-gray-700">{value}</div>
    </div>
  );
}

function PurchaseMasterPreviewModal({
  item,
  master,
  onClose,
  onOpenMaster,
}: {
  item: PurchasePreviewState;
  master?: ProductMasterItem;
  onClose: () => void;
  onOpenMaster?: (sku: string) => void;
}) {
  const masterAny = master as any;
  const imageUrl = item.imageUrl || String(masterAny?.image_url ?? masterAny?.imageUrl ?? "");
  const productName = item.productName || String(masterAny?.product_name ?? masterAny?.商品名 ?? "商品名未設定");
  const sku = item.masterSku || item.purchaseSku || String(masterAny?.sku ?? "");
  const jan = item.displayJan || String(masterAny?.jan ?? "");
  const asin = String(masterAny?.asin ?? "");
  const cost = Number(masterAny?.cost_yen ?? masterAny?.purchase_price_yen ?? masterAny?.仕入単価 ?? 0) || 0;
  const color = item.color || String(masterAny?.color ?? "");
  const size = item.size || String(masterAny?.size ?? "");
  const url1688 = item.url1688 || String(masterAny?.url_1688 ?? masterAny?.supplier_url ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-gray-900">商品マスタ情報</h2>
            <p className="mt-1 text-sm font-semibold text-gray-500">発注管理からマスタ情報を確認しています。</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-2xl font-bold text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-5 md:flex-row">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-28 w-28 rounded-2xl border border-gray-200 object-cover" />
          ) : (
            <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border border-dashed border-gray-300 text-xs font-bold text-gray-400">
              no image
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-black leading-relaxed text-gray-900">{productName}</h3>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <PreviewBox label="SKU" value={sku || "-"} />
              <PreviewBox label="JAN" value={jan || "-"} />
              <PreviewBox label="ASIN" value={asin || "-"} />
              <PreviewBox label="仕入単価" value={`${cost.toLocaleString()}元`} />
              <PreviewBox label="色" value={color || "-"} />
              <PreviewBox label="サイズ" value={size || "-"} />
              <PreviewBox label="中国発注数" value={`${formatQty(item.chinaOrderQty)}個`} />
              <PreviewBox label="MOQ" value={`${formatQty(item.moq)}個`} />
              <PreviewBox label="発注単位" value={`${formatQty(item.orderUnit)}個`} />
            </div>

            <div className="mt-4 rounded-2xl bg-gray-50 p-4">
              <div className="text-xs font-black text-gray-400">1688URL</div>
              {url1688 ? (
                <a href={url1688} target="_blank" rel="noreferrer" className="mt-1 block break-all text-sm font-bold text-indigo-600 underline underline-offset-2">
                  {url1688}
                </a>
              ) : (
                <div className="mt-1 text-sm font-bold text-gray-500">-</div>
              )}
            </div>

            <div className="mt-5 flex justify-start">
              <button
                type="button"
                onClick={() => {
                  onOpenMaster?.(sku);
                  onClose();
                }}
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-black text-white hover:bg-gray-700"
              >
                商品マスタで編集
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PurchaseMetricLine({ label, value, unit = "" }: { label: string; value: number | string; unit?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white/75 px-2.5 py-1.5">
      <span className="text-[11px] font-bold text-gray-400">{label}</span>
      <span className="text-[12px] font-black text-gray-800 tabular-nums">{value}{unit}</span>
    </div>
  );
}

function PurchaseReasonSummary({
  dailySales,
  totalLeadTimeDays,
  requiredQty,
  stockLabel,
  stockValue,
  apStock,
  shortageQty,
  recommendedOrderQty,
}: {
  dailySales: number;
  totalLeadTimeDays: number;
  requiredQty: number;
  stockLabel: string;
  stockValue: number;
  apStock: number;
  shortageQty: number;
  recommendedOrderQty: number;
}) {
  const dailyText = dailySales > 0 ? formatQty(dailySales) : "-";
  const ltText = totalLeadTimeDays > 0 ? formatQty(totalLeadTimeDays) : "-";

  return (
    <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50/80 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-black text-gray-800">
        <span>計算根拠</span>
        <span className="text-gray-300">|</span>
        <span>日販 {dailyText}個</span>
        <span>×</span>
        <span>総LT {ltText}日</span>
        <span>→</span>
        <span>必要数 {formatQty(requiredQty)}個</span>
        <span>−</span>
        <span>{stockLabel} {formatQty(stockValue)}個</span>
        <span>−</span>
        <span>AP在庫 {formatQty(apStock)}個</span>
        <span>=</span>
        <span>不足 {formatQty(shortageQty)}個</span>
        <span>→</span>
        <span>中国発注 {formatQty(recommendedOrderQty)}個</span>
      </div>
      <div className="mt-1 text-[10px] font-bold text-gray-500">
        必要数は販売側の日販と総LTから算出。{stockLabel}とAP在庫を差し引いた不足数を、MOQ・発注単位で丸めて中国発注数を出します。
      </div>
    </div>
  );
}


type InspectionKey = "detail" | "set" | "opp" | "print" | "barcode" | "tag";

const PURCHASE_INSPECTION_ITEMS: { key: InspectionKey; label: string }[] = [
  { key: "detail", label: "詳細検品" },
  { key: "set", label: "セット組" },
  { key: "opp", label: "OPP袋" },
  { key: "print", label: "印刷物" },
  { key: "barcode", label: "バーコード" },
  { key: "tag", label: "タグつけ外し" },
];

function normalizeInspectionKey(value: unknown): InspectionKey | null {
  const text = getText(value).toLowerCase();

  if (!text) return null;
  if (text.includes("詳細") || text.includes("detail")) return "detail";
  if (text.includes("セット") || text.includes("set")) return "set";
  if (text.includes("opp")) return "opp";
  if (text.includes("印刷") || text.includes("print")) return "print";
  if (text.includes("バーコード") || text.includes("barcode")) return "barcode";
  if (text.includes("タグ") || text.includes("tag")) return "tag";

  return null;
}

function normalizeInspectionKeys(value: unknown): InspectionKey[] {
  const rawValues = Array.isArray(value)
    ? value
    : getText(value)
        .split(/[\/,、，｜|\n\r]+/)
        .map((item) => item.trim())
        .filter(Boolean);

  const keys = rawValues
    .map((item) => normalizeInspectionKey(item))
    .filter((item): item is InspectionKey => Boolean(item));

  return Array.from(new Set(keys));
}

function getMasterDefaultInspectionItems(master: unknown): InspectionKey[] {
  const source = master as Record<string, unknown> | undefined;
  if (!source) return [];

  return normalizeInspectionKeys(
    source.default_inspection_items ??
      source.defaultInspectionItems ??
      source.inspection_items ??
      source.inspectionItems ??
      source["検品項目"] ??
      source["デフォルト検品項目"]
  );
}

function findProductMasterForPurchaseRow(
  productMasters: Record<string, ProductMasterItem>,
  masterSku: string,
  purchaseSku: string,
  displayJan: string
) {
  const directMaster = productMasters[masterSku] ?? productMasters[purchaseSku];
  if (directMaster) return directMaster;

  const jan = displayJan.replace(/\D/g, "");
  if (!jan) return undefined;

  return Object.values(productMasters).find((master) => {
    const targetJan = getText((master as any)?.jan ?? (master as any)?.JAN).replace(/\D/g, "");
    return targetJan === jan;
  });
}

type PurchaseCsvModalRow = {
  key: string;
  imageUrl: string;
  productName: string;
  purchaseSku: string;
  displayJan: string;
  orderQty: number;
  requiredQty: number;
  fbaRslStock: number;
  theoreticalStock: number;
  apStock: number;
  moq: number;
  orderUnit: number;
  dailySales: number;
  totalLeadTimeDays: number;
  color: string;
  size: string;
  url1688: string;
  sourceType: string;
  defaultInspectionItems: InspectionKey[];
  inspections: Record<InspectionKey, boolean>;
};

function PurchaseCsvExportModal({
  rows,
  setRows,
  onClose,
  onConfirm,
}: {
  rows: PurchaseCsvModalRow[];
  setRows: Dispatch<SetStateAction<PurchaseCsvModalRow[]>>;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const updateOrderQty = (key: string, value: string) => {
    const qty = Math.max(0, Math.floor(Number(value) || 0));
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, orderQty: qty } : row))
    );
  };

  const toggleInspection = (key: string, inspectionKey: InspectionKey) => {
    setRows((prev) =>
      prev.map((row) =>
        row.key === key
          ? {
              ...row,
              inspections: {
                ...row.inspections,
                [inspectionKey]: !row.inspections[inspectionKey],
              },
            }
          : row
      )
    );
  };

  const setAllForItem = (inspectionKey: InspectionKey, checked: boolean) => {
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        inspections: {
          ...row.inspections,
          [inspectionKey]: checked,
        },
      }))
    );
  };

  const allCheckedForItem = (inspectionKey: InspectionKey) =>
    rows.length > 0 && rows.every((row) => Boolean(row.inspections[inspectionKey]));

  const applyDefaultInspections = (key: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;

        const nextInspections = {
          detail: false,
          set: false,
          opp: false,
          print: false,
          barcode: false,
          tag: false,
        } as Record<InspectionKey, boolean>;

        row.defaultInspectionItems.forEach((item) => {
          nextInspections[item] = true;
        });

        return {
          ...row,
          inspections: nextInspections,
        };
      })
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              検品項目を選択してCSV出力
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              選択した検品項目は、発注CSVの各SKU/JAN行に反映されます。
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            閉じる
          </button>
        </div>

        <div className="overflow-auto p-6">
          {rows.length === 0 ? (
            <p className="text-sm text-gray-500">選択中の発注SKU/JANがありません。</p>
          ) : (
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="px-3 py-3">画像</th>
                  <th className="px-3 py-3">発注SKU/JAN</th>
                  <th className="px-3 py-3">商品名</th>
                  <th className="px-3 py-3 text-right">発注数（個・バラ）</th>
                  {PURCHASE_INSPECTION_ITEMS.map((item) => (
                    <th key={item.key} className="px-3 py-3 text-center">
                      <label className="flex cursor-pointer flex-col items-center gap-1">
                        <input
                          type="checkbox"
                          checked={allCheckedForItem(item.key)}
                          onChange={(event) => setAllForItem(item.key, event.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                        />
                        <span className="whitespace-nowrap">{item.label}</span>
                      </label>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.key}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-3 py-3">
                      {row.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={row.imageUrl}
                          alt=""
                          className="h-12 w-12 rounded-lg border border-gray-200 object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-gray-300 text-[10px] text-gray-400">
                          no image
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-3 font-mono font-bold text-gray-900">
                      <div className="whitespace-nowrap">{row.purchaseSku || "-"}</div>
                      {row.displayJan && (
                        <div className="mt-1 text-[10px] font-bold leading-relaxed text-gray-500">
                          JAN: {row.displayJan}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => applyDefaultInspections(row.key)}
                        disabled={row.defaultInspectionItems.length === 0}
                        className="mt-1 block rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] font-bold text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        マスタ検品を反映
                      </button>
                    </td>

                    <td className="max-w-[260px] truncate px-3 py-3 text-gray-700">
                      <div className="truncate">{row.productName || "商品名未設定"}</div>
                      {(row.color || row.size) && (
                        <div className="mt-1 text-[10px] font-bold text-gray-400">
                          {[row.color ? `色: ${row.color}` : "", row.size ? `サイズ: ${row.size}` : ""]
                            .filter(Boolean)
                            .join("　")}
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-3 text-right">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={row.orderQty}
                        onChange={(event) => updateOrderQty(row.key, event.target.value)}
                        className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-right font-bold text-red-600 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      />
                    </td>

                    {PURCHASE_INSPECTION_ITEMS.map((item) => (
                      <td key={item.key} className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={Boolean(row.inspections[item.key])}
                          onChange={() => toggleInspection(row.key, item.key)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
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
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100"
            >
              キャンセル
            </button>
            <button
              type="button"
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

export default function PurchaseManager({
  purchaseSkus,
  setPurchaseSkus,
  purchaseBreakdownRows,
  purchaseSkuSummaryRows,
  manualPurchaseOrders,
  setManualPurchaseOrders,
  onOpenMaster,
  productMasters = {},
}: Props) {
  const [showPurchaseSkus, setShowPurchaseSkus] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [purchaseFormOpen, setPurchaseFormOpen] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseSkuItem>(
    EMPTY_PURCHASE_SKU_FORM
  );
  const [editingPurchaseSku, setEditingPurchaseSku] = useState("");
  const [showOnlyOrderRequired, setShowOnlyOrderRequired] = useState(false);
  const [displayLimit, setDisplayLimit] = useState<number | "all">(100);
  const [expandedPurchaseRows, setExpandedPurchaseRows] = useState<Set<string>>(new Set());
  const [selectedPurchaseRowKeys, setSelectedPurchaseRowKeys] = useState<Set<string>>(new Set());
  const [previewItem, setPreviewItem] = useState<PurchasePreviewState | null>(null);
  const [purchaseCsvModalOpen, setPurchaseCsvModalOpen] = useState(false);
  const [purchaseCsvRows, setPurchaseCsvRows] = useState<PurchaseCsvModalRow[]>([]);

  const sortedPurchaseSkuSummaryRows = useMemo(() => {
    const rows = [...purchaseSkuSummaryRows].sort((a, b) => {
      const aQty = Number((a as any).recommended_order_qty ?? 0) || 0;
      const bQty = Number((b as any).recommended_order_qty ?? 0) || 0;
      return bQty - aQty;
    });

    if (!showOnlyOrderRequired) return rows;

    return rows.filter((row) => {
      const qty = Number((row as any).recommended_order_qty ?? 0) || 0;
      return qty > 0;
    });
  }, [purchaseSkuSummaryRows, showOnlyOrderRequired]);

  const getPurchaseRowKey = (rawRow: unknown, index: number) => {
    const row = rawRow as Record<string, unknown>;
    return (
      getText(row.purchase_sku) ||
      getText(row.component_purchase_sku) ||
      getText(row.sku) ||
      `purchase-row-${index}`
    );
  };


  const displayedPurchaseSkuSummaryRows = useMemo(() => {
    if (displayLimit === "all") return sortedPurchaseSkuSummaryRows;
    return sortedPurchaseSkuSummaryRows.slice(0, displayLimit);
  }, [sortedPurchaseSkuSummaryRows, displayLimit]);

  const visiblePurchaseRowKeys = useMemo(
    () => displayedPurchaseSkuSummaryRows.map((row, index) => getPurchaseRowKey(row, index)),
    [displayedPurchaseSkuSummaryRows]
  );

  const selectedVisiblePurchaseRowCount = visiblePurchaseRowKeys.filter((key) =>
    selectedPurchaseRowKeys.has(key)
  ).length;

  const allVisiblePurchaseRowsSelected =
    visiblePurchaseRowKeys.length > 0 &&
    selectedVisiblePurchaseRowCount === visiblePurchaseRowKeys.length;

  const handleToggleAllVisiblePurchaseRows = () => {
    setSelectedPurchaseRowKeys((prev) => {
      const next = new Set(prev);

      if (allVisiblePurchaseRowsSelected) {
        visiblePurchaseRowKeys.forEach((key) => next.delete(key));
      } else {
        visiblePurchaseRowKeys.forEach((key) => next.add(key));
      }

      return next;
    });
  };

  const handleTogglePurchaseRowSelection = (rowKey: string) => {
    setSelectedPurchaseRowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.add(rowKey);
      }
      return next;
    });
  };

  const handleExpandAllPurchaseRows = () => {
    setExpandedPurchaseRows(
      new Set(
        displayedPurchaseSkuSummaryRows.map((row, index) =>
          getPurchaseRowKey(row, index)
        )
      )
    );
  };

  const handleCollapseAllPurchaseRows = () => {
    setExpandedPurchaseRows(new Set());
  };

  const handleTogglePurchaseRowDetail = (rowKey: string) => {
    setExpandedPurchaseRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.add(rowKey);
      }
      return next;
    });
  };

  const resetPurchaseForm = () => {
    setPurchaseForm(EMPTY_PURCHASE_SKU_FORM);
    setEditingPurchaseSku("");
    setPurchaseFormOpen(false);
  };

  const handleStartEditPurchaseSku = (item: PurchaseSkuItem) => {
    setEditingPurchaseSku(String(item.purchase_sku ?? "").trim());
    setPurchaseForm({
      ...EMPTY_PURCHASE_SKU_FORM,
      ...item,
      purchase_sku: String(item.purchase_sku ?? "").trim(),
      parent_jan: String(item.parent_jan ?? "").replace(/\D/g, "").trim(),
      color: String(item.color ?? ""),
      size: String(item.size ?? ""),
      ap_stock: Math.max(0, Math.floor(Number(item.ap_stock) || 0)),
      moq: Math.max(0, Math.floor(Number((item as any).moq) || 0)),
      order_unit: Math.max(0, Math.floor(Number((item as any).order_unit) || 0)),
      recommended_order_qty: Math.max(
        0,
        Math.floor(Number(item.recommended_order_qty) || 0)
      ),
      url_1688: String(item.url_1688 ?? ""),
      enabled: item.enabled !== false,
    } as PurchaseSkuItem);
    setPurchaseFormOpen(true);
  };

  const handleDeletePurchaseSku = (purchaseSku: string) => {
    const target = String(purchaseSku ?? "").trim();
    if (!target) return;

    const ok = window.confirm(`発注SKU「${target}」を削除しますか？`);
    if (!ok) return;

    setPurchaseSkus((prev) =>
      prev.filter((item) => String(item.purchase_sku ?? "").trim() !== target)
    );

    setManualPurchaseOrders((prev) => {
      const next = { ...prev };
      delete next[target];
      return next;
    });

    if (editingPurchaseSku === target) {
      resetPurchaseForm();
    }
  };

  const buildSelectedPurchaseCsvRows = (): PurchaseCsvModalRow[] => {
    return sortedPurchaseSkuSummaryRows
      .map((rawRow, index) => ({ rawRow, index, rowKey: getPurchaseRowKey(rawRow, index) }))
      .filter(({ rowKey }) => selectedPurchaseRowKeys.has(rowKey))
      .map(({ rawRow, index, rowKey }) => {
        const row = rawRow as unknown as Record<string, unknown>;
        const purchaseSku =
          getText(row.purchase_sku) ||
          getText(row.component_purchase_sku) ||
          getText(row.sku);
        const displayJan =
          getText(row.display_jan) ||
          getText(row.sales_jan) ||
          (/^\d{8,14}$/.test(purchaseSku) ? purchaseSku : "");
        const masterSku = getText(row.master_sku) || purchaseSku;
        const linkedMaster = findProductMasterForPurchaseRow(
          productMasters,
          masterSku,
          purchaseSku,
          displayJan
        );
        const defaultInspectionItems = getMasterDefaultInspectionItems(linkedMaster);
        const productName =
          getText(row.product_name) ||
          getText(row.productName) ||
          getText(row.name);
        const recommendedOrderQty =
          getNumber(row.recommended_order_qty) ||
          getNumber(row.final_recommended_order_qty);
        const manualQty =
          purchaseSku && manualPurchaseOrders[purchaseSku] !== undefined
            ? manualPurchaseOrders[purchaseSku]
            : undefined;
        const imageUrl =
          getText(row.image_url) ||
          getText(row.imageUrl) ||
          getText(row.product_image_url) ||
          getText(row.thumbnail_url);

        return {
          key: `${rowKey}-${index}`,
          imageUrl,
          productName,
          purchaseSku,
          displayJan,
          orderQty:
            manualQty === undefined
              ? Math.max(0, Math.floor(recommendedOrderQty || 0))
              : Math.max(0, Math.floor(Number(manualQty) || 0)),
          requiredQty:
            getNumber(row.required_qty) ||
            getNumber(row.total_required_qty) ||
            getNumber(row.required_component_qty),
          fbaRslStock: getNumber(row.fba_rsl_stock),
          theoreticalStock: getNumber(row.theoretical_stock),
          apStock: getNumber(row.ap_stock) || getNumber(row.purchase_sku_ap_stock),
          moq: getNumber(row.moq),
          orderUnit: getNumber(row.order_unit),
          dailySales: getNumber(row.daily_sales),
          totalLeadTimeDays: getNumber(row.total_lead_time_days),
          color: getText(row.color),
          size: getText(row.size),
          url1688: getText(row.url_1688),
          sourceType: getText(row.source_type),
          defaultInspectionItems,
          inspections: {
            detail: false,
            set: false,
            opp: false,
            print: false,
            barcode: false,
            tag: false,
          },
        };
      });
  };

  const handleExportPurchaseSkusCsv = () => {
    const selectedRows = buildSelectedPurchaseCsvRows();

    if (selectedRows.length === 0) {
      alert("発注CSVをダウンロードする商品を選択してください");
      return;
    }

    setPurchaseCsvRows(selectedRows);
    setPurchaseCsvModalOpen(true);
  };

  const handleConfirmPurchaseCsvDownload = () => {
    if (purchaseCsvRows.length === 0) {
      alert("発注CSVをダウンロードする商品を選択してください");
      return;
    }

    const headers = [
      "商品名",
      "発注SKU/JAN",
      "JAN",
      "中国発注数",
      "必要数",
      "FBA/RSL在庫",
      "FBA/RSL理論在庫",
      "AP在庫",
      "MOQ",
      "発注単位",
      "色",
      "サイズ",
      "1688URL",
      "inspection_items",
      ...PURCHASE_INSPECTION_ITEMS.map((item) => item.label),
    ];

    const rows = purchaseCsvRows.map((row) => {
      const inspectionLabels = PURCHASE_INSPECTION_ITEMS
        .filter((item) => row.inspections[item.key])
        .map((item) => item.label);

      return [
        row.productName,
        row.purchaseSku,
        row.displayJan,
        row.orderQty,
        row.requiredQty,
        row.sourceType === "component_purchase_sku" ? "" : row.fbaRslStock,
        row.sourceType === "component_purchase_sku" ? row.theoreticalStock : "",
        row.apStock,
        row.moq,
        row.orderUnit,
        row.color,
        row.size,
        row.url1688,
        inspectionLabels.join(" / "),
        ...PURCHASE_INSPECTION_ITEMS.map((item) => (row.inspections[item.key] ? "1" : "")),
      ];
    });

    const csv =
      "\ufeff" +
      [headers, ...rows]
        .map((row) => row.map(escapeCsvValue).join(","))
        .join("\n");

    const ts = new Date().toISOString().slice(0, 10);
    downloadTextFile(csv, `purchase_order_${ts}.csv`, "text/csv;charset=utf-8");
    setPurchaseCsvModalOpen(false);
  };

  const normalizeImportedPurchaseSku = (
    raw: Record<string, string>
  ): PurchaseSkuItem => {
    return {
      purchase_sku: String(raw.purchase_sku ?? "").trim(),
      parent_jan: String(raw.parent_jan ?? "").replace(/\D/g, "").trim(),
      color: String(raw.color ?? "").trim(),
      size: String(raw.size ?? "").trim(),
      ap_stock: Math.max(0, Math.floor(Number(raw.ap_stock) || 0)),
      moq: Math.max(0, Math.floor(Number(raw.moq) || 0)),
      order_unit: Math.max(0, Math.floor(Number(raw.order_unit) || 0)),
      recommended_order_qty: Math.max(
        0,
        Math.floor(Number(raw.recommended_order_qty) || 0)
      ),
      url_1688: String(raw.url_1688 ?? "").trim(),
      enabled: String(raw.enabled ?? "true").toLowerCase() !== "false",
    } as PurchaseSkuItem;
  };

  const handleImportPurchaseSkusCsv = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv";

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        const text = (await file.text()).replace(/^\ufeff/, "");
        const lines = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);

        if (lines.length < 2) {
          alert("CSVに取込対象データがありません");
          return;
        }

        const headers = parseCsvLine(lines[0]).map((header) =>
          header.trim()
        );

        const imported = lines
          .slice(1)
          .map((line) => {
            const values = parseCsvLine(line);
            const raw: Record<string, string> = {};

            headers.forEach((header, index) => {
              raw[header] = values[index] ?? "";
            });

            return normalizeImportedPurchaseSku(raw);
          })
          .filter((item) => item.purchase_sku);

        if (imported.length === 0) {
          alert("有効な発注SKUがありません");
          return;
        }

        const ok = window.confirm(
          `CSVから${imported.length}件を取り込みます。既存の発注SKU一覧を置き換えますか？`
        );
        if (!ok) return;

        setPurchaseSkus(
          imported.sort((a, b) =>
            String(a.purchase_sku ?? "").localeCompare(
              String(b.purchase_sku ?? "")
            )
          )
        );
        setManualPurchaseOrders({});
        resetPurchaseForm();
      } catch {
        alert("CSVの読み込みに失敗しました");
      }
    };

    input.click();
  };

  const handleExportPurchaseBackup = () => {
    const backup = {
      version: 1,
      exported_at: new Date().toISOString(),
      purchase_skus: purchaseSkus,
      manual_purchase_orders: manualPurchaseOrders,
    };

    const ts = new Date().toISOString().slice(0, 10);
    downloadTextFile(
      JSON.stringify(backup, null, 2),
      `purchase_backup_${ts}.json`,
      "application/json;charset=utf-8"
    );
  };

  const handleImportPurchaseBackup = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        const parsed = JSON.parse(await file.text());
        const rawItems = Array.isArray(parsed?.purchase_skus)
          ? parsed.purchase_skus
          : [];
        const rawManualOrders =
          parsed?.manual_purchase_orders &&
          typeof parsed.manual_purchase_orders === "object"
            ? parsed.manual_purchase_orders
            : {};

        const imported = rawItems
          .map((item: any) =>
            normalizeImportedPurchaseSku({
              purchase_sku: String(item?.purchase_sku ?? ""),
              parent_jan: String(item?.parent_jan ?? ""),
              color: String(item?.color ?? ""),
              size: String(item?.size ?? ""),
              ap_stock: String(item?.ap_stock ?? 0),
              moq: String(item?.moq ?? 0),
              order_unit: String(item?.order_unit ?? 0),
              recommended_order_qty: String(item?.recommended_order_qty ?? 0),
              url_1688: String(item?.url_1688 ?? ""),
              enabled: item?.enabled === false ? "false" : "true",
            })
          )
          .filter((item: PurchaseSkuItem) => item.purchase_sku);

        if (imported.length === 0) {
          alert("バックアップ内に有効な発注SKUがありません");
          return;
        }

        const ok = window.confirm(
          `バックアップから${imported.length}件を復元します。現在の発注SKU一覧を置き換えますか？`
        );
        if (!ok) return;

        const nextManualOrders: Record<string, number> = {};
        Object.entries(rawManualOrders).forEach(([key, value]) => {
          const purchaseSku = String(key ?? "").trim();
          const qty = Math.max(0, Math.floor(Number(value) || 0));
          if (purchaseSku) nextManualOrders[purchaseSku] = qty;
        });

        setPurchaseSkus(
          imported.sort((a: PurchaseSkuItem, b: PurchaseSkuItem) =>
            String(a.purchase_sku ?? "").localeCompare(
              String(b.purchase_sku ?? "")
            )
          )
        );
        setManualPurchaseOrders(nextManualOrders);
        resetPurchaseForm();
      } catch {
        alert("バックアップの読み込みに失敗しました");
      }
    };

    input.click();
  };

  const handleAddPurchaseSku = () => {
    const purchaseSku = String(purchaseForm.purchase_sku ?? "").trim();

    if (!purchaseSku) {
      alert("発注SKUを入力してください");
      return;
    }

    const duplicated = purchaseSkus.some((item) => {
      const currentSku = String(item.purchase_sku ?? "").trim();
      if (editingPurchaseSku && currentSku === editingPurchaseSku) return false;
      return currentSku.toLowerCase() === purchaseSku.toLowerCase();
    });

    if (duplicated) {
      alert("同じ発注SKUがすでにあります");
      return;
    }

    const nextItem: PurchaseSkuItem = {
      purchase_sku: purchaseSku,
      parent_jan: String(purchaseForm.parent_jan ?? "")
        .replace(/\D/g, "")
        .trim(),
      color: String(purchaseForm.color ?? "").trim(),
      size: String(purchaseForm.size ?? "").trim(),
      ap_stock: Math.max(0, Math.floor(Number(purchaseForm.ap_stock) || 0)),
      moq: Math.max(0, Math.floor(Number((purchaseForm as any).moq) || 0)),
      order_unit: Math.max(
        0,
        Math.floor(Number((purchaseForm as any).order_unit) || 0)
      ),
      recommended_order_qty: Math.max(
        0,
        Math.floor(Number(purchaseForm.recommended_order_qty) || 0)
      ),
      url_1688: String(purchaseForm.url_1688 ?? "").trim(),
      enabled: true,
    } as PurchaseSkuItem;

    setPurchaseSkus((prev) => {
      const next = editingPurchaseSku
        ? prev.map((item) =>
            String(item.purchase_sku ?? "").trim() === editingPurchaseSku
              ? nextItem
              : item
          )
        : [...prev, nextItem];

      return next.sort((a, b) =>
        String(a.purchase_sku ?? "").localeCompare(String(b.purchase_sku ?? ""))
      );
    });

    if (editingPurchaseSku && editingPurchaseSku !== purchaseSku) {
      setManualPurchaseOrders((prev) => {
        if (prev[editingPurchaseSku] === undefined) return prev;

        const next = { ...prev };
        next[purchaseSku] = next[editingPurchaseSku];
        delete next[editingPurchaseSku];
        return next;
      });
    }

    resetPurchaseForm();
  };

  return (
    <div className="space-y-6 p-6">
      {purchaseFormOpen && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-black text-gray-900">
              {editingPurchaseSku ? "発注SKU編集" : "発注SKU追加"}
            </h3>
            <p className="mt-1 text-xs font-semibold text-gray-500">
              {editingPurchaseSku
                ? "登録済みの発注SKUを編集します。"
                : "発注SKUマスタへ1件追加します。"}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <label className="text-xs font-bold text-gray-600">
              発注SKU
              <input
                value={purchaseForm.purchase_sku ?? ""}
                onChange={(event) =>
                  setPurchaseForm((prev) => ({
                    ...prev,
                    purchase_sku: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                placeholder="例：PINK-L"
              />
            </label>

            <label className="text-xs font-bold text-gray-600">
              親JAN
              <input
                value={purchaseForm.parent_jan ?? ""}
                onChange={(event) =>
                  setPurchaseForm((prev) => ({
                    ...prev,
                    parent_jan: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                placeholder="例：458..."
              />
            </label>

            <label className="text-xs font-bold text-gray-600">
              色
              <input
                value={purchaseForm.color ?? ""}
                onChange={(event) =>
                  setPurchaseForm((prev) => ({
                    ...prev,
                    color: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                placeholder="例：粉色"
              />
            </label>

            <label className="text-xs font-bold text-gray-600">
              サイズ
              <input
                value={purchaseForm.size ?? ""}
                onChange={(event) =>
                  setPurchaseForm((prev) => ({
                    ...prev,
                    size: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                placeholder="例：L"
              />
            </label>

            <label className="text-xs font-bold text-gray-600">
              AP在庫
              <input
                type="number"
                min={0}
                value={getFormNumber(purchaseForm.ap_stock)}
                onChange={(event) =>
                  setPurchaseForm((prev) => ({
                    ...prev,
                    ap_stock: getFormNumber(event.target.value),
                  }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </label>

            <label className="text-xs font-bold text-gray-600">
              MOQ
              <input
                type="number"
                min={0}
                value={getFormNumber(purchaseForm.moq)}
                onChange={(event) =>
                  setPurchaseForm((prev) => ({
                    ...prev,
                    moq: getFormNumber(event.target.value),
                  }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </label>

            <label className="text-xs font-bold text-gray-600">
              発注単位
              <input
                type="number"
                min={0}
                value={getFormNumber(purchaseForm.order_unit)}
                onChange={(event) =>
                  setPurchaseForm((prev) => ({
                    ...prev,
                    order_unit: getFormNumber(event.target.value),
                  }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </label>

            <label className="text-xs font-bold text-gray-600">
              1688URL
              <input
                value={purchaseForm.url_1688 ?? ""}
                onChange={(event) =>
                  setPurchaseForm((prev) => ({
                    ...prev,
                    url_1688: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                placeholder="https://..."
              />
            </label>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={resetPurchaseForm}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
            >
              キャンセル
            </button>

            <button
              type="button"
              onClick={handleAddPurchaseSku}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-500"
            >
              {editingPurchaseSku ? "更新する" : "追加する"}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm font-black text-gray-800">
            <input
              type="checkbox"
              checked={allVisiblePurchaseRowsSelected}
              onChange={handleToggleAllVisiblePurchaseRows}
              className="h-5 w-5"
            />
            表示中の商品を選択
          </label>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="rounded-xl bg-gray-50 px-3 py-2 text-xs font-bold text-gray-500">
              選択 {selectedPurchaseRowKeys.size.toLocaleString()}件
            </span>

            <label className="flex items-center gap-2 text-xs font-bold text-gray-500">
              表示件数
              <select
                value={displayLimit}
                onChange={(event) => {
                  const value = event.target.value;
                  setDisplayLimit(value === "all" ? "all" : Number(value));
                }}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 outline-none hover:bg-gray-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                <option value={100}>100件</option>
                <option value={200}>200件</option>
                <option value={500}>500件</option>
                <option value="all">すべて</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => setShowOnlyOrderRequired((v) => !v)}
              className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition ${
                showOnlyOrderRequired
                  ? "border-orange-200 bg-orange-50 text-orange-700"
                  : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              <span
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                  showOnlyOrderRequired ? "bg-orange-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${
                    showOnlyOrderRequired ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </span>
              中国発注ありのみ
            </button>

            <button
              type="button"
              onClick={handleExpandAllPurchaseRows}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
            >
              すべての詳細を表示
            </button>

            <button
              type="button"
              onClick={handleCollapseAllPurchaseRows}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
            >
              すべて閉じる
            </button>

            <button
              type="button"
              onClick={handleExportPurchaseSkusCsv}
              className={`rounded-xl px-4 py-2 text-xs font-bold shadow-sm ${
                selectedPurchaseRowKeys.size > 0
                  ? "bg-indigo-600 text-white hover:bg-indigo-500"
                  : "cursor-not-allowed bg-gray-200 text-gray-500"
              }`}
            >
              発注CSVダウンロード{selectedPurchaseRowKeys.size > 0 ? `（${selectedPurchaseRowKeys.size}件）` : ""}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        {displayedPurchaseSkuSummaryRows.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 py-16 text-center text-sm font-bold text-gray-400">
            中国発注数データはまだありません。
          </div>
        ) : (
          <div className="space-y-3">
            {displayedPurchaseSkuSummaryRows.map((rawRow, index) => {
              const row = rawRow as unknown as Record<string, unknown>;

              const purchaseSku =
                getText(row.purchase_sku) ||
                getText(row.component_purchase_sku) ||
                getText(row.sku);

              const masterSku = getText(row.master_sku) || purchaseSku;
              const displayJan =
                getText(row.display_jan) ||
                getText(row.sales_jan) ||
                (/^\d{8,14}$/.test(purchaseSku) ? purchaseSku : "");

              const productName =
                getText(row.product_name) ||
                getText(row.productName) ||
                getText(row.name);

              const requiredQty =
                getNumber(row.required_qty) ||
                getNumber(row.total_required_qty) ||
                getNumber(row.required_component_qty);

              const apStock =
                getNumber(row.ap_stock) ||
                getNumber(row.purchase_sku_ap_stock);

              const shortageQty =
                getNumber(row.shortage_qty) ||
                getNumber(row.total_shortage_qty);

              const moq = getNumber(row.moq);
              const orderUnit = getNumber(row.order_unit);

              const recommendedOrderQty =
                getNumber(row.recommended_order_qty) ||
                getNumber(row.final_recommended_order_qty);

              const sourceType = getText(row.source_type);
              const fbaRslStock = getNumber(row.fba_rsl_stock);
              const theoreticalStock = getNumber(row.theoretical_stock);
              const dailySales = getNumber(row.daily_sales);
              const totalLeadTimeDays = getNumber(row.total_lead_time_days);
              const stockLabel =
                sourceType === "component_purchase_sku"
                  ? "FBA/RSL理論在庫"
                  : "FBA/RSL在庫";
              const stockValue =
                sourceType === "component_purchase_sku"
                  ? theoreticalStock
                  : fbaRslStock;

              const color = getText(row.color);
              const size = getText(row.size);
              const url1688 = getText(row.url_1688);
              const imageUrl =
                getText(row.image_url) ||
                getText(row.imageUrl) ||
                getText(row.product_image_url) ||
                getText(row.thumbnail_url);
              const isRegistered = Boolean(row.is_registered_purchase_sku);
              const rowKey = getPurchaseRowKey(rawRow, index);
              const isDetailOpen = expandedPurchaseRows.has(rowKey);

              return (
                <div
                  key={rowKey}
                  className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <input
                      type="checkbox"
                      checked={selectedPurchaseRowKeys.has(rowKey)}
                      onChange={() => handleTogglePurchaseRowSelection(rowKey)}
                      className="h-5 w-5"
                    />

                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl}
                        alt=""
                        className="h-16 w-16 rounded-2xl border border-gray-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-[10px] font-bold text-gray-400">
                        発注
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setPreviewItem({ masterSku, purchaseSku, displayJan, productName: productName || "商品名未設定", imageUrl, color, size, url1688, chinaOrderQty: recommendedOrderQty, moq, orderUnit })}
                      className="min-w-[220px] flex-1 rounded-lg p-1 text-left hover:bg-indigo-50"
                    >
                      <div className="font-bold text-gray-900">
                        {productName || "商品名未設定"}
                      </div>

                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                        <span className="font-mono">SKU: {purchaseSku || "-"}</span>
                        {displayJan && <span className="font-mono">JAN: {displayJan}</span>}
                        {color && <span>色: {color}</span>}
                        {size && <span>サイズ: {size}</span>}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${isRegistered ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                          {isRegistered ? "発注SKU登録済" : "発注SKU未登録"}
                        </span>

                        {url1688 ? (
                          <a
                            href={url1688}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="text-xs font-bold text-indigo-600 underline underline-offset-2"
                          >
                            1688URL
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">1688URL: -</span>
                        )}
                      </div>

                      <div className="mt-1 text-[10px] font-bold text-indigo-500">
                        クリックでマスタ情報
                      </div>
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="min-w-[180px] rounded-2xl border border-orange-200 bg-orange-50 px-6 py-4 text-center text-orange-700">
                        <div className="text-[12px] font-black opacity-80">中国発注数</div>
                        <div className="mt-1 text-3xl font-black tabular-nums">
                          {formatQty(recommendedOrderQty)}
                          <span className="ml-1 text-sm font-black">個</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {isDetailOpen && (
                    <div className="mt-3">
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        <PurchaseMetricLine label="日販" value={dailySales > 0 ? formatQty(dailySales) : "-"} unit={dailySales > 0 ? "個/日" : ""} />
                        <PurchaseMetricLine label="総LT" value={totalLeadTimeDays > 0 ? formatQty(totalLeadTimeDays) : "-"} unit={totalLeadTimeDays > 0 ? "日" : ""} />
                        <PurchaseMetricLine label="必要数" value={formatQty(requiredQty)} unit="個" />
                        <PurchaseMetricLine label={stockLabel} value={formatQty(stockValue)} unit="個" />
                        <PurchaseMetricLine label="AP在庫" value={formatQty(apStock)} unit="個" />
                        <PurchaseMetricLine label="不足数" value={formatQty(shortageQty)} unit="個" />
                      </div>

                      <PurchaseReasonSummary
                        dailySales={dailySales}
                        totalLeadTimeDays={totalLeadTimeDays}
                        requiredQty={requiredQty}
                        stockLabel={stockLabel}
                        stockValue={stockValue}
                        apStock={apStock}
                        shortageQty={shortageQty}
                        recommendedOrderQty={recommendedOrderQty}
                      />
                    </div>
                  )}

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleTogglePurchaseRowDetail(rowKey)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50"
                    >
                      {isDetailOpen ? "詳細を閉じる" : "詳細を見る"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {purchaseCsvModalOpen && (
        <PurchaseCsvExportModal
          rows={purchaseCsvRows}
          setRows={setPurchaseCsvRows}
          onClose={() => setPurchaseCsvModalOpen(false)}
          onConfirm={handleConfirmPurchaseCsvDownload}
        />
      )}

      {previewItem && (
        <PurchaseMasterPreviewModal
          item={previewItem}
          master={productMasters[previewItem.masterSku]}
          onClose={() => setPreviewItem(null)}
          onOpenMaster={onOpenMaster}
        />
      )}
    </div>
  );
}
