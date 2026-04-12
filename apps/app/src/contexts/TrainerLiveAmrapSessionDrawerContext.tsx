import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type TrainerLiveAmrapSessionDrawerValue = {
  sessionDrawerNode: ReactNode | null;
  setSessionDrawerNode: (node: ReactNode | null) => void;
};

const TrainerLiveAmrapSessionDrawerContext =
  createContext<TrainerLiveAmrapSessionDrawerValue | null>(null);

export function TrainerLiveAmrapSessionDrawerProvider({ children }: { children: ReactNode }) {
  const [sessionDrawerNode, setSessionDrawerNodeState] = useState<ReactNode | null>(null);
  const setSessionDrawerNode = useCallback((node: ReactNode | null) => {
    setSessionDrawerNodeState(node);
  }, []);
  const value = useMemo(
    () => ({ sessionDrawerNode, setSessionDrawerNode }),
    [sessionDrawerNode, setSessionDrawerNode]
  );
  return (
    <TrainerLiveAmrapSessionDrawerContext.Provider value={value}>
      {children}
    </TrainerLiveAmrapSessionDrawerContext.Provider>
  );
}

export function useTrainerLiveAmrapSessionDrawer(): TrainerLiveAmrapSessionDrawerValue {
  const ctx = useContext(TrainerLiveAmrapSessionDrawerContext);
  if (!ctx) {
    return {
      sessionDrawerNode: null,
      setSessionDrawerNode: () => {},
    };
  }
  return ctx;
}

/** Renders AMRAP `slots.sessionDrawer` (Who's Here) above the activity timer in the Session rail. */
export function TrainerLiveSessionDrawerSlot() {
  const { sessionDrawerNode } = useTrainerLiveAmrapSessionDrawer();
  if (!sessionDrawerNode) return null;
  return (
    <div
      className="mb-3 border-b border-white/10 pb-3"
      data-testid="trainer-live-session-drawer-slot"
    >
      {sessionDrawerNode}
    </div>
  );
}
