import { describe, expect, it } from 'vitest';
import type { WorkoutLog } from '@/types';
import type { DailyCheckInFormState } from '@/lib/readiness-daily-check-in';
import {
  computeReadinessFit,
  focusAreaToMuscleGroup,
  metToRequiredEnergyLevel,
  stressIdealForMet,
} from './readiness-fit';

function baseForm(over: Partial<DailyCheckInFormState> = {}): DailyCheckInFormState {
  return {
    energy_level: 8,
    sleep_quality: 8,
    sleep_hours: 8,
    stress_level: 2,
    motivation_level: 8,
    soreness_areas: [],
    muscle_group_focus: [],
    current_location: 'home',
    available_time: null,
    weather_condition: null,
    temperature: null,
    cycle_phase: null,
    cycle_symptoms: null,
    data_source: 'manual',
    ...over,
  };
}

function baseWorkout(over: Partial<WorkoutLog> = {}): WorkoutLog {
  return {
    id: '1',
    userId: 'u1',
    workoutName: 'HIIT',
    date: '2025-06-01',
    effort: 7,
    rating: 4,
    notes: '',
    durationSeconds: 45 * 60,
    source: 'hiit',
    workoutFormat: 'HIIT',
    focusArea: 'legs',
    ...over,
  };
}

describe('readiness-fit helpers', () => {
  it('metToRequiredEnergyLevel rises with MET', () => {
    expect(metToRequiredEnergyLevel(3)).toBeLessThan(metToRequiredEnergyLevel(9));
  });

  it('stressIdealForMet drops as MET rises (harder session expects lower stress)', () => {
    expect(stressIdealForMet(3)).toBeGreaterThan(stressIdealForMet(9));
  });

  it('focusAreaToMuscleGroup maps common strings', () => {
    expect(focusAreaToMuscleGroup('Leg day — quads')).toBe('legs');
    expect(focusAreaToMuscleGroup('Shoulders')).toBe('shoulders');
  });
});

describe('computeReadinessFit', () => {
  it('penalizes high soreness in the session focus muscle', () => {
    const lowSoreness = computeReadinessFit(
      baseForm({
        soreness_areas: [{ area: 'legs', level: 2 }],
        muscle_group_focus: [{ area: 'legs', percentage: 80, locked: false }],
      }),
      baseWorkout({ focusArea: 'legs' })
    );
    const highSoreness = computeReadinessFit(
      baseForm({
        soreness_areas: [{ area: 'legs', level: 9 }],
        muscle_group_focus: [{ area: 'legs', percentage: 80, locked: false }],
      }),
      baseWorkout({ focusArea: 'legs' })
    );
    expect(highSoreness.soreness).toBeLessThan(lowSoreness.soreness);
  });

  it('focus fit tracks muscle_group_focus percentage for session focus area', () => {
    const a = computeReadinessFit(
      baseForm({
        muscle_group_focus: [{ area: 'legs', percentage: 80, locked: false }],
      }),
      baseWorkout({ focusArea: 'legs' })
    );
    const b = computeReadinessFit(
      baseForm({
        muscle_group_focus: [{ area: 'legs', percentage: 20, locked: false }],
      }),
      baseWorkout({ focusArea: 'legs' })
    );
    expect(a.focus).toBeGreaterThan(b.focus);
    expect(a.focus).toBe(80);
    expect(b.focus).toBe(20);
  });

  it('overall is the weighted average of six factors (equal weights)', () => {
    const fit = computeReadinessFit(baseForm(), baseWorkout());
    const expected = Math.round(
      (fit.energy + fit.sleepQuality + fit.stress + fit.motivation + fit.soreness + fit.focus) / 6
    );
    expect(fit.overall).toBe(expected);
  });

  it('high stress with high-MET session lowers stress fit vs low stress', () => {
    const hiit = baseWorkout({ source: 'hiit' });
    const goodStress = computeReadinessFit(baseForm({ stress_level: 2 }), hiit);
    const badStress = computeReadinessFit(baseForm({ stress_level: 10 }), hiit);
    expect(goodStress.stress).toBeGreaterThan(badStress.stress);
  });
});
