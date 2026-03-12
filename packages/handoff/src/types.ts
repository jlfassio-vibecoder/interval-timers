/**
 * Handoff payload for timer → account conversion flow.
 * Matches HUB_SPOKE_CONVERSION_ROADMAP Phase 1 URL contract.
 */
export interface HandoffPayload {
  intent: string;
  source: string;
  from?: string;
  time?: string;
  calories?: number;
  rounds?: number;
  preset?: string;
  timestamp?: number;
}

/** Stored in sessionStorage; includes timestamp for staleness. */
export interface StoredHandoff extends HandoffPayload {
  timestamp: number;
}

export const HANDOFF_STORAGE_KEY = 'account_handoff';
export const HANDOFF_TTL_MS = 5 * 60 * 1000; // 5 min
export const HANDOFF_MAX_AGE_MS = 30 * 60 * 1000; // 30 min (reject older than this when persisting)
