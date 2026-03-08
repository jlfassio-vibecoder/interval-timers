/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Client-side challenge persistence: calls admin API endpoints (Supabase-backed).
 */

import { supabase } from '@/lib/supabase/client';
import type {
  ChallengeTemplate,
  ChallengeConfig,
  ChallengeLibraryItem,
} from '@/types/ai-challenge';
import type { PromptChainMetadata } from '@/types/ai-program';

async function getAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) return session.access_token;
  await waitForAuth();
  const {
    data: { session: s },
  } = await supabase.auth.getSession();
  if (!s?.access_token) throw new Error('User must be authenticated to access challenges');
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
          else reject(new Error('User must be authenticated to access challenges'));
        });
      }, 3000);
    });
  });
}

export async function saveChallengeToLibrary(
  challengeData: ChallengeTemplate,
  challengeConfig: ChallengeConfig,
  authorId: string,
  chainMetadata?: PromptChainMetadata
): Promise<string> {
  const token = await getAccessToken();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const currentUid = session?.user?.id;
  if (!currentUid || currentUid !== authorId) throw new Error('Author ID must match current user');

  const response = await fetch('/api/admin/challenges', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      challengeData,
      challengeConfig,
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
    throw new Error(errorData.error || `Failed to save challenge: ${response.statusText}`);
  }

  const result: { id: string } = await response.json();
  return result.id;
}

export async function fetchChallengeLibrary(): Promise<ChallengeLibraryItem[]> {
  const token = await getAccessToken();

  const response = await fetch('/api/admin/challenges', {
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
        'Permission denied: You do not have access to challenges. Please ensure you are authenticated.'
      );
    }
    throw new Error(errorData.error ?? `Failed to fetch challenges: ${response.statusText}`);
  }

  const data = await response.json();
  const list = Array.isArray(data) ? data : [];
  return list as ChallengeLibraryItem[];
}

export async function fetchFullChallenge(challengeId: string): Promise<ChallengeTemplate> {
  const token = await getAccessToken();

  const response = await fetch(`/api/admin/challenges/${challengeId}`, {
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
      throw new Error(`Challenge with ID ${challengeId} not found`);
    }
    throw new Error(errorData.error || `Failed to fetch challenge: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchChallengeMetadata(challengeId: string): Promise<ChallengeLibraryItem> {
  const token = await getAccessToken();

  const response = await fetch(`/api/admin/challenges/${challengeId}?metadata=1`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    if (response.status === 404) {
      throw new Error(`Challenge with ID ${challengeId} not found`);
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        'Permission denied: You do not have access to challenges. Please ensure you are authenticated.'
      );
    }
    throw new Error(
      errorData.error ?? `Failed to fetch challenge metadata: ${response.statusText}`
    );
  }

  return response.json();
}

export async function deleteChallenge(challengeId: string): Promise<void> {
  const token = await getAccessToken();

  const response = await fetch(`/api/admin/challenges/${challengeId}`, {
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
      throw new Error(`Challenge with ID ${challengeId} not found`);
    }
    throw new Error(errorData.error || `Failed to delete challenge: ${response.statusText}`);
  }
}

export async function updateChallenge(
  challengeId: string,
  challengeData: ChallengeTemplate,
  challengeConfig: ChallengeConfig
): Promise<void> {
  const token = await getAccessToken();

  const response = await fetch(`/api/admin/challenges/${challengeId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ challengeData, challengeConfig }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    if (response.status === 401 || response.status === 403) {
      throw new Error('Unauthorized. Please ensure you are logged in as an admin.');
    }
    if (response.status === 404) {
      throw new Error(`Challenge with ID ${challengeId} not found`);
    }
    if (response.status === 400) {
      throw new Error(errorData.error || 'Invalid request data');
    }
    throw new Error(errorData.error || `Failed to update challenge: ${response.statusText}`);
  }
}

export async function updateChallengeStatus(
  challengeId: string,
  status: 'draft' | 'published'
): Promise<void> {
  const token = await getAccessToken();

  const response = await fetch(`/api/admin/challenges/${challengeId}`, {
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
      throw new Error(`Challenge with ID ${challengeId} not found`);
    }
    throw new Error(errorData.error || `Failed to update challenge status: ${response.statusText}`);
  }
}

const _IMAGE_SLOTS = ['hero', '1', '2', '3', '4', '5'] as const;
export type ChallengeImageSlot = (typeof _IMAGE_SLOTS)[number];

export async function generateChallengeImage(
  challengeId: string,
  slot: ChallengeImageSlot,
  promptOverride?: string
): Promise<string> {
  const token = await getAccessToken();

  const response = await fetch('/api/admin/challenges/generate-image', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ challengeId, slot, promptOverride }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    if (response.status === 401 || response.status === 403) {
      throw new Error('Unauthorized. Please ensure you are logged in as an admin.');
    }
    if (response.status === 404) {
      throw new Error(`Challenge with ID ${challengeId} not found`);
    }
    throw new Error(errorData.error || `Failed to generate image: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.image || typeof data.image !== 'string') {
    throw new Error('Invalid response from image generation API');
  }
  return data.image;
}

export async function saveChallengeImage(
  challengeId: string,
  slot: ChallengeImageSlot,
  imageDataUrl: string
): Promise<string> {
  const token = await getAccessToken();

  const response = await fetch(`/api/admin/challenges/${challengeId}/images`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ slot, imageDataUrl }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    if (response.status === 401 || response.status === 403) {
      throw new Error('Unauthorized. Please ensure you are logged in as an admin.');
    }
    if (response.status === 404) {
      throw new Error(`Challenge with ID ${challengeId} not found`);
    }
    throw new Error(errorData.error || `Failed to save image: ${response.statusText}`);
  }

  const data = await response.json();
  return data.url ?? imageDataUrl;
}

export async function removeChallengeImage(
  challengeId: string,
  slot: ChallengeImageSlot
): Promise<void> {
  const token = await getAccessToken();

  const response = await fetch(`/api/admin/challenges/${challengeId}/images`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ slot }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    if (response.status === 401 || response.status === 403) {
      throw new Error('Unauthorized. Please ensure you are logged in as an admin.');
    }
    if (response.status === 404) {
      throw new Error(`Challenge with ID ${challengeId} not found`);
    }
    throw new Error(errorData.error || `Failed to remove image: ${response.statusText}`);
  }
}
