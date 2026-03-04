import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { IntervalTimerLanding } from '@interval-timers/timer-ui';
import { getProtocolAccent } from '@interval-timers/timer-core';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
} from 'recharts';
import Plot from 'react-plotly.js';

const AMRAP_ACCENT = getProtocolAccent('amrap');

const PACING_NOVICE = [40, 95, 96, 92, 85, 80, 75, 72, 70, 68, 65, 62, 60, 58, 55, 52, 50, 48, 45, 42, 40];
const PACING_OPTIMIZED = [40, 70, 80, 85, 86, 86, 87, 88, 88, 88, 88, 89, 89, 90, 91, 92, 93, 94, 95, 95, 96];
const PACING_LABELS = Array.from({ length: 21 }, (_, i) => i);

const COMPOSITION_DATA = [
  { name: 'Functional', value: 50, color: '#ea580c' },
  { name: 'Bodyweight', value: 25, color: '#0d9488' },
  { name: 'Plyo', value: 25, color: '#78716c' },
];

const SECTION_IDS = ['hero', 'duration', 'exercises', 'sequencing', 'template'] as const;
const NAV_LABELS: Record<(typeof SECTION_IDS)[number], string> = {
  hero: 'Overview',
  duration: 'Pacing',
  exercises: 'Composition',
  sequencing: 'Flow',
  template: 'Analysis',
};

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function CompositionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
}) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="rounded-lg border border-white/10 bg-[#0d0500] px-3 py-2 text-sm text-white shadow-lg">
      {name}: {value}%
    </div>
  );
}

