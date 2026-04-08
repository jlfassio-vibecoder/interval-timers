/** `trainer_live_sessions.status` CHECK (see migrations e.g. 20260430113000_trainer_live_video.sql) */
export const TRAINER_LIVE_SESSION_ACTIVE = 'active' as const;
export const TRAINER_LIVE_SESSION_ENDED = 'ended' as const;

export type TrainerLiveSessionStatus =
  | typeof TRAINER_LIVE_SESSION_ACTIVE
  | typeof TRAINER_LIVE_SESSION_ENDED;
