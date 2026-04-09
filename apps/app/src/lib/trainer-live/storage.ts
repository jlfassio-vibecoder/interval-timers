export function trainerLiveParticipantStorageKey(sessionId: string): string {
  return `trainer_live:${sessionId}:participant_id`;
}

export function readTrainerLiveParticipantIdFromStorage(sessionId: string | undefined): string | null {
  if (!sessionId || typeof window === 'undefined') return null;
  return sessionStorage.getItem(trainerLiveParticipantStorageKey(sessionId));
}
