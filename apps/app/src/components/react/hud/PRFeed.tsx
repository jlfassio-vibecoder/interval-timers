/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Zone 4: Personal records feed (new max weight per exercise).
 */

import React, { useState, useEffect } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import {
  getPersonalRecords,
  type PersonalRecordEntry,
} from '@/lib/supabase/client/progress-analytics';

export interface PRFeedProps {
  hasAccess: boolean;
}

const PRFeed: React.FC<PRFeedProps> = ({ hasAccess }) => {
  const { user } = useAppContext();
  const [prs, setPrs] = useState<PersonalRecordEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasAccess || !user?.uid) {
      setLoading(false);
      setPrs([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    getPersonalRecords(user.uid, 10)
      .then(setPrs)
      .catch(() => {
        setPrs([]);
        setError('Could not load PR feed.');
      })
      .finally(() => setLoading(false));
  }, [hasAccess, user?.uid]);

  if (!hasAccess) return null;

  if (loading) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded-xl bg-white/5 font-mono text-[10px] uppercase text-white/40">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-xl bg-white/5 py-12 text-center font-mono text-[10px] uppercase italic text-white/40">
        {error}
      </p>
    );
  }

  if (prs.length === 0) {
    return (
      <div className="rounded-xl bg-white/5 py-8 text-center">
        <p className="font-mono text-[10px] uppercase italic text-white/40">
          No PRs yet — start logging sets to track records
        </p>
        <p className="mt-2 text-xs text-white/45">
          PRs currently come from workouts where completed set weights are logged.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-white/45">
        PRs currently come from workouts where completed set weights are logged.
      </p>
      <ul className="space-y-3">
        {prs.map((pr, i) => (
          <li
            key={`${pr.exerciseName}-${pr.date}-${pr.weight}-${i}`}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
          >
            <div>
              <p className="font-medium text-white/90">{pr.exerciseName}</p>
              <p className="font-mono text-[10px] text-white/50">{pr.date}</p>
            </div>
            <div className="text-right">
              <p className="font-mono font-semibold text-orange-light">{pr.weight} lbs</p>
              {pr.previousWeight != null ? (
                <p className="font-mono text-[10px] text-emerald-400/80">
                  +{pr.weight - pr.previousWeight} lbs
                </p>
              ) : (
                <p className="font-mono text-[10px] text-white/50">First PR</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PRFeed;
