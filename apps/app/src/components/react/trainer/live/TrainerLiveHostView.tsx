import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase/supabase-instance';
import {
  trainerLiveParticipantStorageKey,
  readTrainerLiveParticipantIdFromStorage,
  setTrainerLiveLastSessionId,
  clearTrainerLiveLastSessionId,
} from '@/lib/trainer-live/storage';
import { parseTrainerLiveShell, type TrainerLiveShell } from '@/lib/trainer-live/shells';
import type { TrainerLiveIntervalWrapperKind } from '@/lib/trainer-live/wrappers/types';
import { parseIntervalWrapperKind } from '@/lib/trainer-live/wrappers/kind';
import { TrainerLiveAgoraProvider } from '@/contexts/TrainerLiveAgoraContext';
import {
  TrainerLiveAmrapSessionDrawerProvider,
  TrainerLiveSessionDrawerSlot,
} from '@/contexts/TrainerLiveAmrapSessionDrawerContext';
import { TrainerLiveAmrapChatDrawerProvider } from '@/contexts/TrainerLiveAmrapChatDrawerContext';
import { TrainerLiveTimerBackgroundProvider } from '@/contexts/TrainerLiveTimerBackgroundContext';
import TrainerLiveActivityTimer from './TrainerLiveActivityTimer';
import TrainerLiveSessionRoom from './TrainerLiveSessionRoom';
import { TrainerLiveAmrapHostNavProvider } from '@/contexts/TrainerLiveAmrapHostNavContext';
import TrainerLiveHostNavHeaderBar from './TrainerLiveHostNavHeaderBar';
import TrainerLiveHostShareMenu from './TrainerLiveHostShareMenu';
import TrainerLiveInviteClientsModal from './TrainerLiveInviteClientsModal';

