import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase/supabase-instance';
import { trainerLiveParticipantStorageKey } from '@/lib/trainer-live/storage';
import FluidBackground from '../../FluidBackground';
import { parseTrainerLiveShell, type TrainerLiveShell } from '@/lib/trainer-live/shells';
import TrainerLiveSessionRoom from './TrainerLiveSessionRoom';

type JoinHints = { active: boolean; requires_invited_account: boolean; shell?: string };

function joinErrorMessage(message: string): string {
  if (message.includes('another participant')) {
    return 'This invite link was issued for a different account. Ask your trainer for a new link if you use multiple emails.';
  }
  if (message.includes('Sign in to join')) {
    return message;
  }
  return message;
}

export default function TrainerLiveClientJoinPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hints, setHints] = useState<JoinHints | null>(null);
  const [hintsLoading, setHintsLoading] = useState(true);
  const [authSession, setAuthSession] = useState<Session | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(() => {
    if (!sessionId || typeof window === 'undefined') return null;
    return sessionStorage.getItem(trainerLiveParticipantStorageKey(sessionId));
  });
  const [roomShell, setRoomShell] = useState<TrainerLiveShell>('video_only');
  const [roomShellReady, setRoomShellReady] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setAuthSession(data.session ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setHintsLoading(false);
      return;
    }
    let cancelled = false;
    setHintsLoading(true);
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('trainer_live_session_join_hints', {
          p_session_id: sessionId,
        });
        if (cancelled) return;
        if (error) {
          setHints({ active: false, requires_invited_account: false });
          return;
        }
        const row = data as JoinHints | null;
        setHints(
          row ?? {
            active: false,
            requires_invited_account: false,
          }
        );
      } finally {
        if (!cancelled) setHintsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !participantId) {
      setRoomShellReady(false);
      return;
    }
    let cancelled = false;
    setRoomShellReady(false);
    void supabase
      .rpc('trainer_live_session_join_hints', { p_session_id: sessionId })
      .then(({ data, error }) => {
        if (cancelled) return;
        const row = (data as JoinHints | null) ?? null;
        if (error || !row) {
          setRoomShell('video_only');
        } else {
          setRoomShell(parseTrainerLiveShell(row.shell));
        }
        setRoomShellReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, participantId]);

  const join = async () => {
    if (!sessionId) return;
    setErr(null);
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('trainer_live_join_session', {
        p_session_id: sessionId,
        p_display_name: name.trim() || 'Guest',
      });
      if (error) {
        setErr(joinErrorMessage(error.message));
        return;
      }
      const row = data as { participant_id?: string } | null;
      const pid = row?.participant_id;
      if (!pid) {
        setErr('Join failed');
        return;
      }
      sessionStorage.setItem(trainerLiveParticipantStorageKey(sessionId), pid);
      setParticipantId(pid);
    } finally {
      setBusy(false);
    }
  };

  if (!sessionId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        Invalid link
      </div>
    );
  }

  if (participantId) {
    return (
      <div className="relative min-h-screen bg-black p-4 text-white md:p-8">
        <FluidBackground />
        <div className="relative z-10 mx-auto max-w-5xl">
          <h1 className="mb-4 font-heading text-xl font-bold uppercase tracking-tight text-orange-light">
            Live session
          </h1>
          {!roomShellReady ? (
            <div className="flex h-48 items-center justify-center text-white/60">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-light border-t-transparent" />
            </div>
          ) : (
            <TrainerLiveSessionRoom
              shell={roomShell}
              sessionId={sessionId}
              participantId={participantId}
              role="client"
              localLabel="You"
              onLeaveRoom={() => {
                sessionStorage.removeItem(trainerLiveParticipantStorageKey(sessionId));
                navigate('/live/join/' + sessionId, { replace: true });
                setParticipantId(null);
              }}
            />
          )}
        </div>
      </div>
    );
  }

  if (hintsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-light border-t-transparent" />
      </div>
    );
  }

  if (hints && !hints.active) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-black p-6 text-white">
        <FluidBackground />
        <div className="relative z-10 text-center">
          <h1 className="mb-2 font-heading text-xl font-bold uppercase text-orange-light">
            Session unavailable
          </h1>
          <p className="text-white/60">This live session has ended or does not exist.</p>
        </div>
      </div>
    );
  }

  const requiresAuth = hints?.requires_invited_account === true;
  const signedIn = !!authSession?.user;

  if (requiresAuth && !signedIn) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-black p-6 text-white">
        <FluidBackground />
        <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-black/60 p-8 text-center backdrop-blur-sm">
          <h1 className="mb-2 font-heading text-2xl font-bold uppercase text-orange-light">
            Sign in required
          </h1>
          <p className="mb-6 text-sm text-white/60">
            Your trainer invited you to a private live session. Sign in with the account they use
            for your coaching profile, then return to this page or open the same invite link again.
          </p>
          <a
            href="/account"
            className="inline-block w-full rounded-xl bg-orange-light py-3 text-center font-bold uppercase text-black hover:bg-white"
          >
            Sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-black p-6 text-white">
      <FluidBackground />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-black/60 p-8 backdrop-blur-sm">
        <h1 className="mb-2 font-heading text-2xl font-bold uppercase text-orange-light">
          Join session
        </h1>
        <p className="mb-6 text-sm text-white/60">
          {requiresAuth && signedIn
            ? 'You are signed in. Your display name in the room will match your profile (or username).'
            : 'Enter your name so the trainer knows who joined.'}
        </p>
        {err ? (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {err}
          </div>
        ) : null}
        {!(requiresAuth && signedIn) ? (
          <>
            <label className="mb-2 block text-xs uppercase tracking-wider text-white/50">
              Display name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="mb-6 w-full rounded-lg border border-white/20 bg-black/40 px-4 py-3 text-white placeholder:text-white/30 focus:border-orange-light focus:outline-none"
            />
          </>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void join()}
          className="w-full rounded-xl bg-orange-light py-3 font-bold uppercase text-black hover:bg-white disabled:opacity-50"
        >
          {busy ? 'Joining…' : 'Join video'}
        </button>
      </div>
    </div>
  );
}
