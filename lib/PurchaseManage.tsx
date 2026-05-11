"use client";

import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { PurchaseSkuItem } from "@/types";
import type {
  PurchaseBreakdownRow,
  PurchaseSkuSummaryRow,
} from "@/lib/purchaseEngine";

type Props = {
  purchaseSkus: PurchaseSkuItem[];
  setPurchaseSkus: Dispatch<SetStateAction<PurchaseSkuItem[]>>;
  purchaseBreakdownRows: PurchaseBreakdownRow[];
  purchaseSkuSummaryRows: PurchaseSkuSummaryRow[];
  manualPurchaseOrders: Record<string, number>;
  setManualPurchaseOrders: Dispatch<SetStateAction<Record<string, number>>>;
};

const EMPTY_PURCHASE_SKU_FORM: PurchaseSkuItem = {
  purchase_sku: "",
  parent_jan: "",
  color: "",
  size: "",
  ap_stock: 0,
  moq: 0,
  order_unit: 0,
  recommended_order_qty: 0,
  url_1688: "",
  enabled: true,
} as PurchaseSkuItem;

function getText(value: unknown) {
  return String(value ?? "").trim();
}

function getNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function getFormNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function escapeCsvValue(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function downloadTextFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}


function formatQty(value: number) {
  return Number(value || 0).toLocaleString();
}

function PurchaseDecisionCell({
  label,
  value,
  unit = "個",
  tone,
}: {
  label: string;
  value: number;
  unit?: string;
  tone: "blue" | "red" | "orange" | "gray";
}) {
  const toneClass =
    tone === "blue"
      ? "border-sky-100 bg-sky-50 text-sky-700"
      : tone === "red"
        ? "border-red-100 bg-red-50 text-red-700"
        : tone === "orange"
          ? "border-orange-100 bg-orange-50 text-orange-700"
          : "border-gray-100 bg-gray-50 text-gray-700";

  return (
    <div className={`min-w-[132px] rounded-2xl border px-4 py-3 text-center ${toneClass}`}>
      <div className="text-[11px] font-black opacity-70">{label}</div>
      <div className="mt-1 text-xl font-black tabular-nums">
        {formatQty(value)}
        <span className="ml-1 text-xs font-black">{unit}</span>
      </div>
    </div>
  );
}

function PurchaseMetricLine({ label, value, unit = "" }: { label: string; value: number | string; unit?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white/75 px-2.5 py-1.5">
      <span className="text-[11px] font-bold text-gray-400">{label}</span>
      <span className="text-[12px] font-black text-gray-800 tabular-nums">{value}{unit}</span>
    </div>
  );
}

function PurchaseReasonSummary({
  requiredQty,
  apStock,
  shortageQty,
  recommendedOrderQty,
}: {
  requiredQty: number;
  apStock: number;
  shortageQty: number;
  recommendedOrderQty: number;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50/70 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-black text-gray-800">
        <span>計算根拠</span>
        <span className="text-gray-300">|</span>
        <span>必要 {formatQty(requiredQty)}個</span>
        <span>−</span>
        <span>AP在庫 {formatQty(apStock)}個</span>
        <span>=</span>
        <span>不足 {formatQty(shortageQty)}個</span>
        <span>→</span>
        <span>推奨発注 {formatQty(recommendedOrderQty)}個</span>
      </div>
      <div className="mt-1 text-[10px] font-bold text-gray-500">
        発注管理は発注SKU単位で集計します。販売JAN・構成JAN・内部管理SKUを発注単位に変換した後、AP在庫を差し引きます。
      </div>
    </div>
  );
}

