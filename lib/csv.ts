import Papa from "papaparse";
import type { RawSkuRow, ComputedSkuRow, ProductMasterItem } from "@/types";

export const INSPECTION_ITEMS = [
  "詳細検品",
  "セット組",
  "OPP袋",
  "印刷物",
  "バーコード",
  "タグつけ外し",
] as const;

export type InspectionItem = (typeof INSPECTION_ITEMS)[number];
export type InspectionSelections = Record<string, InspectionItem[]>;
export type SalesChannel = "amazon" | "rakuten";
export type CsvDataKind = "inventory" | "sales" | "rakuten_combined" | "rakuten_inventory_aging";

const toNumber = (value: unknown): number => {
  if (value === null || value === undefined || value === "") return 0;
  const text = String(value)
    .replace(/,/g, "")
    .replace(/￥/g, "")
    .replace(/¥/g, "")
    .replace(/%/g, "")
    .trim();
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
};

const clean = (value: unknown): string => String(value ?? "").trim();

const cleanJan = (value: unknown): string => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  // Excel対策:
  // CSV出力時は ="4580540183761" 形式で出す。
  // 取込時はそのラップだけ外し、13桁の数字だけをJANとして採用する。
  //
  // 注意:
  // 4.58054E+12 のような指数表記は、すでにExcel側で丸められている可能性があるため復元しない。
  // 誤ったJANで紐づく方が危険なので、13桁にならない値は不正扱い（空欄）にする。
  const unwrapped = raw
    .replace(/^="/, "")
    .replace(/"$/, "")
    .replace(/^'/, "")
    .trim();

  const digits = unwrapped.replace(/[^0-9]/g, "");
  return digits.length === 13 ? digits : "";
};

const normalizeHeader = (value: string) => value.toLowerCase().replace(/[\s_\-（）()\[\]【】]/g, "");

function pick(r: Record<string, unknown>, aliases: string[]): unknown {
  const normalized = new Map(Object.keys(r).map((key) => [normalizeHeader(key), key]));
  for (const alias of aliases) {
    const key = normalized.get(normalizeHeader(alias));
    if (key !== undefined) return r[key];
  }
  return undefined;
}

const SKU_ALIASES = ["sku", "SKU", "商品SKU", "商品管理番号", "商品番号", "品番", "管理番号", "seller-sku", "出品者SKU"];
const JAN_ALIASES = ["jan", "JAN", "JANコード", "商品コード", "バーコード", "ASIN/EAN", "EAN", "メーカー品番", "倉庫内商品コード"];
const ASIN_ALIASES = ["asin", "ASIN", "（子）ASIN", "(子)ASIN", "子ASIN", "child asin", "child-asin"];
const NAME_ALIASES = ["product_name", "商品名", "品名", "商品タイトル", "タイトル", "name"];
const STOCK_ALIASES = [
  "fba_stock",
  "amazon_stock",
  "stock",
  "在庫",
  "現在庫",
  "在庫数",
  "販売可能数",
  "FBA在庫",
  "RSL在庫",
  "fulfillable",
  "afn-fulfillable-quantity",
  "Amazon出荷在庫(出荷可)",
  "Amazon出荷在庫 出荷可",
];
const INBOUND_ALIASES = [
  "fba_inbound",
  "fba_inbound_plan",
  "inbound",
  "納品見込み",
  "納品中",
  "入荷予定",
  "入庫予定",
  "納品予定",
  "FBA納品見込み",
  "RSL納品見込み",
  "afn-inbound-working-quantity",
  "afn-inbound-shipped-quantity",
  "afn-inbound-receiving-quantity",
  "Amazon納品数(準備中)",
  "Amazon納品数(発送済み)",
  "Amazon納品数(受領中)",
];
const SALES_ALIASES = [
  "monthly_sales",
  "月販",
  "30日販売数",
  "販売数",
  "売上数",
  "注文数",
  "unitsordered",
  "販売個数",
  "数量",
  "注文された商品点数",
  "注文品目総数",
];

export async function parseCsvFile(file: File): Promise<{ rows: RawSkuRow[]; errors: string[] }> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const errors: string[] = [];
        const rows: RawSkuRow[] = [];
        result.data.forEach((r, index) => {
          const sku = clean(pick(r, SKU_ALIASES) ?? r.sku);
          if (!sku) {
            errors.push(`${index + 2}行目: sku が空です`);
            return;
          }
          const monthly = toNumber(pick(r, SALES_ALIASES) ?? r.monthly_sales);
          const fba = toNumber(r.fba_stock ?? r.amazon_stock ?? pick(r, STOCK_ALIASES));
          const rsl = toNumber(r.rsl_stock ?? r.rakuten_stock);
          const inbound = toNumber(r.inbound ?? r.fba_inbound_plan ?? pick(r, INBOUND_ALIASES));
          rows.push({
            sku,
            jan: cleanJan(pick(r, JAN_ALIASES) ?? r.jan),
            product_name: clean(pick(r, NAME_ALIASES) ?? r.product_name),
            monthly_sales: monthly,
            fba_stock: fba,
            rsl_stock: rsl,
            ap_stock: toNumber(r.ap_stock),
            inbound,
            amazon_monthly_sales: toNumber(r.amazon_monthly_sales) || monthly,
            rakuten_monthly_sales: toNumber(r.rakuten_monthly_sales),
            amazon_stock: toNumber(r.amazon_stock) || fba,
            rakuten_stock: toNumber(r.rakuten_stock) || rsl,
            fba_inbound_plan: toNumber(r.fba_inbound_plan) || inbound,
            rsl_inbound_plan: toNumber(r.rsl_inbound_plan),
            fba_required_stock: toNumber(r.fba_required_stock),
            rsl_required_stock: toNumber(r.rsl_required_stock),
            moq: toNumber(r.moq),
            order_unit: toNumber(r.order_unit),
          });
        });
        resolve({ rows, errors });
      },
      error: (error) => resolve({ rows: [], errors: [error.message] }),
    });
  });
}


