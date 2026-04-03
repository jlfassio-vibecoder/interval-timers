import type { TrainerLiveShell } from '@/lib/trainer-live/shells';
import TrainerLiveVideoShell, { type TrainerLiveRole } from './TrainerLiveVideoShell';
import TrainerLiveCountdownPanel from './shells/TrainerLiveCountdownPanel';

export default function TrainerLiveSessionRoom({
  shell,
  sessionId,
  participantId,
  role,
  localLabel,
  onLeaveRoom,
}: {
  shell: TrainerLiveShell;
  sessionId: string;
  participantId: string;
  role: TrainerLiveRole;
  localLabel: string;
  onLeaveRoom: () => void;
}) {
  const video = (
    <TrainerLiveVideoShell
      sessionId={sessionId}
      participantId={participantId}
      role={role}
      localLabel={localLabel}
      onLeaveRoom={onLeaveRoom}
    />
  );

  if (shell === 'countdown_timer') {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:items-stretch">
        <div className="shrink-0 lg:max-w-sm lg:flex-1">
          <TrainerLiveCountdownPanel variant={role === 'trainer' ? 'trainer' : 'client'} />
        </div>
        <div className="min-h-0 min-w-0 flex-[2]">{video}</div>
      </div>
    );
  }

  return video;
}
