"use client";

import { useState } from "react";
import type { SalesChannel, CsvDataKind } from "@/lib/csv";
import CsvStatusPanel from "@/components/home/CsvStatusPanel";

type CsvLoadStatus = {
  amazonSales: number | null;
  fbaInventory: number | null;
  rakutenSales: number | null;
  rslInventory: number | null;
  lastFiles: string[];
  errorCount: number;
};

export default function CsvImportStrip({
  filename,
  loading,
  onFile,
  onApplyFiles,
  csvLoadStatus,
  open,
  onToggleOpen,
}: {
  filename: string;
  loading: boolean;
  onFile: (file: File) => void;
  onApplyFiles: (items: { file: File; channel: SalesChannel; kind: CsvDataKind }[]) => void;
  csvLoadStatus: CsvLoadStatus;
  open: boolean;
  onToggleOpen: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<{ id: string; file: File; channel: SalesChannel; kind: CsvDataKind }[]>([]);

  const addFiles = (files: FileList | null) => {
    const nextFiles = Array.from(files ?? []).filter((file) => file.name.toLowerCase().endsWith(".csv"));
    if (nextFiles.length === 0) return;
    setItems((prev) => [
      ...prev,
      ...nextFiles.map((file) => {
        const lowerName = file.name.toLowerCase();
        const isRakutenAging = file.name.includes("在庫エイジング") || lowerName.includes("aging");
        const isRakutenSalesReport = file.name.includes("SKU実績") || lowerName.includes("sku実績");
        const isRakuten = lowerName.includes("rakuten") || file.name.includes("楽天") || isRakutenAging || isRakutenSalesReport;
        const channel: SalesChannel = isRakuten ? "rakuten" : "amazon";
        const kind: CsvDataKind = isRakuten
          ? isRakutenAging
            ? "inventory"
            : "sales"
          : file.name.includes("売上") || lowerName.includes("sales")
            ? "sales"
            : "inventory";

        return {
          id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
          file,
          channel,
          kind,
        } as { id: string; file: File; channel: SalesChannel; kind: CsvDataKind };
      }),
    ]);
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  };

  const apply = () => {
    onApplyFiles(items.map(({ file, channel, kind }) => ({ file, channel, kind })));
    setItems([]);
  };

  return (
    <div className="shrink-0 border-b border-gray-200 bg-gray-50 px-5 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black text-gray-700">CSV読込エリア</p>
        </div>
        <button
          type="button"
          onClick={onToggleOpen}
          className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 shadow-sm hover:bg-gray-50"
        >
          {open ? "閉じる ▲" : "開く ▼"}
        </button>
      </div>

      {open && (
        <>
          <label
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`block cursor-pointer rounded-xl border-2 border-dashed px-4 py-3 transition ${
              dragging
                ? "border-indigo-500 bg-indigo-50"
                : "border-gray-300 bg-white hover:border-indigo-300 hover:bg-indigo-50/40"
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-gray-800">CSVをまとめてドラッグ＆ドロップ</p>
                <p className="mt-1 text-xs text-gray-500">
                  Amazon/FBA・楽天/RSLともに「売上」「在庫」を選択してください。JANで商品を統合します。
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="max-w-[260px] truncate text-xs font-mono text-gray-500">
                  {loading ? "読込中…" : filename || "CSV未読込"}
                </span>
                <span className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white">CSV選択</span>
              </div>
            </div>
            <input type="file" accept=".csv,text/csv" multiple className="hidden" onChange={(event) => { addFiles(event.currentTarget.files); event.currentTarget.value = ""; }} />
          </label>

          <CsvStatusPanel status={csvLoadStatus} />

          {items.length > 0 && (
            <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-bold text-gray-700">取込待ちCSV</p>
                <div className="flex gap-2">
                  <button onClick={() => setItems([])} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50">クリア</button>
                  <button onClick={apply} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500">CSVを反映</button>
                </div>
              </div>
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="grid grid-cols-[1fr_140px_120px_40px] items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                    <span className="truncate text-xs font-mono text-gray-600">{item.file.name}</span>
                    <select value={item.channel} onChange={(e) => setItems((prev) => prev.map((v) => {
                      if (v.id !== item.id) return v;
                      const nextChannel = e.target.value as SalesChannel;
                      return { ...v, channel: nextChannel, kind: nextChannel === "rakuten" ? "sales" : "inventory" };
                    }))} className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-bold text-gray-700">
                      <option value="amazon">Amazon/FBA</option>
                      <option value="rakuten">楽天/RSL</option>
                    </select>
                    <select value={item.kind} onChange={(e) => setItems((prev) => prev.map((v) => v.id === item.id ? { ...v, kind: e.target.value as CsvDataKind } : v))} className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-bold text-gray-700">
                      {item.channel === "rakuten" ? (
                        <>
                          <option value="sales">売上</option>
                          <option value="inventory">在庫</option>
                        </>
                      ) : (
                        <>
                          <option value="inventory">在庫</option>
                          <option value="sales">売上</option>
                        </>
                      )}
                    </select>
                    <button onClick={() => setItems((prev) => prev.filter((v) => v.id !== item.id))} className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-black text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600" title="このCSVを削除">×</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
