/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Types for Deployment Timeline and Deployment Grid (HUB and program views).
 */

/**
 * Minimal workout card shape for the Deployment Grid.
 * Both HUB (Artist) and program data (preview/schedule) can be mapped to this.
 */
export interface DeploymentWorkoutCard {
  id: string;
  name: string;
  genre: string;
  image: string;
  day: string;
  intensity: number;
}

/** Week titles for Deployment Timeline (Week 1: Foundation, etc.). */
export const WEEK_LABELS: Record<number, string> = {
  1: 'Foundation',
  2: 'Intensification',
  3: 'Progression',
  4: 'Peak',
  5: 'Peak',
  6: 'Peak',
  7: 'Peak',
  8: 'Peak',
  9: 'Peak',
  10: 'Peak',
  11: 'Taper',
  12: 'Peak',
};
