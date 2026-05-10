"use client";

import { useMemo, useState } from "react";
import type { ComputedSkuRow, ProductMasterItem } from "@/types";

type ApStockSheetItem = {
  jan: string;
  ap_stock: number;
  product_name?: string;
  url?: string;
  color?: string;
  size?: string;
  [key: string]: unknown;
};

export default function ApStockView({
  rows,
  productMasters,
  apStockItems,
  onRefresh,
  updating,
}: {
  rows: ComputedSkuRow[];
  productMasters: Record<string, ProductMasterItem>;
  apStockItems: ApStockSheetItem[];
  onRefresh: () => void;
  updating: boolean;
}) {
  const [apStatusFilter, setApStatusFilter] = useState<"all" | "shortage" | "excess" | "exact">("all");

  const normalizeJan = (value: unknown) => String(value ?? "").replace(/\D/g, "").trim();
  const rowByJan = new Map(rows.map((row) => [normalizeJan(row.jan), row]));

  const displayItems = useMemo(() => {
    const source = apStockItems.length > 0
      ? apStockItems
      : rows.map((row) => {
          const master = productMasters[row.sku];
          return { jan: row.jan, product_name: row.product_name, ap_stock: row.ap_stock, url: master?.product_url, color: master?.color, size: master?.size } as ApStockSheetItem;
        });

    return source.map((item, idx) => {
      const matched = rowByJan.get(normalizeJan(item.jan));
      const master = matched ? productMasters[matched.sku] : undefined;
      const rawUnitPerSet = Number((master as any)?.unit_per_set ?? (matched as any)?.unit_per_set ?? 1);
      const unitPerSet = Number.isFinite(rawUnitPerSet) && rawUnitPerSet > 0 ? Math.floor(rawUnitPerSet) : 1;

      // AP在庫は「個（バラ）」管理。FBA/RSL推奨納品数は「セット」管理。
      // そのため、AP在庫は一度セット換算してから割当・不足を計算する。
      const apStock = Number(item.ap_stock) || 0;
      const apStockSet = unitPerSet > 1 ? Math.floor(apStock / unitPerSet) : apStock;
      const fbaRecommend = matched?.fba_recommended_delivery_qty ?? 0;
      const rslRecommend = matched?.rsl_recommended_delivery_qty ?? 0;

      // 割当はセット単位
      const fbaAlloc = Math.min(apStockSet, fbaRecommend);
      const rslAlloc = Math.min(Math.max(0, apStockSet - fbaAlloc), rslRecommend);
      const apRemainSet = Math.max(0, apStockSet - fbaAlloc - rslAlloc);
      const shortageSet = Math.max(0, fbaRecommend + rslRecommend - apStockSet);

      // 表示・集計用の余剰/不足は個（バラ）単位
      const apRemain = unitPerSet > 1 ? apRemainSet * unitPerSet + (apStock % unitPerSet) : apRemainSet;
      const shortage = unitPerSet > 1 ? shortageSet * unitPerSet : shortageSet;

      return {
        key: `${item.jan || matched?.sku || idx}-${idx}`,
        item,
        row: matched,
        master,
        unitPerSet,
        apStock,
        apStockSet,
        fbaRecommend,
        rslRecommend,
        fbaAlloc,
        rslAlloc,
        apRemain,
        apRemainSet,
        shortage,
        shortageSet,
      };
    });
  }, [apStockItems, rows, productMasters]);

  const filteredDisplayItems = useMemo(() => {
    return displayItems.filter((item) => {
      if (apStatusFilter === "shortage") return item.shortage > 0;
      if (apStatusFilter === "excess") return item.apRemain > 0;
      if (apStatusFilter === "exact") return item.shortage === 0 && item.apRemain === 0;
      return true;
    });
  }, [displayItems, apStatusFilter]);

  const fmt = (value: number) => Number(value || 0).toLocaleString();

  return (
    <div className="flex-1 overflow-auto bg-gray-50 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-base font-black text-gray-900">AP在庫</h2>
          <p className="mt-1 text-xs text-gray-500">FBA/RSLへの推奨納品数に対してAP在庫が足りるか確認します。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-bold text-gray-500">状態</span>
          <button
            type="button"
            onClick={() => setApStatusFilter("all")}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              apStatusFilter === "all"
                ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}
          >
            すべて
          </button>
          <button
            type="button"
            onClick={() => setApStatusFilter("shortage")}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              apStatusFilter === "shortage"
                ? "border-red-200 bg-red-50 text-red-600"
                : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}
          >
            不足
          </button>
          <button
            type="button"
            onClick={() => setApStatusFilter("excess")}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              apStatusFilter === "excess"
                ? "border-sky-200 bg-sky-50 text-sky-700"
                : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}
          >
            余剰
          </button>
          <button
            type="button"
            onClick={() => setApStatusFilter("exact")}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              apStatusFilter === "exact"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}
          >
            ちょうど
          </button>
          <span className="text-xs font-semibold text-gray-500">
            {filteredDisplayItems.length.toLocaleString()}/{displayItems.length.toLocaleString()}件表示
          </span>
        </div>
        <button type="button" onClick={onRefresh} disabled={updating} className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50">
          {updating ? "在庫更新中…" : "AP在庫を更新"}
        </button>
      </div>

      <div className="max-h-[calc(100vh-260px)] overflow-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-[1280px] w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-20 bg-gray-100 text-[11px] font-bold text-gray-500 shadow-sm"><tr>
            <th className="border-b border-gray-200 px-3 py-2">商品</th><th className="border-b border-gray-200 px-3 py-2">URL</th><th className="border-b border-gray-200 px-3 py-2">JAN</th><th className="border-b border-gray-200 px-3 py-2">色</th><th className="border-b border-gray-200 px-3 py-2">型号/サイズ</th><th className="border-b border-gray-200 px-3 py-2 text-right">AP在庫（バラ）</th><th className="border-b border-gray-200 px-3 py-2 text-right">FBA推奨納品数</th><th className="border-b border-gray-200 px-3 py-2 text-right">RSL推奨納品数</th><th className="border-b border-gray-200 px-3 py-2 text-right">FBA割当（セット）</th><th className="border-b border-gray-200 px-3 py-2 text-right">RSL割当（セット）</th><th className="border-b border-gray-200 px-3 py-2 text-right">余剰数（バラ）</th><th className="border-b border-gray-200 px-3 py-2 text-right">不足数（バラ）</th><th className="border-b border-gray-200 px-3 py-2">状態</th>
          </tr></thead>
          <tbody>
            {filteredDisplayItems.map((v, idx) => {
              const status = v.shortage > 0 ? "不足" : v.apRemain > 0 ? "余剰" : "ちょうど";
              const statusClass = v.shortage > 0 ? "border-red-200 bg-red-50 text-red-600" : v.apRemain > 0 ? "border-sky-200 bg-sky-50 text-sky-700" : "border-emerald-200 bg-emerald-50 text-emerald-700";
              const productName = v.row?.product_name || v.master?.product_name || v.item.product_name || "商品名未設定";
              const productUrl = v.master?.product_url || v.item.url || "";
              const color = v.master?.color || String(v.item.color ?? "");
              const size = v.master?.size || String(v.item.size ?? "");
              return <tr key={v.key} className={idx % 2 ? "bg-white" : "bg-gray-50/60"}>
                <td className="border-b border-gray-100 px-3 py-2"><div className="font-bold text-gray-900">{productName}</div>{v.row?.sku && <div className="mt-0.5 font-mono text-[10px] text-gray-400">SKU: {v.row.sku}</div>}</td>
                <td className="max-w-[220px] truncate border-b border-gray-100 px-3 py-2 font-mono text-[10px] text-indigo-600">{productUrl ? <a href={productUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">{productUrl}</a> : "—"}</td>
                <td className="border-b border-gray-100 px-3 py-2 font-mono">{v.item.jan || v.row?.jan || "—"}</td>
                <td className="border-b border-gray-100 px-3 py-2">{color || "—"}</td><td className="border-b border-gray-100 px-3 py-2">{size || "—"}</td>
                <td className="border-b border-gray-100 px-3 py-2 text-right font-bold tabular-nums">
                  <div>{fmt(v.apStock)}</div>
                  {v.unitPerSet > 1 && <div className="text-[10px] font-semibold text-gray-400">約{fmt(v.apStockSet)}セット相当</div>}
                </td>
                <td className="border-b border-gray-100 px-3 py-2 text-right font-bold text-indigo-700 tabular-nums">{fmt(v.fbaRecommend)}</td>
                <td className="border-b border-gray-100 px-3 py-2 text-right font-bold text-emerald-700 tabular-nums">{fmt(v.rslRecommend)}</td>
                <td className="border-b border-gray-100 px-3 py-2 text-right tabular-nums">{fmt(v.fbaAlloc)}</td>
                <td className="border-b border-gray-100 px-3 py-2 text-right tabular-nums">{fmt(v.rslAlloc)}</td>
                <td className="border-b border-gray-100 px-3 py-2 text-right tabular-nums">
                  <div>{fmt(v.apRemain)}</div>
                  {v.unitPerSet > 1 && <div className="text-[10px] font-semibold text-gray-400">約{fmt(v.apRemainSet)}セット相当</div>}
                </td>
                <td className={`border-b border-gray-100 px-3 py-2 text-right font-black tabular-nums ${v.shortage > 0 ? "text-red-600" : "text-gray-400"}`}>
                  <div>{fmt(v.shortage)}</div>
                  {v.unitPerSet > 1 && <div className="text-[10px] font-semibold text-gray-400">{fmt(v.shortageSet)}セット相当</div>}
                </td>
                <td className="border-b border-gray-100 px-3 py-2"><span className={`inline-flex min-w-[56px] items-center justify-center whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-bold ${statusClass}`}>{status}</span></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ApSummaryCard({ label, value, tone = "gray" }: { label: string; value: number; tone?: "gray" | "blue" | "green" | "red" }) {
  const color = tone === "blue" ? "text-indigo-700 bg-indigo-50 border-indigo-100" : tone === "green" ? "text-emerald-700 bg-emerald-50 border-emerald-100" : tone === "red" ? "text-red-700 bg-red-50 border-red-100" : "text-gray-800 bg-white border-gray-200";
  return <div className={`rounded-2xl border p-4 shadow-sm ${color}`}><p className="text-[11px] font-bold opacity-70">{label}</p><p className="mt-1 text-2xl font-black tabular-nums">{Number(value || 0).toLocaleString()}</p></div>;
}
