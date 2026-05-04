"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComputedSkuRow, ProductMasterItem } from "@/types";
import type { InspectionSelections } from "@/lib/csv";

type Props = {
  rows: ComputedSkuRow[];
  selected: Set<string>;
  onToggle: (sku: string) => void;
  onDownloadOrderCsv?: () => void;
  filterOrderOnly: boolean;
  productMasters: Record<string, ProductMasterItem>;
  inspectionSelections?: InspectionSelections;
};

type CalendarKind = "urgent" | "soon" | "future";

type CalendarItem = {
  sku: string;
  jan: string;
  product_name: string;
  recommended_order_qty: number;
  display_order_qty: number;
  orderDate: Date;
  orderDateKey: string;
  stockoutDate: Date | null;
  amazonStockoutDate: Date | null;
  rakutenStockoutDate: Date | null;
  status: ComputedSkuRow["status"];
  kind: CalendarKind;
  cost_rmb: number;
  product_cost_jpy: number;
  inspection_cost_jpy: number;
  required_funds_jpy: number;
  row: ComputedSkuRow;
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const INSPECTION_COST_RMB: Record<string, number> = {
  "詳細検品": 2,
  "セット組": 1,
  "OPP袋": 0.5,
  "印刷物": 1,
  "バーコード": 0.5,
};

function getInspectionUnitCostRmb(items: string[]) {
  return items.reduce((sum, item) => sum + (INSPECTION_COST_RMB[item] ?? 0), 0);
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function diffDays(from: Date, to: Date) {
  return Math.floor((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000);
}

function formatDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateLabel(date: Date | null) {
  if (!date) return "-";
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function getMonthDays(currentMonth: Date) {
  const first = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function roundByMoqAndUnit(qty: number, moq?: number, orderUnit?: number) {
  const safeQty = Number(qty || 0);
  const safeMoq = Number(moq || 0);
  const safeOrderUnit = Number(orderUnit || 0);
  const unit = safeOrderUnit > 0 ? safeOrderUnit : 1;
  if (!Number.isFinite(safeQty) || safeQty <= 0) return 0;
  let result = safeQty;
  if (safeMoq > 0 && result < safeMoq) result = safeMoq;
  return Math.ceil(result / unit) * unit;
}

function getOrderDate(row: ComputedSkuRow) {
  const today = startOfDay(new Date());
  const dailySales = Number(row.daily_sales || 0);
  if (!Number.isFinite(dailySales) || dailySales <= 0) {
    return { orderDate: today, stockoutDate: null, canCalculate: false };
  }
  const daysUntilStockout = Math.floor(Number(row.available_stock || 0) / dailySales);
  const stockoutDate = addDays(today, daysUntilStockout);
  const daysBeforeStockout = Number(row.total_lead_time_days || 0) + Number(row.effective_safety_stock_days || 0);
  const calculatedOrderDate = addDays(stockoutDate, -daysBeforeStockout);
  return {
    orderDate: calculatedOrderDate < today ? today : calculatedOrderDate,
    stockoutDate,
    canCalculate: true,
  };
}

function getChannelStockoutDate(stock: number, inbound: number, dailySales: number) {
  const today = startOfDay(new Date());
  const daily = Number(dailySales || 0);
  if (!Number.isFinite(daily) || daily <= 0) return null;
  const available = Number(stock || 0) + Number(inbound || 0);
  return addDays(today, Math.floor(Math.max(0, available) / daily));
}

function getCalendarKind(orderDate: Date): CalendarKind {
  const days = diffDays(startOfDay(new Date()), orderDate);
  if (days <= 0) return "urgent";
  if (days <= 30) return "soon";
  return "future";
}

function getItemClass(kind: CalendarKind, isSelected: boolean) {
  if (isSelected) return "border-indigo-400 bg-indigo-50 hover:bg-indigo-100";
  if (kind === "urgent") return "border-red-100 bg-red-50 hover:bg-red-100";
  if (kind === "soon") return "border-amber-100 bg-amber-50 hover:bg-amber-100";
  return "border-sky-100 bg-sky-50 hover:bg-sky-100";
}

function getQtyClass(kind: CalendarKind) {
  if (kind === "urgent") return "text-red-600";
  if (kind === "soon") return "text-amber-600";
  return "text-sky-600";
}

function getCountBadgeClass(kind: CalendarKind) {
  if (kind === "urgent") return "bg-red-50 text-red-600";
  if (kind === "soon") return "bg-amber-50 text-amber-600";
  return "bg-sky-50 text-sky-600";
}

function getKindLabel(kind: CalendarKind) {
  if (kind === "urgent") return "要発注";
  if (kind === "soon") return "30日以内";
  return "将来予定";
}

export default function OrderCalendar({
  rows,
  selected,
  onToggle,
  onDownloadOrderCsv,
  filterOrderOnly,
  productMasters,
  inspectionSelections = {},
}: Props) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [rateInfo, setRateInfo] = useState<{ tts: number; applied: number; date: string; source: string } | null>(null);
  const [rateMessage, setRateMessage] = useState("");
  const [manualTts, setManualTts] = useState("");
  const [modal, setModal] = useState<{ title: string; items: CalendarItem[] } | null>(null);
  const [showUncalculatableRows, setShowUncalculatableRows] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("lastValidCnyTtsRate") : null;
    const storedDate = typeof window !== "undefined" ? window.localStorage.getItem("lastValidCnyRateDate") : null;
    if (stored) {
      const tts = Number(stored);
      if (Number.isFinite(tts) && tts >= 15 && tts <= 35) {
        setRateInfo({ tts, applied: Number((tts + 1).toFixed(2)), date: storedDate || "保存済み", source: "保存済み TTS+1" });
        setRateMessage("MUFGから取得できない場合は保存済みレートを使います。");
      }
    }
    fetch("/api/cny-rate", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const tts = Number(data?.tts);
        if (Number.isFinite(tts) && tts >= 15 && tts <= 35) {
          const date = String(data?.date || new Date().toISOString().slice(0, 10));
          window.localStorage.setItem("lastValidCnyTtsRate", String(tts));
          window.localStorage.setItem("lastValidCnyRateDate", date);
          setRateInfo({ tts, applied: Number((tts + 1).toFixed(2)), date, source: "MUFG TTS+1" });
          setRateMessage("");
        } else if (data?.message) {
          setRateMessage(String(data.message));
        }
      })
      .catch(() => setRateMessage("CNYレートを自動取得できませんでした。保存済みレートまたは手入力を使ってください。"));
    return () => {
      cancelled = true;
    };
  }, []);

  const applyManualRate = () => {
    const tts = Number(manualTts);
    if (!Number.isFinite(tts) || tts < 15 || tts > 35) return;
    const date = new Date().toISOString().slice(0, 10);
    window.localStorage.setItem("lastValidCnyTtsRate", String(tts));
    window.localStorage.setItem("lastValidCnyRateDate", date);
    setRateInfo({ tts, applied: Number((tts + 1).toFixed(2)), date, source: "手入力 TTS+1" });
    setRateMessage("");
    setManualTts("");
  };

  const appliedCnyRate = rateInfo?.applied ?? 0;

  const uncalculatableRows = useMemo(() => rows.filter((row) => Number(row.daily_sales || 0) <= 0), [rows]);

  const calendarItems = useMemo<CalendarItem[]>(() => {
    return rows
      .filter((row) => {
        if (filterOrderOnly) return row.status === "発注推奨";
        return Number(row.daily_sales || 0) > 0;
      })
      .map((row) => {
        const { orderDate, stockoutDate } = getOrderDate(row);
        const master = productMasters[row.sku];
        const costRmb = Number(master?.cost_rmb || 0);
        const selectedInspectionItems = inspectionSelections[row.sku]?.length
          ? inspectionSelections[row.sku]
          : master?.default_inspection_items ?? [];
        const inspectionUnitCostRmb = getInspectionUnitCostRmb(selectedInspectionItems);
        const kind = getCalendarKind(orderDate);
        const displayOrderQty = row.recommended_order_qty > 0
          ? row.recommended_order_qty
          : roundByMoqAndUnit(row.required_stock, row.moq, row.order_unit);
        const productCostJpy = displayOrderQty * costRmb * appliedCnyRate;
        const inspectionCostJpy = displayOrderQty * inspectionUnitCostRmb * appliedCnyRate;
        return {
          sku: row.sku,
          jan: row.jan,
          product_name: row.product_name,
          recommended_order_qty: row.recommended_order_qty,
          display_order_qty: displayOrderQty,
          orderDate,
          orderDateKey: formatDateKey(orderDate),
          stockoutDate,
          amazonStockoutDate: getChannelStockoutDate(row.amazon_stock, row.fba_inbound_plan, row.amazon_daily_sales),
          rakutenStockoutDate: getChannelStockoutDate(row.rakuten_stock, row.rsl_inbound_plan, row.rakuten_daily_sales),
          status: row.status,
          kind,
          cost_rmb: costRmb,
          product_cost_jpy: productCostJpy,
          inspection_cost_jpy: inspectionCostJpy,
          required_funds_jpy: productCostJpy + inspectionCostJpy,
          row,
        };
      })
      .sort((a, b) => a.orderDate.getTime() - b.orderDate.getTime());
  }, [rows, filterOrderOnly, productMasters, inspectionSelections, appliedCnyRate]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    calendarItems.forEach((item) => {
      const list = map.get(item.orderDateKey) ?? [];
      list.push(item);
      map.set(item.orderDateKey, list);
    });
    return map;
  }, [calendarItems]);

  const days = getMonthDays(currentMonth);
  const todayKey = formatDateKey(new Date());
  const displayMonthLabel = `${currentMonth.getFullYear()}年${currentMonth.getMonth() + 1}月`;

  const monthlyItems = calendarItems.filter(
    (item) => item.orderDate.getFullYear() === currentMonth.getFullYear() && item.orderDate.getMonth() === currentMonth.getMonth()
  );
  const monthlyQty = monthlyItems.reduce((sum, item) => sum + item.display_order_qty, 0);
  const monthlyProductCostJpy = monthlyItems.reduce((sum, item) => sum + item.product_cost_jpy, 0);
  const monthlyInspectionCostJpy = monthlyItems.reduce((sum, item) => sum + item.inspection_cost_jpy, 0);
  const monthlyFundsJpy = monthlyProductCostJpy + monthlyInspectionCostJpy;
  const urgentItems = calendarItems.filter((item) => item.kind === "urgent");
  const futureItems = calendarItems.filter((item) => item.kind !== "urgent");

  const selectItems = (items: CalendarItem[]) => {
    items.forEach((item) => {
      if (!selected.has(item.sku)) onToggle(item.sku);
    });
  };

  const clearItems = (items: CalendarItem[]) => {
    items.forEach((item) => {
      if (selected.has(item.sku)) onToggle(item.sku);
    });
  };

  const allItemsSelected = (items: CalendarItem[]) =>
    items.length > 0 && items.every((item) => selected.has(item.sku));

  const moveMonth = (diff: number) => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + diff, 1));
  };

  const goThisMonth = () => {
    const d = new Date();
    setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50 p-5">
      <div className="min-w-[1180px] shrink-0">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">発注計画カレンダー</h2>
          <p className="mt-1 text-xs text-gray-500">在庫切れ予測日から総リードタイムと安全在庫日数を逆算して発注予定日を表示します。</p>
        </div>
        <div className="flex items-center gap-2">
          {onDownloadOrderCsv && (
            <button
              type="button"
              onClick={onDownloadOrderCsv}
              disabled={selected.size === 0}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-30"
            >
              ↓ 発注CSVダウンロード{selected.size > 0 ? `（${selected.size}件）` : ""}
            </button>
          )}
          <button onClick={() => moveMonth(-1)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100">← 前月</button>
          <div className="min-w-[120px] text-center text-sm font-bold text-gray-900">{currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月</div>
          <button onClick={() => moveMonth(1)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100">翌月 →</button>
          <button onClick={goThisMonth} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-500">今月</button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-5 gap-3">
        <SummaryCard label="今日までに発注すべきSKU" value={urgentItems.length} danger={urgentItems.length > 0} onClick={() => setModal({ title: "今日までに発注すべきSKU", items: urgentItems })} />
        <SummaryCard label={`${displayMonthLabel}の発注予定SKU`} value={monthlyItems.length} onClick={() => setModal({ title: `${displayMonthLabel}の発注予定SKU`, items: monthlyItems })} />
        <SummaryCard label={`${displayMonthLabel}の目安発注数`} value={monthlyQty} onClick={() => setModal({ title: `${displayMonthLabel}の発注数目安`, items: monthlyItems })} />
        <FundsSummaryCard
          label={`${displayMonthLabel}の必要資金目安`}
          total={monthlyFundsJpy}
          productCost={monthlyProductCostJpy}
          inspectionCost={monthlyInspectionCostJpy}
          subLabel={rateInfo ? `${rateInfo.source}：${rateInfo.applied.toFixed(2)}円 / ${rateInfo.date}` : "CNYレート未取得"}
        />
        <SummaryCard label="将来の発注予定SKU" value={futureItems.length} onClick={() => setModal({ title: "将来の発注予定SKU", items: futureItems })} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-bold text-gray-600">
        <span className="rounded-full bg-red-50 px-3 py-1 text-red-600">赤：今日までに発注</span>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-600">黄：30日以内に発注予定</span>
        <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-600">青：将来の発注予定</span>
        {uncalculatableRows.length > 0 && <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-500">日販0で計算不可：{uncalculatableRows.length}件</span>}
      </div>
      </div>

      <div className="min-w-[1180px] flex-1 overflow-auto pr-1">
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
        <span className="font-bold text-gray-600">CNYレート</span>
        <span className="text-gray-500">{rateInfo ? `適用：${rateInfo.applied.toFixed(2)}円（TTS ${rateInfo.tts.toFixed(2)} + 1）` : "自動取得できない場合は手入力してください"}</span>
        {rateMessage ? <span className="text-amber-700">{rateMessage}</span> : null}
        <input
          type="number"
          step="0.01"
          value={manualTts}
          onChange={(e) => setManualTts(e.target.value)}
          placeholder="TTS例 23.73"
          className="h-8 w-28 rounded-lg border border-gray-300 px-2 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        <button type="button" onClick={applyManualRate} className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-gray-700">手入力レートを適用</button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {WEEKDAYS.map((day) => (
            <div key={day} className="border-r border-gray-200 px-3 py-2 text-center text-xs font-bold text-gray-500 last:border-r-0">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            const key = formatDateKey(day);
            const items = itemsByDate.get(key) ?? [];
            const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
            const isToday = key === todayKey;
            const isWeekEnd = index % 7 === 6;
            const firstKind = items[0]?.kind ?? "future";
            return (
              <div key={key} className={`min-h-[132px] border-b border-r border-gray-200 p-2 ${isWeekEnd ? "border-r-0" : ""} ${isCurrentMonth ? "bg-white" : "bg-gray-50 text-gray-300"}`}>
                <div className="mb-2 flex items-center justify-between">
                  <span className={`text-xs font-bold ${isToday ? "rounded-full bg-indigo-600 px-2 py-0.5 text-white" : isCurrentMonth ? "text-gray-600" : "text-gray-300"}`}>{day.getDate()}</span>
                  {items.length > 0 && <button type="button" onClick={() => setModal({ title: `${formatDateLabel(day)}の発注予定`, items })} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getCountBadgeClass(firstKind)}`}>{items.length}件</button>}
                </div>
                <div className="space-y-1">
                  {items.slice(0, 4).map((item) => {
                    const isSelected = selected.has(item.sku);
                    return (
                      <button key={item.sku} onClick={() => onToggle(item.sku)} className={`w-full rounded-lg border px-2 py-1 text-left text-[11px] transition ${getItemClass(item.kind, isSelected)}`}>
                        <div className="mb-0.5 flex items-center justify-between gap-1">
                          <span className="truncate font-bold text-gray-900">{item.sku}</span>
                          <span className={`shrink-0 font-bold ${getQtyClass(item.kind)}`}>{item.display_order_qty.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate text-[10px] text-gray-500">{item.product_name}</span>
                          <span className={`shrink-0 text-[10px] font-bold ${getQtyClass(item.kind)}`}>{getKindLabel(item.kind)}</span>
                        </div>
                      </button>
                    );
                  })}
                  {items.length > 4 && <button type="button" onClick={() => setModal({ title: `${formatDateLabel(day)}の発注予定`, items })} className="text-[10px] font-bold text-gray-400 hover:text-indigo-600">+{items.length - 4}件を表示</button>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-gray-900">発注予定リスト</h3>
          {calendarItems.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => selectItems(calendarItems)} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100">表示中を一括選択</button>
              <button type="button" onClick={() => clearItems(calendarItems)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-bold text-gray-600 hover:bg-gray-50">表示中を一括解除</button>
              {onDownloadOrderCsv && (
                <button type="button" onClick={onDownloadOrderCsv} disabled={selected.size === 0} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-30">選択中を発注CSVダウンロード</button>
              )}
            </div>
          )}
        </div>
        {calendarItems.length === 0 ? (
          <p className="text-xs text-gray-500">表示できる発注予定がありません。</p>
        ) : (
          <div className="max-h-[280px] overflow-auto">
            <table className="min-w-[1180px] w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-white text-gray-500">
                <tr className="border-b border-gray-200">
                  <th className="px-2 py-2">発注予定日</th>
                  <th className="px-2 py-2">区分</th>
                  <th className="px-2 py-2">SKU</th>
                  <th className="px-2 py-2">商品名</th>
                  <th className="px-2 py-2 text-right">発注数目安</th>
                  <th className="px-2 py-2 text-right">必要資金目安</th>
                  <th className="px-2 py-2">在庫切れ予測(Amazon)</th>
                  <th className="px-2 py-2">在庫切れ予測(楽天)</th>
                  <th className="px-2 py-2">選択</th>
                </tr>
              </thead>
              <tbody>
                {calendarItems.map((item) => (
                  <tr key={item.sku} className="border-b border-gray-100">
                    <td className="px-2 py-2 font-bold text-gray-900">{formatDateLabel(item.orderDate)}</td>
                    <td className="px-2 py-2"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${getCountBadgeClass(item.kind)}`}>{getKindLabel(item.kind)}</span></td>
                    <td className="px-2 py-2 font-mono text-gray-700"><button type="button" onClick={() => setModal({ title: item.sku, items: [item] })} className="font-bold text-indigo-600 hover:underline">{item.sku}</button></td>
                    <td className="px-2 py-2 text-gray-700">{item.product_name}</td>
                    <td className={`px-2 py-2 text-right font-bold ${getQtyClass(item.kind)}`}>{item.display_order_qty.toLocaleString()}</td>
                    <td className="px-2 py-2 text-right font-bold text-gray-700">{appliedCnyRate > 0 && item.required_funds_jpy > 0 ? `¥${Math.round(item.required_funds_jpy).toLocaleString()}` : "-"}</td>
                    <td className="px-2 py-2 text-gray-500">{formatDateLabel(item.amazonStockoutDate)}</td>
                    <td className="px-2 py-2 text-gray-500">{formatDateLabel(item.rakutenStockoutDate)}</td>
                    <td className="px-2 py-2">
                      <button onClick={() => onToggle(item.sku)} className={`rounded-full px-3 py-1 text-[11px] font-bold ${selected.has(item.sku) ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                        {selected.has(item.sku) ? "選択中" : "選択"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {uncalculatableRows.length > 0 && !filterOrderOnly && (
          <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 shadow-sm">
            <button
              type="button"
              onClick={() => setShowUncalculatableRows((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-100"
            >
              <span className="text-xs font-bold text-gray-600">
                日販0のため発注予定日を計算できないSKU（{uncalculatableRows.length}件）
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-gray-500 shadow-sm">
                {showUncalculatableRows ? "閉じる ▲" : "クリックで展開 ▼"}
              </span>
            </button>

            {showUncalculatableRows && (
              <div className="border-t border-gray-200 p-3">
                <div className="max-h-[220px] overflow-auto rounded-lg bg-white p-3">
                  <div className="flex flex-wrap gap-2">
                    {uncalculatableRows.map((row) => (
                      <span key={row.sku} className="rounded-full bg-gray-50 px-3 py-1 text-[11px] font-bold text-gray-500 shadow-sm">
                        {row.sku}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      </div>
      {modal && <CalendarItemsModal title={modal.title} items={modal.items} productMasters={productMasters} onClose={() => setModal(null)} onToggle={onToggle} selected={selected} appliedCnyRate={appliedCnyRate} onSelectAll={selectItems} onClearAll={clearItems} allSelected={allItemsSelected(modal.items)} />}
    </div>
  );
}

function FundsSummaryCard({
  label,
  total,
  productCost,
  inspectionCost,
  subLabel,
}: {
  label: string;
  total: number;
  productCost: number;
  inspectionCost: number;
  subLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/20" title="クリックで内訳を表示">
      <p className="text-xs font-bold text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">¥{Math.round(total).toLocaleString()}</p>
      {subLabel && <p className="mt-1 truncate text-[10px] font-semibold text-gray-400">{subLabel}</p>}
      {open && (
        <div className="mt-3 space-y-1 rounded-lg bg-gray-50 p-3 text-[11px] font-bold text-gray-600">
          <div className="flex justify-between gap-3"><span>商品代金</span><span>¥{Math.round(productCost).toLocaleString()}</span></div>
          <div className="flex justify-between gap-3"><span>検品費用</span><span>¥{Math.round(inspectionCost).toLocaleString()}</span></div>
        </div>
      )}
    </button>
  );
}

function SummaryCard({
  label,
  value,
  danger,
  prefix = "",
  subLabel,
  onClick,
}: {
  label: string;
  value: number;
  danger?: boolean;
  prefix?: string;
  subLabel?: string;
  onClick?: () => void;
}) {
  const Component = onClick ? "button" : "div";
  return (
    <Component type={onClick ? "button" : undefined} onClick={onClick} className="rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/20">
      <p className="text-xs font-bold text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${danger ? "text-red-600" : "text-gray-900"}`}>{prefix}{value.toLocaleString()}</p>
      {subLabel && <p className="mt-1 truncate text-[10px] font-semibold text-gray-400">{subLabel}</p>}
      {onClick && <p className="mt-1 text-[10px] font-bold text-indigo-500">クリックでSKU表示</p>}
    </Component>
  );
}

function CalendarItemsModal({
  title,
  items,
  productMasters,
  onClose,
  onToggle,
  selected,
  appliedCnyRate,
  onSelectAll,
  onClearAll,
  allSelected,
}: {
  title: string;
  items: CalendarItem[];
  productMasters: Record<string, ProductMasterItem>;
  onClose: () => void;
  onToggle: (sku: string) => void;
  selected: Set<string>;
  appliedCnyRate: number;
  onSelectAll: (items: CalendarItem[]) => void;
  onClearAll: (items: CalendarItem[]) => void;
  allSelected: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">{title}</h3>
            <p className="mt-1 text-xs text-gray-500">{items.length}件</p>
          </div>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <>
                <button type="button" onClick={() => onSelectAll(items)} disabled={allSelected} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-40">一括選択</button>
                <button type="button" onClick={() => onClearAll(items)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50">一括解除</button>
              </>
            )}
            <button onClick={onClose} className="rounded-lg px-3 py-1 text-sm font-bold text-gray-500 hover:bg-gray-100">✕</button>
          </div>
        </div>
        <div className="max-h-[70vh] overflow-auto p-4">
          {items.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">対象SKUはありません。</div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const master = productMasters[item.sku];
                return (
                  <div key={item.sku} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                    <div className="flex items-start gap-3">
                      {master?.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={master.image_url} alt="" className="h-16 w-16 rounded-xl border border-gray-200 object-cover" />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-gray-300 text-[10px] text-gray-400">no image</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-600">{getKindLabel(item.kind)}</span>
                          <span className="font-mono text-xs font-bold text-indigo-600">{item.sku}</span>
                          {item.jan && <span className="font-mono text-xs text-gray-500">JAN: {item.jan}</span>}
                        </div>
                        <div className="mt-1 font-bold text-gray-900">{item.product_name || master?.product_name || "商品名未設定"}</div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs md:grid-cols-4 lg:grid-cols-6">
                          <MiniInfo label="発注予定日" value={formatDateLabel(item.orderDate)} />
                          <MiniInfo label="発注数目安" value={item.display_order_qty.toLocaleString()} />
                          <MiniInfo label="必要資金目安" value={appliedCnyRate > 0 ? `¥${Math.round(item.required_funds_jpy).toLocaleString()}` : "-"} />
                          <MiniInfo label="商品代金" value={appliedCnyRate > 0 ? `¥${Math.round(item.product_cost_jpy).toLocaleString()}` : "-"} />
                          <MiniInfo label="検品費用" value={appliedCnyRate > 0 ? `¥${Math.round(item.inspection_cost_jpy).toLocaleString()}` : "-"} />
                          <MiniInfo label="仕入単価" value={`${Number(master?.cost_rmb || 0).toLocaleString()}元`} />
                          <MiniInfo label="在庫切れ予測(Amazon)" value={formatDateLabel(item.amazonStockoutDate)} />
                          <MiniInfo label="在庫切れ予測(楽天)" value={formatDateLabel(item.rakutenStockoutDate)} />
                          <MiniInfo label="FBA推奨納品数" value={item.row.fba_recommended_delivery_qty.toLocaleString()} />
                          <MiniInfo label="RSL推奨納品数" value={item.row.rsl_recommended_delivery_qty.toLocaleString()} />
                          <MiniInfo label="色/サイズ" value={`${master?.color || "-"} / ${master?.size || "-"}`} />
                          <MiniInfo label="1688URL" value={master?.product_url ? "登録あり" : "-"} />
                        </div>
                      </div>
                      <button onClick={() => onToggle(item.sku)} className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${selected.has(item.sku) ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                        {selected.has(item.sku) ? "選択中" : "選択"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-2.5 py-2">
      <div className="text-[10px] font-bold text-gray-400">{label}</div>
      <div className="mt-0.5 truncate font-bold text-gray-700">{value}</div>
    </div>
  );
}
