"use client";

function qtyText(value: number) {
  return value > 0 ? Number(value).toLocaleString() : "—";
}

export default function DecisionCell({
  label,
  value,
  tone,
  unit = "",
  subLabel = "",
}: {
  label: string;
  value: number;
  tone: "blue" | "green" | "orange";
  unit?: string;
  subLabel?: string;
}) {
  const active = value > 0;
  const color = active
    ? tone === "blue"
      ? "text-indigo-700 bg-indigo-50 border-indigo-100"
      : tone === "green"
        ? "text-emerald-700 bg-emerald-50 border-emerald-100"
        : "text-orange-700 bg-orange-50 border-orange-100"
    : "text-gray-400 bg-gray-50 border-gray-100 opacity-55";
  return (
    <div className={`flex h-[86px] w-[140px] shrink-0 flex-col justify-center rounded-xl border px-3 py-2 text-right transition ${color}`}>
      <div className="text-[11px] font-bold leading-none opacity-70">{label}</div>
      <div className="mt-1 whitespace-nowrap text-xl font-black leading-tight tabular-nums">
        {qtyText(value)}{unit ? <span className="ml-1 text-xs font-bold">{unit}</span> : null}
      </div>
      <div className="mt-1 min-h-[12px] text-[10px] font-bold leading-none opacity-60">{subLabel || " "}</div>
    </div>
  );
}
