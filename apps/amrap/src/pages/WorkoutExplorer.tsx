import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IntervalTimerLanding } from '@interval-timers/timer-ui';
import { getProtocolAccent } from '@interval-timers/timer-core';
import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
} from 'recharts';
import type { AmrapLevel } from '@/components/interval-timers/amrap-setup-data';
import {
  AMRAP_WORKOUT_LIBRARY,
  AMRAP_LEVEL_DURATION,
  AMRAP_EXPLORER_TIER_META,
} from '@/components/interval-timers/amrap-setup-data';

const AMRAP_ACCENT = getProtocolAccent('amrap');

const RADAR_LABELS = [
  'Intensity (HR%)',
  'Movement Skill',
  'Pacing Focus',
  'Total Volume',
];

/** Header background for workout cards — full class names in file so Tailwind JIT includes them */
function getWorkoutHeaderClasses(index: number): string {
  switch (index % 4) {
    case 0:
      return 'border-b p-4 border-green-700/40 bg-green-900/50';
    case 1:
      return 'border-b p-4 border-amber-700/40 bg-amber-900/50';
    case 2:
      return 'border-b p-4 border-red-700/40 bg-red-900/50';
    case 3:
      return 'border-b p-4 border-orange-700/40 bg-orange-900/50';
    default:
      return 'border-b p-4 border-white/10 bg-black/20';
  }
}

function buildRadarData(
  chartData: [number, number, number, number],
): { subject: string; value: number; fullMark: number }[] {
  return RADAR_LABELS.map((subject, i) => ({
    subject,
    value: chartData[i],
    fullMark: 100,
  }));
}

function RadarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { subject: string; value: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const { subject, value } = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/10 bg-[#0d0500] px-3 py-2 text-sm text-white shadow-lg">
      {subject}: {value}/100
    </div>
  );
}

