import type { ProductMasterItem } from "@/types";
import { INSPECTION_ITEMS, type InspectionItem } from "@/lib/csv";
import type { ProductMasterItemWithSet } from "@/lib/productMasterExcel";

export const EMPTY_FORM: ProductMasterItemWithSet = {
  sku: "",
  jan: "",
  asin: "",
  product_name: "",
  image_url: "",
  product_url: "",
  color: "",
  size: "",
  cost_rmb: 0,
  moq: 0,
  order_unit: 0,
  unit_per_set: 1,
  product_type: "ready",
  factory_lt_days: 5,
  inspection_type: "simple",
  ap_inspection_lt_days: 3,
  shipping_method: "air",
  international_shipping_lt_days: 5,
  fba_rsl_receiving_lt_days: 3,
  safety_stock_days: 15,
  default_inspection_items: [],
  memo: "",
  factory_name: "",
  master_status: "complete",
  item_type: "single",
  component_jan_1: "",
  component_qty_1: 1,
  component_jan_2: "",
  component_qty_2: 1,
  component_jan_3: "",
  component_qty_3: 1,
  component_jan_4: "",
  component_qty_4: 1,
  component_jan_5: "",
  component_qty_5: 1,
  component_purchase_sku_1: "",
  component_purchase_sku_2: "",
  component_purchase_sku_3: "",
  component_purchase_sku_4: "",
  component_purchase_sku_5: "",
};

function toNumber(value: string) {
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function normalizeExcelText(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/^="/, "")
    .replace(/"$/, "")
    .replace(/^'/, "");
}

function normalizeSku(value: string) {
  return normalizeExcelText(value).trim();
}

function normalizeJanText(value: unknown) {
  const raw = normalizeExcelText(value);
  const digits = raw.replace(/[^0-9]/g, "");
  return digits.length === 13 ? digits : "";
}

function normalizeItemType(value: unknown): "single" | "set" | "bundle" {
  const v = String(value ?? "").trim();
  if (v === "single" || v === "単品") return "single";
  if (v === "set" || v === "セット") return "set";
  if (v === "bundle" || v === "付属品") return "bundle";
  return "single";
}

function normalizeComponentQty(value: unknown) {
  if (value === undefined || value === null || value === "") return 1;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function hasComponentJan(item: ProductMasterItemWithSet) {
  return [
    item.component_jan_1,
    item.component_jan_2,
    item.component_jan_3,
    item.component_jan_4,
    item.component_jan_5,
  ].some((jan) => String(jan ?? "").trim());
}

function getMasterStatus(item: ProductMasterItemWithSet): "complete" | "draft" {
  if (!item.sku) return "draft";
  if ((item.item_type === "set" || item.item_type === "bundle") && !hasComponentJan(item)) {
    return "draft";
  }
  return "complete";
}

function excelText(value: string) {
  const text = String(value ?? "").trim().replace(/"/g, "");
  return text ? `="${text}"` : "";
}

function parseInspectionItems(value: string): InspectionItem[] {
  return value
    .split(/[|/、,，\s]+/)
    .map((v) => v.trim())
    .filter((v): v is InspectionItem =>
      (INSPECTION_ITEMS as readonly string[]).includes(v)
    );
}

function normalizeMaster(input: any): ProductMasterItemWithSet {
  const item: ProductMasterItemWithSet = {
    ...EMPTY_FORM,
    ...input,
    sku: normalizeSku(String(input.sku ?? "")),
    jan: normalizeJanText(input.jan),
    asin: normalizeExcelText(input.asin ?? input.ASIN ?? ""),
    product_name: String(input.product_name ?? ""),
    image_url: String(input.image_url ?? ""),
    product_url: String(input.product_url ?? ""),
    color: String(input.color ?? ""),
    size: String(input.size ?? ""),
    cost_rmb: Number(input.cost_rmb) || 0,
    moq: Number(input.moq) || 0,
    order_unit: Number(input.order_unit) || 0,
    product_type: input.product_type === "oem" ? "oem" : "ready",
    factory_lt_days: Number(input.factory_lt_days) || 5,
    inspection_type: input.inspection_type === "detailed" ? "detailed" : "simple",
    ap_inspection_lt_days: Number(input.ap_inspection_lt_days) || 3,
    shipping_method: input.shipping_method === "sea" ? "sea" : "air",
    international_shipping_lt_days: Number(input.international_shipping_lt_days) || 5,
    fba_rsl_receiving_lt_days: Number(input.fba_rsl_receiving_lt_days) || 3,
    safety_stock_days: Number(input.safety_stock_days) || 15,
    unit_per_set: Math.max(1, Number(input.unit_per_set ?? input.set_count ?? input["セット数"]) || 1),
    item_type: normalizeItemType(input.item_type ?? input["商品種別"] ?? input["商品構成"]),
    component_jan_1: normalizeJanText(input.component_jan_1 ?? input["構成JAN1"]),
    component_qty_1: normalizeComponentQty(input.component_qty_1 ?? input["構成数量1"]),
    component_jan_2: normalizeJanText(input.component_jan_2 ?? input["構成JAN2"]),
    component_qty_2: normalizeComponentQty(input.component_qty_2 ?? input["構成数量2"]),
    component_jan_3: normalizeJanText(input.component_jan_3 ?? input["構成JAN3"]),
    component_qty_3: normalizeComponentQty(input.component_qty_3 ?? input["構成数量3"]),
    component_jan_4: normalizeJanText(input.component_jan_4 ?? input["構成JAN4"]),
    component_qty_4: normalizeComponentQty(input.component_qty_4 ?? input["構成数量4"]),
    component_jan_5: normalizeJanText(input.component_jan_5 ?? input["構成JAN5"]),
    component_qty_5: normalizeComponentQty(input.component_qty_5 ?? input["構成数量5"]),
    component_purchase_sku_1: normalizeSku(String(input.component_purchase_sku_1 ?? input["構成発注SKU1"] ?? "")),
    component_purchase_sku_2: normalizeSku(String(input.component_purchase_sku_2 ?? input["構成発注SKU2"] ?? "")),
    component_purchase_sku_3: normalizeSku(String(input.component_purchase_sku_3 ?? input["構成発注SKU3"] ?? "")),
    component_purchase_sku_4: normalizeSku(String(input.component_purchase_sku_4 ?? input["構成発注SKU4"] ?? "")),
    component_purchase_sku_5: normalizeSku(String(input.component_purchase_sku_5 ?? input["構成発注SKU5"] ?? "")),
    default_inspection_items: Array.isArray(input.default_inspection_items)
      ? input.default_inspection_items.filter((v: unknown): v is InspectionItem =>
          (INSPECTION_ITEMS as readonly string[]).includes(String(v))
        )
      : parseInspectionItems(String(input.default_inspection_items ?? "")),
    memo: String(input.memo ?? input.default_memo ?? ""),
    factory_name: String(input.factory_name ?? ""),
    master_status: input.master_status === "draft" ? "draft" : "complete",
  };

  return {
    ...item,
    master_status: getMasterStatus(item),
  };
}



export {
  toNumber,
  normalizeExcelText,
  normalizeSku,
  normalizeJanText,
  normalizeItemType,
  normalizeComponentQty,
  hasComponentJan,
  getMasterStatus,
  excelText,
  parseInspectionItems,
  normalizeMaster,
};
