export const MUSCLE_GROUPS = ['legs', 'chest', 'back', 'shoulders', 'arms', 'core'] as const;

export type MuscleGroupArea = (typeof MUSCLE_GROUPS)[number];

export type LocationType = 'home' | 'gym' | 'outdoor' | 'hotel' | 'office' | 'other';
export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';

export interface SorenessArea {
  area: MuscleGroupArea;
  level: number;
}

export interface MuscleGroupFocus {
  area: MuscleGroupArea;
  percentage: number;
  locked: boolean;
}

export interface DailyCheckInFormState {
  energy_level: number;
  sleep_quality: number;
  sleep_hours: number | null;
  stress_level: number;
  motivation_level: number;
  soreness_areas: SorenessArea[];
  muscle_group_focus: MuscleGroupFocus[];
  current_location: LocationType;
  available_time: number | null;
  weather_condition: string | null;
  temperature: number | null;
  cycle_phase: CyclePhase | null;
  cycle_symptoms: string[] | null;
  data_source: 'manual';
}

export const DEFAULT_DAILY_CHECKIN: DailyCheckInFormState = {
  energy_level: 6,
  sleep_quality: 6,
  sleep_hours: null,
  stress_level: 4,
  motivation_level: 6,
  soreness_areas: [],
  muscle_group_focus: [],
  current_location: 'home',
  available_time: null,
  weather_condition: null,
  temperature: null,
  cycle_phase: null,
  cycle_symptoms: null,
  data_source: 'manual',
};

export const LOCATION_OPTIONS: Array<{ value: LocationType; label: string }> = [
  { value: 'home', label: 'Home' },
  { value: 'gym', label: 'Gym' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'office', label: 'Office' },
  { value: 'other', label: 'Other' },
];

export const CYCLE_PHASE_OPTIONS: Array<{ value: CyclePhase; label: string }> = [
  { value: 'menstrual', label: 'Menstrual' },
  { value: 'follicular', label: 'Follicular' },
  { value: 'ovulation', label: 'Ovulation' },
  { value: 'luteal', label: 'Luteal' },
];

export function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function getSorenessLevel(areas: SorenessArea[], area: MuscleGroupArea): number | null {
  return areas.find((a) => a.area === area)?.level ?? null;
}

export function setSorenessLevel(
  areas: SorenessArea[],
  area: MuscleGroupArea,
  level: number
): SorenessArea[] {
  const next = areas.filter((a) => a.area !== area);
  next.push({ area, level: clampInt(level, 1, 10) });
  return next;
}

export function removeSorenessArea(areas: SorenessArea[], area: MuscleGroupArea): SorenessArea[] {
  return areas.filter((a) => a.area !== area);
}

export function getMuscleGroupFocus(
  groups: MuscleGroupFocus[],
  area: MuscleGroupArea
): MuscleGroupFocus | null {
  return groups.find((g) => g.area === area) ?? null;
}

function redistributePercentages(groups: MuscleGroupFocus[]): MuscleGroupFocus[] {
  if (groups.length === 0) return [];

  const lockedGroups = groups.filter((g) => g.locked);
  const unlockedGroups = groups.filter((g) => !g.locked);
  const lockedTotal = lockedGroups.reduce((sum, g) => sum + g.percentage, 0);
  const remaining = Math.max(0, 100 - lockedTotal);

  if (unlockedGroups.length === 0) return groups;

  const perUnlocked = Math.floor(remaining / unlockedGroups.length);
  const remainder = remaining - perUnlocked * unlockedGroups.length;
  const redistributedUnlocked = unlockedGroups.map((g, idx) => ({
    ...g,
    percentage: idx === unlockedGroups.length - 1 ? perUnlocked + remainder : perUnlocked,
  }));

  return groups.map((g) => {
    if (g.locked) return g;
    const redistributed = redistributedUnlocked.find((r) => r.area === g.area);
    return redistributed ?? g;
  });
}

export function addMuscleGroupFocus(
  groups: MuscleGroupFocus[],
  area: MuscleGroupArea
): MuscleGroupFocus[] {
  if (groups.some((g) => g.area === area)) return groups;
  return redistributePercentages([...groups, { area, percentage: 0, locked: false }]);
}

export function removeMuscleGroupFocus(
  groups: MuscleGroupFocus[],
  area: MuscleGroupArea
): MuscleGroupFocus[] {
  const filtered = groups.filter((g) => g.area !== area);
  if (filtered.length === 0) return [];
  return redistributePercentages(filtered.map((g) => ({ ...g, locked: false })));
}

export function setMuscleGroupPercentage(
  groups: MuscleGroupFocus[],
  area: MuscleGroupArea,
  newPercentage: number
): MuscleGroupFocus[] {
  const clampedPercentage = Math.max(0, Math.min(100, Math.round(newPercentage)));
  const otherLockedTotal = groups
    .filter((g) => g.locked && g.area !== area)
    .reduce((sum, g) => sum + (g.percentage ?? 0), 0);
  const remainingAvailable = Math.max(0, 100 - otherLockedTotal);
  const effectivePercentage = Math.min(clampedPercentage, remainingAvailable);

  const updated = groups.map((g) =>
    g.area === area ? { ...g, percentage: effectivePercentage, locked: true } : g
  );
  return redistributePercentages(updated);
}

export function isLastUnlockedGroup(groups: MuscleGroupFocus[], area: MuscleGroupArea): boolean {
  const unlockedGroups = groups.filter((g) => !g.locked);
  return unlockedGroups.length === 1 && unlockedGroups[0]?.area === area;
}
