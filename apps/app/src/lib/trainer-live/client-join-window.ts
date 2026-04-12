/**
 * Whether "Join live" should be shown for a scheduled wall-time window.
 * Default: from 15 minutes before start until the later of (scheduled end, if any) or four hours after start.
 */
export function isWithinTrainerLiveJoinWindow(
  startIso: string,
  endIso?: string | null,
  nowMs: number = Date.now()
): boolean {
  const start = Date.parse(startIso);
  if (!Number.isFinite(start)) return false;
  const endParsed = endIso ? Date.parse(endIso) : NaN;
  const effectiveEnd = Number.isFinite(endParsed)
    ? Math.max(start, endParsed)
    : start + 4 * 60 * 60 * 1000;
  const early = start - 15 * 60 * 1000;
  const late = Math.max(effectiveEnd, start + 4 * 60 * 60 * 1000);
  return nowMs >= early && nowMs <= late;
}

/** Hub page: paste session ID or resume (clients; not the in-room join form). */
export function trainerLiveClientHubPath(): string {
  return '/trainer/live/join';
}

/**
 * Full app URL path for `<a href>` from pages outside the trainer router (e.g. HUD). Includes
 * `/trainer` because those links are not relative to `BrowserRouter` basename.
 */
export function trainerLiveClientJoinPath(sessionId: string): string {
  return `/trainer/live/join/${encodeURIComponent(sessionId)}`;
}

/**
 * Path inside the trainer `BrowserRouter` (`basename="/trainer"`). Use with `useNavigate` from
 * trainer routes — do not use for plain `<a href>` from other parts of the app.
 */
export function trainerLiveClientJoinBasenamePath(sessionId: string): string {
  return `/live/join/${encodeURIComponent(sessionId)}`;
}
