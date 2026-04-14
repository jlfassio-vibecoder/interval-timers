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
  TabataBalancedOptions,
  TabataBalancedPairingPattern,
  EmomFactoryOptions,
  EmomFactoryStructure,
} from '@/types/ai-workout';
import {
  getZoneByIdServer,
  getAllEquipmentItemsServer,
} from '@/lib/supabase/admin/server-equipment';
import { amrapDensityTierMinutes } from '@/lib/amrap-density-tier';
import {
  TABATA_BALANCED_MAX_ROUNDS,
  TABATA_BALANCED_MIN_ROUNDS,
  tabataBalancedExerciseCount,
  tabataBalancedSessionMinutes,
} from '@/lib/tabata-balanced-duration';
import {
  EMOM_MAX_MOVEMENTS_PER_MINUTE,
  EMOM_MAX_STATIONS_PER_CYCLE,
  EMOM_MAX_TOTAL_ROUNDS,
  EMOM_MIN_MOVEMENTS_PER_MINUTE,
  EMOM_MIN_STATIONS_PER_CYCLE,
  EMOM_MIN_TOTAL_ROUNDS,
  emomSessionMinutes,
  snapEmomTotalRoundsToCycle,
} from '@/lib/emom-factory-duration';
import {
  parseCommaSeparatedEquipmentLabels,
  mergeEquipmentDedupe,
  isBodyweightOnlyEquipment,
} from '@/lib/workout-chain/merge-equipment-lists';

