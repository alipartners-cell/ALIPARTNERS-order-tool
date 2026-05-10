export type PurchaseBreakdownRow = {
  sales_sku: string;
  sales_jan: string;
  product_name: string;
  shortage_set_qty: number;
  component_purchase_sku: string;
  component_qty: number;
  required_qty: number;
  is_registered_purchase_sku: boolean;
};

export type PurchaseSkuSummaryRow = {
  purchase_sku: string;
  total_required_qty: number;
  ap_stock: number;
  shortage_qty: number;
  moq: number;
  order_unit: number;
  recommended_order_qty: number;
  color?: string;
  size?: string;
  url_1688?: string;
  is_registered_purchase_sku: boolean;
};

export function calculateRecommendedPurchaseQty(
  shortageQty: number,
  moq: number,
  orderUnit: number
) {
  const shortage = Math.max(0, Math.floor(Number(shortageQty) || 0));

  if (shortage <= 0) return 0;

  const minimumQty = Math.max(
    shortage,
    Math.max(0, Math.floor(Number(moq) || 0))
  );

  const unit = Math.max(0, Math.floor(Number(orderUnit) || 0));

  if (unit <= 0) return minimumQty;

  return Math.ceil(minimumQty / unit) * unit;
}

export function buildPurchaseBreakdownRows(
  rows: any[],
  productMasterBySku: Record<string, any>,
  purchaseSkus: any[]
): PurchaseBreakdownRow[] {
  const registeredPurchaseSkuSet = new Set(
    purchaseSkus
      .map((item) => String(item.purchase_sku ?? "").trim())
      .filter(Boolean)
  );

  return rows.flatMap((row) => {
    const master = productMasterBySku[String(row.sku ?? "").trim()];

    if (!master) return [];

    const shortageSetQty = Math.max(
      0,
      Math.floor(Number(row.shortage_qty || 0))
    );

    return [1, 2, 3, 4, 5].flatMap((n) => {
      const componentPurchaseSku = String(
        master[`component_purchase_sku_${n}`] ?? ""
      ).trim();

      if (!componentPurchaseSku) return [];

      const rawQty = Number(master[`component_qty_${n}`] ?? 1);

      const componentQty =
        Number.isFinite(rawQty) && rawQty > 0
          ? rawQty
          : 1;

      return [
        {
          sales_sku: row.sku,
          sales_jan: row.jan,
          product_name: row.product_name,
          shortage_set_qty: shortageSetQty,
          component_purchase_sku: componentPurchaseSku,
          component_qty: componentQty,
          required_qty: shortageSetQty * componentQty,
          is_registered_purchase_sku:
            registeredPurchaseSkuSet.has(componentPurchaseSku),
        },
      ];
    });
  });
}

export function buildPurchaseSkuSummaryRows(
  purchaseBreakdownRows: PurchaseBreakdownRow[],
  purchaseSkus: any[]
): PurchaseSkuSummaryRow[] {
  const purchaseSkuMap = new Map(
    purchaseSkus
      .map((item) => [String(item.purchase_sku ?? "").trim(), item] as const)
      .filter(([purchaseSku]) => Boolean(purchaseSku))
  );

  const summaryMap = new Map<string, PurchaseSkuSummaryRow>();

  purchaseBreakdownRows.forEach((row) => {
    const purchaseSku = String(row.component_purchase_sku ?? "").trim();

    if (!purchaseSku) return;

    const registered = purchaseSkuMap.get(purchaseSku);
    const current = summaryMap.get(purchaseSku);

    const totalRequiredQty =
      (current?.total_required_qty ?? 0) +
      Number(row.required_qty || 0);

    const apStock =
      Number(registered?.ap_stock ?? current?.ap_stock ?? 0) || 0;

    const moq =
      Number((registered as any)?.moq ?? current?.moq ?? 0) || 0;

    const orderUnit =
      Number((registered as any)?.order_unit ?? current?.order_unit ?? 0) || 0;

    const shortageQty = Math.max(
      0,
      totalRequiredQty - apStock
    );

    const recommendedOrderQty =
      calculateRecommendedPurchaseQty(
        shortageQty,
        moq,
        orderUnit
      );

    summaryMap.set(purchaseSku, {
      purchase_sku: purchaseSku,
      total_required_qty: totalRequiredQty,
      ap_stock: apStock,
      shortage_qty: shortageQty,
      moq,
      order_unit: orderUnit,
      recommended_order_qty: recommendedOrderQty,
      color: registered?.color ?? current?.color,
      size: registered?.size ?? current?.size,
      url_1688: registered?.url_1688 ?? current?.url_1688,
      is_registered_purchase_sku: Boolean(registered),
    });
  });

  return Array.from(summaryMap.values()).sort((a, b) => {
    const shortageDiff =
      Number(b.shortage_qty || 0) -
      Number(a.shortage_qty || 0);

    if (shortageDiff !== 0) return shortageDiff;

    return (
      Number(b.total_required_qty || 0) -
      Number(a.total_required_qty || 0)
    );
  });
}