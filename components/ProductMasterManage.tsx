"use client";

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

export default function ProductMasterManage({
  masters,
  onChange,
  onBack,
  focusSku,
  purchaseSkus,
}: Props) {
  return (
    <ProductMaster
      masters={masters}
      onChange={onChange}
      onBack={onBack}
      focusSku={focusSku}
      purchaseSkus={purchaseSkus}
    />
  );
}
