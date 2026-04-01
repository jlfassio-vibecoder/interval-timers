/**
 * AMRAP With Friends progress: rounds per session and consistency over time.
 */

import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useAppContext } from '@/contexts/AppContext';
import { getAmrapSessionResultsForAnalytics } from '@/lib/supabase/client/amrap-session-results';

type DateRangeKey = '7d' | '30d' | '90d';

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const squaredDiffs = arr.map((v) => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / arr.length);
}

export default function AmrapProgressSection() {
  const { user } = useAppContext();
  const [range, setRange] = useState<DateRangeKey>('30d');
  const [results, setResults] = useState<
    Awaited<ReturnType<typeof getAmrapSessionResultsForAnalytics>>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    getAmrapSessionResultsForAnalytics(user.uid, 100)
      .then(setResults)
      .finally(() => setLoading(false));
  }, [user?.uid]);

  const { chartData, hasRounds, hasConsistency } = useMemo(() => {
    const now = Date.now();
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const cut = now - days * 24 * 60 * 60 * 1000;
    const filtered = results.filter((r) => new Date(r.completed_at).getTime() >= cut);
    const data = filtered
      .map((r) => ({
        date: r.completed_at.slice(0, 10),
        label: new Date(r.completed_at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        }),
        rounds: r.total_rounds,
        consistencySec:
          r.round_durations.length >= 2
            ? Math.round(stdDev(r.round_durations))
            : (null as number | null),
      }))
      .reverse();
    return {
      chartData: data,
      hasRounds: data.some((d) => d.rounds > 0),
      hasConsistency: data.some((d) => d.consistencySec != null),
    };
  }, [results, range]);

  if (loading) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h4 className="mb-3 font-mono text-[10px] uppercase tracking-[0.4em] text-white/60">
          AMRAP Progress
        </h4>
        <p className="py-8 text-center font-mono text-[10px] text-white/40">Loading…</p>
      </section>
    );
  }

  if (results.length === 0) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h4 className="mb-3 font-mono text-[10px] uppercase tracking-[0.4em] text-white/60">
          AMRAP Progress
        </h4>
        <p className="py-6 text-center font-mono text-[10px] italic text-white/40">
          Complete AMRAP With Friends workouts to see progress
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/60">
          AMRAP Progress
        </h4>
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase transition-colors ${
                range === r
                  ? 'border-orange-500/60 bg-orange-500/20 text-orange-400'
                  : 'border-white/20 text-white/60 hover:bg-white/10'
              }`}
            >
              {r === '7d' ? '7d' : r === '30d' ? '30d' : '90d'}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <p className="py-6 text-center font-mono text-[10px] italic text-white/40">
          No sessions in this range
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {hasRounds && (
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase text-white/50">
                Rounds per session
              </p>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="rgba(255,255,255,0.08)"
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.6)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.6)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        background: '#0d0500',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.9)',
                        fontSize: '12px',
                      }}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''}
                      formatter={(value: unknown) => [`${Number(value ?? 0)} rounds`, 'Rounds']}
                    />
                    <Bar dataKey="rounds" fill="rgba(234,88,12,0.5)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {hasConsistency && (
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase text-white/50">
                Round consistency (std dev, sec) — lower is more consistent
              </p>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData.map((d) => ({ ...d, consistency: d.consistencySec ?? 0 }))}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="rgba(255,255,255,0.08)"
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.6)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.6)' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}s`}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        background: '#0d0500',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.9)',
                        fontSize: '12px',
                      }}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''}
                      formatter={(value: unknown) => {
                        const n = Number(value ?? 0);
                        return [n === 0 ? '—' : `${n}s`, 'Std dev'];
                      }}
                    />
                    <Bar dataKey="consistency" fill="rgba(16,185,129,0.4)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
