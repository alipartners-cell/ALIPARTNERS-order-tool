"use client";

import { useState } from "react";
import type { InspectionType, OrderParams, ProductType, ShippingMethod } from "@/types";

interface Props {
  params: OrderParams;
  appliedParams?: OrderParams;
  onChange: (params: OrderParams) => void;
  onApply?: () => void;
}

const PRODUCT_DEFAULT_LT: Record<ProductType, number> = {
  ready: 5,
  oem: 30,
};

const INSPECTION_DEFAULT_LT: Record<InspectionType, number> = {
  simple: 3,
  detailed: 6,
};

const SHIPPING_DEFAULT_LT: Record<ShippingMethod, number> = {
  air: 5,
  sea: 14,
};

const sameParams = (a?: OrderParams, b?: OrderParams) => {
  if (!a || !b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
};

export default function ParamsPanel({ params, appliedParams, onChange, onApply }: Props) {
  const [open, setOpen] = useState(false);

  const updateNumber = (key: keyof OrderParams, value: string) => {
    onChange({
      ...params,
      [key]: Number(value) || 0,
    });
  };

  const updateProductType = (productType: ProductType) => {
    onChange({
      ...params,
      product_type: productType,
      factory_lt_days: PRODUCT_DEFAULT_LT[productType],
    });
  };

  const updateInspectionType = (inspectionType: InspectionType) => {
    onChange({
      ...params,
      inspection_type: inspectionType,
      ap_inspection_lt_days: INSPECTION_DEFAULT_LT[inspectionType],
    });
  };

  const updateShippingMethod = (shippingMethod: ShippingMethod) => {
    onChange({
      ...params,
      shipping_method: shippingMethod,
      international_shipping_lt_days: SHIPPING_DEFAULT_LT[shippingMethod],
    });
  };

  const totalLeadTime =
    params.factory_lt_days +
    params.ap_inspection_lt_days +
    params.international_shipping_lt_days +
    params.fba_rsl_receiving_lt_days;

  const appliedTotalLeadTime = appliedParams
    ? appliedParams.factory_lt_days +
      appliedParams.ap_inspection_lt_days +
      appliedParams.international_shipping_lt_days +
      appliedParams.fba_rsl_receiving_lt_days
    : totalLeadTime;

  const dirty = !sameParams(params, appliedParams);

  return (
    <section className="shrink-0 border-b border-gray-200 bg-gray-50 px-5 py-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left shadow-sm hover:bg-gray-50"
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-gray-900">全SKU一括設定</span>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-600">
              入力中 総LT {totalLeadTime}日
            </span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
              反映中 総LT {appliedTotalLeadTime}日
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-600">
              安全在庫 {params.safety_stock_days}日
            </span>
            {dirty && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                未反映の変更あり
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            ここで変更しただけでは計算に反映されません。「全SKUに反映」ボタンを押すと、個別設定のないSKUにだけ反映されます。
          </p>
        </div>
        <span className="text-lg font-bold text-gray-500">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-bold text-gray-700">商品タイプ / 工場LT</p>
              <Segmented
                options={[
                  { label: "既製品", value: "ready" },
                  { label: "OEM品", value: "oem" },
                ]}
                value={params.product_type}
                onChange={(v) => updateProductType(v as ProductType)}
              />
              <NumberInput
                label="工場LT"
                value={params.factory_lt_days}
                onChange={(v) => updateNumber("factory_lt_days", v)}
              />
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-bold text-gray-700">AP検品LT</p>
              <Segmented
                options={[
                  { label: "簡易検品", value: "simple" },
                  { label: "詳細検品", value: "detailed" },
                ]}
                value={params.inspection_type}
                onChange={(v) => updateInspectionType(v as InspectionType)}
              />
              <NumberInput
                label="AP検品LT"
                value={params.ap_inspection_lt_days}
                onChange={(v) => updateNumber("ap_inspection_lt_days", v)}
              />
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-bold text-gray-700">国際輸送LT</p>
              <Segmented
                options={[
                  { label: "航空便", value: "air" },
                  { label: "船便", value: "sea" },
                ]}
                value={params.shipping_method}
                onChange={(v) => updateShippingMethod(v as ShippingMethod)}
              />
              <NumberInput
                label="国際輸送LT"
                value={params.international_shipping_lt_days}
                onChange={(v) => updateNumber("international_shipping_lt_days", v)}
              />
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-bold text-gray-700">受領・安全在庫</p>
              <NumberInput
                label="FBA/RSL受領LT"
                value={params.fba_rsl_receiving_lt_days}
                onChange={(v) => updateNumber("fba_rsl_receiving_lt_days", v)}
              />
              <NumberInput
                label="安全在庫"
                value={params.safety_stock_days}
                onChange={(v) => updateNumber("safety_stock_days", v)}
              />
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-bold text-gray-700">計算ルール</p>
              <p className="text-[11px] leading-relaxed text-gray-600">
                必要在庫数 = 日販 ×（総リードタイム + 安全在庫）
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-gray-600">
                不足分 = 必要在庫数 - 現在在庫
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-gray-600">
                推奨発注数 = 不足分にMOQ・発注単位を反映
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-indigo-900">全SKU一括設定を計算に反映</p>
              <p className="mt-1 text-xs text-indigo-700">
                ボタンを押すまで、ここで入力したLT・安全在庫は計算に反映されません。個別SKU設定がある場合は個別設定を優先します。
              </p>
            </div>
            <button
              type="button"
              onClick={onApply}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!dirty}
            >
              全SKUに反映
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mt-3 block">
      <span className="mb-1 block text-[11px] font-semibold text-gray-500">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-24 rounded-lg border border-gray-300 bg-white px-3 text-center text-sm font-medium text-gray-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        <span className="text-xs text-gray-500">日</span>
      </div>
    </label>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-md px-2 py-1.5 text-xs font-bold transition ${
              active
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-white"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
