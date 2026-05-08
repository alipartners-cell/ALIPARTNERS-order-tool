"use client";

import type { PurchaseSkuItem } from "@/types";
import type {
  PurchaseBreakdownRow,
  PurchaseSkuSummaryRow,
} from "@/lib/purchaseEngine";

type Props = {
  purchaseSkus: PurchaseSkuItem[];
  purchaseBreakdownRows: PurchaseBreakdownRow[];
  purchaseSkuSummaryRows: PurchaseSkuSummaryRow[];
};

function getText(value: unknown) {
  return String(value ?? "").trim();
}

function getNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export default function PurchaseManager({
  purchaseSkus,
  purchaseBreakdownRows,
  purchaseSkuSummaryRows,
}: Props) {
  return (
    <div className="space-y-6 p-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-black text-gray-900">発注管理</h2>

        <div className="mt-4 flex flex-wrap gap-6 text-sm font-bold text-gray-700">
          <p>発注SKU数：{purchaseSkus.length.toLocaleString()}件</p>
          <p>構成分解行数：{purchaseBreakdownRows.length.toLocaleString()}件</p>
          <p>SKU別集計：{purchaseSkuSummaryRows.length.toLocaleString()}件</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
          <h3 className="text-sm font-black text-gray-900">発注SKU一覧</h3>
        </div>

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
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
          <h3 className="text-sm font-black text-gray-900">
            構成分解プレビュー
          </h3>
          <p className="mt-1 text-xs font-semibold text-gray-500">
            component_purchase_sku_1〜5 が設定されている商品のみ表示します。
          </p>
        </div>

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
      </div>
    </div>
  );
}
