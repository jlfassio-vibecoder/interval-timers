import { useEffect } from 'react';
import { TabataSessionShell, useTabataEmbedded } from 'amrap/embed';
import type { TrainerLiveWrapperBaseProps } from '../types';
import { parseTabataSessionIdFromWrapperConfig } from '../parseWrapperConfig';

function TabataEmbedBody({
  tabataSessionId,
  isTrainer,
  onWrapperError,
}: {
  tabataSessionId: string;
  isTrainer: boolean;
  onWrapperError?: (message: string) => void;
}) {
  const engine = useTabataEmbedded({
    tabataSessionId,
    embedVideo: 'trainer_live',
    isTrainer,
  });

  useEffect(() => {
    if (engine.error) onWrapperError?.(engine.error);
  }, [engine.error, onWrapperError]);

  return (
    <div
      className="trainer-live-tabata-embed w-full min-w-0 text-white [&_.min-h-screen]:min-h-0"
      data-testid="trainer-live-tabata-shell"
    >
      <TabataSessionShell engine={engine} shellLayout="trainerLiveEmbed" />
    </div>
  );
}

export default function TrainerLiveTabataWrapper(props: TrainerLiveWrapperBaseProps) {
  const { wrapperConfig, onWrapperError, role } = props;
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
      isTrainer={role === 'trainer'}
      onWrapperError={onWrapperError}
    />
  );
}
