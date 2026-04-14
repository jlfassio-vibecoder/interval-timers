/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Account page: app management landing. When authenticated, shows entry-point card
 * (if ?from=), HUD link, and app launcher. When not, shows sign-in card; buttons dispatch
 * showAuthModal/showAuthModalWithSignup for AppIslands' AuthModal.
 */

import React, { useState, useEffect, useRef, useCallback, startTransition } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import {
  parseHandoffFromUrl,
  HANDOFF_STORAGE_KEY,
  HANDOFF_TTL_MS,
  HANDOFF_MAX_AGE_MS,
  type StoredHandoff,
} from '@interval-timers/handoff';
import { Video } from 'lucide-react';
import { trackEvent } from '@interval-timers/analytics';
import { getAccountCopy } from '@/lib/account-copy';
import { APP_REGISTRY, getAppById, getAppLaunchUrl } from '@/lib/app-registry';
import {
  trainerLiveClientHubPath,
  trainerLiveClientJoinPath,
} from '@/lib/trainer-live/client-join-window';
import { supabase } from '@/lib/supabase/supabase-instance';
import { logHandoffSession } from '@/lib/supabase/client/log-handoff';
import TrialBanner from './TrialBanner';

const AccountLanding: React.FC = () => {
  const { user, session, loading, isInTrial, isTrainer } = useAppContext();
  const [fromAppId, setFromAppId] = useState<string | null>(null);
  const [handoff, setHandoff] = useState<StoredHandoff | null>(null);
  const [prefillResult, setPrefillResult] = useState<{ success: boolean; source?: string } | null>(
    null
  );
  const prefillAttemptedRef = useRef(false);
  const oauthEventEmittedRef = useRef(false);
  const guestClaimAttemptedRef = useRef(false);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  type LiveInviteRow = { session_id: string; trainer_display_name: string };
  const [liveInvites, setLiveInvites] = useState<LiveInviteRow[]>([]);
  const [liveInvitesLoading, setLiveInvitesLoading] = useState(false);
  const [liveInvitesErr, setLiveInvitesErr] = useState<string | null>(null);

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

  const applyLiveInvitesRpcResult = useCallback(
    (data: unknown, error: { message: string } | null) => {
      if (error) {
        setLiveInvites([]);
        setLiveInvitesErr(error.message);
        return;
      }
      setLiveInvitesErr(null);
      const rows = Array.isArray(data) ? data : [];
      setLiveInvites(
        rows
          .map((r: unknown) => {
            const o = r as Record<string, unknown>;
            const sid = typeof o.session_id === 'string' ? o.session_id : '';
            const name =
              typeof o.trainer_display_name === 'string' ? o.trainer_display_name : 'Trainer';
            return sid ? { session_id: sid, trainer_display_name: name } : null;
          })
          .filter((x): x is LiveInviteRow => x != null)
      );
    },
    []
  );

  const fetchLiveInvites = useCallback(
    async (opts?: { silent?: boolean; isCurrent?: () => boolean }) => {
      const silent = opts?.silent === true;
      const isCurrent = opts?.isCurrent ?? (() => true);
      if (!silent) {
        setLiveInvitesLoading(true);
        setLiveInvitesErr(null);
      }
      const { data, error } = await supabase.rpc('trainer_live_client_pending_invites');
      if (isCurrent()) {
        applyLiveInvitesRpcResult(data, error);
      }
      if (!silent) {
        setLiveInvitesLoading(false);
      }
    },
    [applyLiveInvitesRpcResult]
  );

  useEffect(() => {
    if (!user || isTrainer) {
      setLiveInvites([]);
      setLiveInvitesErr(null);
      setLiveInvitesLoading(false);
      return;
    }
    const authId = user.uid ?? session?.user?.id;
    if (!authId) {
      return;
    }

    let cancelled = false;
    const isCurrent = () => !cancelled;
    const run = (silent: boolean) => {
      if (cancelled) return;
      void fetchLiveInvites({ silent, isCurrent });
    };

    run(false);

    const channel = supabase
      .channel(`trainer-live-room-invites:${authId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trainer_live_room_invites',
          filter: `invitee_user_id=eq.${authId}`,
        },
        () => {
          if (!cancelled) run(true);
        }
      )
      .subscribe();

    const pollMs = 30_000;
    const interval = setInterval(() => {
      if (cancelled || document.visibilityState !== 'visible') return;
      run(true);
    }, pollMs);

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !cancelled) run(true);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user, session?.user?.id, isTrainer, fetchLiveInvites]);

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

  // Phase 3: after auth, log handoff session once and clear storage.
  // Brief delay lets Supabase client stabilize after OAuth redirect before insert.
  // Set prefillAttemptedRef inside timeout so effect re-runs can reschedule if cleanup cleared a prior timeout.
  useEffect(() => {
    const uid = user?.uid ?? session?.user?.id;
    if (!handoff || handoff.intent !== 'save_session' || !uid || prefillAttemptedRef.current) {
      return;
    }
    const timeoutId = setTimeout(() => {
      if (prefillAttemptedRef.current) return;
      prefillAttemptedRef.current = true;
      logHandoffSession(handoff, uid).then((result) => {
        startTransition(() => {
          if (result.ok) {
            try {
              sessionStorage.removeItem(HANDOFF_STORAGE_KEY);
            } catch {
              // ignore
            }
            setHandoff(null);
            window.dispatchEvent(new CustomEvent('calendar:refresh'));
          }
          setPrefillResult(
            result.ok ? { success: true, source: handoff.source } : { success: false }
          );
        });
        trackEvent(
          supabase,
          result.ok ? 'account_session_prefill_success' : 'account_session_prefill_fail',
          { source: handoff.source },
          { userId: uid, appId: 'app' }
        );
      });
    }, 150);
    return () => clearTimeout(timeoutId);
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

  // Authorized if we have user (profile) OR session (auth). Session can be set before profile
  // fetch completes; after login redirect, profile may lag. Treat session as logged-in so we
  // show account content, not sign-in.
  const isLoggedIn = !!user?.uid || !!session?.user;

  // returnUrl redirect and AMRAP guest claim must not run as separate effects: the redirect
  // calls location.replace synchronously and tears down the page before claim_amrap_guest_session
  // can finish when both returnUrl and guest_* params are present.
  useEffect(() => {
    if (!isLoggedIn || typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('guest_session');
    const participantId = params.get('guest_participant');
    const claimToken = params.get('guest_claim');
    const needsGuestClaim = !!(sessionId && participantId && claimToken);

    const redirectToReturnUrlIfAllowed = (sp: URLSearchParams) => {
      const trimmed = sp.get('returnUrl')?.trim();
      if (!trimmed) return;
      try {
        const nextUrl = new URL(trimmed, window.location.origin);
        if (nextUrl.origin !== window.location.origin) return;
        if (nextUrl.href === window.location.href) return;
        window.location.replace(nextUrl.href);
      } catch {
        // Ignore malformed redirect values.
      }
    };

    if (needsGuestClaim) {
      if (guestClaimAttemptedRef.current) return;
      guestClaimAttemptedRef.current = true;
      void (async () => {
        const uid = user?.uid ?? session?.user?.id ?? null;
        const { error } = await supabase.rpc('claim_amrap_guest_session', {
          p_session_id: sessionId,
          p_participant_id: participantId,
          p_claim_token: claimToken,
        });
        await trackEvent(
          supabase,
          error ? 'guest_amrap_claim_failed' : 'guest_amrap_claim_succeeded',
          error
            ? { source: 'amrap', error: error.message, surface: 'account' }
            : { source: 'amrap', surface: 'account' },
          { userId: uid, appId: 'app' }
        );
        const p = new URLSearchParams(window.location.search);
        p.delete('guest_session');
        p.delete('guest_participant');
        p.delete('guest_claim');
        const nextQuery = p.toString();
        window.history.replaceState(
          {},
          '',
          `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`
        );
        redirectToReturnUrlIfAllowed(p);
      })();
      return;
    }

    redirectToReturnUrlIfAllowed(params);
  }, [isLoggedIn, user?.uid, session?.user?.id]);

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
              href={getAppLaunchUrl(entryApp, { from_hub: '1', app_id: entryApp.id })}
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
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('showHUD'))}
              className="border-orange-500 bg-orange-600 hover:bg-orange-500 rounded-xl border-2 px-4 py-2 font-bold text-white"
            >
              Open HUD
            </button>
            <a
              href="/account/saved-workouts"
              className="hover:border-orange-500/50 hover:bg-orange-500/10 rounded-xl border-2 border-white/20 px-4 py-2 font-bold text-white transition-colors"
            >
              Your Workouts
            </a>
            {user && !isTrainer ? (
              <a
                href={trainerLiveClientHubPath()}
                className="border-orange-light/40 bg-orange-light/10 hover:bg-orange-light/20 inline-flex items-center gap-1.5 rounded-xl border-2 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-orange-light transition-colors"
              >
                <Video className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Live with Trainer
              </a>
            ) : null}
            <a
              href="/account/profile"
              className="hover:border-orange-500/50 hover:bg-orange-500/10 rounded-xl border-2 border-white/20 px-4 py-2 font-bold text-white transition-colors"
            >
              Profile
            </a>
          </div>
          {user && !isTrainer ? (
            <div className="mt-6 rounded-xl border border-dashed border-white/10 border-white/15 bg-black/25 p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h4 className="font-heading text-base font-bold text-white">Live invitations</h4>
                {liveInvites.length > 0 ? (
                  <span
                    className="inline-flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 font-mono text-[10px] font-bold text-white"
                    aria-label={`${liveInvites.length} pending live invitations`}
                  >
                    {liveInvites.length > 99 ? '99+' : liveInvites.length}
                  </span>
                ) : null}
              </div>
              {liveInvitesLoading ? (
                <p className="text-sm text-white/50">Loading invitations…</p>
              ) : liveInvitesErr ? (
                <p className="text-sm text-amber-200/90">{liveInvitesErr}</p>
              ) : liveInvites.length === 0 ? (
                <p className="text-sm text-white/55">
                  No pending invites. When your trainer invites you to a live session, it will show
                  here.
                </p>
              ) : (
                <ul className="space-y-2">
                  {liveInvites.map((inv) => (
                    <li
                      key={inv.session_id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2"
                    >
                      <span className="text-sm text-white/90">
                        <span className="text-white/60">From </span>
                        {inv.trainer_display_name}
                      </span>
                      <a
                        href={trainerLiveClientJoinPath(inv.session_id)}
                        className="border-orange-light/50 bg-orange-light/15 hover:bg-orange-light/25 shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold text-orange-light"
                      >
                        Join session
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
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
            const href = getAppLaunchUrl(app, { from_hub: '1', app_id: app.id });
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
