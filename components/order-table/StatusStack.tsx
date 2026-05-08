"use client";

import type { ComputedSkuRow } from "@/types";

export default function StatusStack({ row }: { row: ComputedSkuRow }) {
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
