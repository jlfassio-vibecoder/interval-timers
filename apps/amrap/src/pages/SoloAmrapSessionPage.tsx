/**
 * Solo AMRAP session page. Renders AmrapSessionShell with useSoloAmrap.
 * Workout config from route state or query params.
 */
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useSoloAmrap } from '@/hooks/useSoloAmrap';
import AmrapSessionShell from '@/components/amrap-session/AmrapSessionShell';

function parseWorkoutFromSearch(searchParams: URLSearchParams): string[] {
  const workout = searchParams.getAll('workout');
  if (workout.length > 0) return workout;
  return [];
}

const DEFAULT_DURATION = 15;
const MIN_DURATION = 1;
const MAX_DURATION = 120;

function clampDuration(value: number | undefined | null): number {
  if (value == null || typeof value !== 'number' || isNaN(value)) return DEFAULT_DURATION;
  if (value >= MIN_DURATION && value <= MAX_DURATION) return Math.floor(value);
  return DEFAULT_DURATION;
}

function parseDurationFromSearch(searchParams: URLSearchParams): number {
  const d = searchParams.get('duration');
  if (d) {
    const n = parseInt(d, 10);
    if (!isNaN(n) && n >= MIN_DURATION && n <= MAX_DURATION) return n;
  }
  return DEFAULT_DURATION;
}

export default function SoloAmrapSessionPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const state = location.state as
    | { durationMinutes?: number; workoutList?: string[] }
    | undefined;

  const durationMinutes =
    state?.durationMinutes != null
      ? clampDuration(state.durationMinutes)
      : parseDurationFromSearch(searchParams);
  const workoutList = state?.workoutList ?? parseWorkoutFromSearch(searchParams);

  const engine = useSoloAmrap({
    durationMinutes,
    workoutList,
  });

  return (
    <div className="min-h-screen bg-[#0d0500] text-white">
      <div className="px-4 py-4">
        <Link
          to="/"
          className="inline-block text-sm font-bold text-white/70 hover:text-orange-400"
        >
          ← Exit session
        </Link>
      </div>
      <AmrapSessionShell engine={engine} />
    </div>
  );
}
