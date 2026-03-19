/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Training Log page wrapper: gates content by auth. Unauthenticated users see landing;
 * authenticated users see placeholder (Phase 3: full TrainingLog).
 */

import React from 'react';
import { useAppContext } from '@/contexts/AppContext';
import TrainingLogLandingContent from './TrainingLogLandingContent';
import TrainingLog from './TrainingLog';

const TrainingLogPage: React.FC = () => {
  const { user, session, loading } = useAppContext();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="font-mono text-sm text-white/50">Loading…</p>
      </div>
    );
  }

  const isLoggedIn = !!user?.uid || !!session?.user;

  if (!isLoggedIn) {
    return <TrainingLogLandingContent />;
  }

  return <TrainingLog />;
};

export default TrainingLogPage;
