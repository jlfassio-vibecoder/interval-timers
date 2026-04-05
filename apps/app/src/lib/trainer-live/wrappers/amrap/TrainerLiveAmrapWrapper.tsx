import { useEffect, useState } from 'react';
import {
  AmrapAuthProvider,
  AmrapSessionShell,
  useSocialAmrapEmbedded,
  type AmrapSessionEngine,
} from 'amrap/embed';
import { useTrainerLiveAmrapSessionDrawer } from '@/contexts/TrainerLiveAmrapSessionDrawerContext';
import { useTrainerLiveAmrapChatDrawer } from '@/contexts/TrainerLiveAmrapChatDrawerContext';
import { useTrainerLiveAmrapHostNav } from '@/contexts/TrainerLiveAmrapHostNavContext';
import TrainerLiveAmrapTimerBackground from '@/components/react/trainer/live/TrainerLiveAmrapTimerBackground';
import TrainerLiveTimerBackgroundMeLeaderToggle from '@/components/react/trainer/live/TrainerLiveTimerBackgroundMeLeaderToggle';
import type { TrainerLiveWrapperBaseProps } from '../types';
import { parseAmrapSessionIdFromWrapperConfig } from '../parseWrapperConfig';

type EmbeddedSocialAmrap = AmrapSessionEngine & {
  pageState?: { agoraError?: string | null };
};

function AmrapEmbedBody({
  amrapSessionId,
  trainerLiveSessionId,
  participantId,
  role,
  onWrapperError,
}: {
  amrapSessionId: string;
  trainerLiveSessionId: string;
  participantId: string;
  role: 'trainer' | 'client';
  onWrapperError?: (message: string) => void;
}) {
  const [recapDismissed, setRecapDismissed] = useState(false);

  const result = useSocialAmrapEmbedded({
    amrapSessionId,
    embedVideo: 'trainer_live',
    onDismissFinishedRecap: () => setRecapDismissed(true),
    recapDismissed,
  }) as EmbeddedSocialAmrap;

  const { setSessionDrawerNode } = useTrainerLiveAmrapSessionDrawer();
  const { setChatDrawerLeaderboard } = useTrainerLiveAmrapChatDrawer();
  const { setHostNavActions } = useTrainerLiveAmrapHostNav();

  useEffect(() => {
    setSessionDrawerNode(result.slots?.sessionDrawer ?? null);
    return () => setSessionDrawerNode(null);
  }, [result.slots?.sessionDrawer, setSessionDrawerNode]);

  useEffect(() => {
    setChatDrawerLeaderboard(result.slots?.chatDrawerLeaderboard ?? null);
    return () => setChatDrawerLeaderboard(null);
  }, [result.slots?.chatDrawerLeaderboard, setChatDrawerLeaderboard]);

  useEffect(() => {
    setHostNavActions(result.slots?.hostNavActions ?? null);
    return () => setHostNavActions(null);
  }, [result.slots?.hostNavActions, setHostNavActions]);

  useEffect(() => {
    if (result.timerPhase !== 'finished') setRecapDismissed(false);
  }, [result.timerPhase]);

  useEffect(() => {
    const err = result.error ?? result.pageState?.agoraError;
    if (err) onWrapperError?.(err);
  }, [result.error, result.pageState?.agoraError, onWrapperError]);

  const isTrainer = role === 'trainer';

  return (
    <div
      className="trainer-live-amrap-embed relative w-full min-w-0 text-white [&_.min-h-screen]:min-h-0"
      data-testid="trainer-live-amrap-shell"
    >
      {isTrainer ? (
        <TrainerLiveAmrapTimerBackground
          engine={result}
          trainerLiveSessionId={trainerLiveSessionId}
          participantId={participantId}
        />
      ) : null}
      <div className="relative z-10">
        <AmrapSessionShell
          engine={result}
          shellLayout="trainerLiveEmbed"
          embedTitleBarAccessoryBeforeSub={
            isTrainer ? <TrainerLiveTimerBackgroundMeLeaderToggle /> : undefined
          }
        />
      </div>
    </div>
  );
}

export default function TrainerLiveAmrapWrapper(props: TrainerLiveWrapperBaseProps) {
  const { wrapperConfig, onWrapperError, trainerLiveSessionId, participantId, role } = props;
  const amrapSessionId = parseAmrapSessionIdFromWrapperConfig(wrapperConfig);

  if (!amrapSessionId) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
        Missing or invalid AMRAP session. Ask the trainer to start AMRAP again.
      </div>
    );
  }

  return (
    <AmrapAuthProvider>
      <AmrapEmbedBody
        amrapSessionId={amrapSessionId}
        trainerLiveSessionId={trainerLiveSessionId}
        participantId={participantId}
        role={role}
        onWrapperError={onWrapperError}
      />
    </AmrapAuthProvider>
  );
}