function parseCsvMatrixFile(
  file: File,
  encoding: string
): Promise<{ data: unknown[][]; errors: string[] }> {
  return new Promise((resolve) => {
    Papa.parse<unknown[]>(file, {
      header: false,
      skipEmptyLines: true,
      encoding,
      complete: (result) => {
        const errors = result.errors.map((e) => `${file.name}: ${e.message}`);
        resolve({ data: result.data, errors });
      },
      error: (error) => resolve({ data: [], errors: [`${file.name}: ${error.message}`] }),
    });
  });
}

function matrixRowsToObjects(matrix: unknown[][], fileName: string): { rows: Record<string, unknown>[]; errors: string[] } {
  const errors: string[] = [];
  const headerIndex = matrix.findIndex((row) => {
    const cells = row.map((v) => clean(v));
    return cells.includes("店舗内商品コード") && (cells.includes("１日あたり出荷数") || cells.includes("月間出荷数"));
  });

  if (headerIndex < 0) {
    return {
      rows: [],
      errors: [`${fileName}: 楽天SKU実績レポートのヘッダー行（店舗内商品コード / １日あたり出荷数）を判別できません`],
    };
  }

  const headers = matrix[headerIndex].map((v) => clean(v));
  const rows: Record<string, unknown>[] = [];

  matrix.slice(headerIndex + 1).forEach((row) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      if (header) obj[header] = row[idx];
    });
    const hasAnyValue = Object.values(obj).some((value) => clean(value) !== "");
    if (hasAnyValue) rows.push(obj);
  });

  return { rows, errors };
}

async function parseRakutenCombinedCsvFile(file: File): Promise<{ rows: Partial<RawSkuRow>[]; errors: string[] }> {
  const matrixResult = await parseCsvMatrixFile(file, "shift-jis");
  const objectResult = matrixRowsToObjects(matrixResult.data, file.name);
  const errors: string[] = [...matrixResult.errors, ...objectResult.errors];
  const rows: Partial<RawSkuRow>[] = [];

  objectResult.rows.forEach((r, index) => {
    // 楽天SKU実績レポートは、Amazon/RakutenのSKU差異を吸収するためJANを主キーにする。
    // JANは「メーカー品番」が最も安定。Excel等で指数表記になった場合は cleanJan で可能な範囲で復元する。
    const jan = cleanJan(r["メーカー品番"] ?? r["JANコード"] ?? r["倉庫内商品コード"] ?? pick(r, JAN_ALIASES));
    if (!jan) {
      errors.push(`${file.name} ${index + 1}行目: JANを判別できません`);
      return;
    }

    const dailyShipments = toNumber(r["１日あたり出荷数"]);
    const monthlyShipments = toNumber(r["月間出荷数"]);
    const rakutenMonthlySales = dailyShipments > 0 ? dailyShipments * 30 : monthlyShipments;
    const rslStock = toNumber(r["当月末在庫数"] ?? r["現在庫"] ?? r["在庫数"]);
    const rslInbound = toNumber(r["月間入荷数"]);

    rows.push({
      // SKUは表示補助。統合キーにはしない。page.tsx側でJAN一致の既存マスタSKUへ寄せる。
      sku: clean(r["店舗内商品コード"] ?? pick(r, SKU_ALIASES)) || jan,
      jan,
      product_name: clean(r["商品名１"] ?? pick(r, NAME_ALIASES)),
      monthly_sales: rakutenMonthlySales,
      rakuten_monthly_sales: rakutenMonthlySales,
      rakuten_stock: rslStock,
      rsl_stock: rslStock,
      rsl_inbound_plan: rslInbound,
    });
  });

  return { rows, errors };
}

