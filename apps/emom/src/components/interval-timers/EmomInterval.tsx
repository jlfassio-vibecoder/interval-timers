import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { IntervalTimerLanding } from '@interval-timers/timer-ui';
import type { IntervalTimerPage } from '@interval-timers/timer-core';
import { getProtocolAccent, SETUP_DURATION_SECONDS } from '@interval-timers/timer-core';
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

interface EmomIntervalProps {
  onNavigate?: (page: IntervalTimerPage) => void;
  onNavigateToLanding?: () => void;
}

type TimerState = 'idle' | 'setup' | 'working' | 'resting' | 'finished';
type MetricType = 'work_capacity' | 'fatigue_rate';
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

const EMOM_ACCENT = getProtocolAccent('emom');

const EmomInterval: React.FC<EmomIntervalProps> = ({ onNavigate, onNavigateToLanding }) => {
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isTimerOpen, setIsTimerOpen] = useState(false);
  const [isDurationSelectOpen, setIsDurationSelectOpen] = useState(false);
  const [timerState, setTimerState] = useState<TimerState>('idle');
  const [timeLeft, setTimeLeft] = useState(0);
  const [secondsInMinute, setSecondsInMinute] = useState(0);
  const [cycleCount, setCycleCount] = useState(1);
  const [totalCycles, setTotalCycles] = useState(10);
  const [isPaused, setIsPaused] = useState(false);
  const [taskFinishedAt, setTaskFinishedAt] = useState<number | null>(null);
  // Round history is populated during the session for a planned user-history feature (accounts).
  const [, setRoundHistory] = useState<
    { round: number; work: number; rest: number }[]
  >([]);

  const audioContextRef = useRef<AudioContext | null>(null);

  const [metric, setMetric] = useState<MetricType>('work_capacity');

  const impactData = [
    { name: 'Standard Sets', work_capacity: 40, fatigue_rate: 10 },
    { name: 'AMRAP', work_capacity: 80, fatigue_rate: 90 },
    { name: 'EMOM', work_capacity: 85, fatigue_rate: 60 },
  ];

  const [simMode, setSimMode] = useState<SimMode>('fast');
  const [intensityData, setIntensityData] = useState<{ time: number; value: number }[]>([]);

  useEffect(() => {
    const workDuration = simMode === 'fast' ? 20 : 45;
    const data: { time: number; value: number }[] = [];
    for (let i = 0; i < 60; i++) {
      const val = i < workDuration ? 150 + Math.random() * 20 : 10;
      data.push({ time: i, value: val });
    }
    queueMicrotask(() => setIntensityData(data));
  }, [simMode]);

  const simContent: Record<SimMode, SimContent> = {
    fast: {
      color: 'text-teal-400',
      bgColor: 'bg-teal-600',
      borderColor: 'border-teal-300',
      phase: 'Efficiency',
      status: 'Fast Reps (20s Work)',
      instruction:
        'You complete the task quickly. This earns you 40 seconds of rest. Your heart rate recovers significantly. You are fresh for the next round.',
      quote: 'Earn your rest.',
      icon: '⚡',
    },
    slow: {
      color: 'text-orange-400',
      bgColor: 'bg-orange-600',
      borderColor: 'border-orange-300',
      phase: 'Fatigue',
      status: 'Slow Reps (45s Work)',
      instruction:
        'You pace too slowly or the weight is too heavy. You only have 15 seconds to recover. Fatigue compounds. The next round will be even harder.',
      quote: 'The clock waits for no one.',
      icon: '⏳',
    },
  };

  const currentSim = simContent[simMode];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const animateRef = useRef<(time: number) => void>(() => {});
  const [isTelemetryEnabled, setIsTelemetryEnabled] = useState(false);

  const toggleTelemetryAudio = () => {
    const nextEnabled = !isTelemetryEnabled;
    if (nextEnabled) {
      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContextCtor();
      }
      audioContextRef.current
        ?.resume()
        .then(() => setIsTelemetryEnabled(true))
        .catch(() => {});
    } else {
      audioContextRef.current?.suspend().catch(() => {});
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

  const playSound = (type: 'start_round' | 'finish_task' | 'warning' | 'complete') => {
    try {
      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
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

      if (type === 'start_round') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1760, now + 0.1);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.6);
      } else if (type === 'finish_task') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (type === 'warning') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.3);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554.37, now + 0.2);
        osc.frequency.setValueAtTime(659.25, now + 0.4);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 2.0);
        osc.start(now);
        osc.stop(now + 2.1);
      }
    } catch (e) {
      console.error(e);
    }
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

    const radius = width * 0.4;

    for (let i = 0; i < 60; i++) {
      const angle = (Math.PI * 2 * i) / 60 - Math.PI / 2;
      const isMajor = i % 5 === 0;
      const len = isMajor ? 15 : 5;
      const color = isMajor ? '#cbd5e1' : '#475569';
      const x1 = centerX + Math.cos(angle) * radius;
      const y1 = centerY + Math.sin(angle) * radius;
      const x2 = centerX + Math.cos(angle) * (radius - len);
      const y2 = centerY + Math.sin(angle) * (radius - len);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = color;
      ctx.lineWidth = isMajor ? 2 : 1;
      ctx.stroke();
    }

    const cycle = 3000;
    const progress = (time % cycle) / cycle;
    const workLimit = simMode === 'fast' ? 0.33 : 0.75;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * workLimit);
    ctx.strokeStyle = 'rgba(45, 212, 191, 0.3)';
    ctx.lineWidth = 10;
    ctx.stroke();

    const handAngle = Math.PI * 2 * progress - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + Math.cos(handAngle) * (radius - 5),
      centerY + Math.sin(handAngle) * (radius - 5)
    );
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = "bold 20px 'Syncopate', system-ui, sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText('PACE', centerX, centerY - 10);
    ctx.fillStyle = '#94a3b8';
    ctx.font = "12px 'Syncopate', system-ui, sans-serif";
    ctx.fillText(simMode === 'fast' ? 'High Efficiency' : 'Low Efficiency', centerX, centerY + 15);

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

  const startRealTimer = (cycles: number) => {
    setTotalCycles(cycles);
    setIsDurationSelectOpen(false);
    setIsTimerOpen(true);
    setTimerState('setup');
    setTimeLeft(SETUP_DURATION_SECONDS);
    setCycleCount(1);
    setSecondsInMinute(0);
    setTaskFinishedAt(null);
    setRoundHistory([]);
    setIsPaused(false);
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

  const handleTaskComplete = () => {
    if (timerState === 'working') {
      playSound('finish_task');
      setTimerState('resting');
      setTaskFinishedAt(secondsInMinute);
      setRoundHistory((prev) => [
        ...prev,
        { round: cycleCount, work: secondsInMinute, rest: 60 - secondsInMinute },
      ]);
    }
  };

  const skipToNextPhase = () => {
    if (timerState === 'setup') {
      setTimerState('working');
      setSecondsInMinute(0);
      playSound('start_round');
    } else if (timerState === 'resting') {
      // Perform same transition as when rest period completes in the interval,
      // so skip works immediately and while paused (interval not running).
      if (cycleCount >= totalCycles) {
        setTimerState('finished');
        playSound('complete');
        setSecondsInMinute(0);
      } else {
        setCycleCount((c) => c + 1);
        setTimerState('working');
        setTaskFinishedAt(null);
        playSound('start_round');
        setSecondsInMinute(0);
      }
    }
  };

  useEffect(() => {
    let interval: number | undefined;
    if (isTimerOpen && !isPaused && timerState !== 'idle' && timerState !== 'finished') {
      interval = window.setInterval(() => {
        if (timerState === 'setup') {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              setTimerState('working');
              setSecondsInMinute(0);
              playSound('start_round');
              return 0;
            }
            return prev - 1;
          });
        } else {
          setSecondsInMinute((prev) => {
            const next = prev + 1;
            if (next >= 60) {
              if (cycleCount >= totalCycles) {
                setTimerState('finished');
                playSound('complete');
                return 0;
              }
              setCycleCount((c) => c + 1);
              setTimerState('working');
              setTaskFinishedAt(null);
              playSound('start_round');
              return 0;
            }
            if (next >= 57) playSound('warning');
            return next;
          });
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerOpen, isPaused, timerState, cycleCount, totalCycles]);

  const formatTime = (seconds: number) => (seconds < 10 ? `0${seconds}` : `${seconds}`);

  const getTimerStyles = () => {
    switch (timerState) {
      case 'setup':
        return { bg: 'bg-slate-800', text: 'Setup', sub: 'Get into position' };
      case 'working':
        return { bg: 'bg-teal-600', text: 'WORK', sub: `Minute ${cycleCount} of ${totalCycles}` };
      case 'resting':
        return { bg: 'bg-slate-700', text: 'REST', sub: 'Wait for the minute' };
      case 'finished':
        return { bg: 'bg-slate-900', text: 'Complete', sub: 'Efficiency Mastered' };
      default:
        return { bg: 'bg-slate-800', text: 'Ready', sub: '' };
    }
  };

  const timerStyle = getTimerStyles();

  return (
    <>
      <IntervalTimerLanding
        currentProtocol="emom"
        onNavigate={onNavigate}
        onNavigateToLanding={onNavigateToLanding}
        accentTheme={EMOM_ACCENT}
        standalone={onNavigate == null}
        brandLabel="AI Fitness Guy"
      >
        {/* HERO */}
        <section className="mx-auto max-w-4xl pt-8 text-center">
          <h1 className="font-display mb-6 text-4xl font-bold leading-tight text-white md:text-6xl">
            The <span className="text-teal-400">Relentless</span> Minute
          </h1>
          <img
            src={`${import.meta.env.BASE_URL}logo_transparent_500x500.png`}
            alt="Interval Timers"
            className="mx-auto mb-10 h-28 w-28 object-contain md:h-36 md:w-36"
          />
          <p className="mb-10 text-xl leading-relaxed text-white/80">
            <strong>Every Minute on the Minute (EMOM)</strong>. A protocol of pure efficiency. You
            have 60 seconds to complete a task. The faster you finish, the more you rest. If you go
            too slow, the clock shows no mercy.
          </p>
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() =>
                document.getElementById('simulator')?.scrollIntoView({ behavior: 'smooth' })
              }
              className="rounded-xl bg-teal-600 px-8 py-3 font-bold text-white shadow-[0_0_20px_rgba(45,212,191,0.3)] transition-transform hover:-translate-y-1 hover:bg-teal-500"
            >
              Start Clock
            </button>
          </div>
        </section>

        {/* SECTION 1: DATA */}
        <section className="rounded-3xl border border-white/10 bg-black/30 p-8 shadow-sm md:p-12">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <div
                className={`mb-4 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase ${EMOM_ACCENT.badge} ${EMOM_ACCENT.badgeText}`}
              >
                Concept
              </div>
              <h2 className="font-display mb-4 text-3xl font-bold text-white">
                Autoregulated Rest
              </h2>
              <p className="mb-6 leading-relaxed text-white/80">
                EMOM teaches pacing under fatigue. In early rounds, you earn plenty of rest. As
                fatigue sets in, your work time extends, eating into your recovery. It forces you to
                find the most efficient way to move to &quot;buy back&quot; your time.
              </p>
            </div>

            <div>
              <div className="mb-6 flex items-center justify-between">
                <h3 className="font-bold text-white/90">Training Density</h3>
                <div className="flex rounded-lg bg-black/30 p-1">
                  <button
                    type="button"
                    onClick={() => setMetric('work_capacity')}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition ${metric === 'work_capacity' ? 'bg-teal-600 text-white' : 'text-white/60'}`}
                  >
                    Capacity
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetric('fatigue_rate')}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition ${metric === 'fatigue_rate' ? 'bg-orange-600 text-white' : 'text-white/60'}`}
                  >
                    Fatigue
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
                            metric === 'work_capacity' && index === 2
                              ? '#2dd4bf'
                              : metric === 'fatigue_rate' && index === 2
                                ? '#ea580c'
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
              className={`mb-4 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase ${EMOM_ACCENT.badge} ${EMOM_ACCENT.badgeText}`}
            >
              EMOM Simulator
            </div>
            <h2 className="font-display text-3xl font-bold text-white">The Pacing Game</h2>
            <p className="mt-2 text-white/70">See how speed buys time.</p>
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
                {simMode === 'fast' ? (
                  <span>
                    00:20 <span className="text-sm opacity-50">/ 40s Rest</span>
                  </span>
                ) : (
                  <span>
                    00:45 <span className="text-sm opacity-50">/ 15s Rest</span>
                  </span>
                )}
              </div>
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
                        stroke={simMode === 'fast' ? '#2dd4bf' : '#f97316'}
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
                    onClick={() => setSimMode('fast')}
                    className={`w-1/2 rounded-xl font-bold transition-all ${simMode === 'fast' ? 'scale-105 bg-teal-600 text-white shadow-lg' : 'border border-white/20 bg-transparent text-white/70 hover:text-white'}`}
                  >
                    FAST PACE
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimMode('slow')}
                    className={`w-1/2 rounded-xl font-bold transition-all ${simMode === 'slow' ? 'scale-105 bg-orange-600 text-white shadow-lg' : 'border border-white/20 bg-transparent text-white/70 hover:text-white'}`}
                  >
                    SLOW PACE
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 text-center">
            <button
              type="button"
              onClick={() => setIsDurationSelectOpen(true)}
              className="mx-auto flex items-center gap-3 rounded-full bg-teal-600 px-8 py-4 font-bold text-white shadow-2xl transition-all hover:scale-105 hover:bg-teal-500"
            >
              <span>⏱️</span>
              <span>Launch EMOM Timer</span>
            </button>
          </div>
        </section>

        {/* SECTION 3: VISUALIZER */}
        <section className="grid items-center gap-12 rounded-3xl border border-white/10 bg-black/30 p-8 shadow-2xl md:grid-cols-2 md:p-12">
          <div>
            <h2 className="font-display mb-6 text-3xl font-bold text-white">
              The Clockwork Visualizer
            </h2>
            <p className="mb-6 leading-relaxed text-white/80">
              The visualizer acts as a strict pacer. The minute hand sweeps relentlessly. The
              colored arc represents a standard work target (e.g., 20s or 45s). Your goal is to beat
              the clock every single time.
            </p>
            <button
              type="button"
              onClick={() => setIsReportOpen(true)}
              className="flex items-center gap-2 border-b border-teal-500/30 pb-0.5 text-sm font-bold text-teal-400 transition-colors hover:text-teal-300"
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
              aria-label={isTelemetryEnabled ? 'Disable telemetry audio' : 'Enable telemetry audio'}
              aria-pressed={isTelemetryEnabled}
              className="absolute right-4 top-4 z-20 text-white/60 transition-colors hover:text-white"
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
              aria-hidden
            />
            <div className="animate-zoom-in relative flex max-h-[calc(100vh-2rem)] w-full max-w-md shrink-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0d0500] shadow-2xl">
              <div className="shrink-0 border-b border-white/10 p-6 text-center">
                <h3 className="font-display text-xl font-bold text-white">Select Duration</h3>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
                <button
                  type="button"
                  onClick={() => startRealTimer(10)}
                  className="group w-full rounded-xl border-2 border-white/10 p-4 text-left transition-all hover:border-teal-500 hover:bg-teal-600/20"
                >
                  <div className="text-lg font-bold text-white">Short (10 Mins)</div>
                  <div className="text-xs font-medium text-white/60">
                    10 Rounds • High Intensity Tasks
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => startRealTimer(20)}
                  className="group w-full rounded-xl border-2 border-white/10 p-4 text-left transition-all hover:border-teal-500 hover:bg-teal-600/20"
                >
                  <div className="text-lg font-bold text-white">Standard (20 Mins)</div>
                  <div className="text-xs font-medium text-white/60">
                    20 Rounds • Endurance/Stamina
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => startRealTimer(30)}
                  className="group w-full rounded-xl border-2 border-white/10 p-4 text-left transition-all hover:border-teal-500 hover:bg-teal-600/20"
                >
                  <div className="text-lg font-bold text-white">Long (30 Mins)</div>
                  <div className="text-xs font-medium text-white/60">
                    30 Rounds • Mental Toughness
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

      {/* CUSTOM EMOM TIMER MODAL */}
      {isTimerOpen && (
        <div className="animate-zoom-in fixed inset-0 z-[200] flex h-full w-full flex-col bg-[#0d0500] duration-200">
          <div
            className={`flex shrink-0 items-center justify-between border-b border-white/10 p-4 text-white transition-colors duration-200 md:p-6 ${timerStyle.bg}`}
          >
            <div>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-widest opacity-80 md:text-xs">
                {timerState === 'setup'
                  ? 'Preparation'
                  : timerState === 'finished'
                    ? 'Complete'
                    : `Round ${cycleCount} of ${totalCycles}`}
              </div>
              <h3 className="font-display text-xl font-bold leading-tight md:text-3xl">
                {timerStyle.text}
              </h3>
              <p className="mt-1 text-xs opacity-90 md:text-sm">{timerStyle.sub}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsTimerOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/20 font-bold text-white hover:bg-black/40"
            >
              &times;
            </button>
          </div>

          <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden p-4">
            <div className="relative z-10 mb-6 text-center">
              <div
                className={`font-mono text-8xl font-bold tabular-nums leading-none tracking-tighter drop-shadow-2xl md:text-[180px] ${timerState === 'working' ? 'text-teal-400' : 'text-white/40'}`}
              >
                00:{formatTime(timerState === 'setup' ? timeLeft : secondsInMinute)}
              </div>

              {timerState === 'working' && (
                <div className="mt-8">
                  <button
                    type="button"
                    onClick={handleTaskComplete}
                    className="animate-pulse rounded-2xl bg-teal-500 px-12 py-6 text-xl font-bold text-black shadow-[0_0_40px_rgba(45,212,191,0.4)] hover:bg-teal-400"
                  >
                    TASK COMPLETE
                  </button>
                </div>
              )}

              {timerState === 'resting' && taskFinishedAt !== null && (
                <div className="animate-fade-in mt-8 text-center">
                  <div className="mb-2 text-sm uppercase tracking-widest text-white/60">
                    Rest Earned
                  </div>
                  <div className="text-4xl font-bold text-teal-400">{60 - taskFinishedAt}s</div>
                  <div className="mt-2 text-xs text-white/40">Wait for next minute</div>
                </div>
              )}
            </div>

            <div className="pointer-events-none absolute inset-0 opacity-20">
              <svg className="h-full w-full" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="2" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={timerState === 'working' ? '#2dd4bf' : '#475569'}
                  strokeWidth="2"
                  strokeDasharray={`${(timerState === 'setup' ? (SETUP_DURATION_SECONDS - timeLeft) / SETUP_DURATION_SECONDS : secondsInMinute / 60) * 251.2} 251.2`}
                  transform="rotate(-90 50 50)"
                />
              </svg>
            </div>
          </div>

          <div className="relative z-20 flex shrink-0 items-center justify-between gap-3 border-t border-white/10 bg-black p-4 md:p-8">
            <button
              type="button"
              onClick={() => setIsPaused(!isPaused)}
              className="w-1/3 rounded-xl border border-white/20 bg-white/10 px-4 py-3 font-bold text-white hover:bg-white/20 md:px-8 md:py-4"
            >
              {isPaused ? 'RESUME' : 'PAUSE'}
            </button>
            <button
              type="button"
              onClick={skipToNextPhase}
              className="w-1/3 rounded-xl px-4 py-3 font-bold text-white/60 hover:text-white md:px-8 md:py-4"
            >
              {timerState === 'setup' ? 'Skip setup' : 'SKIP'}
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
            aria-hidden
          />
          <div className="animate-zoom-in relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0d0500] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 p-6">
              <h3 className="font-display text-xl font-bold text-white">
                Every Minute on the Minute (EMOM)
              </h3>
              <button
                type="button"
                onClick={() => setIsReportOpen(false)}
                aria-label="Close protocol details"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 font-bold text-white hover:bg-teal-600/20 hover:text-teal-400"
              >
                &times;
              </button>
            </div>
            <div className="prose prose-invert max-w-none overflow-y-auto p-8 text-white/80">
              <p>
                EMOM is a high-density interval structure popular in CrossFit and athletic
                conditioning.
              </p>
              <h4 className="font-bold text-teal-400">The Logic</h4>
              <p>
                You select a task (e.g., 10 Burpees, 15 Kettlebell Swings) and perform it at the
                start of every minute. The remaining time in that minute is your rest period.
              </p>
              <h4 className="font-bold text-teal-400">The Physiological Effect</h4>
              <p>
                This forces you to maintain power output under accumulated fatigue. Unlike fixed
                rest intervals (like 30s work / 30s rest), EMOMs penalize slowness. If you slow down
                due to fatigue, your rest period gets shorter, making the next round even harder.
                This is potent mental and physical conditioning.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EmomInterval;
