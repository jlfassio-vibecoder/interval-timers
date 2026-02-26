import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  IntervalTimerLanding,
  IntervalTimerOverlay,
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

interface JapaneseWalkingProps {
  /** Optional in standalone app (nav hidden); required when embedded in all-timers. */
  onNavigate?: (page: IntervalTimerPage) => void;
  onNavigateToLanding?: () => void;
}

type MetricType = 'vo2' | 'bp';
type SimMode = 'fast' | 'slow';

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

const ACCENT = getProtocolAccent('mindful');

const JapaneseWalking: React.FC<JapaneseWalkingProps> = ({ onNavigate, onNavigateToLanding }) => {
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isTimerOpen, setIsTimerOpen] = useState(false);
  const [frozenWarmup, setFrozenWarmup] = useState<{
    exercises: WarmupExercise[];
    durationPerExercise: number;
  } | null>(null);

  const { exercises, durationPerExercise } = useWarmupConfig();

  const japaneseWalkingTimeline = useMemo<HIITTimelineBlock[]>(() => {
    const blocks: HIITTimelineBlock[] = [getDefaultWarmupBlock(), getSetupBlock()];
    for (let i = 0; i < 5; i++) {
      blocks.push({ type: 'work', duration: 180, name: 'Fast Walk', notes: 'RPE 13-14' });
      blocks.push({ type: 'rest', duration: 180, name: 'Recovery Walk', notes: 'Breathe & step' });
    }
    blocks.push({
      type: 'cooldown',
      duration: 120,
      name: 'Cool Down',
      notes: 'Return to baseline',
    });
    return blocks;
  }, []);

  const [metric, setMetric] = useState<MetricType>('vo2');

  const impactData = [
    { name: 'Sedentary', vo2: 0, bp: 0 },
    { name: '10k Steps', vo2: 2, bp: -2 },
    { name: 'Interval Walk', vo2: 18, bp: -9 },
  ];

  const [simMode, setSimMode] = useState<SimMode>('fast');
  const [intensityData, setIntensityData] = useState<{ time: number; value: number }[]>([]);

  useEffect(() => {
    const base = simMode === 'fast' ? 85 : 40;
    const initialData = Array.from({ length: 30 }, (_, i) => ({
      time: i,
      value: base + (Math.random() * 5 - 2.5),
    }));
    queueMicrotask(() => setIntensityData(initialData));

    const interval = setInterval(() => {
      setIntensityData((prev) => {
        const newData = [...prev.slice(1)];
        const lastTime = prev[prev.length - 1].time;
        newData.push({
          time: lastTime + 1,
          value: base + (Math.random() * 5 - 2.5),
        });
        return newData;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [simMode]);

  const simContent: Record<SimMode, SimContent> = {
    fast: {
      color: 'text-orange-600',
      bgColor: 'bg-orange-600',
      borderColor: 'border-orange-200',
      phase: 'Push Phase',
      status: 'Fast Walk (3 Mins)',
      instruction:
        "Focus on form: Large strides. Land on your heel. Swing arms bent at 90°. Target RPE: 13-14 ('Somewhat Hard'). Elevate heart rate >70% Max.",
      quote: 'Feel the power in your legs. The burn is the signal of adaptation.',
      icon: '⚡',
    },
    slow: {
      color: 'text-green-700',
      bgColor: 'bg-green-700',
      borderColor: 'border-green-200',
      phase: 'Recovery Phase',
      status: 'Recovery Walk (3 Mins)',
      instruction:
        'Transition to 40% effort. Do not stop. Use Mindful Walking: synchronize breath and step. Inhale for 3 steps, exhale for 3 steps. Release shoulder tension.',
      quote: '"I have arrived. I am home."',
      icon: '🧘',
    },
  };

  const currentSim = simContent[simMode];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const animateRef = useRef<(time: number) => void>(() => {});
  const [isTelemetryEnabled, setIsTelemetryEnabled] = useState(false);
  const lastBeatPhaseRef = useRef(0);

  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      const ctx = audioContextRef.current;
      if (ctx && ctx.state !== 'closed') {
        ctx.close().catch(() => {});
      }
      audioContextRef.current = null;
    };
  }, []);

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
        .catch(() => {
          // Ignore autoplay policy or context errors so toggle state stays consistent.
        });
    } else {
      const ctx = audioContextRef.current;
      if (ctx && ctx.state !== 'closed') {
        ctx.suspend().then(
          () => setIsTelemetryEnabled(false),
          () => setIsTelemetryEnabled(false)
        );
      } else {
        setIsTelemetryEnabled(false);
      }
    }
  };

  const playHeartbeat = () => {
    let ctx = audioContextRef.current;
    if (!ctx || ctx.state === 'closed') {
      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      audioContextRef.current = new AudioContextCtor();
      ctx = audioContextRef.current;
    }
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
  };

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

    const targetBpm = simMode === 'fast' ? 85 : 60;
    const beatDuration = 60000 / targetBpm;
    const phase = (time % beatDuration) / beatDuration;

    if (isTelemetryEnabled) {
      if (phase < lastBeatPhaseRef.current) {
        playHeartbeat();
      }
    }
    lastBeatPhaseRef.current = phase;

    const spike =
      simMode === 'fast' ? Math.exp(-Math.pow(phase - 0.5, 2) * 100) : Math.sin(phase * Math.PI);

    const baseRadius = width * 0.3;
    const pulseExpansion = simMode === 'fast' ? 35 : 12;
    const radius = baseRadius + spike * pulseExpansion;

    const gradient = ctx.createRadialGradient(
      centerX,
      centerY,
      radius * 0.5,
      centerX,
      centerY,
      radius
    );
    if (simMode === 'fast') {
      gradient.addColorStop(0, 'rgba(234, 88, 12, 0.8)');
      gradient.addColorStop(1, 'rgba(234, 88, 12, 0)');
    } else {
      gradient.addColorStop(0, 'rgba(22, 163, 74, 0.6)');
      gradient.addColorStop(1, 'rgba(22, 163, 74, 0)');
    }

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = simMode === 'fast' ? '#9a3412' : '#14532d';
    ctx.fill();

    ctx.font = 'bold 24px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(simMode === 'fast' ? 'FAST' : 'RECOVERY', centerX, centerY - 10);

    ctx.font = '14px Inter';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(simMode === 'fast' ? '~85 BPM' : '~60 BPM', centerX, centerY + 15);

    requestRef.current = requestAnimationFrame((t) => animateRef.current(t));
  }, [simMode, isTelemetryEnabled]);

  useEffect(() => {
    animateRef.current = animateVisualizer;
  });

  useLayoutEffect(() => {
    requestRef.current = requestAnimationFrame((t) => {
      animateVisualizer(t);
    });
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    };
  }, [animateVisualizer]);

  const isStandalone = onNavigate == null;

  return (
    <>
      <IntervalTimerLanding
        currentProtocol="mindful"
        onNavigate={onNavigate}
        onNavigateToLanding={onNavigateToLanding}
        accentTheme={ACCENT}
        standalone={isStandalone}
      >
        {/* HERO */}
        <section className="mx-auto max-w-4xl pt-8 text-center">
          <h1 className="font-display mb-6 text-4xl font-bold leading-tight text-white md:text-6xl">
            The Synthesis of <span className="text-[#ffbf00]">Power</span> &{' '}
            <span className="text-green-400">Peace</span>
          </h1>
          <p className="mb-10 text-xl leading-relaxed text-white/80">
            Dr. Hiroshi Nose&apos;s <strong>Japanese Walking</strong> protocol alternates 3 minutes
            fast with 3 minutes slow. Use <strong>Mindful Walking</strong> breath during
            recovery—inhale and exhale in sync with your steps—to ground the mind while training the
            heart.
          </p>
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() =>
                document.getElementById('simulator')?.scrollIntoView({ behavior: 'smooth' })
              }
              className="rounded-xl bg-[#ffbf00] px-8 py-3 font-bold text-black shadow-lg transition-transform hover:-translate-y-1"
            >
              Experience Protocol
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
                Physiological Evidence
              </div>
              <h2 className="font-display mb-4 text-3xl font-bold text-white">
                Beyond &quot;10,000 Steps&quot;
              </h2>
              <p className="mb-6 leading-relaxed text-white/80">
                Research by Dr. Hiroshi Nose reveals that steady-state walking often fails to
                improve <strong>Peak Aerobic Capacity (VO2peak)</strong>. The &quot;Nose
                Protocol&quot;—alternating 3 minutes fast and 3 minutes slow—creates the metabolic
                stress required for adaptation.
              </p>
              <div className="space-y-2 rounded-xl border-l-4 border-[#ffbf00] bg-black/20 p-6">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📈</span>
                  <span className="text-sm font-bold text-white/90">
                    VO2 Peak: +18% Improvement
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xl">❤️</span>
                  <span className="text-sm font-bold text-white/90">
                    Blood Pressure: -9 mmHg Reduction
                  </span>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-6 flex items-center justify-between">
                <h3 className="font-bold text-white/90">Clinical Results (5 Months)</h3>
                <div className="flex rounded-lg bg-black/30 p-1">
                  <button
                    type="button"
                    onClick={() => setMetric('vo2')}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition ${metric === 'vo2' ? 'bg-orange-600 text-white' : 'text-white/60'}`}
                  >
                    VO2 Peak
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetric('bp')}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition ${metric === 'bp' ? 'bg-green-600 text-white' : 'text-white/60'}`}
                  >
                    BP Change
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
                            metric === 'vo2'
                              ? index === 2
                                ? '#ea580c'
                                : 'rgba(148,163,184,0.5)'
                              : index === 2
                                ? '#16a34a'
                                : 'rgba(148,163,184,0.5)'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-4 text-center text-xs text-white/50">
                *Interval Walking vs. Steady State Control Group
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 2: SIMULATOR */}
        <section id="simulator" className="space-y-8">
          <div className="text-center">
            <div
              className={`mb-4 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase ${ACCENT.badge} ${ACCENT.badgeText}`}
            >
              Japanese Walking Simulator
            </div>
            <h2 className="font-display text-3xl font-bold text-white">3 Min Fast / 3 Min Slow</h2>
            <p className="mt-2 text-white/70">
              Switch between Physiological Push and Recovery Presence.
            </p>
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
              <div className="font-mono text-3xl opacity-90">03:00</div>
            </div>

            <div className="grid md:grid-cols-2">
              <div className="border-b border-white/10 p-8 md:border-b-0 md:border-r">
                <div className="mb-6 h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={intensityData}>
                      <YAxis domain={[0, 120]} hide />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={simMode === 'fast' ? '#ea580c' : '#16a34a'}
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
                  {currentSim.quote}
                </blockquote>
                <div className="flex w-full justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => setSimMode('fast')}
                    className={`w-1/2 rounded-xl font-bold transition-all ${simMode === 'fast' ? 'scale-105 bg-orange-600 text-white shadow-lg' : 'border border-white/20 bg-transparent text-white/70 hover:text-white'}`}
                  >
                    3 MIN FAST
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimMode('slow')}
                    className={`w-1/2 rounded-xl font-bold transition-all ${simMode === 'slow' ? 'scale-105 bg-green-700 text-white shadow-lg' : 'border border-white/20 bg-transparent text-white/70 hover:text-white'}`}
                  >
                    3 MIN RECOVERY
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 text-center">
            <button
              type="button"
              onClick={() => {
                setFrozenWarmup({ exercises: [...exercises], durationPerExercise });
                setIsTimerOpen(true);
              }}
              className="mx-auto flex items-center gap-3 rounded-full bg-[#ffbf00] px-8 py-4 font-bold text-black shadow-2xl transition-all hover:scale-105"
            >
              <span>⏱️</span>
              <span>Launch Japanese Walking Timer</span>
            </button>
          </div>
        </section>

        {/* SECTION 3: VISUALIZER */}
        <section className="grid items-center gap-12 rounded-3xl border border-white/10 bg-black/30 p-8 shadow-2xl md:grid-cols-2 md:p-12">
          <div>
            <h2 className="font-display mb-6 text-3xl font-bold text-white">Heart Rate Response</h2>
            <p className="mb-6 leading-relaxed text-white/80">
              The visualizer shows the metabolic demand of the Nose Protocol. Alternating 3-minute
              fast and slow intervals creates the stress needed to improve VO2 peak and
              cardiovascular health without the intensity of all-out sprints.
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

      {typeof document !== 'undefined' &&
        isTimerOpen &&
        japaneseWalkingTimeline.length > 0 &&
        createPortal(
          <IntervalTimerOverlay
            timeline={japaneseWalkingTimeline}
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
                The Japanese Walking Protocol
              </h3>
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
                Dr. Hiroshi Nose developed the &quot;Interval Walking&quot; protocol—alternating 3
                minutes of fast walking (RPE 13–14) with 3 minutes of slow walking—to improve VO2
                peak in older adults.
              </p>
              <h4>The Protocol</h4>
              <p>
                3 minutes fast (target &gt;70% HR max) followed by 3 minutes slow (target ~40%
                effort), repeated 5 times. Total session ~33 minutes including warmup and cooldown.
              </p>
              <h4>The Results</h4>
              <p>
                Five months of interval walking increased VO2 peak by ~18% and reduced blood
                pressure by ~9 mmHg compared to steady-state walking control groups.
              </p>
              <h4>Mindful Walking (Recovery)</h4>
              <p>
                During the slow phase, apply Thich Nhat Hanh&apos;s Mindful Walking: match your
                breath to your steps. Inhale for 3 steps, exhale for 3 steps. This keeps you present
                and supports recovery between high-intensity efforts.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default JapaneseWalking;
