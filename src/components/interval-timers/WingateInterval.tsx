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

interface WingateIntervalProps {
  onNavigate: (page: IntervalTimerPage) => void;
}

type MetricType = 'peak_power' | 'fatigue';
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

const WINGATE_ACCENT = getProtocolAccent('wingate');

const WingateInterval: React.FC<WingateIntervalProps> = ({ onNavigate }) => {
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isTimerOpen, setIsTimerOpen] = useState(false);
  const [totalCycles, setTotalCycles] = useState(4);

  const wingateTimeline = useMemo<HIITTimelineBlock[]>(() => {
    const blocks: HIITTimelineBlock[] = [getDefaultWarmupBlock()];
    for (let i = 0; i < totalCycles; i++) {
      blocks.push({
        type: 'work',
        duration: 30,
        name: '30s SPRINT',
        notes: 'All Out Supra-Maximal',
      });
      blocks.push({
        type: 'rest',
        duration: 240,
        name: '4m RECOVER',
        notes: 'Spin Easy • Flush the Acid',
      });
    }
    blocks.push({ type: 'cooldown', duration: 300, name: 'Cool Down', notes: '5 Mins Easy Spin' });
    return blocks;
  }, [totalCycles]);

  const startWithCycles = (cycles: number) => {
    setTotalCycles(cycles);
    setIsSetupOpen(false);
    setIsTimerOpen(true);
  };

  const [metric, setMetric] = useState<MetricType>('peak_power');

  const impactData = [
    { name: 'Endurance', peak_power: 20, fatigue: 5 },
    { name: 'Tabata', peak_power: 70, fatigue: 40 },
    { name: 'Wingate', peak_power: 100, fatigue: 95 },
  ];

  const [simMode, setSimMode] = useState<SimMode>('work');
  const [intensityData, setIntensityData] = useState<{ time: number; value: number }[]>([]);

  useEffect(() => {
    // Wingate power curve: peak ~200 at t=0, decay 40-50% by t=30 (authentic protocol profile)
    const getWingatePower = (t: number) => {
      const decay = 200 * Math.exp(-0.025 * t);
      const noise = Math.random() * 6 - 3;
      return Math.max(80, decay + noise);
    };

    const initialData = Array.from({ length: 30 }, (_, i) => ({
      time: i,
      value: simMode === 'work' ? getWingatePower(i) : 40 + (Math.random() * 5 - 2.5),
    }));
    setIntensityData(initialData);

    const interval = setInterval(() => {
      setIntensityData((prev) => {
        const newData = [...prev.slice(1)];
        const lastTime = prev[prev.length - 1].time;
        const t = (lastTime + 1) % 30;

        const value = simMode === 'work' ? getWingatePower(t) : 40 + (Math.random() * 5 - 2.5);

        newData.push({ time: lastTime + 1, value });
        return newData;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [simMode]);

  const simContent: Record<SimMode, SimContent> = {
    work: {
      color: 'text-lime-400',
      bgColor: 'bg-lime-600',
      borderColor: 'border-lime-200',
      phase: 'Supra-Maximal',
      status: 'All Out (30 Secs)',
      instruction:
        'This is 100% effort against high resistance. Go as fast as possible instantly. Your power WILL fade after 10-15 seconds. Fight the fade. Do not pace yourself. Empty the tank.',
      quote: 'Embrace the nausea.',
      icon: '☣️',
    },
    rest: {
      color: 'text-fuchsia-300',
      bgColor: 'bg-fuchsia-900',
      borderColor: 'border-fuchsia-800',
      phase: 'Deep Recovery',
      status: 'Flush (4 Mins)',
      instruction:
        'Spin very lightly with zero resistance. You have 4 minutes because you need it. Your ATP-PC system is fully depleted and your blood is acidic. Breathe.',
      quote: 'Survive the crash.',
      icon: '🧘',
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
      const ctx = new AudioContextCtor();
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

    if (simMode === 'work') {
      const spikes = 12;
      const outerRadius = width * 0.45;
      const innerRadius = width * 0.2;

      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const angle = (Math.PI * i) / spikes + time / 200;
        const r = i % 2 === 0 ? outerRadius + Math.random() * 20 : innerRadius + Math.random() * 10;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(132, 204, 22, 0.8)';
      ctx.fill();
      ctx.strokeStyle = '#ecfccb';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.font = '900 24px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#000';
      ctx.fillText('MAX EFFORT', centerX, centerY);
    } else {
      const pulse = Math.sin(time / 1000) * 0.1 + 1;
      const radius = width * 0.25 * pulse;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(162, 28, 175, 0.5)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(162, 28, 175, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = 'bold 20px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#e879f9';
      ctx.fillText('RECOVER', centerX, centerY);
    }

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
        onClick={() => startWithCycles(4)}
        className="group w-full rounded-xl border-2 border-white/10 p-4 text-left transition-all hover:border-lime-500 hover:bg-lime-600/20"
      >
        <div className="text-lg font-bold text-white">Novice (4 Cycles)</div>
        <div className="text-xs font-medium text-white/60">
          ~20 Mins Total • Hard but manageable
        </div>
      </button>
      <button
        type="button"
        onClick={() => startWithCycles(5)}
        className="group w-full rounded-xl border-2 border-white/10 p-4 text-left transition-all hover:border-lime-500 hover:bg-lime-600/20"
      >
        <div className="text-lg font-bold text-white">Athlete (5 Cycles)</div>
        <div className="text-xs font-medium text-white/60">~25 Mins Total • Very challenging</div>
      </button>
      <button
        type="button"
        onClick={() => startWithCycles(6)}
        className="group w-full rounded-xl border-2 border-white/10 p-4 text-left transition-all hover:border-lime-500 hover:bg-lime-600/20"
      >
        <div className="text-lg font-bold text-white">Elite (6 Cycles)</div>
        <div className="text-xs font-medium text-white/60">
          ~30 Mins Total • The full &quot;Puke Test&quot;
        </div>
      </button>
    </div>
  );

  return (
    <>
      <IntervalTimerLanding
        currentProtocol="wingate"
        onNavigate={onNavigate}
        accentTheme={WINGATE_ACCENT}
      >
        {/* HERO */}
        <section className="mx-auto max-w-4xl pt-8 text-center">
          <h1 className="font-display mb-6 text-4xl font-bold leading-tight text-white md:text-6xl">
            The <span className="text-lime-400">Puke</span> Test
          </h1>
          <p className="mb-10 text-xl leading-relaxed text-white/80">
            The <strong>Wingate Protocol</strong>. 30 seconds of &quot;all-out&quot; supramaximal
            effort against high resistance, followed by 4 minutes of recovery. This is the gold
            standard for measuring peak anaerobic power. It is brutal, effective, and not for
            beginners.
          </p>
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() =>
                document.getElementById('simulator')?.scrollIntoView({ behavior: 'smooth' })
              }
              className="rounded-xl bg-lime-500 px-8 py-3 font-bold text-black shadow-[0_0_20px_rgba(132,204,22,0.6)] transition-transform hover:-translate-y-1 hover:bg-lime-400"
            >
              Enter The Lab
            </button>
          </div>
        </section>

        {/* SECTION 1: DATA */}
        <section className="rounded-3xl border border-white/10 bg-black/30 p-8 shadow-sm md:p-12">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <div
                className={`mb-4 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase ${WINGATE_ACCENT.badge} ${WINGATE_ACCENT.badgeText}`}
              >
                Anaerobic Capacity
              </div>
              <h2 className="font-display mb-4 text-3xl font-bold text-white">Fatigue Index</h2>
              <p className="mb-6 leading-relaxed text-white/80">
                The defining characteristic of a Wingate sprint is the rapid drop in power output.
                Most athletes hit peak power in the first 5 seconds, and by second 30, power output
                drops by 40-50%. This &quot;Fatigue Index&quot; measures your anaerobic endurance.
              </p>
            </div>

            <div>
              <div className="mb-6 flex items-center justify-between">
                <h3 className="font-bold text-white/90">Power Profile</h3>
                <div className="flex rounded-lg bg-black/30 p-1">
                  <button
                    type="button"
                    onClick={() => setMetric('peak_power')}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition ${metric === 'peak_power' ? 'bg-lime-500 text-black' : 'text-white/60'}`}
                  >
                    Peak Power
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetric('fatigue')}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition ${metric === 'fatigue' ? 'bg-fuchsia-600 text-white' : 'text-white/60'}`}
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
                            metric === 'peak_power' && index === 2
                              ? '#84cc16'
                              : metric === 'fatigue' && index === 2
                                ? '#a21caf'
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
              className={`mb-4 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase ${WINGATE_ACCENT.badge} ${WINGATE_ACCENT.badgeText}`}
            >
              Protocol Simulator
            </div>
            <h2 className="font-display text-3xl font-bold text-white">30s Max / 4 Mins Rest</h2>
            <p className="mt-2 text-white/70">Extreme output requiring extensive recovery.</p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/30 shadow-xl">
            <div
              className={`flex items-center justify-between p-6 text-white transition-colors duration-200 ${currentSim.bgColor} ${simMode === 'work' ? 'text-black' : ''}`}
            >
              <div>
                <div className="mb-1 text-xs font-bold uppercase tracking-widest opacity-90">
                  {currentSim.status}
                </div>
                <h3 className="font-display text-2xl font-bold">{currentSim.phase}</h3>
              </div>
              <div className="font-mono text-3xl opacity-90">
                {simMode === 'work' ? '00:30' : '04:00'}
              </div>
            </div>

            <div className="grid md:grid-cols-2">
              <div className="border-b border-white/10 p-8 md:border-b-0 md:border-r">
                <div className="mb-6 h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={intensityData}>
                      <YAxis domain={[0, 220]} hide />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={simMode === 'work' ? '#84cc16' : '#a21caf'}
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
                    className={`w-1/2 rounded-xl font-bold transition-all ${simMode === 'work' ? 'scale-105 bg-lime-500 text-black shadow-[0_0_15px_rgba(132,204,22,0.6)]' : 'border border-white/20 bg-transparent text-white/70 hover:text-white'}`}
                  >
                    30s SPRINT
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimMode('rest')}
                    className={`w-1/2 rounded-xl font-bold transition-all ${simMode === 'rest' ? 'scale-105 bg-fuchsia-700 text-white shadow-lg' : 'border border-white/20 bg-transparent text-white/70 hover:text-white'}`}
                  >
                    4m RECOVER
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 text-center">
            <button
              type="button"
              onClick={() => setIsSetupOpen(true)}
              className="mx-auto flex items-center gap-3 rounded-full bg-lime-500 px-8 py-4 font-bold text-black shadow-[0_0_20px_rgba(132,204,22,0.4)] transition-all hover:scale-105 hover:bg-lime-400"
            >
              <span>⏱️</span>
              <span>Launch Wingate Timer</span>
            </button>
          </div>
        </section>

        {/* SECTION 3: VISUALIZER */}
        <section className="grid items-center gap-12 rounded-3xl border border-white/10 bg-black/30 p-8 shadow-2xl md:grid-cols-2 md:p-12">
          <div>
            <h2 className="font-display mb-6 text-3xl font-bold text-white">
              Toxic Load Visualizer
            </h2>
            <p className="mb-6 leading-relaxed text-white/80">
              Wingate creates massive metabolic byproducts (H+ ions). The visualizer represents the
              &quot;acid bath&quot; your muscles sit in during the work phase, and the slow,
              pulsating flush required to clear it during the 4-minute rest.
            </p>
            <button
              type="button"
              onClick={() => setIsReportOpen(true)}
              className="flex items-center gap-2 border-b border-lime-500/30 pb-0.5 text-sm font-bold text-lime-400 transition-colors hover:text-lime-300"
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
        protocolTitle="Select Rounds"
        protocolSubtitle="Choose your cycle count"
        workoutTitle=""
        workoutSubtitle=""
        onBack={() => {}}
        protocolContent={durationContent}
        workoutContent={<div />}
      />

      {typeof document !== 'undefined' &&
        isTimerOpen &&
        wingateTimeline.length > 0 &&
        createPortal(
          <IntervalTimerOverlay
            timeline={wingateTimeline}
            onClose={() => setIsTimerOpen(false)}
            theme={{ workBg: WINGATE_ACCENT.workBg }}
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
              <h3 className="font-display text-xl font-bold text-white">The Wingate Protocol</h3>
              <button
                type="button"
                onClick={() => setIsReportOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 font-bold text-white hover:bg-lime-600/20 hover:text-lime-400"
              >
                &times;
              </button>
            </div>
            <div className="prose prose-invert max-w-none overflow-y-auto p-8 text-white/80">
              <p>
                The Wingate Anaerobic Test was developed at the Wingate Institute in Israel in the
                1970s.
              </p>
              <h4 className="font-bold text-lime-500">The Protocol</h4>
              <p>
                It consists of 30 seconds of all-out supramaximal sprinting against high resistance.
                It is often cited as the most grueling 30 seconds in sports science.
              </p>
              <h4 className="font-bold text-lime-500">Why 4 Minutes Rest?</h4>
              <p>
                The effort is so intense that it completely depletes ATP-PC stores and causes
                massive accumulation of lactate and hydrogen ions. It takes significant time for the
                body to clear this metabolic waste and restore equilibrium enough to perform another
                high-quality rep.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WingateInterval;
