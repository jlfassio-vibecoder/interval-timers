import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
import type { IntervalTimerPage } from '@interval-timers/timer-core';
import { getProtocolAccent, SETUP_DURATION_SECONDS } from '@interval-timers/timer-core';
import { IntervalTimerLanding } from '@interval-timers/timer-ui';

interface GibalaMethodProps {
  onNavigate: (page: IntervalTimerPage) => void;
  onNavigateToLanding?: () => void;
}

type TimerState = 'idle' | 'warmup' | 'setup' | 'work' | 'rest' | 'cooldown' | 'finished';
type MetricType = 'efficiency' | 'discomfort';
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

const ACCENT = getProtocolAccent('gibala');

const GibalaMethod: React.FC<GibalaMethodProps> = ({ onNavigate, onNavigateToLanding }) => {
  const [isReportOpen, setIsReportOpen] = useState(false);

  // --- TIMER STATE ---
  const [isTimerOpen, setIsTimerOpen] = useState(false);
  const [isDurationSelectOpen, setIsDurationSelectOpen] = useState(false);
  const [timerState, setTimerState] = useState<TimerState>('idle');
  const [timeLeft, setTimeLeft] = useState(0);
  const [cycleCount, setCycleCount] = useState(1);
  const [totalCycles, setTotalCycles] = useState(10); // Default 10 cycles (~22 min)
  const [isPaused, setIsPaused] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // --- SECTION 1: DATA ---
  const [metric, setMetric] = useState<MetricType>('efficiency');

  const impactData = [
    { name: 'Endurance (45m)', efficiency: 40, discomfort: 20 },
    { name: 'Wingate (20m)', efficiency: 90, discomfort: 100 },
    { name: 'Gibala (20m)', efficiency: 85, discomfort: 60 },
  ];

  // --- SECTION 2: SIMULATOR STATE ---
  const [simMode, setSimMode] = useState<SimMode>('work');
  const [intensityData, setIntensityData] = useState<{ time: number; value: number }[]>([]);

  useEffect(() => {
    // Simulator logic: Smooth plateau
    const base = simMode === 'work' ? 150 : 100;
    const initialData = Array.from({ length: 30 }, (_, i) => ({
      time: i,
      value: base + (Math.random() * 4 - 2),
    }));
    queueMicrotask(() => setIntensityData(initialData));

    const interval = setInterval(() => {
      setIntensityData((prev) => {
        const newData = [...prev.slice(1)];
        const lastTime = prev[prev.length - 1].time;
        const value = base + (Math.random() * 6 - 3);
        newData.push({
          time: lastTime + 1,
          value: value,
        });
        return newData;
      });
    }, 800);

    return () => clearInterval(interval);
  }, [simMode]);

  const simContent: Record<SimMode, SimContent> = {
    work: {
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-600',
      borderColor: 'border-emerald-200',
      phase: 'Vigorous Output',
      status: 'Intensity (60 Secs)',
      instruction:
        "Maintain 95% of your max heart rate. This is 'hard' but not 'all-out'. Think of it as a sustainable surge. A fast run, a steep hill climb, or heavy rowing.",
      quote: 'Hard work, sustained.',
      icon: '🌲',
    },
    rest: {
      color: 'text-slate-500',
      bgColor: 'bg-slate-500',
      borderColor: 'border-slate-300',
      phase: 'Full Recovery',
      status: 'Relief (75 Secs)',
      instruction:
        '75 seconds is a luxury in HIIT. Use it. Walk slowly. Bring your heart rate down as much as possible to ensure the next interval quality is high.',
      quote: 'Earn the recovery.',
      icon: '🍃',
    },
  };

  const currentSim = simContent[simMode];

  // --- SECTION 3: VISUALIZER ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const animateRef = useRef<(time: number) => void>(() => {});
  const [isTelemetryEnabled, setIsTelemetryEnabled] = useState(false);

  const toggleTelemetryAudio = () => {
    if (!audioContextRef.current) {
      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      audioContextRef.current = new AudioContextCtor();
    }
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
    setIsTelemetryEnabled(!isTelemetryEnabled);
  };

  const animateVisualizer = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);

    const cycleDuration = 4000;
    const phase = (time % cycleDuration) / cycleDuration;

    const baseRadius = width * 0.2;
    const expansion = simMode === 'work' ? 50 : 10;

    for (let i = 0; i < 3; i++) {
      const offset = i * (Math.PI / 3);
      const localPhase = (phase + offset) % 1;
      const alpha = 1 - localPhase;
      const currentRadius = baseRadius + expansion * Math.sin(localPhase * Math.PI);

      ctx.beginPath();
      ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
      ctx.strokeStyle =
        simMode === 'work' ? `rgba(5, 150, 105, ${alpha})` : `rgba(100, 116, 139, ${alpha})`;
      ctx.lineWidth = 2 + i * 2;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
    ctx.fillStyle = simMode === 'work' ? '#047857' : '#475569';
    ctx.fill();

    ctx.font = 'bold 24px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(simMode === 'work' ? 'VITALITY' : 'REST', centerX, centerY);

    requestRef.current = requestAnimationFrame((t) => animateRef.current(t));
  }, [simMode]);

  useEffect(() => {
    animateRef.current = animateVisualizer;
  });

  useEffect(() => {
    requestRef.current = requestAnimationFrame((t) => animateRef.current(t));
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animateVisualizer]);

  // --- AUDIO LOGIC ---
  const playBell = useCallback((type: 'work' | 'rest' | 'finish') => {
    try {
      if (!audioContextRef.current) {
        const AudioContextCtor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextCtor) return;
        audioContextRef.current = new AudioContextCtor();
      }
      const ctx = audioContextRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      const now = ctx.currentTime;

      if (type === 'work') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(261.63, now);
        osc.frequency.linearRampToValueAtTime(329.63, now + 0.1);
        osc.frequency.linearRampToValueAtTime(392.0, now + 0.2);

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.4, now + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

        osc.start(now);
        osc.stop(now + 1.6);
      } else if (type === 'rest') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(392.0, now);
        osc.frequency.linearRampToValueAtTime(261.63, now + 0.5);

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.2, now + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

        osc.start(now);
        osc.stop(now + 2.1);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.3, now + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 4);
        osc.start(now);
        osc.stop(now + 4.1);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // --- TIMER LOGIC ---
  const startRealTimer = (cycles: number) => {
    setTotalCycles(cycles);
    setIsDurationSelectOpen(false);
    setIsTimerOpen(true);
    setTimerState('warmup');
    setTimeLeft(180); // 3 mins warmup
    setCycleCount(1);
    setIsPaused(false);
    playBell('rest');
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

  const handlePhaseTransition = useCallback((manual = false) => {
    if (timerState === 'warmup') {
      if (!manual) playBell('rest');
      setTimerState('setup');
      setTimeLeft(SETUP_DURATION_SECONDS);
    } else if (timerState === 'setup') {
      if (!manual) playBell('work');
      setTimerState('work');
      setTimeLeft(60); // 60s Work
    } else if (timerState === 'work') {
      if (!manual) playBell('rest');
      setTimerState('rest');
      setTimeLeft(75); // 75s Rest
    } else if (timerState === 'rest') {
      if (cycleCount < totalCycles) {
        if (!manual) playBell('work');
        setCycleCount((prev) => prev + 1);
        setTimerState('work');
        setTimeLeft(60); // 60s Work
      } else {
        if (!manual) playBell('finish');
        setTimerState('cooldown');
        setTimeLeft(180); // 3 mins cooldown
      }
    } else if (timerState === 'cooldown') {
      setTimerState('finished');
      setTimeLeft(0);
    }
  }, [timerState, cycleCount, totalCycles, playBell]);

  const skipPhase = () => handlePhaseTransition(true);

  useEffect(() => {
    let interval: number | undefined;
    if (isTimerOpen && !isPaused && timerState !== 'finished' && timerState !== 'idle') {
      interval = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev > 0) return prev - 1;
          return 0;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerOpen, isPaused, timerState]);

  useEffect(() => {
    if (
      timeLeft === 0 &&
      isTimerOpen &&
      !isPaused &&
      timerState !== 'idle' &&
      timerState !== 'finished'
    ) {
      queueMicrotask(() => handlePhaseTransition());
    }
  }, [timeLeft, isTimerOpen, isPaused, timerState, handlePhaseTransition]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const getTimerStyles = () => {
    switch (timerState) {
      case 'warmup':
        return { bg: 'bg-slate-600', text: 'Warm Up', sub: '3 Mins Easy' };
      case 'setup':
        return { bg: 'bg-slate-600', text: 'Setup', sub: 'Get into position' };
      case 'work':
        return { bg: 'bg-emerald-600', text: 'VIGOROUS', sub: '60s Sustained Intensity' };
      case 'rest':
        return { bg: 'bg-slate-500', text: 'RECOVER', sub: '75s Easy Movement' };
      case 'cooldown':
        return { bg: 'bg-slate-700', text: 'Cool Down', sub: 'Bring it down' };
      case 'finished':
        return { bg: 'bg-slate-900', text: 'Session Complete', sub: 'Health Optimized' };
      default:
        return { bg: 'bg-slate-600', text: 'Ready', sub: '' };
    }
  };

  const timerStyle = getTimerStyles();

  return (
    <>
      <IntervalTimerLanding
        currentProtocol="gibala"
        onNavigate={onNavigate}
        onNavigateToLanding={onNavigateToLanding}
        accentTheme={ACCENT}
      >
        {/* HERO */}
        <section className="mx-auto max-w-4xl pt-8 text-center">
          <h1 className="font-display mb-6 text-4xl font-bold leading-tight text-white md:text-6xl">
            The <span className="text-emerald-400">Sustainable</span> Standard
          </h1>
          <p className="mb-10 text-xl leading-relaxed text-white/80">
            The <strong>Gibala Method</strong> (60s Work / 75s Rest). Developed by Dr. Martin
            Gibala, this protocol offers the potent benefits of HIIT without the extreme discomfort
            of &quot;all-out&quot; sprinting. It is the practical choice for general health and
            longevity.
          </p>
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() =>
                document.getElementById('simulator')?.scrollIntoView({ behavior: 'smooth' })
              }
              className="rounded-xl bg-[#ffbf00] px-8 py-3 font-bold text-black shadow-lg transition-transform hover:-translate-y-1"
            >
              Start Session
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
                Research Focus
              </div>
              <h2 className="font-display mb-4 text-3xl font-bold text-white">
                Efficiency vs. Discomfort
              </h2>
              <p className="mb-6 leading-relaxed text-white/80">
                In his 2010 study, Dr. Gibala compared this 60/75 protocol against traditional
                endurance training (5 hours/week). The results showed similar improvements in
                insulin sensitivity and muscle oxidative capacity, but with significantly less time
                commitment and lower perceived exertion than Wingate sprints.
              </p>
            </div>

            <div>
              <div className="mb-6 flex items-center justify-between">
                <h3 className="font-bold text-white/90">Protocol Comparison</h3>
                <div className="flex rounded-lg bg-black/30 p-1">
                  <button
                    type="button"
                    onClick={() => setMetric('efficiency')}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition ${metric === 'efficiency' ? 'bg-emerald-500 text-white' : 'text-white/60'}`}
                  >
                    Time Efficiency
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetric('discomfort')}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition ${metric === 'discomfort' ? 'bg-red-500 text-white' : 'text-white/60'}`}
                  >
                    Pain Level
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
                            metric === 'efficiency' && index === 2
                              ? '#059669'
                              : metric === 'discomfort' && index === 1
                                ? '#ef4444'
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
              Gibala Simulator
            </div>
            <h2 className="font-display text-3xl font-bold text-white">60s Hard / 75s Easy</h2>
            <p className="mt-2 text-white/70">The sweet spot of high intensity.</p>
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
                {simMode === 'work' ? '01:00' : '01:15'}
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
                        stroke={simMode === 'work' ? '#059669' : '#475569'}
                        strokeWidth={3}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className={`rounded-xl border-l-4 bg-black/20 p-4 ${currentSim.borderColor}`}>
                  <h4 className="mb-2 font-bold text-white">Guidance</h4>
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
                    className={`w-1/2 rounded-xl font-bold transition-all ${simMode === 'work' ? 'scale-105 bg-emerald-500 text-white shadow-lg' : 'border border-white/20 bg-transparent text-white/70 hover:text-white'}`}
                  >
                    60s PUSH
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimMode('rest')}
                    className={`w-1/2 rounded-xl font-bold transition-all ${simMode === 'rest' ? 'scale-105 bg-slate-600 text-white shadow-lg' : 'border border-white/20 bg-transparent text-white/70 hover:text-white'}`}
                  >
                    75s RELAX
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 text-center">
            <button
              type="button"
              onClick={() => setIsDurationSelectOpen(true)}
              className="mx-auto flex items-center gap-3 rounded-full bg-emerald-500 px-8 py-4 font-bold text-white shadow-2xl transition-all hover:scale-105 hover:bg-emerald-600"
            >
              <span>⏱️</span>
              <span>Launch Gibala Timer</span>
            </button>
          </div>
        </section>

        {/* SECTION 3: VISUALIZER */}
        <section className="grid items-center gap-12 rounded-3xl border border-white/10 bg-black/30 p-8 shadow-2xl md:grid-cols-2 md:p-12">
          <div>
            <h2 className="font-display mb-6 text-3xl font-bold text-white">Vitality Visualizer</h2>
            <p className="mb-6 leading-relaxed text-white/80">
              This protocol builds a robust &quot;engine&quot;. The visualizer reflects this
              stability—pulsing rhythmically rather than spiking erratically. It represents the
              sustainable expansion of your aerobic base.
            </p>
            <button
              type="button"
              onClick={() => setIsReportOpen(true)}
              className="flex items-center gap-2 border-b border-emerald-400/40 pb-0.5 text-sm font-bold text-emerald-400 transition-colors hover:text-emerald-300"
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
              aria-label={isTelemetryEnabled ? 'Mute telemetry' : 'Enable telemetry audio'}
            >
              {isTelemetryEnabled ? '🔊' : '🔇'}
            </button>
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
              aria-hidden="true"
            />
            <div className="animate-zoom-in relative flex max-h-[calc(100vh-2rem)] w-full max-w-md shrink-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0d0500] shadow-2xl duration-200">
              <div className="shrink-0 border-b border-white/10 p-6 text-center">
                <h3 className="font-display text-xl font-bold text-white">Select Volume</h3>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
                <button
                  type="button"
                  onClick={() => startRealTimer(8)}
                  className="group w-full rounded-xl border-2 border-white/10 p-4 text-left transition-all hover:border-emerald-500 hover:bg-emerald-600/20"
                >
                  <div className="text-lg font-bold text-white">Quick Health (18 Mins)</div>
                  <div className="text-xs font-medium text-white/50">
                    8 Cycles • Minimum Effective Dose
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => startRealTimer(10)}
                  className="group w-full rounded-xl border-2 border-white/10 p-4 text-left transition-all hover:border-emerald-500 hover:bg-emerald-600/20"
                >
                  <div className="text-lg font-bold text-white">Standard (22.5 Mins)</div>
                  <div className="text-xs font-medium text-white/50">
                    10 Cycles • Optimal Balance
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => startRealTimer(12)}
                  className="group w-full rounded-xl border-2 border-white/10 p-4 text-left transition-all hover:border-emerald-500 hover:bg-emerald-600/20"
                >
                  <div className="text-lg font-bold text-white">Extended (27 Mins)</div>
                  <div className="text-xs font-medium text-white/50">
                    12 Cycles • Maximum Benefit
                  </div>
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

      {/* REAL TIMER MODAL */}
      {isTimerOpen && (
        <div className="animate-zoom-in fixed inset-0 z-[200] flex h-full w-full flex-col bg-slate-950 duration-200">
          <div
            className={`flex items-center justify-between p-4 text-white md:p-6 ${timerStyle.bg} shrink-0 border-b border-white/10 transition-colors duration-200`}
          >
            <div>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-widest opacity-80 md:text-xs">
                {timerState === 'warmup' || timerState === 'setup' || timerState === 'cooldown'
                  ? 'Preparation'
                  : `Cycle ${cycleCount} of ${totalCycles}`}
              </div>
              <h3 className="font-display text-xl font-bold leading-tight md:text-3xl">
                {timerStyle.text}
              </h3>
              <p className="mt-1 text-xs opacity-90 md:text-sm">{timerStyle.sub}</p>
            </div>
            <button
              onClick={() => setIsTimerOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 font-bold text-white hover:bg-white/30"
              type="button"
            >
              &times;
            </button>
          </div>

          <div className="relative flex flex-grow flex-col items-center justify-center overflow-hidden p-4">
            <div className="relative z-10 mb-6 text-center">
              <div className="font-mono text-8xl font-bold tabular-nums leading-none tracking-tighter text-white drop-shadow-2xl md:text-[180px]">
                {formatTime(timeLeft)}
              </div>
            </div>
            {(timerState === 'work' || timerState === 'rest') && (
              <div className="relative z-10 mt-8 w-full max-w-2xl">
                <div className="mb-2 flex justify-between text-xs font-bold text-slate-500">
                  <span>{timerState === 'work' ? '60s PUSH' : '75s RELAX'}</span>
                  <span>{((cycleCount / totalCycles) * 100).toFixed(0)}% Complete</span>
                </div>
                <div className="h-4 overflow-hidden rounded-full border border-slate-700 bg-slate-800">
                  <div
                    className={`h-full transition-all duration-1000 ease-linear ${timerState === 'work' ? 'bg-emerald-600' : 'bg-slate-500'}`}
                    style={{
                      width: `${timerState === 'work' ? (1 - timeLeft / 60) * 100 : (1 - timeLeft / 75) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="relative z-20 flex shrink-0 items-center justify-between gap-3 border-t border-slate-900 bg-black p-4 md:p-8">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="w-1/3 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 font-bold text-white hover:bg-slate-700 md:px-8 md:py-4"
              type="button"
            >
              {isPaused ? 'RESUME' : 'PAUSE'}
            </button>
            <button
              onClick={() => skipPhase()}
              className={`w-1/3 rounded-xl px-4 py-3 font-bold md:px-8 md:py-4 ${
                timerState === 'warmup' || timerState === 'setup'
                  ? 'bg-white/10 text-white hover:bg-white/20'
                  : 'bg-transparent text-slate-500 hover:bg-slate-900'
              }`}
              type="button"
            >
              {timerState === 'warmup' ? 'Skip Warm-up' : 'SKIP'}
            </button>
          </div>
        </div>
      )}

      {/* INFO MODAL */}
      {isReportOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsReportOpen(false)}
            aria-hidden="true"
          />
          <div className="animate-zoom-in relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0d0500] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 p-6">
              <h3 className="font-display text-xl font-bold text-white">The Gibala Method</h3>
              <button
                type="button"
                onClick={() => setIsReportOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 font-bold text-white hover:bg-emerald-600/20 hover:text-emerald-400"
              >
                &times;
              </button>
            </div>
            <div className="prose prose-invert max-w-none overflow-y-auto p-8 text-white/80">
              <p>Developed by Dr. Martin Gibala at McMaster University.</p>
              <h4 className="font-bold text-emerald-500">The 60-75 Protocol</h4>
              <p>
                This method involves 60 seconds of vigorous exercise (95% HRmax) followed by 75
                seconds of rest. Repeating this 8-12 times results in significant improvements in
                exercise capacity and insulin sensitivity.
              </p>
              <h4 className="font-bold text-emerald-500">Why it works</h4>
              <p>
                It balances high intensity with sufficient recovery, allowing you to maintain
                quality output over a longer duration (approx 20 mins) than shorter, more brutal
                protocols like Wingate.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GibalaMethod;
