/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * API endpoint to generate a high-level program blueprint (Phase 1).
 * The blueprint contains structure, periodization strategy, and weekly skeleton.
 * This is used as input to Phase 2 (detailed workout generation).
 */

import type { APIRoute } from 'astro';
import type { ProgramPersona, ProgramBlueprint } from '@/types/ai-program';
import {
  getZoneByIdServer,
  getAllEquipmentItemsServer,
} from '@/lib/supabase/admin/server-equipment';
import { parseJSONWithRepair } from '@/lib/json-parser';

// Maximum characters to log for API errors
const MAX_ERROR_LOG_LENGTH = 500;

/**
 * Zone context interface for prompt building
 */
interface ZoneContext {
  zoneName: string;
  availableEquipment: string[];
  biomechanicalConstraints: string[];
}

/**
 * Generate periodization phase keys based on duration
 * E.g., 6 weeks → ["weeks_1_2", "weeks_3_4", "weeks_5_6"]
 * E.g., 12 weeks → ["weeks_1_3", "weeks_4_6", "weeks_7_9", "weeks_10_12"]
 */
function generatePeriodizationPhases(durationWeeks: number): string[] {
  const phases: string[] = [];

  if (durationWeeks <= 6) {
    // 2-week phases
    for (let i = 1; i <= durationWeeks; i += 2) {
      const end = Math.min(i + 1, durationWeeks);
      phases.push(`weeks_${i}_${end}`);
    }
  } else if (durationWeeks <= 8) {
    // 2-week phases
    for (let i = 1; i <= durationWeeks; i += 2) {
      const end = Math.min(i + 1, durationWeeks);
      phases.push(`weeks_${i}_${end}`);
    }
  } else {
    // 3-week phases for longer programs
    for (let i = 1; i <= durationWeeks; i += 3) {
      const end = Math.min(i + 2, durationWeeks);
      phases.push(`weeks_${i}_${end}`);
    }
  }

  return phases;
}

/**
 * Build the blueprint generation prompt
 */
function buildBlueprintPrompt(persona: ProgramPersona, zoneContext?: ZoneContext): string {
  const { title, description, demographics, medical, goals, durationWeeks } = persona;
  const programDuration = durationWeeks || 12;

  // Generate periodization phase keys for the prompt
  const phaseKeys = generatePeriodizationPhases(programDuration);
  const phaseExample = phaseKeys
    .map((key, idx) => {
      const focuses = [
        'Neural Adaptation / Movement Mastery',
        'Volume Accumulation / Hypertrophy',
        'Strength / Intensity',
        'Peaking / Deload',
      ];
      return `    "${key}": "${focuses[idx % focuses.length]}"`;
    })
    .join(',\n');

  // Equipment zone section
  const zoneSection = zoneContext
    ? `
Equipment Zone/Profile: ${zoneContext.zoneName}
Available Equipment: ${zoneContext.availableEquipment.join(', ')}
Biomechanical Constraints: ${zoneContext.biomechanicalConstraints.join(', ')}`
    : '';

  // Medical context
  const medicalSection =
    medical.injuries || medical.conditions
      ? `
Medical Context (Optional):
${medical.injuries ? `Injuries: ${medical.injuries}` : ''}
${medical.conditions ? `Conditions: ${medical.conditions}` : ''}`
      : '';

  return `Role: AI Fitcopilot (PhD Exercise Physiology).
Task: Create the "Biomechanical Blueprint" for a ${programDuration}-week program.

Input Data:

1. Title: ${title || '(Auto-generate based on goals)'}
2. Description: ${description || '(Auto-generate based on goals)'}

Program Parameters:
- Duration: ${programDuration} weeks
${zoneSection}

Target Persona:
- Age Range: ${demographics.ageRange}
- Sex: ${demographics.sex}
- Weight: ${demographics.weight} lbs
- Skill Level: ${demographics.experienceLevel}
${medicalSection}

Target Persona Goals:
- Primary Goal: ${goals.primary}
- Secondary Goal: ${goals.secondary}

Directives:
1. Ignore user calendar constraints. Design the program based ONLY on what is physiologically required to achieve the Goal in ${programDuration} weeks.
2. Determine the optimal Frequency (days per week) and Split (e.g., Upper/Lower, PPL, Full Body).
3. Select the Periodization Model (Linear, Undulating, Step-Loading) that best fits the Goal and Level.
4. Define the Primary Driver of Progress (e.g., "Volume accumulation" vs "Intensity intensification").

Output Requirement (JSON Format):
Return ONLY valid JSON with NO markdown code blocks, NO explanations, NO text before or after.

{
  "program_name": "${title || 'Scientific title based on goals'}",
  "rationale": "One sentence explaining why this frequency/split is the only way to hit the goal.",
  "structure": {
    "days_per_week": Integer (1-7),
    "split_type": "String (e.g., Upper/Lower, Push/Pull/Legs, Full Body, Bro Split)",
    "session_duration_minutes": Integer (estimate per session)
  },
  "periodization_strategy": {
${phaseExample}
  },
  "weekly_schedule_skeleton": {
    "Day_1": "Focus Pattern (e.g., Lower Body - Squat Focus)",
    "Day_2": "Focus Pattern",
    "Day_3": "Focus Pattern (or Rest)",
    "Day_4": "Focus Pattern",
    "Day_5": "Focus Pattern (or Rest)",
    "Day_6": "Focus Pattern (or Rest)",
    "Day_7": "Rest"
  }
}

CRITICAL: Return ONLY the JSON object. Start with { and end with }. No markdown, no explanations.`;
}

