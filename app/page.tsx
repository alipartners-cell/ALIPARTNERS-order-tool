"use client";

import {
  normalizeSkuKey,
  normalizeJanKey,
} from "@/lib/normalizers";

import {
  getCanonicalKeyForCsvRow,
  canonicalizeCsvRowsByJan,
  buildMergedChannelRows,
} from "@/lib/csvMergeEngine";

import { useState, useCallback, useMemo, useEffect } from "react";
import { adjustRowsForSetUnits, getUnitPerSetFromMaster, buildComputedRows } from "@/lib/rowCalculationEngine";
import { buildRowsWithApStock } from "@/lib/apStockEngine";
import { normalizeProductMaster, makeDraftMasterFromCsv } from "@/lib/productMasterEngine";
import type { ComputedSkuRow, OrderParams, RawSkuRow, ProductMasterItem } from "@/types";
import { computeAllRows, toRawRow } from "@/lib/calc";
import {
  INSPECTION_ITEMS,
  parseCsvFile,
  parseChannelCsvFile,
  buildOrderCsvContent,
  downloadCsv,
  type InspectionItem,
  type InspectionSelections,
  type SalesChannel,
  type CsvDataKind,
} from "@/lib/csv";
import OrderTable from "@/components/OrderTable";
import OrderCalendar from "@/components/OrderCalendar";
import TableOperationBar from "@/components/home/TableOperationBar";
import CsvErrorModal from "@/components/home/CsvErrorModal";
import TopTabs from "@/components/home/TopTabs";
import CsvStatusPanel from "@/components/home/CsvStatusPanel";
import CsvImportStrip from "@/components/home/CsvImportStrip";
import ApStockView from "@/components/home/ApStockView";
import InspectionExportModal from "@/components/home/InspectionExportModal";
import Stat from "@/components/home/Stat";
import ProductMasterManage from "@/components/ProductMasterManage";
import PurchaseManager from "@/lib/PurchaseManage";
import { usePurchaseManager } from "@/lib/usePurchaseManager";
import {
  loadProductMastersFromStorage,
  saveProductMastersToStorage,
} from "@/lib/storage/productMasterStorage";
import {
  loadRowOverridesFromStorage,
  saveRowOverridesToStorage,
} from "@/lib/storage/rowOverrideStorage";

const DEFAULT_PARAMS: OrderParams = {
  product_type: "ready",
  factory_lt_days: 5,
  inspection_type: "simple",
  ap_inspection_lt_days: 3,
  shipping_method: "air",
  international_shipping_lt_days: 5,
  fba_rsl_receiving_lt_days: 3,
  safety_stock_days: 15,
};


type CsvLoadStatus = {
  amazonSales: number | null;
  fbaInventory: number | null;
  rakutenSales: number | null;
  rslInventory: number | null;
  lastFiles: string[];
  errorCount: number;
};

const EMPTY_CSV_LOAD_STATUS: CsvLoadStatus = {
  amazonSales: null,
  fbaInventory: null,
  rakutenSales: null,
  rslInventory: null,
  lastFiles: [],
  errorCount: 0,
};

function getCsvStatusLabel(channel: SalesChannel, kind: CsvDataKind) {
  if (channel === "amazon" && kind === "sales") return "Amazon売上";
  if (channel === "amazon" && kind === "inventory") return "FBA在庫";
  if (channel === "rakuten" && kind === "inventory") return "RSL在庫";
  if (channel === "rakuten") return "楽天売上";
  return "CSV";
}

type ApStockSheetItem = {
  jan: string;
  ap_stock: number;
  product_name?: string;
  url?: string;
  color?: string;
  size?: string;
  [key: string]: unknown;
};


function normalizeApStockItem(input: any): ApStockSheetItem {
  return {
    ...input,
    jan: String(input?.jan ?? input?.JAN ?? "").replace(/\D/g, "").trim(),
    ap_stock: Number(input?.ap_stock ?? input?.stock ?? input?.["在庫数"] ?? input?.["在庫数(pcs)"] ?? 0) || 0,
    product_name: String(input?.product_name ?? input?.name ?? input?.["商品名"] ?? ""),
    url: String(input?.url ?? input?.URL ?? input?.product_url ?? input?.["1688URL"] ?? ""),
    color: String(input?.color ?? input?.["色"] ?? ""),
    size: String(input?.size ?? input?.["型号"] ?? input?.["サイズ"] ?? ""),
  };
}