export default function WorkoutExplorer() {
  const [selectedTier, setSelectedTier] = useState<AmrapLevel>('beginner');

  const meta = AMRAP_EXPLORER_TIER_META[selectedTier];
  const workouts = AMRAP_WORKOUT_LIBRARY[selectedTier];
  const durationMinutes = AMRAP_LEVEL_DURATION[selectedTier];
  const radarData = buildRadarData(meta.chartData);

  return (
    <IntervalTimerLanding
      currentProtocol="amrap"
      standalone
      accentTheme={AMRAP_ACCENT}
      brandLabel="AI Fitness Guy"
    >
      <div className="mx-auto max-w-7xl space-y-12 px-4 pb-24 sm:px-6 lg:px-8">
        <div className="pt-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-white/70 transition-colors hover:text-orange-400"
          >
            <span>←</span>
            <span>Back to AMRAP</span>
          </Link>
        </div>

        <header className="max-w-3xl mx-auto text-center space-y-4">
          <div className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white/80">
            Meta-Analysis Application
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">
            Protocol Explorer
          </h1>
          <p className="text-lg leading-relaxed text-white/70">
            Explore structured workouts designed around the 2026 Meta-Analysis for
            High-Intensity Functional Training. Select a duration tier below to
            analyze its physiological demands and access specific templates.
          </p>
        </header>

        <section className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left: Tier selection + Radar */}
          <div className="flex flex-col space-y-6 lg:col-span-5">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
              <h2 className="text-xl font-bold text-white">1. Select Protocol Tier</h2>
              <p className="mt-1 text-sm text-white/50">
                Filter templates by duration and experience level.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {(['beginner', 'intermediate', 'advanced'] as const).map((tier) => {
                  const isActive = selectedTier === tier;
                  const activeBg =
                    tier === 'beginner'
                      ? 'bg-green-600'
                      : tier === 'intermediate'
                        ? 'bg-amber-600'
                        : 'bg-red-600';
                  return (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setSelectedTier(tier)}
                      className={`flex flex-col items-center gap-1 rounded-xl border-2 py-3 px-2 font-bold transition-all hover:translate-y-[-2px] hover:shadow-md ${
                        isActive
                          ? `${activeBg} border-transparent text-white`
                          : 'border-white/20 bg-transparent text-white/70 hover:border-white/40 hover:text-white'
                      }`}
                    >
                      <span className="text-lg">
                        {tier === 'beginner' ? '🟢' : tier === 'intermediate' ? '🟡' : '🔴'}
                      </span>
                      <span className="text-sm capitalize">{tier}</span>
                      <span className="text-[10px] uppercase tracking-wide opacity-80">
                        {AMRAP_LEVEL_DURATION[tier]} Minutes
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-grow flex-col rounded-2xl border border-white/10 bg-black/20 p-6">
              <h2 className="text-xl font-bold text-white">Physiological Profile</h2>
              <p className="mt-1 text-sm text-white/50">
                Relative demands of the selected tier.
              </p>
              <div className="relative mt-4 flex flex-grow items-center justify-center pt-4">
                <div className="h-[280px] w-full max-w-[320px] sm:h-[320px]">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
                    <RadarChart data={radarData} margin={{ top: 16, right: 16, bottom: 16, left: 16 }}>
                      <PolarGrid stroke="rgba(255,255,255,0.1)" />
                      <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 11 }}
                      />
                      <PolarRadiusAxis
                        angle={90}
                        domain={[0, 100]}
                        tick={{ fill: 'rgba(255,255,255,0.5)' }}
                      />
                      <Radar
                        name="Demands"
                        dataKey="value"
                        stroke={meta.colorHex}
                        fill={meta.colorHex}
                        fillOpacity={0.25}
                        strokeWidth={2}
                      />
                      <Tooltip content={<RadarTooltip />} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Workout feed */}
          <div className="lg:col-span-7">
            <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-black/20 p-6 sm:p-8">
              <div className="mb-8 border-b border-white/10 pb-6">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-extrabold text-white">{meta.title}</h2>
                    <p className="mt-1 text-lg font-medium text-white/80">{meta.subtitle}</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 py-1.5 text-sm font-bold text-white">
                    <span>⏱️</span>
                    <span>{durationMinutes} Minutes</span>
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
                  <p className="text-sm text-white/80">
                    <strong className="text-white">Primary Goal:</strong> {meta.goal}
                  </p>
                </div>
              </div>

              <div className="flex-grow">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
                  Workout Templates
                </h3>
                <div className="grid max-h-[600px] grid-cols-1 gap-5 overflow-y-auto pr-2 md:grid-cols-2">
                  {workouts.map((workout, index) => (
                    <div
                      key={index}
                      className="workout-card flex flex-col overflow-hidden rounded-xl border border-white/10 bg-black/30 transition-all hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      <div className={getWorkoutHeaderClasses(index)}>
                        <h4 className="font-bold leading-tight text-white">
                          {workout.name}
                        </h4>
                        {workout.focus && (
                          <p className="mt-1 border-l-2 border-white/20 pl-2 text-xs italic text-white/80">
                            {workout.focus}
                          </p>
                        )}
                      </div>
                      <div className="flex-grow p-4">
                        <ul className="space-y-1 list-disc list-inside text-sm text-white/90">
                          {workout.exercises.map((ex, i) => (
                            <li key={i}>{ex}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Scientific Implementation Notes */}
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-black/40 p-8 shadow-2xl sm:p-12">
          <div className="pointer-events-none absolute top-0 right-0 h-64 w-64 -translate-y-1/2 translate-x-1/4 rounded-full bg-white/5 blur-3xl" />
          <div className="relative z-10 mb-10 max-w-3xl">
            <h2 className="mb-4 text-3xl font-extrabold text-white sm:text-4xl">
              Scientific Implementation Notes
            </h2>
            <p className="text-lg leading-relaxed text-white/60">
              Executing the protocol requires adherence to specific physiological
              rules. Apply these three pillars to every template above to ensure
              the intended metabolic response.
            </p>
          </div>
          <div className="relative z-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-6 transition-colors hover:border-white/20">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-2xl shadow-inner">
                📈
              </div>
              <h3 className="mb-2 text-xl font-bold text-white">Pacing Strategy</h3>
              <p className="text-sm leading-relaxed text-white/70">
                Start at a pace you feel you can maintain for 30 minutes, even
                though the workout is shorter. At the{' '}
                <strong className="text-white">75% time mark</strong>, increase
                speed for a &quot;Negative Split&quot; finish.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-6 transition-colors hover:border-white/20">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-2xl shadow-inner">
                ⚖️
              </div>
              <h3 className="mb-2 text-xl font-bold text-white">Protocol Loading</h3>
              <p className="text-sm leading-relaxed text-white/70">
                Weights should feel &quot;light to moderate.&quot; If you have to
                rest more than <strong className="text-white">10 seconds</strong>{' '}
                between movements to complete a set, the weight is too heavy to
                maintain the required intensity.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-6 transition-colors hover:border-white/20">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-2xl shadow-inner">
                🔄
              </div>
              <h3 className="mb-2 text-xl font-bold text-white">Rest & Transitions</h3>
              <p className="text-sm leading-relaxed text-white/70">
                The &quot;rest&quot; in these protocols is simply the time it
                takes to move between stations.{' '}
                <strong className="text-white">Efficient transitions</strong> are
                the key to maximizing the 15–20 minute metabolic window.
              </p>
            </div>
          </div>
        </section>
      </div>
    </IntervalTimerLanding>
  );
}
