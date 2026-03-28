/**
 * Public roster invite landing: inviter preview, sign-in handoff, accept via /api/invitations/accept.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { trackEvent } from '@interval-timers/analytics';
import { supabase } from '@/lib/supabase/supabase-instance';
import { AppProvider, useAppContext } from '@/contexts/AppContext';
import FluidBackground from '@/components/react/FluidBackground';
import WelcomeSchedulePreview from '@/components/react/WelcomeSchedulePreview';
import WelcomeTestimonialsSlot, {
  type WelcomeTestimonialQuote,
} from '@/components/react/WelcomeTestimonialsSlot';
import { ROSTER_INVITE_STORAGE_KEY } from '@/lib/roster-invite-handoff';
import {
  getWelcomeHeroCopy,
  resolveWelcomeHeroVariant,
  type WelcomeHeroVariantId,
} from '@/lib/welcome-hero-variants';
import {
  getStoredWelcomeLocale,
  getWelcomeLandingStrings,
  setStoredWelcomeLocale,
  type WelcomeLocale,
} from '@/lib/welcome-landing-strings';
import type { RosterInvitePreview } from '@/types/roster-invite-preview';

const DEFAULT_WELCOME_ACCENT = '#fb923c';

function isValidWelcomeHex(color: string | null | undefined): color is string {
  if (!color?.trim()) return false;
  return /^#[0-9A-Fa-f]{3}$/.test(color) || /^#[0-9A-Fa-f]{6}$/.test(color);
}

/** After accept: drop token from query or vanity path. */
function clearInviteFromUrl() {
  if (typeof window === 'undefined') return;
  const u = new URL(window.location.href);
  const vanity = /^\/s\/[^/]+\/i\/[^/]+$/.test(u.pathname);
  if (vanity) {
    window.history.replaceState({}, '', `${u.origin}/welcome`);
    return;
  }
  u.searchParams.delete('invite');
  const qs = u.searchParams.toString();
  window.history.replaceState({}, '', `${u.pathname}${qs ? `?${qs}` : ''}${u.hash}`);
}

export interface WelcomeInviteLandingProps {
  /** From `/s/{slug}/i/{token}` when query param is absent. */
  initialInviteToken?: string;
  pathStudioSlug?: string;
  testimonialsQuotes?: WelcomeTestimonialQuote[];
}

