export type PurchaseBreakdownRow = {
  sales_sku: string;
  sales_jan: string;
  product_name: string;
  shortage_set_qty: number;
  component_purchase_sku: string;
  component_qty: number;
  required_qty: number;
  is_registered_purchase_sku: boolean;
  source_type?: "component_purchase_sku" | "component_jan";
  ap_stock?: number;
  moq?: number;
  order_unit?: number;
  color?: string;
  size?: string;
  url_1688?: string;
  image_url?: string;
  master_sku?: string;
  display_jan?: string;
};

export type PurchaseSkuSummaryRow = {
  purchase_sku: string;
  product_name?: string;
  total_required_qty: number;
  ap_stock: number;
  shortage_qty: number;
  moq: number;
  order_unit: number;
  recommended_order_qty: number;
  color?: string;
  size?: string;
  url_1688?: string;
  image_url?: string;
  is_registered_purchase_sku: boolean;
  source_type?: "component_purchase_sku" | "component_jan";
  master_sku?: string;
  display_jan?: string;
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function cleanJan(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").trim();
}

function safeNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function positiveInteger(value: unknown) {
  return Math.max(0, Math.floor(safeNumber(value)));
}

function normalizeItemType(value: unknown) {
  return cleanText(value).toLowerCase();
}

function isSingleItem(master: any) {
  const itemType = normalizeItemType(
    master?.item_type ??
      master?.product_type ??
      master?.master_type ??
      master?.商品種別 ??
      master?.種別
  );

  if (!itemType) return false;

  return (
    itemType === "single" ||
    itemType === "単品" ||
    itemType === "normal" ||
    itemType === "product" ||
    itemType.includes("単品")
  );
}

function getMasterByJan(productMasterBySku: Record<string, any>) {
  const map = new Map<string, any>();

  Object.values(productMasterBySku || {}).forEach((master: any) => {
    const jan = cleanJan(master?.jan ?? master?.JAN ?? master?.商品JAN);
    if (jan && !map.has(jan)) map.set(jan, master);
  });

  return map;
}

function getMasterBySku(productMasterBySku: Record<string, any>) {
  const map = new Map<string, any>();

  Object.entries(productMasterBySku || {}).forEach(([key, master]: [string, any]) => {
    const sku = cleanText(master?.sku ?? master?.SKU ?? key);
    if (sku && !map.has(sku)) map.set(sku, master);
  });

  return map;
}

function pickImageUrl(...values: unknown[]) {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return "";
}

function getMasterSku(master: any) {
  return cleanText(master?.sku ?? master?.SKU ?? master?.master_sku ?? "");
}

function getPurchaseSkuMeta(
  purchaseSku: string,
  purchaseSkuMap: Map<string, any>,
  masterBySku: Map<string, any>,
  masterByJan: Map<string, any>
) {
  const key = cleanText(purchaseSku);
  const janKey = cleanJan(purchaseSku);

  const registered = purchaseSkuMap.get(key);
  const skuMaster = masterBySku.get(key);
  const janMaster = janKey ? masterByJan.get(janKey) : undefined;
  const master = registered ?? skuMaster ?? janMaster;

  return {
    registered,
    master,
    isRegistered: Boolean(registered || skuMaster || janMaster),
    masterSku: getMasterSku(master),
    displayJan: cleanJan(
      registered?.jan ??
        registered?.JAN ??
        registered?.parent_jan ??
        skuMaster?.jan ??
        skuMaster?.JAN ??
        janMaster?.jan ??
        janMaster?.JAN ??
        janKey
    ),
    apStock: positiveInteger(
      registered?.ap_stock ??
        skuMaster?.ap_stock ??
        skuMaster?.apStock ??
        janMaster?.ap_stock ??
        janMaster?.apStock ??
        0
    ),
    moq: positiveInteger(
      registered?.moq ?? skuMaster?.moq ?? janMaster?.moq ?? 0
    ),
    orderUnit: positiveInteger(
      registered?.order_unit ??
        skuMaster?.order_unit ??
        janMaster?.order_unit ??
        0
    ),
    productName: cleanText(
      registered?.product_name ??
        registered?.productName ??
        registered?.name ??
        registered?.商品名 ??
        skuMaster?.product_name ??
        skuMaster?.productName ??
        skuMaster?.name ??
        skuMaster?.商品名 ??
        janMaster?.product_name ??
        janMaster?.productName ??
        janMaster?.name ??
        janMaster?.商品名 ??
        ""
    ),
    color: cleanText(
      registered?.color ?? skuMaster?.color ?? janMaster?.color ?? ""
    ),
    size: cleanText(
      registered?.size ?? skuMaster?.size ?? janMaster?.size ?? ""
    ),
    url1688: cleanText(
      registered?.url_1688 ??
        skuMaster?.url_1688 ??
        skuMaster?.url1688 ??
        janMaster?.url_1688 ??
        janMaster?.url1688 ??
        ""
    ),
    imageUrl: pickImageUrl(
      registered?.image_url,
      registered?.imageUrl,
      registered?.product_image_url,
      registered?.thumbnail_url,
      registered?.画像,
      registered?.画像URL,
      skuMaster?.image_url,
      skuMaster?.imageUrl,
      skuMaster?.product_image_url,
      skuMaster?.thumbnail_url,
      skuMaster?.image,
      skuMaster?.画像,
      skuMaster?.画像URL,
      janMaster?.image_url,
      janMaster?.imageUrl,
      janMaster?.product_image_url,
      janMaster?.thumbnail_url,
      janMaster?.image,
      janMaster?.画像,
      janMaster?.画像URL
    ),
  };
}

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
  const purchaseSkuMap = new Map(
    purchaseSkus
      .map((item) => [cleanText(item?.purchase_sku), item] as const)
      .filter(([purchaseSku]) => Boolean(purchaseSku))
  );

  const masterByJan = getMasterByJan(productMasterBySku);
  const masterBySku = getMasterBySku(productMasterBySku);

  return rows.flatMap((row) => {
    const rowSku = cleanText(row?.sku);
    const master = productMasterBySku[rowSku] ?? masterBySku.get(rowSku);

    if (!master) return [];

    const shortageSetQty = positiveInteger(row?.shortage_qty);
    const baseRequiredQty = positiveInteger(
      row?.recommended_order_qty || row?.shortage_qty || 0
    );

    const componentRows: PurchaseBreakdownRow[] = [1, 2, 3, 4, 5].flatMap((n) => {
      const componentPurchaseSku = cleanText(
        master[`component_purchase_sku_${n}`]
      );
      const componentJan = cleanJan(master[`component_jan_${n}`]);
      const purchaseSku = componentPurchaseSku || componentJan;

      if (!purchaseSku) return [];

      const rawQty = Number(master[`component_qty_${n}`] ?? 1);
      const componentQty = Number.isFinite(rawQty) && rawQty > 0 ? rawQty : 1;
      const sourceType: PurchaseBreakdownRow["source_type"] = componentPurchaseSku
        ? "component_purchase_sku"
        : "component_jan";

      const meta = getPurchaseSkuMeta(
        purchaseSku,
        purchaseSkuMap,
        masterBySku,
        masterByJan
      );

      return [
        {
          sales_sku: cleanText(row?.sku),
          sales_jan: cleanJan(row?.jan),
          product_name: cleanText(meta.productName || row?.product_name),
          shortage_set_qty: shortageSetQty,
          component_purchase_sku: purchaseSku,
          component_qty: componentQty,
          required_qty: baseRequiredQty * componentQty,
          is_registered_purchase_sku: meta.isRegistered,
          source_type: sourceType,
          ap_stock: meta.apStock,
          moq: meta.moq,
          order_unit: meta.orderUnit,
          color: meta.color,
          size: meta.size,
          url_1688: meta.url1688,
          image_url: meta.imageUrl,
          master_sku: meta.masterSku || cleanText(row?.sku),
          display_jan: meta.displayJan || cleanJan(row?.jan),
        },
      ];
    });

    if (componentRows.length > 0) return componentRows;

    if (!isSingleItem(master)) return [];

    const selfJan = cleanJan(row?.jan ?? master?.jan ?? master?.JAN);
    if (!selfJan) return [];

    if (baseRequiredQty <= 0) return [];

    const meta = getPurchaseSkuMeta(
      selfJan,
      purchaseSkuMap,
      masterBySku,
      masterByJan
    );

    return [
      {
        sales_sku: cleanText(row?.sku),
        sales_jan: selfJan,
        product_name: cleanText(
          meta.productName || row?.product_name || master?.product_name || master?.商品名
        ),
        shortage_set_qty: shortageSetQty,
        component_purchase_sku: selfJan,
        component_qty: 1,
        required_qty: baseRequiredQty,
        is_registered_purchase_sku: meta.isRegistered,
        source_type: "component_jan",
        ap_stock: meta.apStock,
        moq: meta.moq,
        order_unit: meta.orderUnit,
        color: meta.color,
        size: meta.size,
        url_1688: meta.url1688,
        image_url: meta.imageUrl,
        master_sku: meta.masterSku || cleanText(row?.sku),
        display_jan: meta.displayJan || selfJan,
      },
    ];
  });
}

