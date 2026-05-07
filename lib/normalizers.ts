export function normalizeSkuKey(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizeJanKey(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").trim();
}