const WelcomeInviteInner: React.FC<WelcomeInviteLandingProps> = ({
  initialInviteToken,
  pathStudioSlug,
  testimonialsQuotes,
}) => {
  const { user, session, loading, isMissionControlStaff, handleLogout } = useAppContext();
  const [token, setToken] = useState('');
  const [preview, setPreview] = useState<RosterInvitePreview | null | undefined>(undefined);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [acceptedKind, setAcceptedKind] = useState<'friend' | 'client' | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [locale, setLocale] = useState<WelcomeLocale>(() =>
    typeof window !== 'undefined' ? getStoredWelcomeLocale() : 'en'
  );
  const [heroVariant, setHeroVariant] = useState<WelcomeHeroVariantId>('a');

  const landingViewTracked = useRef(false);
  /** Keep accept-flow error copy in sync with locale without re-running the accept effect. */
  const localeRef = useRef(locale);
  localeRef.current = locale;

  useEffect(() => {
    setHeroVariant(resolveWelcomeHeroVariant());
  }, []);

  const s = getWelcomeLandingStrings(locale);
  const heroCopy = getWelcomeHeroCopy(heroVariant);

  const isLoggedIn = !!user?.uid || !!session?.user;
  const uid = user?.uid ?? session?.user?.id ?? '';

  const accentColor =
    preview?.studio && isValidWelcomeHex(preview.studio.primaryColor)
      ? preview.studio.primaryColor
      : DEFAULT_WELCOME_ACCENT;

  const rootStyle = {
    ['--welcome-accent' as string]: accentColor,
  } as React.CSSProperties;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fromProp = initialInviteToken?.trim() ?? '';
    const sp = new URLSearchParams(window.location.search);
    const fromUrl = sp.get('invite')?.trim() ?? '';
    let fromStore = '';
    try {
      fromStore = sessionStorage.getItem(ROSTER_INVITE_STORAGE_KEY)?.trim() ?? '';
    } catch {
      fromStore = '';
    }
    const t = fromProp || fromUrl || fromStore;
    if (fromProp || fromUrl) {
      try {
        sessionStorage.setItem(ROSTER_INVITE_STORAGE_KEY, fromProp || fromUrl);
      } catch {
        /* private mode */
      }
    }
    setToken(t);
  }, [initialInviteToken]);

  useEffect(() => {
    if (!token) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/invitations/preview?invite=${encodeURIComponent(token)}`);
        const body = (await res.json().catch(() => ({}))) as RosterInvitePreview & {
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setPreview(null);
          setPreviewError(body.error || 'Invitation not found or expired');
          return;
        }
        const studio =
          body.studio &&
          typeof body.studio === 'object' &&
          typeof (body.studio as { slug?: string }).slug === 'string' &&
          typeof (body.studio as { displayName?: string }).displayName === 'string'
            ? {
                slug: String((body.studio as { slug: string }).slug).trim(),
                displayName: String((body.studio as { displayName: string }).displayName).trim(),
                logoUrl:
                  (body.studio as { logoUrl?: string | null }).logoUrl?.trim() ||
                  (body.studio as { logo_url?: string | null }).logo_url?.trim() ||
                  null,
                primaryColor:
                  (body.studio as { primaryColor?: string | null }).primaryColor?.trim() ||
                  (body.studio as { primary_color?: string | null }).primary_color?.trim() ||
                  null,
                tagline:
                  (body.studio as { tagline?: string | null }).tagline?.trim() ||
                  (body.studio as { welcome_tagline?: string | null }).welcome_tagline?.trim() ||
                  null,
              }
            : null;

        setPreview({
          inviterDisplayName: body.inviterDisplayName ?? null,
          inviterAvatarUrl: body.inviterAvatarUrl ?? null,
          kind: body.kind === 'friend' ? 'friend' : 'client',
          studio,
        });
        setPreviewError(null);
      } catch {
        if (!cancelled) {
          setPreview(null);
          setPreviewError('Could not load invitation');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !preview?.studio?.slug || !pathStudioSlug?.trim()) return;
    if (pathStudioSlug.trim() === preview.studio.slug) return;
    const next = `/s/${encodeURIComponent(preview.studio.slug)}/i/${encodeURIComponent(token)}`;
    window.history.replaceState({}, '', `${next}${window.location.search}`);
  }, [token, preview?.studio?.slug, pathStudioSlug]);

  useEffect(() => {
    if (landingViewTracked.current) return;
    const noToken = !token?.trim();
    const previewReady = noToken ? preview === null : preview !== undefined;
    if (!previewReady) return;
    landingViewTracked.current = true;
    const path_kind =
      typeof window !== 'undefined' && /^\/s\/[^/]+\/i\/[^/]+$/.test(window.location.pathname)
        ? 'vanity'
        : 'welcome';
    const invite_kind =
      preview && typeof preview === 'object' && 'kind' in preview && preview.kind
        ? preview.kind
        : 'unknown';
    void trackEvent(
      supabase,
      'landing_view',
      { has_invite_token: !noToken, path_kind, invite_kind },
      { appId: 'app' }
    );
  }, [token, preview]);

  useEffect(() => {
    if (!token || loading) return;
    const sessionUid = user?.uid ?? session?.user?.id;
    if (!sessionUid) return;

    let cancelled = false;
    (async () => {
      const str = getWelcomeLandingStrings(localeRef.current);
      try {
        const res = await fetch('/api/invitations/accept', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const body = (await res.json().catch(() => ({}))) as { kind?: string; error?: string };
        if (cancelled) return;

        const clearStored = () => {
          try {
            sessionStorage.removeItem(ROSTER_INVITE_STORAGE_KEY);
          } catch {
            /* ignore */
          }
          clearInviteFromUrl();
        };

        if (res.ok) {
          clearStored();
          setAcceptError(null);
          const kind = body.kind === 'friend' ? 'friend' : 'client';
          setAcceptedKind(kind);
          void trackEvent(supabase, 'invite_accept_success', { kind }, { appId: 'app' });
          return;
        }

        if (res.status === 401) {
          setAcceptError(str.signInInvitedEmailRefresh);
          return;
        }

        clearStored();
        setAcceptedKind(null);
        setAcceptError(body.error || str.couldNotAccept);
      } catch {
        if (!cancelled) {
          setAcceptError(getWelcomeLandingStrings(localeRef.current).couldNotAccept);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, loading, user?.uid, session?.user?.id]);

  useEffect(() => {
    if (!acceptError) return;
    setAcceptError((prev) => {
      if (prev == null) return prev;
      const str = getWelcomeLandingStrings(locale);
      const locales: WelcomeLocale[] = ['en', 'es'];
      const signInVariants = locales.map(
        (l) => getWelcomeLandingStrings(l).signInInvitedEmailRefresh
      );
      const couldNotVariants = locales.map((l) => getWelcomeLandingStrings(l).couldNotAccept);
      if (signInVariants.includes(prev)) return str.signInInvitedEmailRefresh;
      if (couldNotVariants.includes(prev)) return str.couldNotAccept;
      return prev;
    });
  }, [locale, acceptError]);

  const returnPath = useCallback(() => {
    if (!token) return '/welcome';
    if (typeof window !== 'undefined' && /^\/s\/[^/]+\/i\/[^/]+$/.test(window.location.pathname)) {
      return `${window.location.pathname}${window.location.search}`;
    }
    const q = new URLSearchParams();
    q.set('invite', token);
    return `/welcome?${q.toString()}`;
  }, [token]);

  const accountSignInHref =
    token !== '' ? `/account?returnUrl=${encodeURIComponent(returnPath())}` : '/account';

  const inviterLabel = preview?.inviterDisplayName?.trim() || 'Your trainer';

  const onWrongPerson = async () => {
    if (!isLoggedIn) return;
    await handleLogout();
    window.location.assign('/welcome');
  };

  const setLocaleAndStore = (next: WelcomeLocale) => {
    setLocale(next);
    setStoredWelcomeLocale(next);
  };

  const statusStripContent = () => {
    if (acceptedKind) return null;
    if (!token) return null;
    if (preview === undefined && !previewError) {
      return <span className="text-white/65">{s.loadingInvitationDetails}</span>;
    }
    if (previewError) return <span className="text-red-300/90">{previewError}</span>;
    if (loading) return <span className="text-white/65">{s.checkingSession}</span>;
    if (preview && !isLoggedIn) {
      return <span className="text-white/75">{s.signInEmailPhone}</span>;
    }
    if (preview && isLoggedIn && !acceptError) {
      return (
        <span className="flex items-center justify-center gap-3 text-white/70">
          <span
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: 'var(--welcome-accent)', borderTopColor: 'transparent' }}
          />
          {s.finishingSetup}
        </span>
      );
    }
    if (acceptError) return <span className="text-red-300/90">{acceptError}</span>;
    return null;
  };

  const inviteStatusStripNode = (() => {
    if (acceptedKind) return null;
    if (!token) return null;
    const inner = statusStripContent();
    if (inner === null) return null;
    return (
      <div
        className="mt-6 rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-center text-sm"
        role="status"
      >
        {inner}
      </div>
    );
  })();

  return (
    <div
      className="relative min-h-screen overflow-x-hidden text-white selection:bg-[var(--welcome-accent)] selection:text-black"
      style={rootStyle}
    >
      <FluidBackground />
      <main className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 pb-16 pt-24 md:px-6">
        <div
          className="w-full rounded-2xl border border-white/10 bg-black/40 p-8 text-center backdrop-blur-sm"
          style={{ borderColor: 'color-mix(in srgb, var(--welcome-accent) 35%, transparent)' }}
        >
          {preview?.studio ? (
            <div className="mb-6 flex flex-col items-center gap-3">
              {preview.studio.logoUrl ? (
                <img
                  src={preview.studio.logoUrl}
                  alt=""
                  className="max-h-16 max-w-[200px] object-contain"
                />
              ) : null}
              <p className="font-heading text-xl font-bold text-white">
                {preview.studio.displayName}
              </p>
              {preview.studio.tagline ? (
                <p className="max-w-sm text-sm text-white/60">{preview.studio.tagline}</p>
              ) : null}
              <p className="font-mono text-[10px] uppercase tracking-widest text-white/35">
                {s.brandSubtitle}
              </p>
            </div>
          ) : (
            <p
              className="mb-2 font-mono text-xs uppercase tracking-widest"
              style={{ color: 'var(--welcome-accent)' }}
            >
              {s.brandSubtitle}
            </p>
          )}

          <h1 className="mb-2 font-heading text-2xl font-bold uppercase tracking-tight md:text-3xl">
            {!token && isLoggedIn ? heroCopy.titleWelcomeBack : heroCopy.titleInvited}
          </h1>

          {!token && !isLoggedIn && <p className="text-white/70">{heroCopy.subMissingToken}</p>}

          {!token && isLoggedIn && <p className="text-white/65">{heroCopy.subCalendarTeaser}</p>}

          {token && preview === undefined && !previewError && (
            <p className="text-white/50">{s.loadingInvitation}</p>
          )}

          {token && previewError && preview == null && (
            <p className="text-white/70">{previewError}</p>
          )}

          <WelcomeTestimonialsSlot quotes={testimonialsQuotes} />

          {token && preview && !acceptedKind && (
            <>
              <div className="mt-8 flex flex-col items-center gap-4">
                {preview.inviterAvatarUrl ? (
                  <img
                    src={preview.inviterAvatarUrl}
                    alt=""
                    className="h-20 w-20 rounded-full border-2 object-cover"
                    style={{ borderColor: 'color-mix(in srgb, var(--welcome-accent) 55%, white)' }}
                  />
                ) : (
                  <div
                    className="flex h-20 w-20 items-center justify-center rounded-full border-2 bg-white/5 text-2xl font-bold text-white/80"
                    style={{
                      borderColor: 'color-mix(in srgb, var(--welcome-accent) 40%, transparent)',
                    }}
                  >
                    {inviterLabel.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <p className="text-lg text-white/90">
                  {preview.studio ? (
                    <>
                      <span className="text-white/60">{s.invitedBy} </span>
                      <span className="font-semibold text-white">{inviterLabel}</span>
                      <span className="text-white/60"> {s.invitedAt} </span>
                      <span className="font-semibold text-white">{preview.studio.displayName}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-white/60">{s.invitedBy} </span>
                      <span className="font-semibold text-white">{inviterLabel}</span>
                    </>
                  )}
                </p>
                <p className="text-sm text-white/50">
                  {preview.kind === 'friend' ? s.kindFriendSub : s.kindClientSub}
                </p>
              </div>

              {inviteStatusStripNode}

              {!isLoggedIn && !loading && preview && (
                <div className="mt-6 space-y-4">
                  <a
                    href={accountSignInHref}
                    className="inline-block w-full rounded-xl px-6 py-3 font-bold uppercase text-black transition-opacity hover:opacity-90"
                    style={{ backgroundColor: 'var(--welcome-accent)' }}
                  >
                    {s.signInToAccept}
                  </a>
                  <p className="text-xs text-white/40">{s.signInSameContact}</p>
                </div>
              )}
            </>
          )}

          {acceptedKind && (
            <div className="mt-8 space-y-6">
              <div
                className="rounded-lg border px-4 py-3 text-white/90"
                style={{
                  borderColor: 'color-mix(in srgb, var(--welcome-accent) 45%, transparent)',
                  backgroundColor: 'color-mix(in srgb, var(--welcome-accent) 12%, transparent)',
                }}
                role="status"
              >
                {acceptedKind === 'friend' ? s.acceptSuccessFriend : s.acceptSuccessClient}
              </div>
              <a
                href="/"
                className="inline-block w-full rounded-xl px-6 py-3 font-bold uppercase text-black transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--welcome-accent)' }}
                onClick={() =>
                  void trackEvent(
                    supabase,
                    'cta_open_app',
                    { surface: 'post_accept' },
                    { appId: 'app' }
                  )
                }
              >
                {s.openApp}
              </a>
              {isMissionControlStaff && (
                <a
                  href="/trainer"
                  className="block text-sm font-medium uppercase tracking-wide text-white/50 hover:text-white"
                >
                  {s.missionControl}
                </a>
              )}
            </div>
          )}
        </div>

        {isLoggedIn && !loading && uid ? (
          <WelcomeSchedulePreview
            userId={uid}
            className="mt-6 w-full"
            strings={s}
            locale={locale}
          />
        ) : null}

        <footer className="mt-10 w-full max-w-lg text-center text-xs text-white/45">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <a
              href="/privacy"
              className="underline decoration-white/25 underline-offset-2 hover:text-white"
            >
              {s.footerPrivacy}
            </a>
            <a
              href="/terms"
              className="underline decoration-white/25 underline-offset-2 hover:text-white"
            >
              {s.footerTerms}
            </a>
            <span className="text-white/25" aria-hidden>
              |
            </span>
            <span className="text-white/50">{s.localeLabel}:</span>
            <button
              type="button"
              className={`font-mono text-[10px] uppercase tracking-wider ${locale === 'en' ? 'text-orange-light' : 'hover:text-white'}`}
              onClick={() => setLocaleAndStore('en')}
            >
              {s.localeEn}
            </button>
            <button
              type="button"
              className={`font-mono text-[10px] uppercase tracking-wider ${locale === 'es' ? 'text-orange-light' : 'hover:text-white'}`}
              onClick={() => setLocaleAndStore('es')}
            >
              {s.localeEs}
            </button>
          </div>
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="mb-2">{s.footerWrongPerson}</p>
            {isLoggedIn ? (
              <button
                type="button"
                className="text-orange-light/90 font-medium uppercase tracking-wide hover:text-orange-light"
                onClick={() => void onWrongPerson()}
              >
                {s.footerWrongPersonSignOut}
              </button>
            ) : (
              <p className="text-white/40">{s.footerWrongPersonSignedOut}</p>
            )}
          </div>
        </footer>
      </main>
    </div>
  );
};

const WelcomeInviteLanding: React.FC<WelcomeInviteLandingProps> = (props) => {
  return (
    <AppProvider>
      <WelcomeInviteInner {...props} />
    </AppProvider>
  );
};

export default WelcomeInviteLanding;
