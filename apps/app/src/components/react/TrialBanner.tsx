/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Trial banner for account page. Shows remaining trial time when trial_ends_at is in future.
 */

import React, { useState, useEffect } from 'react';

function formatTrialRemaining(ms: number): string {
  if (ms <= 0) return '0h';
  const totalHours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days >= 1) {
    return `${days}d ${hours}h`;
  }
  return `${hours}h`;
}

export interface TrialBannerProps {
  /** ISO string or timestamp for trial end */
  trialEndsAt: string;
  /** Optional dismiss callback; MVP can skip dismiss. */
  onDismiss?: () => void;
}

const TrialBanner: React.FC<TrialBannerProps> = ({ trialEndsAt, onDismiss }) => {
  const [remaining, setRemaining] = useState<string | null>(() => {
    const end = new Date(trialEndsAt).getTime();
    const ms = end - Date.now();
    return ms > 0 ? formatTrialRemaining(ms) : null;
  });

  useEffect(() => {
    const end = new Date(trialEndsAt).getTime();
    const tick = () => {
      const ms = end - Date.now();
      if (ms <= 0) {
        setRemaining(null);
        return;
      }
      setRemaining(formatTrialRemaining(ms));
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [trialEndsAt]);

  if (remaining == null) return null;

  return (
    <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-white">
          Pro Access Unlocked — {remaining} remaining.
        </p>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="shrink-0 rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <span className="sr-only">Dismiss</span>
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default TrialBanner;
