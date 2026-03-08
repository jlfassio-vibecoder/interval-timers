/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Kinetic Prescription Engine: biometric tuner that scores and ranks programs in real time.
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, SlidersHorizontal } from 'lucide-react';
import type { ProgramMetadata } from '@/types/ai-program';
import type { UserBiometrics, ScoredProgram, ProgramMetadataForScoring } from '@/types/matching';
import { scoreAndSortPrograms } from '@/lib/matching-logic';
import GridCard, { DEFAULT_PROGRAM_IMAGE } from '@/components/react/GridCard';
import Drawer from '@/components/react/Drawer';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import PrescriptionVitalsSidebar from './PrescriptionVitalsSidebar';

/** Gold at 100% match, dark red at 0%. Linear RGB interpolation. */
function matchScoreToColor(score: number): string {
  if (score >= 100) return '#ffbf00';
  if (score <= 0) return '#7f1d1d';
  const t = score / 100;
  const r = Math.round(127 + (255 - 127) * t);
  const g = Math.round(29 + (191 - 29) * t);
  const b = Math.round(29 + (0 - 29) * t);
  return `rgb(${r},${g},${b})`;
}

export interface ProgramPrescriptionEngineProps {
  availablePrograms: (ProgramMetadata & { id: string })[];
  zones?: { id: string; name: string }[];
}

const DEFAULT_BIOMETRICS: UserBiometrics = {
  zoneId: '',
  daysPerWeek: 4,
  experience: 'intermediate',
  injuries: [],
  goals: [],
  durationWeeksFilter: [],
};

function MatchRing({ score, size = 48 }: { score: number; size?: number }) {
  const r = (size - 4) / 2;
  const circumference = 2 * Math.PI * r;
  const stroke = 4;
  const offset = circumference - (score / 100) * circumference;
  const strokeColor = matchScoreToColor(score);
  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute font-mono text-xs font-bold text-white">{score}%</span>
    </div>
  );
}

