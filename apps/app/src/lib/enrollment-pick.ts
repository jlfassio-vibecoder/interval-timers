/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pick which active enrollment to treat as primary (HUD active program, welcome trainer context).
 * Mirrors priority: trainer_assigned → cohort → self, then newest created_at.
 */

/** Tie-break when multiple active enrollments share the same `source`. */
export const ENROLLMENT_SOURCE_PRIORITY: Record<string, number> = {
  trainer_assigned: 0,
  cohort: 1,
  self: 2,
};

export type ActiveEnrollmentRow = {
  program_id: string;
  source: string;
  created_at: string | null;
};

/**
 * Prefer `preferredProgramId` when it matches an active row; else source priority, then newest created_at.
 */
export function pickActiveEnrollment(
  rows: ActiveEnrollmentRow[],
  preferredProgramId?: string | null
): ActiveEnrollmentRow | null {
  if (!rows.length) return null;
  const pref = preferredProgramId?.trim();
  if (pref) {
    const match = rows.find((r) => r.program_id === pref);
    if (match) return match;
  }
  const sorted = [...rows].sort((a, b) => {
    const pa = ENROLLMENT_SOURCE_PRIORITY[a.source] ?? 99;
    const pb = ENROLLMENT_SOURCE_PRIORITY[b.source] ?? 99;
    if (pa !== pb) return pa - pb;
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });
  return sorted[0] ?? null;
}

/**
 * When an invite lists specific program ids, prefer picking among those enrollments (e.g. new assignments).
 */
export function filterEnrollmentsByAssignedHint(
  rows: ActiveEnrollmentRow[],
  assignedProgramIds?: string[] | null
): ActiveEnrollmentRow[] {
  if (!assignedProgramIds?.length) return rows;
  const set = new Set(assignedProgramIds);
  const hit = rows.filter((r) => set.has(r.program_id));
  return hit.length ? hit : rows;
}
