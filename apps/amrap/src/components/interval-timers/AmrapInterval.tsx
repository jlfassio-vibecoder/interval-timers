import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AccountLink from '@/components/AccountLink';
import AmrapCtaButton from '@/components/AmrapCtaButton';
import { AuthModal } from '@interval-timers/auth-ui';
import { supabase } from '@/lib/supabase';
import { ACCOUNT_REDIRECT_URL } from '@/lib/account-redirect-url';
import { useAmrapAuth } from '@/contexts/AmrapAuthContext';
import { IntervalTimerLanding, IntervalTimerSetupModal } from '@interval-timers/timer-ui';
import type { IntervalTimerPage } from '@interval-timers/timer-core';
import { getProtocolAccent } from '@interval-timers/timer-core';
import { useAmrapSetup } from './useAmrapSetup';
import {
  AmrapProtocolStep,
  AmrapWorkoutStep,
  AmrapBuildWorkoutStep,
} from './AmrapSetupContent';
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
  /** Optional in standalone app (nav hidden); required when embedded in all-timers. */
  onNavigate?: (page: IntervalTimerPage) => void;
  onNavigateToLanding?: () => void;
}

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

const AmrapInterval: React.FC<AmrapIntervalProps> = ({ onNavigate, onNavigateToLanding }) => {
  const navigate = useNavigate();
  const { user } = useAmrapAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalSignUp, setAuthModalSignUp] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const qtyInputRef = useRef<HTMLInputElement | null>(null);

  const setup = useAmrapSetup((result) => {
    navigate('/session', {
      state: {
        durationMinutes: result.durationMinutes,
        workoutList: result.workoutList,
      },
    });
  });

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
    queueMicrotask(() => setIntensityData(data));
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
      if (audioContextRef.current?.state === 'running') {
        audioContextRef.current.suspend().then(() => setIsTelemetryEnabled(false)).catch(() => setIsTelemetryEnabled(false));
      } else {
        setIsTelemetryEnabled(false);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
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

  const isStandalone = onNavigate == null;

  const inGeneralBuildFlow = setup.generalBuildStep != null;
  const workoutTitle =
    inGeneralBuildFlow && setup.generalBuildStep === 'duration'
      ? 'Pick Time Cap'
      : inGeneralBuildFlow && setup.generalBuildStep === 'builder'
        ? 'Build Your Workout'
        : 'Select Workout';
  const workoutSubtitle =
    inGeneralBuildFlow && setup.generalBuildStep === 'duration'
      ? '5, 15, or 20 minutes'
      : inGeneralBuildFlow && setup.generalBuildStep === 'builder'
        ? 'Add exercises or launch blank timer'
        : 'Choose your routine';

  return (
    <>
      <IntervalTimerLanding
        currentProtocol="amrap"
        onNavigate={onNavigate}
        onNavigateToLanding={onNavigateToLanding}
        accentTheme={AMRAP_ACCENT}
        standalone={isStandalone}
        brandLabel="AI Fitness Guy"
        navEnd={
          <div className="flex items-center gap-2">
            <AccountLink
              className="text-xs font-bold text-white/70 transition-colors hover:text-[#ffbf00] md:text-sm"
            >
              Account
            </AccountLink>
            {!user ? (
              <>
                <span className="text-white/40">/</span>
                <button
                  type="button"
                  onClick={() => {
                    setAuthModalSignUp(false);
                    setShowAuthModal(true);
                  }}
                  className="text-xs font-bold text-white/70 transition-colors hover:text-[#ffbf00] md:text-sm"
                >
                  Log in
                </button>
                <span className="text-white/40">/</span>
                <button
                  type="button"
                  onClick={() => {
                    setAuthModalSignUp(true);
                    setShowAuthModal(true);
                  }}
                  className="text-xs font-bold text-white/70 transition-colors hover:text-[#ffbf00] md:text-sm"
                >
                  Create account
                </button>
              </>
            ) : null}
          </div>
        }
      >
        {/* HERO */}
        <section className="mx-auto max-w-4xl pt-8 text-center">
          <h1 className="font-display mb-6 text-4xl font-bold leading-tight text-white md:text-6xl">
            As Many Rounds <span className="text-orange-400">As Possible</span>
          </h1>
          <img
            src={`${import.meta.env.BASE_URL}logo_transparent_500x500.png`}
            alt="Interval Timers"
            className="mx-auto mb-10 h-28 w-28 object-contain md:h-36 md:w-36"
          />
          <p className="mb-10 text-xl leading-relaxed text-white/80">
            <strong>AMRAP</strong>. A test of mental fortitude and work capacity. You have a fixed
            time window. Your goal is to complete as much work as possible within that window. There
            is no scheduled rest; you rest only when you must.
          </p>
          <div className="inline-grid w-max max-w-full grid-cols-1 gap-4 sm:grid-cols-2">
            <AmrapCtaButton onClick={setup.open}>Launch AMRAP Timer</AmrapCtaButton>
            <AmrapCtaButton to="with-friends">AMRAP With Friends</AmrapCtaButton>
            <AccountLink asButton className="rounded-xl bg-orange-600 px-8 py-3 font-bold text-white shadow-[0_0_20px_rgba(234,88,12,0.4)] transition-transform hover:-translate-y-1 hover:bg-orange-500">
              My Account
            </AccountLink>
            <AmrapCtaButton
              onClick={() =>
                document.getElementById('simulator')?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              Learn More
            </AmrapCtaButton>
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
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
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

        {/* CTA: Programming Guide */}
        <div className="mt-6 flex justify-center">
          <AmrapCtaButton to="programming-guide">Programming Guide</AmrapCtaButton>
        </div>

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
              <div className="font-mono text-3xl opacity-90">15:00</div>
            </div>

            <div className="grid md:grid-cols-2">
              <div className="border-b border-white/10 p-8 md:border-b-0 md:border-r">
                <div className="mb-6 h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={150}>
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
                    className={`w-1/2 rounded-xl font-bold transition-all ${simMode === 'pace' ? 'scale-105 bg-orange-600 text-white shadow-lg' : 'border border-white/20 bg-transparent text-white/70 hover:text-white'}`}
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

          <div className="flex flex-col items-center gap-4 pt-8 text-center">
            <AmrapCtaButton to="workout-explorer">Workout Explorer</AmrapCtaButton>
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
              className="flex items-center gap-2 border-b border-orange-500/30 pb-0.5 text-sm font-bold text-orange-400 transition-colors hover:text-orange-300"
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

      {/* SETUP MODAL */}
      <IntervalTimerSetupModal
        isOpen={setup.isOpen}
        onClose={setup.close}
        step={setup.step}
        protocolTitle="Select Protocol"
        protocolSubtitle="General timer or structured workout"
        workoutTitle={workoutTitle}
        workoutSubtitle={workoutSubtitle}
        onBack={setup.back}
        protocolContent={
          <AmrapProtocolStep
            onStartWithGeneral={setup.startWithGeneral}
            onSelectLevel={setup.selectLevel}
          />
        }
        workoutContent={
          inGeneralBuildFlow ? (
            <AmrapBuildWorkoutStep
              buildStep={setup.generalBuildStep!}
              selectedDuration={setup.selectedDuration}
              customExercises={setup.customExercises}
              onSelectDuration={setup.selectDuration}
              onAddExercise={setup.addExercise}
              onRemoveExercise={setup.removeExercise}
              onLaunch={setup.launchFromBuilder}
              onBackToDuration={setup.back}
              qtyInputRef={qtyInputRef}
            />
          ) : (
            <AmrapWorkoutStep
              selectedLevel={setup.selectedLevel}
              onStartWithWorkout={setup.startWithWorkout}
            />
          )
        }
      />

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
                AMRAP (As Many Rounds As Possible)
              </h3>
              <button
                type="button"
                onClick={() => setIsReportOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 font-bold text-white hover:bg-orange-600/20 hover:text-orange-400"
                aria-label="Close protocol details"
              >
                &times;
              </button>
            </div>
            <div className="prose prose-invert max-w-none overflow-y-auto p-8 text-white/80">
              <p>
                AMRAP is a time-priority workout structure. The time is fixed, and the work is the
                variable.
              </p>
              <h4 className="font-bold text-orange-500">Mental Fortitude</h4>
              <p>
                Because there is no built-in rest, AMRAPs require constant decision making. &quot;Do
                I rest now or do one more rep?&quot; This builds a specific type of mental toughness
                related to suffering and pacing.
              </p>
              <h4 className="font-bold text-orange-500">Strategy</h4>
              <p>
                In short AMRAPs (5-8 mins), the intensity is high (threshold/VO2 max). In longer
                AMRAPs (15-20+ mins), pacing is aerobic. The &quot;Concrete&quot; theme represents
                the foundational volume you are building with every rep.
              </p>
            </div>
          </div>
        </div>
      )}

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        supabase={supabase}
        redirectBaseUrl={ACCOUNT_REDIRECT_URL}
        defaultSignUp={authModalSignUp}
      />
    </>
  );
};

export default AmrapInterval;