function matrixRowsToInventoryAgingObjects(matrix: unknown[][], fileName: string): { rows: Record<string, unknown>[]; errors: string[] } {
  const errors: string[] = [];
  const headerIndex = matrix.findIndex((row) => {
    const cells = row.map((v) => clean(v));
    return (
      cells.includes("店舗内商品コード") &&
      cells.includes("インストアコード(物流)") &&
      cells.includes("販売可能在庫数")
    );
  });

  if (headerIndex < 0) {
    return {
      rows: [],
      errors: [`${fileName}: 在庫エイジングレポートのヘッダー行（店舗内商品コード / インストアコード(物流) / 販売可能在庫数）を判別できません`],
    };
  }

  const headers = matrix[headerIndex].map((v) => clean(v));
  const rows: Record<string, unknown>[] = [];

  matrix.slice(headerIndex + 1).forEach((row) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      if (header) obj[header] = row[idx];
    });
    const hasAnyValue = Object.values(obj).some((value) => clean(value) !== "");
    if (hasAnyValue) rows.push(obj);
  });

  return { rows, errors };
}

async function parseRakutenInventoryAgingCsvFile(file: File): Promise<{ rows: Partial<RawSkuRow>[]; errors: string[] }> {
  const matrixResult = await parseCsvMatrixFile(file, "shift-jis");
  const objectResult = matrixRowsToInventoryAgingObjects(matrixResult.data, file.name);
  const errors: string[] = [...matrixResult.errors, ...objectResult.errors];
  const rows: Partial<RawSkuRow>[] = [];

  objectResult.rows.forEach((r, index) => {
    // 在庫エイジングレポートでは「インストアコード(物流)」をJANとして使う。
    // JAN一致でpage.tsx側の商品マスタSKUへ寄せるため、SKU差異があっても統合できる。
    const jan = cleanJan(r["インストアコード(物流)"] ?? r["JANコード"] ?? r["メーカー品番"] ?? pick(r, JAN_ALIASES));
    if (!jan) {
      errors.push(`${file.name} ${index + 1}行目: インストアコード(物流)からJANを判別できません`);
      return;
    }

    const rslStock = toNumber(r["販売可能在庫数"] ?? r["在庫数"] ?? r["現在庫"] ?? r["RSL在庫"]);

    rows.push({
      // SKUは表示補助。統合キーにはしない。page.tsx側でJAN一致の既存マスタSKUへ寄せる。
      sku: clean(r["店舗内商品コード"] ?? pick(r, SKU_ALIASES)) || jan,
      jan,
      product_name: clean(r["商品名"] ?? pick(r, NAME_ALIASES)),
      rakuten_stock: rslStock,
      rsl_stock: rslStock,
    });
  });

  return { rows, errors };
}

