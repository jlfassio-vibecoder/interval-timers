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

interface AerobicIntervalProps {
  onNavigate: (page: IntervalTimerPage) => void;
}

type MetricType = 'vo2' | 'lactate';
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

const ACCENT = getProtocolAccent('aerobic');

const AerobicInterval: React.FC<AerobicIntervalProps> = ({ onNavigate }) => {
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isTimerOpen, setIsTimerOpen] = useState(false);
  const [totalCycles, setTotalCycles] = useState(15);

  const aerobicTimeline = useMemo<HIITTimelineBlock[]>(() => {
    const blocks: HIITTimelineBlock[] = [getDefaultWarmupBlock()];
    for (let i = 0; i < totalCycles; i++) {
      blocks.push({ type: 'work', duration: 30, name: 'Power', notes: '90-100% VO2 Max' });
      blocks.push({ type: 'rest', duration: 30, name: 'Recover', notes: 'Active recovery' });
    }
    blocks.push({
      type: 'cooldown',
      duration: 120,
      name: 'Cool Down',
      notes: 'Return to baseline',
    });
    return blocks;
  }, [totalCycles]);

  const startWithCycles = (cycles: number) => {
    setTotalCycles(cycles);
    setIsSetupOpen(false);
    setIsTimerOpen(true);
  };

  const [metric, setMetric] = useState<MetricType>('vo2');

  const impactData = [
    { name: 'Steady State', vo2: 10, lactate: 2 },
    { name: '1:1 Interval', vo2: 25, lactate: 5 },
  ];

  const [simMode, setSimMode] = useState<SimMode>('work');
  const [intensityData, setIntensityData] = useState<{ time: number; value: number }[]>([]);

  useEffect(() => {
    const base = simMode === 'work' ? 140 : 90;
    const initialData = Array.from({ length: 30 }, (_, i) => ({
      time: i,
      value: base + (Math.random() * 8 - 4),
    }));
    setIntensityData(initialData);

    const interval = setInterval(() => {
      setIntensityData((prev) => {
        const newData = [...prev.slice(1)];
        const lastTime = prev[prev.length - 1].time;
        newData.push({
          time: lastTime + 1,
          value: base + (Math.random() * 8 - 4),
        });
        return newData;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [simMode]);

  const simContent: Record<SimMode, SimContent> = {
    work: {
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-600',
      borderColor: 'border-indigo-200',
      phase: 'Aerobic Power',
      status: 'Work Phase (30 Secs)',
      instruction:
        "Sustain a high-intensity output (90-100% VO2 Max). Unlike Tabata's all-out sprint, this is a controlled, powerful surge. Ideally suited for running, rowing, or cycling.",
      quote: 'Sustainability is the key to volume.',
      icon: '🌊',
    },
    rest: {
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-600',
      borderColor: 'border-cyan-200',
      phase: 'Active Recovery',
      status: 'Rest Phase (30 Secs)',
      instruction:
        'Keep moving at a very low intensity. Do not sit down. The goal is to clear just enough lactate to repeat the work interval with high quality.',
      quote: 'Refill the tank. Prepare to surge.',
      icon: '💧',
    },
  };

  const currentSim = simContent[simMode];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const [isTelemetryEnabled, setIsTelemetryEnabled] = useState(false);
  const lastBeatPhaseRef = useRef(0);
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

    const cycleDuration = 3000;
    const phase = (time % cycleDuration) / cycleDuration;

    const targetBpm = simMode === 'work' ? 140 : 90;
    const beatDuration = 60000 / targetBpm;
    const beatPhase = (time % beatDuration) / beatDuration;
    if (isTelemetryEnabled) {
      if (beatPhase < lastBeatPhaseRef.current) {
        playHeartbeat();
      }
    }
    lastBeatPhaseRef.current = beatPhase;

    const sine = Math.sin(phase * Math.PI * 2);
    const baseRadius = width * 0.25;
    const expansion = simMode === 'work' ? 60 : 20;
    const radius = baseRadius + Math.abs(sine) * expansion;

    const gradient = ctx.createRadialGradient(
      centerX,
      centerY,
      radius * 0.4,
      centerX,
      centerY,
      radius
    );
    if (simMode === 'work') {
      gradient.addColorStop(0, 'rgba(79, 70, 229, 0.8)');
      gradient.addColorStop(1, 'rgba(79, 70, 229, 0)');
    } else {
      gradient.addColorStop(0, 'rgba(6, 182, 212, 0.6)');
      gradient.addColorStop(1, 'rgba(6, 182, 212, 0)');
    }

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = simMode === 'work' ? '#312e81' : '#164e63';
    ctx.fill();

    ctx.font = 'bold 24px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(simMode === 'work' ? 'POWER' : 'RECOVER', centerX, centerY - 10);

    ctx.font = '14px Inter';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('1:1 Ratio', centerX, centerY + 15);

    requestRef.current = requestAnimationFrame(animateVisualizer);
  };

  useLayoutEffect(() => {
    requestRef.current = requestAnimationFrame((t) => {
      animateVisualizer(t);
    });
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    };
  }, [simMode]);

  const durationContent = (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => startWithCycles(10)}
        className="group w-full rounded-xl border-2 border-white/10 p-4 text-left transition-all hover:border-indigo-500 hover:bg-indigo-600/20"
      >
        <div className="text-lg font-bold text-white">Short Cap (10 Mins)</div>
        <div className="text-xs font-medium text-white/60">10 Cycles • High Intensity focus</div>
      </button>
      <button
        type="button"
        onClick={() => startWithCycles(15)}
        className="group w-full rounded-xl border-2 border-white/10 p-4 text-left transition-all hover:border-indigo-500 hover:bg-indigo-600/20"
      >
        <div className="text-lg font-bold text-white">Standard (15 Mins)</div>
        <div className="text-xs font-medium text-white/60">15 Cycles • Optimal Volume</div>
      </button>
      <button
        type="button"
        onClick={() => startWithCycles(20)}
        className="group w-full rounded-xl border-2 border-white/10 p-4 text-left transition-all hover:border-indigo-500 hover:bg-indigo-600/20"
      >
        <div className="text-lg font-bold text-white">Endurance (20 Mins)</div>
        <div className="text-xs font-medium text-white/60">20 Cycles • Stamina focus</div>
      </button>
    </div>
  );

  return (
    <>
      <IntervalTimerLanding currentProtocol="aerobic" onNavigate={onNavigate} accentTheme={ACCENT}>
        {/* HERO */}
        <section className="mx-auto max-w-4xl pt-8 text-center">
          <h1 className="font-display mb-6 text-4xl font-bold leading-tight text-white md:text-6xl">
            The <span className="text-indigo-400">Golden Ratio</span> of Endurance
          </h1>
          <p className="mb-10 text-xl leading-relaxed text-white/80">
            The <strong>1:1 Work-to-Rest Ratio</strong> (30s Work / 30s Rest). This protocol targets
            VO2 Max sustainability, allowing you to accumulate significant time at high intensity
            without the extreme fatigue of Tabata.
          </p>
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() =>
                document.getElementById('simulator')?.scrollIntoView({ behavior: 'smooth' })
              }
              className="rounded-xl bg-orange-light px-8 py-3 font-bold text-black shadow-lg transition-transform hover:-translate-y-1"
            >
              Experience 30/30
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
                Physiological Benefits
              </div>
              <h2 className="font-display mb-4 text-3xl font-bold text-white">
                Volume Driven Adaptation
              </h2>
              <p className="mb-6 leading-relaxed text-white/80">
                While Tabata forces adaptation through intensity, the 1:1 ratio forces adaptation
                through <strong>volume</strong>. By balancing the work and rest equally, athletes
                can maintain near-maximal cardiac output for 15-20 minutes, far longer than
                continuous steady-state training at that intensity.
              </p>
            </div>

            <div>
              <div className="mb-6 flex items-center justify-between">
                <h3 className="font-bold text-white/90">Accumulated Benefit</h3>
                <div className="flex rounded-lg bg-black/30 p-1">
                  <button
                    type="button"
                    onClick={() => setMetric('vo2')}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition ${metric === 'vo2' ? 'bg-indigo-600 text-white' : 'text-white/60'}`}
                  >
                    VO2 Peak
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetric('lactate')}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition ${metric === 'lactate' ? 'bg-cyan-600 text-white' : 'text-white/60'}`}
                  >
                    Threshold
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
                            metric === 'vo2'
                              ? index === 1
                                ? '#4f46e5'
                                : 'rgba(148,163,184,0.5)'
                              : index === 1
                                ? '#06b6d4'
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
              1:1 Simulator
            </div>
            <h2 className="font-display text-3xl font-bold text-white">30s Work / 30s Rest</h2>
            <p className="mt-2 text-white/70">Perfect balance between output and recovery.</p>
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
              <div className="font-mono text-3xl opacity-90">00:30</div>
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
                        stroke={simMode === 'work' ? '#4f46e5' : '#06b6d4'}
                        strokeWidth={3}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className={`rounded-xl border-l-4 bg-black/20 p-4 ${currentSim.borderColor}`}>
                  <h4 className="mb-2 font-bold text-white">Focus</h4>
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
                    className={`w-1/2 rounded-xl font-bold transition-all ${simMode === 'work' ? 'scale-105 bg-indigo-600 text-white shadow-lg' : 'border border-white/20 bg-transparent text-white/70 hover:text-white'}`}
                  >
                    30s POWER
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimMode('rest')}
                    className={`w-1/2 rounded-xl font-bold transition-all ${simMode === 'rest' ? 'scale-105 bg-cyan-600 text-white shadow-lg' : 'border border-white/20 bg-transparent text-white/70 hover:text-white'}`}
                  >
                    30s RECOVER
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 text-center">
            <button
              type="button"
              onClick={() => setIsSetupOpen(true)}
              className="mx-auto flex items-center gap-3 rounded-full bg-orange-light px-8 py-4 font-bold text-black shadow-2xl transition-all hover:scale-105"
            >
              <span>⏱️</span>
              <span>Launch 1:1 Timer</span>
            </button>
          </div>
        </section>

        {/* SECTION 3: VISUALIZER */}
        <section className="grid items-center gap-12 rounded-3xl border border-white/10 bg-black/30 p-8 shadow-2xl md:grid-cols-2 md:p-12">
          <div>
            <h2 className="font-display mb-6 text-3xl font-bold text-white">
              Aerobic Capacity Visualizer
            </h2>
            <p className="mb-6 leading-relaxed text-white/80">
              By extending the interval duration to 30 seconds, we recruit Type IIa muscle
              fibers—the &quot;hybrid&quot; fibers that can generate power but also possess
              endurance characteristics.
            </p>
            <button
              type="button"
              onClick={() => setIsReportOpen(true)}
              className="flex items-center gap-2 border-b border-indigo-400/40 pb-0.5 text-sm font-bold text-indigo-400 transition-colors hover:text-indigo-300"
            >
              <span>Read Protocol Details</span>
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
        protocolTitle="Select Duration"
        protocolSubtitle="Choose how many 30/30 cycles"
        workoutTitle=""
        workoutSubtitle=""
        onBack={() => {}}
        protocolContent={durationContent}
        workoutContent={<div />}
      />

      {typeof document !== 'undefined' &&
        isTimerOpen &&
        aerobicTimeline.length > 0 &&
        createPortal(
          <IntervalTimerOverlay
            timeline={aerobicTimeline}
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
          <div className="animate-zoom-in relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-bg-dark shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 p-6">
              <h3 className="font-display text-xl font-bold text-white">1:1 Ratio Protocol</h3>
              <button
                type="button"
                onClick={() => setIsReportOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 font-bold text-white hover:bg-indigo-600/20 hover:text-indigo-400"
              >
                &times;
              </button>
            </div>
            <div className="prose prose-invert max-w-none overflow-y-auto p-8 text-white/80">
              <p>The 30/30 protocol is the gold standard for aerobic power development.</p>
              <h4>Why 30 seconds?</h4>
              <p>
                30 seconds is long enough to ramp up cardiac output to near-maximal levels, but
                short enough to prevent massive lactate accumulation that would force you to stop.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AerobicInterval;
