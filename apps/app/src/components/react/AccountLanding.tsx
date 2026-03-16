/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Account page: app management landing. When authenticated, shows entry-point card
 * (if ?from=), HUD link, and app launcher. When not, shows sign-in card; buttons dispatch
 * showAuthModal/showAuthModalWithSignup for AppIslands' AuthModal.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import {
  parseHandoffFromUrl,
  HANDOFF_STORAGE_KEY,
  HANDOFF_TTL_MS,
  HANDOFF_MAX_AGE_MS,
  type StoredHandoff,
} from '@interval-timers/handoff';
import { trackEvent } from '@interval-timers/analytics';
import { getAccountCopy } from '@/lib/account-copy';
import { APP_REGISTRY, getAppById } from '@/lib/app-registry';
import { appendQuery } from '@/lib/url-utils';
import { supabase } from '@/lib/supabase/supabase-instance';
import { logHandoffSession } from '@/lib/supabase/client/log-handoff';
import TrialBanner from './TrialBanner';

const AccountLanding: React.FC = () => {
  const { user, session, loading, isInTrial } = useAppContext();
  const [fromAppId, setFromAppId] = useState<string | null>(null);
  const [handoff, setHandoff] = useState<StoredHandoff | null>(null);
  const [prefillResult, setPrefillResult] = useState<{ success: boolean; source?: string } | null>(
    null
  );
  const prefillAttemptedRef = useRef(false);
  const oauthEventEmittedRef = useRef(false);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  // Escape hatch: if AppContext loading never resolves (e.g. Supabase/proxy stall in prod),
  // stop blocking the page after 4s so users see sign-in instead of infinite Loading.
  useEffect(() => {
    if (!loading) {
      setLoadingTimedOut(false);
      return;
    }
    const t = setTimeout(() => setLoadingTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get('from');
    const payload = parseHandoffFromUrl();
    const now = Date.now();

    if (payload) {
      const age = payload.timestamp ? now - payload.timestamp : 0;
      if (age <= HANDOFF_MAX_AGE_MS) {
        const stored: StoredHandoff = {
          ...payload,
          from: payload.from ?? payload.source,
          timestamp: payload.timestamp ?? now,
        };
        try {
          sessionStorage.setItem(HANDOFF_STORAGE_KEY, JSON.stringify(stored));
          setHandoff(stored);
          trackEvent(
            supabase,
            'account_land_handoff',
            {
              intent: stored.intent,
              source: stored.source ?? stored.from,
            },
            { appId: 'app' }
          );
        } catch {
          // Ignore storage errors
        }
        setFromAppId(fromParam ?? payload.source);
      } else {
        setFromAppId(fromParam);
      }
    } else {
      setFromAppId(fromParam);
      try {
        const raw = sessionStorage.getItem(HANDOFF_STORAGE_KEY);
        if (raw) {
          const stored = JSON.parse(raw) as StoredHandoff;
          if (now - stored.timestamp <= HANDOFF_TTL_MS) {
            setHandoff(stored);
          } else {
            sessionStorage.removeItem(HANDOFF_STORAGE_KEY);
          }
        }
      } catch {
        sessionStorage.removeItem(HANDOFF_STORAGE_KEY);
      }
    }
  }, []);

  // Phase 3: after auth, log handoff session once and clear storage
  useEffect(() => {
    const uid = user?.uid ?? session?.user?.id;
    if (!handoff || handoff.intent !== 'save_session' || !uid || prefillAttemptedRef.current) {
      return;
    }
    prefillAttemptedRef.current = true;
    logHandoffSession(handoff, uid).then((result) => {
      if (result.ok) {
        try {
          sessionStorage.removeItem(HANDOFF_STORAGE_KEY);
        } catch {
          // ignore
        }
        setHandoff(null);
      }
      setPrefillResult(result.ok ? { success: true, source: handoff.source } : { success: false });
      trackEvent(
        supabase,
        result.ok ? 'account_session_prefill_success' : 'account_session_prefill_fail',
        { source: handoff.source },
        { userId: uid, appId: 'app' }
      );
    });
  }, [handoff, user?.uid, session?.user?.id]);

  // OAuth return: emit account_login_complete or account_signup_complete when session appears after redirect
  useEffect(() => {
    if (
      loading ||
      oauthEventEmittedRef.current ||
      typeof window === 'undefined' ||
      !window.location.hash?.includes('access_token')
    )
      return;
    const uid = user?.uid ?? session?.user?.id;
    const authUser = session?.user;
    if (!uid || !authUser) return;
    oauthEventEmittedRef.current = true;
    const createdAt = authUser.created_at;
    const isNewUser = createdAt && Date.now() - new Date(createdAt).getTime() < 60_000;
    trackEvent(
      supabase,
      isNewUser ? 'account_signup_complete' : 'account_login_complete',
      { method: 'oauth' },
      { userId: uid, appId: 'app' }
    );
  }, [loading, user?.uid, session?.user?.id, session?.user, user]);

  // Wait for auth to resolve before deciding signed-in vs signed-out; avoids flashing
  // sign-in card to logged-in users while getSession() is still in flight.
  // loadingTimedOut: escape hatch when loading stalls (e.g. prod proxy/Supabase).
  if (loading && !loadingTimedOut) {
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
    const copy = getAccountCopy(handoff, fromAppId);
    const fromAppIdVal = handoff?.source ?? fromAppId ?? 'app';

    return (
      <main className="relative z-10 mx-auto max-w-3xl px-4 pb-16 pt-24 md:px-6">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-12 text-center">
          <h2 className="mb-4 font-heading text-2xl font-bold text-white">{copy.headline}</h2>
          <p className="mb-6 text-white/70">{copy.subtext}</p>
          <div className="mb-6 text-left">
            <p className="mb-2 text-sm font-medium text-white/90">
              Create your free profile to unlock:
            </p>
            <ul className="space-y-1 text-sm text-white/70">
              <li>• Your personal Heads Up Display (HUD)</li>
              <li>• All 14 pro timers + lifestyle challenges</li>
              <li>• Permanent workout history</li>
            </ul>
          </div>
          {copy.showLossAversion && (
            <p className="mb-6 text-sm font-medium text-white/90">
              Don&apos;t lose this workout — create your free profile to save it.
            </p>
          )}
          <div className="flex justify-center gap-3">
            {copy.primaryCtaIsSignUp ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent('showAuthModalWithSignup', {
                        detail: { fromAppId: fromAppIdVal },
                      })
                    )
                  }
                  className="border-orange-500 bg-orange-600 hover:bg-orange-500 rounded-xl border-2 px-6 py-3 font-bold text-white"
                >
                  Create free profile
                </button>
                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent('showAuthModal', { detail: { fromAppId: fromAppIdVal } })
                    )
                  }
                  className="rounded-xl border border-white/20 bg-white/10 px-6 py-3 font-bold text-white hover:bg-white/20"
                >
                  Log in
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent('showAuthModal', { detail: { fromAppId: fromAppIdVal } })
                    )
                  }
                  className="border-orange-500 bg-orange-600 hover:bg-orange-500 rounded-xl border-2 px-6 py-3 font-bold text-white"
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent('showAuthModalWithSignup', {
                        detail: { fromAppId: fromAppIdVal },
                      })
                    )
                  }
                  className="rounded-xl border border-white/20 bg-white/10 px-6 py-3 font-bold text-white hover:bg-white/20"
                >
                  Create account
                </button>
              </>
            )}
          </div>
        </div>
      </main>
    );
  }

  const entryApp = fromAppId ? getAppById(fromAppId) : undefined;
  const prefillSourceName = prefillResult?.source ? getAppById(prefillResult.source)?.name : null;

  return (
    <main className="relative z-10 mx-auto max-w-3xl px-4 pb-16 pt-24 md:px-6">
      {/* Prefill confirmation / error */}
      {prefillResult?.success && prefillSourceName && (
        <section className="mb-8">
          <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-6">
            <p className="mb-3 text-white">Your {prefillSourceName} session has been saved.</p>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('showHUD'))}
              className="rounded-xl border-2 border-green-500 bg-green-600 px-4 py-2 font-bold text-white hover:bg-green-500"
            >
              View in HUD
            </button>
          </div>
        </section>
      )}
      {prefillResult?.success === false && (
        <section className="mb-8">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
            <p className="mb-3 text-white">
              We couldn&apos;t save your session automatically. You can log it from the HUD.
            </p>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('showHUD'))}
              className="rounded-xl border-2 border-amber-500 bg-amber-600 px-4 py-2 font-bold text-white hover:bg-amber-500"
            >
              Open HUD
            </button>
          </div>
        </section>
      )}

      {/* Hero */}
      <header className="mb-12 text-center">
        <h1 className="mb-4 font-heading text-4xl font-black leading-tight text-white md:text-5xl">
          Your Account
        </h1>
        <p className="text-lg text-white/70">Manage all your apps and workouts in one place.</p>
      </header>

      {/* Entry-point card */}
      {entryApp && (
        <section className="mb-8">
          <div className="border-orange-500/30 bg-orange-500/10 rounded-2xl border p-6">
            <p className="mb-2 text-sm text-white/70">You signed in from {entryApp.name}</p>
            <a
              href={appendQuery(entryApp.path, { from_hub: '1', app_id: entryApp.id })}
              className="border-orange-500 bg-orange-600 hover:bg-orange-500 inline-flex items-center rounded-xl border-2 px-4 py-2 font-bold text-white"
            >
              Continue to {entryApp.name}
            </a>
          </div>
        </section>
      )}

      {/* HUD CTA */}
      <section className="mb-12">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
          <h3 className="mb-2 font-heading text-lg font-bold text-white">Manage your workouts</h3>
          <p className="mb-4 text-sm text-white/70">
            Manage workouts and schedule from all your apps in one place.
          </p>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('showHUD'))}
            className="border-orange-500 bg-orange-600 hover:bg-orange-500 rounded-xl border-2 px-4 py-2 font-bold text-white"
          >
            Open HUD
          </button>
        </div>
      </section>

      {/* Trial banner: inline above app launcher */}
      {isInTrial && user?.trialEndsAt && (
        <section className="mb-8">
          <TrialBanner trialEndsAt={user.trialEndsAt} />
        </section>
      )}

      {/* App launcher */}
      <section>
        <h3 className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-orange-light">
          Your apps
        </h3>
        {isInTrial && (
          <p className="mb-4 text-sm text-white/70">
            All {APP_REGISTRY.length} apps fully unlocked during your trial.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {APP_REGISTRY.map((app) => {
            const href = appendQuery(app.path, { from_hub: '1', app_id: app.id });
            return (
              <a
                key={app.id}
                href={href}
                className="hover:border-orange-500/50 hover:bg-orange-500/10 flex flex-col rounded-2xl border border-white/10 bg-black/20 p-4 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-heading font-bold text-white">{app.name}</span>
                  {isInTrial && (
                    <span className="bg-orange-600/30 text-orange-400 shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase">
                      Unlocked
                    </span>
                  )}
                </div>
                <span className="font-mono text-[10px] text-white/50">{app.description}</span>
              </a>
            );
          })}
        </div>
      </section>
    </main>
  );
};

export default AccountLanding;
