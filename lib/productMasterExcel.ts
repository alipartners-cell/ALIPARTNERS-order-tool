import * as XLSX from "xlsx";
import type { ProductMasterItem } from "@/types";

export type ProductMasterItemWithSet = ProductMasterItem & {
  unit_per_set?: number;
  item_type?: "single" | "set" | "bundle";
  component_jan_1?: string;
  component_qty_1?: number;
  component_jan_2?: string;
  component_qty_2?: number;
  component_jan_3?: string;
  component_qty_3?: number;
  component_jan_4?: string;
  component_qty_4?: number;
  component_jan_5?: string;
  component_qty_5?: number;
  component_purchase_sku_1?: string;
  component_purchase_sku_2?: string;
  component_purchase_sku_3?: string;
  component_purchase_sku_4?: string;
  component_purchase_sku_5?: string;
};

const MASTER_TEMPLATE_COLUMNS = [
  "sku",
  "jan",
  "asin",
  "image_url",
  "product_name",
  "product_url",
  "color",
  "size",
  "cost_rmb",
  "moq",
  "unit_per_set",
  "item_type",
  "component_jan_1",
  "component_qty_1",
  "component_jan_2",
  "component_qty_2",
  "component_jan_3",
  "component_qty_3",
  "component_jan_4",
  "component_qty_4",
  "component_jan_5",
  "component_qty_5",
  "order_unit",
  "product_type",
  "factory_lt_days",
  "inspection_type",
  "ap_inspection_lt_days",
  "shipping_method",
  "international_shipping_lt_days",
  "fba_rsl_receiving_lt_days",
  "safety_stock_days",
  "default_inspection_items",
  "memo",
  "factory_name",
] as const;

const MASTER_TEMPLATE_SAMPLE = [
  {
    sku: "A001",
    jan: "4573686551907",
    asin: "B0SAMPLEA001",
    image_url: "https://m.media-amazon.com/images/I/xxxxxxxx.jpg",
    product_name: "ネックピロー",
    product_url: "https://detail.1688.com/offer/xxxxx.html",
    color: "黒",
    size: "フリー",
    cost_rmb: 12.5,
    moq: 100,
    unit_per_set: 3,
    item_type: "単品",
    component_jan_1: "",
    component_qty_1: "",
    component_jan_2: "",
    component_qty_2: "",
    component_jan_3: "",
    component_qty_3: "",
    component_jan_4: "",
    component_qty_4: "",
    component_jan_5: "",
    component_qty_5: "",
    order_unit: 50,
    product_type: "ready",
    factory_lt_days: 5,
    inspection_type: "simple",
    ap_inspection_lt_days: 3,
    shipping_method: "air",
    international_shipping_lt_days: 5,
    fba_rsl_receiving_lt_days: 3,
    safety_stock_days: 15,
    default_inspection_items: "詳細検品 / OPP袋 / バーコード",
    memo: "縫製・汚れ注意",
    factory_name: "青島サンプル工場",
  },
];

const XLSX_TEXT_COLUMNS = [
  "sku",
  "jan",
  "asin",
  "component_jan_1",
  "component_jan_2",
  "component_jan_3",
  "component_jan_4",
  "component_jan_5",
] as const;