export default function HomePage() {
  const [params, setParams] = useState<OrderParams>(DEFAULT_PARAMS);
  const [appliedParams, setAppliedParams] = useState<OrderParams>(DEFAULT_PARAMS);
  const [csvRows, setCsvRows] = useState<ComputedSkuRow[]>([]);
  const [rowOverrides, setRowOverrides] = useState<Record<string, Partial<RawSkuRow>>>({});
  const [rowOverridesLoaded, setRowOverridesLoaded] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tableExpandedSkus, setTableExpandedSkus] = useState<Set<string>>(new Set());
  const [tableSortType, setTableSortType] = useState<"priority" | "china" | "fba" | "rsl">("priority");
  const [filterOrderOnly, setFilterOrderOnly] = useState(false);
  const [filterDeliveryOnly, setFilterDeliveryOnly] = useState(false);
  const [tableDisplayLimit, setTableDisplayLimit] = useState(100);
  const [errors, setErrors] = useState<string[]>([]);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filename, setFilename] = useState("");
  const [apStockUpdating, setApStockUpdating] = useState(false);
  const [apStockItems, setApStockItems] = useState<ApStockSheetItem[]>([]);
  const [viewMode, setViewMode] = useState<"table" | "calendar" | "master" | "apStock" | "purchase">("table");
  const [masterFocusSku, setMasterFocusSku] = useState("");
  const [productMasters, setProductMasters] = useState<ProductMasterItem[]>([]);
  const [mastersLoaded, setMastersLoaded] = useState(false);
  const [inspectionModalOpen, setInspectionModalOpen] = useState(false);
  const [inspectionSelections, setInspectionSelections] = useState<InspectionSelections>({});
  const [exportOrderQty, setExportOrderQty] = useState<Record<string, number>>({});
  const [masterNotice, setMasterNotice] = useState("");
  const [csvLoadStatus, setCsvLoadStatus] = useState<CsvLoadStatus>(EMPTY_CSV_LOAD_STATUS);

  useEffect(() => {
    try {
      setProductMasters(loadProductMastersFromStorage(normalizeProductMaster));
    } finally {
      setMastersLoaded(true);
    }
  }, []);

  useEffect(() => {
    try {
      setRowOverrides(loadRowOverridesFromStorage());
    } finally {
      setRowOverridesLoaded(true);
    }
  }, []);


  useEffect(() => {
    if (!rowOverridesLoaded) return;
    saveRowOverridesToStorage(rowOverrides);
  }, [rowOverrides, rowOverridesLoaded]);


  useEffect(() => {
    if (!mastersLoaded) return;

    const result = saveProductMastersToStorage(productMasters);

    if (result === "saved_without_images") {
      setMasterNotice(
        "商品画像データが大きいため、画像を除いて商品マスタを保存しました。SKU/JAN/商品名/セット数/LT等のマスタ情報は保存されています。"
      );
      return;
    }

    if (result === "failed") {
      setMasterNotice(
        "商品マスタの保存容量が上限を超えています。ブラウザ保存では限界があるため、バックアップ出力またはDB保存への切り替えが必要です。"
      );
    }
  }, [productMasters, mastersLoaded]);

  const productMasterBySku = useMemo(() => {
    const map: Record<string, ProductMasterItem> = {};
    productMasters.forEach((item) => {
      const normalized = normalizeProductMaster(item);
      if (normalized.sku) map[normalizeSkuKey(normalized.sku)] = normalized;
    });
    return map;
  }, [productMasters]);

  const productMasterByJan = useMemo(() => {
    const map: Record<string, ProductMasterItem> = {};
    productMasters.forEach((item) => {
      const normalized = normalizeProductMaster(item);
      const jan = normalizeJanKey(normalized.jan);
      if (jan && !map[jan]) map[jan] = normalized;
    });
    return map;
  }, [productMasters]);

  const csvRowBySku = useMemo(() => {
    const map = new Map<string, RawSkuRow>();
    csvRows.forEach((row) => map.set(normalizeSkuKey(row.sku), toRawRow(row)));
    return map;
  }, [csvRows]);

  const csvRowByJan = useMemo(() => {
    const map = new Map<string, RawSkuRow>();
    csvRows.forEach((row) => {
      const jan = normalizeJanKey(row.jan);
      if (jan) map.set(jan, toRawRow(row));
    });
    return map;
  }, [csvRows]);

  const rows = useMemo(() => {
    return buildComputedRows({
      productMasters,
      csvRowBySku,
      csvRowByJan,
      params: appliedParams,
    });
  }, [productMasters, csvRowBySku, csvRowByJan, appliedParams]);

  const {
    purchaseSkus,
    setPurchaseSkus,
    purchaseBreakdownRows,
    purchaseSkuSummaryRows,
    manualPurchaseOrders,
    setManualPurchaseOrders,
  } = usePurchaseManager({
    rows,
    productMasterBySku,
  });

  const csvMatchedCount = useMemo(() => {
    return csvRows.filter((row) => productMasterBySku[row.sku]).length;
  }, [csvRows, productMasterBySku]);

  const draftMasterCount = useMemo(
    () => productMasters.filter((item) => item.master_status === "draft").length,
    [productMasters]
  );

  const handleFile = useCallback(
    async (file: File) => {
      setLoading(true);
      setErrors([]);
      setErrorModalOpen(false);
      setFilename(file.name);
      const { rows: parsedRaw, errors: errs } = await parseCsvFile(file);
      const parsed = canonicalizeCsvRowsByJan(parsedRaw, productMasterBySku, productMasterByJan);
      setErrors(errs);
      setCsvRows(adjustRowsForSetUnits(computeAllRows(parsed, appliedParams), productMasterBySku));
      setCsvLoadStatus((prev) => ({
        ...prev,
        lastFiles: [file.name],
        errorCount: errs.length,
      }));
      setSelected(new Set());
      setTableExpandedSkus(new Set());

      setProductMasters((prev) => {
        const existingBySku = new Map(prev.map((item) => [item.sku, normalizeProductMaster(item)]));
        const nextBySku = new Map(existingBySku);
        let newCount = 0;
        let filledDraftCount = 0;

        parsed.forEach((row) => {
          const existing = nextBySku.get(row.sku);
          if (!existing) {
            nextBySku.set(row.sku, makeDraftMasterFromCsv(row));
            newCount += 1;
            return;
          }

          if (existing.master_status === "draft") {
            const filled = normalizeProductMaster({
              ...existing,
              jan: existing.jan || row.jan,
              product_name: existing.product_name || row.product_name,
              moq: existing.moq || row.moq,
            });
            nextBySku.set(row.sku, filled);
            filledDraftCount += 1;
          }
        });

        const next = Array.from(nextBySku.values()).sort((a, b) =>
          a.sku.localeCompare(b.sku)
        );

        if (newCount > 0) {
          setMasterNotice(
            `新規SKUが${newCount}件見つかったため、商品マスタに仮登録しました。商品画像・1688URL・色・サイズ・仕入単価・備考を補完してください。`
          );
        } else if (filledDraftCount > 0) {
          setMasterNotice(
            `仮登録SKU ${filledDraftCount}件にCSV情報を反映しました。未入力項目を商品マスタで補完してください。`
          );
        } else if (parsed.length > 0) {
          setMasterNotice(`CSV ${parsed.length}件を商品マスタに反映しました。`);
        }

        return next;
      });

      setLoading(false);
    },
    [appliedParams, productMasterBySku, productMasterByJan]
  );

  const handleApplyChannelFiles = useCallback(
    async (items: { file: File; channel: SalesChannel; kind: CsvDataKind }[]) => {
      if (items.length === 0) return;
      setLoading(true);
      setErrors([]);
      setErrorModalOpen(false);
      setFilename(items.map((item) => item.file.name).join(" / "));

      const nextErrors: string[] = [];
      const parsedItems: {
        channel: SalesChannel;
        kind: CsvDataKind;
        rows: Partial<RawSkuRow>[];
      }[] = [];

      for (const item of items) {
        const parsed = await parseChannelCsvFile(item.file, item.channel, item.kind);
        nextErrors.push(...parsed.errors);
        parsedItems.push({
          channel: item.channel,
          kind: item.kind,
          rows: parsed.rows,
        });
      }

      const { nextRows, touchedKeys, loadedCounts } = buildMergedChannelRows({
        existingRows: csvRows.map(toRawRow),
        parsedItems,
        productMasterBySku,
        productMasterByJan,
      });

      setCsvRows(adjustRowsForSetUnits(computeAllRows(nextRows, appliedParams), productMasterBySku));
      setErrors(nextErrors);
      setCsvLoadStatus((prev) => ({
        amazonSales: loadedCounts.amazonSales ?? prev.amazonSales,
        fbaInventory: loadedCounts.fbaInventory ?? prev.fbaInventory,
        rakutenSales: loadedCounts.rakutenSales ?? prev.rakutenSales,
        rslInventory: loadedCounts.rslInventory ?? prev.rslInventory,
        lastFiles: items.map((item) => `${getCsvStatusLabel(item.channel, item.kind)}：${item.file.name}`),
        errorCount: nextErrors.length,
      }));
      setSelected(new Set());
      setTableExpandedSkus(new Set());

      setProductMasters((prev) => {
        const nextBySku = new Map(prev.map((item) => [normalizeSkuKey(item.sku), normalizeProductMaster(item)]));
        let newCount = 0;

        nextRows.forEach((row) => {
          const canonical = getCanonicalKeyForCsvRow(row, productMasterBySku, productMasterByJan);
          if (!touchedKeys.has(canonical.key)) return;

          const existing = nextBySku.get(normalizeSkuKey(row.sku));
          if (!existing) {
            nextBySku.set(normalizeSkuKey(row.sku), makeDraftMasterFromCsv(row));
            newCount += 1;
          } else if (existing.master_status === "draft") {
            nextBySku.set(
              normalizeSkuKey(row.sku),
              normalizeProductMaster({
                ...existing,
                jan: existing.jan || row.jan,
                product_name: existing.product_name || row.product_name,
                moq: existing.moq || row.moq,
              })
            );
          }
        });

        if (newCount > 0) {
          setMasterNotice(
            `新規SKUが${newCount}件見つかったため、商品マスタに仮登録しました。商品画像・1688URL・色・サイズ・仕入単価・備考を補完してください。`
          );
        } else {
          setMasterNotice(`CSV ${items.length}ファイルを反映しました。JANが一致するAmazon/楽天データは同一商品として統合しています。`);
        }
        return Array.from(nextBySku.values()).sort((a, b) => a.sku.localeCompare(b.sku));
      });

      setLoading(false);
    },
    [csvRows, appliedParams, productMasterBySku, productMasterByJan]
  );

  const handleToggle = (sku: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(sku) ? next.delete(sku) : next.add(sku);
      return next;
    });
  };

  const handleToggleAll = (skus: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (skus.length === 0) {
        rows.forEach((r) => next.delete(r.sku));
      } else {
        skus.forEach((s) => next.add(s));
      }
      return next;
    });
  };

  const handleEditRow = (originalSku: string, updates: Partial<RawSkuRow>) => {
    const nextSku = updates.sku ? String(updates.sku).trim() : originalSku;

    if (
      updates.sku !== undefined ||
      updates.jan !== undefined ||
      updates.product_name !== undefined ||
      updates.moq !== undefined
    ) {
      setProductMasters((prev) =>
        prev
          .map((item) => {
            if (item.sku !== originalSku) return item;
            return normalizeProductMaster({
              ...item,
              sku: nextSku,
              jan: updates.jan !== undefined ? updates.jan : item.jan,
              product_name:
                updates.product_name !== undefined ? updates.product_name : item.product_name,
              moq: updates.moq !== undefined ? updates.moq : item.moq,
              master_status: "complete",
            });
          })
          .sort((a, b) => a.sku.localeCompare(b.sku))
      );
    }

    const overrideUpdates: Partial<RawSkuRow> = { ...updates };
    delete overrideUpdates.sku;
    delete overrideUpdates.jan;
    delete overrideUpdates.product_name;
    delete overrideUpdates.moq;

    if (Object.keys(overrideUpdates).length > 0 || nextSku !== originalSku) {
      setRowOverrides((prev) => {
        const current = prev[originalSku] ?? {};
        const next = { ...prev };
        delete next[originalSku];
        next[nextSku] = { ...current, ...overrideUpdates };
        return next;
      });
    }

    if (nextSku !== originalSku) {
      setSelected((prev) => {
        if (!prev.has(originalSku)) return prev;
        const next = new Set(prev);
        next.delete(originalSku);
        next.add(nextSku);
        return next;
      });
    }
  };

  const selectedRowsForExport = useMemo(
    () => rows.filter((r) => selected.has(r.sku)),
    [rows, selected]
  );

  const handleDownload = () => {
    if (selectedRowsForExport.length === 0) {
      alert("ダウンロードするSKUを選択してください");
      return;
    }

    setInspectionSelections((prev) => {
      const next: InspectionSelections = { ...prev };
      selectedRowsForExport.forEach((row) => {
        if (!next[row.sku]) {
          const masterDefaultItems = productMasterBySku[row.sku]?.default_inspection_items ?? [];
          next[row.sku] = masterDefaultItems.filter((item): item is InspectionItem =>
            (INSPECTION_ITEMS as readonly string[]).includes(item)
          );
        }
      });
      return next;
    });

    setExportOrderQty((prev) => {
      const next: Record<string, number> = { ...prev };
      selectedRowsForExport.forEach((row) => {
        if (next[row.sku] === undefined) {
          next[row.sku] = row.recommended_order_qty;
        }
      });
      return next;
    });

    setInspectionModalOpen(true);
  };

  const handleConfirmDownload = () => {
    const selectedRows = rows.filter((r) => selected.has(r.sku));
    if (selectedRows.length === 0) {
      alert("ダウンロードするSKUを選択してください");
      setInspectionModalOpen(false);
      return;
    }

    const rowsForExport = selectedRows.map((row) => ({
      ...row,
      recommended_order_qty:
        exportOrderQty[row.sku] === undefined
          ? row.recommended_order_qty
          : Math.max(0, Math.floor(Number(exportOrderQty[row.sku]) || 0)),
    }));

    const content = buildOrderCsvContent(rowsForExport, inspectionSelections, productMasterBySku);
    const ts = new Date().toISOString().slice(0, 10);
    downloadCsv(content, `order_${ts}.csv`);
    setInspectionModalOpen(false);
  };

  const handleSpreadsheet = () => {
    alert("現在は未実装です。将来的にGoogleスプレッドシートへ発注表を作成します。");
  };

  const normalizeJan = (value: unknown) =>
    String(value ?? "").replace(/\D/g, "").trim();

  const handleUpdateApStock = async () => {
    if (productMasters.length === 0) {
      alert("先に商品マスタまたはCSVを読み込んでください");
      return;
    }

    setApStockUpdating(true);
    try {
      const res = await fetch("/api/ap-stock", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "AP在庫の取得に失敗しました");
      }

      const items: ApStockSheetItem[] = (Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data)
        ? data
        : []).map(normalizeApStockItem);

      setApStockItems(items);

      const {
        nextRawRows,
        updated,
        noJan,
        unmatched,
      } = buildRowsWithApStock({
        productMasters,
        csvRows: csvRows.map(toRawRow),
        apStockItems: items,
      });

      setCsvRows(adjustRowsForSetUnits(computeAllRows(nextRawRows, appliedParams), productMasterBySku));

      alert(
        `AP在庫を更新しました\n更新：${updated}件\nJAN未入力：${noJan}件\nJAN一致なし：${unmatched}件`
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "AP在庫の更新に失敗しました");
    } finally {
      setApStockUpdating(false);
    }
  };



  const totalSkus = productMasters.length;
  const orderRecommended = rows.filter((r) => r.status === "発注推奨").length;
  const deliveryRecommended = rows.filter((r) => r.fba_recommended_delivery_qty > 0 || r.rsl_recommended_delivery_qty > 0).length;
  const totalOrderQty = rows.reduce((s, r) => s + r.recommended_order_qty, 0);

  const tableVisibleSkus = useMemo(() => {
    const filtered = filterOrderOnly || filterDeliveryOnly
      ? rows.filter((row) => {
          const isOrder = row.status === "発注推奨" || row.recommended_order_qty > 0;
          const isDelivery = row.fba_recommended_delivery_qty > 0 || row.rsl_recommended_delivery_qty > 0;
          return (filterOrderOnly && isOrder) || (filterDeliveryOnly && isDelivery);
        })
      : rows;

    return [...filtered]
      .sort((a, b) => {
        if (tableSortType === "china") {
          return Number(b.recommended_order_qty || 0) - Number(a.recommended_order_qty || 0);
        }

        if (tableSortType === "fba") {
          return Number(b.fba_recommended_delivery_qty || 0) - Number(a.fba_recommended_delivery_qty || 0);
        }

        if (tableSortType === "rsl") {
          return Number(b.rsl_recommended_delivery_qty || 0) - Number(a.rsl_recommended_delivery_qty || 0);
        }

        const aPriority =
          (a.recommended_order_qty > 0 ? 1000000000 : 0) +
          a.recommended_order_qty +
          a.fba_recommended_delivery_qty +
          a.rsl_recommended_delivery_qty;
        const bPriority =
          (b.recommended_order_qty > 0 ? 1000000000 : 0) +
          b.recommended_order_qty +
          b.fba_recommended_delivery_qty +
          b.rsl_recommended_delivery_qty;

        return bPriority - aPriority;
      })
      .map((row) => row.sku);
  }, [rows, filterOrderOnly, filterDeliveryOnly, tableSortType]);

  useEffect(() => {
    setTableDisplayLimit(100);
  }, [filterOrderOnly, filterDeliveryOnly, tableSortType]);

  const tableDisplayedSkus = useMemo(
    () => tableVisibleSkus.slice(0, tableDisplayLimit),
    [tableVisibleSkus, tableDisplayLimit]
  );

  const tableDisplayedRows = useMemo(() => {
    const rowBySku = new Map(rows.map((row) => [row.sku, row]));
    return tableDisplayedSkus
      .map((sku) => rowBySku.get(sku))
      .filter((row): row is ComputedSkuRow => Boolean(row));
  }, [rows, tableDisplayedSkus]);


  const tableAllChecked = tableDisplayedSkus.length > 0 && tableDisplayedSkus.every((sku) => selected.has(sku));
  const tableSomeChecked = tableDisplayedSkus.some((sku) => selected.has(sku));

  const toggleTableExpanded = (sku: string) => {
    setTableExpandedSkus((prev) => {
      const next = new Set(prev);
      next.has(sku) ? next.delete(sku) : next.add(sku);
      return next;
    });
  };

  const showWorkspace = productMasters.length > 0 || csvRows.length > 0;

  const openProductMasterForSku = (sku: string) => {
    setMasterFocusSku(sku);
    setViewMode("master");
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white text-gray-900">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <button
          type="button"
          onClick={() => setViewMode("table")}
          title="一覧へ戻る"
          className="flex items-center rounded-lg transition hover:opacity-80"
        >
          <img
            src="/logo.png"
            alt="ALIPARTNERS"
            className="h-12 w-auto"
          />
        </button>

        {totalSkus > 0 && (
          <div className="flex gap-8 text-right">
            <Stat label="登録SKU" value={totalSkus} />
            <Stat label="発注推奨" value={orderRecommended} accent="red" />
            <Stat label="合計発注数" value={totalOrderQty} accent="amber" />
          </div>
        )}
      </header>

      <TopTabs viewMode={viewMode} onChange={setViewMode} />

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
        {viewMode === "master" ? (
          <ProductMasterManage
            masters={productMasters.map(normalizeProductMaster)}
            onChange={setProductMasters}
            onBack={() => setViewMode("table")}
            focusSku={masterFocusSku}
            purchaseSkus={purchaseSkus}
          />
        ) : (
          <>
            <div className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-5 py-3 shadow-sm">
              <div className="flex min-w-0 items-center gap-4">
                <span className="max-w-[220px] truncate font-mono text-xs text-gray-500">
                  {filename || "CSV未読込"}
                </span>
                {csvRows.length > 0 && (
                  <span className="text-xs font-bold text-emerald-600">
                    CSV反映 {csvMatchedCount}/{csvRows.length}件
                  </span>
                )}
                {draftMasterCount > 0 && (
                  <button
                    onClick={() => setViewMode("master")}
                    className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 hover:bg-amber-100"
                  >
                    要補完 {draftMasterCount}件
                  </button>
                )}
                {errors.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setErrorModalOpen(true)}
                    className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 hover:bg-amber-100"
                    title="CSVエラーの詳細を表示"
                  >
                    ⚠ {errors.length}件のエラー
                  </button>
                )}
              </div>

              {viewMode === "table" && (
                <div className="flex items-center gap-4">
                  {selected.size > 0 && (
                    <span className="text-xs font-semibold text-indigo-600">
                      {selected.size}件選択中
                    </span>
                  )}

                  <button
                    onClick={handleUpdateApStock}
                    disabled={apStockUpdating}
                    className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {apStockUpdating ? "在庫更新中…" : "AP在庫を更新"}
                  </button>

                  <button
                    onClick={handleSpreadsheet}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                  >
                    スプレッドシート発注表作成
                  </button>

                  <button
                    onClick={handleDownload}
                    disabled={selected.size === 0}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ↓ 発注CSVダウンロード
                  </button>
                </div>
              )}
            </div>

            {masterNotice && (
              <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-xs font-bold text-amber-800">
                {masterNotice}
                <button
                  onClick={() => setMasterNotice("")}
                  className="ml-4 text-amber-600 underline underline-offset-2"
                >
                  閉じる
                </button>
              </div>
            )}

            {viewMode === "table" && (
              <CsvImportStrip
                filename={filename}
                loading={loading}
                onFile={handleFile}
                onApplyFiles={handleApplyChannelFiles}
                csvLoadStatus={csvLoadStatus}
              />
            )}

            {viewMode === "table" && (
              <TableOperationBar
                visibleSkus={tableDisplayedSkus}
                totalVisibleCount={tableVisibleSkus.length}
                shownCount={tableDisplayedSkus.length}
                displayLimit={tableDisplayLimit}
                onDisplayLimitChange={setTableDisplayLimit}
                allChecked={tableAllChecked}
                someChecked={tableSomeChecked}
                onToggleAll={handleToggleAll}
                sortType={tableSortType}
                onSortTypeChange={setTableSortType}
                filterOrderOnly={filterOrderOnly}
                filterDeliveryOnly={filterDeliveryOnly}
                onToggleOrderFilter={() => setFilterOrderOnly((v) => !v)}
                onToggleDeliveryFilter={() => setFilterDeliveryOnly((v) => !v)}
                expandedCount={tableExpandedSkus.size}
                onExpandAll={() => setTableExpandedSkus(new Set(tableDisplayedSkus))}
                onCollapseAll={() => setTableExpandedSkus(new Set())}
              />
            )}

            <div className="min-h-0 flex-1 overflow-auto">
              {viewMode === "table" ? (
                <OrderTable
                  rows={tableDisplayedRows}
                  selected={selected}
                  onToggle={handleToggle}
                  onToggleAll={handleToggleAll}
                  filterOrderOnly={filterOrderOnly}
                  filterDeliveryOnly={filterDeliveryOnly}
                  params={appliedParams}
                  productMasters={productMasterBySku}
                  inspectionSelections={inspectionSelections}
                  onOpenMaster={openProductMasterForSku}
                  sortType={tableSortType}
                  expandedSkus={tableExpandedSkus}
                  onToggleExpanded={toggleTableExpanded}
                />
              ) : viewMode === "purchase" ? (
                <PurchaseManager
                  purchaseSkus={purchaseSkus}
                  setPurchaseSkus={setPurchaseSkus}
                  purchaseBreakdownRows={purchaseBreakdownRows}
                  purchaseSkuSummaryRows={purchaseSkuSummaryRows}
                  manualPurchaseOrders={manualPurchaseOrders}
                  setManualPurchaseOrders={setManualPurchaseOrders}
                  onOpenMaster={openProductMasterForSku}
                  productMasters={productMasterBySku}
                />
              ) : viewMode === "apStock" ? (
                <ApStockView
                  rows={rows}
                  productMasters={productMasterBySku}
                  apStockItems={apStockItems}
                  onRefresh={handleUpdateApStock}
                  updating={apStockUpdating}
                />
              ) : (
                <OrderCalendar
                  rows={rows}
                  selected={selected}
                  onToggle={handleToggle}
                  onDownloadOrderCsv={handleDownload}
                  filterOrderOnly={filterOrderOnly}
                  productMasters={productMasterBySku}
                  inspectionSelections={inspectionSelections}
                />
              )}
            </div>
          </>
        )}
      </main>

      <InspectionExportModal
        open={inspectionModalOpen}
        rows={selectedRowsForExport}
        selections={inspectionSelections}
        onChange={setInspectionSelections}
        orderQty={exportOrderQty}
        onOrderQtyChange={setExportOrderQty}
        productMasters={productMasterBySku}
        onClose={() => setInspectionModalOpen(false)}
        onConfirm={handleConfirmDownload}
      />

      <CsvErrorModal
        open={errorModalOpen}
        errors={errors}
        onClose={() => setErrorModalOpen(false)}
      />
    </div>
  );
}
