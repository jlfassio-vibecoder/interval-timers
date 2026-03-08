/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Non-intrusive sticky upgrade banner for free users. Message can rotate by activity;
 * optional dismiss (session storage). Opens Conversion Modal on CTA.
 */

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const BANNER_DISMISS_KEY = 'hud_upgrade_banner_dismissed';

const MESSAGES = [
  'Our AI can optimize client progress. Upgrade to save data.',
  'Save client workouts and see progress trends. Upgrade to unlock tracking.',
  'Track client data and get smarter recommendations. Upgrade now.',
];

export interface ProgressiveUpgradeBannerProps {
  onUpgrade: () => void;
  /** Optional: activity-based message index or custom message. */
  messageIndex?: number;
  /** Optional: custom message (overrides rotation). */
  message?: string;
}

const ProgressiveUpgradeBanner: React.FC<ProgressiveUpgradeBannerProps> = ({
  onUpgrade,
  messageIndex = 0,
  message: customMessage,
}) => {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(BANNER_DISMISS_KEY) !== '1') {
        setDismissed(false);
      }
    } catch {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(BANNER_DISMISS_KEY, '1');
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  const message =
    customMessage ?? MESSAGES[Math.min(messageIndex, MESSAGES.length - 1)] ?? MESSAGES[0];

  if (dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-black/40 px-4 py-3 backdrop-blur-sm">
      <p className="min-w-0 flex-1 text-sm text-gray-200 md:text-base">{message}</p>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onUpgrade}
          className="border-orange-light/50 bg-orange-light/10 rounded-full border px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-orange-light transition-colors hover:bg-orange-light hover:text-black"
        >
          Upgrade
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-full p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default ProgressiveUpgradeBanner;
