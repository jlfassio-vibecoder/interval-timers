import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { setStoredHostToken, setStoredParticipantId } from 'amrap/embed';
import { isValidAttachWorkoutInput } from '@interval-timers/amrap-workout-picker';
import { isValidTabataAttachInput } from '@/lib/trainer-live/tabata-workout-list-adapter';
import { useAppContext } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase/supabase-instance';
import {
  trainerLiveParticipantStorageKey,
  readTrainerLiveParticipantIdFromStorage,
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
import TrainerLiveAmrapWorkoutPickerModal from './TrainerLiveAmrapWorkoutPickerModal';
import TrainerLiveTabataWorkoutPickerModal from './TrainerLiveTabataWorkoutPickerModal';
import TrainerLiveSessionRoom from './TrainerLiveSessionRoom';
import { TrainerLiveAmrapHostNavProvider } from '@/contexts/TrainerLiveAmrapHostNavContext';
import TrainerLiveHostNavHeaderBar from './TrainerLiveHostNavHeaderBar';

export default function TrainerLiveHostView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAppContext();
  const [copyOk, setCopyOk] = useState(false);
  const [endBusy, setEndBusy] = useState(false);
  const [endErr, setEndErr] = useState<string | null>(null);
  const [shell, setShell] = useState<TrainerLiveShell | null>(null);
  const [intervalWrapperKind, setIntervalWrapperKind] =
    useState<TrainerLiveIntervalWrapperKind>('none');
  const [intervalWrapperConfig, setIntervalWrapperConfig] = useState<unknown>(null);
  const [attachBusy, setAttachBusy] = useState(false);
  const [attachErr, setAttachErr] = useState<string | null>(null);
  const [backBusy, setBackBusy] = useState(false);
  const [backErr, setBackErr] = useState<string | null>(null);
  const [wrapperErr, setWrapperErr] = useState<string | null>(null);
  const [amrapPickerOpen, setAmrapPickerOpen] = useState(false);
  const [amrapPickerKey, setAmrapPickerKey] = useState(0);
  const [tabataPickerOpen, setTabataPickerOpen] = useState(false);
  const [tabataPickerKey, setTabataPickerKey] = useState(0);

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
          setShell('video_only');
          setIntervalWrapperKind('none');
          setIntervalWrapperConfig(null);
          return;
        }
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
        setShell('video_only');
        setIntervalWrapperKind('none');
        setIntervalWrapperConfig(null);
        return;
      }
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
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 2000);
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

  const attachTabata = async (workoutList: string[], roundCount: number) => {
    if (!sessionId) return;
    if (!isValidTabataAttachInput(roundCount, workoutList)) {
      setAttachErr('Choose 1–32 Tabata rounds and at least one exercise.');
      return;
    }
    setAttachErr(null);
    setAttachBusy(true);
    try {
      const { data, error } = await supabase.rpc('trainer_live_attach_tabata_session', {
        p_trainer_live_session_id: sessionId,
        p_round_count: roundCount,
        p_workout_list: workoutList,
      });
      if (error) {
        setAttachErr(error.message);
        return;
      }
      const row = data as { tabata_session_id?: string } | null;
      const tid = row?.tabata_session_id;
      if (tid) {
        setIntervalWrapperKind('tabata');
        setIntervalWrapperConfig({ tabata_session_id: tid });
        setTabataPickerOpen(false);
      } else {
        // RPC succeeded but payload missing id (should not happen); avoid silent failure with picker stuck open
        setAttachErr('Unable to attach Tabata session. Please try again.');
      }
    } finally {
      setAttachBusy(false);
    }
  };

  const attachAmrap = async (workoutList: string[], durationMinutes: number) => {
    if (!sessionId) return;
    if (!isValidAttachWorkoutInput(durationMinutes, workoutList)) {
      setAttachErr('Choose a duration between 1 and 180 minutes and at least one exercise.');
      return;
    }
    setAttachErr(null);
    setAttachBusy(true);
    try {
      const { data, error } = await supabase.rpc('trainer_live_attach_amrap_session', {
        p_trainer_live_session_id: sessionId,
        p_duration_minutes: durationMinutes,
        p_workout_list: workoutList,
      });
      if (error) {
        setAttachErr(error.message);
        return;
      }
      const row = data as {
        amrap_session_id?: string;
        host_token?: string | null;
        amrap_participant_id?: string;
      } | null;
      const aid = row?.amrap_session_id;
      const ht = row?.host_token;
      const apid = row?.amrap_participant_id;
      if (aid && ht) {
        setStoredHostToken(aid, ht);
      }
      if (aid && apid) {
        setStoredParticipantId(aid, apid);
      }
      if (aid) {
        setIntervalWrapperKind('amrap');
        setIntervalWrapperConfig({ amrap_session_id: aid });
        setAmrapPickerOpen(false);
      } else {
        setAttachErr('Unable to attach AMRAP session. Please try again.');
      }
    } finally {
      setAttachBusy(false);
    }
  };

  const localLabel = user?.displayName || user?.email?.split('@')[0] || 'You (trainer)';
  const authUserId = user?.uid ?? null;

  return (
    <TrainerLiveAmrapHostNavProvider>
      <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white">
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
          {attachErr ? (
            <p className="max-w-xs text-xs text-red-300 md:max-w-md" role="alert">
              {attachErr}
            </p>
          ) : null}
          {backErr ? (
            <p className="max-w-xs text-xs text-red-300 md:max-w-md" role="alert">
              {backErr}
            </p>
          ) : null}
          {shell === 'countdown_timer' &&
          (intervalWrapperKind === 'amrap' || intervalWrapperKind === 'tabata') ? (
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
          {shell === 'countdown_timer' && intervalWrapperKind === 'none' ? (
            <>
              <button
                type="button"
                data-testid="trainer-live-start-amrap"
                disabled={attachBusy}
                onClick={() => {
                  setAmrapPickerKey((k) => k + 1);
                  setAmrapPickerOpen(true);
                }}
                className="border-orange-light/50 bg-orange-light/15 hover:bg-orange-light/25 rounded-lg border px-3 py-1.5 text-xs text-orange-light md:text-sm"
              >
                {attachBusy ? 'Starting…' : 'Start AMRAP'}
              </button>
              <button
                type="button"
                data-testid="trainer-live-start-tabata"
                disabled={attachBusy}
                onClick={() => {
                  setTabataPickerKey((k) => k + 1);
                  setTabataPickerOpen(true);
                }}
                className="border-orange-light/50 bg-orange-light/15 hover:bg-orange-light/25 rounded-lg border px-3 py-1.5 text-xs text-orange-light md:text-sm"
              >
                {attachBusy ? 'Starting…' : 'Start Tabata'}
              </button>
            </>
          ) : null}
          {shell === 'countdown_timer' && intervalWrapperKind === 'amrap' ? (
            <span className="text-xs text-white/50 md:text-sm">AMRAP active</span>
          ) : null}
          {shell === 'countdown_timer' && intervalWrapperKind === 'tabata' ? (
            <span className="text-xs text-white/50 md:text-sm">Tabata active</span>
          ) : null}
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
        </TrainerLiveHostNavHeaderBar>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        {shell === null ? (
          <div className="flex h-48 items-center justify-center text-white/60">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-light border-t-transparent" />
          </div>
        ) : (
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
        )}
        </div>
        <TrainerLiveAmrapWorkoutPickerModal
          open={amrapPickerOpen}
          pickerKey={amrapPickerKey}
          onOpenChange={setAmrapPickerOpen}
          disabled={attachBusy}
          onWorkoutChosen={(workoutList, durationMinutes) =>
            attachAmrap(workoutList, durationMinutes)
          }
        />
        <TrainerLiveTabataWorkoutPickerModal
          open={tabataPickerOpen}
          pickerKey={tabataPickerKey}
          onOpenChange={setTabataPickerOpen}
          disabled={attachBusy}
          onWorkoutChosen={(workoutList, roundCount) => attachTabata(workoutList, roundCount)}
        />
      </div>
    </TrainerLiveAmrapHostNavProvider>
  );
}
