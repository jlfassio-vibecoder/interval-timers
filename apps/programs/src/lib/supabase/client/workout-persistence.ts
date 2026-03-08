/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Client-side persistence for Workout Factory. Calls admin API endpoints (Supabase-backed).
 */

import { supabase } from '@/lib/supabase/client';
import type {
  WorkoutSetTemplate,
  WorkoutConfig,
  WorkoutLibraryItem,
  WorkoutChainMetadata,
} from '@/types/ai-workout';

async function getAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) return session.access_token;
  await waitForAuth();
  const {
    data: { session: s },
  } = await supabase.auth.getSession();
  if (!s?.access_token) throw new Error('User must be authenticated to access workouts');
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
          else reject(new Error('User must be authenticated to access workouts'));
        });
      }, 3000);
    });
  });
}

export async function saveWorkoutToLibrary(
  workoutSet: WorkoutSetTemplate,
  workoutConfig: WorkoutConfig,
  authorId: string,
  chainMetadata?: WorkoutChainMetadata
): Promise<string> {
  const token = await getAccessToken();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const currentUid = session?.user?.id;
  if (!currentUid || currentUid !== authorId) throw new Error('Author ID must match current user');

  const response = await fetch('/api/admin/workouts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      workoutSet,
      workoutConfig,
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
    throw new Error(errorData.error || `Failed to save workout: ${response.statusText}`);
  }

  const result: { id: string } = await response.json();
  return result.id;
}

export async function fetchWorkoutLibrary(): Promise<WorkoutLibraryItem[]> {
  const token = await getAccessToken();

  const response = await fetch('/api/admin/workouts', {
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
      throw new Error(
        'Permission denied: You do not have access to workouts. Please ensure you are authenticated.'
      );
    }
    throw new Error(errorData.error ?? `Failed to fetch workouts: ${response.statusText}`);
  }

  const data = await response.json();
  const list = Array.isArray(data) ? data : [];
  return list as WorkoutLibraryItem[];
}

export interface WorkoutDocument {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  targetAudience: WorkoutLibraryItem['targetAudience'];
  equipmentProfile?: WorkoutLibraryItem['equipmentProfile'];
  goals?: WorkoutLibraryItem['goals'];
  workoutConfig?: WorkoutConfig;
  chain_metadata?: WorkoutLibraryItem['chain_metadata'];
  status: 'draft' | 'published';
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
  workoutCount: number;
  workouts: WorkoutSetTemplate['workouts'];
}

export async function fetchWorkoutDocument(workoutId: string): Promise<WorkoutDocument> {
  const token = await getAccessToken();

  const response = await fetch(`/api/admin/workouts/${workoutId}`, {
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
      throw new Error(`Workout with ID ${workoutId} not found`);
    }
    throw new Error(errorData.error || `Failed to fetch workout: ${response.statusText}`);
  }

  return response.json();
}

export async function updateWorkout(
  workoutId: string,
  updates: {
    workoutSet?: WorkoutSetTemplate;
    workoutConfig?: WorkoutConfig;
    status?: 'draft' | 'published';
  }
): Promise<void> {
  const token = await getAccessToken();

  const response = await fetch(`/api/admin/workouts/${workoutId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    if (response.status === 401 || response.status === 403) {
      throw new Error('Unauthorized. Please ensure you are logged in as an admin.');
    }
    if (response.status === 404) {
      throw new Error(`Workout with ID ${workoutId} not found`);
    }
    throw new Error(errorData.error || `Failed to update workout: ${response.statusText}`);
  }
}

export async function updateWorkoutStatus(
  workoutId: string,
  status: 'draft' | 'published'
): Promise<void> {
  await updateWorkout(workoutId, { status });
}

export async function deleteWorkout(workoutId: string): Promise<void> {
  const token = await getAccessToken();

  const response = await fetch(`/api/admin/workouts/${workoutId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    if (response.status === 401 || response.status === 403) {
      throw new Error('Unauthorized. Please ensure you are logged in as an admin.');
    }
    if (response.status === 404) {
      throw new Error(`Workout with ID ${workoutId} not found`);
    }
    throw new Error(errorData.error || `Failed to delete workout: ${response.statusText}`);
  }
}