export default function TrainerLiveHostView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAppContext();
  const [copyLinkOk, setCopyLinkOk] = useState(false);
  const [copySessionIdOk, setCopySessionIdOk] = useState(false);
  const [endBusy, setEndBusy] = useState(false);
  const [endErr, setEndErr] = useState<string | null>(null);
  const [shell, setShell] = useState<TrainerLiveShell | null>(null);
  const [intervalWrapperKind, setIntervalWrapperKind] =
    useState<TrainerLiveIntervalWrapperKind>('none');
  const [intervalWrapperConfig, setIntervalWrapperConfig] = useState<unknown>(null);
  const [backBusy, setBackBusy] = useState(false);
  const [backErr, setBackErr] = useState<string | null>(null);
  const [wrapperErr, setWrapperErr] = useState<string | null>(null);
  const [inviteClientsOpen, setInviteClientsOpen] = useState(false);
  /** Reserved 1:1 session (`invited_client_user_id` set) — roster invites not allowed. */
  const [reservedForSingleClient, setReservedForSingleClient] = useState(false);

  const [participantId, setParticipantId] = useState<string | null>(() =>
    readTrainerLiveParticipantIdFromStorage(sessionId)
  );
  const [hostParticipantHydrating, setHostParticipantHydrating] = useState(false);

  useEffect(() => {
    setParticipantId(readTrainerLiveParticipantIdFromStorage(sessionId));
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !user?.uid || participantId) return;
    let cancelled = false;
    setHostParticipantHydrating(true);
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('trainer_live_participants')
          .select('id')
          .eq('session_id', sessionId)
          .eq('role', 'trainer')
          .eq('user_id', user.uid)
          .maybeSingle();
        if (cancelled || error || !data?.id) return;
        const id = data.id as string;
        sessionStorage.setItem(trainerLiveParticipantStorageKey(sessionId), id);
        setParticipantId(id);
      } finally {
        if (!cancelled) setHostParticipantHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, user?.uid, participantId]);

  useEffect(() => {
    if (!sessionId?.trim() || !participantId) return;
    setTrainerLiveLastSessionId(sessionId.trim());
  }, [sessionId, participantId]);

  useEffect(() => {
    if (!sessionId || !participantId) return;
    let cancelled = false;
    void (async () => {
      // Prefer SECURITY DEFINER RPC over direct REST: RLS / missing columns on `trainer_live_sessions`
      // can make `.select('shell')` fail and default the UI to `video_only`, so "Video + Intervals"
      // looked identical to "Video only".
      const { data: hintsData, error: hintsErr } = await supabase.rpc(
        'trainer_live_session_join_hints',
        {
          p_session_id: sessionId,
        }
      );
      if (cancelled) return;
      if (!hintsErr && hintsData && typeof hintsData === 'object') {
        const row = hintsData as Record<string, unknown>;
        if (row.active === false) {
          setReservedForSingleClient(false);
          setShell('video_only');
          setIntervalWrapperKind('none');
          setIntervalWrapperConfig(null);
          return;
        }
        setReservedForSingleClient(Boolean(row.requires_invited_account));
        setShell(parseTrainerLiveShell(typeof row.shell === 'string' ? row.shell : null));
        setIntervalWrapperKind(
          parseIntervalWrapperKind(
            row.interval_wrapper_kind != null ? String(row.interval_wrapper_kind) : undefined
          )
        );
        setIntervalWrapperConfig(
          'interval_wrapper_config' in row ? (row.interval_wrapper_config ?? null) : null
        );
        return;
      }
      const slim = await supabase
        .from('trainer_live_sessions')
        .select('shell')
        .eq('id', sessionId)
        .maybeSingle();
      if (cancelled) return;
      if (slim.error || !slim.data) {
        setReservedForSingleClient(false);
        setShell('video_only');
        setIntervalWrapperKind('none');
        setIntervalWrapperConfig(null);
        return;
      }
      setReservedForSingleClient(false);
      setShell(parseTrainerLiveShell(slim.data.shell as string | null));
      setIntervalWrapperKind('none');
      setIntervalWrapperConfig(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, participantId]);

  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`trainer-live-session-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trainer_live_sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (typeof row.shell === 'string') {
            setShell(parseTrainerLiveShell(row.shell));
          }
          if (row.interval_wrapper_kind != null) {
            setIntervalWrapperKind(parseIntervalWrapperKind(String(row.interval_wrapper_kind)));
          }
          if ('interval_wrapper_config' in row) {
            setIntervalWrapperConfig(row.interval_wrapper_config ?? null);
          }
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const shareUrl =
    typeof window !== 'undefined' && sessionId
      ? `${window.location.origin}/trainer/live/join/${sessionId}`
      : '';

  if (!sessionId) {
    return <p className="text-white/60">Missing session</p>;
  }

  if (!participantId) {
    if (hostParticipantHydrating) {
      return (
        <div className="flex min-h-[40vh] items-center justify-center text-white/70">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-light border-t-transparent" />
        </div>
      );
    }
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
      setCopyLinkOk(true);
      setTimeout(() => setCopyLinkOk(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const copyJoinSessionId = async () => {
    if (!sessionId?.trim()) return;
    try {
      await navigator.clipboard.writeText(sessionId.trim());
      setCopySessionIdOk(true);
      setTimeout(() => setCopySessionIdOk(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const endForEveryone = async () => {
    if (!sessionId) return;
    setEndErr(null);
    setEndBusy(true);
    try {
      const { error } = await supabase.rpc('trainer_live_end_session', { p_session_id: sessionId });
      if (error) {
        setEndErr(error.message);
        return;
      }
      sessionStorage.removeItem(trainerLiveParticipantStorageKey(sessionId));
      clearTrainerLiveLastSessionId();
      navigate(`/live/${encodeURIComponent(sessionId)}/summary`, { replace: true });
    } finally {
      setEndBusy(false);
    }
  };

  const returnToMainVideo = async () => {
    if (!sessionId) return;
    setBackErr(null);
    setBackBusy(true);
    try {
      const { error } = await supabase.rpc('trainer_live_return_to_main_video', {
        p_trainer_live_session_id: sessionId,
      });
      if (error) {
        setBackErr(error.message);
        return;
      }
      setShell('countdown_timer');
      setIntervalWrapperKind('none');
      setIntervalWrapperConfig(null);
    } finally {
      setBackBusy(false);
    }
  };

  const localLabel = user?.displayName || user?.email?.split('@')[0] || 'You (trainer)';
  const authUserId = user?.uid ?? null;

  return (
    <TrainerLiveAmrapHostNavProvider>
      <div
        className="fixed inset-0 z-[100] flex flex-col bg-black text-white"
        data-region="trainer-live-session-root"
      >
        <TrainerLiveHostNavHeaderBar>
          {wrapperErr ? (
            <p className="max-w-xs text-xs text-amber-200 md:max-w-md" role="status">
              {wrapperErr}
            </p>
          ) : null}
          {endErr ? (
            <p className="max-w-xs text-xs text-red-300 md:max-w-md" role="alert">
              {endErr}
            </p>
          ) : null}
          {backErr ? (
            <p className="max-w-xs text-xs text-red-300 md:max-w-md" role="alert">
              {backErr}
            </p>
          ) : null}
          {shell === 'countdown_timer' &&
          (intervalWrapperKind === 'amrap' ||
            intervalWrapperKind === 'tabata' ||
            intervalWrapperKind === 'emom') ? (
            <button
              type="button"
              data-testid="trainer-live-back-to-video"
              disabled={backBusy}
              onClick={() => void returnToMainVideo()}
              className="rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/15 md:text-sm"
            >
              {backBusy ? 'Returning…' : 'Back to video'}
            </button>
          ) : null}
          {shell === 'countdown_timer' && intervalWrapperKind === 'amrap' ? (
            <span className="text-xs text-white/50 md:text-sm">AMRAP active</span>
          ) : null}
          {shell === 'countdown_timer' && intervalWrapperKind === 'tabata' ? (
            <span className="text-xs text-white/50 md:text-sm">Tabata active</span>
          ) : null}
          {shell === 'countdown_timer' && intervalWrapperKind === 'emom' ? (
            <span className="text-xs text-white/50 md:text-sm">EMOM active</span>
          ) : null}
          <TrainerLiveHostShareMenu
            copyLink={() => void copyLink()}
            copyJoinSessionId={() => void copyJoinSessionId()}
            copyLinkOk={copyLinkOk}
            copySessionIdOk={copySessionIdOk}
            onOpenInvite={() => setInviteClientsOpen(true)}
            inviteDisabled={reservedForSingleClient}
            inviteDisabledReason="This session is reserved for one client. In-app roster invites are not available."
          />
          <button
            type="button"
            disabled={endBusy}
            onClick={() => void endForEveryone()}
            className="rounded-lg border border-red-500/50 bg-red-600/20 px-3 py-1.5 text-xs text-red-200 hover:bg-red-600/30 md:text-sm"
          >
            {endBusy ? 'Ending…' : 'End for everyone'}
          </button>
        </TrainerLiveHostNavHeaderBar>
        <div
          className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-0 pt-3 md:px-6 md:pb-0 md:pt-4"
          data-region="trainer-live-main-workspace"
        >
          {shell === null ? (
            <div className="flex h-48 items-center justify-center text-white/60">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-light border-t-transparent" />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <TrainerLiveAmrapSessionDrawerProvider>
                <TrainerLiveAmrapChatDrawerProvider>
                  <TrainerLiveAgoraProvider
                    sessionId={sessionId}
                    participantId={participantId}
                    authUserId={authUserId}
                  >
                    <TrainerLiveTimerBackgroundProvider sessionId={sessionId}>
                      <TrainerLiveSessionRoom
                        shell={shell}
                        sessionId={sessionId}
                        participantId={participantId}
                        role="trainer"
                        localLabel={localLabel}
                        className="h-full min-h-0 min-w-0 flex-1"
                        onLeaveRoom={() => {
                          sessionStorage.removeItem(trainerLiveParticipantStorageKey(sessionId));
                          navigate('/live', { replace: true });
                        }}
                        intervalWrapperKind={intervalWrapperKind}
                        intervalWrapperConfig={intervalWrapperConfig}
                        displayName={localLabel}
                        authUserId={authUserId}
                        onWrapperError={setWrapperErr}
                        activityTimer={
                          <>
                            <TrainerLiveSessionDrawerSlot />
                            <TrainerLiveActivityTimer
                              sessionId={sessionId}
                              participantId={participantId}
                              authUserId={user?.uid ?? null}
                              role="trainer"
                              shell={shell}
                              drawerLayout
                            />
                          </>
                        }
                      />
                    </TrainerLiveTimerBackgroundProvider>
                  </TrainerLiveAgoraProvider>
                </TrainerLiveAmrapChatDrawerProvider>
              </TrainerLiveAmrapSessionDrawerProvider>
            </div>
          )}
        </div>
        {sessionId ? (
          <TrainerLiveInviteClientsModal
            open={inviteClientsOpen}
            onOpenChange={setInviteClientsOpen}
            sessionId={sessionId}
          />
        ) : null}
      </div>
    </TrainerLiveAmrapHostNavProvider>
  );
}
