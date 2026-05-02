/**
 * AP在庫表をJSON APIとして返すApps Script。
 * デプロイ方法：
 * 1. 対象スプレッドシートで「拡張機能」→「Apps Script」
 * 2. このコードを貼り付け
 * 3. SHEET_NAME を必要に応じて変更
 * 4. 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
 * 5. 実行ユーザー「自分」、アクセス「リンクを知っている全員」
 * 6. 発行された /exec URL を Next.js の .env.local に設定
 */

const SHEET_NAME = ''; // 空欄なら先頭シートを使用。例: '在庫表'
const HEADER_SCAN_ROWS = 10;

function doGet() {
  const sheet = SHEET_NAME
    ? SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME)
    : SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

  if (!sheet) {
    return json_({ items: [], error: 'Sheet not found' });
  }

  const values = sheet.getDataRange().getValues();
  if (values.length === 0) return json_({ items: [] });

  const headerInfo = findHeaders_(values);
  const janCol = headerInfo.janCol;
  const stockCol = headerInfo.stockCol;
  const nameCol = headerInfo.nameCol;
  const startRow = headerInfo.startRow;

  if (janCol < 0 || stockCol < 0) {
    return json_({
      items: [],
      error: 'JAN列または最新の在庫数(pcs)列が見つかりません',
      debug: headerInfo,
    });
  }

  const items = [];
  for (let r = startRow; r < values.length; r++) {
    const row = values[r];
    const jan = normalizeJan_(row[janCol]);
    if (!jan) continue;
    items.push({
      jan: jan,
      product_name: nameCol >= 0 ? String(row[nameCol] || '').trim() : '',
      ap_stock: toNumber_(row[stockCol]),
    });
  }

  return json_({ items: items, count: items.length, stockColumn: stockCol + 1 });
}

function findHeaders_(values) {
  const maxRows = Math.min(values.length, HEADER_SCAN_ROWS);
  let janCol = -1, janRow = -1, stockCol = -1, stockRow = -1, nameCol = -1, nameRow = -1;

  for (let r = 0; r < maxRows; r++) {
    for (let c = 0; c < values[r].length; c++) {
      const text = String(values[r][c] || '').trim();
      const normalized = text.replace(/\s/g, '').toLowerCase();

      if (janCol < 0 && (normalized === 'jan' || normalized.includes('janコード'))) {
        janCol = c; janRow = r;
      }

      if (nameCol < 0 && (normalized.includes('商品名') || normalized === 'name' || normalized === 'product_name')) {
        nameCol = c; nameRow = r;
      }

      // 右側に日付ごとの在庫数(pcs)が増えていく前提なので、見つかった中で最も右の列を採用
      if (normalized.includes('在庫数') || normalized.includes('stock')) {
        stockCol = c; stockRow = r;
      }
    }
  }

  return {
    janCol: janCol,
    janRow: janRow,
    stockCol: stockCol,
    stockRow: stockRow,
    nameCol: nameCol,
    nameRow: nameRow,
    startRow: Math.max(janRow, stockRow, nameRow, 0) + 1,
  };
}

function normalizeJan_(value) {
  return String(value || '').replace(/\D/g, '').trim();
}

function toNumber_(value) {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
