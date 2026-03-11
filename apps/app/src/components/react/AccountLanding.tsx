/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Logged-in Account landing: hero + activity feed, app launcher.
 * If not authenticated, redirects to /account?signin=1 (auth modal opens via AppIslands).
 */

import React, { useEffect } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import AccountFeed from './AccountFeed';

const AccountLanding: React.FC = () => {
  const { user, loading } = useAppContext();
  const [loadingTimedOut, setLoadingTimedOut] = React.useState(false);

  // Safety: if loading stays true >1s (e.g. Strict Mode double-mount), show signed-out UI
  React.useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setLoadingTimedOut(true), 1000);
    return () => clearTimeout(t);
  }, [loading]);
  React.useEffect(() => {
    if (!loading) setLoadingTimedOut(false);
  }, [loading]);

  const searchParams =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const hasSigninParam = searchParams?.get('signin') === '1';

  useEffect(() => {
    if (loading && !loadingTimedOut) return;
    if (!user?.uid && !hasSigninParam) {
      const url = new URL(window.location.href);
      url.searchParams.set('signin', '1');
      window.location.href = url.toString();
    }
  }, [user?.uid, loading, loadingTimedOut, hasSigninParam]);

  if (loading && !loadingTimedOut) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="font-mono text-sm text-white/50">Loading…</p>
      </div>
    );
  }

  if (!user?.uid) {
    return (
      <main className="relative z-10 mx-auto max-w-3xl px-4 py-16 md:px-6">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-12 text-center">
          <h2 className="mb-4 font-heading text-2xl font-bold text-white">
            Sign in to your account
          </h2>
          <p className="mb-6 text-white/70">
            The auth modal should open. If not, use the nav to sign in.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative z-10 mx-auto max-w-3xl px-4 py-16 md:px-6">
      {/* Hero */}
      <header className="mb-16 text-center">
        <h1 className="mb-4 font-heading text-4xl font-black leading-tight text-white md:text-5xl">
          Your Account
        </h1>
        <p className="text-lg text-white/70">
          Overview of your workouts and activity. Use <strong>You</strong> in the nav for detailed
          stats and programs.
        </p>
      </header>

      {/* App launcher */}
      <section className="mb-12">
        <h3 className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-orange-light">
          Your apps
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <a
            href="/amrap"
            className="hover:border-orange-500/50 hover:bg-orange-500/10 flex flex-col rounded-2xl border border-white/10 bg-black/20 p-4 transition-colors"
          >
            <span className="font-heading font-bold text-white">AMRAP</span>
            <span className="font-mono text-[10px] text-white/50">With Friends</span>
          </a>
          <a
            href="/tabata-timer"
            className="hover:border-orange-500/50 hover:bg-orange-500/10 flex flex-col rounded-2xl border border-white/10 bg-black/20 p-4 transition-colors"
          >
            <span className="font-heading font-bold text-white">Tabata</span>
            <span className="font-mono text-[10px] text-white/50">4-min protocol</span>
          </a>
          <a
            href="/daily-warm-up"
            className="hover:border-orange-500/50 hover:bg-orange-500/10 flex flex-col rounded-2xl border border-white/10 bg-black/20 p-4 transition-colors"
          >
            <span className="font-heading font-bold text-white">Daily Warm-Up</span>
            <span className="font-mono text-[10px] text-white/50">Mobility</span>
          </a>
          <a
            href="/interval-timers"
            className="hover:border-orange-500/50 hover:bg-orange-500/10 flex flex-col rounded-2xl border border-white/10 bg-black/20 p-4 transition-colors"
          >
            <span className="font-heading font-bold text-white">Programs</span>
            <span className="font-mono text-[10px] text-white/50">HUD & schedules</span>
          </a>
        </div>
      </section>

      {/* Feed */}
      <AccountFeed />
    </main>
  );
};

export default AccountLanding;
