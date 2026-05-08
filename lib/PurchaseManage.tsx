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

  const handleAddPurchaseSku = () => {
    const purchaseSku = String(purchaseForm.purchase_sku ?? "").trim();

    if (!purchaseSku) {
      alert("発注SKUを入力してください");
      return;
    }

    const duplicated = purchaseSkus.some(
      (item) =>
        item.purchase_sku.trim().toLowerCase() === purchaseSku.toLowerCase()
    );

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

    setPurchaseSkus((prev) =>
      [...prev, nextItem].sort((a, b) =>
        a.purchase_sku.localeCompare(b.purchase_sku)
      )
    );

    setPurchaseForm(EMPTY_PURCHASE_SKU_FORM);
    setPurchaseFormOpen(false);
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

          <button
            type="button"
            onClick={() => setPurchaseFormOpen((v) => !v)}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-500"
          >
            {purchaseFormOpen ? "発注SKU追加を閉じる ▲" : "発注SKUを追加 ▼"}
          </button>
        </div>
      </div>

      {purchaseFormOpen && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-black text-gray-900">発注SKU追加</h3>
            <p className="mt-1 text-xs font-semibold text-gray-500">
              発注SKUマスタへ1件追加します。
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
              onClick={() => setPurchaseFormOpen(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
            >
              キャンセル
            </button>

            <button
              type="button"
              onClick={handleAddPurchaseSku}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-500"
            >
              追加する
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
          <h3 className="text-sm font-black text-gray-900">
            発注SKU別必要数集計
          </h3>
          <p className="mt-1 text-xs font-semibold text-gray-500">
            構成分解後の発注SKU単位の必要数・不足数・推奨発注数を集計します。
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr className="border-b border-gray-200">
                <th className="px-3 py-2">発注SKU</th>
                <th className="px-3 py-2 text-right">必要数</th>
                <th className="px-3 py-2 text-right">AP在庫</th>
                <th className="px-3 py-2 text-right">不足数</th>
                <th className="px-3 py-2 text-right">MOQ</th>
                <th className="px-3 py-2 text-right">発注単位</th>
                <th className="px-3 py-2 text-right">推奨発注数</th>
                <th className="px-3 py-2 text-right">手動発注数</th>
              </tr>
            </thead>

            <tbody>
              {purchaseSkuSummaryRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-10 text-center text-sm font-bold text-gray-400"
                  >
                    発注SKU別集計データはまだありません。
                  </td>
                </tr>
              ) : (
                purchaseSkuSummaryRows.map((rawRow, index) => {
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

                  return (
                    <tr
                      key={`${purchaseSku || "summary"}-${index}`}
                      className="border-b border-gray-100 hover:bg-emerald-50/30"
                    >
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

                      <td className="px-3 py-3 text-right font-bold text-gray-700">
                        {moq.toLocaleString()}
                      </td>

                      <td className="px-3 py-3 text-right font-bold text-gray-700">
                        {orderUnit.toLocaleString()}
                      </td>

                      <td className="px-3 py-3 text-right font-black text-amber-700">
                        {recommendedOrderQty.toLocaleString()}
                      </td>

                      <td className="px-3 py-3 text-right">
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
                          className="w-24 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-right text-xs font-bold text-gray-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                          placeholder="任意"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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
                </tr>
              </thead>

              <tbody>
                {purchaseSkus.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
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
