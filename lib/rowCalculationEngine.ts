import type { ComputedSkuRow, ProductMasterItem } from "@/types";

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