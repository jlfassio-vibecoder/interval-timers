/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Program persistence: calls admin API endpoints (Supabase-backed).
 */

import { supabase } from '@/lib/supabase/supabase-instance';
import type {
  ProgramTemplate,
  ProgramConfig,
  ProgramLibraryItem,
  PromptChainMetadata,
} from '@/types/ai-program';
import type { WorkoutSetTemplate, WorkoutConfig } from '@/types/ai-workout';
import { saveWorkoutToLibrary } from '@/lib/supabase/client/workout-persistence';
import { normalizeWorkoutForEditor } from '@/lib/program-schedule-utils';
import type { UserDemographics } from '@/types/ai-program';

const DEFAULT_TARGET_AUDIENCE: UserDemographics = {
  ageRange: '26-35',
  sex: 'Male',
  weight: 180,
  experienceLevel: 'intermediate',
};

async function getAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) return session.access_token;
  await waitForAuth();
  const {
    data: { session: s },
  } = await supabase.auth.getSession();
  if (!s?.access_token) throw new Error('User must be authenticated to access programs');
  return s.access_token;
}

function waitForAuth(): Promise<void> {
  return new Promise((resolve, reject) => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        resolve();
        return;
      }
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, s) => {
        if (s) {
          subscription.unsubscribe();
          resolve();
        }
      });
      setTimeout(() => {
        subscription.unsubscribe();
        supabase.auth.getSession().then(({ data: { session: s2 } }) => {
          if (s2) resolve();
          else reject(new Error('User must be authenticated to access programs'));
        });
      }, 3000);
    });
  });
}

export async function saveProgramToLibrary(
  programData: ProgramTemplate,
  programConfig: ProgramConfig,
  authorId: string,
  chainMetadata?: PromptChainMetadata
): Promise<string> {
  const token = await getAccessToken();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const currentUid = session?.user?.id;
  if (!currentUid) throw new Error('User must be authenticated to save programs');
  if (currentUid !== authorId) {
    throw new Error('Author ID must match current user');
  }

  try {
    const response = await fetch('/api/admin/programs', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        programData,
        programConfig,
        authorId,
        chainMetadata,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (response.status === 401 || response.status === 403) {
        throw new Error('Unauthorized. Please ensure you are logged in as an admin.');
      }
      if (response.status === 400) {
        throw new Error(errorData.error || 'Invalid request data');
      }
      throw new Error(errorData.error || `Failed to save program: ${response.statusText}`);
    }

    const result: { id: string } = await response.json();
    return result.id;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to save program: Unknown error');
  }
}

