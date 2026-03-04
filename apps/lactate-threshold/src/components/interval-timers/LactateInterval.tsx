import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  IntervalTimerLanding,
  IntervalTimerOverlay,
  IntervalTimerSetupModal,
  useWarmupConfig,
  type WarmupExercise,
} from '@interval-timers/timer-ui';
import type { IntervalTimerPage } from '@interval-timers/timer-core';
import { getProtocolAccent } from '@interval-timers/timer-core';
import type { HIITTimelineBlock } from '@interval-timers/types';
import { getDefaultWarmupBlock, getSetupBlock } from '@interval-timers/timer-core';
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

interface LactateIntervalProps {
  onNavigate?: (page: IntervalTimerPage) => void;
  onNavigateToLanding?: () => void;
}

type MetricType = 'endurance' | 'tolerance';
type SimMode = 'work' | 'rest';

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

const ACCENT = getProtocolAccent('lactate');

const LactateInterval: React.FC<LactateIntervalProps> = ({ onNavigate, onNavigateToLanding }) => {
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isTimerOpen, setIsTimerOpen] = useState(false);
  const [totalCycles, setTotalCycles] = useState(10);
  const [includeWarmup, setIncludeWarmup] = useState(false);
  const [frozenWarmup, setFrozenWarmup] = useState<{
    exercises: WarmupExercise[];
    durationPerExercise: number;
  } | null>(null);

  const { exercises, durationPerExercise } = useWarmupConfig();

  const lactateTimeline = useMemo<HIITTimelineBlock[]>(() => {
    const blocks: HIITTimelineBlock[] = [];
    if (frozenWarmup) {
      blocks.push(getDefaultWarmupBlock());
    }
    blocks.push(getSetupBlock());
    for (let i = 0; i < totalCycles; i++) {
      blocks.push({
        type: 'work',
        duration: 40,
        name: 'THE GRIND',
        notes: '40s Lactate Threshold',
      });
      blocks.push({
        type: 'rest',
        duration: 20,
        name: 'BREATHE',
        notes: '20s Incomplete Rest',
      });
    }
    blocks.push({ type: 'cooldown', duration: 180, name: 'Cool Down', notes: 'Flush the system' });
    return blocks;
  }, [totalCycles, frozenWarmup]);

  const startWithCycles = (cycles: number) => {
    setTotalCycles(cycles);
    setIsSetupOpen(false);
    if (includeWarmup) {
      setFrozenWarmup({ exercises: [...exercises], durationPerExercise });
    } else {
      setFrozenWarmup(null);
    }
    setIsTimerOpen(true);
  };

  const [metric, setMetric] = useState<MetricType>('tolerance');

  const impactData = [
    { name: 'Steady', endurance: 10, tolerance: 2 },
    { name: '1:1 Ratio', endurance: 20, tolerance: 15 },
    { name: '2:1 Ratio', endurance: 25, tolerance: 30 },
  ];

  const [simMode, setSimMode] = useState<SimMode>('work');
  const [intensityData, setIntensityData] = useState<{ time: number; value: number }[]>([]);

  useEffect(() => {
    const base = simMode === 'work' ? 160 : 130;
    const initialData = Array.from({ length: 30 }, (_, i) => ({
      time: i,
      value: base + (Math.random() * 5 - 2.5),
    }));
    queueMicrotask(() => setIntensityData(initialData));

    const interval = setInterval(() => {
      setIntensityData((prev) => {
        const newData = [...prev.slice(1)];
        const lastTime = prev[prev.length - 1].time;
        const creep = simMode === 'work' ? 0.5 : -0.5;
        const lastValue = prev[prev.length - 1].value;
        let newValue = lastValue + creep + (Math.random() * 4 - 2);
        if (simMode === 'work' && newValue > 190) newValue = 190;
        if (simMode === 'rest' && newValue < 110) newValue = 110;
        newData.push({ time: lastTime + 1, value: newValue });
        return newData;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [simMode]);

  const simContent: Record<SimMode, SimContent> = {
    work: {
      color: 'text-amber-600',
      bgColor: 'bg-amber-600',
      borderColor: 'border-amber-200',
      phase: 'Lactate Accumulation',
      status: 'The Grind (40 Secs)',
      instruction:
        'Maintain high output despite the burning sensation. Your body is flooding with hydrogen ions. Your goal is to keep moving efficiently while your muscles scream stop.',
      quote: 'Embrace the burn. That is the adaptation.',
      icon: '🔥',
    },
    rest: {
      color: 'text-slate-600',
      bgColor: 'bg-slate-600',
      borderColor: 'border-slate-200',
      phase: 'Incomplete Flush',
      status: 'Short Recovery (20 Secs)',
      instruction:
        '20 seconds is not enough to recover fully. That is the point. Breathe explosively to offload CO2. Do not stop moving.',
      quote: 'Stay in the fight. Do not let the HR drop too low.',
      icon: '😤',
    },
  };

  const currentSim = simContent[simMode];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const animateRef = useRef<(time: number) => void>(() => {});
  const [isTelemetryEnabled, setIsTelemetryEnabled] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const toggleTelemetryAudio = () => {
    const nextEnabled = !isTelemetryEnabled;
    if (nextEnabled) {
      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      let ctx = audioContextRef.current;
      if (!ctx || ctx.state === 'closed') {
        audioContextRef.current = new AudioContextCtor();
        ctx = audioContextRef.current;
      }
      ctx
        ?.resume()
        .then(() => setIsTelemetryEnabled(true))
        .catch(() => {});
    } else {
      audioContextRef.current?.suspend()?.catch(() => {});
      setIsTelemetryEnabled(false);
    }
  };

  useEffect(() => {
    return () => {
      const ctx = audioContextRef.current;
      if (ctx) {
        ctx.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, []);

  const animateVisualizer = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      requestRef.current = requestAnimationFrame((t) => animateRef.current(t));
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      requestRef.current = requestAnimationFrame((t) => animateRef.current(t));
      return;
    }

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);

    const cycleDuration = 1000;
    const phase = (time % cycleDuration) / cycleDuration;
    const jagged = Math.random() * 0.2 + Math.sin(phase * Math.PI * 4) * 0.1;

    const baseRadius = width * 0.25;
    const expansion = simMode === 'work' ? 70 : 30;
    const radius = baseRadius + expansion + jagged * 50;

    const gradient = ctx.createRadialGradient(
      centerX,
      centerY,
      radius * 0.4,
      centerX,
      centerY,
      radius
    );
    if (simMode === 'work') {
      gradient.addColorStop(0, 'rgba(217, 119, 6, 0.9)');
      gradient.addColorStop(1, 'rgba(217, 119, 6, 0)');
    } else {
      gradient.addColorStop(0, 'rgba(71, 85, 105, 0.7)');
      gradient.addColorStop(1, 'rgba(71, 85, 105, 0)');
    }

    ctx.beginPath();
    const spikes = 20;
    for (let i = 0; i < spikes; i++) {
      const angle = ((Math.PI * 2) / spikes) * i;
      const r = i % 2 === 0 ? radius : radius * 0.9;
      const x = centerX + Math.cos(angle + time / 500) * r;
      const y = centerY + Math.sin(angle + time / 500) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = simMode === 'work' ? '#78350f' : '#1e293b';
    ctx.fill();

    ctx.font = 'bold 24px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(simMode === 'work' ? 'GRIT' : 'HOLD', centerX, centerY - 10);

    ctx.font = '14px Inter';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(simMode === 'work' ? 'Lactate +' : 'Clear -', centerX, centerY + 15);

    requestRef.current = requestAnimationFrame((t) => animateRef.current(t));
  }, [simMode]);

  useEffect(() => {
    animateRef.current = animateVisualizer;
  }, [animateVisualizer]);

  useLayoutEffect(() => {
    requestRef.current = requestAnimationFrame((t) => animateVisualizer(t));
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    };
  }, [animateVisualizer]);

  const durationContent = (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
        <h3 className="mb-1 font-bold text-white">Before you start</h3>
        <p className="mb-3 text-xs text-white/70">
          Daily Warm-Up prepares joints and muscles. Recommended before high-intensity intervals.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setIncludeWarmup(true)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
              includeWarmup
                ? 'border-[#ffbf00] bg-[#ffbf00]/20 text-[#ffbf00]'
                : 'border-white/10 bg-black/20 text-white/70 hover:border-white/20 hover:text-white'
            }`}
          >
            Include Warm-Up (~14 min)
          </button>
          <button
            type="button"
            onClick={() => setIncludeWarmup(false)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
              !includeWarmup
                ? 'border-[#ffbf00] bg-[#ffbf00]/20 text-[#ffbf00]'
                : 'border-white/10 bg-black/20 text-white/70 hover:border-white/20 hover:text-white'
            }`}
          >
            Skip, go straight to Lactate Threshold
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => startWithCycles(10)}
        className="group w-full rounded-xl border-2 border-white/10 p-4 text-left transition-all hover:border-amber-500 hover:bg-amber-600/20"
      >
        <div className="text-lg font-bold text-white">Quick Burn (10 Mins)</div>
        <div className="text-xs font-medium text-white/60">10 Cycles • High Intensity focus</div>
      </button>
      <button
        type="button"
        onClick={() => startWithCycles(20)}
        className="group w-full rounded-xl border-2 border-white/10 p-4 text-left transition-all hover:border-amber-500 hover:bg-amber-600/20"
      >
        <div className="text-lg font-bold text-white">Standard (20 Mins)</div>
        <div className="text-xs font-medium text-white/60">20 Cycles • Optimal Conditioning</div>
      </button>
      <button
        type="button"
        onClick={() => startWithCycles(30)}
        className="group w-full rounded-xl border-2 border-white/10 p-4 text-left transition-all hover:border-amber-500 hover:bg-amber-600/20"
      >
        <div className="text-lg font-bold text-white">Sufferfest (30 Mins)</div>
        <div className="text-xs font-medium text-white/60">30 Cycles • Advanced Only</div>
      </button>
    </div>
  );

  return (
    <>
      <IntervalTimerLanding
        currentProtocol="lactate"
        onNavigate={onNavigate}
        onNavigateToLanding={onNavigateToLanding}
        accentTheme={ACCENT}
        standalone={onNavigate == null}
        brandLabel="AI Fitness Guy"
      >
        {/* HERO */}
        <section className="mx-auto max-w-4xl pt-8 text-center">
          <h1 className="font-display mb-6 text-4xl font-bold leading-tight text-white md:text-6xl">
            Conditioning <span className="text-amber-400">Grit</span>
          </h1>
          <img
            src={`${import.meta.env.BASE_URL}logo_transparent_500x500.png`}
            alt="Interval Timers"
            className="mx-auto mb-10 h-28 w-28 object-contain md:h-36 md:w-36"
          />
          <p className="mb-10 text-xl leading-relaxed text-white/80">
            The <strong>2:1 Work-to-Rest Ratio</strong> (40s Work / 20s Rest). This protocol is
            designed to flood the muscles with lactate, forcing the body to become efficient at
            clearing waste products while under load.
          </p>
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() =>
                document.getElementById('simulator')?.scrollIntoView({ behavior: 'smooth' })
              }
              className="rounded-xl bg-[#ffbf00] px-8 py-3 font-bold text-black shadow-lg transition-transform hover:-translate-y-1"
            >
              Enter The Grind
            </button>
          </div>
        </section>

        {/* SECTION 1: IMPACT DATA */}
        <section className="rounded-3xl border border-white/10 bg-black/30 p-8 shadow-sm md:p-12">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <div
                className={`mb-4 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase ${ACCENT.badge} ${ACCENT.badgeText}`}
              >
                Physiological Target
              </div>
              <h2 className="font-display mb-4 text-3xl font-bold text-white">Lactate Tolerance</h2>
              <p className="mb-6 leading-relaxed text-white/80">
                By doubling the work time relative to rest, you create a &quot;debt&quot; that
                cannot be fully repaid in 20 seconds. This creates a high-acidity environment in the
                muscle tissue. Training in this zone improves your <strong>Pain Tolerance</strong>{' '}
                and mental resilience.
              </p>
            </div>

            <div>
              <div className="mb-6 flex items-center justify-between">
                <h3 className="font-bold text-white/90">Comparative Output</h3>
                <div className="flex rounded-lg bg-black/30 p-1">
                  <button
                    type="button"
                    onClick={() => setMetric('tolerance')}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition ${metric === 'tolerance' ? 'bg-amber-600 text-white' : 'text-white/60'}`}
                  >
                    Pain Tolerance
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetric('endurance')}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition ${metric === 'endurance' ? 'bg-slate-600 text-white' : 'text-white/60'}`}
                  >
                    Endurance
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
                      {impactData.map((_entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            metric === 'tolerance'
                              ? '#d97706'
                              : index === 2
                                ? '#475569'
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
              2:1 Simulator
            </div>
            <h2 className="font-display text-3xl font-bold text-white">40s Work / 20s Rest</h2>
            <p className="mt-2 text-white/70">Maximum accumulation. Minimal clearance.</p>
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
              <div className="font-mono text-3xl opacity-90">
                {simMode === 'work' ? '00:40' : '00:20'}
              </div>
            </div>

            <div className="grid md:grid-cols-2">
              <div className="border-b border-white/10 p-8 md:border-b-0 md:border-r">
                <div className="mb-6 h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={intensityData}>
                      <YAxis domain={[0, 200]} hide />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={simMode === 'work' ? '#d97706' : '#475569'}
                        strokeWidth={3}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className={`rounded-xl border-l-4 bg-black/20 p-4 ${currentSim.borderColor}`}>
                  <h4 className="mb-2 font-bold text-white">Mental State</h4>
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
                    onClick={() => setSimMode('work')}
                    className={`w-1/2 rounded-xl font-bold transition-all ${simMode === 'work' ? 'scale-105 bg-amber-600 text-white shadow-lg' : 'border border-white/20 bg-transparent text-white/70 hover:text-white'}`}
                  >
                    40s GRIND
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimMode('rest')}
                    className={`w-1/2 rounded-xl font-bold transition-all ${simMode === 'rest' ? 'scale-105 bg-slate-600 text-white shadow-lg' : 'border border-white/20 bg-transparent text-white/70 hover:text-white'}`}
                  >
                    20s HOLD
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 text-center">
            <button
              type="button"
              onClick={() => {
                setIncludeWarmup(false);
                setIsSetupOpen(true);
              }}
              className="mx-auto flex items-center gap-3 rounded-full bg-[#ffbf00] px-8 py-4 font-bold text-black shadow-2xl transition-all hover:scale-105"
            >
              <span>⏱️</span>
              <span>Launch 2:1 Timer</span>
            </button>
          </div>
        </section>

        {/* SECTION 3: VISUALIZER */}
        <section className="grid items-center gap-12 rounded-3xl border border-white/10 bg-black/30 p-8 shadow-2xl md:grid-cols-2 md:p-12">
          <div>
            <h2 className="font-display mb-6 text-3xl font-bold text-white">
              Visualizing The Burn
            </h2>
            <p className="mb-6 leading-relaxed text-white/80">
              The visualizer represents the jagged, uncomfortable nature of training at threshold.
              Unlike the smooth waves of aerobic power, this is about sustaining effort through
              discomfort.
            </p>
            <button
              type="button"
              onClick={() => setIsReportOpen(true)}
              className="flex items-center gap-2 border-b border-amber-400/40 pb-0.5 text-sm font-bold text-amber-400 transition-colors hover:text-amber-300"
            >
              <span>Protocol Details</span>
              <span>→</span>
            </button>
          </div>
          <div className="relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/50 p-8">
            <canvas ref={canvasRef} width={300} height={300} className="relative z-10 max-w-full" />
            <button
              type="button"
              onClick={toggleTelemetryAudio}
              className="absolute right-4 top-4 z-20 text-white/60 transition-colors hover:text-white"
              aria-label={isTelemetryEnabled ? 'Disable telemetry audio' : 'Enable telemetry audio'}
              aria-pressed={isTelemetryEnabled}
            >
              {isTelemetryEnabled ? '🔊' : '🔇'}
            </button>
          </div>
        </section>
      </IntervalTimerLanding>

      <IntervalTimerSetupModal
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
        step="protocol"
        protocolTitle="Select Duration"
        protocolSubtitle="Choose how many 40/20 cycles"
        workoutTitle=""
        workoutSubtitle=""
        onBack={() => {}}
        protocolContent={durationContent}
        workoutContent={<div />}
      />

      {typeof document !== 'undefined' &&
        isTimerOpen &&
        lactateTimeline.length > 0 &&
        createPortal(
          <IntervalTimerOverlay
            timeline={lactateTimeline}
            onClose={() => {
              setFrozenWarmup(null);
              setIsTimerOpen(false);
            }}
            theme={{ workBg: ACCENT.workBg }}
            warmupExercises={frozenWarmup?.exercises}
            warmupDurationPerExercise={frozenWarmup?.durationPerExercise}
          />,
          document.body
        )}

      {isReportOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsReportOpen(false)}
            aria-hidden
          />
          <div className="animate-zoom-in relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0d0500] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 p-6">
              <h3 className="font-display text-xl font-bold text-white">
                2:1 Ratio (Lactate Threshold)
              </h3>
              <button
                type="button"
                onClick={() => setIsReportOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 font-bold text-white hover:bg-amber-600/20 hover:text-amber-400"
                aria-label="Close protocol details"
              >
                &times;
              </button>
            </div>
            <div className="prose prose-invert max-w-none overflow-y-auto p-8 text-white/80">
              <p>The 40/20 protocol is designed to train your lactate buffering capacity.</p>
              <h4>Why 40 seconds?</h4>
              <p>
                40 seconds drives the muscle into a state of high acidity. The 20 second rest is
                intentionally too short to allow for full clearance.
              </p>
              <p>
                Over time, your body adapts by producing more monocarboxylate transporters (MCTs)
                which clear lactate from the blood more efficiently.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LactateInterval;
