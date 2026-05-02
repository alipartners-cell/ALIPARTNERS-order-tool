export type ProductType = "ready" | "oem";
export type InspectionType = "simple" | "detailed";
export type ShippingMethod = "air" | "sea";

export interface SkuLtSettings {
  moq?: number;
  order_unit?: number;
  product_type?: ProductType;
  factory_lt_days?: number;
  inspection_type?: InspectionType;
  ap_inspection_lt_days?: number;
  shipping_method?: ShippingMethod;
  international_shipping_lt_days?: number;
  fba_rsl_receiving_lt_days?: number;
  safety_stock_days?: number;
}

export interface RawSkuRow extends SkuLtSettings {
  sku: string;
  jan: string;
  product_name: string;
  monthly_sales: number;
  fba_stock: number;
  rsl_stock: number;
  ap_stock: number;
  inbound: number;
  amazon_monthly_sales: number;
  rakuten_monthly_sales: number;
  amazon_stock: number;
  rakuten_stock: number;
  fba_inbound_plan: number;
  rsl_inbound_plan: number;
  fba_required_stock: number;
  rsl_required_stock: number;
}

export interface ComputedSkuRow extends RawSkuRow {
  daily_sales: number;
  amazon_daily_sales: number;
  rakuten_daily_sales: number;
  fba_recommended_delivery_qty: number;
  rsl_recommended_delivery_qty: number;
  available_stock: number;
  total_lead_time_days: number;
  effective_safety_stock_days: number;
  required_stock: number;
  shortage_qty: number;
  recommended_order_qty: number;
  status: "発注推奨" | "納品推奨" | "対応不要" | "発注不要";
}

export interface OrderParams {
  product_type: ProductType;
  factory_lt_days: number;
  inspection_type: InspectionType;
  ap_inspection_lt_days: number;
  shipping_method: ShippingMethod;
  international_shipping_lt_days: number;
  fba_rsl_receiving_lt_days: number;
  safety_stock_days: number;
}

export type SortKey = keyof ComputedSkuRow;

export interface SortState {
  key: SortKey;
  direction: "asc" | "desc";
}

export type ProductMasterStatus = "complete" | "draft";

export interface ProductMasterItem extends SkuLtSettings {
  sku: string;
  jan: string;
  asin: string;
  product_name: string;
  image_url: string;
  product_url: string;
  color: string;
  size: string;
  cost_rmb: number;
  moq: number;
  default_inspection_items: string[];
  memo: string;
  factory_name: string;
  master_status?: ProductMasterStatus;
}
