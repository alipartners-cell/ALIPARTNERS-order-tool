import type { RawSkuRow, ComputedSkuRow, OrderParams } from "@/types";

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const valueOrParam = (rowValue: number | undefined, paramValue: number): number => {
  if (rowValue === undefined || rowValue === null) return num(paramValue);
  return num(rowValue);
};

export function getTotalLeadTimeDays(params: OrderParams, row?: RawSkuRow): number {
  return (
    valueOrParam(row?.factory_lt_days, params.factory_lt_days) +
    valueOrParam(row?.ap_inspection_lt_days, params.ap_inspection_lt_days) +
    valueOrParam(row?.international_shipping_lt_days, params.international_shipping_lt_days) +
    valueOrParam(row?.fba_rsl_receiving_lt_days, params.fba_rsl_receiving_lt_days) +
    valueOrParam(row?.safety_stock_days, params.safety_stock_days)
  );
}

function normalizeJan(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "").trim();
}

function getComponentJan(row: RawSkuRow, index: number): string {
  return normalizeJan((row as Record<string, unknown>)[`component_jan_${index}`]);
}

function getComponentQty(row: RawSkuRow, index: number): number {
  const n = Number((row as Record<string, unknown>)[`component_qty_${index}`]);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function applyMoqAndOrderUnit(shortageQty: number, moq?: number, orderUnit?: number): number {
  if (shortageQty <= 0) return 0;
  const safeMoq = num(moq);
  const safeOrderUnit = num(orderUnit);
  const unit = safeOrderUnit > 0 ? safeOrderUnit : 1;
  let qty = shortageQty;
  if (safeMoq > 0 && qty < safeMoq) qty = safeMoq;
  return Math.ceil(qty / unit) * unit;
}

export function computeRow(row: RawSkuRow, params: OrderParams): ComputedSkuRow {
  const explicitAmazonMonthlySales = num(row.amazon_monthly_sales);
  const explicitRakutenMonthlySales = num(row.rakuten_monthly_sales);
  const legacyMonthlySales = num(row.monthly_sales);

  // 重要：Amazon/Rakutenの個別月販が入っている場合は、それぞれの値をそのまま使う。
  // 以前の「row.amazon_monthly_sales || row.monthly_sales」だと、
  // 楽天だけのCSVでも monthly_sales がAmazon月販に流用され、Amazon/Rakutenが同じ数字になる。
  const hasChannelSales = explicitAmazonMonthlySales > 0 || explicitRakutenMonthlySales > 0;
  const amazon_monthly_sales = hasChannelSales ? explicitAmazonMonthlySales : legacyMonthlySales;
  const rakuten_monthly_sales = hasChannelSales ? explicitRakutenMonthlySales : 0;

  const amazon_stock = row.amazon_stock !== undefined && row.amazon_stock !== null
    ? num(row.amazon_stock)
    : num(row.fba_stock);
  const rakuten_stock = row.rakuten_stock !== undefined && row.rakuten_stock !== null
    ? num(row.rakuten_stock)
    : num(row.rsl_stock);
  const fba_inbound_plan = row.fba_inbound_plan !== undefined && row.fba_inbound_plan !== null
    ? num(row.fba_inbound_plan)
    : num(row.inbound);
  const rsl_inbound_plan = num(row.rsl_inbound_plan);

  const monthly_sales = hasChannelSales
    ? amazon_monthly_sales + rakuten_monthly_sales
    : legacyMonthlySales;
  const fba_stock = row.fba_stock !== undefined && row.fba_stock !== null
    ? num(row.fba_stock)
    : amazon_stock;
  const rsl_stock = row.rsl_stock !== undefined && row.rsl_stock !== null
    ? num(row.rsl_stock)
    : rakuten_stock;
  const ap_stock = num(row.ap_stock);
  const inbound = row.inbound !== undefined && row.inbound !== null
    ? num(row.inbound)
    : fba_inbound_plan + rsl_inbound_plan;
  const moq = num(row.moq);
  const order_unit = num(row.order_unit);

  const daily_sales = monthly_sales / 30;
  const amazon_daily_sales = amazon_monthly_sales / 30;
  const rakuten_daily_sales = rakuten_monthly_sales / 30;
  const available_stock = fba_stock + rsl_stock + ap_stock + inbound;
  const total_lead_time_days = getTotalLeadTimeDays(params, row);
  const effective_safety_stock_days = valueOrParam(row.safety_stock_days, params.safety_stock_days);
  const planning_days = total_lead_time_days;

  // 必要在庫数は手入力ではなく、日販 × 総LT（安全LTを含む）で自動計算する。
  const fba_required_stock = Math.round(amazon_daily_sales * planning_days);
  const rsl_required_stock = Math.round(rakuten_daily_sales * planning_days);
  const fba_recommended_delivery_qty = Math.max(0, fba_required_stock - amazon_stock - fba_inbound_plan);
  const rsl_recommended_delivery_qty = Math.max(0, rsl_required_stock - rakuten_stock - rsl_inbound_plan);

  const required_stock = Math.round(daily_sales * planning_days);
  const shortage_qty = Math.max(0, required_stock - available_stock);
  const recommended_order_qty = applyMoqAndOrderUnit(shortage_qty, moq, order_unit);

  return {
    ...row,
    monthly_sales,
    fba_stock,
    rsl_stock,
    ap_stock,
    inbound,
    amazon_monthly_sales,
    rakuten_monthly_sales,
    amazon_stock,
    rakuten_stock,
    fba_inbound_plan,
    rsl_inbound_plan,
    fba_required_stock,
    rsl_required_stock,
    moq,
    order_unit,
    daily_sales,
    amazon_daily_sales,
    rakuten_daily_sales,
    fba_recommended_delivery_qty,
    rsl_recommended_delivery_qty,
    available_stock,
    total_lead_time_days,
    effective_safety_stock_days,
    required_stock,
    shortage_qty,
    recommended_order_qty,
    status: shortage_qty > 0 ? "発注推奨" : "発注不要",
  };
}

function applySetAndBundleLogic(rows: ComputedSkuRow[]): ComputedSkuRow[] {
  const result = rows.map((row) => ({ ...row }));
  const rowBySku = new Map(result.map((row) => [row.sku, row]));
  const rowByJan = new Map<string, ComputedSkuRow>();

  result.forEach((row) => {
    const jan = normalizeJan(row.jan);
    if (jan && !rowByJan.has(jan)) rowByJan.set(jan, row);
  });

  // 付属品連動は、セット親SKUが分解後に0になる前の発注数を使う可能性があるため、先に保持する。
  const originalOrderQtyBySku = new Map(
    result.map((row) => [row.sku, Math.max(0, Math.floor(num(row.recommended_order_qty)))])
  );

  // セット商品：親SKUの発注数を構成JANへ分解して加算する。
  result.forEach((parentRow) => {
    if (parentRow.item_type !== "set") return;

    const parentQty = originalOrderQtyBySku.get(parentRow.sku) ?? 0;
    if (parentQty <= 0) return;

    let addedToComponent = false;

    for (let index = 1; index <= 5; index += 1) {
      const componentJan = getComponentJan(parentRow, index);
      if (!componentJan) continue;

      const targetRow = rowByJan.get(componentJan);
      if (!targetRow || targetRow.sku === parentRow.sku) continue;

      const addQty = parentQty * getComponentQty(parentRow, index);
      targetRow.recommended_order_qty = Math.max(0, Math.floor(num(targetRow.recommended_order_qty) + addQty));
      targetRow.shortage_qty = Math.max(0, num(targetRow.shortage_qty) + addQty);
      targetRow.status = "発注推奨";
      addedToComponent = true;
    }

    // 構成JANに一致する商品がある場合のみ、親セットの中国発注数を0にする。
    // 一致がなければ発注漏れ防止のため親の発注数を残す。
    if (addedToComponent) {
      const parent = rowBySku.get(parentRow.sku);
      if (parent) {
        parent.recommended_order_qty = 0;
        parent.shortage_qty = 0;
        parent.status = parent.fba_recommended_delivery_qty > 0 || parent.rsl_recommended_delivery_qty > 0
          ? "納品推奨"
          : "対応不要";
      }
    }
  });

  // 付属品：親商品の発注数に連動して、付属品JANへ必要数を加算する。
  result.forEach((parentRow) => {
    if (parentRow.item_type === "bundle") return;

    const parentQty = parentRow.item_type === "set"
      ? originalOrderQtyBySku.get(parentRow.sku) ?? 0
      : Math.max(0, Math.floor(num(parentRow.recommended_order_qty)));

    if (parentQty <= 0) return;

    for (let index = 1; index <= 5; index += 1) {
      const componentJan = getComponentJan(parentRow, index);
      if (!componentJan) continue;

      const targetRow = rowByJan.get(componentJan);
      if (!targetRow || targetRow.sku === parentRow.sku || targetRow.item_type !== "bundle") continue;

      const addQty = parentQty * getComponentQty(parentRow, index);
      targetRow.recommended_order_qty = Math.max(0, Math.floor(num(targetRow.recommended_order_qty) + addQty));
      targetRow.shortage_qty = Math.max(0, num(targetRow.shortage_qty) + addQty);
      targetRow.status = "発注推奨";
    }
  });

  return result;
}

export function computeAllRows(rows: RawSkuRow[], params: OrderParams): ComputedSkuRow[] {
  return applySetAndBundleLogic(rows.map((row) => computeRow(row, params)));
}

export function toRawRow(row: ComputedSkuRow | RawSkuRow): RawSkuRow {
  return {
    sku: row.sku,
    jan: row.jan ?? "",
    product_name: row.product_name,
    item_type: row.item_type,
    component_jan_1: row.component_jan_1,
    component_qty_1: row.component_qty_1,
    component_jan_2: row.component_jan_2,
    component_qty_2: row.component_qty_2,
    component_jan_3: row.component_jan_3,
    component_qty_3: row.component_qty_3,
    component_jan_4: row.component_jan_4,
    component_qty_4: row.component_qty_4,
    component_jan_5: row.component_jan_5,
    component_qty_5: row.component_qty_5,
    monthly_sales: num(row.monthly_sales),
    fba_stock: num(row.fba_stock),
    rsl_stock: num(row.rsl_stock),
    ap_stock: num(row.ap_stock),
    inbound: num(row.inbound),
    amazon_monthly_sales: num(row.amazon_monthly_sales),
    rakuten_monthly_sales: num(row.rakuten_monthly_sales),
    amazon_stock: num(row.amazon_stock),
    rakuten_stock: num(row.rakuten_stock),
    fba_inbound_plan: num(row.fba_inbound_plan),
    rsl_inbound_plan: num(row.rsl_inbound_plan),
    fba_required_stock: num(row.fba_required_stock),
    rsl_required_stock: num(row.rsl_required_stock),
    moq: num(row.moq),
    order_unit: num(row.order_unit),
    product_type: row.product_type,
    factory_lt_days: row.factory_lt_days,
    inspection_type: row.inspection_type,
    ap_inspection_lt_days: row.ap_inspection_lt_days,
    shipping_method: row.shipping_method,
    international_shipping_lt_days: row.international_shipping_lt_days,
    fba_rsl_receiving_lt_days: row.fba_rsl_receiving_lt_days,
    safety_stock_days: row.safety_stock_days,
  };
}