/**
 * Validate the blueprint structure
 */
function validateBlueprint(data: unknown): { valid: true } | { valid: false; error: string } {
  if (typeof data !== 'object' || data === null) {
    return { valid: false, error: 'Blueprint must be an object' };
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.program_name !== 'string' || !obj.program_name.trim()) {
    return { valid: false, error: 'program_name is required' };
  }

  if (typeof obj.rationale !== 'string' || !obj.rationale.trim()) {
    return { valid: false, error: 'rationale is required' };
  }

  if (typeof obj.structure !== 'object' || obj.structure === null) {
    return { valid: false, error: 'structure object is required' };
  }

  const structure = obj.structure as Record<string, unknown>;
  if (
    typeof structure.days_per_week !== 'number' ||
    structure.days_per_week < 1 ||
    structure.days_per_week > 7
  ) {
    return { valid: false, error: 'structure.days_per_week must be a number between 1 and 7' };
  }

  if (typeof structure.split_type !== 'string' || !structure.split_type.trim()) {
    return { valid: false, error: 'structure.split_type is required' };
  }

  if (
    typeof structure.session_duration_minutes !== 'number' ||
    structure.session_duration_minutes < 10
  ) {
    return { valid: false, error: 'structure.session_duration_minutes must be a number >= 10' };
  }

  if (typeof obj.periodization_strategy !== 'object' || obj.periodization_strategy === null) {
    return { valid: false, error: 'periodization_strategy object is required' };
  }

  if (typeof obj.weekly_schedule_skeleton !== 'object' || obj.weekly_schedule_skeleton === null) {
    return { valid: false, error: 'weekly_schedule_skeleton object is required' };
  }

  return { valid: true };
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

    // Validate persona structure
    if (!persona.demographics || !persona.medical || !persona.goals) {
      return new Response(JSON.stringify({ error: 'Invalid persona structure' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch zone context if zoneId is provided
    let zoneContext: ZoneContext | undefined;
    if (persona.zoneId) {
      try {
        const zone = await getZoneByIdServer(persona.zoneId);
        if (zone) {
          const equipmentItems = await getAllEquipmentItemsServer();
          const equipmentMap = new Map(equipmentItems.map((item) => [item.id, item.name]));

          const equipmentIdsToUse =
            persona.selectedEquipmentIds && persona.selectedEquipmentIds.length > 0
              ? persona.selectedEquipmentIds
              : zone.equipmentIds;

          const availableEquipment = equipmentIdsToUse
            .map((id) => equipmentMap.get(id))
            .filter((name) => name !== undefined) as string[];

          zoneContext = {
            zoneName: zone.name,
            availableEquipment:
              availableEquipment.length > 0 ? availableEquipment : ['Minimal equipment available'],
            biomechanicalConstraints: zone.biomechanicalConstraints || [],
          };
        }
      } catch (zoneError) {
        console.error('[generate-blueprint] Error fetching zone:', zoneError);
      }
    }

    // Check for required environment variable
    const projectId =
      import.meta.env.GOOGLE_PROJECT_ID || import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) {
      return new Response(
        JSON.stringify({
          error: 'GOOGLE_PROJECT_ID or PUBLIC_FIREBASE_PROJECT_ID environment variable is not set',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const region = import.meta.env.GOOGLE_LOCATION || 'global';
    const endpoint = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/endpoints/openapi/chat/completions`;

    // Build prompt
    const prompt = buildBlueprintPrompt(persona, zoneContext);

    const systemInstruction =
      'You are AI Fitcopilot, a Clinical Exercise Physiologist with a PhD in Exercise Science. Your task is to create high-level program blueprints that define structure, periodization, and weekly focus patterns. Output ONLY valid JSON.';

    // Get access token
    let accessToken: string;
    try {
      const { GoogleAuth } = await import('google-auth-library');
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        projectId: projectId,
      });
      const client = await auth.getClient();
      const tokenResponse = await client.getAccessToken();
      if (!tokenResponse.token) {
        throw new Error('Failed to get access token');
      }
      accessToken = tokenResponse.token;
    } catch (tokenError) {
      console.error('[generate-blueprint] Failed to get access token:', tokenError);
      return new Response(
        JSON.stringify({
          error:
            'Failed to authenticate. Please ensure you have run: gcloud auth application-default login',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Call API with retry logic
    let apiResponse: Response | undefined;
    let retries = 0;
    const maxRetries = 3;
    const baseDelay = 2000;

    while (retries <= maxRetries) {
      apiResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-ai/deepseek-v3.2-maas',
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt },
          ],
          temperature: 0.5,
          max_tokens: 2048,
        }),
      });

      if (apiResponse.ok) break;

      if (apiResponse.status === 429 && retries < maxRetries) {
        const delay = baseDelay * Math.pow(2, retries);
        console.warn(`[generate-blueprint] Rate limited. Retrying in ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        retries++;
        continue;
      }

      const errorText = await apiResponse.text();
      console.error(
        `[generate-blueprint] API error: ${apiResponse.status}`,
        errorText.substring(0, MAX_ERROR_LOG_LENGTH)
      );

      if (apiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please wait and try again.' }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          error: `API request failed: ${apiResponse.status} ${apiResponse.statusText}`,
        }),
        { status: apiResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!apiResponse || !apiResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to generate blueprint after retries' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse response
    const apiData = await apiResponse.json();
    let responseContent: string;
    if (apiData.choices && apiData.choices[0] && apiData.choices[0].message) {
      responseContent = apiData.choices[0].message.content;
    } else if (apiData.content) {
      responseContent = apiData.content;
    } else {
      return new Response(JSON.stringify({ error: 'Unexpected API response format' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse JSON with repair
    const parseResult = parseJSONWithRepair(responseContent);
    const parsedData = parseResult.data;

    // Validate blueprint structure
    const validation = validateBlueprint(parsedData);
    if (!validation.valid) {
      console.error('[generate-blueprint] Validation failed:', validation.error);
      return new Response(
        JSON.stringify({ error: `Invalid blueprint structure: ${validation.error}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const blueprint = parsedData as ProgramBlueprint;

    return new Response(JSON.stringify(blueprint), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[generate-blueprint] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate blueprint';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
