/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shell component for content generation flows: form + optional reference + result.
 * Supports optional two-phase flow with reviewSlot (research → review → generate).
 * Unstyled; consumers pass className for layout and styling.
 */

import React from 'react';
import type { PromptReviewInput } from './types';

/** Base generation shape (single-phase). */
interface GenerationBase<TResult> {
  loading: boolean;
  result: TResult | null;
  error: string | null;
  clearResult: () => void;
}

/** Extended generation shape for two-phase flow. */
interface GenerationTwoPhase<TResult, TResearch> extends GenerationBase<TResult> {
  researchResult: TResearch | null;
  promptStep: 'idle' | 'research' | 'review' | 'generating';
  submitFromPrompts: (prompts: PromptReviewInput) => Promise<void>;
  cancelPromptReview: () => void;
}

function isTwoPhaseGeneration<TResult, TResearch>(
  g: GenerationBase<TResult>
): g is GenerationTwoPhase<TResult, TResearch> {
  return (
    'researchResult' in g &&
    'promptStep' in g &&
    'submitFromPrompts' in g &&
    'cancelPromptReview' in g
  );
}

export interface ContentGenerationLabProps<TResult, TResearch = never> {
  title: string;
  /** Rendered when no result (and not in review step). */
  formSlot: React.ReactNode;
  /** Optional. Rendered with form when no result. */
  referenceSlot?: React.ReactNode;
  /** Optional. Rendered when promptStep === 'review' (two-phase flow). */
  reviewSlot?: (params: {
    researchResult: TResearch;
    onSubmit: (prompts: PromptReviewInput) => void | Promise<void>;
    onCancel: () => void;
  }) => React.ReactNode;
  /** Rendered when result exists. Receives result, onSave, onClear, saving. */
  resultSlot: (params: {
    result: TResult;
    onSave?: () => void | Promise<void>;
    onClear: () => void;
    saving?: boolean;
  }) => React.ReactNode;
  generation: GenerationBase<TResult> | GenerationTwoPhase<TResult, TResearch>;
  /** Optional save handler; if provided, resultSlot receives onSave. */
  onSave?: (result: TResult) => void | Promise<void>;
  saving?: boolean;
  onClose?: () => void;
  className?: string;
}

export function ContentGenerationLab<TResult, TResearch = never>(
  props: ContentGenerationLabProps<TResult, TResearch>
): React.ReactElement {
  const {
    title,
    formSlot,
    referenceSlot,
    reviewSlot,
    resultSlot,
    generation,
    onSave,
    saving = false,
    onClose,
    className,
  } = props;

  const hasResult = !!generation.result;
  const isTwoPhase = isTwoPhaseGeneration<TResult, TResearch>(generation);
  const showReviewSlot =
    isTwoPhase &&
    generation.promptStep === 'review' &&
    generation.researchResult != null &&
    reviewSlot != null;

  const handleSave = React.useCallback(() => {
    if (generation.result && onSave) {
      void onSave(generation.result);
    }
  }, [generation.result, onSave]);

  const handleSubmitFromPrompts = React.useCallback(
    (prompts: PromptReviewInput) => {
      if (isTwoPhase && 'submitFromPrompts' in generation) {
        void (generation as GenerationTwoPhase<TResult, TResearch>).submitFromPrompts(prompts);
      }
    },
    [isTwoPhase, generation]
  );

  let bodyContent: React.ReactNode;
  if (hasResult) {
    bodyContent = resultSlot({
      result: generation.result as TResult,
      onSave: onSave ? handleSave : undefined,
      onClear: generation.clearResult,
      saving,
    });
  } else if (showReviewSlot && isTwoPhase) {
    bodyContent = reviewSlot!({
      researchResult: generation.researchResult as TResearch,
      onSubmit: handleSubmitFromPrompts,
      onCancel: generation.cancelPromptReview,
    });
  } else {
    bodyContent = (
      <>
        {formSlot}
        {referenceSlot}
      </>
    );
  }

  return (
    <div
      className={className}
      role="region"
      aria-labelledby="content-gen-lab-title"
    >
      {(title || onClose) && (
        <div className="content-gen-lab-header">
          {title && (
            <h2 id="content-gen-lab-title" className="content-gen-lab-title">
              {title}
            </h2>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="content-gen-lab-close"
              aria-label="Close"
            >
              ×
            </button>
          )}
        </div>
      )}
      <div className="content-gen-lab-body">
        {bodyContent}
        {!hasResult && generation.error && (
          <p className="content-gen-lab-error" role="alert">
            {generation.error}
          </p>
        )}
      </div>
    </div>
  );
}
