import { useState, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  setStoredHostToken,
  setStoredParticipantId,
} from '@/hooks/useAmrapSession';
import { useAmrapAuth, useAmrapPermissions } from '@/contexts/AmrapAuthContext';
import AccountLink from '@/components/AccountLink';
import AmrapCtaButton from '@/components/AmrapCtaButton';
import { AuthModal } from '@interval-timers/auth-ui';
import { ACCOUNT_REDIRECT_URL } from '@/lib/account-redirect-url';
import WeekCalendar from '@/components/WeekCalendar';
import CreateFlowSchedulePicker from '@/components/CreateFlowSchedulePicker';
import WorkoutPicker from '@/components/WorkoutPicker';
import {
  getGuestSessionResults,
  type GuestSessionResult,
} from '@/lib/guestSessionHistory';
import { getWorkoutTitleAndDuration } from '@/lib/workoutLabel';

type Tab = 'create' | 'join' | 'schedule';

/** Supabase auth-js lock race can abort requests; retry with short backoff. */
const LOCK_ABORT_MSG = "Lock broken by another request with the 'steal' option";

function isLockAbortError(e: unknown): boolean {
  if (e instanceof Error) {
    return e.name === 'AbortError' && e.message.includes(LOCK_ABORT_MSG);
  }
  return false;
}

function isLockAbortInResult(result: { error?: { message?: string } | null }): boolean {
  return !!result.error?.message?.includes(LOCK_ABORT_MSG);
}

async function withLockRetry<T extends { data: unknown; error: { message?: string } | null }>(
  fn: () => PromiseLike<T>,
  maxAttempts = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      if (isLockAbortInResult(result) && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 100 * attempt));
        continue;
      }
      return result;
    } catch (e) {
      if (isLockAbortError(e) && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 100 * attempt));
        continue;
      }
      throw e;
    }
  }
  throw new Error('Retry exhausted');
}

