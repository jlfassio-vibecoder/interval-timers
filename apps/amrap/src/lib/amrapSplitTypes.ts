/**
 * Multi-player AMRAP split display: derived from `amrap_rounds` + participant nicknames.
 * Source of truth remains the rounds table; realtime sync is handled in `useAmrapSession`.
 */

export type AmrapSplitRecord = {
  id: string;
  session_id: string;
  participant_id: string;
  /** 1-based round index within the current segment */
  round_number: number;
  /** Seconds for this round only (since segment/workout clock start or previous log). */
  split_time_sec: number;
  segment_index: number;
  nickname: string;
  /** Present when participant row includes `user_id` (authenticated joiner). */
  user_id?: string | null;
};
