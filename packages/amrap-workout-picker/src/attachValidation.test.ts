import { describe, expect, it } from 'vitest';
import { isValidAttachWorkoutInput } from './attachValidation';

describe('isValidAttachWorkoutInput', () => {
  it('accepts preset-like list and duration', () => {
    expect(isValidAttachWorkoutInput(15, ['10 squats'])).toBe(true);
  });

  it('rejects empty workout list', () => {
    expect(isValidAttachWorkoutInput(15, [])).toBe(false);
  });

  it('rejects duration out of range', () => {
    expect(isValidAttachWorkoutInput(0, ['a'])).toBe(false);
    expect(isValidAttachWorkoutInput(181, ['a'])).toBe(false);
  });

  it('rejects non-string entries', () => {
    expect(isValidAttachWorkoutInput(10, ['a', 'b'])).toBe(true);
    expect(isValidAttachWorkoutInput(10, ['a', 1] as unknown as string[])).toBe(false);
  });
});
