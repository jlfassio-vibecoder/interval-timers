import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import IntervalTimerLanding from './IntervalTimerLanding';
import IntervalTimerSetupModal from './IntervalTimerSetupModal';
import IntervalTimerOverlay from './IntervalTimerOverlay';
import type { IntervalTimerPage } from './intervalTimerProtocols';
import { getProtocolAccent } from './intervalTimerProtocols';
import type { HIITTimelineBlock } from '@/types/ai-workout';
import { getDefaultWarmupBlock } from './interval-timer-warmup';
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

interface PhosphagenIntervalProps {
  onNavigate: (page: IntervalTimerPage) => void;
}

type MetricType = 'power' | 'capacity';
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

const ACCENT = getProtocolAccent('phosphagen');

const PhosphagenInterval: React.FC<PhosphagenIntervalProps> = ({ onNavigate }) => {
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isTimerOpen, setIsTimerOpen] = useState(false);
  const [totalCycles, setTotalCycles] = useState(10);

  const phosphagenTimeline = useMemo<HIITTimelineBlock[]>(() => {
    const blocks: HIITTimelineBlock[] = [getDefaultWarmupBlock()];
    for (let i = 0; i < totalCycles; i++) {
      blocks.push({
        type: 'work',
        duration: 15,
        name: 'EXPLODE',
        notes: '15s Max Power',
      });
      blocks.push({
        type: 'rest',
        duration: 45,
        name: 'RECHARGE',
        notes: '45s Passive Rest',
      });
    }
    blocks.push({ type: 'cooldown', duration: 180, name: 'Cool Down', notes: 'System Reset' });
    return blocks;
  }, [totalCycles]);

  const startWithCycles = (cycles: number) => {
    setTotalCycles(cycles);
    setIsSetupOpen(false);
    setIsTimerOpen(true);
  };

  const [metric, setMetric] = useState<MetricType>('power');

  const impactData = [
    { name: 'Endurance', power: 10, capacity: 90 },
    { name: 'Tabata', power: 60, capacity: 70 },
    { name: 'Phosphagen', power: 95, capacity: 20 },
  ];

  const [simMode, setSimMode] = useState<SimMode>('work');
  const [intensityData, setIntensityData] = useState<{ time: number; value: number }[]>([]);

  useEffect(() => {
    const base = simMode === 'work' ? 190 : 20;
    const initialData = Array.from({ length: 30 }, (_, i) => ({
      time: i,
      value: base + (Math.random() * 2 - 1),
    }));
    setIntensityData(initialData);

    const interval = setInterval(() => {
      setIntensityData((prev) => {
        const newData = [...prev.slice(1)];
        const lastTime = prev[prev.length - 1].time;
        const noise = simMode === 'work' ? 15 : 2;
        const value = base + (Math.random() * noise - noise / 2);
        newData.push({ time: lastTime + 1, value });
        return newData;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [simMode]);

  const simContent: Record<SimMode, SimContent> = {
    work: {
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-600',
      borderColor: 'border-yellow-200',
      phase: 'ATP Dump',
      status: 'Explosion (15 Secs)',
      instruction:
        'Move as fast as humanly possible. You are emptying the Creatine Phosphate tank. If you are pacing yourself, you are doing it wrong. 100% Recruitment.',
      quote: 'Speed is the only metric.',
      icon: '⚡',
    },
    rest: {
      color: 'text-zinc-400',
      bgColor: 'bg-zinc-600',
      borderColor: 'border-zinc-700',
      phase: 'Recharge',
      status: 'Neural Recovery (45 Secs)',
      instruction:
        'Walk very slowly or stand still. Shake out the limbs. You need 45s to replenish ~70% of your ATP-CP stores. Do not rush the next rep.',
      quote: 'Wait for the lightning to strike again.',
      icon: '🔋',
    },
  };

  const currentSim = simContent[simMode];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
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
      setIsTelemetryEnabled(false);
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
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);

    const drawLightning = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      displacement: number
    ) => {
      if (displacement < 2) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        ctx.stroke();
        return;
      }
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const displacedX = midX + (Math.random() - 0.5) * displacement;
      const displacedY = midY + (Math.random() - 0.5) * displacement;
      drawLightning(x1, y1, displacedX, displacedY, displacement / 2);
      drawLightning(displacedX, displacedY, x2, y2, displacement / 2);
    };

    if (simMode === 'work') {
      for (let i = 0; i < 3; i++) {
        const angle = Math.random() * Math.PI * 2;
        const len = width * 0.4;
        const endX = centerX + Math.cos(angle) * len;
        const endY = centerY + Math.sin(angle) * len;
        drawLightning(centerX, centerY, endX, endY, 50);
      }
      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        10,
        centerX,
        centerY,
        width * 0.4
      );
      gradient.addColorStop(0, 'rgba(250, 204, 21, 0.5)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    } else {
      const cycleDuration = 3000;
      const phase = (time % cycleDuration) / cycleDuration;
      const radius = width * 0.3;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * phase, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(250, 204, 21, ${0.5 - Math.abs(0.5 - phase)})`;
      ctx.fill();
    }

    ctx.font = 'bold 24px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(simMode === 'work' ? 'VOLTAGE' : 'RECHARGE', centerX, centerY);

    requestRef.current = requestAnimationFrame(animateVisualizer);
  };

  useLayoutEffect(() => {
    requestRef.current = requestAnimationFrame((t) => animateVisualizer(t));
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    };
  }, [simMode]);

  const durationContent = (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => startWithCycles(5)}
        className="group w-full rounded-xl border-2 border-white/10 p-4 text-left transition-all hover:border-yellow-500 hover:bg-yellow-600/20"
      >
        <div className="text-lg font-bold text-white">Starter (5 Mins)</div>
        <div className="text-xs font-medium text-white/60">5 Cycles • Intro to Speed</div>
      </button>
      <button
        type="button"
        onClick={() => startWithCycles(10)}
        className="group w-full rounded-xl border-2 border-white/10 p-4 text-left transition-all hover:border-yellow-500 hover:bg-yellow-600/20"
      >
        <div className="text-lg font-bold text-white">Standard (10 Mins)</div>
        <div className="text-xs font-medium text-white/60">10 Cycles • Pure Speed Endurance</div>
      </button>
      <button
        type="button"
        onClick={() => startWithCycles(15)}
        className="group w-full rounded-xl border-2 border-white/10 p-4 text-left transition-all hover:border-yellow-500 hover:bg-yellow-600/20"
      >
        <div className="text-lg font-bold text-white">Pro (15 Mins)</div>
        <div className="text-xs font-medium text-white/60">15 Cycles • Elite Capacity</div>
      </button>
    </div>
  );

  return (
    <>
      <IntervalTimerLanding
        currentProtocol="phosphagen"
        onNavigate={onNavigate}
        accentTheme={ACCENT}
      >
        {/* HERO */}
        <section className="mx-auto max-w-4xl pt-8 text-center">
          <h1 className="font-display mb-6 text-4xl font-bold leading-tight text-white md:text-6xl">
            Pure Explosive <span className="text-yellow-400">Power</span>
          </h1>
          <p className="mb-10 text-xl leading-relaxed text-white/80">
            The <strong>1:3 Work-to-Rest Ratio</strong> (15s Work / 45s Rest). This protocol targets
            the ATP-PC system—the body&apos;s immediate, high-power energy source. It emphasizes
            speed and neural drive over metabolic conditioning.
          </p>
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() =>
                document.getElementById('simulator')?.scrollIntoView({ behavior: 'smooth' })
              }
              className="rounded-xl bg-[#ffbf00] px-8 py-3 font-bold text-black shadow-lg transition-transform hover:-translate-y-1"
            >
              Ignite System
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
                Energy System
              </div>
              <h2 className="font-display mb-4 text-3xl font-bold text-white">
                The ATP-PC Battery
              </h2>
              <p className="mb-6 leading-relaxed text-white/80">
                Your muscles store enough Adenosine Triphosphate (ATP) for about 2 seconds of max
                effort. The Phosphocreatine (PC) system can resynthesize ATP for another 10–12
                seconds. After 15 seconds, power drops drastically as you shift to glycolysis. This
                protocol trains that specific 15-second window.
              </p>
            </div>

            <div>
              <div className="mb-6 flex items-center justify-between">
                <h3 className="font-bold text-white/90">System Comparison</h3>
                <div className="flex rounded-lg bg-black/30 p-1">
                  <button
                    type="button"
                    onClick={() => setMetric('power')}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition ${metric === 'power' ? 'bg-yellow-600 text-white' : 'text-white/60'}`}
                  >
                    Peak Power
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetric('capacity')}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition ${metric === 'capacity' ? 'bg-slate-600 text-white' : 'text-white/60'}`}
                  >
                    Capacity
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
                            metric === 'power' && index === 2 ? '#eab308' : 'rgba(148,163,184,0.5)'
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
              1:3 Simulator
            </div>
            <h2 className="font-display text-3xl font-bold text-white">15s Max / 45s Recovery</h2>
            <p className="mt-2 text-white/70">Short bursts. Long recharge. Pure quality.</p>
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
                {simMode === 'work' ? '00:15' : '00:45'}
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
                        stroke={simMode === 'work' ? '#eab308' : '#52525b'}
                        strokeWidth={2}
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
                    className={`w-1/2 rounded-xl font-bold transition-all ${simMode === 'work' ? 'scale-105 bg-yellow-600 text-white shadow-lg' : 'border border-white/20 bg-transparent text-white/70 hover:text-white'}`}
                  >
                    15s ZAP
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimMode('rest')}
                    className={`w-1/2 rounded-xl font-bold transition-all ${simMode === 'rest' ? 'scale-105 bg-zinc-600 text-white shadow-lg' : 'border border-white/20 bg-transparent text-white/70 hover:text-white'}`}
                  >
                    45s CHARGE
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 text-center">
            <button
              type="button"
              onClick={() => setIsSetupOpen(true)}
              className="mx-auto flex items-center gap-3 rounded-full bg-[#ffbf00] px-8 py-4 font-bold text-black shadow-2xl transition-all hover:scale-105"
            >
              <span>⏱️</span>
              <span>Launch 1:3 Timer</span>
            </button>
          </div>
        </section>

        {/* SECTION 3: VISUALIZER */}
        <section className="grid items-center gap-12 rounded-3xl border border-white/10 bg-black/30 p-8 shadow-2xl md:grid-cols-2 md:p-12">
          <div>
            <h2 className="font-display mb-6 text-3xl font-bold text-white">Voltage Visualizer</h2>
            <p className="mb-6 leading-relaxed text-white/80">
              High recruitment training is about neural drive. The visualizer represents the
              chaotic, high-frequency discharge of motor units during the work phase, and the slow
              chemical resynthesis during rest.
            </p>
            <button
              type="button"
              onClick={() => setIsReportOpen(true)}
              className="flex items-center gap-2 border-b border-yellow-400/40 pb-0.5 text-sm font-bold text-yellow-400 transition-colors hover:text-yellow-300"
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
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
        step="protocol"
        protocolTitle="Select Volume"
        protocolSubtitle="Choose how many 15/45 cycles"
        workoutTitle=""
        workoutSubtitle=""
        onBack={() => {}}
        protocolContent={durationContent}
        workoutContent={<div />}
      />

      {typeof document !== 'undefined' &&
        isTimerOpen &&
        phosphagenTimeline.length > 0 &&
        createPortal(
          <IntervalTimerOverlay
            timeline={phosphagenTimeline}
            onClose={() => setIsTimerOpen(false)}
            theme={{ workBg: ACCENT.workBg }}
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
                1:3 Ratio (Phosphagen Focus)
              </h3>
              <button
                type="button"
                onClick={() => setIsReportOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 font-bold text-white hover:bg-yellow-600/20 hover:text-yellow-400"
              >
                &times;
              </button>
            </div>
            <div className="prose prose-invert max-w-none overflow-y-auto p-8 text-white/80">
              <p>The 15/45 protocol targets the Phosphagen (ATP-PC) energy system.</p>
              <h4 className="text-lg font-bold text-yellow-500">Why 15 seconds?</h4>
              <p>
                15 seconds is the upper limit of the body&apos;s ability to use stored ATP and
                Phosphocreatine without significant help from the glycolytic system (which produces
                lactate).
              </p>
              <h4 className="text-lg font-bold text-yellow-500">Why 45 seconds rest?</h4>
              <p>
                It takes approximately 3 minutes to fully replenish ATP stores, but about 45–60
                seconds to replenish enough to perform another high-quality rep. This incomplete but
                substantial rest allows for high power output accumulation.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PhosphagenInterval;
