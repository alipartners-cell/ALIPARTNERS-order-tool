"use client";

import { useRef } from "react";

interface Props {
  onFile: (file: File) => void;
}

export default function UploadZone({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        handleFiles(e.dataTransfer.files);
      }}
      className="flex min-h-[190px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white p-8 text-center shadow-sm transition hover:border-indigo-400 hover:bg-indigo-50/30"
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-2xl">
        📁
      </div>
      <p className="text-sm font-bold text-indigo-600">CSVをドラッグ＆ドロップ</p>
      <p className="mt-1 text-xs text-gray-500">またはクリックしてファイルを選択</p>
      <p className="mt-5 text-[11px] font-mono text-gray-500">
        対応カラム例: sku, JAN, 商品名, 在庫, 納品見込み, 月販（CSVごとに販路・種類を選択）
      </p>
    </div>
  );
}