export default function ProgrammingGuide() {
  const [pacingMode, setPacingMode] = useState<'novice' | 'optimized'>('novice');
  const [activeNav, setActiveNav] = useState<string>('hero');

  const pacingData = PACING_LABELS.map((min, i) => ({
    min,
    value: pacingMode === 'novice' ? PACING_NOVICE[i] : PACING_OPTIMIZED[i],
  }));

  useEffect(() => {
    const sections = document.querySelectorAll('section[id]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            if (id) setActiveNav(id);
          }
        });
      },
      { threshold: 0.3 }
    );
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const gaugeData = [
    {
      domain: { x: [0, 1], y: [0, 1] },
      value: 88,
      type: 'indicator' as const,
      mode: 'gauge+number' as const,
      gauge: {
        axis: { range: [null, 100], tickwidth: 1, tickcolor: '#d6d3d1' },
        bar: { color: '#ea580c' },
        bgcolor: 'rgba(13,5,0,0)',
        borderwidth: 0,
        steps: [
          { range: [0, 60], color: '#27272a' },
          { range: [60, 85], color: '#3f3f46' },
          { range: [85, 92], color: '#0d9488' },
          { range: [92, 100], color: '#dc2626' },
        ],
        threshold: {
          line: { color: '#fff', width: 2 },
          thickness: 0.75,
          value: 92,
        },
      },
    },
  ];

  const gaugeLayout = {
    width: 280,
    height: 250,
    margin: { t: 0, b: 0, l: 0, r: 0 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    font: { family: 'Inter', color: '#fafafa', size: 16 },
  };

  return (
    <IntervalTimerLanding
      currentProtocol="amrap"
      standalone
      accentTheme={AMRAP_ACCENT}
      brandLabel="AI Fitness Guy"
    >
      <div className="mx-auto max-w-5xl space-y-16 pb-24">
        {/* Back link */}
        <div className="no-print pt-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-white/70 transition-colors hover:text-orange-400"
          >
            <span>←</span>
            <span>Back to AMRAP</span>
          </Link>
        </div>

        {/* Sticky nav */}
        <nav className="no-print sticky top-0 z-40 -mx-4 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-[#0d0500]/95 px-4 py-3 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-2">
            <span className="text-xl">⏱️</span>
            <span className="font-bold tracking-tight text-white">
              AMRAP <span className="font-normal text-orange-500">PRO 2026</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {SECTION_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => scrollToSection(id)}
                className={`rounded px-2 py-1 text-sm font-medium transition-colors ${
                  activeNav === id
                    ? 'border-b-2 border-orange-500 text-orange-500'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {NAV_LABELS[id]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => window.print()}
              className="ml-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-orange-600"
            >
              Export PDF
            </button>
          </div>
        </nav>

        {/* Hero */}
        <section id="hero" className="scroll-mt-24 text-center">
          <div
            className={`mb-4 inline-block rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-widest ${AMRAP_ACCENT.badge} ${AMRAP_ACCENT.badgeText}`}
          >
            2026 Sports Science Meta-Analysis
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight text-white md:text-6xl">
            Maximizing <span className="text-orange-500">Work Capacity</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/70">
            Redefining high-intensity functional training through the optimization of metabolic
            windows, interleaved recovery, and mechanical tension.
          </p>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-6 transition hover:border-orange-500/30">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/20 text-2xl">
                🔥
              </div>
              <h3 className="font-bold text-white">Metabolic Ceiling</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                Identifying the precise moment where intensity drops from threshold to steady-state.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-6 transition hover:border-teal-500/30">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/20 text-2xl">
                ⚖️
              </div>
              <h3 className="font-bold text-white">The Golden Ratio</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                Balancing muscular failure against systemic fatigue for maximum round density.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-6 transition hover:border-white/20">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-2xl">
                🧬
              </div>
              <h3 className="font-bold text-white">Hypertrophic Blend</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                A quantitative approach to mixing resistance, plyometrics, and gymnastics.
              </p>
            </div>
          </div>
        </section>

        {/* Pacing */}
        <section id="duration" className="scroll-mt-24 border-t border-white/10 pt-16">
          <div className="grid items-center gap-12 lg:grid-cols-5">
            <div className="lg:col-span-3 order-2 lg:order-1">
              <div className="rounded-3xl border border-white/10 bg-black/30 p-6 shadow-xl">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">Physiological Intensity Curve</h3>
                    <p className="text-sm text-white/50">Heart Rate % vs Duration (Minutes)</p>
                  </div>
                  <div className="flex rounded-xl bg-black/30 p-1">
                    <button
                      type="button"
                      onClick={() => setPacingMode('novice')}
                      className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                        pacingMode === 'novice' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'
                      }`}
                    >
                      Novice
                    </button>
                    <button
                      type="button"
                      onClick={() => setPacingMode('optimized')}
                      className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                        pacingMode === 'optimized' ? 'bg-orange-600 text-white' : 'text-white/50 hover:text-white'
                      }`}
                    >
                      Scientific
                    </button>
                  </div>
                </div>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={pacingData} margin={{ top: 8, right: 8, left: 8, bottom: 24 }}>
                      <XAxis
                        dataKey="min"
                        tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        label={{ value: 'Time (Minutes)', position: 'insideBottom', fill: 'rgba(255,255,255,0.5)', offset: -8 }}
                      />
                      <YAxis
                        domain={[40, 100]}
                        tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0d0500',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px',
                        }}
                        labelFormatter={(min) => `Minute ${min}`}
                        formatter={(value) => [value != null ? `${value}%` : '', 'HR']}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={pacingMode === 'optimized' ? '#ea580c' : '#78716c'}
                        strokeWidth={2}
                        dot={false}
                        fill={pacingMode === 'optimized' ? 'rgba(234,88,12,0.1)' : 'rgba(120,113,108,0.1)'}
                        fillOpacity={1}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div className="lg:col-span-2 space-y-8 order-1 lg:order-2">
              <h2 className="text-3xl font-extrabold leading-tight text-white">
                The 15–20 Minute <br />
                <span className="text-orange-500">Threshold Window</span>
              </h2>
              <div className="space-y-4">
                <div className="rounded-2xl border-l-4 border-red-500/80 bg-black/20 p-4">
                  <h4 className="font-bold text-white">The Redline Trap (&lt;10m)</h4>
                  <p className="mt-1 text-sm text-white/60">
                    Excessive lactate accumulation prevents recruitment of high-threshold motor units
                    in later phases.
                  </p>
                </div>
                <div className="rounded-2xl bg-orange-600 p-6 text-white shadow-lg transition hover:-translate-y-0.5">
                  <h4 className="text-lg font-bold">The Golden Window (15–20m)</h4>
                  <p className="mt-2 text-sm opacity-90">
                    Maximum VO2 stimulation and metabolic disturbance. Requires &quot;Negative
                    Split&quot; pacing to maintain output.
                  </p>
                </div>
                <div className="rounded-2xl border-l-4 border-teal-500/80 bg-black/20 p-4">
                  <h4 className="font-bold text-white">Aerobic Drift (&gt;20m)</h4>
                  <p className="mt-1 text-sm text-white/60">
                    Intensity naturally self-regulates downward to sub-threshold levels, reducing
                    hormonal response.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Composition */}
        <section id="exercises" className="scroll-mt-24 border-t border-white/10 py-16">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-extrabold text-white">The Hybrid Circuit Mix</h2>
            <p className="mx-auto mt-4 max-w-2xl text-white/60">
              The 2026 data indicates a specific algorithmic breakdown for exercise selection to
              maximize work without triggering localized muscle failure.
            </p>
          </div>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="flex flex-col items-center rounded-3xl border border-white/10 bg-black/30 p-8">
              <h3 className="mb-6 text-xs font-bold uppercase tracking-widest text-white/50">
                Volume Breakdown by Modality
              </h3>
              <div className="h-[320px] w-full max-w-sm">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 16, right: 16, bottom: 16, left: 16 }}>
                    <Pie
                      data={COMPOSITION_DATA}
                      cx="50%"
                      cy="50%"
                      innerRadius="60%"
                      outerRadius="80%"
                      paddingAngle={0}
                      dataKey="value"
                    >
                      {COMPOSITION_DATA.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip
                      content={<CompositionTooltip />}
                      contentStyle={{
                        backgroundColor: '#0d0500',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="grid gap-4">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-6 transition hover:border-orange-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/20 font-bold text-orange-400">
                      50%
                    </div>
                    <h4 className="font-bold text-white">Functional / Multi-joint</h4>
                  </div>
                  <span className="text-2xl">🏋️‍♂️</span>
                </div>
                <p className="mt-3 text-sm text-white/60">
                  Priority: Kettlebell Swings, Thrusters. Goal: 30-50% 1RM to maintain high RPM.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-6 transition hover:border-teal-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/20 font-bold text-teal-400">
                      25%
                    </div>
                    <h4 className="font-bold text-white">Bodyweight Conditioning</h4>
                  </div>
                  <span className="text-2xl">🤸</span>
                </div>
                <p className="mt-3 text-sm text-white/60">
                  Priority: Burpees, Air Squats. Role: Maintain HR above threshold during
                  &apos;rest&apos; intervals.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-6 transition hover:border-white/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 font-bold text-white/80">
                      25%
                    </div>
                    <h4 className="font-bold text-white">Power Plyometrics</h4>
                  </div>
                  <span className="text-2xl">⚡</span>
                </div>
                <p className="mt-3 text-sm text-white/60">
                  Priority: Box Jumps, Broad Jumps. Constraint: Keep reps &lt;8 to avoid eccentric
                  damage.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Sequencing */}
        <section
          id="sequencing"
          className="scroll-mt-24 rounded-[3rem] border border-white/10 bg-black/50 py-16 px-8 md:px-16"
        >
          <div className="mb-12 max-w-2xl">
            <h2 className="text-3xl font-extrabold text-white">The Antagonistic Flow</h2>
            <p className="mt-4 text-white/60">
              Localized fatigue is the enemy of AMRAP performance. Interleave muscle groups to
              allow <span className="text-orange-400">passive recovery</span> while intensity remains
              systemic.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-4">
            <div className="rounded-3xl border border-white/10 bg-black/30 p-8 transition hover:border-orange-500/50">
              <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-full bg-orange-600 font-bold text-white">
                1
              </div>
              <h4 className="font-bold text-white">Lower Push</h4>
              <p className="text-xs text-white/50">Goblet Squat</p>
              <div className="mt-4 border-t border-white/10 pt-4 text-[10px] font-bold uppercase text-orange-400">
                Upper Recovery
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/30 p-8 transition hover:border-teal-500/50">
              <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 font-bold text-white">
                2
              </div>
              <h4 className="font-bold text-white">Upper Pull</h4>
              <p className="text-xs text-white/50">Pull-up / Row</p>
              <div className="mt-4 border-t border-white/10 pt-4 text-[10px] font-bold uppercase text-teal-400">
                Lower Recovery
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/30 p-8 transition hover:border-orange-500/50">
              <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-full bg-orange-600 font-bold text-white">
                3
              </div>
              <h4 className="font-bold text-white">Core / Bridge</h4>
              <p className="text-xs text-white/50">KB Swings</p>
              <div className="mt-4 border-t border-white/10 pt-4 text-[10px] font-bold uppercase text-orange-400">
                Stabilization
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/30 p-8 transition hover:border-teal-500/50">
              <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 font-bold text-white">
                4
              </div>
              <h4 className="font-bold text-white">Upper Push</h4>
              <p className="text-xs text-white/50">Push-up / Press</p>
              <div className="mt-4 border-t border-white/10 pt-4 text-[10px] font-bold uppercase text-teal-400">
                Pull Recovery
              </div>
            </div>
          </div>
        </section>

        {/* Analysis */}
        <section id="template" className="scroll-mt-24 border-t border-white/10 py-16">
          <div className="grid gap-12 lg:grid-cols-3">
            <div className="flex flex-col items-center rounded-3xl border border-white/10 bg-black/30 p-8">
              <h3 className="mb-4 font-bold text-white">Efficiency Dashboard</h3>
              <Plot
                data={gaugeData}
                layout={gaugeLayout}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%', maxWidth: 280 }}
                useResizeHandler
                className="w-full"
              />
              <p className="mt-4 text-center text-xs leading-relaxed text-white/50">
                The optimal zone (85-92%) maximizes glycogen oxidation and mitochondrial biogenesis
                without overtaxing the CNS.
              </p>
            </div>
            <div className="lg:col-span-2 overflow-hidden rounded-3xl border border-white/10 bg-black/30">
              <div className="border-b border-white/10 bg-black/40 p-6">
                <h3 className="font-bold text-white">2026 Protocol Summary</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10">
                  <thead className="bg-black/20 text-left text-[10px] font-bold uppercase tracking-widest text-white/50">
                    <tr>
                      <th className="px-6 py-4">Metric</th>
                      <th className="px-6 py-4">Target</th>
                      <th className="px-6 py-4">Scientific Outcome</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 text-sm text-white/70">
                    <tr>
                      <td className="px-6 py-4 font-bold text-white">Duration</td>
                      <td className="px-6 py-4 font-bold text-orange-500">18m 00s</td>
                      <td className="px-6 py-4">Peak BDNF release and cortisol balance.</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 font-bold text-white">Loading</td>
                      <td className="px-6 py-4">40% 1RM</td>
                      <td className="px-6 py-4">Maintains muscular power output curves.</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 font-bold text-white">Rest</td>
                      <td className="px-6 py-4">0s (Transitions)</td>
                      <td className="px-6 py-4">Keeps cardiac output above 140bpm.</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 font-bold text-white">Rep Range</td>
                      <td className="px-6 py-4">10–12 reps</td>
                      <td className="px-6 py-4">Maximizes time under tension within round.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="no-print border-t border-white/10 pt-12 text-center">
          <p className="text-sm text-white/50">© 2026 Sports Science Institute. All rights reserved.</p>
          <p className="mx-auto mt-2 max-w-xl text-[10px] italic text-white/40">
            Data generated from simulated high-intensity physiological models. Consult a medical
            professional before engaging in protocols reaching &gt;90% heart rate max.
          </p>
        </footer>
      </div>
    </IntervalTimerLanding>
  );
}
