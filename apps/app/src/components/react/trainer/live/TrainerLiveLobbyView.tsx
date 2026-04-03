import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase/supabase-instance';
import { trainerLiveParticipantStorageKey } from '@/lib/trainer-live/storage';
import type { TrainerLiveShell } from '@/lib/trainer-live/shells';

export default function TrainerLiveLobbyView() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [shellChoice, setShellChoice] = useState<TrainerLiveShell>('video_only');

  const start = async () => {
    setErr(null);
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('trainer_live_create_session', {
        p_shell: shellChoice,
      });
      if (error) {
        setErr(error.message);
        return;
      }
      const row = data as { session_id?: string; participant_id?: string } | null;
      const sid = row?.session_id;
      const pid = row?.participant_id;
      if (!sid || !pid) {
        setErr('Could not create session');
        return;
      }
      sessionStorage.setItem(trainerLiveParticipantStorageKey(sid), pid);
      navigate(`/live/${sid}`, { replace: false });
    } finally {
      setBusy(false);
    }
  };

  const joinUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/trainer/live/join/`
      : '/trainer/live/join/';

  return (
    <div>
      <h1 className="mb-2 font-heading text-3xl font-bold uppercase text-white">Trainer Live</h1>
      <p className="mb-8 max-w-xl text-white/60">
        Start a video room for up to six clients. Share the join link after the room is open.
      </p>
      {err ? (
        <div className="mb-4 max-w-xl rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {err}
        </div>
      ) : null}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/45">Room type</p>
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => setShellChoice('video_only')}
          className={`rounded-lg border px-4 py-2 text-sm font-semibold uppercase transition-colors disabled:opacity-50 ${
            shellChoice === 'video_only'
              ? 'border-orange-light bg-white/10 text-orange-light'
              : 'border-white/20 text-white/70 hover:border-white/40'
          }`}
        >
          Video only
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setShellChoice('countdown_timer')}
          className={`rounded-lg border px-4 py-2 text-sm font-semibold uppercase transition-colors disabled:opacity-50 ${
            shellChoice === 'countdown_timer'
              ? 'border-orange-light bg-white/10 text-orange-light'
              : 'border-white/20 text-white/70 hover:border-white/40'
          }`}
        >
          Video + Intervals
        </button>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void start()}
        className="rounded-xl bg-orange-light px-8 py-3 font-bold uppercase text-black hover:bg-white disabled:opacity-50"
      >
        {busy ? 'Starting…' : 'Start live session'}
      </button>
      <p className="mt-8 text-xs uppercase tracking-wider text-white/40">
        Client join URL pattern (after you start): <code className="text-white/70">{joinUrl}</code>
        <span className="text-white/50">{'{sessionId}'}</span>
      </p>
    </div>
  );
}
