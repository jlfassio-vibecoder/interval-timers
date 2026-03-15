/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generic hook that composes useReferenceImage (optional) and useGenerationState
 * for AI content generation flows. Supports optional two-phase research→review→generate.
 */

import { useReferenceImage } from './useReferenceImage';
import { useGenerationState } from './useGenerationState';
import type { ReferenceState } from './types';
import type {
  UseContentGenerationLabOptions,
  UseContentGenerationLabReturn,
} from './types';

export type { UseContentGenerationLabOptions, UseContentGenerationLabReturn };

export function useContentGenerationLab<TResult, TResearch = never>(
  options: UseContentGenerationLabOptions<TResult, TResearch>
): UseContentGenerationLabReturn<TResult, TResearch> {
  const {
    apiEndpoint,
    buildBody,
    parseResponse,
    onSuccess,
    useReference = false,
    proxyPath,
    twoPhase,
    reviewPromptsBeforeGenerate = false,
  } = options;

  const reference = useReference
    ? useReferenceImage({ proxyPath })
    : undefined;

  const referenceState: ReferenceState | undefined = reference
    ? {
        referenceImageUrl: reference.referenceImageUrl,
        referenceImageData: reference.referenceImageData,
        loadingReference: reference.loadingReference,
        referenceError: reference.referenceError,
      }
    : undefined;

  const baseOptions = {
    apiEndpoint,
    buildBody: () => buildBody(referenceState),
    parseResponse,
    onSuccess,
  };

  const generation = twoPhase
    ? useGenerationState<TResult, TResearch>({
        ...baseOptions,
        twoPhase: {
          buildResearchBody: () =>
            twoPhase.buildResearchBody(referenceState),
          parseResearchResponse: twoPhase.parseResearchResponse,
          buildGenerateBody: (researchResult, prompts) =>
            twoPhase.buildGenerateBody(
              researchResult,
              prompts,
              referenceState
            ),
        },
        reviewPromptsBeforeGenerate,
      })
    : useGenerationState<TResult>(baseOptions);

  return {
    generation: generation as UseContentGenerationLabReturn<
      TResult,
      TResearch
    >['generation'],
    reference,
  };
}
