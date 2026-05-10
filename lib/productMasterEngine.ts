import type { ProductMasterItem, RawSkuRow } from "@/types";
import { INSPECTION_ITEMS } from "@/lib/csv";

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

export {
  getAmazonImageUrlFromAsin,
  normalizeProductMaster,
  makeDraftMasterFromCsv,
};
