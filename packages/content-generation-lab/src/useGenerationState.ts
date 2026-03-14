/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generic hook for AI content generation: loading, result, error, submit.
 * Handles fetch, 429 rate-limit messaging, and clear.
 * Supports optional two-phase flow: research → review → generate.
 */

import { useState } from 'react';
import type { PromptReviewInput, PromptStep } from './types';

const RATE_LIMIT_MESSAGE = 'Rate limit exceeded. Please wait a few minutes and try again.';

export interface UseGenerationStateOptions<T> {
  apiEndpoint: string;
  buildBody: () => Record<string, unknown>;
  parseResponse: (data: unknown) => T;
  onSuccess?: (result: T) => void;
}

export interface UseGenerationStateTwoPhaseOptions<TResult, TResearch>
  extends UseGenerationStateOptions<TResult> {
  twoPhase: {
    buildResearchBody: () => Record<string, unknown>;
    parseResearchResponse: (data: unknown) => TResearch;
    buildGenerateBody: (researchResult: TResearch, prompts: PromptReviewInput) => Record<string, unknown>;
  };
  /** When true, first submit does research; when false, first submit does direct generate. */
  reviewPromptsBeforeGenerate?: boolean;
}

export interface UseGenerationStateReturn<T> {
  loading: boolean;
  result: T | null;
  error: string | null;
  submit: () => Promise<void>;
  clearResult: () => void;
}

export interface UseGenerationStateTwoPhaseReturn<TResult, TResearch>
  extends UseGenerationStateReturn<TResult> {
  researchResult: TResearch | null;
  promptStep: PromptStep;
  submitFromPrompts: (prompts: PromptReviewInput) => Promise<void>;
  cancelPromptReview: () => void;
}

function isTwoPhaseOptions<TResult, TResearch>(
  opts: UseGenerationStateOptions<TResult> | UseGenerationStateTwoPhaseOptions<TResult, TResearch>
): opts is UseGenerationStateTwoPhaseOptions<TResult, TResearch> {
  return 'twoPhase' in opts && opts.twoPhase != null;
}

export function useGenerationState<T>(
  options: UseGenerationStateOptions<T>
): UseGenerationStateReturn<T>;

export function useGenerationState<TResult, TResearch>(
  options: UseGenerationStateTwoPhaseOptions<TResult, TResearch>
): UseGenerationStateTwoPhaseReturn<TResult, TResearch>;

export function useGenerationState<TResult, TResearch = unknown>(
  options:
    | UseGenerationStateOptions<TResult>
    | UseGenerationStateTwoPhaseOptions<TResult, TResearch>
):
  | UseGenerationStateReturn<TResult>
  | UseGenerationStateTwoPhaseReturn<TResult, TResearch> {
  const {
    apiEndpoint,
    buildBody,
    parseResponse,
    onSuccess,
  } = options;

  const twoPhase = isTwoPhaseOptions(options) ? options.twoPhase : undefined;
  const reviewPromptsBeforeGenerate =
    isTwoPhaseOptions(options) ? options.reviewPromptsBeforeGenerate ?? false : false;

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [researchResult, setResearchResult] = useState<TResearch | null>(null);
  const [promptStep, setPromptStep] = useState<PromptStep>('idle');

  const clearResult = () => {
    setResult(null);
    setError(null);
    setResearchResult(null);
    setPromptStep('idle');
  };

  const doFetch = async (body: Record<string, unknown>) => {
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errData = (await response.json().catch(() => ({}))) as { error?: string };
      const message =
        response.status === 429 ? RATE_LIMIT_MESSAGE : (errData.error || 'Request failed');
      setError(message);
      return null;
    }

    return response.json();
  };

  const submit = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    if (twoPhase && reviewPromptsBeforeGenerate) {
      setPromptStep('research');
    }

    try {
      const body = twoPhase && reviewPromptsBeforeGenerate
        ? twoPhase.buildResearchBody()
        : buildBody();
      const data = await doFetch(body);
      if (data == null) return;

      if (twoPhase && reviewPromptsBeforeGenerate) {
        const parsed = twoPhase.parseResearchResponse(data) as TResearch;
        setResearchResult(parsed);
        setPromptStep('review');
      } else {
        const parsed = parseResponse(data) as TResult;
        setResult(parsed);
        onSuccess?.(parsed as TResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setPromptStep('idle');
    } finally {
      setLoading(false);
    }
  };

  const submitFromPrompts = async (prompts: PromptReviewInput) => {
    if (!twoPhase || researchResult == null) return;
    setLoading(true);
    setError(null);
    setPromptStep('generating');

    try {
      const body = twoPhase.buildGenerateBody(researchResult, prompts);
      const data = await doFetch(body);
      if (data == null) {
        setPromptStep('review');
        return;
      }

      const parsed = parseResponse(data) as TResult;
      setResult(parsed);
      setResearchResult(null);
      setPromptStep('idle');
      onSuccess?.(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image generation failed');
      setPromptStep('review');
    } finally {
      setLoading(false);
    }
  };

  const cancelPromptReview = () => {
    setResearchResult(null);
    setPromptStep('idle');
  };

  const baseReturn: UseGenerationStateReturn<TResult> = {
    loading,
    result,
    error,
    submit,
    clearResult,
  };

  if (twoPhase) {
    return {
      ...baseReturn,
      researchResult,
      promptStep,
      submitFromPrompts,
      cancelPromptReview,
    } as UseGenerationStateTwoPhaseReturn<TResult, TResearch>;
  }

  return baseReturn as UseGenerationStateReturn<TResult>;
}