export function buildPurchaseSkuSummaryRows(
  purchaseBreakdownRows: PurchaseBreakdownRow[],
  purchaseSkus: any[]
): PurchaseSkuSummaryRow[] {
  const purchaseSkuMap = new Map(
    purchaseSkus
      .map((item) => [cleanText(item?.purchase_sku), item] as const)
      .filter(([purchaseSku]) => Boolean(purchaseSku))
  );

  const summaryMap = new Map<string, PurchaseSkuSummaryRow>();

  purchaseBreakdownRows.forEach((row) => {
    const purchaseSku = cleanText(row.component_purchase_sku);

    if (!purchaseSku) return;

    const registered = purchaseSkuMap.get(purchaseSku);
    const current = summaryMap.get(purchaseSku);

    const totalRequiredQty =
      (current?.total_required_qty ?? 0) + Number(row.required_qty || 0);

    const apStock = positiveInteger(
      registered?.ap_stock ?? current?.ap_stock ?? row.ap_stock ?? 0
    );

    const moq = positiveInteger(
      registered?.moq ?? current?.moq ?? row.moq ?? 0
    );

    const orderUnit = positiveInteger(
      registered?.order_unit ?? current?.order_unit ?? row.order_unit ?? 0
    );

    const shortageQty = Math.max(0, totalRequiredQty - apStock);

    const recommendedOrderQty = calculateRecommendedPurchaseQty(
      shortageQty,
      moq,
      orderUnit
    );

    summaryMap.set(purchaseSku, {
      purchase_sku: purchaseSku,
      product_name:
        registered?.product_name ??
        registered?.productName ??
        registered?.name ??
        registered?.商品名 ??
        current?.product_name ??
        row.product_name,
      total_required_qty: totalRequiredQty,
      ap_stock: apStock,
      shortage_qty: shortageQty,
      moq,
      order_unit: orderUnit,
      recommended_order_qty: recommendedOrderQty,
      color: registered?.color ?? current?.color ?? row.color,
      size: registered?.size ?? current?.size ?? row.size,
      url_1688: registered?.url_1688 ?? current?.url_1688 ?? row.url_1688,
      image_url: pickImageUrl(
        registered?.image_url,
        registered?.imageUrl,
        current?.image_url,
        row.image_url
      ),
      is_registered_purchase_sku: Boolean(
        registered || current?.is_registered_purchase_sku || row.is_registered_purchase_sku
      ),
      source_type: current?.source_type ?? row.source_type,
      master_sku: current?.master_sku ?? row.master_sku,
      display_jan: current?.display_jan ?? row.display_jan,
    });
  });

  return Array.from(summaryMap.values()).sort((a, b) => {
    const orderDiff =
      Number(b.recommended_order_qty || 0) -
      Number(a.recommended_order_qty || 0);

    if (orderDiff !== 0) return orderDiff;

    return (
      Number(b.total_required_qty || 0) - Number(a.total_required_qty || 0)
    );
  });
}