export default function PurchaseManager({
  purchaseSkus,
  setPurchaseSkus,
  purchaseBreakdownRows,
  purchaseSkuSummaryRows,
  manualPurchaseOrders,
  setManualPurchaseOrders,
}: Props) {
  const [showPurchaseSkus, setShowPurchaseSkus] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [purchaseFormOpen, setPurchaseFormOpen] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseSkuItem>(
    EMPTY_PURCHASE_SKU_FORM
  );
  const [editingPurchaseSku, setEditingPurchaseSku] = useState("");

  const resetPurchaseForm = () => {
    setPurchaseForm(EMPTY_PURCHASE_SKU_FORM);
    setEditingPurchaseSku("");
    setPurchaseFormOpen(false);
  };

  const handleStartEditPurchaseSku = (item: PurchaseSkuItem) => {
    setEditingPurchaseSku(String(item.purchase_sku ?? "").trim());
    setPurchaseForm({
      ...EMPTY_PURCHASE_SKU_FORM,
      ...item,
      purchase_sku: String(item.purchase_sku ?? "").trim(),
      parent_jan: String(item.parent_jan ?? "").replace(/\D/g, "").trim(),
      color: String(item.color ?? ""),
      size: String(item.size ?? ""),
      ap_stock: Math.max(0, Math.floor(Number(item.ap_stock) || 0)),
      moq: Math.max(0, Math.floor(Number((item as any).moq) || 0)),
      order_unit: Math.max(0, Math.floor(Number((item as any).order_unit) || 0)),
      recommended_order_qty: Math.max(
        0,
        Math.floor(Number(item.recommended_order_qty) || 0)
      ),
      url_1688: String(item.url_1688 ?? ""),
      enabled: item.enabled !== false,
    } as PurchaseSkuItem);
    setPurchaseFormOpen(true);
  };

  const handleDeletePurchaseSku = (purchaseSku: string) => {
    const target = String(purchaseSku ?? "").trim();
    if (!target) return;

    const ok = window.confirm(`発注SKU「${target}」を削除しますか？`);
    if (!ok) return;

    setPurchaseSkus((prev) =>
      prev.filter((item) => String(item.purchase_sku ?? "").trim() !== target)
    );

    setManualPurchaseOrders((prev) => {
      const next = { ...prev };
      delete next[target];
      return next;
    });

    if (editingPurchaseSku === target) {
      resetPurchaseForm();
    }
  };

  const handleExportPurchaseSkusCsv = () => {
    const headers = [
      "purchase_sku",
      "parent_jan",
      "color",
      "size",
      "ap_stock",
      "moq",
      "order_unit",
      "recommended_order_qty",
      "url_1688",
      "enabled",
    ];

    const rows = purchaseSkus.map((item) => [
      item.purchase_sku,
      item.parent_jan,
      item.color,
      item.size,
      item.ap_stock,
      (item as any).moq,
      (item as any).order_unit,
      item.recommended_order_qty,
      item.url_1688,
      item.enabled !== false ? "true" : "false",
    ]);

    const csv =
      "\ufeff" +
      [headers, ...rows]
        .map((row) => row.map(escapeCsvValue).join(","))
        .join("\n");

    const ts = new Date().toISOString().slice(0, 10);
    downloadTextFile(
      csv,
      `purchase_skus_${ts}.csv`,
      "text/csv;charset=utf-8"
    );
  };

  const normalizeImportedPurchaseSku = (
    raw: Record<string, string>
  ): PurchaseSkuItem => {
    return {
      purchase_sku: String(raw.purchase_sku ?? "").trim(),
      parent_jan: String(raw.parent_jan ?? "").replace(/\D/g, "").trim(),
      color: String(raw.color ?? "").trim(),
      size: String(raw.size ?? "").trim(),
      ap_stock: Math.max(0, Math.floor(Number(raw.ap_stock) || 0)),
      moq: Math.max(0, Math.floor(Number(raw.moq) || 0)),
      order_unit: Math.max(0, Math.floor(Number(raw.order_unit) || 0)),
      recommended_order_qty: Math.max(
        0,
        Math.floor(Number(raw.recommended_order_qty) || 0)
      ),
      url_1688: String(raw.url_1688 ?? "").trim(),
      enabled: String(raw.enabled ?? "true").toLowerCase() !== "false",
    } as PurchaseSkuItem;
  };

  const handleImportPurchaseSkusCsv = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv";

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        const text = (await file.text()).replace(/^\ufeff/, "");
        const lines = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);

        if (lines.length < 2) {
          alert("CSVに取込対象データがありません");
          return;
        }

        const headers = parseCsvLine(lines[0]).map((header) =>
          header.trim()
        );

        const imported = lines
          .slice(1)
          .map((line) => {
            const values = parseCsvLine(line);
            const raw: Record<string, string> = {};

            headers.forEach((header, index) => {
              raw[header] = values[index] ?? "";
            });

            return normalizeImportedPurchaseSku(raw);
          })
          .filter((item) => item.purchase_sku);

        if (imported.length === 0) {
          alert("有効な発注SKUがありません");
          return;
        }

        const ok = window.confirm(
          `CSVから${imported.length}件を取り込みます。既存の発注SKU一覧を置き換えますか？`
        );
        if (!ok) return;

        setPurchaseSkus(
          imported.sort((a, b) =>
            String(a.purchase_sku ?? "").localeCompare(
              String(b.purchase_sku ?? "")
            )
          )
        );
        setManualPurchaseOrders({});
        resetPurchaseForm();
      } catch {
        alert("CSVの読み込みに失敗しました");
      }
    };

    input.click();
  };

  const handleExportPurchaseBackup = () => {
    const backup = {
      version: 1,
      exported_at: new Date().toISOString(),
      purchase_skus: purchaseSkus,
      manual_purchase_orders: manualPurchaseOrders,
    };

    const ts = new Date().toISOString().slice(0, 10);
    downloadTextFile(
      JSON.stringify(backup, null, 2),
      `purchase_backup_${ts}.json`,
      "application/json;charset=utf-8"
    );
  };

  const handleImportPurchaseBackup = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        const parsed = JSON.parse(await file.text());
        const rawItems = Array.isArray(parsed?.purchase_skus)
          ? parsed.purchase_skus
          : [];
        const rawManualOrders =
          parsed?.manual_purchase_orders &&
          typeof parsed.manual_purchase_orders === "object"
            ? parsed.manual_purchase_orders
            : {};

        const imported = rawItems
          .map((item: any) =>
            normalizeImportedPurchaseSku({
              purchase_sku: String(item?.purchase_sku ?? ""),
              parent_jan: String(item?.parent_jan ?? ""),
              color: String(item?.color ?? ""),
              size: String(item?.size ?? ""),
              ap_stock: String(item?.ap_stock ?? 0),
              moq: String(item?.moq ?? 0),
              order_unit: String(item?.order_unit ?? 0),
              recommended_order_qty: String(item?.recommended_order_qty ?? 0),
              url_1688: String(item?.url_1688 ?? ""),
              enabled: item?.enabled === false ? "false" : "true",
            })
          )
          .filter((item: PurchaseSkuItem) => item.purchase_sku);

        if (imported.length === 0) {
          alert("バックアップ内に有効な発注SKUがありません");
          return;
        }

        const ok = window.confirm(
          `バックアップから${imported.length}件を復元します。現在の発注SKU一覧を置き換えますか？`
        );
        if (!ok) return;

        const nextManualOrders: Record<string, number> = {};
        Object.entries(rawManualOrders).forEach(([key, value]) => {
          const purchaseSku = String(key ?? "").trim();
          const qty = Math.max(0, Math.floor(Number(value) || 0));
          if (purchaseSku) nextManualOrders[purchaseSku] = qty;
        });

        setPurchaseSkus(
          imported.sort((a: PurchaseSkuItem, b: PurchaseSkuItem) =>
            String(a.purchase_sku ?? "").localeCompare(
              String(b.purchase_sku ?? "")
            )
          )
        );
        setManualPurchaseOrders(nextManualOrders);
        resetPurchaseForm();
      } catch {
        alert("バックアップの読み込みに失敗しました");
      }
    };

    input.click();
  };

  const handleAddPurchaseSku = () => {
    const purchaseSku = String(purchaseForm.purchase_sku ?? "").trim();

    if (!purchaseSku) {
      alert("発注SKUを入力してください");
      return;
    }

    const duplicated = purchaseSkus.some((item) => {
      const currentSku = String(item.purchase_sku ?? "").trim();
      if (editingPurchaseSku && currentSku === editingPurchaseSku) return false;
      return currentSku.toLowerCase() === purchaseSku.toLowerCase();
    });

    if (duplicated) {
      alert("同じ発注SKUがすでにあります");
      return;
    }

    const nextItem: PurchaseSkuItem = {
      purchase_sku: purchaseSku,
      parent_jan: String(purchaseForm.parent_jan ?? "")
        .replace(/\D/g, "")
        .trim(),
      color: String(purchaseForm.color ?? "").trim(),
      size: String(purchaseForm.size ?? "").trim(),
      ap_stock: Math.max(0, Math.floor(Number(purchaseForm.ap_stock) || 0)),
      moq: Math.max(0, Math.floor(Number((purchaseForm as any).moq) || 0)),
      order_unit: Math.max(
        0,
        Math.floor(Number((purchaseForm as any).order_unit) || 0)
      ),
      recommended_order_qty: Math.max(
        0,
        Math.floor(Number(purchaseForm.recommended_order_qty) || 0)
      ),
      url_1688: String(purchaseForm.url_1688 ?? "").trim(),
      enabled: true,
    } as PurchaseSkuItem;

    setPurchaseSkus((prev) => {
      const next = editingPurchaseSku
        ? prev.map((item) =>
            String(item.purchase_sku ?? "").trim() === editingPurchaseSku
              ? nextItem
              : item
          )
        : [...prev, nextItem];

      return next.sort((a, b) =>
        String(a.purchase_sku ?? "").localeCompare(String(b.purchase_sku ?? ""))
      );
    });

    if (editingPurchaseSku && editingPurchaseSku !== purchaseSku) {
      setManualPurchaseOrders((prev) => {
        if (prev[editingPurchaseSku] === undefined) return prev;

        const next = { ...prev };
        next[purchaseSku] = next[editingPurchaseSku];
        delete next[editingPurchaseSku];
        return next;
      });
    }

    resetPurchaseForm();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-gray-900">発注管理</h2>

            <div className="mt-4 flex flex-wrap gap-6 text-sm font-bold text-gray-700">
              <p>発注SKU数：{purchaseSkus.length.toLocaleString()}件</p>
              <p>構成分解行数：{purchaseBreakdownRows.length.toLocaleString()}件</p>
              <p>SKU別集計：{purchaseSkuSummaryRows.length.toLocaleString()}件</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={handleExportPurchaseSkusCsv}
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
            >
              CSV出力
            </button>

            <button
              type="button"
              onClick={handleImportPurchaseSkusCsv}
              className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
            >
              CSV取込
            </button>

            <button
              type="button"
              onClick={handleExportPurchaseBackup}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
            >
              バックアップ
            </button>

            <button
              type="button"
              onClick={handleImportPurchaseBackup}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
            >
              復元
            </button>

            <button
              type="button"
              onClick={() => setPurchaseFormOpen((v) => !v)}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-500"
            >
              {purchaseFormOpen
                ? editingPurchaseSku
                  ? "発注SKU編集を閉じる ▲"
                  : "発注SKU追加を閉じる ▲"
                : "発注SKUを追加 ▼"}
            </button>
          </div>
        </div>
      </div>

      {purchaseFormOpen && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-black text-gray-900">
              {editingPurchaseSku ? "発注SKU編集" : "発注SKU追加"}
            </h3>
            <p className="mt-1 text-xs font-semibold text-gray-500">
              {editingPurchaseSku
                ? "登録済みの発注SKUを編集します。"
                : "発注SKUマスタへ1件追加します。"}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <label className="text-xs font-bold text-gray-600">
              発注SKU
              <input
                value={purchaseForm.purchase_sku ?? ""}
                onChange={(event) =>
                  setPurchaseForm((prev) => ({
                    ...prev,
                    purchase_sku: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                placeholder="例：PINK-L"
              />
            </label>

            <label className="text-xs font-bold text-gray-600">
              親JAN
              <input
                value={purchaseForm.parent_jan ?? ""}
                onChange={(event) =>
                  setPurchaseForm((prev) => ({
                    ...prev,
                    parent_jan: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                placeholder="例：458..."
              />
            </label>

            <label className="text-xs font-bold text-gray-600">
              色
              <input
                value={purchaseForm.color ?? ""}
                onChange={(event) =>
                  setPurchaseForm((prev) => ({
                    ...prev,
                    color: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                placeholder="例：粉色"
              />
            </label>

            <label className="text-xs font-bold text-gray-600">
              サイズ
              <input
                value={purchaseForm.size ?? ""}
                onChange={(event) =>
                  setPurchaseForm((prev) => ({
                    ...prev,
                    size: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                placeholder="例：L"
              />
            </label>

            <label className="text-xs font-bold text-gray-600">
              AP在庫
              <input
                type="number"
                min={0}
                value={getFormNumber(purchaseForm.ap_stock)}
                onChange={(event) =>
                  setPurchaseForm((prev) => ({
                    ...prev,
                    ap_stock: getFormNumber(event.target.value),
                  }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </label>

            <label className="text-xs font-bold text-gray-600">
              MOQ
              <input
                type="number"
                min={0}
                value={getFormNumber(purchaseForm.moq)}
                onChange={(event) =>
                  setPurchaseForm((prev) => ({
                    ...prev,
                    moq: getFormNumber(event.target.value),
                  }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </label>

            <label className="text-xs font-bold text-gray-600">
              発注単位
              <input
                type="number"
                min={0}
                value={getFormNumber(purchaseForm.order_unit)}
                onChange={(event) =>
                  setPurchaseForm((prev) => ({
                    ...prev,
                    order_unit: getFormNumber(event.target.value),
                  }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </label>

            <label className="text-xs font-bold text-gray-600">
              1688URL
              <input
                value={purchaseForm.url_1688 ?? ""}
                onChange={(event) =>
                  setPurchaseForm((prev) => ({
                    ...prev,
                    url_1688: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                placeholder="https://..."
              />
            </label>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={resetPurchaseForm}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
            >
              キャンセル
            </button>

            <button
              type="button"
              onClick={handleAddPurchaseSku}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-500"
            >
              {editingPurchaseSku ? "更新する" : "追加する"}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-gray-900">発注SKU別必要数集計</h3>
            <p className="mt-1 text-xs font-semibold text-gray-500">
              発注SKU単位で、中国へ何を何個発注するかを確認します。
            </p>
          </div>
        </div>

        {purchaseSkuSummaryRows.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 py-16 text-center text-sm font-bold text-gray-400">
            発注SKU別集計データはまだありません。
          </div>
        ) : (
          <div className="space-y-3">
            {purchaseSkuSummaryRows.map((rawRow, index) => {
              const row = rawRow as unknown as Record<string, unknown>;

              const purchaseSku =
                getText(row.purchase_sku) ||
                getText(row.component_purchase_sku) ||
                getText(row.sku);

              const requiredQty =
                getNumber(row.required_qty) ||
                getNumber(row.total_required_qty) ||
                getNumber(row.required_component_qty);

              const apStock =
                getNumber(row.ap_stock) ||
                getNumber(row.purchase_sku_ap_stock);

              const shortageQty =
                getNumber(row.shortage_qty) ||
                getNumber(row.total_shortage_qty);

              const moq = getNumber(row.moq);
              const orderUnit = getNumber(row.order_unit);

              const recommendedOrderQty =
                getNumber(row.recommended_order_qty) ||
                getNumber(row.final_recommended_order_qty);

              const manualQty =
                purchaseSku && manualPurchaseOrders[purchaseSku] !== undefined
                  ? manualPurchaseOrders[purchaseSku]
                  : "";

              const color = getText(row.color);
              const size = getText(row.size);
              const url1688 = getText(row.url_1688);
              const isRegistered = Boolean(row.is_registered_purchase_sku);

              return (
                <div
                  key={`${purchaseSku || "summary"}-${index}`}
                  className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-[10px] font-bold text-gray-400">
                      発注
                    </div>

                    <div className="min-w-[220px] flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-mono text-base font-black text-gray-900">
                          {purchaseSku || "発注SKU未設定"}
                        </div>

                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${isRegistered ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                          {isRegistered ? "発注SKU登録済" : "発注SKU未登録"}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                        {color && <span>色: {color}</span>}
                        {size && <span>サイズ: {size}</span>}
                        {url1688 ? (
                          <a
                            href={url1688}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-600 underline underline-offset-2"
                          >
                            1688URL
                          </a>
                        ) : (
                          <span>1688URL: -</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <PurchaseDecisionCell label="必要数" value={requiredQty} tone="blue" />
                      <PurchaseDecisionCell label="AP在庫" value={apStock} tone="gray" />
                      <PurchaseDecisionCell label="不足数" value={shortageQty} tone="red" />
                      <PurchaseDecisionCell label="推奨発注数" value={recommendedOrderQty} tone="orange" />
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                    <PurchaseMetricLine label="MOQ" value={formatQty(moq)} unit="個" />
                    <PurchaseMetricLine label="発注単位" value={formatQty(orderUnit)} unit="個" />
                    <div className="flex items-center justify-between gap-3 rounded-lg bg-white/75 px-2.5 py-1.5">
                      <span className="text-[11px] font-bold text-gray-400">手動発注数</span>
                      <input
                        type="number"
                        min={0}
                        value={manualQty}
                        onChange={(event) => {
                          if (!purchaseSku) return;

                          const nextValue = event.target.value;

                          setManualPurchaseOrders((prev) => {
                            const next = { ...prev };

                            if (nextValue === "") {
                              delete next[purchaseSku];
                              return next;
                            }

                            next[purchaseSku] = getFormNumber(nextValue);
                            return next;
                          });
                        }}
                        className="w-28 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-right text-xs font-bold text-gray-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        placeholder="任意"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <PurchaseReasonSummary
                      requiredQty={requiredQty}
                      apStock={apStock}
                      shortageQty={shortageQty}
                      recommendedOrderQty={recommendedOrderQty}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setShowPurchaseSkus((v) => !v)}
          className="flex w-full items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-4 text-left"
        >
          <div>
            <h3 className="text-sm font-black text-gray-900">発注SKU一覧</h3>
            <p className="mt-1 text-xs font-semibold text-gray-500">
              発注SKUマスタの確認用。必要なときだけ開きます。
            </p>
          </div>

          <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-bold text-gray-600">
            {showPurchaseSkus ? "閉じる ▲" : "開く ▼"}
          </span>
        </button>

        {showPurchaseSkus && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2">発注SKU</th>
                  <th className="px-3 py-2">親JAN</th>
                  <th className="px-3 py-2">色</th>
                  <th className="px-3 py-2">サイズ</th>
                  <th className="px-3 py-2 text-right">AP在庫</th>
                  <th className="px-3 py-2 text-right">MOQ</th>
                  <th className="px-3 py-2 text-right">発注単位</th>
                  <th className="px-3 py-2">1688URL</th>
                  <th className="px-3 py-2 text-right">操作</th>
                </tr>
              </thead>

              <tbody>
                {purchaseSkus.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-3 py-10 text-center text-sm font-bold text-gray-400"
                    >
                      発注SKUデータはまだありません。
                    </td>
                  </tr>
                ) : (
                  purchaseSkus.map((item) => (
                    <tr
                      key={item.purchase_sku}
                      className="border-b border-gray-100 hover:bg-indigo-50/30"
                    >
                      <td className="px-3 py-3 font-mono font-bold text-gray-900">
                        {item.purchase_sku || "-"}
                      </td>

                      <td className="px-3 py-3 font-mono text-gray-600">
                        {item.parent_jan || "-"}
                      </td>

                      <td className="px-3 py-3 text-gray-700">
                        {item.color || "-"}
                      </td>

                      <td className="px-3 py-3 text-gray-700">
                        {item.size || "-"}
                      </td>

                      <td className="px-3 py-3 text-right font-bold text-gray-900">
                        {getNumber(item.ap_stock).toLocaleString()}
                      </td>

                      <td className="px-3 py-3 text-right font-bold text-gray-700">
                        {getNumber(item.moq).toLocaleString()}
                      </td>

                      <td className="px-3 py-3 text-right font-bold text-gray-700">
                        {getNumber(item.order_unit).toLocaleString()}
                      </td>

                      <td className="max-w-[280px] px-3 py-3">
                        {item.url_1688 ? (
                          <a
                            href={item.url_1688}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate text-indigo-600 underline underline-offset-2"
                          >
                            {item.url_1688}
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      <td className="px-3 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleStartEditPurchaseSku(item)}
                            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100"
                          >
                            編集
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleDeletePurchaseSku(
                                String(item.purchase_sku ?? "").trim()
                              )
                            }
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-100"
                          >
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
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setShowBreakdown((v) => !v)}
          className="flex w-full items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-4 text-left"
        >
          <div>
            <h3 className="text-sm font-black text-gray-900">
              構成分解プレビュー
            </h3>
            <p className="mt-1 text-xs font-semibold text-gray-500">
              component_purchase_sku_1〜5 が設定されている商品のみ表示します。
            </p>
          </div>

          <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-bold text-gray-600">
            {showBreakdown ? "閉じる ▲" : "開く ▼"}
          </span>
        </button>

        {showBreakdown && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2">販売SKU</th>
                  <th className="px-3 py-2">販売JAN</th>
                  <th className="px-3 py-2">発注SKU</th>
                  <th className="px-3 py-2 text-right">必要部材数</th>
                  <th className="px-3 py-2 text-right">AP在庫</th>
                  <th className="px-3 py-2 text-right">不足数</th>
                  <th className="px-3 py-2 text-right">推奨発注数</th>
                </tr>
              </thead>

              <tbody>
                {purchaseBreakdownRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-10 text-center text-sm font-bold text-gray-400"
                    >
                      component_purchase_sku_1〜5 が未設定のため、まだ表示データがありません。
                    </td>
                  </tr>
                ) : (
                  purchaseBreakdownRows.map((rawRow, index) => {
                    const row = rawRow as unknown as Record<string, unknown>;

                    const parentSku =
                      getText(row.parent_sku) ||
                      getText(row.sales_sku) ||
                      getText(row.sku);

                    const parentJan =
                      getText(row.parent_jan) ||
                      getText(row.sales_jan) ||
                      getText(row.jan);

                    const purchaseSku =
                      getText(row.purchase_sku) ||
                      getText(row.component_purchase_sku) ||
                      getText(row.componentSku);

                    const requiredQty =
                      getNumber(row.required_qty) ||
                      getNumber(row.required_component_qty) ||
                      getNumber(row.component_required_qty);

                    const apStock =
                      getNumber(row.ap_stock) ||
                      getNumber(row.purchase_sku_ap_stock);

                    const shortageQty =
                      getNumber(row.shortage_qty) ||
                      getNumber(row.component_shortage_qty);

                    const recommendedOrderQty =
                      getNumber(row.recommended_order_qty) ||
                      getNumber(row.purchase_recommended_order_qty);

                    return (
                      <tr
                        key={`${purchaseSku || parentSku || "row"}-${index}`}
                        className="border-b border-gray-100 hover:bg-amber-50/30"
                      >
                        <td className="px-3 py-3 font-mono text-gray-700">
                          {parentSku || "-"}
                        </td>

                        <td className="px-3 py-3 font-mono text-gray-600">
                          {parentJan || "-"}
                        </td>

                        <td className="px-3 py-3 font-mono font-bold text-gray-900">
                          {purchaseSku || "-"}
                        </td>

                        <td className="px-3 py-3 text-right font-bold text-gray-900">
                          {requiredQty.toLocaleString()}
                        </td>

                        <td className="px-3 py-3 text-right font-bold text-sky-700">
                          {apStock.toLocaleString()}
                        </td>

                        <td className="px-3 py-3 text-right font-bold text-red-600">
                          {shortageQty.toLocaleString()}
                        </td>

                        <td className="px-3 py-3 text-right font-bold text-amber-700">
                          {recommendedOrderQty.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
