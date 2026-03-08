/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Reusable slide-out drawer panel. Slides in from the right.
 * Used for mobile filter panels (e.g. PrescriptionVitalsSidebar).
 */

import React, { useEffect, useCallback, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional title for header and aria-labelledby */
  title?: string;
}

const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, children, title }) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const target = e.target as HTMLElement;
    if (e.shiftKey) {
      if (target === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (target === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
      setTimeout(() => {
        previouslyFocusedRef.current?.focus?.();
      }, 0);
    };
  }, [isOpen, handleEscape]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
          />
          {/* Panel */}
          <motion.div
            ref={panelRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
            className="fixed right-0 top-0 z-50 flex h-full w-[min(320px,85vw)] max-w-full flex-col border-l border-white/10 bg-bg-dark shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-label={!title ? 'Drawer' : undefined}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-4">
              {title && (
                <h2
                  id={titleId}
                  className="font-heading text-sm font-bold uppercase tracking-wider text-white/90"
                >
                  {title}
                </h2>
              )}
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/80 transition hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Content - scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default Drawer;
