"use client";

import { useMemo, useState } from "react";
import type {
  ComputedSkuRow,
  InspectionType,
  OrderParams,
  ProductType,
  RawSkuRow,
  ShippingMethod,
  ProductMasterItem,
} from "@/types";

interface Props {
  rows: ComputedSkuRow[];
  selected: Set<string>;
  onToggle: (sku: string) => void;
  onToggleAll: (skus: string[]) => void;
  filterOrderOnly: boolean;
  filterDeliveryOnly: boolean;
  params: OrderParams;
  productMasters: Record<string, ProductMasterItem>;
  inspectionSelections?: unknown;
  onOpenMaster?: (sku: string) => void;
}

const PRODUCT_DEFAULT_LT: Record<ProductType, number> = { ready: 5, oem: 30 };
const INSPECTION_DEFAULT_LT: Record<InspectionType, number> = { simple: 3, detailed: 6 };
const SHIPPING_DEFAULT_LT: Record<ShippingMethod, number> = { air: 5, sea: 14 };

function qtyText(value: number) {
  return value > 0 ? Number(value).toLocaleString() : "—";
}

function smallNum(value: number) {
  return Number.isInteger(value) ? Number(value).toLocaleString() : Number(value).toFixed(1);
}

function getUnitPerSet(row: ComputedSkuRow, master?: ProductMasterItem) {
  const raw = (row as unknown as { unit_per_set?: unknown }).unit_per_set ??
    (master as unknown as { unit_per_set?: unknown } | undefined)?.unit_per_set ??
    1;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function deliveryUnit(unitPerSet: number) {
  return unitPerSet > 1 ? "セット" : "個";
}

function setDescription(unitPerSet: number) {
  return unitPerSet > 1 ? `1セット=${unitPerSet}個` : "";
}

function toBaraQty(qty: number, unitPerSet: number) {
  return Math.max(0, Number(qty || 0)) * unitPerSet;
}

function setEquivalent(value: number, unitPerSet: number) {
  if (unitPerSet <= 1) return "";
  const sets = Math.floor(Number(value || 0) / unitPerSet);
  return `約${sets.toLocaleString()}セット相当`;
}

function StatusStack({ row }: { row: ComputedSkuRow }) {
  const hasOrder = row.recommended_order_qty > 0 || row.status === "発注推奨";
  const hasDelivery = row.fba_recommended_delivery_qty > 0 || row.rsl_recommended_delivery_qty > 0;
  const noAction = !hasOrder && !hasDelivery;
  const items = [
    { label: "発注推奨", active: hasOrder, activeClass: "border-red-200 bg-red-50 text-red-600" },
    { label: "納品推奨", active: hasDelivery, activeClass: "border-amber-200 bg-amber-50 text-amber-700" },
    { label: "対応不要", active: noAction, activeClass: "border-emerald-200 bg-emerald-50 text-emerald-600" },
  ];
  return (
    <div className="flex min-w-[86px] flex-col items-end gap-1">
      {items.map((item) => (
        <span
          key={item.label}
          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${
            item.active ? item.activeClass : "border-gray-200 bg-gray-50 text-gray-300 opacity-45"
          }`}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}

function DecisionCell({
  label,
  value,
  tone,
  unit = "",
  subLabel = "",
}: {
  label: string;
  value: number;
  tone: "blue" | "green" | "orange";
  unit?: string;
  subLabel?: string;
}) {
  const active = value > 0;
  const color = active
    ? tone === "blue"
      ? "text-indigo-700 bg-indigo-50 border-indigo-100"
      : tone === "green"
        ? "text-emerald-700 bg-emerald-50 border-emerald-100"
        : "text-orange-700 bg-orange-50 border-orange-100"
    : "text-gray-400 bg-gray-50 border-gray-100 opacity-55";
  return (
    <div className={`flex h-[86px] w-[128px] shrink-0 flex-col justify-center rounded-xl border px-3 py-2 text-right transition ${color}`}>
      <div className="text-[11px] font-bold leading-none opacity-70">{label}</div>
      <div className="mt-1 text-xl font-black leading-tight tabular-nums">
        {qtyText(value)}{unit ? <span className="ml-1 text-sm font-black">{unit}</span> : null}
      </div>
      <div className="mt-1 min-h-[12px] text-[10px] font-bold leading-none opacity-60">{subLabel || " "}</div>
    </div>
  );
}

function DetailPill({
  label,
  value,
  unit = "",
  subLabel = "",
}: {
  label: string;
  value: number | string;
  unit?: string;
  subLabel?: string;
}) {
  return (
    <div className="rounded-lg bg-gray-50 px-2.5 py-1.5 text-[11px] text-gray-600">
      <span className="font-semibold text-gray-400">{label}</span>
      <span className="ml-1 font-bold text-gray-700">{value}{unit}</span>
      {subLabel && <div className="mt-0.5 text-[10px] font-bold text-gray-400">{subLabel}</div>}
    </div>
  );
}


function MetricLine({ label, value, unit = "" }: { label: string; value: number | string; unit?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white/70 px-2.5 py-1.5">
      <span className="text-[11px] font-bold text-gray-400">{label}</span>
      <span className="text-[12px] font-black text-gray-800 tabular-nums">{value}{unit}</span>
    </div>
  );
}

function ChannelSummaryCard({
  title,
  tone,
  monthlySales,
  dailySales,
  stock,
  inbound,
  required,
  recommended,
  unitLabel,
}: {
  title: string;
  tone: "amazon" | "rakuten";
  monthlySales: number;
  dailySales: number;
  stock: number;
  inbound: number;
  required: number;
  recommended: number;
  unitLabel: string;
}) {
  const toneClass = "border-gray-200 bg-gray-50/70 text-gray-800";

  return (
    <div className={`rounded-2xl border p-3 ${toneClass}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-black">{title}</div>
        <div className="rounded-full bg-white/75 px-2 py-0.5 text-[10px] font-black">
          必要 {smallNum(required)}{unitLabel}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 xl:grid-cols-6">
        <MetricLine label="月販" value={smallNum(monthlySales)} unit={unitLabel} />
        <MetricLine label="日販" value={smallNum(dailySales)} unit={`${unitLabel}/日`} />
        <MetricLine label="在庫" value={smallNum(stock)} unit={unitLabel} />
        <MetricLine label="納品見込み" value={smallNum(inbound)} unit={unitLabel} />
        <MetricLine label="必要" value={smallNum(required)} unit={unitLabel} />
        <MetricLine label="納品推奨" value={smallNum(recommended)} unit={unitLabel} />
      </div>
    </div>
  );
}

function OrderReasonSummary({
  requiredTotalSet,
  availableTotalSet,
  shortageSet,
  unitPerSet,
  orderQtyBara,
  totalLeadTimeDays,
}: {
  requiredTotalSet: number;
  availableTotalSet: number;
  shortageSet: number;
  unitPerSet: number;
  orderQtyBara: number;
  totalLeadTimeDays: number;
}) {
  const isSetProduct = unitPerSet > 1;
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50/70 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-black text-gray-800">
        <span>計算根拠</span>
        <span className="text-gray-300">|</span>
        <span>必要 {smallNum(requiredTotalSet)}セット</span>
        <span>−</span>
        <span>有効在庫 {smallNum(availableTotalSet)}セット</span>
        <span>=</span>
        <span>不足 {smallNum(shortageSet)}セット</span>
        <span>→</span>
        <span>中国発注 {smallNum(orderQtyBara)}個</span>
      </div>
      <div className="mt-1 text-[10px] font-bold text-gray-500">
        必要数は「Amazon日販＋楽天日販」× 総LT{smallNum(totalLeadTimeDays)}日。{isSetProduct ? `発注数は不足セット数×${unitPerSet}個/セットでバラ換算。` : "発注数は不足数をバラ数として表示。"}
      </div>
    </div>
  );
}

export default function OrderTable({
  rows,
  selected,
  onToggle,
  onToggleAll,
  filterOrderOnly,
  filterDeliveryOnly,
  params,
  productMasters,
  onOpenMaster,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [masterPreviewRow, setMasterPreviewRow] = useState<ComputedSkuRow | null>(null);

  const visibleRows = useMemo(() => {
    const filtered = filterOrderOnly || filterDeliveryOnly
      ? rows.filter((r) => {
          const isOrder = r.status === "発注推奨" || r.recommended_order_qty > 0;
          const isDelivery = r.fba_recommended_delivery_qty > 0 || r.rsl_recommended_delivery_qty > 0;
          return (filterOrderOnly && isOrder) || (filterDeliveryOnly && isDelivery);
        })
      : rows;
    return [...filtered].sort((a, b) => {
      const aPriority = (a.recommended_order_qty > 0 ? 1000000000 : 0) + a.recommended_order_qty + a.fba_recommended_delivery_qty + a.rsl_recommended_delivery_qty;
      const bPriority = (b.recommended_order_qty > 0 ? 1000000000 : 0) + b.recommended_order_qty + b.fba_recommended_delivery_qty + b.rsl_recommended_delivery_qty;
      return bPriority - aPriority;
    });
  }, [rows, filterOrderOnly, filterDeliveryOnly]);

  const visibleSkus = visibleRows.map((r) => r.sku);
  const allChecked = visibleSkus.length > 0 && visibleSkus.every((s) => selected.has(s));
  const someChecked = visibleSkus.some((s) => selected.has(s));

  const toggleExpanded = (sku: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(sku) ? next.delete(sku) : next.add(sku);
      return next;
    });
  };

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-gray-50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
          <input
            type="checkbox"
            checked={allChecked}
            ref={(el) => {
              if (el) el.indeterminate = !allChecked && someChecked;
            }}
            onChange={() => (allChecked ? onToggleAll([]) : onToggleAll(visibleSkus))}
          />
          表示中の商品を選択
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded(new Set(visibleSkus))}
            disabled={visibleSkus.length === 0}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            すべて詳細を表示
          </button>
          <button
            type="button"
            onClick={() => setExpanded(new Set())}
            disabled={expanded.size === 0}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            すべて閉じる
          </button>
          <div className="ml-1 text-xs text-gray-500">必要在庫は日販×総LTで自動計算します。</div>
        </div>
      </div>

      {visibleRows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-500">該当するデータがありません</div>
      ) : (
        <div className="space-y-3">
          {visibleRows.map((row) => {
            const master = productMasters[row.sku];
            const unitPerSet = getUnitPerSet(row, master);
            const isSetProduct = unitPerSet > 1;
            const deliveryUnitLabel = deliveryUnit(unitPerSet);
            const deliverySubLabel = setDescription(unitPerSet);
            const chinaOrderQtyBara = Math.max(0, Number(row.recommended_order_qty || 0));
            const shortageQtyBara = toBaraQty(row.shortage_qty, unitPerSet);
            const isExpanded = expanded.has(row.sku);
            return (
              <div key={row.sku} className={`rounded-2xl border bg-white p-4 shadow-sm ${selected.has(row.sku) ? "border-indigo-300 ring-2 ring-indigo-100" : "border-gray-200"}`}>
                <div className="flex flex-wrap items-center gap-4">
                  <input type="checkbox" checked={selected.has(row.sku)} onChange={() => onToggle(row.sku)} className="h-4 w-4" />

                  {master?.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={master.image_url} alt="" className="h-14 w-14 rounded-xl border border-gray-200 object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-gray-300 text-[10px] text-gray-400">no image</div>
                  )}

                  <button type="button" onClick={() => setMasterPreviewRow(row)} className="min-w-[220px] flex-1 rounded-lg p-1 text-left hover:bg-indigo-50">
                    <div className="font-bold text-gray-900">{row.product_name || "商品名未設定"}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                      <span className="font-mono">SKU: {row.sku}</span>
                      {row.jan && <span className="font-mono">JAN: {row.jan}</span>}
                      {(master as any)?.asin && <span className="font-mono">ASIN: {(master as any).asin}</span>}
                    </div>
                    <div className="mt-1 text-[10px] font-bold text-indigo-500">クリックでマスタ情報</div>
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    <DecisionCell label="FBA推奨納品数" value={row.fba_recommended_delivery_qty} unit={deliveryUnitLabel} subLabel={deliverySubLabel} tone="blue" />
                    <DecisionCell label="RSL推奨納品数" value={row.rsl_recommended_delivery_qty} unit={deliveryUnitLabel} subLabel={deliverySubLabel} tone="green" />
                    <DecisionCell label="中国発注数" value={chinaOrderQtyBara} unit="個（バラ）" tone="orange" />
                  </div>

                  <StatusStack row={row} />
                </div>

                {isExpanded && (
                  <div className="mt-3 space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                      <ChannelSummaryCard
                        title="Amazon / FBA"
                        tone="amazon"
                        monthlySales={row.amazon_monthly_sales}
                        dailySales={row.amazon_daily_sales}
                        stock={row.amazon_stock}
                        inbound={row.fba_inbound_plan}
                        required={row.fba_required_stock}
                        recommended={row.fba_recommended_delivery_qty}
                        unitLabel={deliveryUnitLabel}
                      />
                      <ChannelSummaryCard
                        title="楽天 / RSL"
                        tone="rakuten"
                        monthlySales={row.rakuten_monthly_sales}
                        dailySales={row.rakuten_daily_sales}
                        stock={row.rakuten_stock}
                        inbound={row.rsl_inbound_plan}
                        required={row.rsl_required_stock}
                        recommended={row.rsl_recommended_delivery_qty}
                        unitLabel={deliveryUnitLabel}
                      />
                    </div>

                    <OrderReasonSummary
                      requiredTotalSet={row.fba_required_stock + row.rsl_required_stock}
                      availableTotalSet={row.amazon_stock + row.rakuten_stock + row.fba_inbound_plan + row.rsl_inbound_plan + Math.floor(Number(row.ap_stock || 0) / unitPerSet)}
                      shortageSet={row.shortage_qty}
                      unitPerSet={unitPerSet}
                      orderQtyBara={chinaOrderQtyBara}
                      totalLeadTimeDays={row.total_lead_time_days}
                    />
                  </div>
                )}

                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" onClick={() => toggleExpanded(row.sku)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50">
                    {isExpanded ? "詳細を閉じる" : "詳細を見る"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {masterPreviewRow && (
        <MasterPreviewModal
          row={masterPreviewRow}
          master={productMasters[masterPreviewRow.sku]}
          onClose={() => setMasterPreviewRow(null)}
          onOpenMaster={onOpenMaster}
        />
      )}
    </div>
  );
}


function MasterPreviewModal({ row, master, onClose, onOpenMaster }: { row: ComputedSkuRow; master?: ProductMasterItem; onClose: () => void; onOpenMaster?: (sku: string) => void }) {
  const productUrl = master?.product_url || "";
  const unitPerSet = getUnitPerSet(row, master);
  const deliveryUnitLabel = deliveryUnit(unitPerSet);
  const deliverySubLabel = setDescription(unitPerSet);
  const chinaOrderQtyBara = Math.max(0, Number(row.recommended_order_qty || 0));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">商品マスタ情報</h2>
            <p className="mt-1 text-xs text-gray-500">一覧からマスタ情報を確認しています。</p>
          </div>
          <button onClick={onClose} className="rounded-lg px-3 py-1 text-sm font-bold text-gray-500 hover:bg-gray-100">✕</button>
        </div>
        <div className="flex gap-4">
          {master?.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={master.image_url} alt="" className="h-24 w-24 rounded-xl border border-gray-200 object-cover" />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-dashed border-gray-300 text-xs text-gray-400">no image</div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-base font-bold text-gray-900">{master?.product_name || row.product_name || "商品名未設定"}</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
              <PreviewInfo label="SKU" value={row.sku} />
              <PreviewInfo label="JAN" value={master?.jan || row.jan || "-"} />
              <PreviewInfo label="ASIN" value={(master as any)?.asin || "-"} />
              <PreviewInfo label="仕入単価" value={`${Number(master?.cost_rmb || 0).toLocaleString()}元`} />
              <PreviewInfo label="色" value={master?.color || "-"} />
              <PreviewInfo label="サイズ" value={master?.size || "-"} />
              <PreviewInfo label="MOQ" value={Number(master?.moq || row.moq || 0).toLocaleString()} />
              <PreviewInfo label="FBA推奨納品数" value={`${row.fba_recommended_delivery_qty.toLocaleString()} ${deliveryUnitLabel}${deliverySubLabel ? `（${deliverySubLabel}）` : ""}`} />
              <PreviewInfo label="RSL推奨納品数" value={`${row.rsl_recommended_delivery_qty.toLocaleString()} ${deliveryUnitLabel}${deliverySubLabel ? `（${deliverySubLabel}）` : ""}`} />
              <PreviewInfo label="中国発注数" value={`${chinaOrderQtyBara.toLocaleString()} 個（バラ）`} />
            </div>
            <div className="mt-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
              <div className="font-bold text-gray-500">検品項目</div>
              <div className="mt-1">{master?.default_inspection_items?.length ? master.default_inspection_items.join(" / ") : "-"}</div>
            </div>
            <div className="mt-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
              <div className="font-bold text-gray-500">備考</div>
              <div className="mt-1 whitespace-pre-wrap">{master?.memo || "-"}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {onOpenMaster && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenMaster(row.sku);
                  }}
                  className="inline-flex rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white hover:bg-gray-700"
                >
                  商品マスタで編集
                </button>
              )}
              {productUrl && (
                <a href={productUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-500">1688URLを開く</a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-2.5 py-2">
      <div className="text-[10px] font-bold text-gray-400">{label}</div>
      <div className="mt-0.5 truncate font-bold text-gray-700">{value}</div>
    </div>
  );
}

function SkuSettingsModal({
  row,
  params,
  onClose,
  onSave,
}: {
  row: ComputedSkuRow;
  params: OrderParams;
  onClose: () => void;
  onSave: (updates: Partial<RawSkuRow>) => void;
}) {
  const [moq, setMoq] = useState<number>(row.moq ?? 0);
  const [orderUnit, setOrderUnit] = useState<number>(row.order_unit ?? 0);
  const [productType, setProductType] = useState<ProductType>(row.product_type ?? params.product_type);
  const [factoryLt, setFactoryLt] = useState<number>(row.factory_lt_days ?? params.factory_lt_days);
  const [inspectionType, setInspectionType] = useState<InspectionType>(row.inspection_type ?? params.inspection_type);
  const [inspectionLt, setInspectionLt] = useState<number>(row.ap_inspection_lt_days ?? params.ap_inspection_lt_days);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>(row.shipping_method ?? params.shipping_method);
  const [shippingLt, setShippingLt] = useState<number>(row.international_shipping_lt_days ?? params.international_shipping_lt_days);
  const [receivingLt, setReceivingLt] = useState<number>(row.fba_rsl_receiving_lt_days ?? params.fba_rsl_receiving_lt_days);
  const [safetyStock, setSafetyStock] = useState<number>(row.safety_stock_days ?? params.safety_stock_days);
  const totalLt = factoryLt + inspectionLt + shippingLt + receivingLt;

  const changeProductType = (value: ProductType) => {
    setProductType(value);
    setFactoryLt(PRODUCT_DEFAULT_LT[value]);
  };
  const changeInspectionType = (value: InspectionType) => {
    setInspectionType(value);
    setInspectionLt(INSPECTION_DEFAULT_LT[value]);
  };
  const changeShippingMethod = (value: ShippingMethod) => {
    setShippingMethod(value);
    setShippingLt(SHIPPING_DEFAULT_LT[value]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">SKU個別設定</h2>
            <p className="mt-1 text-sm text-gray-500">{row.sku} / {row.product_name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg px-3 py-1 text-sm font-bold text-gray-500 hover:bg-gray-100">✕</button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="mb-2 text-xs font-bold text-gray-700">発注条件</p>
            <NumberInput label="MOQ（未入力/0なら考慮しない）" value={moq} onChange={setMoq} unit="個" />
            <NumberInput label="発注単位（未入力/0なら1個単位）" value={orderUnit} onChange={setOrderUnit} unit="個" />
          </div>
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="mb-3 text-xs font-bold text-gray-700">商品タイプ / 工場LT</p>
            <Segmented options={[{ label: "既製品", value: "ready" }, { label: "OEM品", value: "oem" }]} value={productType} onChange={(v) => changeProductType(v as ProductType)} />
            <NumberInput label="工場LT" value={factoryLt} onChange={setFactoryLt} unit="日" />
          </div>
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="mb-3 text-xs font-bold text-gray-700">AP検品LT</p>
            <Segmented options={[{ label: "簡易検品", value: "simple" }, { label: "詳細検品", value: "detailed" }]} value={inspectionType} onChange={(v) => changeInspectionType(v as InspectionType)} />
            <NumberInput label="AP検品LT" value={inspectionLt} onChange={setInspectionLt} unit="日" />
          </div>
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="mb-3 text-xs font-bold text-gray-700">国際輸送LT</p>
            <Segmented options={[{ label: "航空便", value: "air" }, { label: "船便", value: "sea" }]} value={shippingMethod} onChange={(v) => changeShippingMethod(v as ShippingMethod)} />
            <NumberInput label="国際輸送LT" value={shippingLt} onChange={setShippingLt} unit="日" />
          </div>
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="mb-3 text-xs font-bold text-gray-700">受領LT</p>
            <NumberInput label="FBA/RSL受領LT" value={receivingLt} onChange={setReceivingLt} unit="日" />
            <NumberInput label="安全在庫" value={safetyStock} onChange={setSafetyStock} unit="日" />
            <div className="mt-4 rounded-lg bg-indigo-50 p-3 text-sm font-bold text-indigo-700">総リードタイム：{totalLt}日</div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">キャンセル</button>
          <button
            onClick={() => onSave({ moq, order_unit: orderUnit, product_type: productType, factory_lt_days: factoryLt, inspection_type: inspectionType, ap_inspection_lt_days: inspectionLt, shipping_method: shippingMethod, international_shipping_lt_days: shippingLt, fba_rsl_receiving_lt_days: receivingLt, safety_stock_days: safetyStock })}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-500"
          >
            保存して反映
          </button>
        </div>
      </div>
    </div>
  );
}

function NumberInput({ label, value, onChange, unit }: { label: string; value: number; onChange: (value: number) => void; unit: string }) {
  return (
    <label className="mt-3 block">
      <span className="mb-1 block text-[11px] font-semibold text-gray-500">{label}</span>
      <div className="flex items-center gap-2">
        <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} className="h-9 w-28 rounded-lg border border-gray-300 bg-white px-3 text-center text-sm font-medium text-gray-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
        <span className="text-xs text-gray-500">{unit}</span>
      </div>
    </label>
  );
}

function Segmented({ options, value, onChange }: { options: { label: string; value: string }[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button key={option.value} type="button" onClick={() => onChange(option.value)} className={`rounded-md px-2 py-1.5 text-xs font-bold transition ${active ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:bg-white"}`}>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
