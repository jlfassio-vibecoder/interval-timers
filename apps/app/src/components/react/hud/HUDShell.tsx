/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Layout wrapper for the HUD (Heads Up Display). Overlay mode (onClose) or page-embedded.
 * Renders optional Progressive Upgrade Banner, Saved Programs Sidebar, and main content.
 */

import React, { useState, type ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAppContext } from '@/contexts/AppContext';
import { useDerivedNotifications } from '@/hooks/useDerivedNotifications';
import HUDHeader from './HUDHeader';
import NotificationPanel from './NotificationPanel';

export interface HUDShellProps {
  isPaid: boolean;
  /** When provided, HUD runs in overlay mode (fixed full-screen, close button). */
  onClose?: () => void;
  /** For overlay mode: when false, overlay animates out then unmounts. Omit or true when used as page. */
  isOpen?: boolean;
  children: ReactNode;
  /** Rendered at top when !isPaid (e.g. ProgressiveUpgradeBanner). */
  banner?: ReactNode;
  /** Left column (e.g. ProgramSidebar). */
  sidebar?: ReactNode;
}

const HUDShell: React.FC<HUDShellProps> = ({
  isPaid,
  onClose,
  isOpen = true,
  children,
  banner,
  sidebar,
}) => {
  const reduceMotion = useReducedMotion();
  const isOverlay = typeof onClose === 'function';
  const { user, activeProgramId } = useAppContext();
  const { notifications, count: notificationCount } = useDerivedNotifications(
    user?.uid,
    activeProgramId ?? null
  );
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);

  const content = (
    <div className="mx-auto flex max-w-7xl flex-col gap-10">
      {/* Optional sticky upgrade banner (free users only) */}
      {!isPaid && banner ? <div className="sticky top-0 z-10 shrink-0">{banner}</div> : null}

      {/* Header */}
      <HUDHeader
        onClose={isOverlay ? onClose : undefined}
        notificationCount={notificationCount}
        onBellClick={() => setNotificationPanelOpen(true)}
      />
      <NotificationPanel
        isOpen={notificationPanelOpen}
        onClose={() => setNotificationPanelOpen(false)}
        notifications={notifications}
      />

      {/* Two-column: sidebar + main */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        {sidebar ? <aside className="space-y-6 lg:col-span-3">{sidebar}</aside> : null}
        <main className={sidebar ? 'lg:col-span-9' : 'lg:col-span-12'}>{children}</main>
      </div>
    </div>
  );

  if (isOverlay) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={reduceMotion ? { duration: 0 } : undefined}
            className="fixed inset-0 z-[90] cursor-auto overflow-y-auto bg-bg-dark px-6 pb-12 pt-24"
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return <div className="min-h-screen bg-bg-dark px-6 pb-12 pt-24">{content}</div>;
};

export default HUDShell;
