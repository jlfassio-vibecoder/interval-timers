/**
 * Bar chart showing time per round (duration variability) with average reference line
 * and consistency stat (mean ± std dev).
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const squaredDiffs = arr.map((v) => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / arr.length);
}

export interface RoundConsistencyChartProps {
  roundDurations: number[];
}

export default function RoundConsistencyChart({
  roundDurations,
}: RoundConsistencyChartProps) {
  if (roundDurations.length === 0) return null;

  const data = roundDurations.map((seconds, i) => ({
    round: i + 1,
    seconds,
    label: formatSeconds(seconds),
  }));

  const average =
    roundDurations.reduce((a, b) => a + b, 0) / roundDurations.length;
  const std = stdDev(roundDurations);
  const showConsistencyStat = roundDurations.length > 1;

  return (
    <div className="mb-6 rounded-xl border border-white/10 bg-black/30 p-4">
      <h3 className="mb-3 text-sm font-bold text-white/90">
        Round duration
      </h3>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="rgba(255,255,255,0.1)"
            />
            <XAxis
              dataKey="round"
              tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.7)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.7)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${Math.floor(v / 60)}:${(v % 60).toString().padStart(2, '0')}`}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              contentStyle={{
                borderRadius: '8px',
                background: '#0d0500',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.9)',
              }}
              formatter={(value: number | undefined) => [value != null ? formatSeconds(value) : '—', 'Duration']}
              labelFormatter={(label) => `Round ${label}`}
            />
            <ReferenceLine
              y={average}
              stroke="rgba(234,88,12,0.6)"
              strokeDasharray="3 3"
              strokeWidth={1.5}
            />
            <Bar dataKey="seconds" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    entry.seconds > average
                      ? 'rgba(234,88,12,0.6)'
                      : entry.seconds < average
                        ? 'rgba(16,185,129,0.6)'
                        : 'rgba(148,163,184,0.5)'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {showConsistencyStat && (
        <p className="mt-2 text-xs text-white/60">
          Avg {formatSeconds(Math.round(average))} ± {Math.round(std)}s
        </p>
      )}
    </div>
  );
}
