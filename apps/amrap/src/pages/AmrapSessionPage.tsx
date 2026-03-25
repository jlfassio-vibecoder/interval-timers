import { useState, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { AuthModal } from '@interval-timers/auth-ui';
import {
  ACCOUNT_REDIRECT_URL,
  HUD_REDIRECT_URL,
  buildMinimalOnboardingRedirectUrl,
} from '@/lib/account-redirect-url';
import { useSocialAmrap } from '@/hooks/useSocialAmrap';
import { getStoredGuestClaimToken } from '@/hooks/useAmrapSession';
import { getWorkoutTitleAndDuration } from '@/lib/workoutLabel';
import AmrapSessionShell from '@/components/amrap-session/AmrapSessionShell';
import NewWorkoutModal from '@/components/NewWorkoutModal';
import DailyWarmupSessionOverlay from '@/components/DailyWarmupSessionOverlay';
import PostWorkoutRecapModal from '@/components/PostWorkoutRecapModal';
import RecoveryQrModal from '@/components/RecoveryQrModal';
import ViewResultsModal from '@/components/ViewResultsModal';
import FreeWorkoutTimerModal from '@/components/FreeWorkoutTimerModal';
import { Video, VideoOff, Mic, MicOff } from 'lucide-react';
import { useAmrapAuth } from '@/contexts/AmrapAuthContext';
import { trackEvent } from '@interval-timers/analytics';

export default function AmrapSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAmrapAuth();
  const isGuest = !user;
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalSignUp, setAuthModalSignUp] = useState(false);
  const [recapDismissed, setRecapDismissed] = useState(false);
  const [showGuestSavePrompt, setShowGuestSavePrompt] = useState(false);

  const openAuth = (signUp: boolean) => {
    setRecapDismissed(true);
    setShowGuestSavePrompt(false);
    if (signUp) {
      void trackEvent(
        supabase,
        'guest_save_prompt_signup',
        { source: 'amrap', surface: 'session' },
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
      { source: 'amrap', surface: 'session' },
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

  const result = useSocialAmrap(sessionId, {
    onDismissFinishedRecap: () => setRecapDismissed(true),
    recapDismissed,
    onAttemptViewHistory: () => {
      if (!isGuest) return false;
      openGuestSavePrompt();
      return true;
    },
    onAttemptViewResults: () => {
      if (!isGuest) return false;
      openGuestSavePrompt();
      return true;
    },
  });

  useEffect(() => {
    if (result.timerPhase !== 'finished') setRecapDismissed(false);
  }, [result.timerPhase]);

  if (!sessionId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d0500] text-white">
        <p className="text-white/70">No session</p>
      </div>
    );
  }

  const { pageState } = result;
  const session = pageState.session;
  const claimAwareReturnUrl = useMemo(() => {
    const sid = sessionId ?? null;
    const participant = pageState.participantId ?? null;
    const claimToken = sid ? getStoredGuestClaimToken(sid) : null;
    return buildMinimalOnboardingRedirectUrl({
      sessionId: sid,
      participantId: participant,
      claimToken,
    });
  }, [sessionId, pageState.participantId]);
  const hostParticipant = pageState.hostParticipant;
  const hostVideoTrack =
    pageState.isHost
      ? pageState.localVideoTrack ?? null
      : hostParticipant
        ? pageState.remoteUsers.find((u) => String(u.uid) === hostParticipant.id)
            ?.videoTrack ?? null
        : null;

  return (
    <>
      <div className="min-h-screen bg-[#0d0500] text-white">
        <div className="px-4 py-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            {result.timerPhase === 'finished' ? (
              <div className="flex shrink-0 items-center gap-2">
                {recapDismissed ? (
                  <Link
                    to="/with-friends"
                    className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-white/20"
                  >
                    ← Exit session
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (isGuest) {
                        openGuestSavePrompt();
                        return;
                      }
                      setRecapDismissed(true);
                    }}
                    className="rounded-lg border-2 border-orange-500 bg-orange-600 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-orange-500"
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
                  className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-white/20"
                >
                  View in History
                </button>
              </div>
            ) : (
              <Link
                to="/with-friends"
                className="shrink-0 text-sm font-bold text-white/70 hover:text-orange-400"
              >
                ← Exit session
              </Link>
            )}
            <span
              className="min-w-0 flex-1 truncate text-center text-sm font-medium text-white/90"
              title={
                session
                  ? getWorkoutTitleAndDuration(
                      session.workout_list,
                      session.duration_minutes
                    )
                  : undefined
              }
            >
              {session
                ? getWorkoutTitleAndDuration(
                    session.workout_list,
                    session.duration_minutes
                  )
                : ''}
            </span>
            <div className="flex flex-1 items-center justify-end gap-2">
              {pageState.joined &&
                pageState.participantId &&
                !pageState.agoraError && (
                  <div className="flex shrink-0 items-center gap-1 rounded-lg border border-white/15 bg-white/5 p-0.5">
                    <button
                      type="button"
                      onClick={pageState.toggleLocalCamera}
                      aria-pressed={pageState.localCameraOff}
                      title={
                        pageState.localCameraOff
                          ? 'Turn camera on'
                          : 'Turn camera off'
                      }
                      className={`rounded-md p-2 transition-colors ${
                        pageState.localCameraOff
                          ? 'bg-white/15 text-white'
                          : 'text-white/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {pageState.localCameraOff ? (
                        <VideoOff className="h-4 w-4" aria-hidden />
                      ) : (
                        <Video className="h-4 w-4" aria-hidden />
                      )}
                      <span className="sr-only">
                        {pageState.localCameraOff ? 'Turn camera on' : 'Turn camera off'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={pageState.toggleLocalMic}
                      aria-pressed={pageState.localMicMuted}
                      title={
                        pageState.localMicMuted ? 'Unmute microphone' : 'Mute microphone'
                      }
                      className={`rounded-md p-2 transition-colors ${
                        pageState.localMicMuted
                          ? 'bg-white/15 text-white'
                          : 'text-white/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {pageState.localMicMuted ? (
                        <MicOff className="h-4 w-4" aria-hidden />
                      ) : (
                        <Mic className="h-4 w-4" aria-hidden />
                      )}
                      <span className="sr-only">
                        {pageState.localMicMuted ? 'Unmute microphone' : 'Mute microphone'}
                      </span>
                    </button>
                  </div>
                )}
              {pageState.isHost && (
                <button
                  type="button"
                  onClick={pageState.copyShareLink}
                  className="shrink-0 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/20"
                >
                  Copy link
                </button>
              )}
              {!pageState.user && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthModalSignUp(false);
                      setShowAuthModal(true);
                    }}
                    className="text-sm font-bold text-white/70 hover:text-orange-400"
                  >
                    Sign in
                  </button>
                  <span className="text-white/40">/</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthModalSignUp(true);
                      setShowAuthModal(true);
                    }}
                    className="text-sm font-bold text-white/70 hover:text-orange-400"
                  >
                    Sign up
                  </button>
                </>
              )}
            </div>
          </div>

          {pageState.copyToast && (
            <div
              role="status"
              aria-live="polite"
              className={`fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg ${
                pageState.copyToast === 'success'
                  ? 'border border-emerald-500/40 bg-emerald-900/95 text-emerald-100'
                  : 'border border-red-500/40 bg-red-900/95 text-red-100'
              }`}
            >
              {pageState.copyToast === 'success'
                ? 'Link copied!'
                : 'Failed to copy link'}
            </div>
          )}

          {pageState.agoraError && (
            <div className="mx-4 mb-4 rounded-xl border border-red-500/50 bg-red-600/20 p-4">
              <p className="text-sm font-medium text-red-300">
                Video unavailable
              </p>
              <p className="mt-1 text-xs text-red-200/90">
                {pageState.agoraError}
              </p>
            </div>
          )}
        </div>

        <AmrapSessionShell engine={result} />

        {result.timerPhase === 'finished' && (
          <div
            className="fixed bottom-0 left-0 right-0 z-40 flex gap-3 border-t border-white/10 bg-[#0d0500]/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:hidden"
            role="navigation"
            aria-label="Workout complete actions"
          >
            {recapDismissed ? (
              <Link
                to="/with-friends"
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
        returnUrl={claimAwareReturnUrl}
        fromAppId="amrap"
      />

      <NewWorkoutModal
        isOpen={session?.show_new_workout_modal === true}
        onClose={pageState.handleCloseNewWorkoutModal}
        onSelect={pageState.handleNewWorkoutSelect}
        isHost={pageState.isHost}
      />

      <FreeWorkoutTimerModal
        isOpen={pageState.showFreeWorkoutModal}
        onClose={pageState.handleCloseFreeWorkoutModal}
        onStart={(durationSec) => pageState.startFreeWorkout(durationSec)}
      />

      <DailyWarmupSessionOverlay
        isOpen={session?.show_warmup_overlay === true}
        onClose={pageState.handleCloseWarmupOverlay}
        onStartWarmup={pageState.handleStartWarmup}
        onWarmupComplete={pageState.handleWarmupComplete}
        isHost={pageState.isHost}
        hostVideoTrack={hostVideoTrack}
        warmupStartedAt={session?.warmup_started_at}
      />

      <PostWorkoutRecapModal
        isOpen={result.timerPhase === 'finished' && !recapDismissed}
        onClose={() => {
          if (isGuest) {
            openGuestSavePrompt();
            return;
          }
          setRecapDismissed(true);
        }}
        myRounds={result.myRounds}
        durationMinutes={result.durationMinutes ?? 15}
        onCopyResults={pageState.copyResults}
        onViewResults={() => {
          if (maybeGate()) return;
          pageState.handleOpenViewResults();
        }}
        onViewInHistory={() => {
          if (maybeGate()) return;
          setRecapDismissed(true);
          openHistory();
        }}
        recoveryUrl={pageState.recoveryUrl}
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
        isOpen={pageState.showViewResultsModal}
        onClose={() => {
          if (isGuest) {
            openGuestSavePrompt();
            return;
          }
          pageState.handleCloseViewResults();
        }}
        resultsText={pageState.viewResultsText}
        onCopy={pageState.copyResults}
        onSaveResults={() => {
          if (isGuest) {
            openGuestSavePrompt();
            return;
          }
          pageState.handleCloseViewResults();
          openHistory();
        }}
        copyToast={pageState.copyResultsToast}
        roundDurations={pageState.roundDurations}
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
                  if (pageState.showViewResultsModal) pageState.handleCloseViewResults();
                }}
                className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-white/20"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      {pageState.recoveryUrl && (
        <RecoveryQrModal
          isOpen={pageState.showRecoveryQrModal}
          onClose={pageState.handleCloseRecoveryQr}
          recoveryUrl={pageState.recoveryUrl}
        />
      )}
    </>
  );
}
