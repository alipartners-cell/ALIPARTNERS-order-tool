import type { ProductMasterItem, RawSkuRow } from "@/types";
import { getUnitPerSetFromMaster } from "@/lib/rowCalculationEngine";

type ApStockInputItem = {
  jan: string;
  ap_stock: number;
};

function normalizeJan(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").trim();
}

export function buildRowsWithApStock({
  productMasters,
  csvRows,
  apStockItems,
}: {
  productMasters: ProductMasterItem[];
  csvRows: RawSkuRow[];
  apStockItems: ApStockInputItem[];
}): {
  nextRawRows: RawSkuRow[];
  updated: number;
  noJan: number;
  unmatched: number;
} {
  const stockByJan = new Map<string, number>();

  apStockItems.forEach((item) => {
    const jan = normalizeJan(item.jan);
    const stock = Number(item.ap_stock);

    if (jan && Number.isFinite(stock)) {
      stockByJan.set(jan, stock);
    }
  });

  let updated = 0;
  let noJan = 0;
  let unmatched = 0;

  const csvMap = new Map(csvRows.map((row) => [row.sku, row]));
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
      ...({
        unit_per_set: getUnitPerSetFromMaster(master),
      } as unknown as Partial<RawSkuRow>),
    });
  });

  return {
    nextRawRows,
    updated,
    noJan,
    unmatched,
  };
}
