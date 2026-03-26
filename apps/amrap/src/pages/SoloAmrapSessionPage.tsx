/**
 * Solo AMRAP session page. Renders AmrapSessionShell with useSoloAmrap.
 * Workout config from route state or query params.
 * Post-workout recap, view results, copy, and guest gating mirror AmrapSessionPage (with friends).
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { AuthModal } from '@interval-timers/auth-ui';
import { ACCOUNT_REDIRECT_URL, HUD_REDIRECT_URL } from '@/lib/account-redirect-url';
import { useSoloAmrap } from '@/hooks/useSoloAmrap';
import { getWorkoutTitle } from '@/lib/workoutLabel';
import { buildResultsText, computeVolumeLines } from '@/lib/workoutResults';
import AmrapSessionShell from '@/components/amrap-session/AmrapSessionShell';
import PostWorkoutRecapModal from '@/components/PostWorkoutRecapModal';
import ViewResultsModal from '@/components/ViewResultsModal';
import { useAmrapAuth } from '@/contexts/AmrapAuthContext';
import { trackEvent } from '@interval-timers/analytics';
import type { AmrapSessionEngine } from '@/types/amrap-session';

function parseWorkoutFromSearch(searchParams: URLSearchParams): string[] {
  const workout = searchParams.getAll('workout');
  if (workout.length > 0) return workout;
  return [];
}

const DEFAULT_DURATION = 15;
const MIN_DURATION = 1;
const MAX_DURATION = 120;

function clampDuration(value: number | undefined | null): number {
  if (value == null || typeof value !== 'number' || isNaN(value)) return DEFAULT_DURATION;
  if (value >= MIN_DURATION && value <= MAX_DURATION) return Math.floor(value);
  return DEFAULT_DURATION;
}

function parseDurationFromSearch(searchParams: URLSearchParams): number {
  const d = searchParams.get('duration');
  if (d) {
    const n = parseInt(d, 10);
    if (!isNaN(n) && n >= MIN_DURATION && n <= MAX_DURATION) return n;
  }
  return DEFAULT_DURATION;
}

/** Solo engine stores per-round durations in participants[0].splits; buildResultsText expects cumulative elapsed at each round. */
function cumulativeElapsedFromRoundDurations(roundDurations: number[]): number[] {
  const out: number[] = [];
  let sum = 0;
  for (const d of roundDurations) {
    sum += d;
    out.push(sum);
  }
  return out;
}

