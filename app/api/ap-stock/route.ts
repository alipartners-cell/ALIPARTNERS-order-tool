import { NextResponse } from "next/server";

type ApStockItem = {
  jan: string;
  ap_stock: number;
  product_name?: string;
};

const toNumber = (value: unknown): number => {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
};

const normalizeJan = (value: unknown): string =>
  String(value ?? "").replace(/\D/g, "").trim();

function normalizeResponse(data: unknown): ApStockItem[] {
  const rawItems = Array.isArray(data)
    ? data
    : Array.isArray((data as { items?: unknown[] })?.items)
    ? (data as { items: unknown[] }).items
    : [];

  return rawItems
    .map((item) => {
      const record = item as Record<string, unknown>;
      return {
        jan: normalizeJan(record.jan ?? record.JAN),
        ap_stock: toNumber(record.ap_stock ?? record.stock ?? record["在庫数"] ?? record["在庫数(pcs)"]),
        product_name: String(record.product_name ?? record.name ?? record["商品名"] ?? ""),
      };
    })
    .filter((item) => item.jan);
}

export async function GET() {
  const url = process.env.AP_STOCK_API_URL;

  if (!url) {
    return NextResponse.json(
      {
        error:
          "AP_STOCK_API_URL が未設定です。.env.local に Apps Script のWebアプリURLを設定してください。",
      },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Apps ScriptからAP在庫を取得できませんでした: ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const items = normalizeResponse(data);

    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "AP在庫の取得中に不明なエラーが発生しました",
      },
      { status: 500 }
    );
  }
}
