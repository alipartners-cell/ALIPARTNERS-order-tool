"use client";

import { useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ProductMasterItem, PurchaseSkuItem } from "@/types";
import ProductMaster from "@/components/ProductMaster";

type Props = {
  masters: ProductMasterItem[];
  onChange: Dispatch<SetStateAction<ProductMasterItem[]>>;
  onBack: () => void;
  focusSku: string;
  purchaseSkus: PurchaseSkuItem[];
};

function normalizeMasterList(items: ProductMasterItem[]) {
  return [...items].sort((a, b) =>
    String(a.sku ?? "").localeCompare(String(b.sku ?? ""))
  );
}

export default function ProductMasterManage({
  masters,
  onChange,
  onBack,
  focusSku,
  purchaseSkus,
}: Props) {
  const normalizedMasters = useMemo(() => normalizeMasterList(masters), [masters]);

  const handleChange = (next: ProductMasterItem[]) => {
    onChange(normalizeMasterList(next));
  };

  return (
    <ProductMaster
      masters={normalizedMasters}
      onChange={handleChange}
      onBack={onBack}
      focusSku={focusSku}
      purchaseSkus={purchaseSkus}
    />
  );
}
