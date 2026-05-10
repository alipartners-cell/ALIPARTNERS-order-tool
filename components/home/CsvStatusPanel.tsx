"use client";

type CsvLoadStatus = {
  amazonSales: number | null;
  fbaInventory: number | null;
  rakutenSales: number | null;
  rslInventory: number | null;
  lastFiles: string[];
  errorCount: number;
};

export default function CsvStatusPanel({
  status,
}: {
  status: CsvLoadStatus;
}) {
  const hasAny =
    status.amazonSales !== null ||
    status.fbaInventory !== null ||
    status.rakutenSales !== null ||
    status.rslInventory !== null ||
    status.lastFiles.length > 0 ||
    status.errorCount > 0;

  if (!hasAny) {
    return (
      <div className="mt-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs text-gray-500">
        CSV状態：未読込
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <CsvStatusBadge label="Amazon売上" value={status.amazonSales} />
        <CsvStatusBadge label="FBA在庫" value={status.fbaInventory} />
        <CsvStatusBadge label="楽天売上" value={status.rakutenSales} />
        <CsvStatusBadge label="RSL在庫" value={status.rslInventory} />
      </div>

      {status.lastFiles.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
          {status.lastFiles.map((name) => (
            <span key={name} className="max-w-[360px] truncate rounded-lg bg-gray-50 px-2 py-1 font-mono">
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CsvStatusBadge({ label, value }: { label: string; value: number | null }) {
  const loaded = value !== null;

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-bold ${
        loaded
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-gray-200 bg-gray-50 text-gray-400"
      }`}
    >
      {label}：{loaded ? `${value.toLocaleString()}件` : "未読込"}
    </span>
  );
}
