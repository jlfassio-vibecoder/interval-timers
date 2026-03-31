/**
 * Public roster invite landing: inviter preview, sign-in handoff, accept via /api/invitations/accept.
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { trackEvent } from '@interval-timers/analytics';
import { AuthModal } from '@interval-timers/auth-ui';
import { supabase } from '@/lib/supabase/supabase-instance';
import { AppProvider, useAppContext } from '@/contexts/AppContext';
import FluidBackground from '@/components/react/FluidBackground';
import WelcomeSchedulePreview from '@/components/react/WelcomeSchedulePreview';
import {
  WelcomeWelcomeBackHeroSkeleton,
  WelcomeWelcomeBackScheduleSkeleton,
} from '@/components/react/WelcomeWelcomeBackSkeleton';
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
import type { RosterInvitePreview, RosterInviteStudioPreview } from '@/types/roster-invite-preview';
import { parseStudioWelcomeContent } from '@/lib/studio-welcome-content-schema';
import {
  mergeAcceptSuccessCopy,
  mergeOpenAppCta,
  mergeWelcomeBackTrainerTeaser,
  mergeWelcomeHeroCopy,
  mergeWelcomeStatusStrip,
  pickInviteFlowHeroSub,
} from '@/lib/studio-welcome-merge';

const DEFAULT_WELCOME_ACCENT = '#fb923c';

function parseWelcomeStudioFromApi(v: unknown): RosterInviteStudioPreview | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const slug = typeof o.slug === 'string' ? o.slug.trim() : '';
  const displayName = typeof o.displayName === 'string' ? o.displayName.trim() : '';
  if (!slug || !displayName) return null;
  const wc = parseStudioWelcomeContent(o.welcomeContent);
  return {
    slug,
    displayName,
    logoUrl: typeof o.logoUrl === 'string' ? o.logoUrl.trim() || null : null,
    primaryColor: typeof o.primaryColor === 'string' ? o.primaryColor.trim() || null : null,
    tagline: typeof o.tagline === 'string' ? o.tagline.trim() || null : null,
    welcomeContent: Object.keys(wc).length ? wc : null,
  };
}

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
  /**
   * From `welcome.astro` when the request had a valid session and no `?invite=` (trainer teaser; RLS-safe server read).
   */
  initialTrainerFirstName?: string | null;
  /** Must match hydrated `uid` for `initialTrainerFirstName` to apply (avoids cross-user flash). */
  ssrSessionUserId?: string | null;
  /** Logged-in welcome-back studio from SSR (same shape as invite preview). */
  initialWelcomeStudio?: RosterInviteStudioPreview | null;
  /** Active enrollment count from SSR (multi-program hint). */
  initialActiveProgramCount?: number;
}

