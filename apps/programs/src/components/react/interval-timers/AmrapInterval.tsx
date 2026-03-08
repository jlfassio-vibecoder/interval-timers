import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import IntervalTimerLanding from './IntervalTimerLanding';
import type { IntervalTimerPage } from './intervalTimerProtocols';
import { getProtocolAccent } from './intervalTimerProtocols';
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

interface AmrapIntervalProps {
  onNavigate: (page: IntervalTimerPage) => void;
}

type TimerState = 'idle' | 'warmup' | 'work' | 'finished';
type MetricType = 'mental_fortitude' | 'lactate_threshold';
type SimMode = 'pace' | 'push';

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

const AMRAP_ACCENT = getProtocolAccent('amrap');

const AmrapInterval: React.FC<AmrapIntervalProps> = ({ onNavigate }) => {
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isTimerOpen, setIsTimerOpen] = useState(false);
  const [isDurationSelectOpen, setIsDurationSelectOpen] = useState(false);
  const [timerState, setTimerState] = useState<TimerState>('idle');
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(12 * 60);
  const [roundsCompleted, setRoundsCompleted] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);

  const [metric, setMetric] = useState<MetricType>('mental_fortitude');

  const impactData = [
    { name: 'Fixed Reps', mental_fortitude: 40, lactate_threshold: 50 },
    { name: 'EMOM', mental_fortitude: 70, lactate_threshold: 75 },
    { name: 'AMRAP', mental_fortitude: 95, lactate_threshold: 90 },
  ];

  const [simMode, setSimMode] = useState<SimMode>('pace');
  const [intensityData, setIntensityData] = useState<{ time: number; value: number }[]>([]);

  useEffect(() => {
    const steps = 30;
    const slope = simMode === 'pace' ? 2 : 5;
    const data = Array.from({ length: steps }, (_, i) => ({
      time: i,
      value: i * slope + Math.random() * 5,
    }));
    setIntensityData(data);
  }, [simMode]);

  const simContent: Record<SimMode, SimContent> = {
    pace: {
      color: 'text-orange-400',
      bgColor: 'bg-orange-600',
      borderColor: 'border-orange-300',
      phase: 'Sustainable Grind',
      status: 'Steady State',
      instruction:
        'Find a rhythm you can hold for the entire duration. If you go too hard early ("fly and die"), your total volume will suffer. Break sets early to avoid failure.',
      quote: 'Slow is smooth. Smooth is fast.',
      icon: '🐢',
    },
    push: {
      color: 'text-red-500',
      bgColor: 'bg-red-600',
      borderColor: 'border-red-300',
      phase: 'Redline',
      status: 'Pain Cave',
      instruction:
        'You are pushing past the lactate threshold. This is necessary for the final minute, but dangerous in the first half. Use sparingly to break plateaus.',
      quote: 'Empty the tank.',
      icon: '🐇',
    },
  };

  const currentSim = simContent[simMode];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
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
      setIsTelemetryEnabled(false);
    }
  };

  const playSound = (type: 'start' | 'round' | 'warning' | 'finish') => {
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

      if (type === 'start') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.5);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.8);
        osc.start(now);
        osc.stop(now + 0.9);
      } else if (type === 'round') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.3);
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'warning') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.15);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.5);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.6);
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(150, now + 0.6);
        osc2.frequency.linearRampToValueAtTime(100, now + 1.1);
        gain2.gain.setValueAtTime(0.3, now + 0.6);
        gain2.gain.linearRampToValueAtTime(0, now + 1.1);
        osc2.start(now + 0.6);
        osc2.stop(now + 1.2);
      }
    } catch (e) {
      console.error(e);
    }
  };

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

    ctx.clearRect(0, 0, width, height);

    const cols = 5;
    const blockHeight = 40;
    const blockWidth = width / cols;
    const speed = simMode === 'pace' ? 0.001 : 0.003;
    const totalBlocksSimulated = Math.floor(time * speed) % 25;

    for (let i = 0; i < totalBlocksSimulated; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const y = height - (row + 1) * blockHeight;
      const x = col * blockWidth;

      ctx.fillStyle = i === totalBlocksSimulated - 1 ? '#fb923c' : '#ea580c';
      ctx.fillRect(x + 2, y + 2, blockWidth - 4, blockHeight - 4);
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(x + 2, y + 2 + blockHeight / 2, blockWidth - 4, blockHeight / 2 - 4);
    }

    ctx.font = 'bold 40px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillText('VOLUME', width / 2, height / 2);

    requestRef.current = requestAnimationFrame(animateVisualizer);
  };

  useLayoutEffect(() => {
    requestRef.current = requestAnimationFrame((t) => animateVisualizer(t));
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    };
  }, [simMode]);

  const startRealTimer = (minutes: number) => {
    setTotalTime(minutes * 60);
    setTimeLeft(10);
    setIsDurationSelectOpen(false);
    setIsTimerOpen(true);
    setTimerState('warmup');
    setRoundsCompleted(0);
    setIsPaused(false);
    playSound('warning');
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

  const logRound = () => {
    if (timerState === 'work') {
      setRoundsCompleted((prev) => prev + 1);
      playSound('round');
    }
  };

  useEffect(() => {
    let interval: number | undefined;
    if (isTimerOpen && !isPaused && timerState !== 'idle' && timerState !== 'finished') {
      interval = window.setInterval(() => {
        if (timerState === 'warmup') {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              setTimerState('work');
              setTimeLeft(totalTime);
              playSound('start');
              return totalTime;
            }
            if (prev <= 4) playSound('warning');
            return prev - 1;
          });
        } else if (timerState === 'work') {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              setTimerState('finished');
              playSound('finish');
              return 0;
            }
            if (prev <= 11 && prev > 1) playSound('warning');
            return prev - 1;
          });
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerOpen, isPaused, timerState, totalTime]);

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
        return { bg: 'bg-stone-800', text: 'Prepare', sub: 'Protocol Starting' };
      case 'work':
        return { bg: 'bg-orange-600', text: 'AMRAP', sub: 'Accumulate Volume' };
      case 'finished':
        return { bg: 'bg-stone-900', text: 'Time Cap', sub: 'Work Complete' };
      default:
        return { bg: 'bg-stone-800', text: 'Ready', sub: '' };
    }
  };

  const timerStyle = getTimerStyles();

  return (
    <>
      <IntervalTimerLanding
        currentProtocol="amrap"
        onNavigate={onNavigate}
        accentTheme={AMRAP_ACCENT}
      >
        {/* HERO */}
        <section className="mx-auto max-w-4xl pt-8 text-center">
          <h1 className="font-display mb-6 text-4xl font-bold leading-tight text-white md:text-6xl">
            As Many Rounds <span className="text-orange-400">As Possible</span>
          </h1>
          <p className="mb-10 text-xl leading-relaxed text-white/80">
            <strong>AMRAP</strong>. A test of mental fortitude and work capacity. You have a fixed
            time window. Your goal is to complete as much work as possible within that window. There
            is no scheduled rest; you rest only when you must.
          </p>
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() =>
                document.getElementById('simulator')?.scrollIntoView({ behavior: 'smooth' })
              }
              className="bg-orange-600 hover:bg-orange-500 rounded-xl px-8 py-3 font-bold text-white shadow-[0_0_20px_rgba(234,88,12,0.4)] transition-transform hover:-translate-y-1"
            >
              Start Timer
            </button>
          </div>
        </section>

        {/* SECTION 1: DATA */}
        <section className="rounded-3xl border border-white/10 bg-black/30 p-8 shadow-sm md:p-12">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <div
                className={`mb-4 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase ${AMRAP_ACCENT.badge} ${AMRAP_ACCENT.badgeText}`}
              >
                Metabolic Density
              </div>
              <h2 className="font-display mb-4 text-3xl font-bold text-white">Volume Training</h2>
              <p className="mb-6 leading-relaxed text-white/80">
                AMRAP workouts are designed to increase work capacity. Unlike interval training
                which dictates rest, AMRAP forces you to manage your own fatigue. The result is a
                high metabolic cost and significant improvements in lactate tolerance.
              </p>
            </div>

            <div>
              <div className="mb-6 flex items-center justify-between">
                <h3 className="font-bold text-white/90">Stimulus Profile</h3>
                <div className="flex rounded-lg bg-black/30 p-1">
                  <button
                    type="button"
                    onClick={() => setMetric('mental_fortitude')}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition ${metric === 'mental_fortitude' ? 'bg-orange-600 text-white' : 'text-white/60'}`}
                  >
                    Mental
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetric('lactate_threshold')}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition ${metric === 'lactate_threshold' ? 'bg-red-600 text-white' : 'text-white/60'}`}
                  >
                    Lactate
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
                            metric === 'mental_fortitude' && index === 2
                              ? '#ea580c'
                              : metric === 'lactate_threshold' && index === 2
                                ? '#dc2626'
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
              className={`mb-4 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase ${AMRAP_ACCENT.badge} ${AMRAP_ACCENT.badgeText}`}
            >
              Pacing Strategy
            </div>
            <h2 className="font-display text-3xl font-bold text-white">Find Your Line</h2>
            <p className="mt-2 text-white/70">Steady accumulation vs. early burnout.</p>
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
              <div className="font-mono text-3xl opacity-90">12:00</div>
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
                        stroke={simMode === 'pace' ? '#fb923c' : '#dc2626'}
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
                    onClick={() => setSimMode('pace')}
                    className={`w-1/2 rounded-xl font-bold transition-all ${simMode === 'pace' ? 'bg-orange-600 scale-105 text-white shadow-lg' : 'border border-white/20 bg-transparent text-white/70 hover:text-white'}`}
                  >
                    PACING
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimMode('push')}
                    className={`w-1/2 rounded-xl font-bold transition-all ${simMode === 'push' ? 'scale-105 bg-red-600 text-white shadow-lg' : 'border border-white/20 bg-transparent text-white/70 hover:text-white'}`}
                  >
                    REDLINING
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 text-center">
            <button
              type="button"
              onClick={() => setIsDurationSelectOpen(true)}
              className="bg-orange-600 hover:bg-orange-500 mx-auto flex items-center gap-3 rounded-full px-8 py-4 font-bold text-white shadow-2xl transition-all hover:scale-105"
            >
              <span>⏱️</span>
              <span>Launch AMRAP Timer</span>
            </button>
          </div>
        </section>

        {/* SECTION 3: VISUALIZER */}
        <section className="grid items-center gap-12 rounded-3xl border border-white/10 bg-black/30 p-8 shadow-2xl md:grid-cols-2 md:p-12">
          <div>
            <h2 className="font-display mb-6 text-3xl font-bold text-white">The Density Stacker</h2>
            <p className="mb-6 leading-relaxed text-white/80">
              In AMRAP, every round is a brick in the wall. The goal is to stack them as high as
              possible before the clock runs out. This visualizer builds a structure representing
              your accumulated volume.
            </p>
            <button
              type="button"
              onClick={() => setIsReportOpen(true)}
              className="border-orange-500/30 text-orange-400 hover:text-orange-300 flex items-center gap-2 border-b pb-0.5 text-sm font-bold transition-colors"
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
                <h3 className="font-display text-xl font-bold text-white">Select Time Cap</h3>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
                <button
                  type="button"
                  onClick={() => startRealTimer(5)}
                  className="hover:border-orange-500 hover:bg-orange-600/20 group w-full rounded-xl border-2 border-white/10 p-4 text-left transition-all"
                >
                  <div className="text-lg font-bold text-white">Sprint (5 Mins)</div>
                  <div className="text-xs font-medium text-white/60">High intensity, zero rest</div>
                </button>
                <button
                  type="button"
                  onClick={() => startRealTimer(12)}
                  className="hover:border-orange-500 hover:bg-orange-600/20 group w-full rounded-xl border-2 border-white/10 p-4 text-left transition-all"
                >
                  <div className="text-lg font-bold text-white">Standard (12 Mins)</div>
                  <div className="text-xs font-medium text-white/60">
                    Classic CrossFit time domain
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => startRealTimer(20)}
                  className="hover:border-orange-500 hover:bg-orange-600/20 group w-full rounded-xl border-2 border-white/10 p-4 text-left transition-all"
                >
                  <div className="text-lg font-bold text-white">Endurance (20 Mins)</div>
                  <div className="text-xs font-medium text-white/60">Pacing is critical</div>
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

      {/* CUSTOM AMRAP TIMER MODAL */}
      {isTimerOpen && (
        <div className="animate-zoom-in fixed inset-0 z-[200] flex h-full w-full flex-col bg-bg-dark duration-200">
          <div
            className={`flex shrink-0 items-center justify-between border-b border-white/10 p-4 text-white transition-colors duration-200 md:p-6 ${timerStyle.bg}`}
          >
            <div>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-widest opacity-80 md:text-xs">
                {timerState === 'warmup'
                  ? 'Preparation'
                  : timerState === 'finished'
                    ? 'Complete'
                    : 'Time Remaining'}
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
                className={`font-mono text-8xl font-bold tabular-nums leading-none tracking-tighter drop-shadow-2xl md:text-[180px] ${timerState === 'work' ? 'text-orange-500' : 'text-white/40'}`}
              >
                {formatTime(timeLeft)}
              </div>

              {timerState === 'work' && (
                <div className="mt-8 flex flex-col items-center">
                  <div className="mb-4 text-sm font-bold uppercase tracking-widest text-white/60">
                    Rounds Completed
                  </div>
                  <div className="mb-6 text-6xl font-bold text-white">{roundsCompleted}</div>
                  <button
                    type="button"
                    onClick={logRound}
                    className="bg-orange-600 hover:bg-orange-500 rounded-2xl px-12 py-6 text-xl font-bold text-white shadow-[0_0_40px_rgba(234,88,12,0.4)] transition-all active:scale-95"
                  >
                    LOG ROUND
                  </button>
                </div>
              )}
            </div>

            <div className="pointer-events-none absolute inset-0 flex items-end justify-center px-4 pb-0 opacity-20">
              <div className="flex h-1/2 w-full max-w-3xl flex-wrap-reverse content-end justify-center gap-1">
                {Array.from({ length: roundsCompleted }).map((_, i) => (
                  <div key={i} className="animate-zoom-in bg-orange-500 h-8 w-12 rounded-sm" />
                ))}
              </div>
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
              onClick={() => {
                setTimerState('finished');
                setTimeLeft(0);
              }}
              className="w-1/3 rounded-xl px-4 py-3 font-bold text-white/60 hover:text-white md:px-8 md:py-4"
            >
              FINISH
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
          <div className="animate-zoom-in relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-bg-dark shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 p-6">
              <h3 className="font-display text-xl font-bold text-white">
                AMRAP (As Many Rounds As Possible)
              </h3>
              <button
                type="button"
                onClick={() => setIsReportOpen(false)}
                className="hover:bg-orange-600/20 hover:text-orange-400 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 font-bold text-white"
              >
                &times;
              </button>
            </div>
            <div className="prose prose-invert max-w-none overflow-y-auto p-8 text-white/80">
              <p>
                AMRAP is a time-priority workout structure. The time is fixed, and the work is the
                variable.
              </p>
              <h4 className="text-orange-500 font-bold">Mental Fortitude</h4>
              <p>
                Because there is no built-in rest, AMRAPs require constant decision making. &quot;Do
                I rest now or do one more rep?&quot; This builds a specific type of mental toughness
                related to suffering and pacing.
              </p>
              <h4 className="text-orange-500 font-bold">Strategy</h4>
              <p>
                In short AMRAPs (5-8 mins), the intensity is high (threshold/VO2 max). In longer
                AMRAPs (15-20+ mins), pacing is aerobic. The &quot;Concrete&quot; theme represents
                the foundational volume you are building with every rep.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AmrapInterval;
