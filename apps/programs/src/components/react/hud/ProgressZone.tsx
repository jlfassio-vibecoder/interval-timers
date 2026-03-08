/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Zone 4: Progress Zone — Volume chart, Consistency heatmap, PRs feed.
 * Replaces RecentProgressWidget.
 */

import React, { useState, useCallback, useEffect } from 'react';
import VolumeChart from './VolumeChart';
import ConsistencyHeatmap from './ConsistencyHeatmap';
import PRFeed from './PRFeed';

const STORAGE_KEY = 'ai-fit-progress-tab';

export type ProgressTab = 'volume' | 'consistency' | 'prs';

function PlaceholderChart() {
  const heights = [35, 55, 45, 70, 60, 85, 65];
  return (
    <div className="flex h-32 items-end justify-between gap-1 rounded-xl bg-white/5 px-2 py-3">
      {heights.map((h, i) => (
        <div key={i} className="min-w-0 flex-1 rounded-t bg-white/20" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

export interface ProgressZoneProps {
  isPaid: boolean;
  /** When false, hide upgrade CTA (e.g. user has only trainer_assigned/cohort programs). */
  showUpgradePrompts: boolean;
  onOpenConversionModal: () => void;
  workoutsThisWeek?: number;
}

const ProgressZone: React.FC<ProgressZoneProps> = ({
  isPaid,
  showUpgradePrompts,
  onOpenConversionModal,
  workoutsThisWeek = 5,
}) => {
  const [activeTab, setActiveTabState] = useState<ProgressTab>(() => {
    if (typeof window === 'undefined') return 'volume';
    try {
      const s = window.localStorage.getItem(STORAGE_KEY);
      if (s === 'volume' || s === 'consistency' || s === 'prs') return s;
    } catch {
      // ignore
    }
    return 'volume';
  });

  const setActiveTab = useCallback((tab: ProgressTab) => {
    setActiveTabState(tab);
    try {
      window.localStorage.setItem(STORAGE_KEY, tab);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const s = window.localStorage.getItem(STORAGE_KEY);
      if (s === 'volume' || s === 'consistency' || s === 'prs') setActiveTabState(s);
    } catch {
      // ignore
    }
  }, []);

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
      <h4 className="border-orange-light/20 mb-4 border-b pb-4 font-mono text-[10px] uppercase tracking-[0.4em] text-orange-light">
        Progress
      </h4>
      {!isPaid ? (
        <div className="flex flex-col gap-4">
          <p className="text-xl font-light italic text-gray-200">
            {workoutsThisWeek} Workouts completed this week.
            {showUpgradePrompts ? ' Upgrade to save client data and see progress trends.' : ''}
          </p>
          <PlaceholderChart />
          {showUpgradePrompts && (
            <button
              type="button"
              onClick={onOpenConversionModal}
              className="border-orange-light/30 bg-orange-light/10 self-start rounded-2xl border px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest text-orange-light transition-colors hover:bg-orange-light hover:text-black"
            >
              Upgrade to save & track client progress
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex gap-6 border-b border-white/10 font-mono text-[10px] uppercase tracking-widest text-white/60">
            {(['volume', 'consistency', 'prs'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`border-b-2 pb-2 transition-colors hover:text-white/90 ${
                  activeTab === tab ? 'border-orange-light text-orange-light' : 'border-transparent'
                }`}
              >
                {tab === 'volume' ? 'Volume' : tab === 'consistency' ? 'Consistency' : 'PRs'}
              </button>
            ))}
          </div>
          {activeTab === 'volume' && <VolumeChart isPaid={isPaid} />}
          {activeTab === 'consistency' && <ConsistencyHeatmap isPaid={isPaid} />}
          {activeTab === 'prs' && <PRFeed isPaid={isPaid} />}
        </div>
      )}
    </section>
  );
};

export default ProgressZone;
