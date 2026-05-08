"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ProductMasterItem, PurchaseSkuItem } from "@/types";
import { INSPECTION_ITEMS, type InspectionItem } from "@/lib/csv";
import {
  EMPTY_FORM,
  toNumber,
  normalizeSku,
  normalizeMaster,
  hasComponentJan,
  getMasterStatus,
} from "@/lib/productMasterNormalizer";
import {
  MASTER_TEMPLATE_SAMPLE,
  masterItemToXlsxRow,
  buildMasterWorkbook,
  downloadWorkbook,
  readXlsxRows,
  type ProductMasterItemWithSet,
} from "@/lib/productMasterExcel";

type Props = {
  masters: ProductMasterItem[];
  purchaseSkus?: PurchaseSkuItem[];
  onChange: (next: ProductMasterItem[]) => void;
  onBack?: () => void;
  focusSku?: string;
};




export default function ProductMaster({
  masters,
  purchaseSkus = [],
  onChange,
  onBack,
  focusSku,
}: Props) {
  const normalizedMasters = useMemo(() => masters.map((item) => normalizeMaster(item)), [masters]);
  const [form, setForm] = useState<ProductMasterItemWithSet>(EMPTY_FORM);
  const [editingSku, setEditingSku] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<"all" | "complete" | "draft">("all");
  const [bulkLtOpen, setBulkLtOpen] = useState(false);
  const [structureOpen, setStructureOpen] = useState(false);
  const [bulkLtForm, setBulkLtForm] = useState({
    factory_lt_days: 5,
    ap_inspection_lt_days: 3,
    international_shipping_lt_days: 5,
    fba_rsl_receiving_lt_days: 3,
    safety_stock_days: 15,
  });

  useEffect(() => {
    const sku = normalizeSku(String(focusSku ?? ""));
    if (!sku) return;

    setStatusFilter("all");
    setQuery(sku);

    const timer = window.setTimeout(() => {
      const escapedSku = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(sku) : sku.replace(/"/g, '\\"');
      const row = document.querySelector(`[data-master-sku="${escapedSku}"]`);
      if (row) {
        row.scrollIntoView({ block: "center", behavior: "smooth" });
        row.classList.add("ring-2", "ring-indigo-300", "bg-indigo-50");
        window.setTimeout(() => {
          row.classList.remove("ring-2", "ring-indigo-300", "bg-indigo-50");
        }, 1800);
      }
    }, 120);

    return () => window.clearTimeout(timer);
  }, [focusSku]);

  const filteredMasters = useMemo(() => {
    const q = query.trim().toLowerCase();
    return normalizedMasters.filter((item) => {
      if (statusFilter !== "all" && item.master_status !== statusFilter) return false;
      if (!q) return true;
      return [item.sku, item.jan, item.asin, item.product_name, item.product_url, item.item_type, item.component_jan_1, item.component_jan_2, item.component_jan_3, item.component_jan_4, item.component_jan_5, item.component_purchase_sku_1, item.component_purchase_sku_2, item.component_purchase_sku_3, item.component_purchase_sku_4, item.component_purchase_sku_5]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [normalizedMasters, query, statusFilter]);

  const masterBySku = useMemo(() => {
    const map = new Map<string, ProductMasterItem>();
    normalizedMasters.forEach((item) => map.set(item.sku, item));
    return map;
  }, [normalizedMasters]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingSku(null);
    setStructureOpen(false);
  };

  const saveForm = () => {
    const sku = normalizeSku(form.sku);
    if (!sku) {
      alert("SKUを入力してください");
      return;
    }

    const item: ProductMasterItemWithSet = normalizeMaster({
      ...form,
      sku,
      master_status: "complete",
    });

    if ((item.item_type === "set" || item.item_type === "bundle") && !hasComponentJan(item)) {
      alert(item.item_type === "set"
        ? "セット商品は、構成する単品JANを1つ以上入力してください"
        : "付属品は、付属先の親商品JANをcomponent_janに入力してください"
      );
      return;
    }

    if (!editingSku && masterBySku.has(sku)) {
      const ok = confirm("同じSKUがすでにあります。上書きしますか？");
      if (!ok) return;
    }

    const next = normalizedMasters.filter((m) => m.sku !== (editingSku ?? sku));
    next.push(item);
    next.sort((a, b) => a.sku.localeCompare(b.sku));
    onChange(next);
    resetForm();
  };

  const editItem = (item: ProductMasterItem) => {
    const normalized = normalizeMaster(item);
    setForm(normalized);
    setEditingSku(item.sku);
    setStructureOpen(normalized.item_type !== "single");
  };

  const copyItem = (item: ProductMasterItem) => {
    const copied = normalizeMaster(item);
    setForm({
      ...copied,
      sku: `${copied.sku}_copy`,
      jan: "",
      asin: "",
    });
    setEditingSku(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteItem = (sku: string) => {
    const ok = confirm(`${sku} を商品マスタから削除しますか？`);
    if (!ok) return;
    onChange(normalizedMasters.filter((item) => item.sku !== sku));
    setSelectedSkus((prev) => {
      const next = new Set(prev);
      next.delete(sku);
      return next;
    });
    if (editingSku === sku) resetForm();
  };

  const visibleSkus = filteredMasters.map((item) => item.sku);
  const allVisibleChecked = visibleSkus.length > 0 && visibleSkus.every((sku) => selectedSkus.has(sku));
  const someVisibleChecked = visibleSkus.some((sku) => selectedSkus.has(sku));

  const toggleMasterSelection = (sku: string) => {
    setSelectedSkus((prev) => {
      const next = new Set(prev);
      next.has(sku) ? next.delete(sku) : next.add(sku);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedSkus((prev) => {
      const next = new Set(prev);
      if (allVisibleChecked) {
        visibleSkus.forEach((sku) => next.delete(sku));
      } else {
        visibleSkus.forEach((sku) => next.add(sku));
      }
      return next;
    });
  };

  const bulkDeleteSelected = () => {
    if (selectedSkus.size === 0) return;
    const ok = confirm(`選択中の${selectedSkus.size}件を商品マスタから削除しますか？`);
    if (!ok) return;
    onChange(normalizedMasters.filter((item) => !selectedSkus.has(item.sku)));
    if (editingSku && selectedSkus.has(editingSku)) resetForm();
    setSelectedSkus(new Set());
  };

  const applyBulkLtToAll = () => {
    if (normalizedMasters.length === 0) return;
    const ok = confirm(`登録済み商品${normalizedMasters.length}件に各工程LTを一括反映しますか？`);
    if (!ok) return;
    onChange(normalizedMasters.map((item) => normalizeMaster({
      ...item,
      factory_lt_days: bulkLtForm.factory_lt_days,
      ap_inspection_lt_days: bulkLtForm.ap_inspection_lt_days,
      international_shipping_lt_days: bulkLtForm.international_shipping_lt_days,
      fba_rsl_receiving_lt_days: bulkLtForm.fba_rsl_receiving_lt_days,
      safety_stock_days: bulkLtForm.safety_stock_days,
    })));
  };

  const toggleInspectionItem = (item: InspectionItem) => {
    const current = form.default_inspection_items ?? [];
    const next = current.includes(item)
      ? current.filter((v) => v !== item)
      : [...current, item];
    setForm({ ...form, default_inspection_items: next });
  };



  const exportXlsxTemplate = () => {
    const workbook = buildMasterWorkbook(MASTER_TEMPLATE_SAMPLE);
    downloadWorkbook(workbook, "product_master_template.xlsx");
  };

  const exportXlsx = () => {
    const rows = normalizedMasters.map((item) => masterItemToXlsxRow(item));
    const workbook = buildMasterWorkbook(rows);
    downloadWorkbook(workbook, `product_master_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const importXlsx = async (file: File) => {
    try {
      const rows = await readXlsxRows(file);

      const parsed = rows
        .map((row) => normalizeMaster(row))
        .filter((item) => item.sku);

      if (parsed.length === 0) {
        alert("取り込めるSKUがありませんでした。テンプレートの sku 列を確認してください。");
        return;
      }

      const current = new Map<string, ProductMasterItemWithSet>(normalizedMasters.map((item) => [item.sku, item]));
      let added = 0;
      let updated = 0;

      parsed.forEach((item) => {
        if (current.has(item.sku)) updated += 1;
        else added += 1;
        current.set(item.sku, { ...item, master_status: getMasterStatus(item) });
      });

      onChange(Array.from(current.values()).sort((a, b) => a.sku.localeCompare(b.sku)));
      alert(`商品マスタExcelを取り込みました\n追加：${added}件\n更新：${updated}件`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "商品マスタExcelの読み込みに失敗しました");
    }
  };





  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-gray-50 p-5">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">商品マスタ</h2>
          <p className="mt-1 text-xs text-gray-500">
            Excel読込では上書きされない固定情報です。SKUで一覧・カレンダー・発注CSVに紐づけます。登録済み商品の行をクリックすると編集できます。
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100"
            >
              一覧へ戻る
            </button>
          )}
          <button
            onClick={exportXlsxTemplate}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100"
          >
            ExcelテンプレートDL
          </button>
          <label className="cursor-pointer rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100">
            Excel一括アップロード
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importXlsx(file);
                e.currentTarget.value = "";
              }}
            />
          </label>
          <button
            onClick={exportXlsx}
            disabled={normalizedMasters.length === 0}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
          >
            マスタExcel DL
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <SummaryCard label="登録SKU" value={normalizedMasters.length} />
        <SummaryCard
          label="要補完"
          value={normalizedMasters.filter((item) => item.master_status === "draft").length}
        />
      </div>

      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">
            {editingSku ? `編集中：${editingSku}` : "新規登録 / 編集"}
          </h3>
          {editingSku && (
            <button onClick={resetForm} className="text-xs font-bold text-gray-500 hover:text-gray-900">
              編集を解除
            </button>
          )}
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-1 row-span-2">
            <ImageUrlBox
              value={form.image_url}
              onChange={(imageUrl) => setForm({ ...form, image_url: imageUrl })}
            />
          </div>

          <div className="col-span-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <SectionTitle title="基本情報" description="SKU / JAN / ASIN / 商品名など、商品を識別する情報です。" />
            <div className="grid grid-cols-3 gap-3">
              <TextInput label="SKU（必須）" value={form.sku} onChange={(v) => setForm({ ...form, sku: v })} />
              <TextInput label="JAN" value={form.jan} onChange={(v) => setForm({ ...form, jan: v })} />
              <TextInput label="ASIN" value={form.asin} onChange={(v) => setForm({ ...form, asin: v })} />
              <TextInput label="商品名" value={form.product_name} onChange={(v) => setForm({ ...form, product_name: v })} className="col-span-2" />
              <TextInput label="色" value={form.color} onChange={(v) => setForm({ ...form, color: v })} />
              <TextInput label="仕入先URL（1688/淘宝等）" value={form.product_url} onChange={(v) => setForm({ ...form, product_url: v })} className="col-span-2" />
              <TextInput label="サイズ" value={form.size} onChange={(v) => setForm({ ...form, size: v })} />
            </div>
          </div>

          <div className="col-span-4 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={() => setStructureOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-100/70"
            >
              <div>
                <p className="text-sm font-bold text-gray-900">商品構成を設定</p>
                <p className="mt-0.5 text-[11px] text-gray-500">
                  セット商品・付属品のみ設定します。通常の単品商品は変更不要です。
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[10px] font-bold text-gray-500">
                  {form.item_type === "set" ? "セット" : form.item_type === "bundle" ? "付属品" : "単品"}
                </span>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-bold text-gray-600">
                  {structureOpen ? "閉じる ▲" : "展開 ▼"}
                </span>
              </div>
            </button>

            {structureOpen && (
              <div className="border-t border-gray-200 p-4">
                <div className="mb-3 grid grid-cols-4 gap-3">
                  <SelectInput
                    label="商品種別"
                    value={form.item_type ?? "single"}
                    onChange={(v) => setForm({ ...form, item_type: v as any })}
                    options={[
                      { value: "single", label: "単品" },
                      { value: "set", label: "セット" },
                      { value: "bundle", label: "付属品" },
                    ]}
                  />
                </div>

                {(form.item_type === "set" || form.item_type === "bundle") ? (
                  <div>
                    {(form.item_type === "set" || form.item_type === "bundle") && (
  <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700">
    セット商品は構成する単品JANと構成発注SKU、付属品は付属先の親商品JANと発注SKUを入力してください
  </div>
)}
                    <div className="grid grid-cols-6 gap-3">
                      <TextInput label="構成JAN1" value={form.component_jan_1 ?? ""} onChange={(v) => setForm({ ...form, component_jan_1: v })} />
                      <TextInput label="構成発注SKU1" value={form.component_purchase_sku_1 ?? ""} onChange={(v) => setForm({ ...form, component_purchase_sku_1: v })} />
                      <NumberInput label="数量1" value={form.component_qty_1 ?? 1} onChange={(v) => setForm({ ...form, component_qty_1: Math.max(1, v || 1) })} />
                      <TextInput label="構成JAN2" value={form.component_jan_2 ?? ""} onChange={(v) => setForm({ ...form, component_jan_2: v })} />
                      <TextInput label="構成発注SKU2" value={form.component_purchase_sku_2 ?? ""} onChange={(v) => setForm({ ...form, component_purchase_sku_2: v })} />
                      <NumberInput label="数量2" value={form.component_qty_2 ?? 1} onChange={(v) => setForm({ ...form, component_qty_2: Math.max(1, v || 1) })} />
                      <TextInput label="構成JAN3" value={form.component_jan_3 ?? ""} onChange={(v) => setForm({ ...form, component_jan_3: v })} />
                      <TextInput label="構成発注SKU3" value={form.component_purchase_sku_3 ?? ""} onChange={(v) => setForm({ ...form, component_purchase_sku_3: v })} />
                      <NumberInput label="数量3" value={form.component_qty_3 ?? 1} onChange={(v) => setForm({ ...form, component_qty_3: Math.max(1, v || 1) })} />
                      <TextInput label="構成JAN4" value={form.component_jan_4 ?? ""} onChange={(v) => setForm({ ...form, component_jan_4: v })} />
                      <TextInput label="構成発注SKU4" value={form.component_purchase_sku_4 ?? ""} onChange={(v) => setForm({ ...form, component_purchase_sku_4: v })} />
                      <NumberInput label="数量4" value={form.component_qty_4 ?? 1} onChange={(v) => setForm({ ...form, component_qty_4: Math.max(1, v || 1) })} />
                      <TextInput label="構成JAN5" value={form.component_jan_5 ?? ""} onChange={(v) => setForm({ ...form, component_jan_5: v })} />
                      <TextInput label="構成発注SKU5" value={form.component_purchase_sku_5 ?? ""} onChange={(v) => setForm({ ...form, component_purchase_sku_5: v })} />
                      <NumberInput label="数量5" value={form.component_qty_5 ?? 1} onChange={(v) => setForm({ ...form, component_qty_5: Math.max(1, v || 1) })} />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[11px] font-bold text-gray-500">
                    単品商品は構成JANの設定不要です。
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="col-span-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <SectionTitle title="発注条件" description="発注数量の丸めやセット換算に使う固定条件です。" />
            <div className="grid grid-cols-4 gap-3">
              <NumberInput label="仕入単価（元）" value={form.cost_rmb} onChange={(v) => setForm({ ...form, cost_rmb: v })} />
              <NumberInput label="MOQ" value={form.moq} onChange={(v) => setForm({ ...form, moq: v })} />
              <NumberInput label="セット数" value={form.unit_per_set ?? 1} onChange={(v) => setForm({ ...form, unit_per_set: Math.max(1, v || 1) })} />
              <NumberInput label="発注単位（個）" value={form.order_unit ?? 0} onChange={(v) => setForm({ ...form, order_unit: v })} />
            </div>
          </div>

          <div className="col-span-4 grid grid-cols-3 gap-3">
            <LinkedLtCard title="工場LT" description="商品タイプを変更すると、工場LTの初期値が連動して変わります。">
              <SelectInput label="商品タイプ" value={form.product_type ?? "ready"} onChange={(v) => setForm({ ...form, product_type: v as any, factory_lt_days: v === "oem" ? 30 : 5 })} options={[{ value: "ready", label: "既製品" }, { value: "oem", label: "OEM" }]} />
              <NumberInput label="工場LT（日）" value={form.factory_lt_days ?? 5} onChange={(v) => setForm({ ...form, factory_lt_days: v })} />
            </LinkedLtCard>

            <LinkedLtCard title="アリパートナーズ検品LT" description="検品タイプを変更すると、AP検品LTの初期値が連動して変わります。">
              <SelectInput label="検品タイプ" value={form.inspection_type ?? "simple"} onChange={(v) => setForm({ ...form, inspection_type: v as any, ap_inspection_lt_days: v === "detailed" ? 6 : 3 })} options={[{ value: "simple", label: "簡易検品" }, { value: "detailed", label: "詳細検品" }]} />
              <NumberInput label="AP検品LT（日）" value={form.ap_inspection_lt_days ?? 3} onChange={(v) => setForm({ ...form, ap_inspection_lt_days: v })} />
            </LinkedLtCard>

            <LinkedLtCard title="国際輸送LT" description="輸送方法を変更すると、国際輸送LTの初期値が連動して変わります。">
              <SelectInput label="輸送方法" value={form.shipping_method ?? "air"} onChange={(v) => setForm({ ...form, shipping_method: v as any, international_shipping_lt_days: v === "sea" ? 14 : 5 })} options={[{ value: "air", label: "航空便" }, { value: "sea", label: "船便" }]} />
              <NumberInput label="国際輸送LT（日）" value={form.international_shipping_lt_days ?? 5} onChange={(v) => setForm({ ...form, international_shipping_lt_days: v })} />
            </LinkedLtCard>
          </div>

          <div className="col-span-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <SectionTitle title="その他LT" description="FBA/RSL側の受領LTと安全LTを管理します。" />
            <div className="grid grid-cols-4 gap-3">
              <NumberInput label="FBA/RSL受領LT（日）" value={form.fba_rsl_receiving_lt_days ?? 3} onChange={(v) => setForm({ ...form, fba_rsl_receiving_lt_days: v })} />
              <NumberInput label="安全LT（日）" value={form.safety_stock_days ?? 15} onChange={(v) => setForm({ ...form, safety_stock_days: v })} />
            </div>
          </div>

          <div className="col-span-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <SectionTitle title="デフォルト検品項目" description="商品ごとに標準で指定する検品項目です。" />
            <div className="flex flex-wrap gap-2">
              {INSPECTION_ITEMS.map((item) => {
                const checked = form.default_inspection_items.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleInspectionItem(item)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                      checked
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {checked ? "✓ " : ""}{item}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="col-span-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <SectionTitle title="備考" description="商品ごとの注意事項や補足メモを管理します。" />
            <TextInput label="備考" value={form.memo} onChange={(v) => setForm({ ...form, memo: v })} />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={resetForm}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100"
          >
            クリア
          </button>
          <button
            onClick={saveForm}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-500"
          >
            {editingSku ? "更新" : "登録"}
          </button>
        </div>
      </div>

      <div className="mb-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setBulkLtOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
        >
          <div>
            <h3 className="text-sm font-bold text-gray-900">各工程の納期一括設定</h3>
            <p className="mt-1 text-xs text-gray-500">工場LT・検品LT・国際輸送LT・受領LT・安全LTを登録済み商品へまとめて反映します。</p>
          </div>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-bold text-gray-600">{bulkLtOpen ? "閉じる ▲" : "展開 ▼"}</span>
        </button>
        {bulkLtOpen && (
          <div className="border-t border-gray-200 p-4">
            <div className="grid grid-cols-5 gap-3">
              <NumberInput label="工場LT（日）" value={bulkLtForm.factory_lt_days} onChange={(v) => setBulkLtForm({ ...bulkLtForm, factory_lt_days: v })} />
              <NumberInput label="AP検品LT（日）" value={bulkLtForm.ap_inspection_lt_days} onChange={(v) => setBulkLtForm({ ...bulkLtForm, ap_inspection_lt_days: v })} />
              <NumberInput label="国際輸送LT（日）" value={bulkLtForm.international_shipping_lt_days} onChange={(v) => setBulkLtForm({ ...bulkLtForm, international_shipping_lt_days: v })} />
              <NumberInput label="FBA/RSL受領LT（日）" value={bulkLtForm.fba_rsl_receiving_lt_days} onChange={(v) => setBulkLtForm({ ...bulkLtForm, fba_rsl_receiving_lt_days: v })} />
              <NumberInput label="安全LT（日）" value={bulkLtForm.safety_stock_days} onChange={(v) => setBulkLtForm({ ...bulkLtForm, safety_stock_days: v })} />
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={applyBulkLtToAll}
                disabled={normalizedMasters.length === 0}
                className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-bold text-white hover:bg-gray-700 disabled:opacity-40"
              >
                登録済み商品すべてに反映
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-bold text-gray-900">登録済み商品</h3>
            <div className="flex rounded-lg bg-gray-100 p-1">
              <button type="button" onClick={() => setStatusFilter("all")} className={`rounded-md px-3 py-1.5 text-[11px] font-bold ${statusFilter === "all" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"}`}>すべて</button>
              <button type="button" onClick={() => setStatusFilter("complete")} className={`rounded-md px-3 py-1.5 text-[11px] font-bold ${statusFilter === "complete" ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500 hover:text-gray-900"}`}>登録済み</button>
              <button type="button" onClick={() => setStatusFilter("draft")} className={`rounded-md px-3 py-1.5 text-[11px] font-bold ${statusFilter === "draft" ? "bg-white text-amber-700 shadow-sm" : "text-gray-500 hover:text-gray-900"}`}>要補完</button>
            </div>
            {selectedSkus.size > 0 && (
              <button
                onClick={bulkDeleteSelected}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100"
              >
                選択中{selectedSkus.size}件を一括削除
              </button>
            )}
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="SKU / JAN / 商品名 / URLで検索"
            className="w-80 rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <div className="max-h-[520px] overflow-auto">
          <table className="w-full min-w-[1180px] text-left text-xs">
            <thead className="sticky top-0 z-10 bg-gray-50 text-gray-500">
              <tr className="border-b border-gray-200">
                <th className="w-10 px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={allVisibleChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = !allVisibleChecked && someVisibleChecked;
                    }}
                    onChange={toggleAllVisible}
                  />
                </th>
                <th className="px-3 py-2">画像</th>
                <th className="px-3 py-2">状態</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">JAN</th>
                <th className="px-3 py-2">ASIN</th>
                <th className="px-3 py-2">商品名</th>
                <th className="px-3 py-2">色</th>
                <th className="px-3 py-2">サイズ</th>
                <th className="px-3 py-2 text-right">単価(元)</th>
                <th className="px-3 py-2 text-right">セット数</th>
                <th className="px-3 py-2">商品種別</th>
                <th className="px-3 py-2">構成JAN</th>
                <th className="px-3 py-2 text-right">総LT</th>
                <th className="px-3 py-2">検品項目</th>
                <th className="px-3 py-2">備考</th>
                <th className="px-3 py-2 w-[140px]">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredMasters.length === 0 ? (
                <tr>
                  <td colSpan={17} className="px-3 py-8 text-center text-gray-500">
                    商品マスタがありません。
                  </td>
                </tr>
              ) : (
                filteredMasters.map((item) => (
                  <tr key={item.sku} data-master-sku={item.sku} onClick={() => editItem(item)} className="cursor-pointer border-b border-gray-100 transition hover:bg-indigo-50/40">
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedSkus.has(item.sku)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleMasterSelection(item.sku)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      {item.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.image_url} alt="" className="h-12 w-12 rounded-lg border border-gray-200 object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-gray-300 text-[10px] text-gray-400">
                          no image
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {item.master_status === "draft" ? (
                        <span className="inline-flex h-[20px] items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-[10px] font-bold text-amber-700">要補完</span>
                      ) : (
                        <span className="inline-flex h-[20px] items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 text-[10px] font-bold text-emerald-700">登録済み</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono font-bold text-gray-900">{item.sku}</td>
                    <td className="px-3 py-2 font-mono text-gray-600">{item.jan || "-"}</td>
                    <td className="px-3 py-2 font-mono text-gray-600">{item.asin || "-"}</td>
                    <td className="max-w-[220px] px-3 py-2">
                      <div className="font-bold text-gray-900">{item.product_name || "-"}</div>
                      {item.product_url && (
                        <a href={item.product_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="block truncate text-indigo-600 underline underline-offset-2">
                          1688 URL
                        </a>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{item.color || "-"}</td>
                    <td className="px-3 py-2 text-gray-700">{item.size || "-"}</td>
                    <td className="px-3 py-2 text-right font-bold text-gray-900">{Number(item.cost_rmb || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-bold text-gray-900">{Number(item.unit_per_set || 1).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-bold text-gray-600">
                        {item.item_type === "set" ? "セット" : item.item_type === "bundle" ? "付属品" : "単品"}
                      </span>
                    </td>
                    <td className="max-w-[220px] px-3 py-2 text-[10px] text-gray-600">
                      {item.item_type === "set" || item.item_type === "bundle" ? (
                        <div className="space-y-0.5">
                          {[1, 2, 3, 4, 5].map((n) => {
                            const jan = (item as any)[`component_jan_${n}`];
                            const purchaseSku = (item as any)[`component_purchase_sku_${n}`];
                            const qty = (item as any)[`component_qty_${n}`] || 1;
                            if (!jan && !purchaseSku) return null;
                            return (
                              <div key={n} className="font-mono">
                                {jan || "JAN未設定"} / {purchaseSku || "発注SKU未設定"} × {qty}
                              </div>
                            );
                          })}
                        </div>
                      ) : "-"}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-gray-900">{(Number(item.factory_lt_days || 0) + Number(item.ap_inspection_lt_days || 0) + Number(item.international_shipping_lt_days || 0) + Number(item.fba_rsl_receiving_lt_days || 0) + Number(item.safety_stock_days || 0)).toLocaleString()}日</td>
                    <td className="max-w-[220px] px-3 py-2 text-gray-600">
                      {item.default_inspection_items.length > 0
                        ? item.default_inspection_items.join(" / ")
                        : "-"}
                    </td>
                    <td className="max-w-[260px] px-3 py-2 text-gray-600">
                      <div className="truncate">{item.memo || "-"}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        <button onClick={(e) => { e.stopPropagation(); copyItem(item); }} className="w-full rounded-lg bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-600 hover:bg-indigo-100">
                          コピー
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); deleteItem(item.sku); }} className="w-full rounded-lg bg-red-50 px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-100">
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ImageUrlBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const imageUrl = String(value ?? "").trim();
  const isBase64 = imageUrl.startsWith("data:");
  const isAmazonImage = imageUrl.includes("m.media-amazon.com/images/");

  return (
    <div className="block h-full">
      <span className="mb-1 block text-xs font-bold text-gray-500">商品画像URL</span>

      <div className="rounded-xl border border-gray-200 bg-white p-3">
        <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 p-2">
          {imageUrl && !isBase64 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="商品画像"
              className="max-h-28 w-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-lg">
                🖼️
              </div>
              <p className="text-xs font-bold text-gray-700">画像URLを入力</p>
              <p className="mt-1 text-[10px] text-gray-400">m.media-amazon.com 推奨</p>
            </div>
          )}
        </div>

        <textarea
          value={imageUrl}
          onChange={(e) => onChange(e.target.value.trim())}
          placeholder="https://m.media-amazon.com/images/I/xxxxx.jpg"
          rows={4}
          className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-[11px] outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />

        {isBase64 && (
          <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600">
            base64画像は保存容量を圧迫するため使用しないでください。Amazon画像URLに差し替えてください。
          </p>
        )}

        {imageUrl && !isBase64 && !isAmazonImage && (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">
            Amazon画像の場合は https://m.media-amazon.com/images/I/... 形式を推奨します。
          </p>
        )}

        {imageUrl && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="mt-2 w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100"
          >
            画像URLを削除
          </button>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-3">
      <p className="text-sm font-bold text-gray-900">{title}</p>
      <p className="mt-0.5 text-[11px] text-gray-500">{description}</p>
    </div>
  );
}

function LinkedLtCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
      <SectionTitle title={title} description={description} />
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-bold text-gray-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
    </label>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-gray-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-gray-500">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(toNumber(e.target.value))}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
    </label>
  );
}
