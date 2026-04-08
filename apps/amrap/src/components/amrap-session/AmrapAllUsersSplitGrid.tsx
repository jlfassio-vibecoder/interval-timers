import type { AmrapSplitRecord } from '@/lib/amrapSplitTypes';

function formatSplit(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function AmrapAllUsersSplitGrid({ records }: { records: AmrapSplitRecord[] }) {
  if (records.length === 0) return null;

  return (
    <div className="mt-4 w-full min-w-0 border-t border-white/10 pt-3">
      <div className="mb-2 text-left text-[10px] font-bold uppercase tracking-wider text-white/50">
        All users · splits
      </div>
      <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto overflow-x-hidden sm:grid-cols-3">
        {records.map((r) => (
          <div
            key={r.id}
            className="min-w-0 rounded-lg border border-white/10 bg-black/25 px-2 py-2 text-left"
          >
            <div className="truncate text-xs font-semibold text-white/90">{r.nickname}</div>
            <div className="mt-0.5 text-[10px] text-white/55">
              R{r.round_number} · {formatSplit(r.split_time_sec)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