const WelcomeInviteInner: React.FC<WelcomeInviteLandingProps> = ({
  initialInviteToken,
  pathStudioSlug,
  testimonialsQuotes,
  initialTrainerFirstName,
  ssrSessionUserId,
  initialWelcomeStudio,
  initialActiveProgramCount = 0,
}) => {
  const { user, session, loading, activeProgramId, isMissionControlStaff, handleLogout } =
    useAppContext();
  const [token, setToken] = useState('');
  const [preview, setPreview] = useState<RosterInvitePreview | null | undefined>(undefined);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [acceptedKind, setAcceptedKind] = useState<'friend' | 'client' | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [showInviteAuthModal, setShowInviteAuthModal] = useState(false);
  const [inviteAuthSignupFirst, setInviteAuthSignupFirst] = useState(true);
  const [locale, setLocale] = useState<WelcomeLocale>(() =>
    typeof window !== 'undefined' ? getStoredWelcomeLocale() : 'en'
  );
  const [heroVariant, setHeroVariant] = useState<WelcomeHeroVariantId>('a');
  /** Resolved via GET /api/welcome/trainer-display (RLS blocks client-side trainer profile reads). */
  const [welcomeTrainerFirstName, setWelcomeTrainerFirstName] = useState<string | null>(null);
  const [welcomeLoggedInStudio, setWelcomeLoggedInStudio] =
    useState<RosterInviteStudioPreview | null>(null);
  const [welcomeActiveProgramCount, setWelcomeActiveProgramCount] = useState(0);
  /** False until trainer-display fetch finishes for the logged-in, no-token path (coordinates skeleton). */
  const [trainerFetchSettled, setTrainerFetchSettled] = useState(false);

  const landingViewTracked = useRef(false);
  const clientInviteAutoOpenDone = useRef(false);
  /** Keep accept-flow error copy in sync with locale without re-running the accept effect. */
  const localeRef = useRef(locale);
  localeRef.current = locale;

  const isLoggedIn = !!user?.uid || !!session?.user;
  const uid = user?.uid ?? session?.user?.id ?? '';

  useEffect(() => {
    document.getElementById('welcome-static-shell')?.remove();
  }, []);

  useEffect(() => {
    setHeroVariant(resolveWelcomeHeroVariant());
  }, []);

  useEffect(() => {
    if (token || !isLoggedIn || !uid) {
      setWelcomeTrainerFirstName(null);
      setWelcomeLoggedInStudio(null);
      setWelcomeActiveProgramCount(0);
      setTrainerFetchSettled(false);
      return;
    }

    setTrainerFetchSettled(false);
    if (ssrSessionUserId && uid === ssrSessionUserId) {
      setWelcomeTrainerFirstName(initialTrainerFirstName ?? null);
      setWelcomeLoggedInStudio(initialWelcomeStudio ?? null);
      setWelcomeActiveProgramCount(
        typeof initialActiveProgramCount === 'number' ? initialActiveProgramCount : 0
      );
    }

    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams();
        if (activeProgramId?.trim()) {
          params.set('programId', activeProgramId.trim());
        }
        const qs = params.toString();
        const res = await fetch(`/api/welcome/trainer-display${qs ? `?${qs}` : ''}`, {
          credentials: 'include',
        });
        const body = (await res.json().catch(() => ({}))) as {
          firstName?: string | null;
          studio?: unknown;
          activeProgramCount?: number;
        };
        if (cancelled) return;
        setWelcomeTrainerFirstName(typeof body.firstName === 'string' ? body.firstName : null);
        setWelcomeLoggedInStudio(parseWelcomeStudioFromApi(body.studio));
        setWelcomeActiveProgramCount(
          typeof body.activeProgramCount === 'number' ? body.activeProgramCount : 0
        );
      } catch {
        if (!cancelled) {
          setWelcomeTrainerFirstName(null);
          setWelcomeLoggedInStudio(null);
          setWelcomeActiveProgramCount(0);
        }
      } finally {
        if (!cancelled) setTrainerFetchSettled(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    token,
    isLoggedIn,
    uid,
    activeProgramId,
    ssrSessionUserId,
    initialTrainerFirstName,
    initialWelcomeStudio,
    initialActiveProgramCount,
  ]);

  const s = getWelcomeLandingStrings(locale);
  const heroCopy = getWelcomeHeroCopy(heroVariant);

  const studioWelcomeForCopy = useMemo(() => {
    if (token && preview?.studio) return preview.studio.welcomeContent ?? null;
    if (!token && isLoggedIn && welcomeLoggedInStudio)
      return welcomeLoggedInStudio.welcomeContent ?? null;
    return null;
  }, [token, preview?.studio, isLoggedIn, welcomeLoggedInStudio]);

  const mergedHeroCopy = useMemo(
    () =>
      mergeWelcomeHeroCopy(
        heroVariant,
        locale,
        getWelcomeHeroCopy(heroVariant),
        studioWelcomeForCopy
      ),
    [heroVariant, locale, studioWelcomeForCopy]
  );

  const inviteTokenHeroSub =
    token && preview && !isLoggedIn && !acceptedKind
      ? pickInviteFlowHeroSub(preview.studio?.welcomeContent ?? null, locale)
      : null;

  const showWelcomeBackSkeleton =
    !token && isLoggedIn && !!uid && (loading || !trainerFetchSettled);

  const accentColor = (() => {
    if (preview?.studio && isValidWelcomeHex(preview.studio.primaryColor)) {
      return preview.studio.primaryColor;
    }
    if (!token && welcomeLoggedInStudio && isValidWelcomeHex(welcomeLoggedInStudio.primaryColor)) {
      return welcomeLoggedInStudio.primaryColor;
    }
    return DEFAULT_WELCOME_ACCENT;
  })();

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
                welcomeContent: (() => {
                  const st = body.studio as { welcomeContent?: unknown } | null;
                  if (!st || typeof st !== 'object') return null;
                  const wc = parseStudioWelcomeContent(
                    (st as { welcomeContent?: unknown }).welcomeContent
                  );
                  return Object.keys(wc).length ? wc : null;
                })(),
              }
            : null;

        const raw = body as unknown as Record<string, unknown>;
        const rawEmail =
          typeof body.inviteeEmail === 'string'
            ? body.inviteeEmail.trim()
            : typeof raw.invitee_email === 'string'
              ? raw.invitee_email.trim()
              : '';
        const rawPhone =
          typeof body.inviteePhoneE164 === 'string'
            ? body.inviteePhoneE164.trim()
            : typeof raw.invitee_phone_e164 === 'string'
              ? raw.invitee_phone_e164.trim()
              : '';

        setPreview({
          inviterDisplayName: body.inviterDisplayName ?? null,
          inviterAvatarUrl: body.inviterAvatarUrl ?? null,
          kind: body.kind === 'friend' ? 'friend' : 'client',
          studio,
          inviteeEmail: rawEmail || null,
          inviteePhoneE164: rawPhone || null,
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
        const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        const at = session?.access_token?.trim();
        if (at) authHeaders.Authorization = `Bearer ${at}`;
        const res = await fetch('/api/invitations/accept', {
          method: 'POST',
          credentials: 'include',
          headers: authHeaders,
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
  }, [token, loading, user?.uid, session?.user?.id, session?.access_token]);

  // New invite link = new token: allow auto-open again (ref would otherwise stay true for the instance).
  useEffect(() => {
    clientInviteAutoOpenDone.current = false;
  }, [token]);

  useEffect(() => {
    if (clientInviteAutoOpenDone.current) return;
    if (!token) return;
    if (loading) return;
    if (isLoggedIn) return;
    if (preview === undefined) return;
    if (!preview || preview.kind !== 'client') return;
    clientInviteAutoOpenDone.current = true;
    setInviteAuthSignupFirst(true);
    setShowInviteAuthModal(true);
  }, [token, loading, isLoggedIn, preview]);

  useEffect(() => {
    if (!acceptError) return;
    setAcceptError((prev) => {
      if (prev == null) return prev;
      const str = getWelcomeLandingStrings(locale);
      const locales: WelcomeLocale[] = ['en', 'es', 'fr'];
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

  const handleInviteAuthClose = useCallback(() => {
    setShowInviteAuthModal(false);
  }, []);

  const onInviteAuthSignupStart = useCallback(() => {
    void trackEvent(
      supabase,
      'account_signup_start',
      { from_app_id: 'welcome-invite' },
      { appId: 'app' }
    );
  }, []);

  const onInviteAuthSignupComplete = useCallback(() => {
    void trackEvent(
      supabase,
      'account_signup_complete',
      { from_app_id: 'welcome-invite', method: 'email' },
      { appId: 'app' }
    );
  }, []);

  const onInviteAuthLoginComplete = useCallback(() => {
    void trackEvent(
      supabase,
      'account_login_complete',
      { from_app_id: 'welcome-invite', method: 'email' },
      { appId: 'app' }
    );
  }, []);

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
      const strip = mergeWelcomeStatusStrip(
        preview.kind,
        s,
        preview.studio?.welcomeContent ?? null,
        locale
      );
      return <span className="text-white/75">{strip}</span>;
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
      {preview?.kind === 'client' && token && !isLoggedIn && !acceptedKind ? (
        <AuthModal
          isOpen={showInviteAuthModal}
          onClose={handleInviteAuthClose}
          supabase={supabase}
          redirectBaseUrl="/account"
          fromAppId="welcome-invite"
          returnUrl={returnPath()}
          defaultSignUp={inviteAuthSignupFirst}
          initialEmail={preview.inviteeEmail ?? undefined}
          onSignupStart={onInviteAuthSignupStart}
          onSignupComplete={onInviteAuthSignupComplete}
          onLoginComplete={onInviteAuthLoginComplete}
        />
      ) : null}
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
          ) : !token && isLoggedIn && welcomeLoggedInStudio && !showWelcomeBackSkeleton ? (
            <div className="mb-6 flex flex-col items-center gap-3">
              {welcomeLoggedInStudio.logoUrl ? (
                <img
                  src={welcomeLoggedInStudio.logoUrl}
                  alt=""
                  className="max-h-16 max-w-[200px] object-contain"
                />
              ) : null}
              <p className="font-heading text-xl font-bold text-white">
                {welcomeLoggedInStudio.displayName}
              </p>
              {welcomeLoggedInStudio.tagline ? (
                <p className="max-w-sm text-sm text-white/60">{welcomeLoggedInStudio.tagline}</p>
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
            {!token && isLoggedIn ? heroCopy.titleWelcomeBack : mergedHeroCopy.titleInvited}
          </h1>

          {!token && !isLoggedIn && (
            <p className="text-white/70">{mergedHeroCopy.subMissingToken}</p>
          )}

          {inviteTokenHeroSub ? <p className="mb-2 text-white/65">{inviteTokenHeroSub}</p> : null}

          {!token && isLoggedIn && showWelcomeBackSkeleton && <WelcomeWelcomeBackHeroSkeleton />}

          {!token && isLoggedIn && !showWelcomeBackSkeleton && (
            <>
              <p className="text-white/65">
                {(() => {
                  const t = mergeWelcomeBackTrainerTeaser(
                    s,
                    studioWelcomeForCopy,
                    locale,
                    welcomeTrainerFirstName
                  );
                  return t || heroCopy.subCalendarTeaser;
                })()}
              </p>
              {welcomeActiveProgramCount > 1 ? (
                <p className="mt-2 text-xs text-white/45">{s.welcomeMultipleProgramsHint}</p>
              ) : null}
            </>
          )}

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

              {!isLoggedIn && !loading && preview && preview.kind === 'friend' && (
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

              {!isLoggedIn && !loading && preview && preview.kind === 'client' && (
                <div className="mt-6 space-y-4">
                  {!showInviteAuthModal ? (
                    <>
                      <button
                        type="button"
                        className="inline-block w-full rounded-xl px-6 py-3 font-bold uppercase text-black transition-opacity hover:opacity-90"
                        style={{ backgroundColor: 'var(--welcome-accent)' }}
                        onClick={() => {
                          setInviteAuthSignupFirst(true);
                          setShowInviteAuthModal(true);
                        }}
                      >
                        {s.clientOpenSignupCta}
                      </button>
                      <button
                        type="button"
                        className="w-full text-sm text-white/55 underline decoration-white/25 underline-offset-2 hover:text-white"
                        onClick={() => {
                          setInviteAuthSignupFirst(false);
                          setShowInviteAuthModal(true);
                        }}
                      >
                        {s.clientLogInInsteadCta}
                      </button>
                    </>
                  ) : null}
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
                {mergeAcceptSuccessCopy(
                  acceptedKind,
                  s,
                  preview?.studio?.welcomeContent ?? null,
                  locale
                )}
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
                {mergeOpenAppCta(s, preview?.studio?.welcomeContent ?? null, locale)}
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

        {isLoggedIn && uid && showWelcomeBackSkeleton ? (
          <WelcomeWelcomeBackScheduleSkeleton className="mt-6 w-full" />
        ) : null}

        {isLoggedIn && !loading && uid && !showWelcomeBackSkeleton ? (
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
            <button
              type="button"
              className={`font-mono text-[10px] uppercase tracking-wider ${locale === 'fr' ? 'text-orange-light' : 'hover:text-white'}`}
              onClick={() => setLocaleAndStore('fr')}
            >
              {s.localeFr}
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
