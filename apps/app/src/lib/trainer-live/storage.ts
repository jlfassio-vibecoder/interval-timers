export function trainerLiveParticipantStorageKey(sessionId: string): string {
  return `trainer_live:${sessionId}:participant_id`;
}

/** Persists across tab close; used for “Re-enter last session” on the trainer live lobby. */
export const TRAINER_LIVE_LAST_SESSION_STORAGE_KEY = 'trainer_live:last_session_id';

export function setTrainerLiveLastSessionId(sessionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TRAINER_LIVE_LAST_SESSION_STORAGE_KEY, sessionId.trim());
  } catch {
    /* quota / private mode */
  }
}

export function readTrainerLiveLastSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem(TRAINER_LIVE_LAST_SESSION_STORAGE_KEY);
    const t = v?.trim();
    return t || null;
  } catch {
    return null;
  }
}

export function clearTrainerLiveLastSessionId(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TRAINER_LIVE_LAST_SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function readTrainerLiveParticipantIdFromStorage(
  sessionId: string | undefined
): string | null {
  if (!sessionId || typeof window === 'undefined') return null;
  return sessionStorage.getItem(trainerLiveParticipantStorageKey(sessionId));
}