function masterItemToXlsxRow(item: ProductMasterItemWithSet) {
  return {
    sku: String(item.sku ?? ""),
    jan: String(item.jan ?? ""),
    asin: String(item.asin ?? ""),
    image_url: item.image_url || "",
    product_name: item.product_name,
    product_url: item.product_url,
    color: item.color,
    size: item.size,
    cost_rmb: item.cost_rmb,
    moq: item.moq,
    unit_per_set: Math.max(1, Number(item.unit_per_set || 1)),
    item_type: item.item_type === "set" ? "セット" : item.item_type === "bundle" ? "付属品" : "単品",
    component_jan_1: item.component_jan_1 || "",
    component_qty_1: item.item_type !== "single" && item.component_jan_1 ? Number(item.component_qty_1 || 1) : "",
    component_jan_2: item.component_jan_2 || "",
    component_qty_2: item.item_type !== "single" && item.component_jan_2 ? Number(item.component_qty_2 || 1) : "",
    component_jan_3: item.component_jan_3 || "",
    component_qty_3: item.item_type !== "single" && item.component_jan_3 ? Number(item.component_qty_3 || 1) : "",
    component_jan_4: item.component_jan_4 || "",
    component_qty_4: item.item_type !== "single" && item.component_jan_4 ? Number(item.component_qty_4 || 1) : "",
    component_jan_5: item.component_jan_5 || "",
    component_qty_5: item.item_type !== "single" && item.component_jan_5 ? Number(item.component_qty_5 || 1) : "",
    order_unit: Number(item.order_unit || 0),
    product_type: item.product_type || "ready",
    factory_lt_days: Number(item.factory_lt_days || 5),
    inspection_type: item.inspection_type || "simple",
    ap_inspection_lt_days: Number(item.ap_inspection_lt_days || 3),
    shipping_method: item.shipping_method || "air",
    international_shipping_lt_days: Number(item.international_shipping_lt_days || 5),
    fba_rsl_receiving_lt_days: Number(item.fba_rsl_receiving_lt_days || 3),
    safety_stock_days: Number(item.safety_stock_days || 15),
    default_inspection_items: (item.default_inspection_items || []).join(" / "),
    memo: item.memo,
    factory_name: item.factory_name,
  };
}

function applyXlsxTextFormat(worksheet: XLSX.WorkSheet, rowCount: number) {
  const columns = [...MASTER_TEMPLATE_COLUMNS];
  XLSX_TEXT_COLUMNS.forEach((columnName) => {
    const colIndex = columns.indexOf(columnName);
    if (colIndex < 0) return;

    for (let rowIndex = 1; rowIndex <= rowCount; rowIndex += 1) {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
      const cell = worksheet[address];
      if (!cell) continue;
      cell.t = "s";
      cell.z = "@";
      cell.v = String(cell.v ?? "");
    }
  });
}

function buildMasterWorkbook(rows: Record<string, unknown>[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: [...MASTER_TEMPLATE_COLUMNS],
  });

  worksheet["!cols"] = [
    { wch: 22 }, // sku
    { wch: 18 }, // jan
    { wch: 14 }, // asin
    { wch: 38 }, // image_url
    { wch: 28 }, // product_name
    { wch: 42 }, // product_url
    { wch: 12 }, // color
    { wch: 12 }, // size
    { wch: 12 }, // cost_rmb
    { wch: 10 }, // moq
    { wch: 12 }, // unit_per_set
    { wch: 14 }, // item_type
    { wch: 18 }, // component_jan_1
    { wch: 10 }, // component_qty_1
    { wch: 18 },
    { wch: 10 },
    { wch: 18 },
    { wch: 10 },
    { wch: 18 },
    { wch: 10 },
    { wch: 18 },
    { wch: 10 },
    { wch: 12 }, // order_unit
    { wch: 14 }, // product_type
    { wch: 14 }, // factory_lt_days
    { wch: 14 }, // inspection_type
    { wch: 18 }, // ap_inspection_lt_days
    { wch: 14 }, // shipping_method
    { wch: 22 }, // international_shipping_lt_days
    { wch: 22 }, // fba_rsl_receiving_lt_days
    { wch: 16 }, // safety_stock_days
    { wch: 30 }, // default_inspection_items
    { wch: 30 }, // memo
    { wch: 22 }, // factory_name
  ];

  applyXlsxTextFormat(worksheet, rows.length);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "商品マスタ");
  return workbook;
}



function downloadWorkbook(workbook: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(workbook, filename);
}

function readXlsxRows(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, {
          type: "array",
          cellDates: false,
        });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        if (!worksheet) {
          resolve([]);
          return;
        }

        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          defval: "",
          raw: true,
        });

        resolve(rows);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}



export {
  MASTER_TEMPLATE_COLUMNS,
  MASTER_TEMPLATE_SAMPLE,
  masterItemToXlsxRow,
  buildMasterWorkbook,
  downloadWorkbook,
  readXlsxRows,
};
