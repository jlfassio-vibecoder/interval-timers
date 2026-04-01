/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Step 1-only endpoint: returns ArchitectBlueprint for optional two-phase flow.
 * Used when "Review structure first" is enabled (e.g., 12+ week programs).
 */

import type { APIRoute } from 'astro';
import type { ProgramPersona, ArchitectBlueprint } from '@/types/ai-program';
import {
  getZoneByIdServer,
  getAllEquipmentItemsServer,
} from '@/lib/supabase/admin/server-equipment';
import { parseJSONWithRepair } from '@/lib/json-parser';
import { buildArchitectPrompt, validateArchitectOutput } from '@/lib/prompt-chain';
import { callVertexAI, getVertexAICredentials } from '@/lib/vertex-ai-client';

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

    const persona: ProgramPersona = await request.json();

    if (!persona.demographics || !persona.medical || !persona.goals) {
      return new Response(JSON.stringify({ error: 'Invalid persona structure' }), {
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
        console.error('[generate-architect] Zone fetch error:', err);
      }
    }

    const creds = await getVertexAICredentials('[generate-architect]');
    if ('error' in creds) return creds.error;
    const { projectId, region, accessToken } = creds;

    const step1Prompt = buildArchitectPrompt(persona, zoneContext);
    const step1Response = await callVertexAI({
      systemPrompt:
        'You are the Macro-Cycle Architect with a PhD in Exercise Physiology. Output ONLY valid JSON.',
      userPrompt: step1Prompt,
      accessToken,
      projectId,
      region,
      temperature: 0.5,
      maxTokens: 2048,
      timeoutMs: 120000,
      logPrefix: '[generate-architect]',
    });

    const step1Parsed = parseJSONWithRepair(step1Response);
    const step1Validation = validateArchitectOutput(step1Parsed.data);
    if (!step1Validation.valid) {
      return new Response(JSON.stringify({ error: `Architect failed: ${step1Validation.error}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const architect: ArchitectBlueprint = step1Validation.data;

    return new Response(JSON.stringify({ architect }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[generate-architect] Error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to generate architect blueprint';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
