/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Local timestamp type for compatibility with code that expects a toDate() method.
 */

/** Object with a toDate() method (e.g. for use in GeneratedExercise). */
export interface TimestampLike {
  toDate(): Date;
}

/** Create a TimestampLike from a Date. */
export function toTimestampLike(d: Date): TimestampLike {
  return {
    toDate: () => new Date(d.getTime()),
  };
}
