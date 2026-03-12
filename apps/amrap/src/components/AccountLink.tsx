/**
 * Link to Account page with session handoff when crossing origins.
 * In dev: AMRAP (localhost:5177) and Account (localhost:3006) are different origins,
 * localStorage is not shared, so we pass the session via URL hash (DEV-only for security).
 * In production: use same-origin deployment so session is shared; no handoff needed.
 */

import React from 'react';
import { buildAccountRedirectUrl } from '@interval-timers/handoff';
import type { HandoffPayload } from '@interval-timers/handoff';
import { trackEvent } from '@interval-timers/analytics';
import { useAmrapAuth } from '@/contexts/AmrapAuthContext';
import { supabase } from '@/lib/supabase';
import { ACCOUNT_BASE, ACCOUNT_REDIRECT_URL } from '@/lib/account-redirect-url';

interface AccountLinkProps {
  href?: string;
  className?: string;
  children: React.ReactNode;
  /** Render as span/button instead of anchor when doing handoff (avoids double nav) */
  asButton?: boolean;
  /** Intent for handoff (e.g. save_session); when set, uses buildAccountRedirectUrl with source=amrap */
  intent?: string;
  /** Optional payload for handoff URL (rounds, time, etc.) */
  handoffPayload?: Partial<Pick<HandoffPayload, 'time' | 'calories' | 'rounds' | 'preset'>>;
}

export default function AccountLink({
  href,
  className,
  children,
  asButton = false,
  intent,
  handoffPayload,
}: AccountLinkProps) {
  const resolvedHref =
    href ??
    (intent
      ? buildAccountRedirectUrl(intent, 'amrap', handoffPayload, ACCOUNT_BASE)
      : ACCOUNT_REDIRECT_URL);
  const { user, session } = useAmrapAuth();

  const handleClick = (e: React.MouseEvent) => {
    // Allow modifiers (open in new tab, etc.) to use default anchor behavior
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;

    if (intent === 'save_session') {
      trackEvent(supabase, 'timer_save_click', {
        source: 'amrap',
        intent,
        ...handoffPayload,
      }, { appId: 'amrap' });
    }

    const targetUrl = new URL(resolvedHref, window.location.origin);
    const isCrossOrigin = targetUrl.origin !== window.location.origin;

    // Token-in-URL handoff only in dev: avoids refresh token in history/JS on prod
    const allowHandoff = import.meta.env.DEV;
    if (allowHandoff && isCrossOrigin && user && session?.access_token && session?.refresh_token) {
      e.preventDefault();
      const url = new URL(resolvedHref, window.location.origin);
      url.hash = `access_token=${encodeURIComponent(session.access_token)}&refresh_token=${encodeURIComponent(session.refresh_token)}&type=recovery`;
      window.location.href = url.toString();
    } else {
      // Both anchor and button: navigate manually so we consistently use href (which includes
      // ?from=amrap) and avoid framework/router quirks that might strip query params.
      e.preventDefault();
      window.location.href = resolvedHref;
    }
  };

  if (asButton) {
    return (
      <button type="button" onClick={handleClick} className={className}>
        {children}
      </button>
    );
  }

  return (
    <a href={resolvedHref} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}
