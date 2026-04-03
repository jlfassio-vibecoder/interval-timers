import type { TrainerLiveShell } from '@/lib/trainer-live/shells';
import type { TrainerLiveIntervalWrapperKind } from '@/lib/trainer-live/wrappers/types';
import { getTrainerLiveIntervalWrapper } from '@/lib/trainer-live/wrappers/registry';
import TrainerLiveCollapsibleSideRail from './TrainerLiveCollapsibleSideRail';
import TrainerLiveSessionMessageBoard from './TrainerLiveSessionMessageBoard';
import TrainerLiveVideoFeedDrawer from './TrainerLiveVideoFeedDrawer';
import TrainerLiveVideoShell, { type TrainerLiveRole } from './TrainerLiveVideoShell';
import TrainerLiveCountdownPanel from './shells/TrainerLiveCountdownPanel';

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
}) {
  const video = (
    <TrainerLiveVideoShell
      sessionId={sessionId}
      participantId={participantId}
      role={role}
      localLabel={localLabel}
      onLeaveRoom={onLeaveRoom}
      compact={shell === 'countdown_timer'}
    />
  );

  const chatRail = (
    <TrainerLiveCollapsibleSideRail
      sessionId={sessionId}
      label="Chat"
      ariaLabelCollapse="Collapse room chat"
      ariaLabelExpand="Expand room chat"
      defaultOpen={false}
      data-testid="trainer-live-chat-rail"
    >
      <TrainerLiveSessionMessageBoard
        sessionId={sessionId}
        participantId={participantId}
        className="border-0 bg-transparent p-0"
      />
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
      if (intervalWrapperKind === 'amrap') {
        const Cmp = getTrainerLiveIntervalWrapper('amrap');
        if (!Cmp) return null;
        return <Cmp {...wrapperProps} />;
      }
      return null;
    })();

    return (
      <div className="flex min-h-0 flex-1 flex-row items-stretch">
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">{intervalSidebar}</div>
        <TrainerLiveVideoFeedDrawer
          sessionId={sessionId}
          defaultOpen={intervalWrapperKind !== 'amrap'}
        >
          {video}
        </TrainerLiveVideoFeedDrawer>
        {chatRail}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-row items-stretch">
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">{video}</div>
      {chatRail}
    </div>
  );
}
