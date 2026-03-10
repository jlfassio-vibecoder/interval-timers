/**
 * Reusable dark-theme shell for all 11 interval timer landings.
 * Provides sticky protocol nav and main content area; content is passed as children.
 * Optional accentTheme (e.g. Tabata red, Mindful green) for badges/headers; nav and primary CTA stay #ffbf00.
 */
import React, { createContext, useContext, type ReactNode } from 'react';
import type { IntervalTimerPage, ProtocolAccentTheme } from './intervalTimerProtocols';
import {
  GOLD_ACCENT,
  INTERVAL_TIMER_PROTOCOLS,
  getProtocolLabel,
  VALID_PROTOCOLS,
} from './intervalTimerProtocols';

const IntervalTimerAccentContext = createContext<ProtocolAccentTheme | null>(null);

export function useIntervalTimerAccent(): ProtocolAccentTheme {
  const theme = useContext(IntervalTimerAccentContext);
  return theme ?? GOLD_ACCENT;
}

interface IntervalTimerLandingProps {
  currentProtocol: IntervalTimerPage;
  onNavigate: (page: IntervalTimerPage) => void;
  children: ReactNode;
  /** Optional accent for badges/headers (e.g. Tabata red, Mindful green). Nav and primary CTA stay #ffbf00. */
  accentTheme?: ProtocolAccentTheme | null;
}

function getPrevProtocol(current: IntervalTimerPage): IntervalTimerPage | null {
  const i = VALID_PROTOCOLS.indexOf(current);
  if (i <= 0) return null;
  return VALID_PROTOCOLS[i - 1];
}

function getNextProtocol(current: IntervalTimerPage): IntervalTimerPage | null {
  const i = VALID_PROTOCOLS.indexOf(current);
  if (i < 0 || i >= VALID_PROTOCOLS.length - 1) return null;
  return VALID_PROTOCOLS[i + 1];
}

const IntervalTimerLanding: React.FC<IntervalTimerLandingProps> = ({
  currentProtocol,
  onNavigate,
  children,
  accentTheme = null,
}) => {
  const prev = getPrevProtocol(currentProtocol);
  const next = getNextProtocol(currentProtocol);

  return (
    <IntervalTimerAccentContext.Provider value={accentTheme ?? null}>
      <div className="min-h-screen bg-bg-dark pb-20 font-sans text-white">
        <nav className="bg-bg-dark/95 sticky top-0 z-50 border-b border-white/10 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              <span className="font-heading text-lg font-bold tracking-wide text-white/80">
                Pillar 4{' '}
                <span className="text-orange-light">| {getProtocolLabel(currentProtocol)}</span>
              </span>
            </div>
            <div className="hidden flex-wrap items-center justify-end gap-1 text-xs font-bold md:flex md:gap-3">
              {INTERVAL_TIMER_PROTOCOLS.map(({ id }, index) => (
                <React.Fragment key={id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(id)}
                    className={
                      id === currentProtocol
                        ? 'text-orange-light'
                        : 'text-white/70 transition-colors hover:text-orange-light'
                    }
                  >
                    {getProtocolLabel(id)}
                  </button>
                  {index < INTERVAL_TIMER_PROTOCOLS.length - 1 && (
                    <span className="text-white/40">/</span>
                  )}
                </React.Fragment>
              ))}
            </div>
            <div className="flex gap-2 md:hidden">
              {prev && (
                <button
                  type="button"
                  onClick={() => onNavigate(prev)}
                  className="text-xs text-white/70 hover:text-orange-light"
                >
                  ← {getProtocolLabel(prev)}
                </button>
              )}
              {next && (
                <button
                  type="button"
                  onClick={() => onNavigate(next)}
                  className="text-xs text-white/70 hover:text-orange-light"
                >
                  {getProtocolLabel(next)} →
                </button>
              )}
            </div>
          </div>
        </nav>

        <main className="animate-fade-in mx-auto max-w-6xl space-y-20 px-4 py-10 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </IntervalTimerAccentContext.Provider>
  );
};

export default IntervalTimerLanding;