export async function fetchProgramLibrary(): Promise<ProgramLibraryItem[]> {
  await waitForAuth();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error('User must be authenticated to fetch programs');

  const { data, error } = await supabase
    .from('programs')
    .select(
      'id, trainer_id, title, description, difficulty, duration_weeks, config, chain_metadata, status, is_public, created_at, updated_at'
    )
    .eq('trainer_id', session.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    if (import.meta.env.DEV) console.error('[fetchProgramLibrary]', error);
    if (error.code === 'PGRST301' || error.message?.includes('permission'))
      throw new Error(
        'Permission denied: You do not have access to programs. Please ensure you are authenticated.'
      );
    throw new Error(`Failed to fetch programs: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    trainer_id: string;
    title: string | null;
    description: string | null;
    difficulty: string | null;
    duration_weeks: number | null;
    config: {
      targetAudience?: UserDemographics;
      equipmentProfile?: unknown;
      goals?: unknown;
    } | null;
    chain_metadata: Record<string, unknown> | null;
    status: string;
    is_public: boolean;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map((row) => {
    const config = row.config ?? {};
    const chain = row.chain_metadata ?? {};
    return {
      id: row.id,
      title: row.title || 'Untitled Program',
      description: row.description || '',
      difficulty: (row.difficulty as ProgramLibraryItem['difficulty']) || 'intermediate',
      durationWeeks: row.duration_weeks ?? 12,
      targetAudience: config.targetAudience ?? DEFAULT_TARGET_AUDIENCE,
      equipmentProfile: config.equipmentProfile as ProgramLibraryItem['equipmentProfile'],
      goals: config.goals as ProgramLibraryItem['goals'],
      chain_metadata: chain.generated_at
        ? {
            ...chain,
            generated_at:
              typeof chain.generated_at === 'string'
                ? new Date(chain.generated_at)
                : chain.generated_at,
          }
        : undefined,
      status: row.is_public ? 'published' : 'draft',
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      authorId: row.trainer_id || '',
    } as ProgramLibraryItem;
  });
}

export async function fetchFullProgram(programId: string): Promise<ProgramTemplate> {
  const token = await getAccessToken();

  try {
    const response = await fetch(`/api/admin/programs/${programId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (response.status === 401 || response.status === 403) {
        throw new Error('Unauthorized. Please ensure you are logged in as an admin.');
      }
      if (response.status === 404) {
        throw new Error(`Program with ID ${programId} not found`);
      }
      throw new Error(errorData.error || `Failed to fetch program: ${response.statusText}`);
    }

    const program: ProgramTemplate = await response.json();
    return program;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch program: Unknown error');
  }
}

export async function fetchProgramMetadata(programId: string): Promise<ProgramLibraryItem> {
  await waitForAuth();

  const { data: row, error } = await supabase
    .from('programs')
    .select(
      'id, trainer_id, title, description, difficulty, duration_weeks, config, chain_metadata, status, is_public, created_at, updated_at'
    )
    .eq('id', programId)
    .single();

  if (error || !row) {
    throw new Error(`Program with ID ${programId} not found`);
  }

  const r = row as {
    id: string;
    trainer_id: string;
    title: string | null;
    description: string | null;
    difficulty: string | null;
    duration_weeks: number | null;
    config: {
      targetAudience?: UserDemographics;
      equipmentProfile?: unknown;
      goals?: unknown;
    } | null;
    chain_metadata: Record<string, unknown> | null;
    is_public: boolean;
    created_at: string;
    updated_at: string;
  };
  const config = r.config ?? {};
  const chain = r.chain_metadata ?? {};
  return {
    id: r.id,
    title: r.title || 'Untitled Program',
    description: r.description || '',
    difficulty: (r.difficulty as ProgramLibraryItem['difficulty']) || 'intermediate',
    durationWeeks: r.duration_weeks ?? 12,
    targetAudience: config.targetAudience ?? DEFAULT_TARGET_AUDIENCE,
    equipmentProfile: config.equipmentProfile as ProgramLibraryItem['equipmentProfile'],
    goals: config.goals as ProgramLibraryItem['goals'],
    chain_metadata: chain.generated_at
      ? {
          ...chain,
          generated_at:
            typeof chain.generated_at === 'string'
              ? new Date(chain.generated_at)
              : chain.generated_at,
        }
      : undefined,
    status: r.is_public ? 'published' : 'draft',
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
    authorId: r.trainer_id || '',
  } as ProgramLibraryItem;
}

export async function deleteProgram(programId: string): Promise<void> {
  const token = await getAccessToken();

  try {
    const response = await fetch(`/api/admin/programs/${programId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (response.status === 401 || response.status === 403) {
        throw new Error('Unauthorized. Please ensure you are logged in as an admin.');
      }
      if (response.status === 404) {
        throw new Error(`Program with ID ${programId} not found`);
      }
      throw new Error(errorData.error || `Failed to delete program: ${response.statusText}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to delete program: Unknown error');
  }
}

export async function updateProgram(
  programId: string,
  programData: ProgramTemplate,
  programConfig: ProgramConfig,
  authorId: string
): Promise<void> {
  const token = await getAccessToken();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const currentUid = session?.user?.id;
  if (!currentUid) throw new Error('User must be authenticated to update programs');
  if (currentUid !== authorId) {
    throw new Error('Author ID must match current user');
  }

  try {
    const response = await fetch(`/api/admin/programs/${programId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        programData,
        programConfig,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (response.status === 401 || response.status === 403) {
        throw new Error('Unauthorized. Please ensure you are logged in as an admin.');
      }
      if (response.status === 404) {
        throw new Error(`Program with ID ${programId} not found`);
      }
      if (response.status === 400) {
        throw new Error(errorData.error || 'Invalid request data');
      }
      throw new Error(errorData.error || `Failed to update program: ${response.statusText}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to update program: Unknown error');
  }
}

export async function updateProgramStatus(
  programId: string,
  status: 'draft' | 'published'
): Promise<void> {
  const token = await getAccessToken();
  const response = await fetch(`/api/admin/programs/${programId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    if (response.status === 401 || response.status === 403) {
      throw new Error('Unauthorized. Please ensure you are logged in as an admin.');
    }
    if (response.status === 404) {
      throw new Error(`Program with ID ${programId} not found`);
    }
    throw new Error(errorData.error || `Failed to update program status: ${response.statusText}`);
  }
}

export async function promoteWorkoutToCanonical(
  programId: string,
  weekIndex: number,
  workoutIndex: number,
  userId: string
): Promise<{ workoutId: string }> {
  const program = await fetchFullProgram(programId);
  const schedule = program.schedule ?? [];
  const week = schedule[weekIndex];
  if (!week) {
    throw new Error(`Week ${weekIndex} not found in program`);
  }
  const workout = week.workouts?.[workoutIndex];
  if (!workout) {
    throw new Error(`Workout ${workoutIndex} not found in week ${weekIndex}`);
  }

  const normalized = normalizeWorkoutForEditor({
    ...workout,
    description: workout.description ?? '',
  });

  const workoutSet: WorkoutSetTemplate = {
    title: workout.title || program.title,
    description: workout.description || program.description || '',
    difficulty: program.difficulty || 'intermediate',
    workouts: [normalized],
  };

  const config: WorkoutConfig = {
    workoutInfo: {
      title: workoutSet.title,
      description: workoutSet.description,
    },
    targetAudience: {
      ageRange: '26-35',
      sex: 'Male',
      weight: 180,
      experienceLevel: program.difficulty || 'intermediate',
    },
    requirements: {
      sessionsPerWeek: 1,
      sessionDurationMinutes: 60,
      splitType: 'full_body',
      lifestyle: 'active',
      twoADay: false,
      weeklyTimeMinutes: 60,
    },
    medicalContext: { includeInjuries: false, includeConditions: false },
    goals: { primary: 'Muscle Gain', secondary: 'Strength' },
  };

  const workoutId = await saveWorkoutToLibrary(workoutSet, config, userId);
  return { workoutId };
}
