import type { ProductMasterItem } from "@/types";

const PRODUCT_MASTERS_STORAGE_KEY = "alipartners_product_masters";

type SaveProductMastersResult = "saved" | "saved_without_images" | "failed";

function makeLocalStorageSafeProductMasters(
  items: ProductMasterItem[]
): ProductMasterItem[] {
  return items.map((item) => {
    const imageUrl = String(item.image_url ?? "");

    const safeImageUrl =
      imageUrl.startsWith("data:") || imageUrl.length > 2000 ? "" : imageUrl;

    return {
      ...item,
      image_url: safeImageUrl,
    };
  });
}

export function loadProductMastersFromStorage(
  normalizeProductMaster: (input: unknown) => ProductMasterItem
): ProductMasterItem[] {
  if (typeof window === "undefined") return [];

  try {
    const saved = window.localStorage.getItem(PRODUCT_MASTERS_STORAGE_KEY);
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => normalizeProductMaster(item))
      .filter((item) => item.sku);
  } catch {
    return [];
  }
}

export function saveProductMastersToStorage(
  items: ProductMasterItem[]
): SaveProductMastersResult {
  if (typeof window === "undefined") return "failed";

  try {
    window.localStorage.setItem(
      PRODUCT_MASTERS_STORAGE_KEY,
      JSON.stringify(items)
    );
    return "saved";
  } catch {
    try {
      const safeMasters = makeLocalStorageSafeProductMasters(items);

      window.localStorage.setItem(
        PRODUCT_MASTERS_STORAGE_KEY,
        JSON.stringify(safeMasters)
      );

      return "saved_without_images";
    } catch {
      return "failed";
    }
  }
}