export async function parseChannelCsvFile(
  file: File,
  channel: SalesChannel,
  kind: CsvDataKind
): Promise<{ rows: Partial<RawSkuRow>[]; errors: string[] }> {
  // 楽天RSL在庫は、在庫エイジングレポートを inventory として処理する。
  // 楽天売上CSV（月次SKU実績レポート）は rakuten_combined / sales として処理する。
  if (channel === "rakuten" && (kind === "inventory" || kind === "rakuten_inventory_aging")) {
    return parseRakutenInventoryAgingCsvFile(file);
  }

  if (channel === "rakuten" || kind === "rakuten_combined") {
    return parseRakutenCombinedCsvFile(file);
  }

  return new Promise((resolve) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "shift-jis",
      complete: (result) => {
        const errors: string[] = [];
        const rows: Partial<RawSkuRow>[] = [];
        result.data.forEach((r, index) => {
          const sku = clean(pick(r, SKU_ALIASES));
          if (!sku) {
            errors.push(`${file.name} ${index + 2}行目: SKUを判別できません`);
            return;
          }
          const base: Partial<RawSkuRow> = {
            sku,
            jan: cleanJan(pick(r, JAN_ALIASES)),
            product_name: clean(pick(r, NAME_ALIASES)),
          };
          if (kind === "inventory") {
            const stock = toNumber(pick(r, STOCK_ALIASES));

            // Amazon在庫レポートでは、納品中の列が
            // fba_inbound / fba_inbound.1 / fba_inbound.2
            // または Amazon納品数(準備中)/(発送済み)/(受領中)
            // のように分かれるため、合算する。
            const inbound =
              toNumber((r as any).fba_inbound) +
              toNumber((r as any)["fba_inbound.1"]) +
              toNumber((r as any)["fba_inbound.2"]) ||
              (
                toNumber((r as any)["Amazon納品数(準備中)"]) +
                toNumber((r as any)["Amazon納品数(発送済み)"]) +
                toNumber((r as any)["Amazon納品数(受領中)"])
              ) ||
              toNumber(pick(r, INBOUND_ALIASES));

            base.amazon_stock = stock;
            base.fba_stock = stock;
            base.fba_inbound_plan = inbound;
            base.inbound = inbound;
          } else {
            const monthly = toNumber(pick(r, SALES_ALIASES));
            base.amazon_monthly_sales = monthly;
          }
          rows.push(base);
        });
        resolve({ rows, errors });
      },
      error: (error) => resolve({ rows: [], errors: [`${file.name}: ${error.message}`] }),
    });
  });
}

function parsePapaFile(
  file: File,
  encoding: string
): Promise<{ data: Record<string, unknown>[]; errors: string[] }> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      encoding,
      complete: (result) => {
        const errors = result.errors.map((e) => `${file.name}: ${e.message}`);
        resolve({ data: result.data, errors });
      },
      error: (error) => resolve({ data: [], errors: [`${file.name}: ${error.message}`] }),
    });
  });
}

export type AmazonTwoCsvImportOptions = {
  /**
   * ビジネスレポートの対象日数。
   * 例：30日レポートなら30、7日レポートなら7。
   * このツールの計算は monthly_sales / 30 なので、ここで30日換算する。
   */
  businessReportDays?: number;

  /**
   * 在庫レポートの文字コード。
   * Amazonの在庫レポートはShift_JIS/CP932系が多い。
   */
  inventoryEncoding?: string;

  /**
   * ビジネスレポートの文字コード。
   * AmazonビジネスレポートはUTF-8系が多い。
   */
  businessReportEncoding?: string;
};

export type AmazonTwoCsvImportResult = {
  rows: RawSkuRow[];
  errors: string[];
  warnings: string[];
};

/**
 * Amazonの2CSVを一発で処理する。
 *
 * ① JAN,SKU,ASIN,FBA在庫対応表.csv
 *    - SKUあり
 *    - ASINあり
 *    - FBA在庫あり
 *    - FBA納品予定あり
 *
 * ② BusinessReport.csv
 *    - SKUなし
 *    - （子）ASINあり
 *    - 注文された商品点数あり
 *
 * 処理：
 * - 売上CSVを（子）ASINで集計
 * - 在庫CSVのASINに売上を結合
 * - RawSkuRow[]として返す
 *
 * 単位：
 * - Amazon売上 / FBA在庫 / FBA納品予定 は「セット」扱い
 * - AP在庫はこのCSVには無いので 0
 */
