/**
 * Stand-alone Daily Warm-Up: landing + timer.
 * Fetches warm-up config (images, instructions) from API; falls back to static list.
 * Freezes timeline and config when user clicks Start so the timer does not jump if the API completes mid-session.
 */
import React, { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { buildAccountRedirectUrl } from '@interval-timers/handoff';
import { trackEvent } from '@interval-timers/analytics';
import { supabase } from '../../lib/supabase';
import { Activity, Shield, Repeat } from 'lucide-react';
import {
  IntervalTimerLanding,
  IntervalTimerOverlay,
  useWarmupConfig,
  type WarmupExercise,
} from '@interval-timers/timer-ui';
import type { IntervalTimerPage } from '@interval-timers/timer-core';
import { getProtocolAccent } from '@interval-timers/timer-core';
import type { HIITTimelineBlock } from '@interval-timers/types';

interface WarmUpIntervalProps {
  /** Optional in standalone app (nav hidden); required when embedded in all-timers. */
  onNavigate?: (page: IntervalTimerPage) => void;
}

interface FrozenWarmupSnapshot {
  timeline: HIITTimelineBlock[];
  exercises: WarmupExercise[];
  durationPerExercise: number;
}

const WARMUP_ACCENT = getProtocolAccent('warmup');

const WarmUpInterval: React.FC<WarmUpIntervalProps> = ({ onNavigate }) => {
  const accountBase =
    import.meta.env.VITE_ACCOUNT_REDIRECT_URL ??
    (import.meta.env.DEV ? 'http://localhost:3006/account' : '/account');
  const [isTimerOpen, setIsTimerOpen] = useState(false);
  const [showPostSession, setShowPostSession] = useState(false);
  const [postSessionTotalSeconds, setPostSessionTotalSeconds] = useState(0);
  const [frozenSnapshot, setFrozenSnapshot] = useState<FrozenWarmupSnapshot | null>(null);
  const { exercises, durationPerExercise } = useWarmupConfig();

  const warmupTimeline = useMemo((): HIITTimelineBlock[] => {
    const warmupDuration = exercises.length * durationPerExercise;
    return [
      {
        type: 'warmup',
        duration: warmupDuration,
        name: 'Daily Warm Up',
        notes: 'Joint mobility & activation',
      },
      { type: 'cooldown', duration: 30, name: 'Cool Down', notes: 'Take a breath' },
    ];
  }, [exercises.length, durationPerExercise]);

  const handleStart = useCallback(() => {
    setFrozenSnapshot({
      timeline: warmupTimeline,
      exercises: [...exercises],
      durationPerExercise,
    });
    setIsTimerOpen(true);
  }, [warmupTimeline, exercises, durationPerExercise]);

  return (
    <>
      <IntervalTimerLanding
        currentProtocol="warmup"
        onNavigate={onNavigate}
        accentTheme={WARMUP_ACCENT}
        standalone
        brandLabel="AI Fitness Guy"
      >
        {/* Hero */}
        <section className="mx-auto max-w-4xl pt-8 text-center">
          <h1 className="font-display mb-6 text-4xl font-bold leading-tight text-white md:text-6xl">
            Daily <span className="text-[#ffbf00]">Warm-Up</span>
          </h1>
          <img
            src={`${import.meta.env.BASE_URL}logo_transparent_500x500.png`}
            alt="Interval Timers"
            className="mx-auto mb-10 h-28 w-28 object-contain md:h-36 md:w-36"
          />
          <p className="mb-10 text-xl leading-relaxed text-white/80">
            Joint mobility and activation. A simple 15-minute routine to prepare your body for
            movement—or to do as a stand-alone daily habit.
          </p>
          <button
            type="button"
            onClick={handleStart}
            className="rounded-xl bg-[#ffbf00] px-8 py-3 font-bold text-black shadow-lg transition-transform hover:-translate-y-0.5"
          >
            Start Daily Warm-Up
          </button>
        </section>

        {/* Value section */}
        <section className="rounded-3xl border border-white/10 bg-black/30 p-8 shadow-sm md:p-12">
          <div
            className={`mb-4 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase ${WARMUP_ACCENT.badge} ${WARMUP_ACCENT.badgeText}`}
          >
            Why Warm Up?
          </div>
          <h2 className="font-display mb-6 text-3xl font-bold text-white">
            Movement Prep, Injury Prevention, Daily Habit
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="flex flex-col gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-600/30 text-slate-400">
                <Activity size={20} />
              </div>
              <h3 className="font-bold text-white">Joint Mobility</h3>
              <p className="text-sm leading-relaxed text-white/70">
                Prepare your joints and connective tissue before load. Arm circles, hip rotations,
                trunk twists—10 exercises, 30 seconds each.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-600/30 text-slate-400">
                <Shield size={20} />
              </div>
              <h3 className="font-bold text-white">Injury Prevention</h3>
              <p className="text-sm leading-relaxed text-white/70">
                Reduce the risk of strain by gradually increasing range of motion. A few minutes of
                activation pays off long-term.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-600/30 text-slate-400">
                <Repeat size={20} />
              </div>
              <h3 className="font-bold text-white">Daily Habit</h3>
              <p className="text-sm leading-relaxed text-white/70">
                Use it as a standalone routine on rest days, or before any workout. Consistent
                mobility work builds a more resilient body.
              </p>
            </div>
          </div>
        </section>
      </IntervalTimerLanding>

      {typeof document !== 'undefined' &&
        isTimerOpen &&
        frozenSnapshot &&
        createPortal(
          <IntervalTimerOverlay
            timeline={frozenSnapshot.timeline}
            onClose={() => {
              if (frozenSnapshot) {
                const totalSeconds = frozenSnapshot.timeline.reduce((s, b) => s + b.duration, 0);
                trackEvent(supabase, 'timer_session_complete', {
                  source: 'daily-warmup',
                  duration_seconds: totalSeconds,
                }, { appId: 'daily-warmup' });
                setPostSessionTotalSeconds(totalSeconds);
                setShowPostSession(true);
              }
              setIsTimerOpen(false);
              setFrozenSnapshot(null);
            }}
            theme={{ workBg: WARMUP_ACCENT.workBg }}
            warmupExercises={frozenSnapshot.exercises}
            warmupDurationPerExercise={frozenSnapshot.durationPerExercise}
            hideSkipWarmup
          />,
          document.body
        )}

      {/* POST-SESSION CARD */}
      {showPostSession &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4">
            <div className="animate-zoom-in w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0500] p-8 shadow-2xl">
              <h3 className="mb-2 text-xl font-bold text-white">Workout complete!</h3>
              <p className="mb-6 text-white/70">
                Save your session to track progress and view stats.
              </p>
              <div className="flex flex-col gap-3">
                <a
                  href={buildAccountRedirectUrl(
                    'save_session',
                    'daily-warmup',
                    { time: String(postSessionTotalSeconds) },
                    accountBase
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    trackEvent(supabase, 'timer_save_click', {
                      source: 'daily-warmup',
                      intent: 'save_session',
                      time: String(postSessionTotalSeconds),
                    }, { appId: 'daily-warmup' });
                    window.location.href = buildAccountRedirectUrl(
                      'save_session',
                      'daily-warmup',
                      { time: String(postSessionTotalSeconds) },
                      accountBase
                    );
                  }}
                  className="rounded-xl bg-[#ffbf00] px-6 py-3 text-center font-bold text-black transition-transform hover:-translate-y-0.5 hover:bg-[#ffcc33]"
                >
                  Save to account
                </a>
                <button
                  type="button"
                  onClick={() => setShowPostSession(false)}
                  className="rounded-xl border border-white/20 px-6 py-3 font-bold text-white/80 hover:bg-white/10 hover:text-white"
                >
                  Done
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default WarmUpInterval;
