import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useTrainerLiveAmrapChatDrawer } from '@/contexts/TrainerLiveAmrapChatDrawerContext';
import { useTrainerLiveTimerBackgroundOptional } from '@/contexts/TrainerLiveTimerBackgroundContext';
import { supabase } from '@/lib/supabase/supabase-instance';
import type { TrainerLiveShell } from '@/lib/trainer-live/shells';
import type { TrainerLiveIntervalWrapperKind } from '@/lib/trainer-live/wrappers/types';
import { getTrainerLiveIntervalWrapper } from '@/lib/trainer-live/wrappers/registry';
import TrainerLiveActivityDrawerRail from './TrainerLiveActivityDrawerRail';
import TrainerLiveCollapsibleSideRail from './TrainerLiveCollapsibleSideRail';
import TrainerLiveSessionMessageBoard from './TrainerLiveSessionMessageBoard';
import TrainerLiveVideoFeedDrawer from './TrainerLiveVideoFeedDrawer';
import TrainerLiveVideoShell, { type TrainerLiveRole } from './TrainerLiveVideoShell';
import TrainerLiveCountdownPanel from './shells/TrainerLiveCountdownPanel';

/** DOM mount for `TrainerLiveVideoShell` portal (trainer primary video + controls in SESSION column). */
export const TRAINER_LIVE_TRAINER_MAIN_SLOT_ID = 'trainer-live-trainer-main-slot';

