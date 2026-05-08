"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComputedSkuRow, ProductMasterItem, PurchaseSkuItem } from "@/types";
import {
  buildPurchaseBreakdownRows,
  buildPurchaseSkuSummaryRows,
} from "@/lib/purchaseEngine";

const PURCHASE_SKUS_STORAGE_KEY = "alipartners_purchase_skus";

const DEFAULT_PURCHASE_SKUS: PurchaseSkuItem[] = [
  {
    purchase_sku: "PINK-L",
    parent_jan: "4589999999999",
    color: "粉色",
    size: "L",
    ap_stock: 120,
    moq: 0,
    order_unit: 0,
    recommended_order_qty: 300,
    url_1688: "https://detail.1688.com/offer/sample.html",
    enabled: true,
  } as PurchaseSkuItem,
];

type UsePurchaseManagerArgs = {
  rows: ComputedSkuRow[];
  productMasterBySku: Record<string, ProductMasterItem>;
};

export function usePurchaseManager({
  rows,
  productMasterBySku,
}: UsePurchaseManagerArgs) {
  const [purchaseSkus, setPurchaseSkus] = useState<PurchaseSkuItem[]>(
    DEFAULT_PURCHASE_SKUS
  );
  const [purchaseSkusLoaded, setPurchaseSkusLoaded] = useState(false);
  const [manualPurchaseOrders, setManualPurchaseOrders] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PURCHASE_SKUS_STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          const normalized = parsed
            .map((item): PurchaseSkuItem => ({
              purchase_sku: String(item?.purchase_sku ?? "").trim(),
              parent_jan: String(item?.parent_jan ?? "")
                .replace(/\D/g, "")
                .trim(),
              parent_sku:
                String(item?.parent_sku ?? "").trim() || undefined,
              color: String(item?.color ?? ""),
              size: String(item?.size ?? ""),
              ap_stock: Number(item?.ap_stock ?? 0) || 0,
              moq: Number(item?.moq ?? 0) || 0,
              order_unit: Number(item?.order_unit ?? 0) || 0,
              theoretical_stock: Number(item?.theoretical_stock ?? 0) || 0,
              recommended_order_qty:
                Number(item?.recommended_order_qty ?? 0) || 0,
              url_1688: String(item?.url_1688 ?? ""),
              enabled: item?.enabled !== false,
            } as PurchaseSkuItem))
            .filter((item) => item.purchase_sku);

          setPurchaseSkus(
            normalized.length > 0 ? normalized : DEFAULT_PURCHASE_SKUS
          );
        }
      }
    } catch {
      // localStorage load failed; keep default purchase SKUs.
    } finally {
      setPurchaseSkusLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!purchaseSkusLoaded) return;

    window.localStorage.setItem(
      PURCHASE_SKUS_STORAGE_KEY,
      JSON.stringify(purchaseSkus)
    );
  }, [purchaseSkus, purchaseSkusLoaded]);

  const purchaseBreakdownRows = useMemo(
    () =>
      buildPurchaseBreakdownRows(
        rows,
        productMasterBySku,
        purchaseSkus
      ),
    [rows, productMasterBySku, purchaseSkus]
  );

  const purchaseSkuSummaryRows = useMemo(
    () => buildPurchaseSkuSummaryRows(purchaseBreakdownRows, purchaseSkus),
    [purchaseBreakdownRows, purchaseSkus]
  );

  return {
    purchaseSkus,
    setPurchaseSkus,
    purchaseBreakdownRows,
    purchaseSkuSummaryRows,
    manualPurchaseOrders,
    setManualPurchaseOrders,
  };
}
