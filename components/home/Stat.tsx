"use client";

export default function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "red" | "amber";
}) {
  const color =
    accent === "red"
      ? "text-red-600"
      : accent === "amber"
      ? "text-orange-500"
      : "text-gray-900";

  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400">
        {label}
      </p>
      <p className={`text-lg font-bold ${color}`}>{value.toLocaleString()}</p>
    </div>
  );
}