export default function AmrapWithFriendsPage() {
  const navigate = useNavigate();
  const { hasFullAccess } = useAmrapPermissions();
  const { user } = useAmrapAuth();
  const [tab, setTab] = useState<Tab>('create');
  const [hostNickname, setHostNickname] = useState('');
  const [joinSessionId, setJoinSessionId] = useState('');
  const [joinNickname, setJoinNickname] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<'when_ready' | 'schedule'>('when_ready');
  const [scheduledAt, setScheduledAt] = useState('');
  const [newlyScheduledSession, setNewlyScheduledSession] = useState<{
    id: string;
    scheduled_start_at: string;
  } | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalSignUp, setAuthModalSignUp] = useState(false);
  const [guestResults, setGuestResults] = useState<GuestSessionResult[]>(() =>
    getGuestSessionResults()
  );

  useEffect(() => {
    setGuestResults(getGuestSessionResults());
  }, []);

  useEffect(() => {
    const onFocus = () => setGuestResults(getGuestSessionResults());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const handleCreateSession = useCallback(
    async (
      durationMinutes: number,
      workoutList: string[],
      nickname: string,
      scheduledDateTime?: string
    ) => {
      const name = nickname.trim();
      if (!name) {
        setCreateError('Enter your name or a nickname');
        return;
      }
      setLoading(true);
      setCreateError(null);
      let data: unknown;
      let error: { message?: string } | null = null;
      try {
        const result = await withLockRetry(() =>
          Promise.resolve(
            supabase.rpc('create_session', {
              p_duration_minutes: durationMinutes,
              p_workout_list: workoutList,
              p_host_nickname: name,
              p_scheduled_start_at: scheduledDateTime
                ? new Date(scheduledDateTime).toISOString()
                : null,
              p_user_id: user?.id ?? null,
            })
          )
        );
        data = result.data;
        error = result.error ?? null;
      } catch (e) {
        setLoading(false);
        setCreateError(
          isLockAbortError(e)
            ? 'Session creation was interrupted. Please try again.'
            : (e instanceof Error ? e.message : 'Something went wrong. Please try again.')
        );
        return;
      }
      setLoading(false);
      if (error) {
        setCreateError(
          isLockAbortInResult({ error })
            ? 'Session creation was interrupted. Please try again.'
            : (error.message ?? 'Something went wrong.')
        );
        return;
      }
      const raw = data && typeof data === 'object' ? data as Record<string, unknown> : {};
      const sessionId = typeof raw.session_id === 'string' ? raw.session_id.trim() : '';
      const hostToken = typeof raw.host_token === 'string' ? raw.host_token.trim() : '';
      const participantId = typeof raw.participant_id === 'string' ? raw.participant_id.trim() : '';
      if (!sessionId || !hostToken || !participantId) {
        setCreateError('Something went wrong. Please try again.');
        return;
      }
      setStoredHostToken(sessionId, hostToken);
      setStoredParticipantId(sessionId, participantId);
      if (scheduledDateTime) {
        setNewlyScheduledSession({
          id: sessionId,
          scheduled_start_at: new Date(scheduledDateTime).toISOString(),
        });
        setTab('schedule');
      } else {
        navigate(`/with-friends/session/${sessionId}?host=1`);
      }
    },
    [navigate, user?.id]
  );

  const handleJoinSession = useCallback(async () => {
    const sid = joinSessionId.trim();
    if (!sid) {
      setJoinError('Enter a session ID');
      return;
    }
    if (!joinNickname.trim()) {
      setJoinError('Enter your name or a nickname');
      return;
    }
    setLoading(true);
    setJoinError(null);
    let data: unknown;
    let error: { message: string } | null = null;
    try {
      const res = await withLockRetry(() =>
        Promise.resolve(
          supabase.rpc('join_session', {
            p_session_id: sid,
            p_nickname: joinNickname.trim(),
            p_user_id: user?.id ?? null,
          })
        )
      );
      data = res.data;
      error = res.error ?? null;
    } catch (e) {
      setLoading(false);
      setJoinError(
        isLockAbortError(e)
          ? 'Join was interrupted. Please try again.'
          : (e instanceof Error ? e.message : 'Something went wrong. Please try again.')
      );
      return;
    }
    setLoading(false);
    if (error) {
      setJoinError(
        isLockAbortInResult({ error })
          ? 'Join was interrupted. Please try again.'
          : (error.message ?? 'Something went wrong.')
      );
      return;
    }
    const participantId =
      data &&
      typeof data === 'object' &&
      typeof (data as { participant_id?: unknown }).participant_id === 'string'
        ? ((data as { participant_id: string }).participant_id || '').trim()
        : '';
    if (!participantId) {
      setJoinError('Something went wrong. Please try again.');
      return;
    }
    setStoredParticipantId(sid, participantId);
    navigate(`/with-friends/session/${sid}`);
  }, [joinSessionId, joinNickname, navigate, user?.id]);

  return (
    <div className="min-h-screen bg-[#0d0500] text-white">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-bold text-white/70 transition-colors hover:text-orange-400"
            >
              <span>←</span>
              <span>Back to AMRAP</span>
            </Link>
            <AccountLink className="text-sm font-bold text-white/70 transition-colors hover:text-orange-400">
              My Account
            </AccountLink>
          </div>
          {user ? (
            <span className="text-xs text-white/50">{user.email}</span>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setAuthModalSignUp(false);
                  setShowAuthModal(true);
                }}
                className="text-sm font-medium text-white/70 hover:text-orange-400"
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
                className="text-sm font-medium text-white/70 hover:text-orange-400"
              >
                Create account
              </button>
            </div>
          )}
        </div>

        <h1 className="font-display mb-2 text-3xl font-bold text-white">
          AMRAP With Friends
        </h1>
        <p className="mb-6 text-white/70">
          Create a session and share the link, or join with a session ID. No account required.
        </p>

        <div className="mb-6 flex gap-2 rounded-xl bg-black/30 p-1">
          <button
            type="button"
            onClick={() => setTab('create')}
            className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition-colors ${
              tab === 'create'
                ? 'bg-orange-600 text-white'
                : 'text-white/70 hover:text-white'
            }`}
          >
            Create session
          </button>
          <button
            type="button"
            onClick={() => setTab('join')}
            className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition-colors ${
              tab === 'join'
                ? 'bg-orange-600 text-white'
                : 'text-white/70 hover:text-white'
            }`}
          >
            Join session
          </button>
          <button
            type="button"
            onClick={() => setTab('schedule')}
            className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition-colors ${
              tab === 'schedule'
                ? 'bg-orange-600 text-white'
                : 'text-white/70 hover:text-white'
            }`}
          >
            Schedule
          </button>
        </div>

        {!user && guestResults.length > 0 && (
          <section className="rounded-2xl border border-white/10 bg-black/30 p-6">
            <h2 className="mb-3 text-lg font-bold text-white">Recent sessions</h2>
            <p className="mb-4 text-sm text-white/70">
              Your recent workouts from this device. Create an account to save your history across
              devices.
            </p>
            <ul className="mb-4 space-y-2">
              {guestResults.map((r) => (
                <li
                  key={`${r.sessionId}-${r.participantId}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-white/90">
                    {getWorkoutTitleAndDuration(r.workoutList, r.durationMinutes)}
                  </span>
                  <span className="text-white/60">
                    {r.totalRounds} rounds · {new Date(r.completedAt).toLocaleDateString()}
                  </span>
                  <Link
                    to={`/with-friends/session/${r.sessionId}`}
                    className="text-orange-400 hover:underline"
                  >
                    View session
                  </Link>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                setAuthModalSignUp(true);
                setShowAuthModal(true);
              }}
              className="rounded-xl border border-orange-500/50 bg-orange-600/20 px-4 py-2 text-sm font-bold text-orange-300 transition-colors hover:bg-orange-600/30"
            >
              Create an account to save your history across devices
            </button>
          </section>
        )}

        <div className="space-y-10">
          {/* Create session */}
          {tab === 'create' && (
            <section className="rounded-2xl border border-white/10 bg-black/30 p-6">
              <h2 className="mb-4 text-xl font-bold text-white">Create a session</h2>
              <div className="mb-4">
                <label htmlFor="host-nickname" className="mb-1 block text-sm font-medium text-white/80">
                  Your name <span className="text-white/50">(required)</span>
                </label>
                <input
                  id="host-nickname"
                  type="text"
                  placeholder="Your name or nickname"
                  value={hostNickname}
                  onChange={(e) => {
                    setHostNickname(e.target.value);
                    if (createError) setCreateError(null);
                  }}
                  className="w-full rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-white placeholder:text-white/50 focus:border-orange-500 focus:outline-none"
                />
              </div>
              <WorkoutPicker
                onSelect={(workoutList, durationMinutes) =>
                  handleCreateSession(
                    durationMinutes,
                    workoutList,
                    hostNickname,
                    scheduleMode === 'schedule' ? scheduledAt || undefined : undefined
                  )
                }
                onCancel={() => {}}
                disabled={loading}
                extraContent={
                  <>
                    <div className="mb-4 flex gap-2 rounded-xl bg-black/30 p-1">
                      <button
                        type="button"
                        onClick={() => {
                          setScheduleMode('when_ready');
                          setScheduledAt('');
                        }}
                        className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition-colors ${
                          scheduleMode === 'when_ready'
                            ? 'bg-orange-600 text-white'
                            : 'text-white/70 hover:text-white'
                        }`}
                      >
                        Start when ready
                      </button>
                      <button
                        type="button"
                        onClick={() => setScheduleMode('schedule')}
                        className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition-colors ${
                          scheduleMode === 'schedule'
                            ? 'bg-orange-600 text-white'
                            : 'text-white/70 hover:text-white'
                        }`}
                      >
                        Schedule for later
                      </button>
                    </div>
                    {scheduleMode === 'schedule' && (
                      <div className="mb-4">
                        {!hasFullAccess && (
                          <p className="mb-3 text-sm text-white/70">
                            <button
                              type="button"
                              onClick={() => {
                                setAuthModalSignUp(true);
                                setShowAuthModal(true);
                              }}
                              className="font-medium text-orange-400 underline hover:text-orange-300"
                            >
                              Create an account
                            </button>
                            {' '}to schedule further out and track your sessions.
                          </p>
                        )}
                        <CreateFlowSchedulePicker
                          value={scheduledAt}
                          onChange={setScheduledAt}
                          minDate={new Date()}
                          maxWeeksAhead={hasFullAccess ? 52 : 1}
                        />
                      </div>
                    )}
                  </>
                }
              />
              {createError && (
                <p className="mt-4 text-sm text-red-400">{createError}</p>
              )}
            </section>
          )}

          {/* Join session */}
          {tab === 'join' && (
            <section className="rounded-2xl border border-white/10 bg-black/30 p-6">
              <h2 className="mb-4 text-xl font-bold text-white">Join a session</h2>
              <p className="mb-4 text-sm text-white/70">
                Enter the session ID from the host (e.g. from the share link).
              </p>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Session ID"
                  value={joinSessionId}
                  onChange={(e) => setJoinSessionId(e.target.value)}
                  className="w-full rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-white placeholder:text-white/50 focus:border-orange-500 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Your name or nickname"
                  value={joinNickname}
                  onChange={(e) => setJoinNickname(e.target.value)}
                  className="w-full rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-white placeholder:text-white/50 focus:border-orange-500 focus:outline-none"
                  aria-required="true"
                />
                <AmrapCtaButton
                  onClick={handleJoinSession}
                >
                  {loading ? 'Joining…' : 'Join session'}
                </AmrapCtaButton>
              </div>
              {joinError && (
                <p className="mt-4 text-sm text-red-400">{joinError}</p>
              )}
            </section>
          )}

          {/* Schedule */}
          {tab === 'schedule' && (
            <WeekCalendar
              initialSelectedSession={newlyScheduledSession}
              onInitialSessionSelected={() => setNewlyScheduledSession(null)}
              hasFullAccess={hasFullAccess}
            />
          )}
        </div>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        supabase={supabase}
        redirectBaseUrl={ACCOUNT_REDIRECT_URL}
        defaultSignUp={authModalSignUp}
      />
    </div>
  );
}
