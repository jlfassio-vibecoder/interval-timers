/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { APIRoute } from 'astro';
import type {
  ProgramPersona,
  ProgramTemplate,
  ProgramBlueprint,
  ProgramSchedule,
} from '@/types/ai-program';
import {
  getZoneByIdServer,
  getAllEquipmentItemsServer,
} from '@/lib/supabase/admin/server-equipment';
import { parseJSONWithRepair } from '@/lib/json-parser';
import { validateWorkoutDescriptions } from '@/lib/validate-program-schedule';
import { normalizeProgramSchedule } from '@/lib/program-schedule-utils';

/**
 * Extended request body that includes optional blueprint for Phase 2 generation
 */
interface GenerateProgramRequest extends ProgramPersona {
  blueprint?: ProgramBlueprint;
}

/**
 * Zone context interface for prompt building
 */
interface ZoneContext {
  zoneName: string;
  availableEquipment: string[]; // Equipment names
  biomechanicalConstraints: string[];
  zoneDescription?: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Max length for error text in logs and API responses to avoid huge payloads */
const MAX_ERROR_LOG_LENGTH = 200;

/**
 * Request AI to fix malformed JSON
 * Makes a follow-up API call with a focused prompt to repair the JSON
 */
async function requestJSONFix(
  originalResponse: string,
  errorContext: string,
  projectId: string,
  region: string,
  accessToken: string
): Promise<string> {
  const endpoint = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/endpoints/openapi/chat/completions`;

  const fixPrompt = `The following JSON response from an AI program generator is malformed and cannot be parsed. Please fix the JSON syntax errors and return ONLY the corrected, valid JSON. Do not add any explanations or markdown formatting - just the pure JSON.

Error context: ${errorContext.substring(0, 500)}

Malformed JSON (first 10000 characters):
${originalResponse.substring(0, 10000)}${originalResponse.length > 10000 ? '\n... (truncated)' : ''}

Return ONLY the complete, valid JSON object. Ensure:
- All brackets and braces are properly closed
- All commas are in the correct positions
- All strings are properly quoted and escaped
- No trailing commas before closing brackets/braces
- The complete structure is valid JSON`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-ai/deepseek-v3.2-maas',
      messages: [
        {
          role: 'system',
          content:
            'You are a JSON repair specialist. Fix malformed JSON and return ONLY valid JSON with no additional text.',
        },
        {
          role: 'user',
          content: fixPrompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more deterministic output
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to request JSON fix: ${response.status} ${response.statusText}`);
  }

  const apiData = await response.json();
  if (apiData.choices && apiData.choices[0] && apiData.choices[0].message) {
    return apiData.choices[0].message.content;
  } else if (apiData.content) {
    return apiData.content;
  } else {
    throw new Error('Unexpected response format from JSON fix request');
  }
}

const SCHEDULE_FIX_PROMPT_MAX_CHARS = 12000;

/**
 * Truncate program JSON for the schedule-fix prompt while preserving valid JSON.
 * If over the limit, keeps first and last week(s) so the AI sees structure without mid-string cuts.
 */
function truncateProgramJsonForPrompt(programJson: string): { json: string; trimmed: boolean } {
  if (programJson.length <= SCHEDULE_FIX_PROMPT_MAX_CHARS) {
    return { json: programJson, trimmed: false };
  }
  try {
    const obj = JSON.parse(programJson) as {
      schedule?: { weekNumber: number; workouts: unknown[] }[];
    };
    const schedule = obj?.schedule;
    if (Array.isArray(schedule) && schedule.length > 0) {
      const first = schedule[0];
      const last = schedule.length > 1 ? schedule[schedule.length - 1] : null;
      const sampleSchedule = last ? [first, last] : [first];
      const sample = { ...obj, schedule: sampleSchedule };
      const str = JSON.stringify(sample);
      if (str.length <= SCHEDULE_FIX_PROMPT_MAX_CHARS) {
        return { json: str, trimmed: true };
      }
      return { json: JSON.stringify({ ...obj, schedule: [first] }), trimmed: true };
    }
  } catch {
    // Not valid JSON or unexpected shape; fall back to boundary truncation
  }
  const cut = programJson.substring(0, SCHEDULE_FIX_PROMPT_MAX_CHARS);
  const lastClose = cut.lastIndexOf('}');
  const json =
    lastClose > SCHEDULE_FIX_PROMPT_MAX_CHARS / 2 ? cut.substring(0, lastClose + 1) : cut + '…';
  return { json, trimmed: true };
}

/**
 * Request AI to add missing weeks to a program schedule
 * Used by extend-program endpoint to add weeks to a partial program
 */
