import { NextResponse } from "next/server";

const MUFG_URL = "https://www.bk.mufg.jp/ippan/kinri/list_j/kinri/kawase.html";
const MIN_CNY_TTS = 15;
const MAX_CNY_TTS = 35;

type ParsedRate = {
  tts: number;
  matchedText: string;
};

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeText(value: string) {
  return decodeHtml(value)
    .replace(/\u00a0/g, " ")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value: string) {
  return normalizeText(value.replace(/<[^>]*>/g, " "));
}

function isValidCnyTts(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= MIN_CNY_TTS && value <= MAX_CNY_TTS;
}

function parseNumberCell(cell: string): number | null {
  const cleaned = normalizeText(cell)
    .replace(/,/g, "")
    .replace(/円/g, "")
    .replace(/￥/g, "")
    .trim();

  if (!cleaned || cleaned === "----" || cleaned === "-" || cleaned.includes("---")) return null;

  const match = cleaned.match(/[0-9]+(?:\.[0-9]+)?/);
  if (!match) return null;

  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

function extractCells(rowHtml: string) {
  return Array.from(rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((m) => stripTags(m[1]));
}

function findTtsFromCells(cells: string[]): number | null {
  const cnyIndex = cells.findIndex((cell) => /(CNY|中国元|人民元|YUAN|Chinese\s*Yuan|China\s*Yuan)/i.test(cell));
  if (cnyIndex < 0) return null;

  // MUFGの通貨行は、通貨名の後ろに TTS / TTB などの数値が並ぶ想定。
  // 通貨コードや単位の数値混入を避けるため、CNYセルより後ろだけを見る。
  const afterCurrency = cells.slice(cnyIndex + 1);
  for (const cell of afterCurrency) {
    const num = parseNumberCell(cell);
    if (isValidCnyTts(num)) return num;
  }

  // 表構造が崩れた場合のみ、行全体から現実的なCNYレンジの数値を拾う。
  for (const cell of cells) {
    const num = parseNumberCell(cell);
    if (isValidCnyTts(num)) return num;
  }

  return null;
}

function parseCnyTtsFromHtml(html: string): ParsedRate | null {
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];

  for (const row of rows) {
    const rowText = stripTags(row);
    if (!/(CNY|中国元|人民元|YUAN|Chinese\s*Yuan|China\s*Yuan)/i.test(rowText)) continue;

    const cells = extractCells(row);
    const tts = findTtsFromCells(cells);
    if (isValidCnyTts(tts)) {
      return { tts, matchedText: rowText.slice(0, 240) };
    }
  }

  // 最終保険：CNY近辺500文字だけを見る。USD等の別通貨数値を拾わないよう範囲を限定する。
  const text = stripTags(html);
  const cnyIndex = text.search(/CNY|中国元|人民元|YUAN|Chinese\s*Yuan|China\s*Yuan/i);
  if (cnyIndex >= 0) {
    const around = text.slice(cnyIndex, cnyIndex + 500);
    const nums = Array.from(around.matchAll(/[0-9]+(?:\.[0-9]+)?/g))
      .map((m) => Number(m[0]))
      .filter(isValidCnyTts);
    if (nums.length > 0) {
      return { tts: nums[0], matchedText: around.slice(0, 240) };
    }
  }

  return null;
}

function decodeBuffer(buffer: ArrayBuffer, contentType: string | null) {
  const candidates = ["shift_jis", "windows-31j", "utf-8"];
  const hinted = contentType?.match(/charset=([^;]+)/i)?.[1]?.trim();
  const encodings = hinted ? [hinted, ...candidates.filter((c) => c.toLowerCase() !== hinted.toLowerCase())] : candidates;

  for (const encoding of encodings) {
    try {
      const decoded = new TextDecoder(encoding).decode(buffer);
      // MUFGページは日本語ページなので、文字化けしていないものを優先する。
      if (/中国元|人民元|CNY|TTS|YUAN/i.test(decoded)) return decoded;
    } catch {
      // unsupported encodingの場合は次へ
    }
  }

  return new TextDecoder("utf-8").decode(buffer);
}

export async function GET() {
  try {
    const res = await fetch(MUFG_URL, {
      cache: "no-store",
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        "accept-language": "ja,en-US;q=0.9,en;q=0.8",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          tts: null,
          applied: null,
          date: null,
          source: "MUFG",
          url: MUFG_URL,
          message: `MUFGページ取得失敗: HTTP ${res.status}`,
        },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    const buffer = await res.arrayBuffer();
    const html = decodeBuffer(buffer, res.headers.get("content-type"));
    const parsed = parseCnyTtsFromHtml(html);

    if (!parsed || !isValidCnyTts(parsed.tts)) {
      return NextResponse.json(
        {
          tts: null,
          applied: null,
          date: null,
          source: "MUFG",
          url: MUFG_URL,
          message: "CNY TTSを取得できませんでした。保存済みレートまたは手入力を使ってください。",
        },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    const tts = Number(parsed.tts.toFixed(2));
    const applied = Number((tts + 1).toFixed(2));

    return NextResponse.json(
      {
        tts,
        applied,
        date: new Date().toISOString().slice(0, 10),
        source: "MUFG CNY TTS+1",
        url: MUFG_URL,
        matchedText: parsed.matchedText,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        tts: null,
        applied: null,
        date: null,
        source: "MUFG",
        url: MUFG_URL,
        error: error instanceof Error ? error.message : "failed",
        message: "CNY TTSを取得できませんでした。保存済みレートまたは手入力を使ってください。",
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
