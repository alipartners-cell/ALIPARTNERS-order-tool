# AP在庫スプレッドシート連携

## 1. Apps Script側

1. AP在庫管理スプレッドシートを開く
2. 「拡張機能」→「Apps Script」
3. `apps-script/ap-stock-api.gs` の内容を貼り付け
4. 必要なら `SHEET_NAME` を対象シート名に変更
5. 「デプロイ」→「新しいデプロイ」
6. 種類は「ウェブアプリ」
7. 実行ユーザーは「自分」
8. アクセスは「リンクを知っている全員」
9. 発行された `/exec` URL をコピー

## 2. Next.js側

プロジェクト直下に `.env.local` を作成し、以下を設定します。

```env
AP_STOCK_API_URL=https://script.google.com/macros/s/xxxxxxxxxxxxxxxx/exec
```

設定後、開発サーバーを再起動してください。

```bash
npm run dev
```

## 3. 使い方

CSVを読み込んだ後、画面上部の「AP在庫を更新」ボタンを押すと、JAN一致でAP在庫だけ更新されます。
