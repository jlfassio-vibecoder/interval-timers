/**
 * Link to Account page with session handoff when crossing origins.
 * In dev: AMRAP (localhost:5177) and Account (localhost:3006) are different origins,
 * localStorage is not shared, so we pass the session via URL hash (DEV-only for security).
 * In production: use same-origin deployment so session is shared; no handoff needed.
 */

import React from 'react';
import { useAmrapAuth } from '@/contexts/AmrapAuthContext';
import { ACCOUNT_REDIRECT_URL } from '@/lib/account-redirect-url';

interface AccountLinkProps {
  href?: string;
  className?: string;
  children: React.ReactNode;
  /** Render as span/button instead of anchor when doing handoff (avoids double nav) */
  asButton?: boolean;
}

export default function AccountLink({
  href = ACCOUNT_REDIRECT_URL,
  className,
  children,
  asButton = false,
}: AccountLinkProps) {
  const { user, session } = useAmrapAuth();

  const handleClick = (e: React.MouseEvent) => {
    // Allow modifiers (open in new tab, etc.) to use default anchor behavior
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;

    const targetUrl = new URL(href, window.location.origin);
    const isCrossOrigin = targetUrl.origin !== window.location.origin;

    // Token-in-URL handoff only in dev: avoids refresh token in history/JS on prod
    const allowHandoff = import.meta.env.DEV;
    if (allowHandoff && isCrossOrigin && user && session?.access_token && session?.refresh_token) {
      e.preventDefault();
      const url = new URL(href, window.location.origin);
      url.hash = `access_token=${encodeURIComponent(session.access_token)}&refresh_token=${encodeURIComponent(session.refresh_token)}&type=recovery`;
      window.location.href = url.toString();
    } else {
      // Both anchor and button: navigate manually so we consistently use href (which includes
      // ?from=amrap) and avoid framework/router quirks that might strip query params.
      e.preventDefault();
      window.location.href = href;
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
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}
