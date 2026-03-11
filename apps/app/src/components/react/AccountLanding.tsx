/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Account page: app management landing. When authenticated, shows entry-point card
 * (if ?from=), HUD link, and app launcher. When not, shows sign-in card; buttons dispatch
 * showAuthModal/showAuthModalWithSignup for AppIslands' AuthModal.
 */

import React, { useState, useEffect } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { APP_REGISTRY, getAppById } from '@/lib/app-registry';

const AccountLanding: React.FC = () => {
  const { user, session, loading } = useAppContext();
  const [fromAppId, setFromAppId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setFromAppId(params.get('from'));
  }, []);

  // Wait for auth to resolve before deciding signed-in vs signed-out; avoids flashing
  // sign-in card to logged-in users while getSession() is still in flight.
  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="font-mono text-sm text-white/50">Loading…</p>
      </div>
    );
  }

  // Authorized if we have user (profile) OR session (auth). Session can be set before profile
  // fetch completes; after login redirect, profile may lag. Treat session as logged-in so we
  // show account content, not sign-in.
  const isLoggedIn = !!user?.uid || !!session?.user;

  if (!isLoggedIn) {
    return (
      <main className="relative z-10 mx-auto max-w-3xl px-4 pt-24 pb-16 md:px-6">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-12 text-center">
          <h2 className="mb-4 font-heading text-2xl font-bold text-white">
            Sign in to your account
          </h2>
          <p className="mb-6 text-white/70">
            Log in or create an account to manage your apps and workouts.
          </p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('showAuthModal', { detail: { fromAppId: 'app' } }))}
              className="rounded-xl border-2 border-orange-500 bg-orange-600 px-6 py-3 font-bold text-white hover:bg-orange-500"
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('showAuthModalWithSignup', { detail: { fromAppId: 'app' } }))}
              className="rounded-xl border border-white/20 bg-white/10 px-6 py-3 font-bold text-white hover:bg-white/20"
            >
              Create account
            </button>
          </div>
        </div>
      </main>
    );
  }

  const entryApp = fromAppId ? getAppById(fromAppId) : undefined;

  return (
    <main className="relative z-10 mx-auto max-w-3xl px-4 pt-24 pb-16 md:px-6">
      {/* Hero */}
      <header className="mb-12 text-center">
        <h1 className="mb-4 font-heading text-4xl font-black leading-tight text-white md:text-5xl">
          Your Account
        </h1>
        <p className="text-lg text-white/70">
          Manage all your apps and workouts in one place.
        </p>
      </header>

      {/* Entry-point card */}
      {entryApp && (
        <section className="mb-8">
          <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-6">
            <p className="mb-2 text-sm text-white/70">You signed in from {entryApp.name}</p>
            <a
              href={entryApp.path}
              className="inline-flex items-center rounded-xl border-2 border-orange-500 bg-orange-600 px-4 py-2 font-bold text-white hover:bg-orange-500"
            >
              Continue to {entryApp.name}
            </a>
          </div>
        </section>
      )}

      {/* HUD CTA */}
      <section className="mb-12">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
          <h3 className="mb-2 font-heading text-lg font-bold text-white">
            Manage your workouts
          </h3>
          <p className="mb-4 text-sm text-white/70">
            Manage workouts and schedule from all your apps in one place.
          </p>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('showHUD'))}
            className="rounded-xl border-2 border-orange-500 bg-orange-600 px-4 py-2 font-bold text-white hover:bg-orange-500"
          >
            Open HUD
          </button>
        </div>
      </section>

      {/* App launcher */}
      <section>
        <h3 className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-orange-light">
          Your apps
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {APP_REGISTRY.map((app) => (
            <a
              key={app.id}
              href={app.path}
              className="hover:border-orange-500/50 hover:bg-orange-500/10 flex flex-col rounded-2xl border border-white/10 bg-black/20 p-4 transition-colors"
            >
              <span className="font-heading font-bold text-white">{app.name}</span>
              <span className="font-mono text-[10px] text-white/50">{app.description}</span>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
};

export default AccountLanding;
