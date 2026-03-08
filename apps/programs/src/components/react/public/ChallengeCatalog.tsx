/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Public challenge catalog: filterable grid of published challenges.
 */

import React, { useState, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import FormattedMarkdown from '@/components/react/FormattedMarkdown';
import type { ChallengeLibraryItem } from '@/types/ai-challenge';

export interface ChallengeCatalogProps {
  availableChallenges: ChallengeLibraryItem[];
  zones?: { id: string; name: string }[];
}

const GOAL_OPTIONS = [
  { value: '', label: 'All levels' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
] as const;

const ChallengeCatalog: React.FC<ChallengeCatalogProps> = ({ availableChallenges, zones = [] }) => {
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [selectedGoal, setSelectedGoal] = useState<string>('');

  const zonesMap = useMemo(() => {
    const m = new Map<string, string>();
    zones.forEach((z) => m.set(z.id, z.name));
    return m;
  }, [zones]);

  const zoneOptions = useMemo(() => {
    const options = [{ value: '', label: 'All equipment' }];
    zones.forEach((z) => options.push({ value: z.id, label: z.name }));
    return options;
  }, [zones]);

  const filteredChallenges = useMemo(() => {
    return availableChallenges.filter((challenge) => {
      if (selectedZone && challenge.equipmentProfile?.zoneId !== selectedZone) {
        return false;
      }
      if (selectedGoal && challenge.targetAudience?.experienceLevel !== selectedGoal) {
        return false;
      }
      return true;
    });
  }, [availableChallenges, selectedZone, selectedGoal]);

  const getZoneName = (zoneId: string | undefined): string => {
    if (!zoneId) return '—';
    return zonesMap.get(zoneId) ?? zoneId;
  };

  const getGoalLabel = (level: string | undefined): string => {
    if (!level) return '—';
    const opt = GOAL_OPTIONS.find((o) => o.value === level);
    return opt?.label ?? level;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="mb-2 font-heading text-3xl font-bold text-white md:text-4xl">
            Challenge Catalog
          </h1>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-light">
            Filter by equipment and level
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <a
            href="/"
            className="rounded-full border border-white/10 bg-white/5 px-8 py-3 font-mono text-xs font-bold uppercase tracking-widest transition-all hover:bg-white/20"
          >
            Terminate Session
          </a>
        </div>
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/70">Equipment:</span>
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="focus:border-orange-light/50 focus:ring-orange-light/20 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white focus:outline-none focus:ring-2"
          >
            {zoneOptions.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/70">Level:</span>
          <select
            value={selectedGoal}
            onChange={(e) => setSelectedGoal(e.target.value)}
            className="focus:border-orange-light/50 focus:ring-orange-light/20 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white focus:outline-none focus:ring-2"
          >
            {GOAL_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredChallenges.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-black/20 p-12 text-center backdrop-blur-sm">
          <p className="text-white/60">
            No challenges match your filters. Try changing equipment or level.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredChallenges.map((challenge) => (
            <article
              key={challenge.id}
              className="hover:border-orange-light/30 flex flex-col rounded-xl border border-white/10 bg-black/20 p-5 backdrop-blur-sm transition hover:bg-black/30"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <h2 className="line-clamp-2 font-heading text-lg font-bold text-white">
                  {challenge.title || 'Untitled Challenge'}
                </h2>
                <span className="bg-orange-light/20 shrink-0 rounded px-2 py-0.5 text-xs font-medium text-orange-light">
                  {challenge.durationWeeks} Weeks
                </span>
              </div>
              {challenge.theme && (
                <span className="mb-2 inline-block rounded bg-white/10 px-2 py-0.5 text-xs text-orange-light">
                  {challenge.theme}
                </span>
              )}
              <div className="mb-4 line-clamp-2 text-sm text-white/70">
                <FormattedMarkdown content={challenge.description || 'No description.'} />
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/80">
                  {getZoneName(challenge.equipmentProfile?.zoneId)}
                </span>
                <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/80">
                  {getGoalLabel(challenge.targetAudience?.experienceLevel)}
                </span>
              </div>
              <div className="mt-auto">
                <a
                  href={`/challenges/${challenge.id}`}
                  className="inline-flex items-center gap-1 rounded-lg bg-orange-light px-4 py-2 text-sm font-bold uppercase tracking-wider text-black transition hover:bg-white"
                >
                  View Challenge
                  <ChevronRight className="h-4 w-4" />
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChallengeCatalog;
