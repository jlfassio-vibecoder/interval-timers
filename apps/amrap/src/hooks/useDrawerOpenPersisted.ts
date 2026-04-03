import { useCallback, useEffect, useState } from 'react';

const PREFIX = 'amrap:drawer:message';

export function amrapMessageDrawerStorageKey(sessionId: string): string {
  return `${PREFIX}:${sessionId}`;
}

function readStoredOpen(key: string): boolean | null {
  if (typeof window === 'undefined') return null;
  const v = sessionStorage.getItem(key);
  if (v === '1') return true;
  if (v === '0') return false;
  return null;
}

/** Persists open/closed in sessionStorage, keyed by AMRAP session id (Trainer Live embed). */
export function useDrawerOpenPersisted(
  storageKey: string | undefined,
  fallbackOpen: boolean
): [boolean, (next: boolean | ((prev: boolean) => boolean)) => void] {
  const [open, setOpenState] = useState(() => {
    if (!storageKey) return fallbackOpen;
    const stored = readStoredOpen(storageKey);
    return stored !== null ? stored : fallbackOpen;
  });

  useEffect(() => {
    if (!storageKey) {
      setOpenState(fallbackOpen);
      return;
    }
    const stored = readStoredOpen(storageKey);
    setOpenState(stored !== null ? stored : fallbackOpen);
  }, [storageKey, fallbackOpen]);

  const setOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setOpenState((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        if (storageKey) {
          try {
            sessionStorage.setItem(storageKey, resolved ? '1' : '0');
          } catch {
            /* quota / private mode */
          }
        }
        return resolved;
      });
    },
    [storageKey]
  );

  return [open, setOpen];
}
