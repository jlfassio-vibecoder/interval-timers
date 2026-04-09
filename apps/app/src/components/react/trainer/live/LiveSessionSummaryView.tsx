/**
 * Post-workout summary for a Trainer Live session (AMRAP round bars + Tabata details).
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import FluidBackground from '@/components/react/FluidBackground';
import { useLiveSessionSummary } from '@/hooks/useLiveSessionSummary';
import type { LiveSessionSummarySegment } from '@/types/live-session-summary';

function AmrapRoundBarChart({ segment }: { segment: LiveSessionSummarySegment }) {
  const metrics = segment.amrap_metrics;
  const rounds = metrics?.rounds ?? [];
  const data = useMemo(
    () =>
      rounds.map((r) => ({
        roundLabel: String(r.round_index + 1),
        split_sec: r.split_sec,
      })),
    [rounds]
  );

  if (data.length === 0) {
    return (
      <p className="text-sm text-white/50">
        No logged rounds for your account in this block{metrics?.viewer_amrap_participant_id ? '.' : ' (join the AMRAP as a signed-in participant to record rounds).'}
      </p>
    );
  }

  return (
    <div className="h-64 w-full min-w-0 md:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis
            dataKey="roundLabel"
            tick={{ fill: 'rgba(255,255,255,0.65)', fontSize: 11 }}
            label={{ value: 'Round', position: 'insideBottom', offset: -2, fill: 'rgba(255,255,255,0.5)' }}
          />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.65)', fontSize: 11 }}
            label={{
              value: 'Seconds',
              angle: -90,
              position: 'insideLeft',
              fill: 'rgba(255,255,255,0.5)',
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(24,24,27,0.95)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px',
            }}
            labelFormatter={(_, payload) => {
              const p = payload?.[0]?.payload as { roundLabel?: string } | undefined;
              return p?.roundLabel != null ? `Round ${p.roundLabel}` : '';
            }}
            formatter={(value) => [`${Number(value ?? 0)} sec`, 'Split']}
          />
          <Bar dataKey="split_sec" fill="rgb(251 146 60)" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TabataSummaryBlock({ segment }: { segment: LiveSessionSummarySegment }) {
  const t = segment.tabata_metrics;
  if (!t) return null;
  const phase =
    typeof t.state?.phase === 'string' ? t.state.phase : typeof t.state?.phase === 'number'
      ? String(t.state.phase)
      : null;
  return (
    <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50">
      <p className="font-semibold text-cyan-100">Tabata</p>
      <ul className="mt-2 space-y-1 font-mono text-xs text-white/80">
        <li>
          Intervals: {t.work_seconds}s work / {t.rest_seconds}s rest
        </li>
        <li>Planned rounds: {t.round_count}</li>
        {phase ? <li>Phase: {phase}</li> : null}
      </ul>
    </div>
  );
}

export default function LiveSessionSummaryView({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate();
  const { data, loading, error } = useLiveSessionSummary(sessionId);

  return (
    <div className="relative min-h-screen bg-black text-white">
      <FluidBackground />
      <div className="relative z-10 mx-auto max-w-3xl px-4 py-8 md:px-6">
        <header className="mb-8">
          <h1 className="font-heading text-2xl font-bold uppercase tracking-wide text-orange-light md:text-3xl">
            Post-workout summary
          </h1>
          {data?.activity_session ? (
            <p className="mt-2 font-mono text-xs text-white/45">
              Activity: {data.activity_session.status}
              {' · '}
              Session {data.trainer_live_session_id.slice(0, 8)}…
            </p>
          ) : (
            <p className="mt-2 text-sm text-white/55">No activity timer data for this session.</p>
          )}
        </header>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-light border-t-transparent" />
          </div>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {!loading && !error && data ? (
          <div className="space-y-10">
            {data.segments.map((seg) => (
              <section
                key={seg.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm"
              >
                <h2 className="text-lg font-semibold text-white">
                  {seg.label || seg.segment_type}
                  <span className="ml-2 font-mono text-xs font-normal text-white/40">#{seg.ordinal}</span>
                </h2>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-white/35">
                  {seg.segment_type}
                </p>

                {seg.segment_type === 'amrap' ? (
                  <div className="mt-4 space-y-3">
                    {seg.amrap_metrics ? (
                      <>
                        <div className="flex flex-wrap gap-4 text-sm text-white/70">
                          <span>Total rounds: {seg.amrap_metrics.total_rounds}</span>
                          {seg.amrap_metrics.fastest_split_sec != null ? (
                            <span>Fastest split: {seg.amrap_metrics.fastest_split_sec}s</span>
                          ) : null}
                        </div>
                        <AmrapRoundBarChart segment={seg} />
                      </>
                    ) : (
                      <p className="text-sm text-white/50">No AMRAP metrics for this block.</p>
                    )}
                  </div>
                ) : null}

                {seg.tabata_metrics ? (
                  <div className="mt-4">
                    <TabataSummaryBlock segment={seg} />
                  </div>
                ) : null}
              </section>
            ))}
            {data.segments.length === 0 ? (
              <p className="text-white/55">No segments recorded for this session.</p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-10 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate('/live')}
            className="rounded-xl bg-orange-light px-6 py-3 text-sm font-bold uppercase tracking-wide text-black transition-colors hover:bg-white"
          >
            Back to Trainer Live
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-xl border border-white/20 bg-transparent px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white/90 transition-colors hover:border-white/35 hover:bg-white/5"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
