/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Zone 3 Today Zone: Readiness Check-In, Today's Workout Card, Quick Stats Bar.
 */

import React, { useCallback, useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import ReadinessCheckIn from './ReadinessCheckIn';
import TodayWorkoutCard from './TodayWorkoutCard';
import QuickStatsBar from './QuickStatsBar';

export interface TodayZoneProps {
  isPaid: boolean;
  /** When false, hide upgrade CTAs (e.g. user has only trainer_assigned/cohort programs). */
  showUpgradePrompts: boolean;
  onOpenConversionModal: () => void;
}

const TodayZone: React.FC<TodayZoneProps> = ({
  isPaid,
  showUpgradePrompts,
  onOpenConversionModal,
}) => {
  const { user, activeProgramId } = useAppContext();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleWorkoutComplete = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  if (!user?.uid) {
    return (
      <section aria-label="Today">
        <p className="rounded-3xl border border-white/10 bg-black/20 p-6 text-sm text-white/50">
          Sign in to see today&apos;s workout.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Today" className="flex flex-col gap-6">
      <h4 className="border-orange-light/20 border-b pb-4 font-mono text-[10px] uppercase tracking-[0.4em] text-orange-light">
        Today
      </h4>
      <ReadinessCheckIn userId={user.uid} key={`readiness-${refreshKey}`} />
      <TodayWorkoutCard
        key={`today-${activeProgramId ?? 'none'}-${refreshKey}`}
        userId={user.uid}
        activeProgramId={activeProgramId}
        isPaid={isPaid}
        showUpgradePrompts={showUpgradePrompts}
        onOpenConversionModal={onOpenConversionModal}
        onWorkoutComplete={handleWorkoutComplete}
      />
      <QuickStatsBar userId={user.uid} activeProgramId={activeProgramId} />
    </section>
  );
};

export default TodayZone;
