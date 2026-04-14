import { describe, expect, it } from 'vitest';
import {
  parseCommaSeparatedEquipmentLabels,
  mergeEquipmentDedupe,
  isBodyweightOnlyEquipment,
} from '@/lib/workout-chain/merge-equipment-lists';

describe('merge-equipment-lists', () => {
  it('parseCommaSeparatedEquipmentLabels trims and drops empties', () => {
    expect(parseCommaSeparatedEquipmentLabels(' A ,, B , ')).toEqual(['A', 'B']);
    expect(parseCommaSeparatedEquipmentLabels(undefined)).toEqual([]);
    expect(parseCommaSeparatedEquipmentLabels('')).toEqual([]);
  });

  it('mergeEquipmentDedupe is case-insensitive and preserves first casing', () => {
    expect(mergeEquipmentDedupe(['Kettlebell'], ['kettlebell', 'Bands'])).toEqual([
      'Kettlebell',
      'Bands',
    ]);
    expect(mergeEquipmentDedupe(['Bodyweight'], [])).toEqual(['Bodyweight']);
  });

  it('isBodyweightOnlyEquipment', () => {
    expect(isBodyweightOnlyEquipment(['Bodyweight'])).toBe(true);
    expect(isBodyweightOnlyEquipment(['bodyweight'])).toBe(true);
    expect(isBodyweightOnlyEquipment(['Kettlebell'])).toBe(false);
    expect(isBodyweightOnlyEquipment(['Bodyweight', 'Band'])).toBe(false);
  });
});
