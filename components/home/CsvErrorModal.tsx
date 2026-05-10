"use client";

export default function CsvErrorModal({
  open,
  errors,
  onClose,
}: {
  open: boolean;
  errors: string[];
  onClose: () => void;
}) {
  if (!open) return null;

  const copyErrors = async () => {
    const text = errors.map((error, index) => `${index + 1}. ${error}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      alert("エラー内容をコピーしました");
    } catch {
      alert("コピーに失敗しました。画面上の内容を選択してコピーしてください。");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-black text-gray-900">CSVエラー詳細</h2>
            <p className="mt-1 text-xs font-semibold text-gray-500">
              取り込み時に検出されたエラーです。対象CSVを修正して、再アップロードしてください。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            閉じる
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-amber-50 px-6 py-3">
          <div className="text-sm font-bold text-amber-800">
            エラー {errors.length.toLocaleString()}件
          </div>
          <button
            type="button"
            onClick={copyErrors}
            className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100"
          >
            エラー内容をコピー
          </button>
        </div>

        <div className="overflow-auto p-4">
          {errors.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 py-10 text-center text-sm font-bold text-gray-500">
              現在表示できるエラーはありません
            </div>
          ) : (
            <div className="space-y-2">
              {errors.map((error, index) => (
                <div
                  key={`${error}-${index}`}
                  className="rounded-xl border border-amber-100 bg-white px-4 py-3 text-xs font-mono text-gray-700 shadow-sm"
                >
                  <div className="mb-1 text-[11px] font-black text-amber-600">
                    #{index + 1}
                  </div>
                  <div className="whitespace-pre-wrap break-words leading-relaxed">
                    {error}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
