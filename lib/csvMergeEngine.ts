import type { RawSkuRow, ProductMasterItem } from "@/types";
import {
  normalizeSkuKey,
  normalizeJanKey,
} from "@/lib/normalizers";

export function mergeRawSkuRow(
  current: RawSkuRow | undefined,
  incoming: Partial<RawSkuRow>,
  canonicalSku: string,
  canonicalJan: string
): RawSkuRow {
  const base: RawSkuRow = current ?? {
    sku: canonicalSku,
    jan: canonicalJan,
    product_name: "",
    monthly_sales: 0,
    fba_stock: 0,
    rsl_stock: 0,
    ap_stock: 0,
    inbound: 0,
    amazon_monthly_sales: 0,
    rakuten_monthly_sales: 0,
    amazon_stock: 0,
    rakuten_stock: 0,
    fba_inbound_plan: 0,
    rsl_inbound_plan: 0,
    fba_required_stock: 0,
    rsl_required_stock: 0,
    moq: 0,
    order_unit: 0,
  };

  const amazonMonthlySales =
    Number(incoming.amazon_monthly_sales ?? base.amazon_monthly_sales ?? 0) || 0;

  const rakutenMonthlySales =
    Number(incoming.rakuten_monthly_sales ?? base.rakuten_monthly_sales ?? 0) || 0;

  const explicitMonthlySales =
    Number(incoming.monthly_sales ?? base.monthly_sales ?? 0) || 0;

  const monthlySales =
    amazonMonthlySales + rakutenMonthlySales > 0
      ? amazonMonthlySales + rakutenMonthlySales
      : explicitMonthlySales;

  return {
    ...base,
    ...incoming,
    sku: canonicalSku,
    jan: canonicalJan || String(incoming.jan ?? base.jan ?? ""),
    product_name: String(incoming.product_name || base.product_name || ""),
    monthly_sales: monthlySales,
    amazon_monthly_sales: amazonMonthlySales,
    rakuten_monthly_sales: rakutenMonthlySales,
    fba_stock: Number(incoming.fba_stock ?? base.fba_stock ?? 0) || 0,
    rsl_stock: Number(incoming.rsl_stock ?? base.rsl_stock ?? 0) || 0,
    amazon_stock: Number(incoming.amazon_stock ?? base.amazon_stock ?? 0) || 0,
    rakuten_stock: Number(incoming.rakuten_stock ?? base.rakuten_stock ?? 0) || 0,
    ap_stock: Number(incoming.ap_stock ?? base.ap_stock ?? 0) || 0,
    inbound: Number(incoming.inbound ?? base.inbound ?? 0) || 0,
    fba_inbound_plan:
      Number(incoming.fba_inbound_plan ?? base.fba_inbound_plan ?? 0) || 0,
    rsl_inbound_plan:
      Number(incoming.rsl_inbound_plan ?? base.rsl_inbound_plan ?? 0) || 0,
    moq: Number(incoming.moq ?? base.moq ?? 0) || 0,
    order_unit: Number(incoming.order_unit ?? base.order_unit ?? 0) || 0,
  };
}

export function getMasterForCsvRow(
  row: Partial<RawSkuRow>,
  productMasterBySku: Record<string, ProductMasterItem>,
  productMasterByJan: Record<string, ProductMasterItem>
) {
  const sku = normalizeSkuKey(row.sku);
  const jan = normalizeJanKey(row.jan);

  return (
    productMasterBySku[sku] ||
    (jan ? productMasterByJan[jan] : undefined)
  );
}

export function getCanonicalKeyForCsvRow(
  row: Partial<RawSkuRow>,
  productMasterBySku: Record<string, ProductMasterItem>,
  productMasterByJan: Record<string, ProductMasterItem>
) {
  const master = getMasterForCsvRow(
    row,
    productMasterBySku,
    productMasterByJan
  );

  const normalizedJan = normalizeJanKey(
    row.jan || master?.jan
  );

  return {
    master,
    sku: master?.sku || normalizeSkuKey(row.sku),
    jan:
      normalizedJan ||
      String(row.jan ?? master?.jan ?? ""),
    key:
      normalizedJan ||
      master?.sku ||
      normalizeSkuKey(row.sku),
  };
}

export function canonicalizeCsvRowsByJan(
  rows: RawSkuRow[],
  productMasterBySku: Record<string, ProductMasterItem>,
  productMasterByJan: Record<string, ProductMasterItem>
): RawSkuRow[] {
  const merged = new Map<string, RawSkuRow>();

  rows.forEach((row) => {
    const canonical = getCanonicalKeyForCsvRow(
      row,
      productMasterBySku,
      productMasterByJan
    );

    if (!canonical.sku) return;

    const current = merged.get(canonical.key);

    merged.set(
      canonical.key,
      mergeRawSkuRow(
        current,
        row,
        canonical.sku,
        canonical.jan
      )
    );
  });

  return Array.from(merged.values());
}

export function buildMergedChannelRows<T>(
  rows: T[],
  getKey: (row: T) => string
) {
  const merged = new Map<string, T>();

  rows.forEach((row) => {
    const key = getKey(row);

    if (!key) return;

    merged.set(key, row);
  });

  return Array.from(merged.values());
}