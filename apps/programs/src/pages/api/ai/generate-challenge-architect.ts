/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Step 1-only endpoint: returns Challenge Architect output (architect + milestones).
 * Used for optional two-phase flow in ChallengeGeneratorModal.
 */

import type { APIRoute } from 'astro';
import type { ChallengePersona } from '@/types/ai-challenge';
import {
  getZoneByIdServer,
  getAllEquipmentItemsServer,
} from '@/lib/supabase/admin/server-equipment';
import { parseJSONWithRepair } from '@/lib/json-parser';
import {
  buildChallengeArchitectPrompt,
  validateChallengeArchitectOutput,
} from '@/lib/prompt-chain/step1-challenge-architect';
import { callVertexAI } from '@/lib/vertex-ai-client';

interface ZoneContext {
  zoneName: string;
  availableEquipment: string[];
  biomechanicalConstraints: string[];
}

export const POST: APIRoute = async ({ request }) => {
  try {
    if (!request.body) {
      return new Response(JSON.stringify({ error: 'Request body is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const persona: ChallengePersona = await request.json();

    if (!persona.demographics || !persona.medical || !persona.goals) {
      return new Response(JSON.stringify({ error: 'Invalid persona structure' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!persona.durationWeeks || persona.durationWeeks < 2 || persona.durationWeeks > 6) {
      return new Response(JSON.stringify({ error: 'durationWeeks must be 2, 3, 4, 5, or 6' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch zone context
    let zoneContext: ZoneContext | undefined;
    if (persona.zoneId) {
      try {
        const zone = await getZoneByIdServer(persona.zoneId);
        if (zone) {
          const equipmentItems = await getAllEquipmentItemsServer();
          const equipmentMap = new Map(equipmentItems.map((item) => [item.id, item.name]));
          const equipmentIdsToUse = persona.selectedEquipmentIds?.length
            ? persona.selectedEquipmentIds
            : zone.equipmentIds;
          const availableEquipment = equipmentIdsToUse
            .map((id) => equipmentMap.get(id))
            .filter((name): name is string => name !== undefined);
          zoneContext = {
            zoneName: zone.name,
            availableEquipment: availableEquipment.length > 0 ? availableEquipment : ['Bodyweight'],
            biomechanicalConstraints: zone.biomechanicalConstraints || [],
          };
        }
      } catch (err) {
        console.error('[generate-challenge-architect] Zone fetch error:', err);
      }
    }

    const projectId =
      import.meta.env.GOOGLE_PROJECT_ID || import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) {
      return new Response(
        JSON.stringify({ error: 'GOOGLE_PROJECT_ID environment variable is not set' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const region = import.meta.env.GOOGLE_LOCATION || 'global';

    let accessToken: string;
    try {
      const { GoogleAuth } = await import('google-auth-library');
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        projectId,
      });
      const client = await auth.getClient();
      const tokenResponse = await client.getAccessToken();
      if (!tokenResponse.token) throw new Error('Failed to get access token');
      accessToken = tokenResponse.token;
    } catch (err) {
      console.error('[generate-challenge-architect] Auth error:', err);
      return new Response(
        JSON.stringify({
          error: 'Authentication failed. Run: gcloud auth application-default login',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const step1Prompt = buildChallengeArchitectPrompt(persona, zoneContext);
    const step1Response = await callVertexAI({
      systemPrompt:
        'You are the Challenge Architect with a PhD in Exercise Physiology. Output ONLY valid JSON.',
      userPrompt: step1Prompt,
      accessToken,
      projectId,
      region,
      temperature: 0.5,
      maxTokens: 2048,
      timeoutMs: 120000,
      logPrefix: '[generate-challenge-architect]',
    });

    const step1Parsed = parseJSONWithRepair(step1Response);
    const step1Validation = validateChallengeArchitectOutput(step1Parsed.data);
    if (!step1Validation.valid) {
      return new Response(
        JSON.stringify({ error: `Challenge Architect failed: ${step1Validation.error}` }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const { architect, milestones } = step1Validation.data;

    return new Response(JSON.stringify({ architect, milestones }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[generate-challenge-architect] Error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to generate challenge architect blueprint';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