const TRAINER_SELECTED_EQUIPMENT_ZONE_LABEL = 'Trainer-selected equipment';

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
  /** Normalized balanced Tabata options when tabataBalancedMode is true. */
  tabataBalancedOptions: TabataBalancedOptions | undefined;
  emomMode: boolean;
  /** Normalized EMOM factory options when emomMode is true. */
  emomOptions: EmomFactoryOptions | undefined;
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
  const tabataBalancedModeRaw = !!persona.tabataBalancedMode;
  const emomModeRaw = !!persona.emomMode;

  const metabolicModeCount =
    (amrapDensityModeRaw ? 1 : 0) +
    (hiitModeRaw ? 1 : 0) +
    (tabataBalancedModeRaw ? 1 : 0) +
    (emomModeRaw ? 1 : 0);
  if (metabolicModeCount > 1) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({
          error:
            'At most one of hiitMode, amrapDensityMode, tabataBalancedMode, and emomMode can be enabled',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }

  const amrapDensityMode = amrapDensityModeRaw;
  const tabataBalancedMode = tabataBalancedModeRaw;
  const emomMode = emomModeRaw;
  const hiitMode = !amrapDensityMode && !tabataBalancedMode && !emomMode && hiitModeRaw;

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

  let tabataBalancedOptions: TabataBalancedOptions | undefined;
  if (tabataBalancedMode) {
    const rawTabata = persona.tabataBalancedOptions;
    if (!rawTabata || typeof rawTabata !== 'object') {
      return {
        ok: false,
        response: new Response(JSON.stringify({ error: 'tabataBalancedOptions is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      };
    }
    const validPatterns: TabataBalancedPairingPattern[] = [
      'single',
      'antagonist_pair',
      'agonist_pair',
      'four_station',
      'eight_station',
    ];
    const pattern = rawTabata.pairingPattern;
    if (!validPatterns.includes(pattern)) {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({ error: 'tabataBalancedOptions.pairingPattern is invalid' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        ),
      };
    }
    const rc = rawTabata.roundCount;
    if (
      typeof rc !== 'number' ||
      rc !== Math.floor(rc) ||
      rc < TABATA_BALANCED_MIN_ROUNDS ||
      rc > TABATA_BALANCED_MAX_ROUNDS
    ) {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({
            error: `tabataBalancedOptions.roundCount must be an integer between ${TABATA_BALANCED_MIN_ROUNDS} and ${TABATA_BALANCED_MAX_ROUNDS}`,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        ),
      };
    }
    const nEx = tabataBalancedExerciseCount(pattern);
    if (nEx > 1 && rc % nEx !== 0) {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({
            error: `roundCount must be divisible by ${nEx} for pairing pattern ${pattern} so each exercise gets an equal number of work intervals`,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        ),
      };
    }
    tabataBalancedOptions = { pairingPattern: pattern, roundCount: rc };
  }

  let emomOptions: EmomFactoryOptions | undefined;
  if (emomMode) {
    const rawEmom = persona.emomOptions;
    if (!rawEmom || typeof rawEmom !== 'object') {
      return {
        ok: false,
        response: new Response(JSON.stringify({ error: 'emomOptions is required when emomMode is true' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      };
    }
    const validStructures: EmomFactoryStructure[] = ['single_movement', 'alternating', 'complex'];
    const structure = rawEmom.structure;
    if (!validStructures.includes(structure)) {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({ error: 'emomOptions.structure must be single_movement, alternating, or complex' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        ),
      };
    }
    const tr = rawEmom.totalRounds;
    if (
      typeof tr !== 'number' ||
      tr !== Math.floor(tr) ||
      tr < EMOM_MIN_TOTAL_ROUNDS ||
      tr > EMOM_MAX_TOTAL_ROUNDS
    ) {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({
            error: `emomOptions.totalRounds must be an integer between ${EMOM_MIN_TOTAL_ROUNDS} and ${EMOM_MAX_TOTAL_ROUNDS}`,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        ),
      };
    }
    if (structure === 'alternating') {
      const spc =
        typeof rawEmom.stationsPerCycle === 'number' && rawEmom.stationsPerCycle === Math.floor(rawEmom.stationsPerCycle)
          ? rawEmom.stationsPerCycle
          : EMOM_MIN_STATIONS_PER_CYCLE;
      if (spc < EMOM_MIN_STATIONS_PER_CYCLE || spc > EMOM_MAX_STATIONS_PER_CYCLE) {
        return {
          ok: false,
          response: new Response(
            JSON.stringify({
              error: `emomOptions.stationsPerCycle must be between ${EMOM_MIN_STATIONS_PER_CYCLE} and ${EMOM_MAX_STATIONS_PER_CYCLE} for alternating EMOM`,
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
        };
      }
      const snapped = snapEmomTotalRoundsToCycle(tr, spc);
      if (snapped !== tr) {
        return {
          ok: false,
          response: new Response(
            JSON.stringify({
              error: `emomOptions.totalRounds (${tr}) must be a multiple of stationsPerCycle (${spc}) for alternating EMOM, or use ${snapped}`,
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
        };
      }
      emomOptions = {
        structure,
        totalRounds: tr,
        stationsPerCycle: spc,
        includeRestStation: !!rawEmom.includeRestStation,
      };
    } else if (structure === 'complex') {
      const mpm =
        typeof rawEmom.movementsPerMinute === 'number' &&
        rawEmom.movementsPerMinute === Math.floor(rawEmom.movementsPerMinute)
          ? rawEmom.movementsPerMinute
          : EMOM_MIN_MOVEMENTS_PER_MINUTE;
      if (mpm < EMOM_MIN_MOVEMENTS_PER_MINUTE || mpm > EMOM_MAX_MOVEMENTS_PER_MINUTE) {
        return {
          ok: false,
          response: new Response(
            JSON.stringify({
              error: `emomOptions.movementsPerMinute must be between ${EMOM_MIN_MOVEMENTS_PER_MINUTE} and ${EMOM_MAX_MOVEMENTS_PER_MINUTE} for complex EMOM`,
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
        };
      }
      emomOptions = {
        structure,
        totalRounds: tr,
        movementsPerMinute: mpm,
      };
    } else {
      emomOptions = {
        structure: 'single_movement',
        totalRounds: tr,
      };
    }
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
  } else if (tabataBalancedMode && tabataBalancedOptions) {
    const expectedMin = tabataBalancedSessionMinutes(tabataBalancedOptions.roundCount);
    if (persona.sessionDurationMinutes !== expectedMin) {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({
            error: `sessionDurationMinutes must be ${expectedMin} for the selected Tabata round count (main block only)`,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        ),
      };
    }
  } else if (emomMode && emomOptions) {
    const expectedMin = emomSessionMinutes(emomOptions);
    if (persona.sessionDurationMinutes !== expectedMin) {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({
            error: `sessionDurationMinutes must be ${expectedMin} for EMOM mode (equals total EMOM rounds)`,
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
  const additionalEquipmentParsed = parseCommaSeparatedEquipmentLabels(persona.additionalEquipmentLabels);

  const loadEquipmentIdToName = async (): Promise<Map<string, string>> => {
    const equipmentItems = await getAllEquipmentItemsServer();
    return new Map(equipmentItems.map((item) => [item.id, item.name]));
  };

  if (persona.zoneId) {
    try {
      const zone = await getZoneByIdServer(persona.zoneId);
      if (zone) {
        const equipmentMap = await loadEquipmentIdToName();
        const equipmentIdsToUse = persona.selectedEquipmentIds?.length
          ? persona.selectedEquipmentIds
          : zone.equipmentIds;
        let names = equipmentIdsToUse
          .map((id) => equipmentMap.get(id))
          .filter((name): name is string => name !== undefined);
        names = mergeEquipmentDedupe(names, additionalEquipmentParsed);
        if (names.length === 0) {
          names = ['Bodyweight'];
        }
        availableEquipment = names;
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

  const needsManualEquipmentResolution =
    !zoneContext &&
    ((persona.selectedEquipmentIds?.length ?? 0) > 0 || additionalEquipmentParsed.length > 0);

  if (needsManualEquipmentResolution) {
    try {
      const equipmentMap = await loadEquipmentIdToName();
      const fromIds = (persona.selectedEquipmentIds ?? [])
        .map((id) => equipmentMap.get(id))
        .filter((name): name is string => name !== undefined);
      let names = mergeEquipmentDedupe(fromIds, additionalEquipmentParsed);
      if (names.length === 0) {
        names = ['Bodyweight'];
      }
      availableEquipment = names;
      if (!isBodyweightOnlyEquipment(names)) {
        zoneContext = {
          zoneName: TRAINER_SELECTED_EQUIPMENT_ZONE_LABEL,
          availableEquipment: names,
          biomechanicalConstraints: [],
        };
      }
    } catch (err) {
      if (shouldLog) console.error('[prepare-workout-chain-request] Equipment catalog fetch error:', err);
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
    tabataBalancedMode,
    tabataBalancedOptions: tabataBalancedMode ? tabataBalancedOptions : undefined,
    emomMode,
    emomOptions: emomMode ? emomOptions : undefined,
  };

  return {
    ok: true,
    data: {
      persona: personaOut,
      blockOptions,
      hiitOptions,
      hiitMode,
      amrapDensityOptions,
      tabataBalancedOptions,
      emomMode,
      emomOptions,
      zoneContext,
      availableEquipment,
      providedArchitect,
      step1UserPromptOverride,
    },
  };
}
