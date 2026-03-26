/**
 * Shared percent-to-color ramp for goal progress visuals.
 */

function clampGoal(goal: number): number {
  return Math.max(1, goal);
}

export function getProgressPercent(value: number, goal: number): number {
  return (value / clampGoal(goal)) * 100;
}

export function getProgressTextColorClass(percent: number): string {
  if (percent < 20) return 'text-red-700';
  if (percent < 40) return 'text-red-500';
  if (percent < 60) return 'text-orange-500';
  if (percent < 80) return 'text-amber-400';
  if (percent < 100) return 'text-emerald-300';
  return 'text-emerald-400';
}

export function getProgressBgColorClass(percent: number): string {
  if (percent < 20) return 'bg-red-700';
  if (percent < 40) return 'bg-red-500';
  if (percent < 60) return 'bg-orange-500';
  if (percent < 80) return 'bg-amber-400';
  if (percent < 100) return 'bg-emerald-300';
  return 'bg-emerald-400';
}

export function getProgressSoftBgColorClass(percent: number): string {
  if (percent < 20) return 'bg-red-700/80';
  if (percent < 40) return 'bg-red-500/80';
  if (percent < 60) return 'bg-orange-500/80';
  if (percent < 80) return 'bg-amber-400/80';
  if (percent < 100) return 'bg-emerald-300/80';
  return 'bg-emerald-400/80';
}

export function getProgressTextColorClassForValue(value: number, goal: number): string {
  return getProgressTextColorClass(getProgressPercent(value, goal));
}

export function getProgressBgColorClassForValue(value: number, goal: number): string {
  return getProgressBgColorClass(getProgressPercent(value, goal));
}

export function getProgressSoftBgColorClassForValue(value: number, goal: number): string {
  return getProgressSoftBgColorClass(getProgressPercent(value, goal));
}
