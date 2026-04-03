import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase/supabase-instance';
import { trainerLiveParticipantStorageKey } from '@/lib/trainer-live/storage';
import { parseTrainerLiveShell, type TrainerLiveShell } from '@/lib/trainer-live/shells';
import TrainerLiveSessionRoom from './TrainerLiveSessionRoom';

export default function TrainerLiveHostView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAppContext();
  const [copyOk, setCopyOk] = useState(false);
  const [endBusy, setEndBusy] = useState(false);
  const [shell, setShell] = useState<TrainerLiveShell | null>(null);

  const participantId = useMemo(() => {
    if (!sessionId || typeof window === 'undefined') return null;
    return sessionStorage.getItem(trainerLiveParticipantStorageKey(sessionId));
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !participantId) return;
    let cancelled = false;
    void supabase
      .from('trainer_live_sessions')
      .select('shell')
      .eq('id', sessionId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) setShell('video_only');
        else setShell(parseTrainerLiveShell(data.shell as string | null));
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, participantId]);

  const shareUrl =
    typeof window !== 'undefined' && sessionId
      ? `${window.location.origin}/trainer/live/join/${sessionId}`
      : '';

  if (!sessionId) {
    return <p className="text-white/60">Missing session</p>;
  }

  if (!participantId) {
    return (
      <div className="max-w-lg text-white">
        <p className="mb-4 text-white/80">
          No host credentials for this session. Start a new room from{' '}
          <button
            type="button"
            className="text-orange-light underline"
            onClick={() => navigate('/live')}
          >
            Trainer Live
          </button>
          .
        </p>
      </div>
    );
  }

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const endForEveryone = async () => {
    setEndBusy(true);
    try {
      await supabase.rpc('trainer_live_end_session', { p_session_id: sessionId });
    } finally {
      setEndBusy(false);
    }
    sessionStorage.removeItem(trainerLiveParticipantStorageKey(sessionId));
    navigate('/live', { replace: true });
  };

  const localLabel = user?.displayName || user?.email?.split('@')[0] || 'You (trainer)';

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-4 py-3 md:px-6">
        <h1 className="font-heading text-sm font-bold uppercase tracking-tight text-orange-light md:text-base">
          Live session
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void copyLink()}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10 md:text-sm"
          >
            {copyOk ? 'Copied' : 'Copy join link'}
          </button>
          <button
            type="button"
            disabled={endBusy}
            onClick={() => void endForEveryone()}
            className="rounded-lg border border-red-500/50 bg-red-600/20 px-3 py-1.5 text-xs text-red-200 hover:bg-red-600/30 md:text-sm"
          >
            {endBusy ? 'Ending…' : 'End for everyone'}
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        {shell === null ? (
          <div className="flex h-48 items-center justify-center text-white/60">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-light border-t-transparent" />
          </div>
        ) : (
          <TrainerLiveSessionRoom
            shell={shell}
            sessionId={sessionId}
            participantId={participantId}
            role="trainer"
            localLabel={localLabel}
            onLeaveRoom={() => {
              sessionStorage.removeItem(trainerLiveParticipantStorageKey(sessionId));
              navigate('/live', { replace: true });
            }}
          />
        )}
      </div>
    </div>
  );
}