export async function parseAmazonInventoryAndBusinessReportFiles(
  inventoryFile: File,
  businessReportFile: File,
  options: AmazonTwoCsvImportOptions = {}
): Promise<AmazonTwoCsvImportResult> {
  const businessReportDays = Math.max(1, Number(options.businessReportDays ?? 30) || 30);
  const inventoryEncoding = options.inventoryEncoding ?? "shift-jis";
  const businessReportEncoding = options.businessReportEncoding ?? "utf-8";

  const [inventoryResult, businessResult] = await Promise.all([
    parsePapaFile(inventoryFile, inventoryEncoding),
    parsePapaFile(businessReportFile, businessReportEncoding),
  ]);

  const errors: string[] = [...inventoryResult.errors, ...businessResult.errors];
  const warnings: string[] = [];

  const salesByAsin = new Map<string, {
    monthlySales: number;
    title: string;
  }>();

  businessResult.data.forEach((r, index) => {
    const asin = clean(pick(r, ASIN_ALIASES));
    if (!asin) {
      warnings.push(`${businessReportFile.name} ${index + 2}行目: （子）ASINを判別できないため売上を無視しました`);
      return;
    }

    const orderedUnits =
      toNumber(r["注文された商品点数"]) ||
      toNumber(r["注文品目総数"]) ||
      toNumber(pick(r, SALES_ALIASES));

    const monthlySales = orderedUnits * (30 / businessReportDays);
    const title = clean(pick(r, NAME_ALIASES));

    const current = salesByAsin.get(asin);
    if (current) {
      salesByAsin.set(asin, {
        monthlySales: current.monthlySales + monthlySales,
        title: current.title || title,
      });
    } else {
      salesByAsin.set(asin, { monthlySales, title });
    }
  });

  const seenSku = new Set<string>();
  const rows: RawSkuRow[] = [];

  inventoryResult.data.forEach((r, index) => {
    const sku = clean(pick(r, SKU_ALIASES));
    if (!sku) {
      errors.push(`${inventoryFile.name} ${index + 2}行目: 出品者SKUを判別できません`);
      return;
    }

    if (seenSku.has(sku)) {
      warnings.push(`${inventoryFile.name} ${index + 2}行目: SKU「${sku}」が重複しています。後続行も取り込みます`);
    }
    seenSku.add(sku);

    const asin = clean(pick(r, ASIN_ALIASES));
    const sales = asin ? salesByAsin.get(asin) : undefined;

    if (asin && !sales) {
      warnings.push(`SKU「${sku}」/ ASIN「${asin}」: ビジネスレポート側に売上行が見つかりません。売上0として取り込みます`);
    }

    const amazonStock =
      toNumber(r["Amazon出荷在庫(出荷可)"]) ||
      toNumber(r["afn-fulfillable-quantity"]) ||
      toNumber(pick(r, STOCK_ALIASES));

    const fbaInboundPlan =
      toNumber(r["Amazon納品数(準備中)"]) +
      toNumber(r["Amazon納品数(発送済み)"]) +
      toNumber(r["Amazon納品数(受領中)"]);

    const amazonMonthlySales = sales?.monthlySales ?? 0;
    const productName = clean(pick(r, NAME_ALIASES)) || sales?.title || "";

    rows.push({
      sku,
      jan: cleanJan(pick(r, JAN_ALIASES)),
      product_name: productName,
      monthly_sales: amazonMonthlySales,
      fba_stock: amazonStock,
      rsl_stock: 0,
      ap_stock: 0,
      inbound: fbaInboundPlan,
      amazon_monthly_sales: amazonMonthlySales,
      rakuten_monthly_sales: 0,
      amazon_stock: amazonStock,
      rakuten_stock: 0,
      fba_inbound_plan: fbaInboundPlan,
      rsl_inbound_plan: 0,
      fba_required_stock: 0,
      rsl_required_stock: 0,
      moq: 0,
      order_unit: 0,
    });
  });

  return { rows, errors, warnings };
}

export function buildOrderCsvContent(
  rows: ComputedSkuRow[],
  inspectionSelections: InspectionSelections = {},
  productMasters: Record<string, ProductMasterItem> = {}
): string {
  const formatJanForExcel = (value: string) => {
    const jan = String(value ?? "").trim();
    return jan ? `="${jan.replace(/"/g, '""')}"` : "";
  };

  const orderRows = rows.map((row) => {
    const master = productMasters[row.sku];
    const selectedItems = inspectionSelections[row.sku] ?? [];
    return {
      sku: row.sku,
      jan: formatJanForExcel(master?.jan || row.jan),
      product_name: master?.product_name || row.product_name,
      product_url: master?.product_url || "",
      color: master?.color || "",
      size: master?.size || "",
      cost_rmb: master?.cost_rmb || 0,
      memo: master?.memo || "",
      fba_recommended_delivery_qty: row.fba_recommended_delivery_qty,
      rsl_recommended_delivery_qty: row.rsl_recommended_delivery_qty,
      recommended_order_qty: row.recommended_order_qty,
      status: row.recommended_order_qty > 0
        ? "発注推奨"
        : row.fba_recommended_delivery_qty > 0 || row.rsl_recommended_delivery_qty > 0
          ? "納品推奨"
          : "対応不要",
      inspection_items: selectedItems.join(" / "),
      detailed_inspection: selectedItems.includes("詳細検品") ? "〇" : "",
      set_assembly: selectedItems.includes("セット組") ? "〇" : "",
      opp_bag: selectedItems.includes("OPP袋") ? "〇" : "",
      printed_material: selectedItems.includes("印刷物") ? "〇" : "",
      barcode: selectedItems.includes("バーコード") ? "〇" : "",
      tag_attach_remove: selectedItems.includes("タグつけ外し") ? "〇" : "",
    };
  });
  return Papa.unparse(orderRows, { newline: "\r\n" });
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob(["\ufeff" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
