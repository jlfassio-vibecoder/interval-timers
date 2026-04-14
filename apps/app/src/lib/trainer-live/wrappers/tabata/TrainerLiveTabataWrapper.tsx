import { useEffect } from 'react';
import { TabataEmbedExerciseSection, TabataSessionShell, useTabataEmbedded } from 'amrap/embed';
import { useTrainerLiveTimerBackground } from '@/contexts/TrainerLiveTimerBackgroundContext';
import TrainerLiveTabataTimerBackground from '@/components/react/trainer/live/TrainerLiveTabataTimerBackground';
import TrainerLiveTabataVideoSpotlightPicker from '@/components/react/trainer/live/TrainerLiveTabataVideoSpotlightPicker';
import type { TrainerLiveWrapperBaseProps } from '../types';
import { parseTabataSessionIdFromWrapperConfig } from '../parseWrapperConfig';

function TabataEmbedBody({
  tabataSessionId,
  trainerLiveSessionId,
  participantId,
  role,
  isTrainer,
  onWrapperError,
  videoTileExcludeUid,
}: {
  tabataSessionId: string;
  trainerLiveSessionId: string;
  participantId: string;
  role: 'trainer' | 'client';
  isTrainer: boolean;
  onWrapperError?: (message: string) => void;
  videoTileExcludeUid?: string | null;
}) {
  const { setTimerBackgroundSpotlightParticipantId } = useTrainerLiveTimerBackground();
  const engine = useTabataEmbedded({
    tabataSessionId,
    embedVideo: 'trainer_live',
    isTrainer,
  });

  useEffect(() => {
    if (engine.error) onWrapperError?.(engine.error);
  }, [engine.error, onWrapperError]);

  useEffect(() => {
    if (!isTrainer) return;
    return () => {
      setTimerBackgroundSpotlightParticipantId(null);
    };
  }, [isTrainer, setTimerBackgroundSpotlightParticipantId]);

  return (
    <div
      className="trainer-live-tabata-embed relative w-full min-w-0 text-white [&_.min-h-screen]:min-h-0"
      data-region="trainer-live-tabata-interval"
      data-testid="trainer-live-tabata-shell"
    >
      <TrainerLiveTabataTimerBackground
        trainerLiveSessionId={trainerLiveSessionId}
        participantId={participantId}
        role={role}
        videoTileExcludeUid={videoTileExcludeUid}
        videoBottomOverlay={
          isTrainer ? (
            <TabataEmbedExerciseSection
              engine={engine}
              maxTwoColumns
              className="flex w-full flex-col gap-2 sm:gap-3"
            />
          ) : undefined
        }
      />
      <div className="relative z-10">
        <TabataSessionShell
          engine={engine}
          shellLayout="trainerLiveEmbed"
          embedSuppressExercises={isTrainer}
          embedClientLiveLayout={!isTrainer}
          embedTitleBarAccessoryBeforeSub={
            isTrainer ? (
              <TrainerLiveTabataVideoSpotlightPicker
                sessionId={trainerLiveSessionId}
                trainerParticipantId={participantId}
              />
            ) : undefined
          }
        />
      </div>
    </div>
  );
}

export default function TrainerLiveTabataWrapper(props: TrainerLiveWrapperBaseProps) {
  const {
    wrapperConfig,
    onWrapperError,
    role,
    trainerLiveSessionId,
    participantId,
    videoTileExcludeUid,
  } = props;
  const tabataSessionId = parseTabataSessionIdFromWrapperConfig(wrapperConfig);

  if (!tabataSessionId) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
        Missing or invalid Tabata session. Ask the trainer to start Tabata again.
      </div>
    );
  }

  return (
    <TabataEmbedBody
      tabataSessionId={tabataSessionId}
      trainerLiveSessionId={trainerLiveSessionId}
      participantId={participantId}
      role={role}
      isTrainer={role === 'trainer'}
      onWrapperError={onWrapperError}
      videoTileExcludeUid={videoTileExcludeUid}
    />
  );
}
