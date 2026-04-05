import { createContext, useContext, type ReactNode } from 'react';
import {
  useTrainerLiveAgoraChannel,
  type UseTrainerLiveAgoraChannelResult,
} from '@/hooks/useTrainerLiveAgoraChannel';

const TrainerLiveAgoraContext = createContext<UseTrainerLiveAgoraChannelResult | null>(null);

export function TrainerLiveAgoraProvider({
  sessionId,
  participantId,
  children,
}: {
  sessionId: string;
  participantId: string | null;
  children: ReactNode;
}) {
  const channel = useTrainerLiveAgoraChannel(sessionId, participantId);
  return (
    <TrainerLiveAgoraContext.Provider value={channel}>{children}</TrainerLiveAgoraContext.Provider>
  );
}

export function useTrainerLiveAgora(): UseTrainerLiveAgoraChannelResult {
  const ctx = useContext(TrainerLiveAgoraContext);
  if (!ctx) {
    throw new Error('useTrainerLiveAgora must be used within TrainerLiveAgoraProvider');
  }
  return ctx;
}