export default function SoloAmrapSessionPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAmrapAuth();
  const isGuest = !user;

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalSignUp, setAuthModalSignUp] = useState(false);
  const [recapDismissed, setRecapDismissed] = useState(false);
  const [showGuestSavePrompt, setShowGuestSavePrompt] = useState(false);
  const [showViewResultsModal, setShowViewResultsModal] = useState(false);
  const [viewResultsText, setViewResultsText] = useState('');
  const [copyResultsToast, setCopyResultsToast] = useState<'success' | 'error' | null>(null);
  const copyResultsToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const state = location.state as
    | { durationMinutes?: number; workoutList?: string[] }
    | undefined;

  const durationMinutes =
    state?.durationMinutes != null
      ? clampDuration(state.durationMinutes)
      : parseDurationFromSearch(searchParams);
  const workoutList = state?.workoutList ?? parseWorkoutFromSearch(searchParams);

  const baseEngine = useSoloAmrap({
    durationMinutes,
    workoutList,
  });

  const openAuth = (signUp: boolean) => {
    setRecapDismissed(true);
    setShowGuestSavePrompt(false);
    if (signUp) {
      void trackEvent(
        supabase,
        'guest_save_prompt_signup',
        { source: 'amrap', surface: 'solo_session' },
        { appId: 'amrap' }
      );
    }
    setAuthModalSignUp(signUp);
    setShowAuthModal(true);
  };

  const openGuestSavePrompt = () => {
    void trackEvent(
      supabase,
      'guest_save_prompt_shown',
      { source: 'amrap', surface: 'solo_session' },
      { appId: 'amrap' }
    );
    setShowGuestSavePrompt(true);
  };

  const openHistory = () => {
    const url = new URL(HUD_REDIRECT_URL, window.location.origin);
    url.searchParams.set('hud', '1');
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  };

  const maybeGate = (): boolean => {
    if (!isGuest) return false;
    openGuestSavePrompt();
    return true;
  };

  useEffect(() => {
    if (baseEngine.timerPhase !== 'finished') setRecapDismissed(false);
  }, [baseEngine.timerPhase]);

  useEffect(() => {
    return () => {
      if (copyResultsToastTimeoutRef.current) {
        clearTimeout(copyResultsToastTimeoutRef.current);
        copyResultsToastTimeoutRef.current = null;
      }
    };
  }, []);

  const getResultsText = useCallback(
    (opts?: { forCopy?: boolean }) => {
      const sessionUrl = window.location.href.replace(/\?.*$/, '');
      const myRoundsCount = baseEngine.myRounds;
      const duration = baseEngine.durationMinutes ?? DEFAULT_DURATION;
      const list = baseEngine.workoutList ?? [];
      const roundDurations = baseEngine.participants[0]?.splits ?? [];
      const cumulativeSplits = cumulativeElapsedFromRoundDurations(roundDurations);
      const workoutTitle = getWorkoutTitle(list);
      const volumeLines = computeVolumeLines(list, myRoundsCount);
      const compact = opts?.forCopy === true && volumeLines.length > 6;
      return buildResultsText(list, myRoundsCount, duration, sessionUrl, {
        workoutTitle,
        compact,
        splits: cumulativeSplits.length > 0 ? cumulativeSplits : undefined,
      });
    },
    [baseEngine.myRounds, baseEngine.durationMinutes, baseEngine.workoutList, baseEngine.participants]
  );

  const copyResults = useCallback(async () => {
    if (copyResultsToastTimeoutRef.current) {
      clearTimeout(copyResultsToastTimeoutRef.current);
      copyResultsToastTimeoutRef.current = null;
    }
    const text = getResultsText({ forCopy: true });
    try {
      await navigator.clipboard.writeText(text);
      setCopyResultsToast('success');
    } catch {
      setCopyResultsToast('error');
    }
    copyResultsToastTimeoutRef.current = setTimeout(() => {
      copyResultsToastTimeoutRef.current = null;
      setCopyResultsToast(null);
    }, 2500);
  }, [getResultsText]);

  const handleOpenViewResults = useCallback(() => {
    setViewResultsText(getResultsText({ forCopy: false }));
    setShowViewResultsModal(true);
  }, [getResultsText]);

  const handleCloseViewResults = useCallback(() => {
    setShowViewResultsModal(false);
  }, []);

  const mergedEngine: AmrapSessionEngine = useMemo(
    () => ({
      ...baseEngine,
      recapDismissed,
    }),
    [baseEngine, recapDismissed]
  );

  const roundDurations = baseEngine.participants[0]?.splits ?? [];

  return (
    <>
      <div className="min-h-screen bg-[#0d0500] text-white">
        <div className="px-4 py-4">
          <Link
            to="/"
            className="inline-block text-sm font-bold text-white/70 hover:text-orange-400"
          >
            ← Exit session
          </Link>
        </div>
        <AmrapSessionShell engine={mergedEngine} />

        {baseEngine.timerPhase === 'finished' && (
          <div
            className="fixed bottom-0 left-0 right-0 z-40 flex gap-3 border-t border-white/10 bg-[#0d0500]/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:hidden"
            role="navigation"
            aria-label="Workout complete actions"
          >
            {recapDismissed ? (
              <Link
                to="/"
                className="flex-1 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-center font-bold text-white transition-colors hover:bg-white/20"
              >
                Exit session
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setRecapDismissed(true)}
                className="flex-1 rounded-xl border-2 border-orange-500 bg-orange-600 px-4 py-3 text-center font-bold text-white transition-colors hover:bg-orange-500"
              >
                Continue
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (maybeGate()) return;
                openHistory();
              }}
              className="flex-1 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-center font-bold text-white transition-colors hover:bg-white/20"
            >
              View in History
            </button>
          </div>
        )}
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        supabase={supabase}
        redirectBaseUrl={ACCOUNT_REDIRECT_URL}
        defaultSignUp={authModalSignUp}
        returnUrl={ACCOUNT_REDIRECT_URL}
        fromAppId="amrap"
      />

      {/* TODO: recoveryUrl + RecoveryQrModal when solo sessions have a stable id / handoff URL (see social useSocialAmrap). */}
      <PostWorkoutRecapModal
        isOpen={baseEngine.timerPhase === 'finished' && !recapDismissed}
        onClose={() => {
          if (isGuest) {
            openGuestSavePrompt();
            return;
          }
          setRecapDismissed(true);
        }}
        myRounds={baseEngine.myRounds}
        durationMinutes={baseEngine.durationMinutes ?? DEFAULT_DURATION}
        onCopyResults={copyResults}
        onViewResults={() => {
          if (maybeGate()) return;
          setRecapDismissed(true);
          handleOpenViewResults();
        }}
        onViewInHistory={() => {
          if (maybeGate()) return;
          setRecapDismissed(true);
          openHistory();
        }}
        recoveryUrl={null}
        showSignInCta={isGuest}
        onSignInClick={
          isGuest
            ? () => {
                openAuth(false);
              }
            : undefined
        }
        onSignUpClick={isGuest ? () => openAuth(true) : undefined}
      />

      <ViewResultsModal
        isOpen={showViewResultsModal}
        onClose={() => {
          if (isGuest) {
            openGuestSavePrompt();
            return;
          }
          handleCloseViewResults();
        }}
        resultsText={viewResultsText}
        onCopy={copyResults}
        onSaveResults={() => {
          if (isGuest) {
            openGuestSavePrompt();
            return;
          }
          handleCloseViewResults();
          openHistory();
        }}
        copyToast={copyResultsToast}
        roundDurations={roundDurations}
        showAccountCta={isGuest}
        onSignIn={isGuest ? () => openAuth(false) : undefined}
        onSignUp={isGuest ? () => openAuth(true) : undefined}
      />

      {showGuestSavePrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d0500] p-5">
            <h3 className="text-lg font-bold text-white">Save and track this workout</h3>
            <p className="mt-2 text-sm text-white/75">
              Create an account to save this AMRAP to your history across devices.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openAuth(false)}
                className="rounded-lg border border-orange-500/50 bg-orange-600/30 px-3 py-2 text-sm font-bold text-orange-200 transition-colors hover:bg-orange-600/50"
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => openAuth(true)}
                className="rounded-lg border border-orange-500/50 bg-orange-600/30 px-3 py-2 text-sm font-bold text-orange-200 transition-colors hover:bg-orange-600/50"
              >
                Sign up
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowGuestSavePrompt(false);
                  setRecapDismissed(true);
                  if (showViewResultsModal) handleCloseViewResults();
                }}
                className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-white/20"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
