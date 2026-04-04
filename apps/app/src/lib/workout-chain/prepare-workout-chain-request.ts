/**
 * Shared validation + zone/equipment resolution for workout chain APIs
 * (generate and Step 1 prompt preview).
 */

import type {
  WorkoutPersona,
  WorkoutArchitectBlueprint,
  BlockOptions,
  HiitOptions,
  HiitCircuitStructure,
  AmrapDensityOptions,
} from '@/types/ai-workout';
import {
  getZoneByIdServer,
  getAllEquipmentItemsServer,
} from '@/lib/supabase/admin/server-equipment';
import { amrapDensityTierMinutes } from '@/lib/amrap-density-tier';

export interface WorkoutChainZoneContext {
  zoneName: string;
  availableEquipment: string[];
  biomechanicalConstraints: string[];
}

export interface PreparedWorkoutChainRequest {
  persona: WorkoutPersona;
  blockOptions: BlockOptions;
  hiitOptions: HiitOptions | undefined;
  hiitMode: boolean;
  /** Normalized density AMRAP options when amrapDensityMode is true. */
  amrapDensityOptions: AmrapDensityOptions | undefined;
  zoneContext: WorkoutChainZoneContext | undefined;
  /** Equipment list used in Step 3 (Coach); mirrors generate-workout-chain. */
  availableEquipment: string[];
  providedArchitect: WorkoutArchitectBlueprint | undefined;
  /** When set, Step 1 uses this instead of buildWorkoutArchitectPrompt (only if no providedArchitect). */
  step1UserPromptOverride: string | undefined;
}

const defaultBlockOptions: BlockOptions = {
  includeWarmup: true,
  mainBlockCount: 1,
  includeFinisher: false,
  includeCooldown: false,
};

type IncomingBody = WorkoutPersona & {
  architectBlueprint?: WorkoutArchitectBlueprint;
  blockOptions?: BlockOptions;
  step1UserPromptOverride?: string;
};

export type PrepareWorkoutChainResult =
  | { ok: true; data: PreparedWorkoutChainRequest }
  | { ok: false; response: Response };

/**
 * Validates persona + block options, resolves zone/equipment. No AI calls.
 */
