import type { RawSkuRow } from "@/types";

const ROW_OVERRIDES_STORAGE_KEY = "alipartners_row_overrides";

export type RowOverrides = Record<string, Partial<RawSkuRow>>;

export function loadRowOverridesFromStorage(): RowOverrides {
  if (typeof window === "undefined") return {};

  try {
    const saved = window.localStorage.getItem(ROW_OVERRIDES_STORAGE_KEY);
    if (!saved) return {};

    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return parsed as RowOverrides;
  } catch {
    return {};
  }
}

export function saveRowOverridesToStorage(rowOverrides: RowOverrides) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      ROW_OVERRIDES_STORAGE_KEY,
      JSON.stringify(rowOverrides)
    );
  } catch {
    // row override保存失敗時もツール本体は止めない。
  }
}
