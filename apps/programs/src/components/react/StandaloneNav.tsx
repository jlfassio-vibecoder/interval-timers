/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Standalone nav for pages that do not mount AppWrapper. Provides AppProvider
 * and Navigation with redirect-based auth callbacks so "Sign in" and "HUD"
 * send the user to home with ?signin=1 or ?hud=1; home then opens the modal/HUD.
 */

import React from 'react';
import { AppProvider, useAppContext } from '../../contexts/AppContext';
import Navigation from './Navigation';

interface StandaloneNavInnerProps {
  initialPathname?: string;
}

const StandaloneNavInner: React.FC<StandaloneNavInnerProps> = ({ initialPathname }) => {
  const { handleLogout } = useAppContext();

  const onShowAuthModal = () => {
    window.location.href = '/?signin=1';
  };

  const onShowHUD = () => {
    window.location.href = '/?hud=1';
  };

  const onLogout = async () => {
    await handleLogout();
    window.location.href = '/';
  };

  return (
    <Navigation
      onShowHUD={onShowHUD}
      onShowAuthModal={onShowAuthModal}
      onLogout={onLogout}
      initialPathname={initialPathname}
    />
  );
};

interface StandaloneNavProps {
  /** Pass from Astro (e.g. Astro.url.pathname) so Navigation SSR matches client */
  pathname?: string;
}

const StandaloneNav: React.FC<StandaloneNavProps> = ({ pathname }) => {
  return (
    <AppProvider>
      <StandaloneNavInner initialPathname={pathname} />
    </AppProvider>
  );
};

export default StandaloneNav;
