import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  IntervalTimerLanding,
  IntervalTimerOverlay,
  useWarmupConfig,
  type WarmupExercise,
} from '@interval-timers/timer-ui';
import IntervalTimerSetupModal from './IntervalTimerSetupModal';
import type { IntervalTimerPage } from '@interval-timers/timer-core';
import { getProtocolAccent } from '@interval-timers/timer-core';
import type { HIITTimelineBlock } from '@interval-timers/types';
import { getDefaultWarmupBlock, getSetupBlock } from '@interval-timers/timer-core';
import { useTabataSetup } from './useTabataSetup';
import { TabataProtocolStep, TabataWorkoutStep } from './TabataSetupContent';
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

interface TabataTimerProps {
  onNavigate: (page: IntervalTimerPage) => void;
}

type MetricType = 'aerobic' | 'anaerobic';
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

const TABATA_ACCENT = getProtocolAccent('tabata');

const TabataInterval: React.FC<TabataTimerProps> = ({ onNavigate }) => {
  const [isReportOpen, setIsReportOpen] = useState(false);

  // --- REAL TIMER STATE ---
  const [isTimerOpen, setIsTimerOpen] = useState(false);
  const [totalCycles, setTotalCycles] = useState(8);
  const [currentWorkoutPlan, setCurrentWorkoutPlan] = useState<string[]>([]);
  const [frozenWarmup, setFrozenWarmup] = useState<{
    exercises: WarmupExercise[];
    durationPerExercise: number;
  } | null>(null);

  const { exercises, durationPerExercise } = useWarmupConfig();

  const setup = useTabataSetup((result) => {
    setTotalCycles(result.cycles);
    setCurrentWorkoutPlan(result.workoutList);
    setFrozenWarmup({ exercises: [...exercises], durationPerExercise });
    setIsTimerOpen(true);
  });

  const audioContextRef = useRef<AudioContext | null>(null);

  /** Timeline for shared overlay: default warmup (10 min from interval-timer-warmup), then totalCycles × (work 20s + rest 10s), then cooldown 120s. */
  const tabataTimeline = useMemo<HIITTimelineBlock[]>(() => {
    const blocks: HIITTimelineBlock[] = [getDefaultWarmupBlock(), getSetupBlock()];
    for (let i = 0; i < totalCycles; i++) {
      const workName =
        currentWorkoutPlan.length > 0
          ? currentWorkoutPlan[i % currentWorkoutPlan.length]
          : 'SPRINT';
      blocks.push({ type: 'work', duration: 20, name: workName, notes: 'Maximum Effort' });
      blocks.push({ type: 'rest', duration: 10, name: 'Rest', notes: 'Breathe Deeply' });
    }
    blocks.push({ type: 'cooldown', duration: 120, name: 'Cool Down', notes: 'Flush Lactic Acid' });
    return blocks;
  }, [totalCycles, currentWorkoutPlan]);

  // --- SECTION 1: IMPACT DATA ---
  const [metric, setMetric] = useState<MetricType>('aerobic');

  const impactData = [
    { name: 'Control', aerobic: 0, anaerobic: 0 },
    { name: 'Moderate (60m)', aerobic: 10, anaerobic: 0 },
    { name: 'Tabata (4m)', aerobic: 14, anaerobic: 28 },
  ];

  // --- SECTION 2: SIMULATOR STATE ---
  const [simMode, setSimMode] = useState<SimMode>('work');
  const [intensityData, setIntensityData] = useState<{ time: number; value: number }[]>([]);

  useEffect(() => {
    const base = simMode === 'work' ? 170 : 110;
    const initialData = Array.from({ length: 30 }, (_, i) => ({
      time: i,
      value: base + (Math.random() * 10 - 5),
    }));
    queueMicrotask(() => setIntensityData(initialData));

    const interval = setInterval(() => {
      setIntensityData((prev) => {
        const newData = [...prev.slice(1)];
        const lastTime = prev[prev.length - 1].time;
        newData.push({
          time: lastTime + 1,
          value: base + (Math.random() * 10 - 5),
        });
        return newData;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [simMode]);

  const simContent: Record<SimMode, SimContent> = {
    work: {
      color: 'text-red-600',
      bgColor: 'bg-red-600',
      borderColor: 'border-red-200',
      phase: 'Maximal Output',
      status: 'Work Phase (20 Secs)',
      instruction:
        "Push to absolute maximum capacity. Target 170% VO2 Max. If you feel like you could do a 9th rep, you didn't push hard enough on the first 8.",
      quote: 'The magic happens in the oxygen debt.',
      icon: '🔥',
    },
    rest: {
      color: 'text-blue-600',
      bgColor: 'bg-blue-600',
      borderColor: 'border-blue-200',
      phase: 'Absolute Rest',
      status: 'Recovery Phase (10 Secs)',
      instruction:
        'Complete cessation of work. Focus entirely on gas exchange. Deep diaphragmatic breathing to clear lactic acid buildup.',
      quote: 'Recover instantly. Prepare for the next strike.',
      icon: '🧊',
    },
  };

  const currentSim = simContent[simMode];

  // --- SECTION 3: VISUALIZER ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const animateRef = useRef<(time: number) => void>(() => {});
  const [isTelemetryEnabled, setIsTelemetryEnabled] = useState(false);
  const lastBeatPhaseRef = useRef(0);

  /** Returns a running AudioContext; creates or replaces if closed, awaits resume if suspended. */
  const getRunningAudioContext = (): Promise<AudioContext | null> => {
    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return Promise.resolve(null);
    let ctx = audioContextRef.current;
    if (!ctx || ctx.state === 'closed') {
      audioContextRef.current = new AudioContextCtor();
      ctx = audioContextRef.current;
    }
    if (ctx.state === 'suspended') {
      return ctx.resume().then(() => ctx);
    }
    return Promise.resolve(ctx);
  };

  const toggleTelemetryAudio = () => {
    const nextEnabled = !isTelemetryEnabled;
    if (nextEnabled) {
      getRunningAudioContext()
        .then(() => {
          setIsTelemetryEnabled(true);
        })
        .catch(() => {});
    } else {
      setIsTelemetryEnabled(false);
    }
  };

  const playHeartbeat = useCallback(() => {
    getRunningAudioContext()
      .then((ctx) => {
        if (!ctx) return;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.frequency.setValueAtTime(100, t);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.5, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

        osc.start(t);
        osc.stop(t + 0.15);
      })
      .catch(() => {});
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

    const targetBpm = simMode === 'work' ? 170 : 60;
    const beatDuration = 60000 / targetBpm;
    const phase = (time % beatDuration) / beatDuration;

    if (isTelemetryEnabled) {
      if (phase < lastBeatPhaseRef.current) {
        playHeartbeat();
      }
    }
    lastBeatPhaseRef.current = phase;

    const spike =
      simMode === 'work' ? Math.exp(-Math.pow(phase - 0.5, 2) * 100) : Math.sin(phase * Math.PI);

    const baseRadius = width * 0.3;
    const pulseExpansion = simMode === 'work' ? 40 : 15;
    const radius = baseRadius + spike * pulseExpansion;

    const gradient = ctx.createRadialGradient(
      centerX,
      centerY,
      radius * 0.5,
      centerX,
      centerY,
      radius
    );
    if (simMode === 'work') {
      gradient.addColorStop(0, `rgba(220, 38, 38, 0.8)`);
      gradient.addColorStop(1, `rgba(220, 38, 38, 0)`);
    } else {
      gradient.addColorStop(0, `rgba(37, 99, 235, 0.6)`);
      gradient.addColorStop(1, `rgba(37, 99, 235, 0)`);
    }

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = simMode === 'work' ? '#7f1d1d' : '#1e3a8a';
    ctx.fill();

    ctx.font = 'bold 24px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(simMode === 'work' ? 'MAX' : 'REST', centerX, centerY - 10);

    ctx.font = '14px Inter';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(simMode === 'work' ? '170% VO2' : 'Recovery', centerX, centerY + 15);

    requestRef.current = requestAnimationFrame((t) => animateRef.current(t));
  }, [simMode, isTelemetryEnabled, playHeartbeat]);

  useEffect(() => {
    animateRef.current = animateVisualizer;
  });

  useLayoutEffect(() => {
    requestRef.current = requestAnimationFrame((time) => {
      animateVisualizer(time);
    });
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    };
  }, [animateVisualizer]);

  return (
    <>
      <IntervalTimerLanding
        currentProtocol="tabata"
        onNavigate={onNavigate}
        accentTheme={getProtocolAccent('tabata')}
      >
        {/* HERO */}
        <section className="mx-auto max-w-4xl pt-8 text-center">
          <h1 className="font-display mb-6 text-4xl font-bold leading-tight text-white md:text-6xl">
            The Original <span className="text-[#ffbf00]">4-Minute</span> Miracle
          </h1>
          <p className="mb-10 text-xl leading-relaxed text-white/80">
            The <strong>Tabata Protocol</strong> (20s Work / 10s Rest). Discovered by Dr. Izumi
            Tabata in 1996. It is the most efficient method to improve both aerobic and anaerobic
            capacity simultaneously.
          </p>
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() =>
                document.getElementById('simulator')?.scrollIntoView({ behavior: 'smooth' })
              }
              className="rounded-xl bg-[#ffbf00] px-8 py-3 font-bold text-black shadow-lg transition-transform hover:-translate-y-1"
            >
              Start Tabata
            </button>
          </div>
        </section>

        {/* SECTION 1: DATA */}
        <section className="rounded-3xl border border-white/10 bg-black/30 p-8 shadow-sm md:p-12">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <div
                className={`mb-4 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase ${TABATA_ACCENT.badge} ${TABATA_ACCENT.badgeText}`}
              >
                Clinical Results
              </div>
              <h2 className="font-display mb-4 text-3xl font-bold text-white">
                Aerobic & Anaerobic Gains
              </h2>
              <p className="mb-6 leading-relaxed text-white/80">
                Dr. Tabata's research showed that 4 minutes of this protocol (intensity at 170% of
                VO2 max) improved aerobic capacity as much as 60 minutes of moderate endurance
                training, while also increasing anaerobic capacity by 28%.
              </p>
            </div>

            <div>
              <div className="mb-6 flex items-center justify-between">
                <h3 className="font-bold text-white/90">6-Week Improvement</h3>
                <div className="flex rounded-lg bg-black/30 p-1">
                  <button
                    type="button"
                    onClick={() => setMetric('aerobic')}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition ${metric === 'aerobic' ? 'bg-red-600 text-white' : 'text-white/60'}`}
                  >
                    Aerobic (VO2)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetric('anaerobic')}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition ${metric === 'anaerobic' ? 'bg-blue-600 text-white' : 'text-white/60'}`}
                  >
                    Anaerobic
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
                            metric === 'aerobic'
                              ? index === 2
                                ? '#dc2626'
                                : 'rgba(148,163,184,0.5)'
                              : index === 2
                                ? '#2563eb'
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
              className={`mb-4 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase ${TABATA_ACCENT.badge} ${TABATA_ACCENT.badgeText}`}
            >
              Tabata Simulator
            </div>
            <h2 className="font-display text-3xl font-bold text-white">20s ON / 10s OFF</h2>
            <p className="mt-2 text-white/70">The most intense 4 minutes of your life.</p>
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
                {simMode === 'work' ? '00:20' : '00:10'}
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
                        stroke={simMode === 'work' ? '#dc2626' : '#2563eb'}
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
                  "{currentSim.quote}"
                </blockquote>
                <div className="flex w-full justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => setSimMode('work')}
                    className={`w-1/2 rounded-xl font-bold transition-all ${simMode === 'work' ? 'scale-105 bg-red-600 text-white shadow-lg' : 'border border-white/20 bg-transparent text-white/70 hover:text-white'}`}
                  >
                    20s MAX
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimMode('rest')}
                    className={`w-1/2 rounded-xl font-bold transition-all ${simMode === 'rest' ? 'scale-105 bg-blue-600 text-white shadow-lg' : 'border border-white/20 bg-transparent text-white/70 hover:text-white'}`}
                  >
                    10s REST
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 text-center">
            <button
              type="button"
              onClick={setup.open}
              className="mx-auto flex items-center gap-3 rounded-full bg-[#ffbf00] px-8 py-4 font-bold text-black shadow-2xl transition-all hover:scale-105"
            >
              <span>⏱️</span>
              <span>Launch Tabata Timer</span>
            </button>
          </div>
        </section>

        {/* SECTION 3: VISUALIZER */}
        <section className="grid items-center gap-12 rounded-3xl border border-white/10 bg-black/30 p-8 shadow-2xl md:grid-cols-2 md:p-12">
          <div>
            <h2 className="font-display mb-6 text-3xl font-bold text-white">
              Oxygen Debt Visualizer
            </h2>
            <p className="mb-6 leading-relaxed text-white/80">
              The visualizer shows the intense cardiovascular demand of Tabata. Your heart rate will
              likely stay near max even during the 10-second rest periods, creating a cumulative
              oxygen debt that boosts post-exercise calorie burn (EPOC).
            </p>
            <button
              type="button"
              onClick={() => setIsReportOpen(true)}
              className="flex items-center gap-2 border-b border-[#ffbf00]/40 pb-0.5 text-sm font-bold text-[#ffbf00] transition-colors hover:text-[#ffbf00]/90"
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
            >
              {isTelemetryEnabled ? '🔊' : '🔇'}
            </button>
          </div>
        </section>
      </IntervalTimerLanding>

      <IntervalTimerSetupModal
        isOpen={setup.isOpen}
        onClose={setup.close}
        step={setup.step}
        protocolTitle="Select Protocol"
        protocolSubtitle="Choose your intensity structure"
        workoutTitle="Select Workout"
        workoutSubtitle="Choose your specific routine"
        onBack={setup.back}
        protocolContent={
          <TabataProtocolStep
            onStartWithStandard={setup.startWithStandard}
            onSelectCategory={setup.selectCategory}
          />
        }
        workoutContent={
          <TabataWorkoutStep
            selectedCategory={setup.selectedCategory}
            onStartWithWorkout={setup.startWithWorkout}
          />
        }
      />

      {/* REAL TIMER: shared overlay via portal so it escapes section z-index and covers full viewport */}
      {typeof document !== 'undefined' &&
        isTimerOpen &&
        tabataTimeline.length > 0 &&
        createPortal(
          <IntervalTimerOverlay
            timeline={tabataTimeline}
            onClose={() => {
              setFrozenWarmup(null);
              setIsTimerOpen(false);
            }}
            theme={{ workBg: TABATA_ACCENT.workBg }}
            warmupExercises={frozenWarmup?.exercises}
            warmupDurationPerExercise={frozenWarmup?.durationPerExercise}
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
          <div className="animate-zoom-in relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0d0500] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 p-6">
              <h3 className="font-display text-xl font-bold text-white">The Tabata Protocol</h3>
              <button
                type="button"
                onClick={() => setIsReportOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 font-bold text-white hover:bg-[#ffbf00]/20 hover:text-[#ffbf00]"
              >
                &times;
              </button>
            </div>
            <div className="prose prose-invert max-w-none overflow-y-auto p-8 text-white/80">
              <p>
                In 1996, Dr. Izumi Tabata analyzed the training of the Japanese speed skating team.
              </p>
              <h4>The Protocol</h4>
              <p>
                20 seconds of ultra-intense exercise followed by 10 seconds of rest, repeated
                continuously for 4 minutes (8 cycles).
              </p>
              <h4>The Results</h4>
              <p>
                The study showed that this 4-minute protocol increased aerobic capacity by 14% and
                anaerobic capacity by 28%, significantly outperforming traditional steady-state
                cardio groups in terms of VO2 max improvement.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TabataInterval;
