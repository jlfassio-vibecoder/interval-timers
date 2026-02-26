/**
 * Reusable dark-theme shell for all interval timer landings.
 * Provides sticky protocol nav and main content area; content is passed as children.
 * Optional accentTheme (e.g. Tabata red, Mindful green) for badges/headers; nav and primary CTA stay #ffbf00.
 * When standalone is true, protocol prev/next nav is hidden and header shows "Home | Protocol Name" only.
 */
import React, { type ReactNode } from 'react';
import type { IntervalTimerPage, ProtocolAccentTheme } from '@interval-timers/timer-core';
import {
  INTERVAL_TIMER_PROTOCOLS,
  getProtocolLabel,
  VALID_PROTOCOLS,
} from '@interval-timers/timer-core';
import { IntervalTimerAccentContext } from './intervalTimerAccentContext';

interface IntervalTimerLandingProps {
  currentProtocol: IntervalTimerPage;
  /** Required when standalone is false so nav works; optional when standalone (nav is hidden). */
  onNavigate?: (page: IntervalTimerPage) => void;
  /** When provided, "Home" in the header navigates to the hub landing; when standalone, Home links to "/". */
  onNavigateToLanding?: () => void;
  children: ReactNode;
  /** Optional accent for badges/headers (e.g. Tabata red, Mindful green). Nav and primary CTA stay #ffbf00. */
  accentTheme?: ProtocolAccentTheme | null;
  /** When true, hide protocol nav and show minimal header (Home | Protocol Name). */
  standalone?: boolean;
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
  onNavigateToLanding,
  children,
  accentTheme = null,
  standalone = false,
}) => {
  const prev = getPrevProtocol(currentProtocol);
  const next = getNextProtocol(currentProtocol);

  const homeLabel = 'Home';
  // When standalone, Home always links to "/"; otherwise use onNavigateToLanding when provided (hub).
  const useHomeLink = standalone || !onNavigateToLanding;
  const homeElement = useHomeLink ? (
    <a
      href="/"
      className="font-heading text-lg font-bold tracking-wide text-white/80 transition-colors hover:text-[#ffbf00]"
    >
      {homeLabel}
    </a>
  ) : (
    <button
      type="button"
      onClick={onNavigateToLanding}
      className="font-heading text-lg font-bold tracking-wide text-white/80 transition-colors hover:text-[#ffbf00]"
    >
      {homeLabel}
    </button>
  );

  return (
    <IntervalTimerAccentContext.Provider value={accentTheme ?? null}>
      <div className="min-h-screen bg-[#0d0500] pb-20 font-sans text-white">
        <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0d0500]/95 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              {homeElement}{' '}
              <span className="font-heading text-lg font-bold tracking-wide text-white/80">
                <span className="text-[#ffbf00]">| {getProtocolLabel(currentProtocol)}</span>
              </span>
            </div>
            {!standalone && (
              <>
                <div className="hidden flex-wrap items-center justify-end gap-1 text-xs font-bold md:flex md:gap-3">
                  {INTERVAL_TIMER_PROTOCOLS.map(({ id }, index) => (
                    <React.Fragment key={id}>
                      <button
                        type="button"
                        onClick={() => onNavigate?.(id)}
                        className={
                          id === currentProtocol
                            ? 'text-[#ffbf00]'
                            : 'text-white/70 transition-colors hover:text-[#ffbf00]'
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
                      onClick={() => onNavigate?.(prev)}
                      className="text-xs text-white/70 hover:text-[#ffbf00]"
                    >
                      ← {getProtocolLabel(prev)}
                    </button>
                  )}
                  {next && (
                    <button
                      type="button"
                      onClick={() => onNavigate?.(next)}
                      className="text-xs text-white/70 hover:text-[#ffbf00]"
                    >
                      {getProtocolLabel(next)} →
                    </button>
                  )}
                </div>
              </>
            )}
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
