import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase/supabase-instance';
import {
  readTrainerLiveLastSessionId,
  clearTrainerLiveLastSessionId,
} from '@/lib/trainer-live/storage';
import { trainerLiveClientJoinBasenamePath } from '@/lib/trainer-live/client-join-window';
import FluidBackground from '../../FluidBackground';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Tab = 'join' | 'resume';

type HubSessionRow = {
  session_id: string;
  trainer_display_name: string;
};

/** PostgREST usually returns a JSON array; normalize single-row / odd shapes. */
function normalizeHubSessionsRpcData(data: unknown): HubSessionRow[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data as HubSessionRow[];
  if (typeof data === 'object' && data !== null && 'session_id' in data) {
    return [data as HubSessionRow];
  }
  return [];
}

export default function LiveWithTrainerHubPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAppContext();
  const [tab, setTab] = useState<Tab>('join');
  const [sessionIdInput, setSessionIdInput] = useState('');
  const [joinErr, setJoinErr] = useState<string | null>(null);
  const [resumeSessionId, setResumeSessionId] = useState<string | null>(null);
  const [resumeCheckDone, setResumeCheckDone] = useState(false);
  const [hubSessions, setHubSessions] = useState<HubSessionRow[]>([]);
  const [hubSessionsLoading, setHubSessionsLoading] = useState(true);
  const [hubSessionsErr, setHubSessionsErr] = useState<string | null>(null);

  /**
   * Wait for AppProvider to finish restoring the Supabase session before RPC. Otherwise the first
   * request often runs without a JWT and `auth.uid()` is null — the hub list is empty until refresh.
   */
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    void (async () => {
      if (!session?.user) {
        setHubSessions([]);
        setHubSessionsErr(null);
        setHubSessionsLoading(false);
        return;
      }
      setHubSessionsLoading(true);
      setHubSessionsErr(null);
      try {
        const { data, error } = await supabase.rpc('trainer_live_client_hub_sessions', {});
        if (cancelled) return;
        if (error) {
          setHubSessions([]);
          setHubSessionsErr(error.message);
          return;
        }
        const rows = normalizeHubSessionsRpcData(data);
        setHubSessions(rows);
        if (rows.length > 0) {
          const first = String(rows[0].session_id ?? '').trim();
          if (UUID_RE.test(first)) {
            setSessionIdInput((prev) => (prev.trim() === '' ? first : prev));
          }
        }
      } finally {
        if (!cancelled) setHubSessionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, session?.user?.id]);

  useEffect(() => {
    const lastId = readTrainerLiveLastSessionId();
    if (!lastId) {
      setResumeCheckDone(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.rpc('trainer_live_session_join_hints', {
        p_session_id: lastId,
      });
      if (cancelled) return;
      if (error || !data || typeof data !== 'object') {
        clearTrainerLiveLastSessionId();
      } else {
        const row = data as { active?: boolean };
        if (row.active === true) {
          setResumeSessionId(lastId);
        } else {
          clearTrainerLiveLastSessionId();
        }
      }
      setResumeCheckDone(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const goToJoin = useCallback(
    (raw: string) => {
      const id = raw.trim();
      if (!id) {
        setJoinErr('Enter a session ID');
        return;
      }
      if (!UUID_RE.test(id)) {
        setJoinErr('Session ID must be a valid UUID (from your coach’s link).');
        return;
      }
      setJoinErr(null);
      navigate(trainerLiveClientJoinBasenamePath(id), { replace: false });
    },
    [navigate]
  );

  const calendarHref =
    typeof window !== 'undefined'
      ? `${window.location.origin}/interval-timers?hud=1#schedule-zone`
      : '/interval-timers?hud=1#schedule-zone';

  return (
    <div className="relative flex min-h-screen flex-col items-center bg-black p-6 text-white">
      <FluidBackground />
      <div className="relative z-10 mx-auto w-full max-w-2xl">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <a
            href="/interval-timers?hud=1"
            className="hover:text-orange-400 inline-flex items-center gap-2 text-sm font-bold text-white/70 transition-colors"
          >
            <span aria-hidden>←</span>
            <span>Back to calendar</span>
          </a>
        </div>

        <h1 className="font-display mb-2 text-3xl font-bold text-white">Live with Trainer</h1>
        <p className="mb-2 max-w-xl text-white/70">
          Your coach starts the room from Mission Control. Use the session ID they share, or open
          the invite link they send you.
        </p>
        <p className="mb-6 max-w-xl text-sm text-white/45">
          Scheduled live sessions also appear in your{' '}
          <a href={calendarHref} className="text-orange-light underline hover:text-white">
            HUD calendar
          </a>
          .
        </p>

        <div className="mb-6 flex gap-2 rounded-xl bg-black/30 p-1">
          <button
            type="button"
            onClick={() => {
              setTab('join');
              setJoinErr(null);
            }}
            className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition-colors ${
              tab === 'join' ? 'bg-orange-600 text-white' : 'text-white/70 hover:text-white'
            }`}
          >
            Join session
          </button>
          <button
            type="button"
            onClick={() => setTab('resume')}
            className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition-colors ${
              tab === 'resume' ? 'bg-orange-600 text-white' : 'text-white/70 hover:text-white'
            }`}
          >
            Resume
          </button>
        </div>

        {tab === 'join' ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-sm">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
              Session ID
            </label>
            <input
              value={sessionIdInput}
              onChange={(e) => {
                setSessionIdInput(e.target.value);
                setJoinErr(null);
              }}
              onPaste={(e) => {
                const t = e.clipboardData.getData('text').trim();
                if (UUID_RE.test(t)) {
                  e.preventDefault();
                  setSessionIdInput(t);
                }
              }}
              placeholder="Paste session ID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)"
              className="mb-4 w-full rounded-lg border border-white/20 bg-black/40 px-4 py-3 font-mono text-sm text-white placeholder:text-white/30 focus:border-orange-light focus:outline-none"
              autoComplete="off"
              spellCheck={false}
            />
            {authLoading || hubSessionsLoading ? (
              <p className="mb-4 text-sm text-white/50">Loading your live sessions…</p>
            ) : !session?.user ? (
              <p className="mb-4 text-sm text-white/45">
                Sign in to see live sessions linked to your account. You can still paste a session
                ID from your coach below.
              </p>
            ) : hubSessionsErr ? (
              <p className="mb-4 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                Could not load your live sessions ({hubSessionsErr}). You can still paste a session
                ID above.
              </p>
            ) : hubSessions.length > 0 ? (
              <div className="mb-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
                  Your live sessions
                </p>
                <ul className="space-y-2">
                  {hubSessions.map((row) => {
                    const sid = String(row.session_id ?? '').trim();
                    const name =
                      typeof row.trainer_display_name === 'string' &&
                      row.trainer_display_name.trim()
                        ? row.trainer_display_name.trim()
                        : 'Trainer';
                    return (
                      <li key={sid}>
                        <button
                          type="button"
                          onClick={() => {
                            setSessionIdInput(sid);
                            setJoinErr(null);
                          }}
                          className="hover:border-orange-light/40 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                        >
                          <div className="text-sm text-white/90">
                            Trainer: <span className="font-semibold text-white">{name}</span>
                          </div>
                          <div className="mt-0.5 break-all font-mono text-xs text-white/65">
                            Session ID: {sid}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="mb-4 text-sm text-white/45">
                No active live sessions are linked to your account yet. Use a session ID from your
                coach or join from your HUD calendar when a live session is scheduled.
              </p>
            )}
            {joinErr ? (
              <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {joinErr}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => goToJoin(sessionIdInput)}
              className="w-full rounded-xl bg-orange-light py-3 font-bold uppercase text-black hover:bg-white"
            >
              Continue
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-sm">
            {!resumeCheckDone ? (
              <p className="text-sm text-white/60">Checking for an active session…</p>
            ) : resumeSessionId ? (
              <>
                <p className="mb-4 text-sm text-white/85">
                  You have an active live session. Re-enter with the same participant when you’re
                  signed in.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    navigate(trainerLiveClientJoinBasenamePath(resumeSessionId), { replace: false })
                  }
                  className="border-orange-light/60 bg-orange-light/15 hover:bg-orange-light/25 w-full rounded-xl border py-3 font-bold uppercase text-orange-light"
                >
                  Re-enter last session
                </button>
              </>
            ) : (
              <p className="text-sm text-white/60">
                No resumable session. Ask your coach for a link or join with a session ID above.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
