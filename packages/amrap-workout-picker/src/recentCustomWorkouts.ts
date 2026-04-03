/**
 * Recent custom AMRAP workouts (Build Your Workout) stored in localStorage.
 * Used for quick relaunch from the builder step.
 */

const STORAGE_KEY = 'amrap_recent_custom_workouts';
const MAX_ENTRIES = 5;

export interface RecentCustomWorkout {
  durationMinutes: number;
  workoutList: string[];
  completedAt: string;
}

function getStored(): RecentCustomWorkout[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is RecentCustomWorkout =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as RecentCustomWorkout).durationMinutes === 'number' &&
        Array.isArray((item as RecentCustomWorkout).workoutList) &&
        typeof (item as RecentCustomWorkout).completedAt === 'string'
    );
  } catch {
    return [];
  }
}

function setStored(results: RecentCustomWorkout[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(results.slice(0, MAX_ENTRIES)));
  } catch {
    /* localStorage unavailable or full */
  }
}

export function saveRecentCustomWorkout(
  durationMinutes: number,
  workoutList: string[]
): void {
  const list = getStored();
  const entry: RecentCustomWorkout = {
    durationMinutes,
    workoutList,
    completedAt: new Date().toISOString(),
  };
  list.unshift(entry);
  setStored(list);
}

export function getRecentCustomWorkouts(): RecentCustomWorkout[] {
  return getStored();
}