function PrescriptionCard({
  program,
  zonesMap,
  isTopMatch,
}: {
  program: ScoredProgram;
  zonesMap: Map<string, string>;
  isTopMatch: boolean;
}) {
  const zoneName = program.equipmentProfile?.zoneId
    ? (zonesMap.get(program.equipmentProfile.zoneId) ?? program.equipmentProfile.zoneId)
    : '—';
  const level = program.targetAudience?.experienceLevel ?? program.difficulty ?? '—';

  return (
    <article
      className={`flex flex-col rounded-3xl border p-[2px] shadow-2xl backdrop-blur-sm transition ${
        isTopMatch
          ? 'border-orange-light/60 bg-orange-light/10'
          : program.matchScore >= 50
            ? 'hover:border-orange-light/30 border-white/10 bg-black/20 hover:bg-black/30'
            : 'border-white/5 bg-black/10 opacity-75'
      } ${program.matchScore < 30 ? 'grayscale' : ''}`}
    >
      {/* GridCard = only the header card; sits 2px inside main card border */}
      <GridCard
        headerImage={program.image ?? DEFAULT_PROGRAM_IMAGE}
        headerImageAlt={program.title ?? 'Program'}
        className="border-orange-light/40"
        headerContent={
          <>
            <div className="min-w-0 flex-1">
              <h2 className="line-clamp-2 font-heading text-lg font-bold text-white">
                {program.title || 'Untitled Program'}
              </h2>
              {isTopMatch && (
                <p className="mt-1 font-mono text-xs uppercase tracking-wider text-orange-light">
                  Dr. Kinetics Prescribes…
                </p>
              )}
            </div>
            <MatchRing score={program.matchScore} size={52} />
          </>
        }
      />

      {/* Body: not part of GridCard */}
      <div className="flex flex-1 flex-col p-5">
        <p className="mb-4 line-clamp-2 text-sm text-white/70">
          {program.description || 'No description.'}
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/80">{zoneName}</span>
          <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/80">
            {String(level).charAt(0).toUpperCase() + String(level).slice(1)}
          </span>
          <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/80">
            {program.durationWeeks} Weeks
          </span>
        </div>

        {/* Live Match Feed (in card) */}
        {program.componentScores && (
          <div className="mb-4 space-y-3 rounded-lg border border-white/10 bg-white/5 p-3">
            <h4 className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
              Live Match Feed
            </h4>
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
              <span>{zoneName}</span>
              <span className="text-white/40">·</span>
              <span className="capitalize">{String(level)}</span>
              <span className="text-white/40">·</span>
              <span>{program.durationWeeks} Weeks</span>
            </div>
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase text-white/50">Equipment</span>
                  <span className="font-bold text-orange-light">
                    {program.componentScores.equipment}%
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full bg-orange-light"
                    initial={false}
                    animate={{ width: `${program.componentScores.equipment}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase text-white/50">Experience</span>
                  <span className="font-bold text-orange-light">
                    {program.componentScores.experience}%
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full bg-orange-light"
                    initial={false}
                    animate={{ width: `${program.componentScores.experience}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase text-white/50">Overall</span>
                  <span
                    className="font-bold"
                    style={{ color: matchScoreToColor(program.matchScore) }}
                  >
                    {program.matchScore}%
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full transition-colors duration-300"
                    style={{ backgroundColor: matchScoreToColor(program.matchScore) }}
                    initial={false}
                    animate={{ width: `${program.matchScore}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            </div>
            {program.matchReasons.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {program.matchReasons.slice(0, 4).map((reason) => (
                  <span
                    key={reason}
                    className="inline-flex items-center gap-1 rounded bg-green-500/20 px-2 py-0.5 text-xs text-green-300"
                  >
                    ✓ {reason}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {!program.componentScores && program.matchReasons.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {program.matchReasons.slice(0, 4).map((reason) => (
              <span
                key={reason}
                className="inline-flex items-center gap-1 rounded bg-green-500/20 px-2 py-0.5 text-xs text-green-300"
              >
                ✓ {reason}
              </span>
            ))}
          </div>
        )}
        <div className="mt-auto">
          <a
            href={`/programs/${program.id}`}
            className="inline-flex items-center gap-1 rounded-lg bg-orange-light px-4 py-2 text-sm font-bold uppercase tracking-wider text-black transition hover:bg-white"
          >
            View Program
            <ChevronRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </article>
  );
}

const ProgramPrescriptionEngine: React.FC<ProgramPrescriptionEngineProps> = ({
  availablePrograms,
  zones = [],
}) => {
  const [biometrics, setBiometrics] = useState<UserBiometrics>(DEFAULT_BIOMETRICS);
  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const zonesMap = useMemo(() => {
    const m = new Map<string, string>();
    zones.forEach((z) => m.set(z.id, z.name));
    return m;
  }, [zones]);

  const programsForScoring: ProgramMetadataForScoring[] = useMemo(
    () =>
      availablePrograms.map((p) => ({
        ...p,
        id: p.id,
        workoutsPerWeek: undefined,
        tags: undefined,
      })),
    [availablePrograms]
  );

  const scoredPrograms = useMemo(
    () => scoreAndSortPrograms(programsForScoring, biometrics),
    [programsForScoring, biometrics]
  );

  const isAnyExperience = biometrics.experience === 'any';
  const topMatch = isAnyExperience ? null : (scoredPrograms[0] ?? null);
  const alternatives = isAnyExperience ? scoredPrograms : scoredPrograms.slice(1);
  const lowMatchThreshold = 30;

  const setZone = (zoneId: string) => setBiometrics((b) => ({ ...b, zoneId }));
  const setDaysPerWeek = (daysPerWeek: number) => setBiometrics((b) => ({ ...b, daysPerWeek }));
  const setExperience = (experience: UserBiometrics['experience']) =>
    setBiometrics((b) => ({ ...b, experience }));
  const toggleInjury = (id: string) => {
    setBiometrics((b) => {
      const next = b.injuries.includes(id)
        ? b.injuries.filter((i) => i !== id)
        : [...b.injuries, id];
      return { ...b, injuries: next };
    });
  };
  const toggleGoal = (id: string) => {
    setBiometrics((b) => {
      const current = b.goals ?? [];
      const next = current.includes(id) ? current.filter((g) => g !== id) : [...current, id];
      return { ...b, goals: next };
    });
  };
  const toggleWeek = (weeks: number) => {
    setBiometrics((b) => {
      const current = b.durationWeeksFilter ?? [];
      const next = current.includes(weeks)
        ? current.filter((w) => w !== weeks)
        : [...current, weeks];
      return { ...b, durationWeeksFilter: next };
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="mb-2 font-heading text-3xl font-bold text-white md:text-4xl">
            Kinetic Prescription Engine
          </h1>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-light">
            Tune your inputs — we rank protocols in real time
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {!isDesktop && (
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="border-orange-light/50 bg-orange-light/20 hover:bg-orange-light/30 inline-flex items-center gap-2 rounded-full border px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest text-orange-light transition-all"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </button>
          )}
          <a
            href="/"
            className="rounded-full border border-white/10 bg-white/5 px-8 py-3 font-mono text-xs font-bold uppercase tracking-widest transition-all hover:bg-white/20"
          >
            Terminate Session
          </a>
        </div>
      </div>

      {!isDesktop && (
        <Drawer isOpen={filtersOpen} onClose={() => setFiltersOpen(false)} title="Your Vitals">
          <PrescriptionVitalsSidebar
            zones={zones}
            selectedZone={biometrics.zoneId}
            onZoneChange={setZone}
            selectedExperience={biometrics.experience}
            onExperienceChange={setExperience}
            injuries={biometrics.injuries}
            onToggleInjury={toggleInjury}
            goals={biometrics.goals ?? []}
            onToggleGoal={toggleGoal}
            daysPerWeek={biometrics.daysPerWeek}
            onDaysPerWeekChange={setDaysPerWeek}
            selectedWeeks={biometrics.durationWeeksFilter ?? []}
            onToggleWeek={toggleWeek}
            disclaimerAcknowledged={disclaimerAcknowledged}
            onDisclaimerAcknowledge={() => setDisclaimerAcknowledged(true)}
          />
        </Drawer>
      )}

      <div className={isDesktop ? 'grid gap-10 lg:grid-cols-[320px_1fr]' : ''}>
        {isDesktop && (
          <PrescriptionVitalsSidebar
            zones={zones}
            selectedZone={biometrics.zoneId}
            onZoneChange={setZone}
            selectedExperience={biometrics.experience}
            onExperienceChange={setExperience}
            injuries={biometrics.injuries}
            onToggleInjury={toggleInjury}
            goals={biometrics.goals ?? []}
            onToggleGoal={toggleGoal}
            daysPerWeek={biometrics.daysPerWeek}
            onDaysPerWeekChange={setDaysPerWeek}
            selectedWeeks={biometrics.durationWeeksFilter ?? []}
            onToggleWeek={toggleWeek}
            disclaimerAcknowledged={disclaimerAcknowledged}
            onDisclaimerAcknowledge={() => setDisclaimerAcknowledged(true)}
          />
        )}

        {/* Right: Prescription Feed */}
        <div className="min-w-0 space-y-6">
          {scoredPrograms.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-12 text-center backdrop-blur-sm">
              <p className="text-white/60">No programs available. Publish programs in admin.</p>
            </div>
          ) : isAnyExperience ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {alternatives.map((program) => (
                <PrescriptionCard
                  key={program.id}
                  program={program}
                  zonesMap={zonesMap}
                  isTopMatch={false}
                />
              ))}
            </div>
          ) : (
            <>
              {topMatch && (
                <div className="border-orange-light/30 rounded-xl border bg-black/20 p-4">
                  <PrescriptionCard program={topMatch} zonesMap={zonesMap} isTopMatch />
                </div>
              )}
              <div>
                <h2 className="mb-3 font-heading text-sm font-bold uppercase tracking-wider text-white/80">
                  Alternatives
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {alternatives
                    .filter((p) => p.matchScore >= lowMatchThreshold)
                    .map((program) => (
                      <PrescriptionCard
                        key={program.id}
                        program={program}
                        zonesMap={zonesMap}
                        isTopMatch={false}
                      />
                    ))}
                </div>
              </div>
              {alternatives.some((p) => p.matchScore < lowMatchThreshold) && (
                <div>
                  <h2 className="mb-3 font-heading text-xs font-bold uppercase tracking-wider text-white/50">
                    Lower match
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {alternatives
                      .filter((p) => p.matchScore < lowMatchThreshold)
                      .map((program) => (
                        <PrescriptionCard
                          key={program.id}
                          program={program}
                          zonesMap={zonesMap}
                          isTopMatch={false}
                        />
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProgramPrescriptionEngine;
