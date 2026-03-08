/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Overload protocol types for WOD iteration.
 * Used to progressively overload workouts using science-backed protocols.
 */

/**
 * Available overload protocols for WOD iteration.
 * - linear_load: Add weight, keep reps static (best for barbell compounds)
 * - double_progression: Add reps until max range, then increase weight (best for hypertrophy)
 * - density_leverage: Reduce rest or use harder variations (best for bodyweight)
 */
export type OverloadProtocol = 'linear_load' | 'double_progression' | 'density_leverage';

/**
 * Configuration for an overload protocol including display info and progression logic.
 */
export interface OverloadProtocolConfig {
  id: OverloadProtocol;
  name: string;
  shortName: string;
  description: string;
  bestFor: string[];
  progressionLogic: string;
  icon: 'weight' | 'trending-up' | 'zap';
}

/**
 * All available overload protocols with their configurations.
 */
export const OVERLOAD_PROTOCOLS: Record<OverloadProtocol, OverloadProtocolConfig> = {
  linear_load: {
    id: 'linear_load',
    name: 'Linear Load',
    shortName: 'Load',
    description: 'Add 2-5% weight, keep reps static',
    bestFor: ['Barbell compounds', 'Strength focus'],
    progressionLogic: 'Increase weight while maintaining rep scheme',
    icon: 'weight',
  },
  double_progression: {
    id: 'double_progression',
    name: 'Double Progression',
    shortName: 'Reps',
    description: 'Add reps until max range, then increase weight',
    bestFor: ['Hypertrophy', 'Dumbbells', 'Machines'],
    progressionLogic:
      'Add 1-2 reps per set until hitting upper range, then increase weight and reset reps',
    icon: 'trending-up',
  },
  density_leverage: {
    id: 'density_leverage',
    name: 'Density & Leverage',
    shortName: 'Density',
    description: 'Reduce rest or use harder exercise variations',
    bestFor: ['Bodyweight', 'Calisthenics', 'Conditioning'],
    progressionLogic:
      'Reduce rest periods, increase time under tension, or progress to harder exercise variations',
    icon: 'zap',
  },
};

/**
 * Get all protocol configurations as an array.
 */
export function getAllProtocols(): OverloadProtocolConfig[] {
  return Object.values(OVERLOAD_PROTOCOLS);
}

/**
 * Get a protocol configuration by ID.
 */
export function getProtocolById(id: OverloadProtocol): OverloadProtocolConfig {
  return OVERLOAD_PROTOCOLS[id];
}
