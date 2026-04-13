import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type TrainerLiveAmrapChatDrawerValue = {
  chatDrawerLeaderboard: ReactNode | null;
  setChatDrawerLeaderboard: (node: ReactNode | null) => void;
};

const TrainerLiveAmrapChatDrawerContext = createContext<TrainerLiveAmrapChatDrawerValue | null>(
  null
);

export function TrainerLiveAmrapChatDrawerProvider({ children }: { children: ReactNode }) {
  const [chatDrawerLeaderboard, setChatDrawerLeaderboardState] = useState<ReactNode | null>(null);
  const setChatDrawerLeaderboard = useCallback((node: ReactNode | null) => {
    setChatDrawerLeaderboardState(node);
  }, []);
  const value = useMemo(
    () => ({ chatDrawerLeaderboard, setChatDrawerLeaderboard }),
    [chatDrawerLeaderboard, setChatDrawerLeaderboard]
  );
  return (
    <TrainerLiveAmrapChatDrawerContext.Provider value={value}>
      {children}
    </TrainerLiveAmrapChatDrawerContext.Provider>
  );
}

export function useTrainerLiveAmrapChatDrawer(): TrainerLiveAmrapChatDrawerValue {
  const ctx = useContext(TrainerLiveAmrapChatDrawerContext);
  if (!ctx) {
    return {
      chatDrawerLeaderboard: null,
      setChatDrawerLeaderboard: () => {},
    };
  }
  return ctx;
}
