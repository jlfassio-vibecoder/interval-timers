/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Resolve HUD active program id from enrollments (aligned with welcome trainer priority).
 */

import type { UserProgramAccess } from '@/types/user-program';
import { fetchUserPrograms } from '@/lib/supabase/client/user-programs';
import {
  pickActiveEnrollment,
  filterEnrollmentsByAssignedHint,
  type ActiveEnrollmentRow,
} from '@/lib/enrollment-pick';

export function mapProgramsToEnrollmentRows(
  programs: (UserProgramAccess & { programId: string })[]
): ActiveEnrollmentRow[] {
  return programs
    .filter((p) => p.status === 'active')
    .map((p) => ({
      program_id: p.programId,
      source: p.source ?? 'self',
      created_at: p.createdAt ?? null,
    }));
}

/**
 * Resolves HUD active program: trainer server recommendation (when valid) wins over localStorage,
 * then invite hints, then default pick order. See Performance Lab / client_training_preferences.
 */
export async function resolveActiveProgramIdForSession(
  userId: string,
  currentActiveId: string | null,
  assignedProgramIdsHint?: string[] | null,
  trainerRecommendedProgramId?: string | null
): Promise<string | null> {
  const programs = await fetchUserPrograms(userId);
  const allRows = mapProgramsToEnrollmentRows(programs);
  const validAll = new Set(allRows.map((r) => r.program_id));

  const rec = trainerRecommendedProgramId?.trim();
  if (rec && validAll.has(rec)) {
    return rec;
  }

  if (currentActiveId && validAll.has(currentActiveId)) {
    return currentActiveId;
  }
  const rows = filterEnrollmentsByAssignedHint(allRows, assignedProgramIdsHint);
  return pickActiveEnrollment(rows, null)?.program_id ?? null;
}