export async function prepareWorkoutChainRequest(
  raw: unknown,
  shouldLog: boolean
): Promise<PrepareWorkoutChainResult> {
  if (raw === null || typeof raw !== 'object') {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }

  const body = raw as IncomingBody;
  const {
    architectBlueprint: providedArchitect,
    blockOptions: requestBlockOptions,
    step1UserPromptOverride: rawOverride,
    ...persona
  } = body;

  const blockOptions: BlockOptions =
    requestBlockOptions && typeof requestBlockOptions === 'object'
      ? {
          includeWarmup: !!requestBlockOptions.includeWarmup,
          mainBlockCount:
            typeof requestBlockOptions.mainBlockCount === 'number' &&
            requestBlockOptions.mainBlockCount >= 1 &&
            requestBlockOptions.mainBlockCount <= 5
              ? (requestBlockOptions.mainBlockCount as 1 | 2 | 3 | 4 | 5)
              : 1,
          includeFinisher: !!requestBlockOptions.includeFinisher,
          includeCooldown: !!requestBlockOptions.includeCooldown,
        }
      : defaultBlockOptions;

  if (!persona.demographics || !persona.medical || !persona.goals) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: 'Invalid persona structure' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }

  if (
    typeof persona.weeklyTimeMinutes !== 'number' ||
    persona.weeklyTimeMinutes < 30 ||
    persona.weeklyTimeMinutes > 600
  ) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: 'weeklyTimeMinutes must be between 30 and 600' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }
  if (
    typeof persona.sessionsPerWeek !== 'number' ||
    persona.sessionsPerWeek < 1 ||
    persona.sessionsPerWeek > 7
  ) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: 'sessionsPerWeek must be between 1 and 7' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }

  const amrapDensityModeRaw = !!persona.amrapDensityMode;
  const hiitModeRaw = !!persona.hiitMode;

  if (amrapDensityModeRaw && hiitModeRaw) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({
          error: 'amrapDensityMode and hiitMode cannot both be enabled',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }

  const amrapDensityMode = amrapDensityModeRaw;
  const hiitMode = amrapDensityMode ? false : hiitModeRaw;

  const defaultHiitCircuitStructure: HiitCircuitStructure = {
    includeWarmup: true,
    circuit1: true,
    circuit2: false,
    circuit3: false,
    includeCooldown: true,
  };
  const defaultHiitOptions: HiitOptions = {
    protocolFormat: 'standard_ratio',
    workRestRatio: '1:1',
    circuitStructure: defaultHiitCircuitStructure,
    sessionDurationTier: 'standard_interval',
    primaryGoal: 'fat_oxidation',
  };
  const hiitOptions: HiitOptions | undefined = hiitMode
    ? persona.hiitOptions && typeof persona.hiitOptions === 'object'
      ? {
          protocolFormat: persona.hiitOptions.protocolFormat ?? defaultHiitOptions.protocolFormat,
          workRestRatio: persona.hiitOptions.workRestRatio,
          circuitStructure: persona.hiitOptions.circuitStructure ?? defaultHiitCircuitStructure,
          sessionDurationTier:
            persona.hiitOptions.sessionDurationTier ?? defaultHiitOptions.sessionDurationTier,
          primaryGoal: persona.hiitOptions.primaryGoal ?? defaultHiitOptions.primaryGoal,
        }
      : defaultHiitOptions
    : undefined;

  let amrapDensityOptions: AmrapDensityOptions | undefined;
  if (amrapDensityMode) {
    const rawOpts = persona.amrapDensityOptions;
    if (!rawOpts || typeof rawOpts !== 'object') {
      return {
        ok: false,
        response: new Response(JSON.stringify({ error: 'amrapDensityOptions is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      };
    }
    if (rawOpts.protocolFormat !== 'AMRAP_DENSITY') {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({ error: 'amrapDensityOptions.protocolFormat must be AMRAP_DENSITY' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        ),
      };
    }
    const wr = rawOpts.workRestRatio;
    if (wr !== 'continuous' && wr !== '0:0') {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({
            error: 'amrapDensityOptions.workRestRatio must be continuous or 0:0',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        ),
      };
    }
    const tier = rawOpts.sessionDurationTier;
    if (tier !== 'micro_dose' && tier !== 'standard_interval' && tier !== 'high_volume') {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({ error: 'amrapDensityOptions.sessionDurationTier is invalid' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        ),
      };
    }
    amrapDensityOptions = {
      protocolFormat: 'AMRAP_DENSITY',
      workRestRatio: wr,
      sessionDurationTier: tier,
    };
  }

  if (typeof persona.sessionDurationMinutes !== 'number') {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: 'sessionDurationMinutes is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }

  if (amrapDensityMode && amrapDensityOptions) {
    const expectedMin = amrapDensityTierMinutes(amrapDensityOptions.sessionDurationTier);
    if (persona.sessionDurationMinutes !== expectedMin) {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({
            error: `sessionDurationMinutes must be ${expectedMin} for the selected AMRAP density tier`,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        ),
      };
    }
  } else if (hiitMode) {
    if (persona.sessionDurationMinutes < 4 || persona.sessionDurationMinutes > 30) {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({ error: 'sessionDurationMinutes must be between 4 and 30 in HIIT mode' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        ),
      };
    }
  } else if (persona.sessionDurationMinutes < 15 || persona.sessionDurationMinutes > 180) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: 'sessionDurationMinutes must be between 15 and 180' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }
  if (!persona.splitType || typeof persona.lifestyle !== 'string') {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: 'splitType and lifestyle are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }

  let zoneContext: WorkoutChainZoneContext | undefined;
  let availableEquipment: string[] = ['Bodyweight'];
  if (persona.zoneId) {
    try {
      const zone = await getZoneByIdServer(persona.zoneId);
      if (zone) {
        const equipmentItems = await getAllEquipmentItemsServer();
        const equipmentMap = new Map(equipmentItems.map((item) => [item.id, item.name]));
        const equipmentIdsToUse = persona.selectedEquipmentIds?.length
          ? persona.selectedEquipmentIds
          : zone.equipmentIds;
        availableEquipment = equipmentIdsToUse
          .map((id) => equipmentMap.get(id))
          .filter((name): name is string => name !== undefined);
        if (availableEquipment.length === 0) {
          availableEquipment = ['Bodyweight'];
        }
        zoneContext = {
          zoneName: zone.name,
          availableEquipment,
          biomechanicalConstraints: zone.biomechanicalConstraints || [],
        };
      }
    } catch (err) {
      if (shouldLog) console.error('[prepare-workout-chain-request] Zone fetch error:', err);
    }
  }

  const step1UserPromptOverride =
    typeof rawOverride === 'string' && rawOverride.trim().length > 0
      ? rawOverride.trim()
      : undefined;

  const personaOut: WorkoutPersona = {
    ...(persona as WorkoutPersona),
    hiitMode,
    hiitOptions: hiitMode ? hiitOptions : undefined,
    amrapDensityMode,
    amrapDensityOptions: amrapDensityMode ? amrapDensityOptions : undefined,
  };

  return {
    ok: true,
    data: {
      persona: personaOut,
      blockOptions,
      hiitOptions,
      hiitMode,
      amrapDensityOptions,
      zoneContext,
      availableEquipment,
      providedArchitect,
      step1UserPromptOverride,
    },
  };
}
