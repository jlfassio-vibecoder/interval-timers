/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { APIRoute } from 'astro';
import { verifyTrainerOrAdminRequest } from '@/lib/supabase/admin/auth';
import { fetchChallengeLibrary, createChallenge } from '@/lib/supabase/admin/challenges';
import type { ChallengeTemplate, ChallengeConfig } from '@/types/ai-challenge';
import type { PromptChainMetadata } from '@/types/ai-program';

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    await verifyTrainerOrAdminRequest(request, cookies);
    const challenges = await fetchChallengeLibrary();
    return new Response(JSON.stringify(challenges), {
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
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[admin/challenges] Error listing challenges:', error);
    }
    // Return empty list instead of 500 so UI can show empty state (dev/MVP: no challenges yet)
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const adminInfo = await verifyTrainerOrAdminRequest(request, cookies);

    let body: {
      challengeData: ChallengeTemplate;
      challengeConfig: ChallengeConfig;
      authorId: string;
      chainMetadata?: PromptChainMetadata;
    };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body. Expected JSON.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!body.challengeData || !body.challengeConfig || !body.authorId) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: challengeData, challengeConfig, authorId',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!body.challengeConfig.targetAudience) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: challengeConfig.targetAudience' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (body.authorId !== adminInfo.uid) {
      return new Response(JSON.stringify({ error: 'Author ID must match authenticated user' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const challengeId = await createChallenge(
      body.authorId,
      body.challengeData,
      body.challengeConfig,
      body.chainMetadata
    );

    return new Response(JSON.stringify({ id: challengeId }), {
      status: 201,
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
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[admin/challenges] Error creating challenge:', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to create challenge' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
