/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * WOD Engine API: generate exactly one workout for the selected level.
 * Request: { level: 'beginner' | 'intermediate' | 'advanced', zoneId?, selectedEquipmentIds? }
 * Response: single GeneratedWOD (Artist + workoutDetail).
 *
 * Supports iteration mode when iteration_source_wod_id and overload_protocol are provided.
 */

import type { APIRoute } from 'astro';
import type { WODLevel, GeneratedWOD, WorkoutDetail } from '@/types';
import type { IterationMetadata } from '@/types/generated-wod';
import type { OverloadProtocol } from '@/types/overload-protocol';
import type { WODParameters, WorkoutFormat } from '@/types/wod-parameters';
import { mergeWODParameters, ALL_WORKOUT_FORMAT_IDS } from '@/types/wod-parameters';
import {
  getZoneByIdServer,
  getAllEquipmentItemsServer,
} from '@/lib/supabase/admin/server-equipment';
import { getGeneratedWODByIdServer } from '@/lib/supabase/admin/server-generated-wods';
import { parseJSONWithRepair } from '@/lib/json-parser';
import {
  buildWODBriefPrompt,
  buildWODPrescriberPrompt,
  validateWODPrescriberOutput,
} from '@/lib/prompt-chain';
import type { WODIterationContext } from '@/lib/prompt-chain/wod-prescriber';
import { parsePhaseDurationMinutes } from '@/lib/parse-phase-duration';
import { getNextIterationNumber, getLineageId } from '@/lib/wod-utils';

const MAX_ERROR_LOG_LENGTH = 500;
const WOD_LEVELS: WODLevel[] = ['beginner', 'intermediate', 'advanced'];
const OVERLOAD_PROTOCOLS: OverloadProtocol[] = [
  'linear_load',
  'double_progression',
  'density_leverage',
];

const WOD_IMAGES: Record<WODLevel, string> = {
  beginner: '/images/outdoor-calisthenics-workout-001.jpg',
  intermediate: '/images/outdoor-boot-camp-sand-bag-001.jpg',
  advanced: '/images/outdoor-speed-and-agility-001.jpg',
};

interface GenerateWODRequestBody {
  level: WODLevel;
  zoneId?: string;
  selectedEquipmentIds?: string[];
  /** WOD parameters (time domain, format, bias, load, social, exclusions). */
  parameters?: Partial<WODParameters>;
  /** Source WOD ID for iteration mode (must be provided with overload_protocol). */
  iteration_source_wod_id?: string;
  /** Overload protocol for iteration mode (must be provided with iteration_source_wod_id). */
  overload_protocol?: OverloadProtocol;
}

