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
  const [purchaseFormOpen, setPurchaseFormOpen] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseSkuItem>(
    EMPTY_PURCHASE_SKU_FORM
  );

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
              parent_sku: String(item?.parent_sku ?? "").trim() || undefined,
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
    purchaseFormOpen,
    setPurchaseFormOpen,
    purchaseForm,
    setPurchaseForm,
    handleAddPurchaseSku,
  };
}
