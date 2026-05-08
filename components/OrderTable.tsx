"use client";

import { useMemo, useState } from "react";
import MasterPreviewModal from "@/components/MasterPreviewModal";
import SkuSettingsModal from "@/components/SkuSettingsModal";

import type {
  ComputedSkuRow,
  OrderParams,
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
  sortType: "priority" | "china" | "fba" | "rsl";
  expandedSkus: Set<string>;
  onToggleExpanded: (sku: string) => void;
}

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
    <div className={`flex h-[86px] w-[140px] shrink-0 flex-col justify-center rounded-xl border px-3 py-2 text-right transition ${color}`}>
      <div className="text-[11px] font-bold leading-none opacity-70">{label}</div>
      <div className="mt-1 whitespace-nowrap text-xl font-black leading-tight tabular-nums">
        {qtyText(value)}{unit ? <span className="ml-1 text-xs font-bold">{unit}</span> : null}
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
  sortType,
  expandedSkus,
  onToggleExpanded,
}: Props) {
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
      if (sortType === "china") {
        return Number(b.recommended_order_qty || 0) - Number(a.recommended_order_qty || 0);
      }

      if (sortType === "fba") {
        return Number(b.fba_recommended_delivery_qty || 0) - Number(a.fba_recommended_delivery_qty || 0);
      }

      if (sortType === "rsl") {
        return Number(b.rsl_recommended_delivery_qty || 0) - Number(a.rsl_recommended_delivery_qty || 0);
      }

      const aPriority = (a.recommended_order_qty > 0 ? 1000000000 : 0) + a.recommended_order_qty + a.fba_recommended_delivery_qty + a.rsl_recommended_delivery_qty;
      const bPriority = (b.recommended_order_qty > 0 ? 1000000000 : 0) + b.recommended_order_qty + b.fba_recommended_delivery_qty + b.rsl_recommended_delivery_qty;
      return bPriority - aPriority;
    });
  }, [rows, filterOrderOnly, filterDeliveryOnly, sortType]);

  return (
    <div className="bg-gray-50 p-4">
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
            const isExpanded = expandedSkus.has(row.sku);
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
                  <button type="button" onClick={() => onToggleExpanded(row.sku)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50">
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


function PreviewInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-2.5 py-2">
      <div className="text-[10px] font-bold text-gray-400">{label}</div>
      <div className="mt-0.5 truncate font-bold text-gray-700">{value}</div>
    </div>
  );
}
