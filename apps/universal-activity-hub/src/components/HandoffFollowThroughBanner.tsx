/**
 * Post–handoff guidance: next-tab copy, popup-blocked fallback (link + copy), sign-in hint.
 */

import { useEffect, useState } from 'react';

export type HandoffFollowThroughKind = 'open' | 'save' | 'logPast' | 'schedule';

const NEXT_TAB_LINE: Record<HandoffFollowThroughKind, string> = {
  open: 'Training Log opened in a new tab — log your sets there.',
  save: 'Library editor opened in a new tab.',
  logPast: 'Quick log form opened in a new tab.',
  schedule: 'Scheduling opened in a new tab — confirm in the main app.',
};

const SIGN_IN_HINT =
  'If the new tab asks you to sign in, use the same account as your Training Log and timers.';

const AUTO_DISMISS_MS = 12_000;

export interface HandoffFollowThroughBannerProps {
  kind: HandoffFollowThroughKind;
  url: string;
  /** True when window.open returned null (popup likely blocked). */
  popupBlocked: boolean;
  onDismiss?: () => void;
  /** When false, skip auto-dismiss (e.g. modal must stay until user closes). */
  autoDismiss?: boolean;
  className?: string;
}

export default function HandoffFollowThroughBanner({
  kind,
  url,
  popupBlocked,
  onDismiss,
  autoDismiss = true,
  className = '',
}: HandoffFollowThroughBannerProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!autoDismiss || popupBlocked || !onDismiss) return;
    const t = window.setTimeout(() => onDismiss(), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [autoDismiss, popupBlocked, onDismiss]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const panelClass =
    'rounded-xl border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-sm text-amber-50/95';

  return (
    <div className={`space-y-2 ${className}`} role="status">
      {popupBlocked ? (
        <div className={panelClass}>
          <p className="font-medium text-amber-100">New tab may have been blocked</p>
          <p className="mt-1 text-amber-100/80">
            Your browser might have blocked the popup. Use the link below to open the main app.
          </p>
          <p className="mt-2 break-all">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-300 underline underline-offset-2 hover:text-amber-200"
            >
              Open in new tab
            </a>
          </p>
          <button
            type="button"
            onClick={handleCopy}
            className="mt-2 text-left text-xs font-mono uppercase tracking-wider text-amber-200/90 underline-offset-2 hover:underline"
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      ) : (
        <p className="text-sm text-white/85">{NEXT_TAB_LINE[kind]}</p>
      )}
      <p className="text-xs text-white/55">{SIGN_IN_HINT}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-mono uppercase tracking-wider text-white/50 hover:text-white/70"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
