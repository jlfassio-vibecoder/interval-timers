/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, StrictMode, Suspense, lazy, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AppProvider } from '../../contexts/AppContext';
import AppIslands from './AppIslands';
import FluidBackground from './FluidBackground';
import AccountLanding from './AccountLanding';

const AIChat = lazy(() => import('./AIChat'));
const PurchaseFlow = lazy(() => import('./PurchaseFlow'));

interface AppWrapperProps {
  children?: ReactNode;
  /** Pass from Astro (e.g. Astro.url.pathname) so Navigation SSR matches client */
  pathname?: string;
}

const AppWrapper: React.FC<AppWrapperProps> = ({ children, pathname }) => {
  const [mountPoint, setMountPoint] = React.useState<HTMLElement | null>(null);
  const [shouldRenderDeferredIslands, setShouldRenderDeferredIslands] = useState(false);

  useEffect(() => {
    const element = document.getElementById('purchase-flow-mount');
    setMountPoint(element);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let initialized = false;

    const startDeferredIslands = () => {
      if (initialized) return;
      initialized = true;
      setShouldRenderDeferredIslands(true);
      cleanup();
    };

    const cleanup = () => {
      // NOTE: removeEventListener is idempotent even though listeners use once:true; this ensures
      // they are removed when idle/timeouts fire before any interaction occurs.
      interactionEvents.forEach((event, index) => {
        window.removeEventListener(event, interactionHandlers[index], listenerOptions);
      });
      if (idleHandle !== null && 'cancelIdleCallback' in window) {
        (window as Window & { cancelIdleCallback: (handle: number) => void }).cancelIdleCallback(
          idleHandle
        );
      }
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
      }
    };

    const listenerOptions: Parameters<typeof window.addEventListener>[2] = {
      once: true,
      passive: true,
    };
    const interactionEvents = ['pointerdown', 'keydown', 'scroll'] as const;
    const interactionHandlers = interactionEvents.map(() => () => startDeferredIslands());

    interactionEvents.forEach((event, index) => {
      window.addEventListener(event, interactionHandlers[index], listenerOptions);
    });

    if ('requestIdleCallback' in window) {
      idleHandle = (
        window as Window & {
          requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number;
        }
      ).requestIdleCallback(startDeferredIslands, { timeout: 5000 });
    } else {
      timeoutHandle = setTimeout(startDeferredIslands, 5000);
    }

    return () => cleanup();
  }, []);

  const isAccountPage = pathname === '/account';

  return (
    <StrictMode>
      <AppProvider>
        {isAccountPage ? <AccountLanding /> : children}
        <FluidBackground />
        {shouldRenderDeferredIslands && (
          <Suspense fallback={null}>
            <AIChat />
          </Suspense>
        )}
        <AppIslands pathname={pathname} />
        {mountPoint &&
          shouldRenderDeferredIslands &&
          createPortal(
            <Suspense fallback={null}>
              <PurchaseFlow />
            </Suspense>,
            mountPoint
          )}
      </AppProvider>
    </StrictMode>
  );
};

export default AppWrapper;
