"use client";

import {
  normalizeSkuKey,
  normalizeJanKey,
} from "@/lib/normalizers";

import {
  mergeRawSkuRow,
  getMasterForCsvRow,
  getCanonicalKeyForCsvRow,
  canonicalizeCsvRowsByJan,
} from "@/lib/csvMergeEngine";

import { useState, useCallback, useMemo, useEffect } from "react";
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


function getAmazonImageUrlFromAsin(asin: unknown): string {
  const value = String(asin ?? "").trim().toUpperCase();

  // ASINは通常10桁。違う形式は画像URL自動生成しない。
  if (!/^[A-Z0-9]{10}$/.test(value)) return "";

  // AmazonのASINベース画像URL候補。
  // 画像本体ではなくURL文字列だけを保存するため、localStorage容量を圧迫しない。
  return `https://images-na.ssl-images-amazon.com/images/P/${value}.09.LZZZZZZZ.jpg`;
}

function normalizeProductMaster(input: any): ProductMasterItem {
  const optionalNumber = (value: unknown): number | undefined => {
    if (value === undefined || value === null || value === "") return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  };
  const optionalProductType = (value: unknown) => value === "oem" || value === "ready" ? value : undefined;
  const optionalInspectionType = (value: unknown) => value === "detailed" || value === "simple" ? value : undefined;
  const optionalShippingMethod = (value: unknown) => value === "sea" || value === "air" ? value : undefined;
  const optionalItemType = (value: unknown) => {
    const text = String(value ?? "").trim();

    if (text === "single" || text === "単品") return "single";
    if (text === "set" || text === "セット") return "set";
    if (text === "bundle" || text === "付属品") return "bundle";

    return "single";
  };
  const normalizeComponentJan = (value: unknown) => String(value ?? "").replace(/\D/g, "").trim();
  const normalizeComponentQty = (value: unknown) => {
    if (value === undefined || value === null || value === "") return 1;
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 1;
  };

  const inspectionItems = Array.isArray(input.default_inspection_items)
    ? input.default_inspection_items.filter((item: unknown): item is string =>
        (INSPECTION_ITEMS as readonly string[]).includes(String(item))
      )
    : [];

  const rawUnitPerSet = Number(input.unit_per_set ?? input.set_count ?? input["セット数"] ?? 1);
  const unitPerSet = Number.isFinite(rawUnitPerSet) && rawUnitPerSet > 0
    ? Math.max(1, Math.floor(rawUnitPerSet))
    : 1;

  return {
    sku: String(input.sku ?? "").trim(),
    jan: String(input.jan ?? ""),
    asin: String(input.asin ?? input.ASIN ?? ""),
    product_name: String(input.product_name ?? ""),
    image_url: String(input.image_url ?? "") || getAmazonImageUrlFromAsin(input.asin ?? input.ASIN),
    product_url: String(input.product_url ?? ""),
    color: String(input.color ?? ""),
    size: String(input.size ?? ""),
    cost_rmb: Number(input.cost_rmb) || 0,
    moq: Number(input.moq) || 0,
    order_unit: optionalNumber(input.order_unit),
    product_type: optionalProductType(input.product_type) as ProductMasterItem["product_type"],
    factory_lt_days: optionalNumber(input.factory_lt_days),
    inspection_type: optionalInspectionType(input.inspection_type) as ProductMasterItem["inspection_type"],
    ap_inspection_lt_days: optionalNumber(input.ap_inspection_lt_days),
    shipping_method: optionalShippingMethod(input.shipping_method) as ProductMasterItem["shipping_method"],
    international_shipping_lt_days: optionalNumber(input.international_shipping_lt_days),
    fba_rsl_receiving_lt_days: optionalNumber(input.fba_rsl_receiving_lt_days),
    safety_stock_days: optionalNumber(input.safety_stock_days),
    ...({ unit_per_set: unitPerSet } as unknown as Partial<ProductMasterItem>),
    item_type: optionalItemType(input.item_type ?? input["商品種別"] ?? input["商品構成"]),
    component_jan_1: normalizeComponentJan(input.component_jan_1),
    component_qty_1: normalizeComponentQty(input.component_qty_1),
    component_jan_2: normalizeComponentJan(input.component_jan_2),
    component_qty_2: normalizeComponentQty(input.component_qty_2),
    component_jan_3: normalizeComponentJan(input.component_jan_3),
    component_qty_3: normalizeComponentQty(input.component_qty_3),
    component_jan_4: normalizeComponentJan(input.component_jan_4),
    component_qty_4: normalizeComponentQty(input.component_qty_4),
    component_jan_5: normalizeComponentJan(input.component_jan_5),
    component_qty_5: normalizeComponentQty(input.component_qty_5),
    component_purchase_sku_1: String(input.component_purchase_sku_1 ?? "").trim(),
    component_purchase_sku_2: String(input.component_purchase_sku_2 ?? "").trim(),
    component_purchase_sku_3: String(input.component_purchase_sku_3 ?? "").trim(),
    component_purchase_sku_4: String(input.component_purchase_sku_4 ?? "").trim(),
    component_purchase_sku_5: String(input.component_purchase_sku_5 ?? "").trim(),
    default_inspection_items: inspectionItems,
    memo: String(input.memo ?? input.default_memo ?? ""),
    factory_name: String(input.factory_name ?? ""),
    master_status: input.master_status === "draft" ? "draft" : "complete",
  };
}


