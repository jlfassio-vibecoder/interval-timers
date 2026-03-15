/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared types for Content Generation Lab hooks.
 */

/** State shape for reference image (URL, dataUrl, loading, error). */
export interface ReferenceState {
  referenceImageUrl: string;
  referenceImageData: string | null;
  loadingReference: boolean;
  referenceError: string | null;
}

/** Prompts shape for generate-from-prompts (single or sequence). */
export interface PromptReviewInput {
  imagePrompt?: string;
  imagePrompts?: string[];
}

/** Optional config for research-then-generate flows. */
export interface TwoPhaseOptions<TResearch, TResult> {
  supportsPromptReview: true;
  /** Build body for research-only request. */
  buildResearchBody: (reference?: ReferenceState) => Record<string, unknown>;
  /** Parse research response. */
  parseResearchResponse: (data: unknown) => TResearch;
  /** Build body for generate-from-prompts request. */
  buildGenerateBody: (
    researchResult: TResearch,
    prompts: PromptReviewInput,
    reference?: ReferenceState
  ) => Record<string, unknown>;
}

/** Prompt step for two-phase flow. */
export type PromptStep = 'idle' | 'research' | 'review' | 'generating';

/** Options for useContentGenerationLab. */
export interface UseContentGenerationLabOptions<TResult, TResearch = never> {
  apiEndpoint: string;
  /** Build request body. Caller closes over form/context; receives reference if useReference. */
  buildBody: (reference?: ReferenceState) => Record<string, unknown>;
  parseResponse: (data: unknown) => TResult;
  onSuccess?: (result: TResult) => void;
  /** When true, wires useReferenceImage and passes reference to buildBody. */
  useReference?: boolean;
  proxyPath?: string;
  /** When set, enables research → review → generate two-phase flow. */
  twoPhase?: TwoPhaseOptions<TResearch, TResult>;
  /** When true with twoPhase, first submit does research; when false, first submit does direct generate. */
  reviewPromptsBeforeGenerate?: boolean;
}

/** Base generation return (single-phase). */
export interface GenerationReturnBase<TResult> {
  loading: boolean;
  result: TResult | null;
  error: string | null;
  submit: () => Promise<void>;
  clearResult: () => void;
}

/** Extended generation return for two-phase flow. */
export interface GenerationReturnTwoPhase<TResult, TResearch>
  extends GenerationReturnBase<TResult> {
  researchResult: TResearch | null;
  promptStep: PromptStep;
  submitFromPrompts: (prompts: PromptReviewInput) => Promise<void>;
  cancelPromptReview: () => void;
}

/** Return type for useContentGenerationLab. */
export interface UseContentGenerationLabReturn<TResult, TResearch = never> {
  generation:
    | GenerationReturnBase<TResult>
    | GenerationReturnTwoPhase<TResult, TResearch>;
  reference?: import('./useReferenceImage').UseReferenceImageReturn;
}
