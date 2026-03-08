/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, Activity, LogOut, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppContext } from '../../contexts/AppContext';
import { EXERCISE_LABELS } from '@/lib/labels/exercises';

interface NavigationProps {
  onShowHUD: () => void;
  onShowAuthModal: () => void;
  onLogout: () => void;
  /** Pass from Astro (e.g. Astro.url.pathname) so SSR and client match and avoid hydration mismatch */
  initialPathname?: string;
}

function getPathname(): string {
  if (typeof window === 'undefined') return '';
  return window.location.pathname;
}

const Navigation: React.FC<NavigationProps> = ({
  onShowHUD,
  onShowAuthModal,
  onLogout,
  initialPathname,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pathname, setPathname] = useState(() => initialPathname ?? getPathname());
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const { user, isTrainer } = useAppContext();

  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);
  const previousOverflowRef = useRef<string | null>(null);
  const prevMobileMenuOpenRef = useRef(false);
  const [isScrollable, setIsScrollable] = useState(false);

  useEffect(() => {
    setPathname(getPathname());
    const handlePopState = () => setPathname(getPathname());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Prefers reduced motion
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Escape to close
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  // Body scroll lock
  useEffect(() => {
    if (mobileMenuOpen) {
      previousOverflowRef.current = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    } else {
      if (previousOverflowRef.current !== null) {
        document.body.style.overflow = previousOverflowRef.current;
        previousOverflowRef.current = null;
      }
    }
    return () => {
      if (previousOverflowRef.current !== null) {
        document.body.style.overflow = previousOverflowRef.current;
        previousOverflowRef.current = null;
      }
    };
  }, [mobileMenuOpen]);

  // Focus on open: move focus to close button
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const id = requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [mobileMenuOpen]);

  // Focus return on close
  useEffect(() => {
    if (prevMobileMenuOpenRef.current && !mobileMenuOpen) {
      menuButtonRef.current?.focus();
    }
    prevMobileMenuOpenRef.current = mobileMenuOpen;
  }, [mobileMenuOpen]);

  // Scroll cue: detect when drawer content is scrollable
  useEffect(() => {
    if (!mobileMenuOpen) {
      setIsScrollable(false);
      return;
    }
    let cleanup: (() => void) | undefined;
    const raf = requestAnimationFrame(() => {
      const el = scrollContentRef.current;
      if (!el) return;
      const checkScrollable = () => {
        setIsScrollable(el.scrollHeight > el.clientHeight);
      };
      checkScrollable();
      const resizeObs = new ResizeObserver(checkScrollable);
      resizeObs.observe(el);
      window.addEventListener('resize', checkScrollable);
      el.addEventListener('scroll', checkScrollable);
      cleanup = () => {
        resizeObs.disconnect();
        window.removeEventListener('resize', checkScrollable);
        el.removeEventListener('scroll', checkScrollable);
      };
    });
    return () => {
      cancelAnimationFrame(raf);
      cleanup?.();
    };
  }, [mobileMenuOpen]);

  // Focus trap: Tab / Shift+Tab wrap inside panel
  useEffect(() => {
    if (!mobileMenuOpen || !panelRef.current) return;
    const getFocusables = () => {
      const el = panelRef.current;
      if (!el) return [];
      const selector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
      return Array.from(el.querySelectorAll<HTMLElement>(selector));
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = getFocusables();
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const target = e.target as Node;
      if (e.shiftKey) {
        if (target === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (target === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const isActive = (href: string): boolean => {
    if (pathname === href) return true;
    if (href !== '/' && pathname.startsWith(href + '/')) return true;
    return false;
  };

  const desktopCtaLink = (
    <a
      href="/complexes"
      className="rounded-full border border-white bg-white px-4 py-2 text-sm font-bold uppercase tracking-widest text-black transition-colors hover:bg-white/90"
      data-hover="true"
    >
      Get Passes
    </a>
  );

  const authBlock = user ? (
    <div className="flex items-center gap-3 border-l border-white/20 pl-4">
      {isTrainer && (
        <a
          href="/trainer"
          className="bg-orange-light/20 hidden cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider text-orange-light transition-colors hover:bg-orange-light hover:text-black md:flex"
        >
          Mission Control
        </a>
      )}
      <button
        onClick={onShowHUD}
        className="flex cursor-pointer items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-white transition-colors hover:bg-white/15 hover:text-orange-light"
        data-hover="true"
      >
        <Activity className="h-4 w-4" /> HUD
      </button>
      <button
        onClick={onLogout}
        className="rounded-full bg-white/10 p-2 transition-colors hover:bg-white/15 hover:text-red-500"
        data-hover="true"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  ) : (
    <button
      onClick={onShowAuthModal}
      className="flex cursor-pointer items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-white transition-colors hover:bg-white/15 hover:text-orange-light"
      data-hover="true"
    >
      <LogIn className="h-4 w-4" /> SIGN IN
    </button>
  );

  // Largest to smallest: Programs → Challenges → Tabata → Interval Timers → Workouts → WOD → Complexes → Exercises → Learning Center
  const navItems = [
    'Programs',
    'Challenges',
    'Tabata Workouts',
    'Interval Timers',
    'Workouts',
    'WOD',
    'Complexes',
    EXERCISE_LABELS.section,
    'Learning Center',
  ] as const;
  const navHref: Record<(typeof navItems)[number], string> = {
    [EXERCISE_LABELS.section]: '/exercises',
    'Learning Center': '/learn',
    Complexes: '/complexes',
    'Tabata Workouts': '/tabata',
    'Interval Timers': '/interval-timers',
    WOD: '/wod',
    Workouts: '/workouts',
    Challenges: '/challenges',
    Programs: '/programs',
  };

  return (
    <>
      <nav className="fixed left-0 right-0 top-0 z-40 flex items-center justify-between px-6 py-6 mix-blend-difference md:px-8">
        <a
          href="/"
          className="z-50 cursor-pointer font-heading text-lg font-bold tracking-tighter text-white transition-colors hover:text-orange-light md:text-xl"
        >
          AI FITCOPILOT
        </a>

        {/* Full desktop nav (legacy): hidden; we use minimal bar + drawer everywhere */}
        <div className="hidden items-center gap-6 text-sm font-bold tracking-widest">
          {navItems.map((item) => {
            const href = navHref[item];
            const active = isActive(href);
            return (
              <a
                key={item}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`cursor-pointer rounded-full px-4 py-2 transition-colors ${
                  active
                    ? 'bg-white/20 text-orange-light ring-2 ring-orange-light'
                    : 'bg-white/10 text-white hover:bg-white/15 hover:text-orange-light'
                }`}
                data-hover="true"
              >
                {item}
              </a>
            );
          })}
          {desktopCtaLink}
          {authBlock}
        </div>

        {/* Minimal desktop nav: Get Passes + auth + Menu (all routes) */}
        <div className="hidden items-center gap-6 text-sm font-bold tracking-widest md:flex">
          {desktopCtaLink}
          {authBlock}
        </div>

        {/* Menu Toggle — visible on mobile and desktop. When drawer is open, visually hidden (opacity-0) but kept in a11y tree so screen readers can find/focus it; drawer close button is primary. */}
        <button
          ref={menuButtonRef}
          type="button"
          className={`relative z-50 flex h-11 w-11 items-center justify-center text-white md:flex ${mobileMenuOpen ? 'opacity-0' : ''}`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </nav>

      {/* Nav drawer — left-edge panel + backdrop; visible on desktop and mobile when open */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              key="drawer-backdrop"
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
              transition={
                prefersReducedMotion
                  ? { type: 'tween', duration: 0 }
                  : { type: 'tween', duration: 0.2 }
              }
              className="fixed inset-0 z-30 bg-black/50"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              ref={panelRef}
              key="drawer-panel"
              initial={prefersReducedMotion ? { x: 0 } : { x: '-100%' }}
              animate={{ x: 0 }}
              exit={prefersReducedMotion ? { x: 0, opacity: 0 } : { x: '-100%' }}
              transition={
                prefersReducedMotion
                  ? { type: 'tween', duration: 0 }
                  : { type: 'tween', duration: 0.25 }
              }
              className="fixed bottom-0 left-0 top-0 z-40 flex w-72 max-w-[85vw] flex-col bg-[#120800]/95 backdrop-blur-xl"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
            >
              {/* Header row: close button only */}
              <div className="flex h-14 shrink-0 items-center justify-end px-4">
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex h-11 w-11 items-center justify-center text-white transition-colors hover:text-orange-light"
                  aria-label="Close menu"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              {/* Scrollable content */}
              <div
                ref={scrollContentRef}
                className="relative flex min-h-0 flex-1 flex-col items-start gap-3 overflow-y-auto pb-6 pl-6 pr-4"
              >
                {isTrainer && (
                  <a
                    href="/trainer"
                    onClick={() => setMobileMenuOpen(false)}
                    className="bg-orange-light/10 mb-2 block w-full rounded-xl border border-orange-light px-4 py-3 font-heading text-lg font-black uppercase tracking-wide text-orange-light transition-colors hover:bg-orange-light hover:text-black"
                  >
                    Mission Control
                  </a>
                )}
                {navItems.map((item) => {
                  const href = navHref[item];
                  const active = isActive(href);
                  return (
                    <a
                      key={item}
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`rounded-full px-4 py-2.5 font-heading text-base font-semibold transition-colors ${
                        active
                          ? 'bg-white/20 text-orange-light ring-2 ring-orange-light'
                          : 'bg-white/10 text-white hover:bg-white/15 hover:text-orange-light'
                      }`}
                    >
                      {item}
                    </a>
                  );
                })}
                {user ? (
                  <>
                    <button
                      onClick={() => {
                        onShowHUD();
                        setMobileMenuOpen(false);
                      }}
                      className="rounded-full bg-white/10 px-4 py-2.5 text-base font-semibold uppercase text-orange-light transition-colors hover:bg-white/15"
                    >
                      HUD
                    </button>
                    <button
                      onClick={() => {
                        onLogout();
                        setMobileMenuOpen(false);
                      }}
                      className="rounded-full bg-white/10 px-4 py-2.5 text-base font-semibold uppercase text-red-500 transition-colors hover:bg-white/15"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      onShowAuthModal();
                      setMobileMenuOpen(false);
                    }}
                    className="rounded-full bg-white/10 px-4 py-2.5 text-base font-semibold uppercase text-orange-light transition-colors hover:bg-white/15"
                  >
                    Login
                  </button>
                )}
                <a
                  href="/complexes"
                  onClick={() => setMobileMenuOpen(false)}
                  className="mt-2 rounded-full border border-white bg-white px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-black transition-colors hover:bg-white/90"
                >
                  Get Passes
                </a>
                {/* Scroll cue: gradient when content is scrollable */}
                {isScrollable && (
                  <div
                    className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#120800] to-transparent"
                    aria-hidden="true"
                  />
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navigation;
