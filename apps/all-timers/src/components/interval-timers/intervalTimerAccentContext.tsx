/**
 * Context and hook for interval timer accent theme (used by landing shell).
 * Extracted so IntervalTimerLanding can comply with react-refresh/only-export-components.
 */
import { createContext, useContext } from 'react';
import type { ProtocolAccentTheme } from './intervalTimerProtocols';
import { GOLD_ACCENT } from './intervalTimerProtocols';

export const IntervalTimerAccentContext = createContext<ProtocolAccentTheme | null>(null);

export function useIntervalTimerAccent(): ProtocolAccentTheme {
  const theme = useContext(IntervalTimerAccentContext);
  return theme ?? GOLD_ACCENT;
}
