import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import IntervalTimerLanding from './IntervalTimerLanding';
import IntervalTimerOverlay from './IntervalTimerOverlay';
import type { IntervalTimerPage } from './intervalTimerProtocols';
import { getProtocolAccent } from './intervalTimerProtocols';
import type { HIITTimelineBlock } from '@/types/ai-workout';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';

interface TenTwentyThirtyIntervalProps {
  onNavigate: (page: IntervalTimerPage) => void;
}

type MetricType = 'vo2_improvement' | 'effort_perception';
type SimMode = 'all_out' | 'submaximal';

interface SimContent {
  color: string;
  bgColor: string;
  borderColor: string;
  phase: string;
  status: string;
  instruction: string;
  quote: string;
  icon: string;
}

const ACCENT = getProtocolAccent('10-20-30');

const TenTwentyThirtyInterval: React.FC<TenTwentyThirtyIntervalProps> = ({ onNavigate }) => {
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isTimerOpen, setIsTimerOpen] = useState(false);
  const [isDurationSelectOpen, setIsDurationSelectOpen] = useState(false);
  const [totalCycles, setTotalCycles] = useState(5);

  const tenTwentyThirtyTimeline = useMemo<HIITTimelineBlock[]>(() => {
    const blocks: HIITTimelineBlock[] = [
      { type: 'warmup', duration: 10, name: 'Get Ready', notes: 'Starting 30-20-10' },
    ];
    for (let i = 0; i < totalCycles; i++) {
      blocks.push({
        type: 'work',
        duration: 30,
        name: '30s LOW',
        notes: 'Easy Pace (Jog/Spin)',
      });
      blocks.push({
        type: 'work',
        duration: 20,
        name: '20s MODERATE',
        notes: 'Tempo Pace (Run/Push)',
      });
      blocks.push({
        type: 'work',
        duration: 10,
        name: '10s FAST',
        notes: 'Sprint (80-90% Effort)',
      });
    }
    return blocks;
  }, [totalCycles]);

  const [metric, setMetric] = useState<MetricType>('vo2_improvement');

  const impactData = [
    { name: 'Steady State', vo2_improvement: 2, effort_perception: 40 },
    { name: '100% Sprint', vo2_improvement: 8, effort_perception: 95 },
    { name: '80% Sprint', vo2_improvement: 7, effort_perception: 60 },
  ];

  const [simMode, setSimMode] = useState<SimMode>('submaximal');
  const [intensityData, setIntensityData] = useState<{ time: number; value: number }[]>([]);

  useEffect(() => {
    const generateSteps = () => {
      const data: { time: number; value: number }[] = [];
      const peak = simMode === 'all_out' ? 190 : 160;

      for (let i = 0; i < 60; i++) {
        let val = 60; // Low
        if (i >= 30 && i < 50) val = 120; // Moderate
        if (i >= 50) val = peak; // High

        data.push({ time: i, value: val + Math.random() * 5 });
      }
      return data;
    };
    setIntensityData(generateSteps());
  }, [simMode]);

  const simContent: Record<SimMode, SimContent> = {
    submaximal: {
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-600',
      borderColor: 'border-cyan-300',
      phase: 'Copenhagen Style',
      status: '80% Controlled Sprint',
      instruction:
        'The breakthrough finding. You only need to reach ~80% of your max speed during the 10s phase to get nearly identical VO2 max gains. This makes the workout enjoyable, not scary.',
      quote: 'Fast, but under control.',
      icon: '🧊',
    },
    all_out: {
      color: 'text-red-500',
      bgColor: 'bg-red-600',
      borderColor: 'border-red-300',
      phase: 'Old School',
      status: '100% Max Effort',
      instruction:
        "The original interpretation. Going 100% on the 10-second sprint is brutally hard and increases the 'dread factor'. Effective, but harder to stick to long-term.",
      quote: 'Maximum suffering.',
      icon: '🥵',
    },
  };

  const currentSim = simContent[simMode];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);

  const animateVisualizer = (time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      requestRef.current = requestAnimationFrame(animateVisualizer);
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      requestRef.current = requestAnimationFrame(animateVisualizer);
      return;
    }

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);

    const loopTime = 6000;
    const progress = (time % loopTime) / loopTime;

    let currentZone = 0;
    let zoneColor = '#94a3b8';

    if (progress < 0.5) {
      currentZone = 0;
      zoneColor = '#94a3b8';
    } else if (progress < 0.833) {
      currentZone = 1;
      zoneColor = '#facc15';
    } else {
      currentZone = 2;
      zoneColor = simMode === 'all_out' ? '#ef4444' : '#22d3ee';
    }

    ctx.beginPath();
    ctx.arc(centerX, centerY, 100, Math.PI, 0);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 20;
    ctx.stroke();

    const maxAngles = [Math.PI + Math.PI * 0.33, Math.PI + Math.PI * 0.66, 0];
    const targetAngle = maxAngles[currentZone];

    ctx.beginPath();
    ctx.arc(centerX, centerY, 100, Math.PI, targetAngle);
    ctx.strokeStyle = zoneColor;
    ctx.lineWidth = 20;
    ctx.stroke();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(targetAngle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-80, 0);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();

    ctx.font = 'bold 24px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    const labels = ['30s LOW', '20s MOD', '10s FAST'];
    ctx.fillText(labels[currentZone], centerX, centerY + 40);

    requestRef.current = requestAnimationFrame(animateVisualizer);
  };

  useLayoutEffect(() => {
    requestRef.current = requestAnimationFrame((t) => animateVisualizer(t));
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    };
  }, [simMode]);

  const startTimer = (blocks: number) => {
    setTotalCycles(blocks * 5);
    setIsDurationSelectOpen(false);
    setIsTimerOpen(true);
  };

  useEffect(() => {
    if (isDurationSelectOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isDurationSelectOpen]);

  return (
    <>
      <IntervalTimerLanding currentProtocol="10-20-30" onNavigate={onNavigate} accentTheme={ACCENT}>
        {/* HERO */}
        <section className="mx-auto max-w-4xl pt-8 text-center">
          <h1 className="font-display mb-6 text-4xl font-bold leading-tight text-white md:text-6xl">
            The <span className="text-cyan-400">Copenhagen</span> Method
          </h1>
          <p className="mb-10 text-xl leading-relaxed text-white/80">
            <strong>10-20-30</strong>. The protocol that replaced &quot;30-30-30&quot; for runners
            and cyclists. 30s low, 20s moderate, 10s fast. Repeat for 5 minutes. The key discovery?
            You only need <strong>80% effort</strong> on the sprint to get maximum results.
          </p>
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() =>
                document.getElementById('simulator')?.scrollIntoView({ behavior: 'smooth' })
              }
              className="rounded-xl bg-orange-light px-8 py-3 font-bold text-black shadow-lg transition-transform hover:-translate-y-1"
            >
              Start Protocol
            </button>
          </div>
        </section>

        {/* SECTION 1: DATA */}
        <section className="rounded-3xl border border-white/10 bg-black/30 p-8 shadow-sm md:p-12">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <div
                className={`mb-4 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase ${ACCENT.badge} ${ACCENT.badgeText}`}
              >
                The Breakout Study
              </div>
              <h2 className="font-display mb-4 text-3xl font-bold text-white">The 80% Rule</h2>
              <p className="mb-6 leading-relaxed text-white/80">
                Led by Prof. Jens Bangsbo at the University of Copenhagen, recent studies found that
                participants sprinting at just 80% effort saw nearly identical VO2 max improvements
                (+7%) and 5K time reductions as those going 100% all-out. This killed the &quot;fear
                of the sprint.&quot;
              </p>
            </div>

            <div>
              <div className="mb-6 flex items-center justify-between">
                <h3 className="font-bold text-white/90">Submaximal Success</h3>
                <div className="flex rounded-lg bg-black/30 p-1">
                  <button
                    type="button"
                    onClick={() => setMetric('vo2_improvement')}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition ${metric === 'vo2_improvement' ? 'bg-cyan-500 text-white' : 'text-white/60'}`}
                  >
                    VO2 Gains
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetric('effort_perception')}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition ${metric === 'effort_perception' ? 'bg-red-600 text-white' : 'text-white/60'}`}
                  >
                    Perceived Pain
                  </button>
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={impactData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="rgba(255,255,255,0.1)"
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.7)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide />
                    <Tooltip
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{
                        borderRadius: '8px',
                        background: '#0d0500',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                    />
                    <Bar dataKey={metric} radius={[6, 6, 0, 0]}>
                      {impactData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            metric === 'vo2_improvement' && index === 2
                              ? '#22d3ee'
                              : metric === 'effort_perception' && index === 2
                                ? '#059669'
                                : 'rgba(148,163,184,0.5)'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: SIMULATOR */}
        <section id="simulator" className="space-y-8">
          <div className="text-center">
            <div
              className={`mb-4 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase ${ACCENT.badge} ${ACCENT.badgeText}`}
            >
              Flow Simulator
            </div>
            <h2 className="font-display text-3xl font-bold text-white">30 - 20 - 10</h2>
            <p className="mt-2 text-white/70">Continuous motion. Changing gears.</p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/30 shadow-xl">
            <div
              className={`flex items-center justify-between p-6 text-white transition-colors duration-200 ${currentSim.bgColor}`}
            >
              <div>
                <div className="mb-1 text-xs font-bold uppercase tracking-widest opacity-90">
                  {currentSim.status}
                </div>
                <h3 className="font-display text-2xl font-bold">{currentSim.phase}</h3>
              </div>
              <div className="font-mono text-3xl opacity-90">1 Minute Loop</div>
            </div>

            <div className="grid md:grid-cols-2">
              <div className="border-b border-white/10 p-8 md:border-b-0 md:border-r">
                <div className="mb-6 h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={intensityData}>
                      <YAxis domain={[0, 200]} hide />
                      <Line
                        type="step"
                        dataKey="value"
                        stroke={simMode === 'all_out' ? '#ef4444' : '#22d3ee'}
                        strokeWidth={3}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className={`rounded-xl border-l-4 bg-black/20 p-4 ${currentSim.borderColor}`}>
                  <h4 className="mb-2 font-bold text-white">Instructions</h4>
                  <p className="text-sm leading-relaxed text-white/80">{currentSim.instruction}</p>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center bg-black/20 p-8 text-center">
                <div className="mb-6 text-6xl">{currentSim.icon}</div>
                <blockquote className="font-display mb-8 text-xl font-bold italic text-white/90">
                  &quot;{currentSim.quote}&quot;
                </blockquote>
                <div className="flex w-full justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => setSimMode('submaximal')}
                    className={`w-1/2 rounded-xl font-bold transition-all ${simMode === 'submaximal' ? 'scale-105 bg-cyan-500 text-white shadow-lg' : 'border border-white/20 bg-transparent text-white/70 hover:text-white'}`}
                  >
                    80% EFFORT
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimMode('all_out')}
                    className={`w-1/2 rounded-xl font-bold transition-all ${simMode === 'all_out' ? 'scale-105 bg-red-600 text-white shadow-lg' : 'border border-white/20 bg-transparent text-white/70 hover:text-white'}`}
                  >
                    100% EFFORT
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 text-center">
            <button
              type="button"
              onClick={() => setIsDurationSelectOpen(true)}
              className="mx-auto flex items-center gap-3 rounded-full bg-cyan-500 px-8 py-4 font-bold text-white shadow-2xl transition-all hover:scale-105 hover:bg-cyan-600"
            >
              <span>⏱️</span>
              <span>Launch 10-20-30 Timer</span>
            </button>
          </div>
        </section>

        {/* SECTION 3: VISUALIZER */}
        <section className="grid items-center gap-12 rounded-3xl border border-white/10 bg-black/30 p-8 shadow-2xl md:grid-cols-2 md:p-12">
          <div>
            <h2 className="font-display mb-6 text-3xl font-bold text-white">The Stepped Gauge</h2>
            <p className="mb-6 leading-relaxed text-white/80">
              The visualizer shows the three distinct gears of the workout. 30s at low gear (slate),
              20s at moderate gear (yellow), and 10s at high gear (cyan). It&apos;s a continuous
              flow, not a stop-and-start.
            </p>
            <button
              type="button"
              onClick={() => setIsReportOpen(true)}
              className="flex items-center gap-2 border-b border-cyan-400/40 pb-0.5 text-sm font-bold text-cyan-400 transition-colors hover:text-cyan-300"
            >
              <span>Read Clinical Review</span>
              <span>→</span>
            </button>
          </div>
          <div className="relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/50 p-8">
            <canvas ref={canvasRef} width={300} height={300} className="relative z-10 max-w-full" />
          </div>
        </section>
      </IntervalTimerLanding>

      {/* SETUP MODAL */}
      {typeof document !== 'undefined' &&
        isDurationSelectOpen &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden bg-transparent p-4">
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setIsDurationSelectOpen(false)}
              aria-hidden
            />
            <div className="animate-zoom-in relative flex max-h-[calc(100vh-2rem)] w-full max-w-md shrink-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-bg-dark shadow-2xl">
              <div className="shrink-0 border-b border-white/10 p-6 text-center">
                <h3 className="font-display text-xl font-bold text-white">Select Volume</h3>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
                <button
                  type="button"
                  onClick={() => startTimer(1)}
                  className="group w-full rounded-xl border-2 border-white/10 p-4 text-left transition-all hover:border-cyan-500 hover:bg-black/30"
                >
                  <div className="text-lg font-bold text-white">1 Block (5 Mins)</div>
                  <div className="text-xs font-medium text-white/50">5 x (30-20-10) Cycles</div>
                </button>
                <button
                  type="button"
                  onClick={() => startTimer(2)}
                  className="group w-full rounded-xl border-2 border-white/10 p-4 text-left transition-all hover:border-cyan-500 hover:bg-black/30"
                >
                  <div className="text-lg font-bold text-white">2 Blocks (10 Mins)</div>
                  <div className="text-xs font-medium text-white/50">10 x (30-20-10) Cycles</div>
                </button>
                <button
                  type="button"
                  onClick={() => startTimer(3)}
                  className="group w-full rounded-xl border-2 border-white/10 p-4 text-left transition-all hover:border-cyan-500 hover:bg-black/30"
                >
                  <div className="text-lg font-bold text-white">3 Blocks (15 Mins)</div>
                  <div className="text-xs font-medium text-white/50">15 x (30-20-10) Cycles</div>
                </button>
              </div>
              <div className="shrink-0 border-t border-white/10 bg-black/30 p-4 text-center">
                <button
                  type="button"
                  onClick={() => setIsDurationSelectOpen(false)}
                  className="text-sm font-bold text-white/50 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* TIMER OVERLAY */}
      {typeof document !== 'undefined' &&
        isTimerOpen &&
        tenTwentyThirtyTimeline.length > 0 &&
        createPortal(
          <IntervalTimerOverlay
            timeline={tenTwentyThirtyTimeline}
            onClose={() => setIsTimerOpen(false)}
            theme={{ workBg: ACCENT.workBg }}
          />,
          document.body
        )}

      {/* INFO MODAL */}
      {isReportOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsReportOpen(false)}
            aria-hidden
          />
          <div className="animate-zoom-in relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-bg-dark shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 p-6">
              <h3 className="font-display text-xl font-bold text-white">The 10-20-30 Method</h3>
              <button
                type="button"
                onClick={() => setIsReportOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 font-bold text-white hover:bg-cyan-600/20 hover:text-cyan-400"
              >
                &times;
              </button>
            </div>
            <div className="prose prose-invert max-w-none overflow-y-auto p-8 text-white/80">
              <p>Originated by Professor Jens Bangsbo at the University of Copenhagen.</p>
              <h4 className="font-bold text-cyan-500">The Format</h4>
              <p>
                1 Minute Intervals split into: 30s Low, 20s Moderate, 10s Fast. Repeat 5 times for a
                5-minute block.
              </p>
              <h4 className="font-bold text-cyan-500">Why it works</h4>
              <p>
                The changing pace forces the body to constantly adapt heart rate and muscle
                recruitment. The 2025/2026 breakout finding showed that you do NOT need to sprint at
                100% max effort. 80% effort during the 10s phase yields nearly identical health
                benefits, making this protocol highly sustainable.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TenTwentyThirtyInterval;
