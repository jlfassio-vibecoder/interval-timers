/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { APIRoute } from 'astro';
import { verifyTrainerOrAdminRequest } from '@/lib/supabase/admin/auth';
import {
  fetchFullChallenge,
  fetchChallengeMetadata,
  updateChallenge,
  deleteChallenge,
  updateChallengeStatus,
} from '@/lib/supabase/admin/challenges';
import type { ChallengeTemplate, ChallengeConfig } from '@/types/ai-challenge';

export const GET: APIRoute = async ({ request, params, cookies, url }) => {
  try {
    await verifyTrainerOrAdminRequest(request, cookies);

    const challengeId = params.challengeId;
    if (!challengeId) {
      return new Response(JSON.stringify({ error: 'Challenge ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const metadataOnly = url.searchParams.get('metadata') === '1';
    const result = metadataOnly
      ? await fetchChallengeMetadata(challengeId)
      : await fetchFullChallenge(challengeId);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return new Response(JSON.stringify({ error: 'Unauthorized. Admin access required.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (error.message.includes('not found')) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[admin/challenges] Error fetching challenge:', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to fetch challenge' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PATCH: APIRoute = async ({ request, params, cookies }) => {
  try {
    await verifyTrainerOrAdminRequest(request, cookies);

    const challengeId = params.challengeId;
    if (!challengeId) {
      return new Response(JSON.stringify({ error: 'Challenge ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let body: { status: 'draft' | 'published' };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body. Expected JSON.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!body.status || (body.status !== 'draft' && body.status !== 'published')) {
      return new Response(
        JSON.stringify({
          error: 'Missing or invalid field: status (must be "draft" or "published")',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await updateChallengeStatus(challengeId, body.status);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return new Response(JSON.stringify({ error: 'Unauthorized. Admin access required.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (error.message.includes('not found')) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[admin/challenges] Error updating challenge status:', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to update challenge status' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PUT: APIRoute = async ({ request, params, cookies }) => {
  try {
    await verifyTrainerOrAdminRequest(request, cookies);

    const challengeId = params.challengeId;
    if (!challengeId) {
      return new Response(JSON.stringify({ error: 'Challenge ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let body: { challengeData: ChallengeTemplate; challengeConfig: ChallengeConfig };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body. Expected JSON.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!body.challengeData || !body.challengeConfig) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: challengeData, challengeConfig' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await updateChallenge(challengeId, body.challengeData, body.challengeConfig);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return new Response(JSON.stringify({ error: 'Unauthorized. Admin access required.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (error.message.includes('not found')) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[admin/challenges] Error updating challenge:', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to update challenge' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async ({ request, params, cookies }) => {
  try {
    await verifyTrainerOrAdminRequest(request, cookies);

    const challengeId = params.challengeId;
    if (!challengeId) {
      return new Response(JSON.stringify({ error: 'Challenge ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await deleteChallenge(challengeId);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return new Response(JSON.stringify({ error: 'Unauthorized. Admin access required.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (error.message.includes('not found')) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[admin/challenges] Error deleting challenge:', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to delete challenge' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