async function callAI(options: {
  systemPrompt: string;
  userPrompt: string;
  accessToken: string;
  projectId: string;
  region: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<string> {
  const {
    systemPrompt,
    userPrompt,
    accessToken,
    projectId,
    region,
    temperature = 0.5,
    maxTokens = 4096,
    timeoutMs = 120000,
  } = options;
  const endpoint = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/endpoints/openapi/chat/completions`;

  let response: Response | undefined;
  let retries = 0;
  const maxRetries = 3;
  const baseDelay = 2000;

  while (retries <= maxRetries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-ai/deepseek-v3.2-maas',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.ok) break;
    const isRetryable = response.status === 429 || response.status === 503;
    if (isRetryable && retries < maxRetries) {
      const delay = baseDelay * Math.pow(2, retries);
      await new Promise((resolve) => setTimeout(resolve, delay));
      retries++;
      continue;
    }
    const errorText = await response.text();
    throw new Error(
      `AI API error: ${response.status} - ${errorText.substring(0, MAX_ERROR_LOG_LENGTH)}`
    );
  }

  if (!response || !response.ok) {
    throw new Error('Failed to get AI response after retries');
  }

  const apiData = await response.json();
  if (apiData.choices?.[0]?.message?.content) {
    return apiData.choices[0].message.content;
  }
  if (apiData.content) {
    return apiData.content;
  }
  throw new Error('Unexpected API response format');
}

function capitalizeLevel(level: WODLevel): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

function intensityForLevel(level: WODLevel): number {
  return level === 'beginner' ? 1 : level === 'intermediate' ? 3 : 5;
}

export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();

  try {
    if (!request.body) {
      return new Response(JSON.stringify({ error: 'Request body is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = (await request.json()) as GenerateWODRequestBody;
    const level = body?.level;

    if (!level || !WOD_LEVELS.includes(level)) {
      return new Response(
        JSON.stringify({
          error: `level is required and must be one of: ${WOD_LEVELS.join(', ')}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate iteration fields: both must be provided together or both omitted
    const hasSourceId = !!body.iteration_source_wod_id;
    const hasProtocol = !!body.overload_protocol;
    if (hasSourceId !== hasProtocol) {
      return new Response(
        JSON.stringify({
          error: 'iteration_source_wod_id and overload_protocol must be provided together',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate protocol value if provided
    if (body.overload_protocol && !OVERLOAD_PROTOCOLS.includes(body.overload_protocol)) {
      return new Response(
        JSON.stringify({
          error: `overload_protocol must be one of: ${OVERLOAD_PROTOCOLS.join(', ')}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const isIterationMode = hasSourceId && hasProtocol;

    const parameters: WODParameters = mergeWODParameters(body.parameters);

    let availableEquipment: string[] = ['Bodyweight'];
    let zoneName: string | undefined;
    if (body.zoneId) {
      try {
        const zone = await getZoneByIdServer(body.zoneId);
        if (zone) {
          zoneName = zone.name;
          const equipmentItems = await getAllEquipmentItemsServer();
          const equipmentMap = new Map(equipmentItems.map((item) => [item.id, item.name]));
          const equipmentIdsToUse =
            (body.selectedEquipmentIds?.length ?? 0) > 0
              ? body.selectedEquipmentIds!
              : zone.equipmentIds;
          availableEquipment = equipmentIdsToUse
            .map((id) => equipmentMap.get(id))
            .filter((name): name is string => name !== undefined);
          if (availableEquipment.length === 0) {
            availableEquipment = ['Bodyweight'];
          }
        }
      } catch (err) {
        console.error('[generate-wod] Zone fetch error:', err);
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
      console.error('[generate-wod] Auth error:', err);
      return new Response(
        JSON.stringify({
          error: 'Authentication failed. Run: gcloud auth application-default login',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build iteration context if in iteration mode
    let iterationContext: WODIterationContext | undefined;
    let iterationMetadata: IterationMetadata | undefined;

    if (isIterationMode && body.iteration_source_wod_id && body.overload_protocol) {
      console.warn('[generate-wod] Iteration mode: fetching source WOD...');
      const sourceWOD = await getGeneratedWODByIdServer(body.iteration_source_wod_id);

      if (!sourceWOD) {
        return new Response(JSON.stringify({ error: 'Source WOD not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const iterationNumber = getNextIterationNumber(sourceWOD);
      const lineageId = getLineageId(sourceWOD);

      iterationContext = {
        source_wod: {
          level: sourceWOD.level,
          workoutDetail: sourceWOD.workoutDetail,
        },
        overload_protocol: body.overload_protocol,
        iteration_number: iterationNumber,
      };

      iterationMetadata = {
        iteration_number: iterationNumber,
        source_wod_id: body.iteration_source_wod_id,
        protocol_used: body.overload_protocol,
        lineage_id: lineageId,
      };

      console.warn(
        `[generate-wod] Iteration #${iterationNumber} using ${body.overload_protocol} protocol`
      );
    }

    // Step 1: WOD Brief (skip in iteration mode - use source WOD structure instead)
    let brief = '';
    if (!isIterationMode) {
      console.warn('[generate-wod] Step 1: WOD Brief...');
      const briefPrompt = buildWODBriefPrompt({
        level,
        zoneName,
        availableEquipment,
        parameters,
      });
      const briefResponse = await callAI({
        systemPrompt: 'You are a WOD designer. Output ONLY plain text, no JSON.',
        userPrompt: briefPrompt,
        accessToken,
        projectId,
        region,
        temperature: 0.5,
        maxTokens: 512,
      });
      brief = briefResponse.trim();
      console.warn('[generate-wod] Step 1 complete');
    } else {
      console.warn('[generate-wod] Step 1: Skipped (iteration mode uses source WOD structure)');
    }

    // Step 2: WOD Prescriber
    console.warn('[generate-wod] Step 2: WOD Prescriber...');
    const prescriberPrompt = buildWODPrescriberPrompt({
      level,
      availableEquipment,
      brief: brief || undefined,
      iteration: iterationContext,
      parameters,
    });
    const prescriberResponse = await callAI({
      systemPrompt: 'You are the WOD Prescriber. Output ONLY valid JSON, no markdown.',
      userPrompt: prescriberPrompt,
      accessToken,
      projectId,
      region,
      temperature: 0.4,
      maxTokens: 2048,
    });

    const prescriberParsed = parseJSONWithRepair(prescriberResponse);
    const rawData = prescriberParsed.data as Record<string, unknown> | null;
    let resolvedFormat: WorkoutFormat | undefined;
    let dataToValidate: unknown = rawData;
    if (rawData && typeof rawData === 'object' && 'resolvedFormat' in rawData) {
      const format = rawData.resolvedFormat;
      if (typeof format === 'string' && ALL_WORKOUT_FORMAT_IDS.includes(format as WorkoutFormat)) {
        resolvedFormat = format as WorkoutFormat;
      }
      const { resolvedFormat: _rf, ...rest } = rawData;
      dataToValidate = rest;
    }
    const prescriberValidation = validateWODPrescriberOutput(dataToValidate);
    if (!prescriberValidation.valid) {
      return new Response(
        JSON.stringify({
          error: `WOD Prescriber failed: ${prescriberValidation.error}`,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const workoutDetail: WorkoutDetail = prescriberValidation.data;
    console.warn('[generate-wod] Step 2 complete');

    const totalMinutesFromPhases =
      parsePhaseDurationMinutes(workoutDetail.warmup.duration) +
      parsePhaseDurationMinutes(workoutDetail.main.duration) +
      parsePhaseDurationMinutes(workoutDetail.finisher.duration) +
      parsePhaseDurationMinutes(workoutDetail.cooldown.duration);
    const timeCapFallback = parameters.timeDomain?.timeCapMinutes ?? 45;
    const windowMinutes = totalMinutesFromPhases > 0 ? totalMinutesFromPhases : timeCapFallback;

    const name = capitalizeLevel(level);
    // Reused in name and description; iterationLabel reflects purpose (per PR review).
    const iterationLabel = iterationMetadata
      ? ` (Iteration #${iterationMetadata.iteration_number})`
      : '';
    const restLoadByProfile: Record<string, string> = {
      heavy: 'Heavy',
      standard: 'Compressed',
      light: 'Distributed',
    };
    const restLoad = restLoadByProfile[parameters.loadProfile] ?? 'Compressed';

    const wod: GeneratedWOD = {
      id: `wod-generated-${level}`,
      name: name + iterationLabel,
      genre: isIterationMode
        ? `Progressive workout using ${body.overload_protocol?.replace('_', ' ')} protocol`
        : `One daily workout, scaled for ${level}`,
      image: WOD_IMAGES[level],
      day: 'WOD',
      description: isIterationMode
        ? `${name} WOD${iterationLabel}: progressive iteration using ${body.overload_protocol?.replace('_', ' ')} overload protocol.`
        : `${name} WOD: one daily workout scaled for ${level} with appropriate volume and progressions.`,
      intensity: intensityForLevel(level),
      workoutDetail,
      targetVolumeMinutes: windowMinutes,
      windowMinutes,
      restLoad,
    };

    const elapsedMs = Date.now() - startTime;
    console.warn(`[generate-wod] Complete in ${elapsedMs}ms`);

    return new Response(
      JSON.stringify({
        wod,
        iteration: iterationMetadata,
        resolvedFormat: resolvedFormat ?? undefined,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[generate-wod] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate WOD';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
