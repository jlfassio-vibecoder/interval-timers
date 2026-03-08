/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Public program catalog: filterable grid of published programs.
 */

import React, { useState, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import FormattedMarkdown from '@/components/react/FormattedMarkdown';
import type { ProgramMetadata } from '@/types/ai-program';

export interface ProgramCatalogProps {
  availablePrograms: (ProgramMetadata & { id: string })[];
  /** Serializable zone list for filter labels and card tags (id -> name) */
  zones?: { id: string; name: string }[];
}

const GOAL_OPTIONS = [
  { value: '', label: 'All levels' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
] as const;

const ProgramCatalog: React.FC<ProgramCatalogProps> = ({ availablePrograms, zones = [] }) => {
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

  const filteredPrograms = useMemo(() => {
    return availablePrograms.filter((program) => {
      if (selectedZone && program.equipmentProfile?.zoneId !== selectedZone) {
        return false;
      }
      if (selectedGoal && program.targetAudience?.experienceLevel !== selectedGoal) {
        return false;
      }
      return true;
    });
  }, [availablePrograms, selectedZone, selectedGoal]);

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
      <h1 className="mb-8 font-heading text-3xl font-bold text-white md:text-4xl">
        Program Showroom
      </h1>

      {/* Filter bar */}
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
          <span className="text-sm font-medium text-white/70">Goal:</span>
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

      {/* Grid */}
      {filteredPrograms.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-black/20 p-12 text-center backdrop-blur-sm">
          <p className="text-white/60">
            No programs match your filters. Try changing equipment or goal.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPrograms.map((program) => (
            <article
              key={program.id}
              className="hover:border-orange-light/30 flex flex-col rounded-xl border border-white/10 bg-black/20 p-5 backdrop-blur-sm transition hover:bg-black/30"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <h2 className="line-clamp-2 font-heading text-lg font-bold text-white">
                  {program.title || 'Untitled Program'}
                </h2>
                <span className="bg-orange-light/20 shrink-0 rounded px-2 py-0.5 text-xs font-medium text-orange-light">
                  {program.durationWeeks} Weeks
                </span>
              </div>
              <div className="mb-4 line-clamp-2 text-sm text-white/70">
                <FormattedMarkdown content={program.description || 'No description.'} />
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/80">
                  {getZoneName(program.equipmentProfile?.zoneId)}
                </span>
                <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/80">
                  {getGoalLabel(program.targetAudience?.experienceLevel)}
                </span>
              </div>
              <div className="mt-auto">
                <a
                  href={`/programs/${program.id}`}
                  className="inline-flex items-center gap-1 rounded-lg bg-orange-light px-4 py-2 text-sm font-bold uppercase tracking-wider text-black transition hover:bg-white"
                >
                  View Program
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

export default ProgramCatalog;
