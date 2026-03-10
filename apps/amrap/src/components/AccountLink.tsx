/**
 * Link to Account page with session handoff when crossing origins.
 * In dev: AMRAP (localhost:5177) and Account (localhost:3006) are different origins,
 * localStorage is not shared, so we pass the session via URL hash (DEV-only for security).
 * In production: use same-origin deployment so session is shared; no handoff needed.
 */

import React from 'react';
import { useAmrapAuth } from '@/contexts/AmrapAuthContext';

// Production (same-origin): use /account. Dev (cross-origin): use full URL.
const ACCOUNT_URL =
  import.meta.env.VITE_ACCOUNT_REDIRECT_URL ??
  import.meta.env.VITE_HUD_REDIRECT_URL ??
  '/account';

interface AccountLinkProps {
  href?: string;
  className?: string;
  children: React.ReactNode;
  /** Render as span/button instead of anchor when doing handoff (avoids double nav) */
  asButton?: boolean;
}

export default function AccountLink({
  href = ACCOUNT_URL,
  className,
  children,
  asButton = false,
}: AccountLinkProps) {
  const { user, session } = useAmrapAuth();

  const handleClick = (e: React.MouseEvent) => {
    const targetUrl = new URL(href, window.location.origin);
    const isCrossOrigin = targetUrl.origin !== window.location.origin;

    // Token-in-URL handoff only in dev: avoids refresh token in history/JS on prod
    const allowHandoff = import.meta.env.DEV;
    if (allowHandoff && isCrossOrigin && user && session?.access_token && session?.refresh_token) {
      e.preventDefault();
      const url = new URL(href);
      url.hash = `access_token=${encodeURIComponent(session.access_token)}&refresh_token=${encodeURIComponent(session.refresh_token)}&type=recovery`;
      window.location.href = url.toString();
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