export default function TrainerLiveSessionRoom({
  shell,
  sessionId,
  participantId,
  role,
  localLabel,
  onLeaveRoom,
  intervalWrapperKind,
  intervalWrapperConfig,
  displayName,
  authUserId,
  onWrapperError,
  activityTimer,
  className,
}: {
  shell: TrainerLiveShell;
  sessionId: string;
  participantId: string;
  role: TrainerLiveRole;
  localLabel: string;
  onLeaveRoom: () => void;
  intervalWrapperKind: TrainerLiveIntervalWrapperKind;
  intervalWrapperConfig: unknown;
  displayName: string;
  authUserId: string | null;
  onWrapperError?: (message: string) => void;
  /** Session activity timer + controls in a left collapsible rail. */
  activityTimer?: ReactNode;
  className?: string;
}) {
  const { chatDrawerLeaderboard } = useTrainerLiveAmrapChatDrawer();
  const timerBg = useTrainerLiveTimerBackgroundOptional();
  // Depend on presence only: timerBg object identity changes on leader/mode toggles; trainer id is stable.
  const hasTimerBackground = timerBg != null;
  const [clientTrainerParticipantId, setClientTrainerParticipantId] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (
      role !== 'client' ||
      shell !== 'countdown_timer' ||
      intervalWrapperKind !== 'amrap' ||
      !hasTimerBackground
    ) {
      setClientTrainerParticipantId(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error: qErr } = await supabase.rpc('trainer_live_list_participants', {
        p_session_id: sessionId,
      });
      if (cancelled || qErr) return;
      const rows = (data ?? []) as { id: string; role: string }[];
      const trainer = rows.find((r) => r.role === 'trainer');
      if (!cancelled) setClientTrainerParticipantId(trainer?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [role, shell, intervalWrapperKind, sessionId, hasTimerBackground]);

  const excludeUidForTiles =
    shell === 'countdown_timer' && intervalWrapperKind === 'amrap' && timerBg
      ? role === 'trainer'
        ? timerBg.mode === 'self'
          ? participantId
          : (timerBg.leaderTrainerLiveParticipantId ?? participantId)
        : clientTrainerParticipantId
      : null;

  const trainerMainPortalRootId =
    shell === 'countdown_timer' && role === 'trainer' ? TRAINER_LIVE_TRAINER_MAIN_SLOT_ID : undefined;

  const video = (
    <TrainerLiveVideoShell
      sessionId={sessionId}
      participantId={participantId}
      role={role}
      localLabel={localLabel}
      onLeaveRoom={onLeaveRoom}
      compact={shell === 'countdown_timer'}
      excludeUidForTiles={excludeUidForTiles}
      trainerMainPortalRootId={trainerMainPortalRootId}
    />
  );

  const activityRail =
    activityTimer != null ? (
      <TrainerLiveActivityDrawerRail sessionId={sessionId} defaultOpen>
        {activityTimer}
      </TrainerLiveActivityDrawerRail>
    ) : null;

  const showChatDrawerLeaderboard =
    intervalWrapperKind === 'amrap' && chatDrawerLeaderboard != null;

  const chatRail = (
    <TrainerLiveCollapsibleSideRail
      sessionId={sessionId}
      label="Chat"
      ariaLabelCollapse="Collapse room chat"
      ariaLabelExpand="Expand room chat"
      defaultOpen={false}
      data-testid="trainer-live-chat-rail"
    >
      {showChatDrawerLeaderboard ? (
        <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
          <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,5fr)_minmax(0,6fr)] gap-2 overflow-hidden">
            <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
              <TrainerLiveSessionMessageBoard
                sessionId={sessionId}
                participantId={participantId}
                compactDrawerLayout
                className="min-h-0 flex-1 border-0 bg-transparent p-0"
              />
            </div>
            <div
              className="min-h-0 overflow-y-auto overflow-x-hidden"
              data-testid="trainer-live-chat-drawer-leaderboard"
            >
              {chatDrawerLeaderboard}
            </div>
          </div>
        </div>
      ) : (
        <TrainerLiveSessionMessageBoard
          sessionId={sessionId}
          participantId={participantId}
          className="border-0 bg-transparent p-0"
        />
      )}
    </TrainerLiveCollapsibleSideRail>
  );

  if (shell === 'countdown_timer') {
    const wrapperProps = {
      trainerLiveSessionId: sessionId,
      participantId,
      role,
      displayName,
      authUserId,
      wrapperConfig: intervalWrapperConfig,
      onWrapperError,
    };

    const intervalSidebar = (() => {
      if (intervalWrapperKind === 'none') {
        return (
          <div
            className="rounded-xl border border-white/10 bg-black/40 px-4 py-6 text-center text-sm text-white/70"
            data-testid="trainer-live-interval-none"
          >
            {role === 'trainer' ? (
              <p>
                Choose an interval tool above (e.g. Start AMRAP) or continue with video only in the
                main panel.
              </p>
            ) : (
              <p>Waiting for your trainer to start an interval or timer.</p>
            )}
          </div>
        );
      }
      if (intervalWrapperKind === 'simple_countdown') {
        return <TrainerLiveCountdownPanel variant={role === 'trainer' ? 'trainer' : 'client'} />;
      }
      if (intervalWrapperKind === 'amrap' || intervalWrapperKind === 'tabata') {
        const Cmp = getTrainerLiveIntervalWrapper(intervalWrapperKind);
        if (!Cmp) return null;
        return <Cmp {...wrapperProps} />;
      }
      return null;
    })();

    return (
      <div
        className={`flex min-h-0 w-full flex-1 flex-row items-stretch ${className ?? ''}`}
      >
        {activityRail}
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
          {role === 'trainer' ? (
            <div
              id={TRAINER_LIVE_TRAINER_MAIN_SLOT_ID}
              className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col px-2 pt-2 md:px-4"
              data-testid="trainer-live-trainer-main-slot"
            />
          ) : null}
          {/* shrink-0: interval height is content-driven; SESSION slot above fills remaining column height. */}
          <div className="shrink-0 px-2 pb-1 pt-2 md:px-4 md:pb-2">{intervalSidebar}</div>
        </div>
        <TrainerLiveVideoFeedDrawer
          sessionId={sessionId}
          defaultOpen={intervalWrapperKind !== 'amrap' && intervalWrapperKind !== 'tabata'}
        >
          {video}
        </TrainerLiveVideoFeedDrawer>
        {chatRail}
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-0 w-full flex-1 flex-row items-stretch ${className ?? ''}`}
    >
      {activityRail}
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">{video}</div>
      {chatRail}
    </div>
  );
}
