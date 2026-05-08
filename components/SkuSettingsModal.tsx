"use client";

import { useState } from "react";
import type {
  ComputedSkuRow,
  InspectionType,
  OrderParams,
  ProductType,
  RawSkuRow,
  ShippingMethod,
} from "@/types";

const PRODUCT_DEFAULT_LT: Record<ProductType, number> = { ready: 5, oem: 30 };
const INSPECTION_DEFAULT_LT: Record<InspectionType, number> = { simple: 3, detailed: 6 };
const SHIPPING_DEFAULT_LT: Record<ShippingMethod, number> = { air: 5, sea: 14 };

export default function SkuSettingsModal({
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
