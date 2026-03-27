import { describe, expect, it } from 'vitest';
import { getAmrapSessionDisplayTitle } from './amrap-preset-name';

const LINEAR_CIRCUIT = [
  '10 Air Squats',
  '5 Incline Push-Ups (hands on table or chair)',
  '15 Marching Steps in place',
];

describe('getAmrapSessionDisplayTitle', () => {
  it('prefers library preset over DB workout_name that duplicates first exercise', () => {
    expect(getAmrapSessionDisplayTitle('10 Air Squats', LINEAR_CIRCUIT)).toBe('The Linear Circuit');
  });

  it('uses AMRAP With Friends when there is no preset and workout_name matches first exercise', () => {
    expect(getAmrapSessionDisplayTitle('10 Burpees', ['10 Burpees', '15 Air Squats'])).toBe(
      'AMRAP With Friends'
    );
  });

  it('keeps a distinct workout_name as a custom title', () => {
    expect(getAmrapSessionDisplayTitle('Coach WOD A', ['10 Burpees', '10 Squats'])).toBe(
      'Coach WOD A'
    );
  });
});
