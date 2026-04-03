import { useEffect, useState } from 'react';
import {
  AmrapAuthProvider,
  AmrapSessionShell,
  useSocialAmrapEmbedded,
  type AmrapSessionEngine,
} from 'amrap/embed';
import type { TrainerLiveWrapperBaseProps } from '../types';
import { parseAmrapSessionIdFromWrapperConfig } from '../parseWrapperConfig';

type EmbeddedSocialAmrap = AmrapSessionEngine & {
  pageState?: { agoraError?: string | null };
};

function AmrapEmbedBody({
  amrapSessionId,
  onWrapperError,
}: {
  amrapSessionId: string;
  onWrapperError?: (message: string) => void;
}) {
  const [recapDismissed, setRecapDismissed] = useState(false);

  const result = useSocialAmrapEmbedded({
    amrapSessionId,
    embedVideo: 'trainer_live',
    onDismissFinishedRecap: () => setRecapDismissed(true),
    recapDismissed,
  }) as EmbeddedSocialAmrap;

  useEffect(() => {
    if (result.timerPhase !== 'finished') setRecapDismissed(false);
  }, [result.timerPhase]);

  useEffect(() => {
    const err = result.error ?? result.pageState?.agoraError;
    if (err) onWrapperError?.(err);
  }, [result.error, result.pageState?.agoraError, onWrapperError]);

  return (
    <div
      className="trainer-live-amrap-embed text-white [&_.min-h-screen]:min-h-0"
      data-testid="trainer-live-amrap-shell"
    >
      <AmrapSessionShell engine={result} />
    </div>
  );
}

export default function TrainerLiveAmrapWrapper(props: TrainerLiveWrapperBaseProps) {
  const { wrapperConfig, onWrapperError } = props;
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
      <AmrapEmbedBody amrapSessionId={amrapSessionId} onWrapperError={onWrapperError} />
    </AmrapAuthProvider>
  );
}
