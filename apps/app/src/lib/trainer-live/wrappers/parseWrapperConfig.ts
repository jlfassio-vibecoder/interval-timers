/** RFC 4122 UUID (case-insensitive). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates `interval_wrapper_config` for the AMRAP wrapper (expects `{ amrap_session_id }`).
 */
export function parseAmrapSessionIdFromWrapperConfig(config: unknown): string | null {
  if (config == null || typeof config !== 'object') return null;
  const raw = (config as { amrap_session_id?: unknown }).amrap_session_id;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return UUID_RE.test(trimmed) ? trimmed : null;
}

/**
 * Validates `interval_wrapper_config` for the Tabata wrapper (expects `{ tabata_session_id }`).
 */
export function parseTabataSessionIdFromWrapperConfig(config: unknown): string | null {
  if (config == null || typeof config !== 'object') return null;
  const raw = (config as { tabata_session_id?: unknown }).tabata_session_id;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return UUID_RE.test(trimmed) ? trimmed : null;
}