export async function requestScheduleLengthFix(
  programJson: string,
  expectedWeeks: number,
  currentWeeks: number,
  projectId: string,
  region: string,
  accessToken: string
): Promise<string> {
  const endpoint = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/endpoints/openapi/chat/completions`;
  const missingCount = expectedWeeks - currentWeeks;
  const { json: promptJson, trimmed } = truncateProgramJsonForPrompt(programJson);
  const structureNote = trimmed
    ? 'Structure sample (first and last week shown for context):\n'
    : 'Current program JSON:\n';

  const fixPrompt = `This program schedule has only ${currentWeeks} weeks. Add the missing ${missingCount} week(s) so the schedule array has exactly ${expectedWeeks} week objects (weekNumber ${currentWeeks + 1} through ${expectedWeeks}).

Preserve the same structure as the existing weeks: each week must have weekNumber, workouts (array with title, description, warmupBlocks, blocks). Copy the structure and content style from the existing weeks but adapt for progression (weekNumber ${currentWeeks + 1} through ${expectedWeeks}).

Return ONLY the complete corrected JSON object. No markdown, no explanations. The "schedule" array must contain exactly ${expectedWeeks} week objects.

${structureNote}${promptJson}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-ai/deepseek-v3.2-maas',
      messages: [
        {
          role: 'system',
          content:
            'You are a fitness program editor. Add the requested number of weeks to the schedule array. Return ONLY valid JSON with no additional text. The schedule array must have exactly the requested number of week objects.',
        },
        {
          role: 'user',
          content: fixPrompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to request schedule length fix: ${response.status} ${response.statusText}`
    );
  }

  const apiData = await response.json();
  if (apiData.choices && apiData.choices[0] && apiData.choices[0].message) {
    return apiData.choices[0].message.content;
  }
  if (apiData.content) {
    return apiData.content;
  }
  throw new Error('Unexpected response format from schedule length fix request');
}

/**
 * Build detailed prompt for program generation
 *
 * @param persona - User profile with demographics, medical info, and goals
 * @param zoneContext - Optional zone context with equipment and constraints
 * @param blueprint - Optional blueprint from Phase 1 (if provided, generates workouts following the blueprint)
 * @returns Complete prompt string for AI
 */
function buildProgramPrompt(
  persona: ProgramPersona,
  zoneContext?: ZoneContext,
  blueprint?: ProgramBlueprint
): string {
  const { title, description, demographics, medical, goals, durationWeeks } = persona;

  // Use explicit duration if provided, otherwise default to 12 weeks
  const programDuration = durationWeeks || 12;

  // Analyze injuries and create movement restrictions
  const injuryAnalysis = medical.injuries
    ? `\n\nINJURIES & MOVEMENT RESTRICTIONS:\n${medical.injuries}\n\nBased on these injuries, AVOID or MODIFY the following movements:\n` +
      (medical.injuries.toLowerCase().includes('shoulder') ||
      medical.injuries.toLowerCase().includes('impingement')
        ? '- Avoid overhead pressing movements\n- Use neutral grip or incline variations\n'
        : '') +
      (medical.injuries.toLowerCase().includes('knee')
        ? '- Avoid deep squats or high-impact jumping\n- Use controlled, partial range of motion\n'
        : '') +
      (medical.injuries.toLowerCase().includes('back') ||
      medical.injuries.toLowerCase().includes('spine')
        ? '- Avoid heavy spinal loading\n- Focus on core stability and neutral spine\n'
        : '')
    : '';

  // Analyze conditions and create metabolic priorities
  const conditionAnalysis = medical.conditions
    ? `\n\nMEDICAL CONDITIONS & METABOLIC PRIORITIES:\n${medical.conditions}\n\nBased on these conditions:\n` +
      (medical.conditions.toLowerCase().includes('nafld') ||
      medical.conditions.toLowerCase().includes('fatty liver')
        ? '- PRIORITIZE metabolic demand and cardiovascular conditioning\n- Include moderate-to-high intensity intervals\n- Focus on full-body movements\n'
        : '') +
      (medical.conditions.toLowerCase().includes('diabetes')
        ? '- Monitor intensity and recovery periods\n- Include steady-state cardio options\n'
        : '') +
      (medical.conditions.toLowerCase().includes('hypertension')
        ? '- Avoid excessive isometric holds\n- Include dynamic warm-ups and cool-downs\n'
        : '')
    : '';

  // Zone context section
  const zoneSection = zoneContext
    ? `\n\nTRAINING ZONE CONTEXT:
Zone: ${zoneContext.zoneName}
Available Equipment: ${zoneContext.availableEquipment.join(', ')}
Biomechanical Constraints: ${zoneContext.biomechanicalConstraints.join(', ')}
CRITICAL ZONE REQUIREMENTS:
- ONLY use exercises with available equipment
- STRICTLY respect biomechanical constraints

`
    : '';

  // Program Information section (if title/description provided)
  const programInfoSection =
    title || description
      ? `\n\nPROGRAM INFORMATION:
${title ? `- Title: ${title}` : ''}
${description ? `- Description: ${description}` : ''}
`
      : '';

  // Blueprint section (Phase 2: when blueprint is provided, follow its structure)
  if (blueprint) {
    const blueprintSection = `
PROGRAM BLUEPRINT (FOLLOW THIS STRUCTURE EXACTLY):
Program Name: ${blueprint.program_name}
Rationale: ${blueprint.rationale}

Structure:
- Days per week: ${blueprint.structure.days_per_week}
- Split type: ${blueprint.structure.split_type}
- Session duration: ~${blueprint.structure.session_duration_minutes} minutes

Periodization Strategy:
${Object.entries(blueprint.periodization_strategy)
  .map(([phase, focus]) => `- ${phase.replace(/_/g, ' ')}: ${focus}`)
  .join('\n')}

Weekly Schedule Skeleton:
${Object.entries(blueprint.weekly_schedule_skeleton)
  .map(([day, focus]) => `- ${day.replace(/_/g, ' ')}: ${focus}`)
  .join('\n')}
`;

    // Use blueprint program name if no title provided
    const effectiveTitle = title || blueprint.program_name;

    return `You are a Clinical Exercise Physiologist and Strength Coach. Generate detailed workouts following the provided blueprint.

CLIENT PROFILE:
- Demographics: ${demographics.sex}, ${demographics.ageRange} years, ${demographics.weight}lbs
- Experience Level: ${demographics.experienceLevel}
- Primary Goal: ${goals.primary}
- Secondary Goal: ${goals.secondary}
${injuryAnalysis}${conditionAnalysis}${zoneSection}
${blueprintSection}

YOUR TASK:
Generate the DETAILED WORKOUTS for this ${programDuration}-week program following the blueprint structure above.

For each day specified in the weekly schedule skeleton:
1. Create a workout with the focus pattern indicated
2. Include 4-6 exercises per workout (appropriate for the focus)
3. Include a warmup section with 2-4 exercises
4. Set appropriate sets, reps, RPE, and rest periods
5. Add coach notes for form cues

CRITICAL REQUIREMENTS:
- Follow the split type: ${blueprint.structure.split_type}
- Train ${blueprint.structure.days_per_week} days per week as specified
- Apply the periodization focus for each phase
- Each workout MUST have at least one exercise block
- Each workout MUST have a description

OUTPUT FORMAT:
The "schedule" array MUST contain exactly ${programDuration} week objects.

CRITICAL JSON REQUIREMENTS:
1. Output ONLY valid JSON - NO markdown, NO explanations
2. Start with { and end with }

{
  "title": "${effectiveTitle.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}",
  "description": ${description ? `"${description.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '')}"` : `"${blueprint.rationale.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`},
  "difficulty": "${demographics.experienceLevel}",
  "durationWeeks": ${programDuration},
  "schedule": [
    {
      "weekNumber": 1,
      "workouts": [
        {
          "title": "Day 1 Workout Title",
          "description": "Brief description of workout focus and goals",
          "warmupBlocks": [
            { "order": 1, "exerciseName": "Exercise Name", "instructions": ["Step 1", "Step 2"] }
          ],
          "blocks": [
            {
              "order": 1,
              "exerciseName": "Exercise Name",
              "exerciseQuery": "search term",
              "sets": 4,
              "reps": "8-10",
              "rpe": 7,
              "restSeconds": 90,
              "coachNotes": "Form cues"
            }
          ]
        }
      ]
    }
  ]
}

Generate all ${programDuration} weeks with workouts for each training day. Return ONLY the JSON.`;
  }

  return `You are a Clinical Exercise Physiologist and Strength Coach. Generate a personalized fitness program.

CLIENT PROFILE:
- Demographics: ${demographics.sex}, ${demographics.ageRange} years, ${demographics.weight}lbs
- Experience Level: ${demographics.experienceLevel}
- Primary Goal: ${goals.primary}
- Secondary Goal: ${goals.secondary}
${injuryAnalysis}${conditionAnalysis}${zoneSection}${programInfoSection}
PROGRAM REQUIREMENTS:
1. ${title ? 'Use the provided title and description exactly as specified - do not modify or generate new ones.' : 'Create a comprehensive'} ${demographics.experienceLevel}-level program
2. Duration: ${programDuration} weeks (exactly as specified - do not deviate)
3. Structure: Multiple workouts per week with progressive overload
4. Exercise Selection: Choose exercises that align with goals while respecting injury restrictions
5. Periodization: Include appropriate volume and intensity progression across all ${programDuration} weeks
${title || description ? '6. CRITICAL: Use the exact title and description provided above - do not modify, generate, or create new ones.' : ''}

OUTPUT FORMAT:
SCHEDULE LENGTH (MANDATORY): The "schedule" array MUST contain exactly ${programDuration} week objects — one for weekNumber 1, 2, ... ${programDuration}. For a ${programDuration}-week program, output ${programDuration} elements in the schedule array, no more and no fewer.

CRITICAL JSON REQUIREMENTS - READ CAREFULLY:
1. Output ONLY valid, well-formed JSON - NO markdown code blocks, NO explanations, NO text before or after
2. Start your response with { and end with } - nothing else
3. Validate your JSON before outputting - ensure it can be parsed by JSON.parse()

The JSON must match this EXACT structure:

{
  "title": ${title ? `"${title.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : '"Program Title (e.g., \'Fat Loss & Strength Builder\')"'},
  "description": ${description ? `"${description.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '')}"` : '"Detailed program description (2-3 sentences explaining the program approach, methodology, and expected outcomes)"'},
  "difficulty": "${demographics.experienceLevel}",
  "durationWeeks": ${programDuration},
  "schedule": [
    {
      "weekNumber": 1,
      "workouts": [
        {
          "title": "Workout Name (e.g., 'Upper Body Strength')",
          "description": "Required: brief workout description (e.g., warm-up focus, main goals, equipment)",
          "warmupBlocks": [
            {
              "order": 1,
              "exerciseName": "Neck Rolls",
              "instructions": ["Assume proper starting position with neutral spine", "Execute slow controlled circles", "Complete 5 each direction"]
            }
          ],
          "blocks": [
            {
              "order": 1,
              "exerciseName": "Exercise Name (e.g., 'Barbell Bench Press')",
              "exerciseQuery": "bench press",
              "sets": 4,
              "reps": "6-8",
              "rpe": 8,
              "restSeconds": 180,
              "coachNotes": "Focus on controlled tempo and full range of motion"
            }
          ]
        }
      ]
    }
  ]
}

(The schedule array above shows only week 1. You MUST output ${programDuration} week objects in total: weekNumber 1 through ${programDuration}.)

JSON VALIDATION RULES (MANDATORY):
- All strings MUST be properly quoted with double quotes (")
- Escape quotes inside strings: "description": "He said \\"hello\\"" (use backslash before quotes)
- Escape newlines in strings: "\\n" for line breaks
- All numbers must be valid JSON numbers (no trailing commas after numbers)
- All arrays and objects MUST be properly closed - count your brackets and braces
- NO trailing commas before closing brackets ] or braces }
- Every opening { must have a closing }
- Every opening [ must have a closing ]
- Ensure all ${programDuration} weeks are included in the schedule array
- Double-check that every comma is followed by a valid JSON value
- Verify the entire JSON structure is complete before outputting

EXAMPLE OF PROPER STRING ESCAPING:
- Correct: "coachNotes": "Focus on form and \\"control your tempo\\""
- Incorrect: "coachNotes": "Focus on form and "control your tempo""

Before outputting, mentally validate:
1. Count all { and } - they must match
2. Count all [ and ] - they must match  
3. Check every string has opening and closing quotes
4. Verify no trailing commas before ] or }
5. Ensure all special characters in strings are escaped
6. Schedule array length: schedule has exactly ${programDuration} week objects (weekNumber 1 through ${programDuration}).

CRITICAL REQUIREMENTS:
- Generate ${demographics.experienceLevel === 'beginner' ? '3-4' : demographics.experienceLevel === 'intermediate' ? '4-5' : '5-6'} workouts per week
- Each workout MUST have a non-empty "description" (brief workout focus, warm-up intent, goals)
- Each workout should include a "warmupBlocks" array with 2-5 warmup exercises; each item has order, exerciseName, and instructions (array of step-by-step strings)
- Each workout should have 4-8 exercise blocks
- Progress volume and intensity across weeks
- Use proper exercise terminology
- Set appropriate RPE (Rate of Perceived Exertion) values (1-10 scale)
- Include rest periods (restSeconds) between sets
- Add coachNotes for form cues, tempo, or special considerations
- Ensure exerciseQuery helps match exercises to database (use common exercise name variations)
${title || description ? '- CRITICAL: Use the exact title and description provided in PROGRAM INFORMATION - do not generate, modify, or create new ones' : ''}

Return the complete program as valid JSON. The schedule array must contain exactly ${programDuration} week objects.`;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Validate request
    if (!request.body) {
      return new Response(JSON.stringify({ error: 'Request body is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const requestBody: GenerateProgramRequest = await request.json();

    // Extract blueprint if provided (Phase 2 generation)
    const { blueprint, ...persona } = requestBody;

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
          // Fetch all equipment items to map IDs to names
          const equipmentItems = await getAllEquipmentItemsServer();
          const equipmentMap = new Map(equipmentItems.map((item) => [item.id, item.name]));

          // Use selectedEquipmentIds if provided, otherwise use all zone equipment
          const equipmentIdsToUse =
            persona.selectedEquipmentIds && persona.selectedEquipmentIds.length > 0
              ? persona.selectedEquipmentIds
              : zone.equipmentIds;

          // Map equipment IDs to names, filtering out invalid IDs
          const availableEquipment = equipmentIdsToUse
            .map((id) => equipmentMap.get(id))
            .filter((name) => name !== undefined) as string[];

          zoneContext = {
            zoneName: zone.name,
            availableEquipment:
              availableEquipment.length > 0 ? availableEquipment : ['Minimal equipment available'],
            biomechanicalConstraints: zone.biomechanicalConstraints || [],
            zoneDescription: zone.description,
          };
        } else {
          console.warn(
            `[generate-program] Zone ID ${persona.zoneId} not found, generating without zone context`
          );
        }
      } catch (zoneError) {
        console.error(
          '[generate-program] Error fetching zone:',
          zoneError instanceof Error ? zoneError.message : String(zoneError)
        );
        // Continue without zone context if there's an error
      }
    }

    // Check for required environment variable
    // GOOGLE_PROJECT_ID is preferred, but PUBLIC_FIREBASE_PROJECT_ID can be used as fallback
    // since they should have the same value (Firebase project ID = Google Cloud project ID)
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

    // Use REST API for DeepSeek V3.2 (SDK doesn't support it directly)
    // Endpoint format: /v1/projects/{PROJECT_ID}/locations/{REGION}/endpoints/openapi/chat/completions
    const region = import.meta.env.GOOGLE_LOCATION || 'global';
    const endpoint = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/endpoints/openapi/chat/completions`;

    // Build prompt with zone context and optional blueprint
    const prompt = buildProgramPrompt(persona, zoneContext, blueprint);

    // System instruction
    const systemInstruction =
      'You are a Clinical Exercise Physiologist and Strength Coach with expertise in biomechanics, periodization, injury management, and metabolic conditioning.';

    // Get access token for authentication using Google Auth Library
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
      console.error('[generate-program] Failed to get access token:', tokenError);
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

    // Call DeepSeek V3.2 REST API with retry logic for rate limiting
    let apiResponse: Response | undefined;
    let retries = 0;
    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds

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
            {
              role: 'system',
              content: systemInstruction,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 8192,
        }),
      });

      // If successful or non-retryable error, break
      if (apiResponse.ok) {
        break;
      }

      // Check if it's a rate limit error (429) and we have retries left
      if (apiResponse.status === 429 && retries < maxRetries) {
        const delay = baseDelay * Math.pow(2, retries); // Exponential backoff
        console.warn(
          `[generate-program] Rate limited (429). Retrying in ${delay}ms (attempt ${retries + 1}/${maxRetries})`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        retries++;
        continue;
      }

      // For other errors or if we've exhausted retries, return error
      const errorText = await apiResponse.text();
      const truncatedError = errorText.substring(0, MAX_ERROR_LOG_LENGTH);
      console.error(
        `[generate-program] API error: ${apiResponse.status} ${apiResponse.statusText}`,
        truncatedError
      );

      if (apiResponse.status === 429) {
        return new Response(
          JSON.stringify({
            error: `Rate limit exceeded. The API is currently too busy. Please wait a few minutes and try again. If this persists, check your Vertex AI quota limits.`,
          }),
          {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(
        JSON.stringify({
          error: `API request failed: ${apiResponse.status} ${apiResponse.statusText}. ${errorText.substring(0, MAX_ERROR_LOG_LENGTH)}`,
        }),
        {
          status: apiResponse.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // TypeScript: apiResponse is guaranteed to be defined here (either from successful request or error return)
    if (!apiResponse) {
      return new Response(
        JSON.stringify({
          error: 'Failed to get API response after retries',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const apiData = await apiResponse.json();

    // Extract text from response (DeepSeek uses choices[0].message.content format)
    let text: string;
    if (apiData.choices && apiData.choices[0] && apiData.choices[0].message) {
      text = apiData.choices[0].message.content;
    } else if (apiData.content) {
      text = apiData.content;
    } else if (typeof apiData === 'string') {
      text = apiData;
    } else {
      const responseSummary = {
        hasChoices: !!apiData.choices,
        hasContent: !!apiData.content,
        keys: Object.keys(apiData).slice(0, 10), // First 10 keys only
        type: typeof apiData,
      };
      console.error('[generate-program] Unexpected response format:', responseSummary);
      return new Response(
        JSON.stringify({
          error: 'Unexpected response format from AI API',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!text) {
      return new Response(JSON.stringify({ error: 'Empty response from AI' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Log response length for debugging in dev (truncated to avoid huge logs)
    if (import.meta.env.DEV) {
      const responsePreview =
        text.length > 500
          ? text.substring(0, 500) + `... (truncated, total length: ${text.length})`
          : text;
      console.warn('[generate-program] AI response received:', {
        length: text.length,
        preview: responsePreview,
      });
    }

    // Parse JSON from response with multi-layered repair strategy
    let parsedData: unknown;
    let parseResult;
    try {
      parseResult = parseJSONWithRepair(text);
      parsedData = parseResult.data;

      // Log repair information if JSON was repaired (dev only)
      if (parseResult.wasRepaired && import.meta.env.DEV) {
        console.warn('[generate-program] JSON was repaired:', {
          method: parseResult.repairMethod,
          originalLength: parseResult.originalLength,
          repairedLength: parseResult.repairedLength,
        });
      }
    } catch (parseError) {
      // Log detailed error information
      const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
      const fullResponseForDebug =
        text.length > 50000
          ? text.substring(0, 50000) + `\n... (truncated, total length: ${text.length})`
          : text;

      console.error('[generate-program] JSON parsing failed after all repair attempts:', {
        error: errorMessage,
        responseLength: text.length,
        sample: fullResponseForDebug.substring(0, 2000),
      });

      // Attempt retry with AI-powered JSON fix
      try {
        if (import.meta.env.DEV) {
          console.warn('[generate-program] Attempting AI-powered JSON fix...');
        }
        const fixedResponse = await requestJSONFix(
          text,
          errorMessage,
          projectId,
          region,
          accessToken
        );

        // Try parsing the fixed response
        parseResult = parseJSONWithRepair(fixedResponse);
        parsedData = parseResult.data;

        if (import.meta.env.DEV) {
          console.warn('[generate-program] JSON fix successful:', {
            method: parseResult.repairMethod,
            wasRepaired: parseResult.wasRepaired,
          });
        }
      } catch (retryError) {
        // All attempts failed - return detailed error as JSON response
        const retryErrorMessage =
          retryError instanceof Error ? retryError.message : String(retryError);
        console.error('[generate-program] JSON fix retry also failed:', retryErrorMessage);

        const errorMessageFull =
          `Failed to parse JSON from AI response after all repair attempts including AI-powered fix. ` +
          `Response length: ${text.length} characters. ` +
          `Original error: ${errorMessage}. ` +
          `Retry error: ${retryErrorMessage}`;
        return new Response(JSON.stringify({ error: errorMessageFull }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Enhanced validation with detailed error messages
    function validateProgramTemplate(data: unknown): { valid: boolean; error?: string } {
      if (typeof data !== 'object' || data === null) {
        return { valid: false, error: 'Program data must be an object' };
      }

      const obj = data as Record<string, unknown>;

      // Validate title
      if (typeof obj.title !== 'string' || obj.title.trim().length === 0) {
        return { valid: false, error: 'Program must have a non-empty title (string)' };
      }

      // Validate description
      if (typeof obj.description !== 'string' || obj.description.trim().length === 0) {
        return { valid: false, error: 'Program must have a non-empty description (string)' };
      }

      // Validate difficulty
      if (
        typeof obj.difficulty !== 'string' ||
        !['beginner', 'intermediate', 'advanced'].includes(obj.difficulty)
      ) {
        return {
          valid: false,
          error: `Program difficulty must be one of: beginner, intermediate, advanced. Got: ${typeof obj.difficulty === 'string' ? obj.difficulty : typeof obj.difficulty}`,
        };
      }

      // Validate durationWeeks
      if (typeof obj.durationWeeks !== 'number' || obj.durationWeeks <= 0) {
        return {
          valid: false,
          error: `Program durationWeeks must be a positive number. Got: ${typeof obj.durationWeeks}`,
        };
      }

      // Validate schedule
      if (!Array.isArray(obj.schedule)) {
        return { valid: false, error: 'Program schedule must be an array' };
      }

      if (obj.schedule.length === 0) {
        return { valid: false, error: 'Program schedule must contain at least one week' };
      }

      // Shared validation: workout descriptions (single source of truth with ProgramBlueprintEditor)
      const descValidation = validateWorkoutDescriptions(obj.schedule as ProgramSchedule[]);
      if (!descValidation.valid) {
        return { valid: false, error: descValidation.error };
      }

      // Note: schedule length mismatch is no longer a validation error; partial programs are allowed.
      // The caller will compute `missingWeeks` and include it in the response.

      // Validate each week in schedule
      for (let i = 0; i < obj.schedule.length; i++) {
        const week = obj.schedule[i];
        if (typeof week !== 'object' || week === null || !Array.isArray(week.workouts)) {
          return {
            valid: false,
            error: `Week ${i + 1} must be an object with a 'workouts' array`,
          };
        }

        if (week.weekNumber !== i + 1) {
          return {
            valid: false,
            error: `Week ${i + 1} has incorrect weekNumber: expected ${i + 1}, got ${week.weekNumber}`,
          };
        }

        if (week.workouts.length === 0) {
          return { valid: false, error: `Week ${i + 1} must have at least one workout` };
        }

        // Validate each workout
        for (let j = 0; j < week.workouts.length; j++) {
          const workout = week.workouts[j];
          if (typeof workout !== 'object' || workout === null) {
            return {
              valid: false,
              error: `Week ${i + 1}, Workout ${j + 1} must be an object`,
            };
          }

          if (typeof workout.title !== 'string' || workout.title.trim().length === 0) {
            return {
              valid: false,
              error: `Week ${i + 1}, Workout ${j + 1} must have a non-empty title`,
            };
          }

          // Workout description validated above via validateWorkoutDescriptions (shared with editor)

          if (Array.isArray(workout.warmupBlocks)) {
            for (let wb = 0; wb < workout.warmupBlocks.length; wb++) {
              const w = workout.warmupBlocks[wb];
              if (typeof w !== 'object' || w === null) {
                return {
                  valid: false,
                  error: `Week ${i + 1}, Workout ${j + 1}, Warmup block ${wb + 1} must be an object`,
                };
              }
              if (typeof w.order !== 'number') {
                return {
                  valid: false,
                  error: `Week ${i + 1}, Workout ${j + 1}, Warmup block ${wb + 1} must have order (number)`,
                };
              }
              if (typeof w.exerciseName !== 'string' || w.exerciseName.trim().length === 0) {
                return {
                  valid: false,
                  error: `Week ${i + 1}, Workout ${j + 1}, Warmup block ${wb + 1} must have a non-empty exerciseName`,
                };
              }
              if (!Array.isArray(w.instructions) || w.instructions.length === 0) {
                return {
                  valid: false,
                  error: `Week ${i + 1}, Workout ${j + 1}, Warmup block ${wb + 1} must have a non-empty instructions array of strings`,
                };
              }
              for (let si = 0; si < w.instructions.length; si++) {
                if (typeof w.instructions[si] !== 'string') {
                  return {
                    valid: false,
                    error: `Week ${i + 1}, Workout ${j + 1}, Warmup block ${wb + 1}, instruction ${si + 1} must be a string`,
                  };
                }
              }
            }
          }

          // Accept either blocks (legacy) or exerciseBlocks
          const eb = workout.exerciseBlocks;
          const bl = workout.blocks;
          if (eb && Array.isArray(eb) && eb.length > 0) {
            for (let k = 0; k < eb.length; k++) {
              const block = eb[k];
              const exercises = block?.exercises ?? [];
              if (!Array.isArray(exercises)) {
                return {
                  valid: false,
                  error: `Week ${i + 1}, Workout ${j + 1}, Block ${k + 1} must have exercises array`,
                };
              }
              for (let e = 0; e < exercises.length; e++) {
                const ex = exercises[e];
                if (typeof ex !== 'object' || ex === null) {
                  return {
                    valid: false,
                    error: `Week ${i + 1}, Workout ${j + 1}, Block ${k + 1}, Exercise ${e + 1} must be an object`,
                  };
                }
                if (
                  typeof ex.exerciseName !== 'string' ||
                  (ex.exerciseName || '').trim().length === 0
                ) {
                  return {
                    valid: false,
                    error: `Week ${i + 1}, Workout ${j + 1}, Block ${k + 1}, Exercise ${e + 1} must have non-empty exerciseName`,
                  };
                }
                if (typeof ex.sets !== 'number' || ex.sets <= 0) {
                  return {
                    valid: false,
                    error: `Week ${i + 1}, Workout ${j + 1}, Block ${k + 1}, Exercise ${e + 1} must have positive sets`,
                  };
                }
                // Accept string | number to align with validateMathematicianOutput; normalizeProgramSchedule converts to string
                if (
                  (typeof ex.reps !== 'string' && typeof ex.reps !== 'number') ||
                  String(ex.reps ?? '').trim().length === 0
                ) {
                  return {
                    valid: false,
                    error: `Week ${i + 1}, Workout ${j + 1}, Block ${k + 1}, Exercise ${e + 1} must have non-empty reps`,
                  };
                }
              }
            }
          } else if (bl && Array.isArray(bl) && bl.length > 0) {
            for (let k = 0; k < bl.length; k++) {
              const block = bl[k];
              if (typeof block !== 'object' || block === null) {
                return {
                  valid: false,
                  error: `Week ${i + 1}, Workout ${j + 1}, Block ${k + 1} must be an object`,
                };
              }
              if (
                typeof block.exerciseName !== 'string' ||
                (block.exerciseName || '').trim().length === 0
              ) {
                return {
                  valid: false,
                  error: `Week ${i + 1}, Workout ${j + 1}, Block ${k + 1} must have a non-empty exerciseName`,
                };
              }
              if (typeof block.sets !== 'number' || block.sets <= 0) {
                return {
                  valid: false,
                  error: `Week ${i + 1}, Workout ${j + 1}, Block ${k + 1} must have a positive sets value`,
                };
              }
              // Accept string | number to align with validateMathematicianOutput; normalizeProgramSchedule converts to string
              if (
                (typeof block.reps !== 'string' && typeof block.reps !== 'number') ||
                String(block.reps ?? '').trim().length === 0
              ) {
                return {
                  valid: false,
                  error: `Week ${i + 1}, Workout ${j + 1}, Block ${k + 1} must have a non-empty reps value`,
                };
              }
            }
          } else {
            return {
              valid: false,
              error: `Week ${i + 1}, Workout ${j + 1} must have at least one exercise block (blocks or exerciseBlocks)`,
            };
          }
        }
      }

      return { valid: true };
    }

    // Validate response structure with detailed error messages
    const validation = validateProgramTemplate(parsedData);
    if (!validation.valid) {
      console.error('[generate-program] Program structure validation failed:', validation.error);
      return new Response(
        JSON.stringify({
          error: `Invalid program structure from AI: ${validation.error}`,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Type assertion is safe here because we've validated the structure
    const programData = parsedData as ProgramTemplate;

    // Compute missingWeeks: requested duration vs actual schedule length
    const requestedWeeks = persona.durationWeeks ?? programData.durationWeeks;
    const actualWeeks = programData.schedule.length;
    const missingWeeks = Math.max(0, requestedWeeks - actualWeeks);

    if (missingWeeks > 0 && import.meta.env.DEV) {
      console.warn(
        `[generate-program] Partial program returned: ${actualWeeks} of ${requestedWeeks} weeks (missing ${missingWeeks})`
      );
    }

    // Normalize blocks -> exerciseBlocks for canonical structure; ensure durationWeeks matches requested
    const normalizedProgram = normalizeProgramSchedule(programData);
    const responsePayload = {
      ...normalizedProgram,
      durationWeeks: requestedWeeks,
      ...(missingWeeks > 0 ? { missingWeeks } : {}),
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[generate-program] Error:', error);

    // Provide helpful error messages for common issues
    let errorMessage = error instanceof Error ? error.message : 'Failed to generate program';
    let statusCode = 500;

    if (errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('403')) {
      errorMessage = `Permission denied. Please ensure:
1. Vertex AI API is enabled: gcloud services enable aiplatform.googleapis.com --project=${import.meta.env.GOOGLE_PROJECT_ID}
2. Your account has the "Vertex AI User" role: gcloud projects add-iam-policy-binding ${import.meta.env.GOOGLE_PROJECT_ID} --member="user:YOUR_EMAIL" --role="roles/aiplatform.user"
3. You've run: gcloud auth application-default login`;
      statusCode = 403;
    } else if (
      errorMessage.includes('429') ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('Resource exhausted')
    ) {
      errorMessage = `Rate limit exceeded. The Vertex AI API is currently too busy. Please wait a few minutes and try again. If this persists, check your Vertex AI quota limits in the Google Cloud Console.`;
      statusCode = 429;
    }

    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