function makeDraftMasterFromCsv(row: RawSkuRow): ProductMasterItem {
  return normalizeProductMaster({
    sku: row.sku,
    jan: row.jan,
    asin: (row as any).asin ?? "",
    product_name: row.product_name,
    moq: row.moq,
    master_status: "draft",
  });
}

function getUnitPerSetFromMaster(master?: ProductMasterItem) {
  const raw = Number((master as unknown as { unit_per_set?: unknown } | undefined)?.unit_per_set ?? 1);
  return Number.isFinite(raw) && raw > 0 ? Math.max(1, Math.floor(raw)) : 1;
}

function adjustRowsForSetUnits(rows: ComputedSkuRow[], productMasterBySku: Record<string, ProductMasterItem>): ComputedSkuRow[] {
  return rows.map((row) => {
    const master = productMasterBySku[row.sku];
    const unitPerSet = getUnitPerSetFromMaster(master);

    const fbaRequiredSet = Number(row.fba_required_stock || 0);
    const rslRequiredSet = Number(row.rsl_required_stock || 0);
    const fbaStockSet = Number(row.amazon_stock || 0);
    const rslStockSet = Number(row.rakuten_stock || 0);
    const fbaInboundSet = Number(row.fba_inbound_plan || 0);
    const rslInboundSet = Number(row.rsl_inbound_plan || 0);
    const apStockEach = Number(row.ap_stock || 0);
    const apStockSet = unitPerSet > 1 ? Math.floor(apStockEach / unitPerSet) : apStockEach;

    const requiredTotalSet = fbaRequiredSet + rslRequiredSet;
    const availableTotalSet = fbaStockSet + rslStockSet + fbaInboundSet + rslInboundSet + apStockSet;
    const shortageSet = Math.max(0, requiredTotalSet - availableTotalSet);
    const recommendedOrderQtyBara = shortageSet * unitPerSet;
    const status: ComputedSkuRow["status"] = shortageSet > 0
      ? "発注推奨"
      : row.fba_recommended_delivery_qty > 0 || row.rsl_recommended_delivery_qty > 0
        ? "納品推奨"
        : "対応不要";

    const next = {
      ...row,
      ...({ unit_per_set: unitPerSet } as unknown as Partial<ComputedSkuRow>),
      // shortage_qty はセット単位。中国発注数は個（バラ）単位。
      shortage_qty: shortageSet,
      recommended_order_qty: recommendedOrderQtyBara,
      status,
    };

    return next;
  });
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
    const baseRows: RawSkuRow[] = productMasters.map((master) => {
      const csv = csvRowBySku.get(normalizeSkuKey(master.sku)) || csvRowByJan.get(normalizeJanKey(master.jan));
      return {
        sku: master.sku,
        jan: master.jan || csv?.jan || "",
        product_name: master.product_name || csv?.product_name || "",
        item_type: master.item_type,
        component_jan_1: master.component_jan_1,
        component_qty_1: master.component_qty_1,
        component_jan_2: master.component_jan_2,
        component_qty_2: master.component_qty_2,
        component_jan_3: master.component_jan_3,
        component_qty_3: master.component_qty_3,
        component_jan_4: master.component_jan_4,
        component_qty_4: master.component_qty_4,
        component_jan_5: master.component_jan_5,
        component_qty_5: master.component_qty_5,
        monthly_sales: csv?.monthly_sales ?? 0,
        fba_stock: csv?.fba_stock ?? 0,
        rsl_stock: csv?.rsl_stock ?? 0,
        ap_stock: csv?.ap_stock ?? 0,
        inbound: csv?.inbound ?? 0,
        amazon_monthly_sales: csv?.amazon_monthly_sales ?? 0,
        rakuten_monthly_sales: csv?.rakuten_monthly_sales ?? 0,
        amazon_stock: csv?.amazon_stock ?? 0,
        rakuten_stock: csv?.rakuten_stock ?? 0,
        fba_inbound_plan: csv?.fba_inbound_plan ?? 0,
        rsl_inbound_plan: csv?.rsl_inbound_plan ?? 0,
        fba_required_stock: 0,
        rsl_required_stock: 0,
        moq: master.moq || csv?.moq || 0,
        order_unit: master.order_unit || csv?.order_unit || 0,
        product_type: master.product_type ?? csv?.product_type,
        factory_lt_days: master.factory_lt_days ?? csv?.factory_lt_days,
        inspection_type: master.inspection_type ?? csv?.inspection_type,
        ap_inspection_lt_days: master.ap_inspection_lt_days ?? csv?.ap_inspection_lt_days,
        shipping_method: master.shipping_method ?? csv?.shipping_method,
        international_shipping_lt_days: master.international_shipping_lt_days ?? csv?.international_shipping_lt_days,
        fba_rsl_receiving_lt_days: master.fba_rsl_receiving_lt_days ?? csv?.fba_rsl_receiving_lt_days,
        safety_stock_days: master.safety_stock_days ?? csv?.safety_stock_days,
        ...({ unit_per_set: getUnitPerSetFromMaster(master) } as unknown as Partial<RawSkuRow>),
      };
    });

    return computeAllRows(baseRows, appliedParams);
  }, [productMasters, csvRowBySku, csvRowByJan, appliedParams, productMasterBySku]);

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

      // ここがJAN統合の中核。
      // 既存行も「SKU」ではなく「JAN優先キー」で持ち直すことで、
      // Amazon SKU と 楽天 SKU が違っても同一JANなら1行に統合する。
      const merged = new Map<string, RawSkuRow>();
      canonicalizeCsvRowsByJan(csvRows.map(toRawRow), productMasterBySku, productMasterByJan).forEach((row) => {
        const canonical = getCanonicalKeyForCsvRow(row, productMasterBySku, productMasterByJan);
        if (canonical.key) merged.set(canonical.key, row);
      });

      const nextErrors: string[] = [];
      const touchedKeys = new Set<string>();

      const loadedCounts: Partial<Record<"amazonSales" | "fbaInventory" | "rakutenSales" | "rslInventory", number>> = {};

      for (const item of items) {
        const parsed = await parseChannelCsvFile(item.file, item.channel, item.kind);
        nextErrors.push(...parsed.errors);

        if (item.channel === "rakuten") {
          const statusKey = item.kind === "inventory" ? "rslInventory" : "rakutenSales";
          loadedCounts[statusKey] = (loadedCounts[statusKey] ?? 0) + parsed.rows.length;
        } else {
          const statusKey = item.kind === "sales" ? "amazonSales" : "fbaInventory";
          loadedCounts[statusKey] = (loadedCounts[statusKey] ?? 0) + parsed.rows.length;
        }

        parsed.rows.forEach((partial) => {
          if (!partial.sku && !partial.jan) return;

          // 楽天SKU実績レポートは「売上」として扱う。
          // 旧レポート内の在庫列で、在庫エイジング由来のRSL在庫を上書きしない。
          const normalizedPartial: Partial<RawSkuRow> =
            item.channel === "rakuten" && item.kind === "sales"
              ? {
                  ...partial,
                  rsl_stock: undefined,
                  rakuten_stock: undefined,
                  rsl_inbound_plan: undefined,
                }
              : partial;

          const canonical = getCanonicalKeyForCsvRow(normalizedPartial, productMasterBySku, productMasterByJan);
          if (!canonical.key || !canonical.sku) return;

          touchedKeys.add(canonical.key);

          const current = merged.get(canonical.key);
          merged.set(
            canonical.key,
            mergeRawSkuRow(current, normalizedPartial, canonical.sku, canonical.jan)
          );
        });
      }

      const nextRows = Array.from(merged.values());
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

      const stockByJan = new Map<string, number>();
      items.forEach((item) => {
        const jan = normalizeJan(item.jan);
        const stock = Number(item.ap_stock);
        if (jan && Number.isFinite(stock)) stockByJan.set(jan, stock);
      });

      let updated = 0;
      let noJan = 0;
      let unmatched = 0;

      const csvMap = new Map(csvRows.map((row) => [row.sku, toRawRow(row)]));
      const nextRawRows: RawSkuRow[] = [];

      productMasters.forEach((master) => {
        const jan = normalizeJan(master.jan);
        const existing = csvMap.get(master.sku);

        if (!jan) {
          noJan += 1;
          if (existing) nextRawRows.push(existing);
          return;
        }

        if (!stockByJan.has(jan)) {
          unmatched += 1;
          if (existing) nextRawRows.push(existing);
          return;
        }

        updated += 1;
        nextRawRows.push({
          sku: master.sku,
          jan: master.jan,
          product_name: master.product_name,
          item_type: master.item_type,
          component_jan_1: master.component_jan_1,
          component_qty_1: master.component_qty_1,
          component_jan_2: master.component_jan_2,
          component_qty_2: master.component_qty_2,
          component_jan_3: master.component_jan_3,
          component_qty_3: master.component_qty_3,
          component_jan_4: master.component_jan_4,
          component_qty_4: master.component_qty_4,
          component_jan_5: master.component_jan_5,
          component_qty_5: master.component_qty_5,
          monthly_sales: existing?.monthly_sales ?? 0,
          fba_stock: existing?.fba_stock ?? 0,
          rsl_stock: existing?.rsl_stock ?? 0,
          ap_stock: stockByJan.get(jan) ?? existing?.ap_stock ?? 0,
          inbound: existing?.inbound ?? 0,
          amazon_monthly_sales: existing?.amazon_monthly_sales ?? 0,
          rakuten_monthly_sales: existing?.rakuten_monthly_sales ?? 0,
          amazon_stock: existing?.amazon_stock ?? 0,
          rakuten_stock: existing?.rakuten_stock ?? 0,
          fba_inbound_plan: existing?.fba_inbound_plan ?? 0,
          rsl_inbound_plan: existing?.rsl_inbound_plan ?? 0,
          fba_required_stock: existing?.fba_required_stock ?? 0,
          rsl_required_stock: existing?.rsl_required_stock ?? 0,
          moq: master.moq || existing?.moq || 0,
          order_unit: existing?.order_unit ?? 0,
          ...({ unit_per_set: getUnitPerSetFromMaster(master) } as unknown as Partial<RawSkuRow>),
        });
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

function ApStockView({
  rows,
  productMasters,
  apStockItems,
  onRefresh,
  updating,
}: {
  rows: ComputedSkuRow[];
  productMasters: Record<string, ProductMasterItem>;
  apStockItems: ApStockSheetItem[];
  onRefresh: () => void;
  updating: boolean;
}) {
  const [apStatusFilter, setApStatusFilter] = useState<"all" | "shortage" | "excess" | "exact">("all");

  const normalizeJan = (value: unknown) => String(value ?? "").replace(/\D/g, "").trim();
  const rowByJan = new Map(rows.map((row) => [normalizeJan(row.jan), row]));

  const displayItems = useMemo(() => {
    const source = apStockItems.length > 0
      ? apStockItems
      : rows.map((row) => {
          const master = productMasters[row.sku];
          return { jan: row.jan, product_name: row.product_name, ap_stock: row.ap_stock, url: master?.product_url, color: master?.color, size: master?.size } as ApStockSheetItem;
        });

    return source.map((item, idx) => {
      const matched = rowByJan.get(normalizeJan(item.jan));
      const master = matched ? productMasters[matched.sku] : undefined;
      const rawUnitPerSet = Number((master as any)?.unit_per_set ?? (matched as any)?.unit_per_set ?? 1);
      const unitPerSet = Number.isFinite(rawUnitPerSet) && rawUnitPerSet > 0 ? Math.floor(rawUnitPerSet) : 1;

      // AP在庫は「個（バラ）」管理。FBA/RSL推奨納品数は「セット」管理。
      // そのため、AP在庫は一度セット換算してから割当・不足を計算する。
      const apStock = Number(item.ap_stock) || 0;
      const apStockSet = unitPerSet > 1 ? Math.floor(apStock / unitPerSet) : apStock;
      const fbaRecommend = matched?.fba_recommended_delivery_qty ?? 0;
      const rslRecommend = matched?.rsl_recommended_delivery_qty ?? 0;

      // 割当はセット単位
      const fbaAlloc = Math.min(apStockSet, fbaRecommend);
      const rslAlloc = Math.min(Math.max(0, apStockSet - fbaAlloc), rslRecommend);
      const apRemainSet = Math.max(0, apStockSet - fbaAlloc - rslAlloc);
      const shortageSet = Math.max(0, fbaRecommend + rslRecommend - apStockSet);

      // 表示・集計用の余剰/不足は個（バラ）単位
      const apRemain = unitPerSet > 1 ? apRemainSet * unitPerSet + (apStock % unitPerSet) : apRemainSet;
      const shortage = unitPerSet > 1 ? shortageSet * unitPerSet : shortageSet;

      return {
        key: `${item.jan || matched?.sku || idx}-${idx}`,
        item,
        row: matched,
        master,
        unitPerSet,
        apStock,
        apStockSet,
        fbaRecommend,
        rslRecommend,
        fbaAlloc,
        rslAlloc,
        apRemain,
        apRemainSet,
        shortage,
        shortageSet,
      };
    });
  }, [apStockItems, rows, productMasters]);

  const filteredDisplayItems = useMemo(() => {
    return displayItems.filter((item) => {
      if (apStatusFilter === "shortage") return item.shortage > 0;
      if (apStatusFilter === "excess") return item.apRemain > 0;
      if (apStatusFilter === "exact") return item.shortage === 0 && item.apRemain === 0;
      return true;
    });
  }, [displayItems, apStatusFilter]);

  const fmt = (value: number) => Number(value || 0).toLocaleString();

  return (
    <div className="flex-1 overflow-auto bg-gray-50 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-base font-black text-gray-900">AP在庫</h2>
          <p className="mt-1 text-xs text-gray-500">FBA/RSLへの推奨納品数に対してAP在庫が足りるか確認します。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-bold text-gray-500">状態</span>
          <button
            type="button"
            onClick={() => setApStatusFilter("all")}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              apStatusFilter === "all"
                ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}
          >
            すべて
          </button>
          <button
            type="button"
            onClick={() => setApStatusFilter("shortage")}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              apStatusFilter === "shortage"
                ? "border-red-200 bg-red-50 text-red-600"
                : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}
          >
            不足
          </button>
          <button
            type="button"
            onClick={() => setApStatusFilter("excess")}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              apStatusFilter === "excess"
                ? "border-sky-200 bg-sky-50 text-sky-700"
                : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}
          >
            余剰
          </button>
          <button
            type="button"
            onClick={() => setApStatusFilter("exact")}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              apStatusFilter === "exact"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}
          >
            ちょうど
          </button>
          <span className="text-xs font-semibold text-gray-500">
            {filteredDisplayItems.length.toLocaleString()}/{displayItems.length.toLocaleString()}件表示
          </span>
        </div>
        <button type="button" onClick={onRefresh} disabled={updating} className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50">
          {updating ? "在庫更新中…" : "AP在庫を更新"}
        </button>
      </div>

      <div className="max-h-[calc(100vh-260px)] overflow-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-[1280px] w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-20 bg-gray-100 text-[11px] font-bold text-gray-500 shadow-sm"><tr>
            <th className="border-b border-gray-200 px-3 py-2">商品</th><th className="border-b border-gray-200 px-3 py-2">URL</th><th className="border-b border-gray-200 px-3 py-2">JAN</th><th className="border-b border-gray-200 px-3 py-2">色</th><th className="border-b border-gray-200 px-3 py-2">型号/サイズ</th><th className="border-b border-gray-200 px-3 py-2 text-right">AP在庫（バラ）</th><th className="border-b border-gray-200 px-3 py-2 text-right">FBA推奨納品数</th><th className="border-b border-gray-200 px-3 py-2 text-right">RSL推奨納品数</th><th className="border-b border-gray-200 px-3 py-2 text-right">FBA割当（セット）</th><th className="border-b border-gray-200 px-3 py-2 text-right">RSL割当（セット）</th><th className="border-b border-gray-200 px-3 py-2 text-right">余剰数（バラ）</th><th className="border-b border-gray-200 px-3 py-2 text-right">不足数（バラ）</th><th className="border-b border-gray-200 px-3 py-2">状態</th>
          </tr></thead>
          <tbody>
            {filteredDisplayItems.map((v, idx) => {
              const status = v.shortage > 0 ? "不足" : v.apRemain > 0 ? "余剰" : "ちょうど";
              const statusClass = v.shortage > 0 ? "border-red-200 bg-red-50 text-red-600" : v.apRemain > 0 ? "border-sky-200 bg-sky-50 text-sky-700" : "border-emerald-200 bg-emerald-50 text-emerald-700";
              const productName = v.row?.product_name || v.master?.product_name || v.item.product_name || "商品名未設定";
              const productUrl = v.master?.product_url || v.item.url || "";
              const color = v.master?.color || String(v.item.color ?? "");
              const size = v.master?.size || String(v.item.size ?? "");
              return <tr key={v.key} className={idx % 2 ? "bg-white" : "bg-gray-50/60"}>
                <td className="border-b border-gray-100 px-3 py-2"><div className="font-bold text-gray-900">{productName}</div>{v.row?.sku && <div className="mt-0.5 font-mono text-[10px] text-gray-400">SKU: {v.row.sku}</div>}</td>
                <td className="max-w-[220px] truncate border-b border-gray-100 px-3 py-2 font-mono text-[10px] text-indigo-600">{productUrl ? <a href={productUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">{productUrl}</a> : "—"}</td>
                <td className="border-b border-gray-100 px-3 py-2 font-mono">{v.item.jan || v.row?.jan || "—"}</td>
                <td className="border-b border-gray-100 px-3 py-2">{color || "—"}</td><td className="border-b border-gray-100 px-3 py-2">{size || "—"}</td>
                <td className="border-b border-gray-100 px-3 py-2 text-right font-bold tabular-nums">
                  <div>{fmt(v.apStock)}</div>
                  {v.unitPerSet > 1 && <div className="text-[10px] font-semibold text-gray-400">約{fmt(v.apStockSet)}セット相当</div>}
                </td>
                <td className="border-b border-gray-100 px-3 py-2 text-right font-bold text-indigo-700 tabular-nums">{fmt(v.fbaRecommend)}</td>
                <td className="border-b border-gray-100 px-3 py-2 text-right font-bold text-emerald-700 tabular-nums">{fmt(v.rslRecommend)}</td>
                <td className="border-b border-gray-100 px-3 py-2 text-right tabular-nums">{fmt(v.fbaAlloc)}</td>
                <td className="border-b border-gray-100 px-3 py-2 text-right tabular-nums">{fmt(v.rslAlloc)}</td>
                <td className="border-b border-gray-100 px-3 py-2 text-right tabular-nums">
                  <div>{fmt(v.apRemain)}</div>
                  {v.unitPerSet > 1 && <div className="text-[10px] font-semibold text-gray-400">約{fmt(v.apRemainSet)}セット相当</div>}
                </td>
                <td className={`border-b border-gray-100 px-3 py-2 text-right font-black tabular-nums ${v.shortage > 0 ? "text-red-600" : "text-gray-400"}`}>
                  <div>{fmt(v.shortage)}</div>
                  {v.unitPerSet > 1 && <div className="text-[10px] font-semibold text-gray-400">{fmt(v.shortageSet)}セット相当</div>}
                </td>
                <td className="border-b border-gray-100 px-3 py-2"><span className={`inline-flex min-w-[56px] items-center justify-center whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-bold ${statusClass}`}>{status}</span></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ApSummaryCard({ label, value, tone = "gray" }: { label: string; value: number; tone?: "gray" | "blue" | "green" | "red" }) {
  const color = tone === "blue" ? "text-indigo-700 bg-indigo-50 border-indigo-100" : tone === "green" ? "text-emerald-700 bg-emerald-50 border-emerald-100" : tone === "red" ? "text-red-700 bg-red-50 border-red-100" : "text-gray-800 bg-white border-gray-200";
  return <div className={`rounded-2xl border p-4 shadow-sm ${color}`}><p className="text-[11px] font-bold opacity-70">{label}</p><p className="mt-1 text-2xl font-black tabular-nums">{Number(value || 0).toLocaleString()}</p></div>;
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "red" | "amber";
}) {
  const color =
    accent === "red"
      ? "text-red-600"
      : accent === "amber"
      ? "text-orange-500"
      : "text-gray-900";

  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400">
        {label}
      </p>
      <p className={`text-lg font-bold ${color}`}>{value.toLocaleString()}</p>
    </div>
  );
}

function InspectionExportModal({
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
