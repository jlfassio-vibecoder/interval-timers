/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Local timestamp type for compatibility with code that expects a toDate() method.
 * Replaces firebase/firestore Timestamp after Firebase removal.
 */

/** Object with a toDate() method (e.g. for use in GeneratedExercise, GeneratedWODDoc). */
export interface TimestampLike {
  toDate(): Date;
}

/** Create a TimestampLike from a Date so existing toDate()-based code keeps working. */
export function toTimestampLike(d: Date): TimestampLike {
  return {
    toDate: () => new Date(d.getTime()),
  };
}
