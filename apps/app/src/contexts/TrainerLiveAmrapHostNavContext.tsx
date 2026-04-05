import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type Value = {
  hostNavActions: ReactNode | null;
  setHostNavActions: (node: ReactNode | null) => void;
};

const Ctx = createContext<Value | null>(null);

export function TrainerLiveAmrapHostNavProvider({ children }: { children: ReactNode }) {
  const [hostNavActions, setHostNavActionsState] = useState<ReactNode | null>(null);
  const setHostNavActions = useCallback((node: ReactNode | null) => {
    setHostNavActionsState(node);
  }, []);
  const value = useMemo(
    () => ({ hostNavActions, setHostNavActions }),
    [hostNavActions, setHostNavActions]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTrainerLiveAmrapHostNav(): Value {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return { hostNavActions: null, setHostNavActions: () => {} };
  }
  return ctx;
}
