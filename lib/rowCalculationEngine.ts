import type { ComputedSkuRow, ProductMasterItem, RawSkuRow, OrderParams } from "@/types";
import { computeAllRows } from "@/lib/calc";

export function getUnitPerSetFromMaster(master?: ProductMasterItem) {
  const raw = Number(
    (master as unknown as { unit_per_set?: unknown } | undefined)?.unit_per_set ?? 1
  );

  return Number.isFinite(raw) && raw > 0 ? Math.max(1, Math.floor(raw)) : 1;
}

export function adjustRowsForSetUnits(
  rows: ComputedSkuRow[],
  productMasterBySku: Record<string, ProductMasterItem>
): ComputedSkuRow[] {
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
    const apStockSet =
      unitPerSet > 1 ? Math.floor(apStockEach / unitPerSet) : apStockEach;

    const requiredTotalSet = fbaRequiredSet + rslRequiredSet;
    const availableTotalSet =
      fbaStockSet + rslStockSet + fbaInboundSet + rslInboundSet + apStockSet;

    const shortageSet = Math.max(0, requiredTotalSet - availableTotalSet);
    const recommendedOrderQtyBara = shortageSet * unitPerSet;

    const status: ComputedSkuRow["status"] =
      shortageSet > 0
        ? "発注推奨"
        : row.fba_recommended_delivery_qty > 0 ||
          row.rsl_recommended_delivery_qty > 0
          ? "納品推奨"
          : "対応不要";

    return {
      ...row,
      ...({ unit_per_set: unitPerSet } as unknown as Partial<ComputedSkuRow>),
      shortage_qty: shortageSet,
      recommended_order_qty: recommendedOrderQtyBara,
      status,
    };
  });
}

export function buildBaseRowsFromMaster({
  productMasters,
  csvRowBySku,
  csvRowByJan,
}: {
  productMasters: ProductMasterItem[];
  csvRowBySku: Map<string, RawSkuRow>;
  csvRowByJan: Map<string, RawSkuRow>;
}): RawSkuRow[] {
  return productMasters.map((master) => {
    const csv =
      csvRowBySku.get(master.sku) ||
      csvRowByJan.get(master.jan);

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
      ap_inspection_lt_days:
        master.ap_inspection_lt_days ??
        csv?.ap_inspection_lt_days,
      shipping_method:
        master.shipping_method ?? csv?.shipping_method,
      international_shipping_lt_days:
        master.international_shipping_lt_days ??
        csv?.international_shipping_lt_days,
      fba_rsl_receiving_lt_days:
        master.fba_rsl_receiving_lt_days ??
        csv?.fba_rsl_receiving_lt_days,
      safety_stock_days:
        master.safety_stock_days ??
        csv?.safety_stock_days,
      ...({
        unit_per_set: getUnitPerSetFromMaster(master),
      } as unknown as Partial<RawSkuRow>),
    };
  });
}


export function buildComputedRows({
  productMasters,
  csvRowBySku,
  csvRowByJan,
  params,
}: {
  productMasters: ProductMasterItem[];
  csvRowBySku: Map<string, RawSkuRow>;
  csvRowByJan: Map<string, RawSkuRow>;
  params: OrderParams;
}): ComputedSkuRow[] {
  const baseRows = buildBaseRowsFromMaster({
    productMasters,
    csvRowBySku,
    csvRowByJan,
  });

  return computeAllRows(baseRows, params);
}
