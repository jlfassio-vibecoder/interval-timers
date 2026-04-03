export function trainerLiveParticipantStorageKey(sessionId: string): string {
  return `trainer_live:${sessionId}:participant_id`;
}
