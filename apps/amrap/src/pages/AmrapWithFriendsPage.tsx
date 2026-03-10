import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  setStoredHostToken,
  setStoredParticipantId,
} from '@/hooks/useAmrapSession';
import { useAmrapAuth, useAmrapPermissions } from '@/contexts/AmrapAuthContext';
import AccountLink from '@/components/AccountLink';
import AmrapCtaButton from '@/components/AmrapCtaButton';
import AuthModal from '@/components/AuthModal';
import WeekCalendar from '@/components/WeekCalendar';
import CreateFlowSchedulePicker from '@/components/CreateFlowSchedulePicker';
import {
  AMRAP_WORKOUT_LIBRARY,
  AMRAP_LEVEL_DURATION,
  AMRAP_PROTOCOL_LABELS,
} from '@/components/interval-timers/amrap-setup-data';
import type { AmrapLevel } from '@/components/interval-timers/amrap-setup-data';

type CreateStep = 'level' | 'workout';
type Tab = 'create' | 'join' | 'schedule';

export default function AmrapWithFriendsPage() {
  const navigate = useNavigate();
  const { hasFullAccess } = useAmrapPermissions();
  const { user } = useAmrapAuth();
  const [tab, setTab] = useState<Tab>('create');
  const [createStep, setCreateStep] = useState<CreateStep>('level');
  const [selectedLevel, setSelectedLevel] = useState<AmrapLevel | null>(null);
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
      const { data, error } = await supabase.rpc('create_session', {
        p_duration_minutes: durationMinutes,
        p_workout_list: workoutList,
        p_host_nickname: name,
        p_scheduled_start_at: scheduledDateTime
          ? new Date(scheduledDateTime).toISOString()
          : null,
        p_user_id: user?.id ?? null,
      });
      setLoading(false);
      if (error) {
        setCreateError(error.message);
        return;
      }
      const result = data as { session_id: string; host_token: string; participant_id: string };
      setStoredHostToken(result.session_id, result.host_token);
      setStoredParticipantId(result.session_id, result.participant_id);
      if (scheduledDateTime) {
        setNewlyScheduledSession({
          id: result.session_id,
          scheduled_start_at: new Date(scheduledDateTime).toISOString(),
        });
        setTab('schedule');
      } else {
        navigate(`/with-friends/session/${result.session_id}?host=1`);
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
    const { data, error } = await supabase.rpc('join_session', {
      p_session_id: sid,
      p_nickname: joinNickname.trim(),
      p_user_id: user?.id ?? null,
    });
    setLoading(false);
    if (error) {
      setJoinError(error.message);
      return;
    }
    const result = data as { participant_id: string };
    setStoredParticipantId(sid, result.participant_id);
    navigate(`/with-friends/session/${sid}`);
  }, [joinSessionId, joinNickname, navigate, user?.id]);

  const workouts = selectedLevel ? AMRAP_WORKOUT_LIBRARY[selectedLevel] : [];
  const duration = selectedLevel ? AMRAP_LEVEL_DURATION[selectedLevel] : 15;

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
              {createStep === 'level' && (
                <>
                  <p className="mb-4 text-sm text-white/70">
                    Choose a level, then pick a workout.
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {(['beginner', 'intermediate', 'advanced'] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => {
                          setSelectedLevel(level);
                          setCreateStep('workout');
                        }}
                        className="rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-orange-500 hover:bg-orange-600/10"
                      >
                        <div className="font-bold text-white">
                          {AMRAP_PROTOCOL_LABELS[level]}
                        </div>
                        <div className="mt-1 text-[10px] text-white/70">
                          {AMRAP_PROTOCOL_LABELS[`${level}Desc` as keyof typeof AMRAP_PROTOCOL_LABELS]}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {createStep === 'workout' && selectedLevel && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateStep('level');
                      setSelectedLevel(null);
                    }}
                    className="mb-4 text-sm font-medium text-white/60 hover:text-white"
                  >
                    ← Change level
                  </button>
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
                  <div className="grid max-h-[40vh] grid-cols-1 gap-3 overflow-y-auto md:grid-cols-2">
                    {workouts.map((option) => (
                      <button
                        key={option.name}
                        type="button"
                        disabled={loading}
                        onClick={() =>
                          handleCreateSession(
                            duration,
                            [...option.exercises],
                            hostNickname,
                            scheduleMode === 'schedule' ? scheduledAt || undefined : undefined
                          )
                        }
                        className="rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-orange-500 hover:bg-orange-600/10 disabled:opacity-50"
                      >
                        <div className="font-bold text-white">{option.name}</div>
                        <div className="mt-1 line-clamp-2 text-[10px] text-white/70">
                          {option.exercises.join(' → ')}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
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
        defaultSignUp={authModalSignUp}
      />
    </div>
  );
}
