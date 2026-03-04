import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { IntervalTimerLanding, IntervalTimerOverlay } from '@interval-timers/timer-ui';
import type { IntervalTimerPage } from '@interval-timers/timer-core';
import { getProtocolAccent } from '@interval-timers/timer-core';
import type { HIITTimelineBlock } from '@interval-timers/types';
import { getSetupBlock } from '@interval-timers/timer-core';
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

interface TimmonsIntervalProps {
  onNavigate?: (page: IntervalTimerPage) => void;
  onNavigateToLanding?: () => void;
}

type MetricType = 'glucose_uptake' | 'time_investment';
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

const TIMMONS_ACCENT = getProtocolAccent('timmons');

const TimmonsInterval: React.FC<TimmonsIntervalProps> = ({ onNavigate, onNavigateToLanding }) => {
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isTimerOpen, setIsTimerOpen] = useState(false);

  const timmonsTimeline = useMemo<HIITTimelineBlock[]>(() => {
    const blocks: HIITTimelineBlock[] = [getSetupBlock()];
    for (let i = 0; i < 3; i++) {
      blocks.push({
        type: 'work',
        duration: 20,
        name: '20s SPRINT',
        notes: 'All Out Max Effort',
      });
      blocks.push({
        type: 'rest',
        duration: 120,
        name: '2m RECOVER',
        notes: 'Gentle Movement',
      });
    }
    return blocks;
  }, []);

  const [metric, setMetric] = useState<MetricType>('glucose_uptake');

  const impactData = [
    { name: 'Walking (60m)', glucose_uptake: 20, time_investment: 100 },
    { name: 'Jogging (45m)', glucose_uptake: 40, time_investment: 75 },
    { name: 'Timmons (7m)', glucose_uptake: 95, time_investment: 10 },
  ];

  const [simMode, setSimMode] = useState<SimMode>('work');
  const [intensityData, setIntensityData] = useState<{ time: number; value: number }[]>([]);

  useEffect(() => {
    const base = simMode === 'work' ? 180 : 60;
    const initialData = Array.from({ length: 30 }, (_, i) => ({
      time: i,
      value: base + (Math.random() * 2 - 1),
    }));
    queueMicrotask(() => setIntensityData(initialData));

    const interval = setInterval(() => {
      setIntensityData((prev) => {
        if (prev.length === 0) return prev;
        const newData = [...prev.slice(1)];
        const lastTime = prev[prev.length - 1].time;
        const value = base + (Math.random() * 4 - 2);
        newData.push({ time: lastTime + 1, value });
        return newData;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [simMode]);

  const simContent: Record<SimMode, SimContent> = {
    work: {
      color: 'text-sky-500',
      bgColor: 'bg-sky-600',
      borderColor: 'border-sky-200',
      phase: 'Glycogen Depletion',
      status: 'Max Effort (20 Secs)',
      instruction:
        'Sprint, cycle, or row as fast as you possibly can. The goal is to rapidly deplete muscle glycogen, signalling the body to increase insulin sensitivity.',
      quote: '20 seconds to change your blood chemistry.',
      icon: '🧪',
    },
    rest: {
      color: 'text-slate-400',
      bgColor: 'bg-slate-700',
      borderColor: 'border-slate-600',
      phase: 'Active Recovery',
      status: 'Gentle Movement (2 Mins)',
      instruction:
        'Keep moving very slowly. This long recovery ensures you can hit the next 20-second interval with absolute maximum intensity.',
      quote: 'Minimum effective dose.',
      icon: '📉',
    },
  };

  const currentSim = simContent[simMode];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const animateRef = useRef<(time: number) => void>(() => {});
  const particlesRef = useRef<Array<{ angle: number; r: number; alpha: number; lineWidth: number }>>([]);
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

    if (simMode === 'work') {
      if (particlesRef.current.length === 0) {
        particlesRef.current = Array.from({ length: 20 }, () => ({
          angle: Math.random() * Math.PI * 2,
          r: Math.random() * 400,
          alpha: Math.random(),
          lineWidth: Math.random() * 3,
        }));
      }
      const maxR = width * 0.4;
      for (const p of particlesRef.current) {
        const r = (p.r / 400) * maxR;
        const x = centerX + Math.cos(p.angle) * r;
        const y = centerY + Math.sin(p.angle) * r;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.strokeStyle = `rgba(14, 165, 233, ${p.alpha})`;
        ctx.lineWidth = p.lineWidth;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(centerX, centerY, 20, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#0ea5e9';
    } else {
      ctx.shadowBlur = 0;
      const wavelength = 100;
      const amplitude = 10;

      ctx.beginPath();
      for (let x = 0; x < width; x += 5) {
        const y = centerY + Math.sin((x + time / 2) / wavelength) * amplitude;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.font = 'bold 24px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('RECOVER', centerX, centerY - 40);
    }

    requestRef.current = requestAnimationFrame((t) => animateRef.current(t));
  }, [simMode]);

  useEffect(() => {
    animateRef.current = animateVisualizer;
  }, [animateVisualizer]);

  useLayoutEffect(() => {
    particlesRef.current = [];
    requestRef.current = requestAnimationFrame((t) => animateVisualizer(t));
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    };
  }, [animateVisualizer]);

  return (
    <>
      <IntervalTimerLanding
        currentProtocol="timmons"
        onNavigate={onNavigate}
        onNavigateToLanding={onNavigateToLanding}
        accentTheme={TIMMONS_ACCENT}
        standalone={onNavigate == null}
        brandLabel="AI Fitness Guy"
      >
        {/* HERO */}
        <section className="mx-auto max-w-4xl pt-8 text-center">
          <h1 className="font-display mb-6 text-4xl font-bold leading-tight text-white md:text-6xl">
            Minimum <span className="text-sky-400">Effective</span> Dose
          </h1>
          <img
            src={`${import.meta.env.BASE_URL}logo_transparent_500x500.png`}
            alt="Interval Timers"
            className="mx-auto mb-10 h-28 w-28 object-contain md:h-36 md:w-36"
          />
          <p className="mb-10 text-xl leading-relaxed text-white/80">
            The <strong>Timmons Method</strong>. Developed by Dr. Jamie Timmons at Loughborough
            University. 20 seconds of all-out effort, 3 times, with 2-minute recovery intervals.
            Total time: 7 minutes. Clinically proven to improve insulin sensitivity.
          </p>
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() =>
                document.getElementById('simulator')?.scrollIntoView({ behavior: 'smooth' })
              }
              className="rounded-xl bg-[#ffbf00] px-8 py-3 font-bold text-black shadow-lg transition-transform hover:-translate-y-1"
            >
              7-Minute Biohack
            </button>
          </div>
        </section>

        {/* SECTION 1: DATA */}
        <section className="rounded-3xl border border-white/10 bg-black/30 p-8 shadow-sm md:p-12">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <div
                className={`mb-4 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase ${TIMMONS_ACCENT.badge} ${TIMMONS_ACCENT.badgeText}`}
              >
                Clinical Outcome
              </div>
              <h2 className="font-display mb-4 text-3xl font-bold text-white">Glucose Disposal</h2>
              <p className="mb-6 leading-relaxed text-white/80">
                The Timmons protocol demonstrates that just 1 minute of total high-intensity
                exercise (3 × 20s) per session, performed 3 times a week, can improve insulin
                sensitivity by an average of 24%. It challenges the dogma that long-duration cardio
                is necessary for metabolic health.
              </p>
            </div>

            <div>
              <div className="mb-6 flex items-center justify-between">
                <h3 className="font-bold text-white/90">Efficiency Index</h3>
                <div className="flex rounded-lg bg-black/30 p-1">
                  <button
                    type="button"
                    onClick={() => setMetric('glucose_uptake')}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition ${metric === 'glucose_uptake' ? 'bg-sky-500 text-white' : 'text-white/60'}`}
                  >
                    Glucose Impact
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetric('time_investment')}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition ${metric === 'time_investment' ? 'bg-slate-600 text-white' : 'text-white/60'}`}
                  >
                    Time Cost
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
                            metric === 'glucose_uptake' && index === 2
                              ? '#0ea5e9'
                              : metric === 'time_investment' && index === 2
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
              className={`mb-4 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase ${TIMMONS_ACCENT.badge} ${TIMMONS_ACCENT.badgeText}`}
            >
              7-Minute Simulator
            </div>
            <h2 className="font-display text-3xl font-bold text-white">20s Peak / 2m Rest</h2>
            <p className="mt-2 text-white/70">Brief, intense signals to your DNA.</p>
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
                {simMode === 'work' ? '00:20' : '02:00'}
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
                        stroke={simMode === 'work' ? '#0ea5e9' : '#475569'}
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
                    onClick={() => setSimMode('work')}
                    className={`w-1/2 rounded-xl font-bold transition-all ${simMode === 'work' ? 'scale-105 bg-sky-500 text-white shadow-lg' : 'border border-white/20 bg-transparent text-white/70 hover:text-white'}`}
                  >
                    20s SPRINT
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimMode('rest')}
                    className={`w-1/2 rounded-xl font-bold transition-all ${simMode === 'rest' ? 'scale-105 bg-slate-600 text-white shadow-lg' : 'border border-white/20 bg-transparent text-white/70 hover:text-white'}`}
                  >
                    2m RECOVER
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 text-center">
            <button
              type="button"
              onClick={() => setIsTimerOpen(true)}
              className="mx-auto flex items-center gap-3 rounded-full bg-sky-500 px-8 py-4 font-bold text-white shadow-2xl transition-all hover:scale-105 hover:bg-sky-600"
            >
              <span>⏱️</span>
              <span>Launch 7-Min Timer</span>
            </button>
          </div>
        </section>

        {/* SECTION 3: VISUALIZER */}
        <section className="grid items-center gap-12 rounded-3xl border border-white/10 bg-black/30 p-8 shadow-2xl md:grid-cols-2 md:p-12">
          <div>
            <h2 className="font-display mb-6 text-3xl font-bold text-white">Metabolic Spark</h2>
            <p className="mb-6 leading-relaxed text-white/80">
              The visualizer represents the core concept of the Timmons Method: a sudden, powerful
              spark of intensity against a backdrop of calm. This brief signal is enough to trigger
              a cascade of adaptive responses.
            </p>
            <button
              type="button"
              onClick={() => setIsReportOpen(true)}
              className="flex items-center gap-2 border-b border-sky-400/40 pb-0.5 text-sm font-bold text-sky-400 transition-colors hover:text-sky-300"
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

      {typeof document !== 'undefined' &&
        isTimerOpen &&
        timmonsTimeline.length > 0 &&
        createPortal(
          <IntervalTimerOverlay
            timeline={timmonsTimeline}
            onClose={() => setIsTimerOpen(false)}
            theme={{ workBg: TIMMONS_ACCENT.workBg }}
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
              <h3 className="font-display text-xl font-bold text-white">The Timmons Method</h3>
              <button
                type="button"
                onClick={() => setIsReportOpen(false)}
                aria-label="Close protocol details"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 font-bold text-white hover:bg-sky-600/20 hover:text-sky-400"
              >
                &times;
              </button>
            </div>
            <div className="prose prose-invert max-w-none overflow-y-auto p-8 text-white/80">
              <p>
                Developed by Dr. Jamie Timmons, a professor of systems biology at Loughborough
                University, this method challenges the &quot;volume&quot; model of exercise.
              </p>
              <h4 className="font-bold text-sky-500">The Science</h4>
              <p>
                The protocol relies on the fact that maximal exertion rapidly depletes muscle
                glycogen. This depletion signals the body to dramatically increase insulin
                sensitivity to replenish those stores. The 2-minute recovery allows for just enough
                ATP regeneration to perform the next sprint at max intensity.
              </p>
              <h4 className="font-bold text-sky-500">Why 7 Minutes?</h4>
              <p>
                3 rounds of 20 seconds work + 2 minutes rest equals exactly 7 minutes. It is
                designed to be the absolute minimum effective dose for metabolic health, fitting
                into even the busiest schedules.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TimmonsInterval;
